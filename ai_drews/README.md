# AI-DREWS MVP (Choke Watershed)
Pipeline: 1990-2026 climate data -> CNN-LSTM ENSO forecast -> CNN-LSTM-Fourier drought probability -> risk maps -> farm advisories.

## Setup
    pip install -r requirements.txt        # install PyTorch for your OS from pytorch.org if pip fails

## Run in order (from the project folder)
    python src/step1_data.py       # Month 1   build dataset (SYNTHETIC unless real files are in data/raw/)
    python src/step2_features.py   # Month 1-2 SPI-3, VCI, anomalies, splits
    python src/step3_enso.py       # Month 2-3 Objective 1: Nino3.4 CNN-LSTM vs persistence/Ridge
    python src/step4_drought.py    # Month 4   Objective 2: super-hybrid drought model (leads 1-3)
    python src/step5_maps.py       # Month 4-5 risk maps -> outputs/risk_maps.png
    streamlit run app.py           # Month 5-6 Objective 3: dashboard + advisories (src/advisory.py)

## Plugging in real data (monthly, 1990-01 to 2026-06, same grid for all layers)
- data/raw/nino_indices.csv : date,nino34,nino12,nino4,soi   (NOAA ONI/Nino indices, SOI)
- data/raw/grids.npz : rain (CHIRPS), tmax (ERA5), soilm (ERA5), ndvi (MODIS), each shaped (T,H,W), plus
  `dates` as YYYY-MM-DD strings. Resample everything to one grid (e.g. CHIRPS 0.05 deg) first.
- Edit GRID, BBOX, split dates in src/config.py.

## Known MVP limits
- Synthetic data only checks that the code runs; real skill must be measured on real data (outputs/*_metrics.csv).
- ENSO model uses index time series (no SST-grid CNN yet); station/EMI, crop and hydrology data not yet wired in.
- ENSO forecasts feeding the drought model are in-sample for the training years, which is optimistic. Use cross-fitted forecasts later.
- Advisory rules are placeholders to co-design with farmers and experts.
