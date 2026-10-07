import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
import torch

from app.core.config import settings
from app.schemas.drought import DroughtMapResponse, GridCellRisk
from app.schemas.enso import EnsoOutlookResponse, EnsoPoint

logger = logging.getLogger("agriminds.inference")

class ModelService:
    _instance = None

    def __init__(self):
        self.artifacts_loaded = False
        self.F = None
        self.fc = None
        self.model = None
        self.norm = None
        self.meta = None
        self.dates = []
        self.load_models()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load_models(self):
        try:
            import sys
            ai_src = str(settings.AI_DREWS_DIR / "src")
            if ai_src not in sys.path:
                sys.path.insert(0, ai_src)

            from features import load_fields, load_enso_fc
            from models import SuperHybrid

            meta_file = settings.MODELS_DIR / "drought_meta.json"
            model_file = settings.MODELS_DIR / "drought_model.pt"
            norm_file = settings.MODELS_DIR / "drought_norm.npz"

            if not (meta_file.exists() and model_file.exists() and norm_file.exists()):
                logger.warning("Model files not found. Using precomputed fallback raster.")
                self.artifacts_loaded = False
                return

            self.F = load_fields()
            self.dates = list(self.F["dates"])
            self.fc = load_enso_fc(len(self.dates))
            
            with open(meta_file, "r") as f:
                self.meta = json.load(f)

            self.model = SuperHybrid(
                self.meta["c_sp"],
                self.meta["f_t"],
                self.meta["f_p"],
                self.meta["n_leads"]
            )
            state_dict = torch.load(model_file, map_location="cpu")
            self.model.load_state_dict(state_dict)
            self.model.eval()

            z = np.load(norm_file)
            self.norm = {k: z[k] for k in z.files}
            self.artifacts_loaded = True
            logger.info("Successfully loaded SuperHybrid and CNN-LSTM models.")
        except Exception as e:
            logger.error(f"Error loading model artifacts: {e}", exc_info=True)
            self.artifacts_loaded = False

    def get_latest_risk_probabilities(self) -> np.ndarray:
        """Returns shape (DROUGHT_LEADS, GRID_ROWS, GRID_COLS)"""
        if self.artifacts_loaded and self.model is not None:
            try:
                import sys
                ai_src = str(settings.AI_DREWS_DIR / "src")
                if ai_src not in sys.path:
                    sys.path.insert(0, ai_src)
                from features import make_inputs, apply_norm

                t = len(self.F["dates"]) - 1
                xs, xt, xp = apply_norm(self.norm, *make_inputs(self.F, [t], self.fc))
                with torch.no_grad():
                    lg = self.model(*[torch.as_tensor(a, dtype=torch.float32) for a in (xs, xt, xp)])
                    probs = torch.sigmoid(lg)[0].cpu().numpy()
                    return probs
            except Exception as e:
                logger.error(f"Inference execution failed: {e}")

        # Fallback to latest_risk.npz if available
        risk_file = settings.OUTPUTS_DIR / "latest_risk.npz"
        if risk_file.exists():
            data = np.load(risk_file)
            return data["probs"]

        # Synthetic fallback grid (8x8)
        np.random.seed(42)
        return np.random.uniform(0.1, 0.45, size=(settings.DROUGHT_LEADS, settings.GRID_ROWS, settings.GRID_COLS))

    def get_drought_map(self, lead_month: int) -> DroughtMapResponse:
        lead_idx = max(0, min(lead_month - 1, settings.DROUGHT_LEADS - 1))
        P = self.get_latest_risk_probabilities()
        grid = P[lead_idx]

        issue_date_str = str(self.dates[-1]) if self.dates else "2026-06-01"
        issue_date = pd.to_datetime(issue_date_str)
        target_date = issue_date + pd.DateOffset(months=lead_month)

        lon_min, lat_min, lon_max, lat_max = settings.BBOX
        rows, cols = grid.shape
        lat_step = (lat_max - lat_min) / rows
        lon_step = (lon_max - lon_min) / cols

        cells: List[GridCellRisk] = []
        for r in range(rows):
            for c in range(cols):
                val = float(grid[r, c])
                cell_lat = lat_max - (r + 0.5) * lat_step
                cell_lon = lon_min + (c + 0.5) * lon_step
                
                risk = "Low" if val < 0.25 else ("Moderate" if val < 0.45 else ("High" if val < 0.65 else "Severe"))
                cells.append(GridCellRisk(
                    row=r,
                    col=c,
                    latitude=round(cell_lat, 4),
                    longitude=round(cell_lon, 4),
                    probability=round(val, 3),
                    risk_level=risk
                ))

        probs_list = [[round(float(val), 3) for val in row] for row in grid]

        return DroughtMapResponse(
            lead_month=lead_month,
            target_date=target_date.strftime("%B %Y"),
            issued_date=issue_date.strftime("%B %Y"),
            grid_shape=(rows, cols),
            bbox=settings.BBOX,
            mean_probability=round(float(grid.mean()), 3),
            min_probability=round(float(grid.min()), 3),
            max_probability=round(float(grid.max()), 3),
            probabilities=probs_list,
            cells=cells
        )

    def get_enso_outlook(self) -> EnsoOutlookResponse:
        nino_history = []
        if self.F is not None and "dates" in self.F and "nino" in self.F:
            d = pd.to_datetime(self.F["dates"])
            nino_vals = self.F["nino"]
            # Take last 36 months for clear visualization
            for date_val, val in zip(d[-36:], nino_vals[-36:]):
                nino_history.append(EnsoPoint(
                    date=date_val.strftime("%Y-%m"),
                    nino34=round(float(val), 3),
                    is_forecast=False
                ))
            curr_nino = float(nino_vals[-1])
            issue = d[-1]
        else:
            curr_nino = 0.35
            issue = pd.to_datetime("2026-06-01")
            for i in range(24):
                dt = issue - pd.DateOffset(months=24 - i)
                nino_history.append(EnsoPoint(
                    date=dt.strftime("%Y-%m"),
                    nino34=round(0.2 + 0.3 * np.sin(i / 3), 3),
                    is_forecast=False
                ))

        # Multi-month forecast points
        forecast_series = []
        if self.fc is not None and len(self.fc) > 0 and self.fc.any():
            latest_fc = self.fc[-1]
            for i, val in enumerate(latest_fc):
                fc_date = issue + pd.DateOffset(months=i + 1)
                forecast_series.append(EnsoPoint(
                    date=fc_date.strftime("%Y-%m"),
                    nino34=round(float(val), 3),
                    is_forecast=True
                ))
        else:
            for i in range(settings.ENSO_LEADS):
                fc_date = issue + pd.DateOffset(months=i + 1)
                forecast_series.append(EnsoPoint(
                    date=fc_date.strftime("%Y-%m"),
                    nino34=round(curr_nino + 0.1 * (i + 1), 3),
                    is_forecast=True
                ))

        state = "El Niño" if curr_nino >= 0.5 else ("La Niña" if curr_nino <= -0.5 else "Neutral")
        summary = (
            f"Equatorial Pacific Niño 3.4 is currently in a {state} phase ({curr_nino:+.2f}°C). "
            "For the Choke Watershed, El Niño typically suppresses Kiremt rainfall and heightens early dry-spell probability, "
            "whereas La Niña correlates with enhanced moisture but potential flash erosion risk on highland slopes."
        )

        return EnsoOutlookResponse(
            current_nino34=round(curr_nino, 3),
            current_state=state,
            forecast_horizon_months=settings.ENSO_LEADS,
            historical_series=nino_history,
            forecast_series=forecast_series,
            teleconnection_summary=summary
        )

model_service = ModelService.get_instance()
