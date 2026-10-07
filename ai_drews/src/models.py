import torch
from torch import nn


class CNNLSTM(nn.Module):
    """Objective 1: Conv1D extracts local patterns across the climate-index window,
    LSTM models temporal dependence, MLP head predicts Nino3.4 at several leads."""
    def __init__(self, n_feat, n_out, hidden=64):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(n_feat, 32, 3, padding=1), nn.ReLU(),
            nn.Conv1d(32, 32, 3, padding=1), nn.ReLU())
        self.lstm = nn.LSTM(32, hidden, batch_first=True)
        self.head = nn.Sequential(nn.Linear(hidden, 32), nn.ReLU(), nn.Linear(32, n_out))

    def forward(self, x):                       # x: (B, T, F)
        h = self.conv(x.transpose(1, 2)).transpose(1, 2)
        o, _ = self.lstm(h)
        return self.head(o[:, -1])


class SuperHybrid(nn.Module):
    """Objective 2: CNN (spatial Xs) + LSTM (temporal Xt) + Fourier/periodic branch (Xp).
    Output: drought logits per lead and per grid cell -> (B, L, H, W)."""
    def __init__(self, c_sp, f_t, f_p, n_leads, hidden=64):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(c_sp, 16, 3, padding=1), nn.ReLU(),
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU())
        self.lstm = nn.LSTM(f_t, hidden, batch_first=True)
        self.fourier = nn.Sequential(nn.Linear(f_p, 32), nn.ReLU())
        self.glob = nn.Sequential(nn.Linear(hidden + 32, 32), nn.ReLU(), nn.Dropout(0.2))
        self.head = nn.Sequential(nn.Conv2d(64, 32, 1), nn.ReLU(), nn.Conv2d(32, n_leads, 1))

    def forward(self, xs, xt, xp):
        sp = self.cnn(xs)                                   # (B,32,H,W) keeps location info
        o, _ = self.lstm(xt)
        g = self.glob(torch.cat([o[:, -1], self.fourier(xp)], 1))   # (B,32) basin-wide context
        g = g[:, :, None, None].expand(-1, -1, sp.shape[2], sp.shape[3])
        return self.head(torch.cat([sp, g], 1))             # logits
