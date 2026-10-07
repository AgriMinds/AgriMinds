"""Objective 1: Conv1D + LSTM Nino3.4 forecaster.

Attribute names (`conv`, `lstm`, `head`) are part of the saved state_dict contract. Do not rename
without bumping the model version and re-training.
"""

from __future__ import annotations

import torch
from torch import nn


class CNNLSTM(nn.Module):
    """Conv1D extracts local patterns across the climate-index window, LSTM models temporal
    dependence, an MLP head predicts Nino3.4 at several leads."""

    def __init__(self, n_feat: int, n_out: int, hidden: int = 64):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(n_feat, 32, 3, padding=1),
            nn.ReLU(),
            nn.Conv1d(32, 32, 3, padding=1),
            nn.ReLU(),
        )
        self.lstm = nn.LSTM(32, hidden, batch_first=True)
        self.head = nn.Sequential(nn.Linear(hidden, 32), nn.ReLU(), nn.Linear(32, n_out))

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # x: (B, T, F)
        h = self.conv(x.transpose(1, 2)).transpose(1, 2)
        o, _ = self.lstm(h)
        return self.head(o[:, -1])
