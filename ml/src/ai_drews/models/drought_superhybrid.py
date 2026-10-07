"""Objective 2: SuperHybrid drought-probability model (CNN-2D spatial + LSTM temporal + Fourier branch).

Attribute names (`cnn`, `lstm`, `fourier`, `glob`, `head`) are part of the saved state_dict contract.
"""

from __future__ import annotations

import torch
from torch import nn


class SuperHybrid(nn.Module):
    """Output: drought logits per lead and per grid cell -> (B, L, H, W)."""

    def __init__(self, c_sp: int, f_t: int, f_p: int, n_leads: int, hidden: int = 64):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(c_sp, 16, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(16, 32, 3, padding=1),
            nn.ReLU(),
        )
        self.lstm = nn.LSTM(f_t, hidden, batch_first=True)
        self.fourier = nn.Sequential(nn.Linear(f_p, 32), nn.ReLU())
        self.glob = nn.Sequential(nn.Linear(hidden + 32, 32), nn.ReLU(), nn.Dropout(0.2))
        self.head = nn.Sequential(nn.Conv2d(64, 32, 1), nn.ReLU(), nn.Conv2d(32, n_leads, 1))

    def forward(self, xs: torch.Tensor, xt: torch.Tensor, xp: torch.Tensor) -> torch.Tensor:
        sp = self.cnn(xs)  # (B,32,H,W) keeps location info
        o, _ = self.lstm(xt)
        g = self.glob(torch.cat([o[:, -1], self.fourier(xp)], 1))  # (B,32) basin-wide context
        g = g[:, :, None, None].expand(-1, -1, sp.shape[2], sp.shape[3])
        return self.head(torch.cat([sp, g], 1))  # logits
