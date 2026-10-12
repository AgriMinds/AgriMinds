---
language:
- en
license: mit
tags:
- tabular
- agriculture
- ethiopia
- crop-yield
- climate-change
- el-nino
- xgboost
- scikit-learn
datasets:
- Chokye_Water_Sheild-crop-climate-altitude-zones
metrics:
- rmse
- mae
- r2
- mape
---

# 🌾 Ethiopia(Chokye Water Shield) Crop Yield & ENSO Climate Resilience Model

This repository provides trained machine learning models (XGBoost, Random Forest, LightGBM, and Ridge) predicting **crop yields (Teff, Wheat, Maize)** across traditional **Ethiopian agro-ecological altitude zones** under variable **ENSO (El Niño / La Niña)** climate regimes.

The models are trained on historical climate and agricultural observations (1990–2023) mapped to Ethiopian elevation tiers:
- **Lowland / Kolla (`< 1,500 m`)**
- **Midland / Woina Dega (`1,500 - 2,500 m`)**
- **Highland / Dega (`> 2,500 m`)**

---

## 📊 Model Performance on Holdout Test Set (2017–2023)

Evaluated with strict chronological validation (Trained on 1990–2016, tested on 2017–2023):

| Model | Test RMSE (q/ha) | Test MAE (q/ha) | Test $R^2$ | Test MAPE (%) |
|---|---|---|---|---|
| **Naive Baseline (Mean)** | 15.93 | 12.45 | -0.100 | 43.52% |
| **Ridge Regression** | 9.08 | 7.29 | 0.643 | 33.82% |
| **LightGBM** | 7.33 | 5.93 | 0.767 | 24.08% |
| **Random Forest** | 7.14 | 5.55 | 0.779 | 22.11% |
| **XGBoost (Best)** | **6.78** | **5.24** | **0.801** | **22.19%** |

---

## 🎯 Key Empirical Findings
- **Maize:** Exhibits strong resilience in Midland (Woina Dega) areas during El Niño events.
- **Teff:** Highly resilient in Lowland (Kolla) zones with minimal yield loss compared to higher altitudes.
- **Wheat:** Most vulnerable in Lowland zones during El Niño conditions, requiring irrigation support and drought-tolerant varieties.

---

## 🚀 How to Use

### 1. Installation
```bash
pip install huggingface_hub joblib scikit-learn xgboost pandas numpy
```

### 2. Download and Run Inference
```python
import joblib
from huggingface_hub import hf_hub_download
import pandas as pd

# Download model pipeline
model_file = hf_hub_download(
    repo_id="aykgeh/Chokye_Water_Shield",
    filename="models/best_crop_yield_model.joblib"
)

artifact = joblib.load(model_file)
pipeline = artifact["pipeline"]

# Define prediction scenario
sample = pd.DataFrame([{
    'crop': 'Maize',
    'zone': 'Midland',
    'altitude_approx_m': 2000,
    'temperature_c': 18.5,
    'precipitation_mm': 65.0,
    'pt_ratio': 65.0 / (18.5 + 1e-5),
    'enso_index': 1.2,          # El Niño conditions (> 0.5)
    'enso_phase': 'El Nino',
    'year': 2024,
    'yield_lag1': 48.0,
    'yield_rolling3_mean': 46.5
}])

pred_yield = pipeline.predict(sample)[0]
print(f"Predicted Crop Yield: {pred_yield:.2f} quintals/hectare")
```

---

## 📁 Repository Contents
- `models/best_crop_yield_model.joblib`: Preprocessor pipeline + fitted XGBoost regressor.
- `models/metrics_summary.json`: Detailed error metrics across all tested models.
- `data/crop_climate_clean.csv`: Reshaped panel dataset (306 observations, 1990–2023).
- `plots/model_comparison.png`: Metric comparison across models.
- `plots/actual_vs_predicted.png`: Holdout test actual vs predicted curves.
- `plots/slice_error_heatmap.png`: Model error slice analysis by crop and altitude zone.
- `preprocess.py`: Data transformation script.
- `train.py`: Model training & evaluation pipeline.
- `predict.py`: Inference and ENSO climate scenario simulation module.
