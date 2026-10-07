"""Shared loader used by step5 and the dashboard."""
import json, numpy as np, pandas as pd, torch
from config import *
from features import load_fields, load_enso_fc, make_inputs, apply_norm
from models import SuperHybrid


def load_artifacts():
    F = load_fields(); meta = json.load(open(MODELS / "drought_meta.json"))
    model = SuperHybrid(meta["c_sp"], meta["f_t"], meta["f_p"], meta["n_leads"])
    model.load_state_dict(torch.load(MODELS / "drought_model.pt", map_location="cpu")); model.eval()
    z = np.load(MODELS / "drought_norm.npz"); norm = {k: z[k] for k in z.files}
    return dict(F=F, fc=load_enso_fc(len(F["dates"])), model=model, norm=norm, meta=meta)


@torch.no_grad()
def risk_at(art, t=None):
    """Drought probability maps (L,H,W) issued at month index t (default: latest month)."""
    F = art["F"]; t = len(F["dates"]) - 1 if t is None else t
    xs, xt, xp = apply_norm(art["norm"], *make_inputs(F, [t], art["fc"]))
    lg = art["model"](*[torch.as_tensor(a, dtype=torch.float32) for a in (xs, xt, xp)])
    return torch.sigmoid(lg)[0].numpy()
