import random
import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from config import SEED, BATCH, EPOCHS, PATIENCE, LR

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def set_seed(seed=SEED):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)


def loader(arrays, shuffle=False):
    ds = TensorDataset(*[torch.as_tensor(a, dtype=torch.float32) for a in arrays])
    return DataLoader(ds, batch_size=BATCH, shuffle=shuffle)


def _run(model, dl, loss_fn, opt=None):
    train = opt is not None
    model.train(train)
    tot = n = 0
    with torch.set_grad_enabled(train):
        for *xs, y in dl:
            xs = [x.to(DEVICE) for x in xs]; y = y.to(DEVICE)
            loss = loss_fn(model(*xs), y)
            if train:
                opt.zero_grad(); loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
            tot += loss.item() * len(y); n += len(y)
    return tot / n


def fit(model, loss_fn, train_dl, val_dl, epochs=EPOCHS, lr=LR, patience=PATIENCE):
    """Train with early stopping on validation loss; restores the best weights."""
    model.to(DEVICE)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    best, best_state, wait = float("inf"), None, 0
    for ep in range(1, epochs + 1):
        tl = _run(model, train_dl, loss_fn, opt)
        vl = _run(model, val_dl, loss_fn)
        if vl < best - 1e-5:
            best, wait = vl, 0
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
        else:
            wait += 1
        if ep % 5 == 0 or ep == 1:
            print(f"epoch {ep:3d} | train {tl:.4f} | val {vl:.4f} | best {best:.4f}")
        if wait >= patience:
            print(f"early stop at epoch {ep}"); break
    model.load_state_dict(best_state)
    return model


@torch.no_grad()
def predict(model, *arrays, batch=256):
    model.to(DEVICE).eval()
    outs = []
    for i in range(0, len(arrays[0]), batch):
        xs = [torch.as_tensor(a[i:i + batch], dtype=torch.float32).to(DEVICE) for a in arrays]
        outs.append(model(*xs).cpu().numpy())
    return np.concatenate(outs)
