"""Generic training loop with early stopping, shared by both objectives."""

from __future__ import annotations

import logging
import random
from collections.abc import Sequence

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from ai_drews.config import DEFAULT_CONFIG, PipelineConfig

log = logging.getLogger(__name__)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def set_seed(seed: int = DEFAULT_CONFIG.seed) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def make_loader(arrays: Sequence[np.ndarray], batch_size: int, shuffle: bool = False) -> DataLoader:
    ds = TensorDataset(*[torch.as_tensor(a, dtype=torch.float32) for a in arrays])
    return DataLoader(ds, batch_size=batch_size, shuffle=shuffle)


def _run_epoch(model: nn.Module, dl: DataLoader, loss_fn, opt=None) -> float:
    train = opt is not None
    model.train(train)
    tot = n = 0
    with torch.set_grad_enabled(train):
        for *xs, y in dl:
            xs = [x.to(DEVICE) for x in xs]
            y = y.to(DEVICE)
            loss = loss_fn(model(*xs), y)
            if train:
                opt.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                opt.step()
            tot += loss.item() * len(y)
            n += len(y)
    return tot / max(n, 1)


def fit(
    model: nn.Module,
    loss_fn,
    train_dl: DataLoader,
    val_dl: DataLoader,
    cfg: PipelineConfig = DEFAULT_CONFIG,
) -> nn.Module:
    """Train with early stopping on validation loss; restores the best weights."""
    model.to(DEVICE)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=1e-5)
    best, best_state, wait = float("inf"), None, 0
    for ep in range(1, cfg.epochs + 1):
        tl = _run_epoch(model, train_dl, loss_fn, opt)
        vl = _run_epoch(model, val_dl, loss_fn)
        if vl < best - 1e-5:
            best, wait = vl, 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            wait += 1
        if ep % 5 == 0 or ep == 1:
            log.info("epoch %3d | train %.4f | val %.4f | best %.4f", ep, tl, vl, best)
        if wait >= cfg.patience:
            log.info("early stop at epoch %d", ep)
            break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model


@torch.no_grad()
def predict(model: nn.Module, *arrays: np.ndarray, batch: int = 256) -> np.ndarray:
    model.to(DEVICE).eval()
    outs = []
    for i in range(0, len(arrays[0]), batch):
        xs = [torch.as_tensor(a[i : i + batch], dtype=torch.float32).to(DEVICE) for a in arrays]
        outs.append(model(*xs).cpu().numpy())
    return np.concatenate(outs)
