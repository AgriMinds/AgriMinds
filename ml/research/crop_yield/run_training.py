"""Retrain the Chokye_Water_Shield crop-yield model on this repo's spreadsheet.

`preprocess.py`, `train.py` and `predict.py` are the upstream scripts from
https://huggingface.co/aykgeh/Chokye_Water_Shield, kept byte-identical so the
retrained artifact stays comparable with the published one. This runner only
points them at `data/climate-crop-v2.xlsx` (the revised ENSO series) and keeps
the outputs beside the upstream baselines:

    data/crop_climate_clean.csv            long panel built from the spreadsheet
    models/best_crop_yield_model.joblib    preprocessor + best regressor
    models/metrics_summary.json            all five candidates, holdout metrics
    plots/*.png                            comparison, actual-vs-predicted, error slices

The upstream files are preserved as `data/upstream_crop_climate_clean.csv` and
`models/upstream_metrics_summary.json` for a side-by-side read.

It then publishes the artifact to `data/models/crop_yield_{model.joblib,meta.json}`, which is
where the API loads it from (see `publish.py`).

    python ml/research/crop_yield/run_training.py
"""

import json
import os

from preprocess import prepare_crop_dataset
from publish import publish
from train import train_and_evaluate_models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(BASE_DIR)))
EXCEL_PATH = os.path.join(BASE_DIR, "data", "climate-crop-v2.xlsx")
CLEAN_CSV = os.path.join(BASE_DIR, "data", "crop_climate_clean.csv")


def _data_dir() -> str:
    """Where the API reads artifacts from: the environment if set, else the repo's data root.

    Resolved from this file rather than the working directory, so training from the repo root
    and from this directory publish to the same place.
    """
    return (
        os.environ.get("AI_DREWS_DATA_DIR")
        or os.environ.get("AGRIMINDS_DATA_DIR")
        or os.path.join(REPO_ROOT, "data")
    )


def main() -> None:
    print(f"Source spreadsheet: {EXCEL_PATH}")
    df = prepare_crop_dataset(EXCEL_PATH, CLEAN_CSV)
    print(
        f"Panel: {df['year'].min()}-{df['year'].max()}, "
        f"{df['crop'].nunique()} crops x {df['zone'].nunique()} zones, "
        f"ENSO phases {sorted(df['enso_phase'].unique())}"
    )

    results, best = train_and_evaluate_models(CLEAN_CSV, BASE_DIR)

    upstream_path = os.path.join(BASE_DIR, "models", "upstream_metrics_summary.json")
    with open(upstream_path) as f:
        upstream = json.load(f)

    print("\nRetrained vs published (test RMSE, q/ha)")
    print(f"{'model':<24}{'published':>11}{'retrained':>11}{'delta':>9}")
    for name, metrics in results.items():
        before = upstream.get(name, {}).get("test_rmse")
        delta = f"{metrics['test_rmse'] - before:+.3f}" if before is not None else "-"
        print(f"{name:<24}{before if before is not None else '-':>11}{metrics['test_rmse']:>11}{delta:>9}")
    print(f"\nBest model this run: {best}")
    publish(_data_dir())


if __name__ == "__main__":
    main()
