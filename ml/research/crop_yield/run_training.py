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

from corrected import prepare_crop_dataset_corrected
from preprocess import prepare_crop_dataset
from publish import publish
from train import train_and_evaluate_models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(BASE_DIR)))
EXCEL_PATH = os.path.join(BASE_DIR, "data", "climate-crop-v2.xlsx")
CLEAN_CSV = os.path.join(BASE_DIR, "data", "crop_climate_clean.csv")
CORRECTED_CSV = os.path.join(BASE_DIR, "data", "crop_climate_clean_corrected.csv")
CORRECTED_DIR = os.path.join(BASE_DIR, "corrected")


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

    # ---- the published artifact is fitted on the verified panel ---------------------------
    print("\n" + "=" * 72)
    print("Verified rebuild: ENSO checked against its seasonal source, rolling mean grouped")
    print("=" * 72)
    corrected_df, discrepancies = prepare_crop_dataset_corrected(EXCEL_PATH, CORRECTED_CSV)
    corrected_results, corrected_best = train_and_evaluate_models(CORRECTED_CSV, CORRECTED_DIR)

    print("\nTest RMSE (q/ha): published vs retrained-as-upstream vs verified")
    print(f"{'model':<24}{'published':>11}{'as-upstream':>13}{'verified':>11}{'delta':>9}")
    for name, metrics in results.items():
        pub = upstream.get(name, {}).get("test_rmse")
        fixed = corrected_results[name]["test_rmse"]
        delta = f"{fixed - metrics['test_rmse']:+.3f}"
        print(f"{name:<24}{pub if pub is not None else '-':>11}"
              f"{metrics['test_rmse']:>13}{fixed:>11}{delta:>9}")
    print(f"\nBest model on the verified panel: {corrected_best}")

    corrections = [
        {
            "field": "enso_index",
            "year": d.year,
            "spreadsheet": d.spreadsheet,
            "corrected_to": d.reference,
            "source": "nino34_seasonal_reference.csv (mean of DJF/MAM/JJA/SON)",
        }
        for d in discrepancies
    ] + [
        {
            "field": "yield_rolling3_mean",
            "rows_changed": 16,
            "reason": "upstream rolls across crop-zone boundaries; the rebuild rolls inside each series",
        }
    ]
    publish(
        _data_dir(),
        run_dir=CORRECTED_DIR,
        panel_file=CORRECTED_CSV,
        corrections=corrections,
    )


if __name__ == "__main__":
    main()
