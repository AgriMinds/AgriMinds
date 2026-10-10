"""Script to generate high-resolution, publication-grade figures for AgriMinds / AI-DREWS research documentation."""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import pandas as pd

os.makedirs("docs/assets/figures", exist_ok=True)
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["DejaVu Sans", "Arial", "Helvetica"],
    "font.size": 10,
    "axes.labelsize": 11,
    "axes.titlesize": 12,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "legend.fontsize": 9,
    "figure.titlesize": 14,
    "figure.dpi": 300,
})

# ==============================================================================
# Figure 1: Comparative Evaluation of Alternative Models (Required Inputs 1)
# ==============================================================================
print("Generating Figure 1: Comparative Evaluation of Alternative Models...")
df_comp = pd.read_csv("data/outputs/model_comparison.csv")

fig, axes = plt.subplots(2, 2, figsize=(12, 9))
palette = {
    "SuperHybrid (CNN-LSTM-Fourier)": "#1b5e20",  # Dark Green (Our Model)
    "CNN-LSTM": "#0288d1",                       # Blue
    "CNN": "#7b1fa2",                            # Purple
    "LSTM": "#f57c00",                           # Orange
    "ANN": "#d32f2f",                            # Red
    "RCM": "#616161",                            # Grey
}
styles = {
    "SuperHybrid (CNN-LSTM-Fourier)": {"marker": "o", "linewidth": 2.5, "linestyle": "-"},
    "CNN-LSTM": {"marker": "s", "linewidth": 1.8, "linestyle": "--"},
    "CNN": {"marker": "^", "linewidth": 1.5, "linestyle": "-."},
    "LSTM": {"marker": "v", "linewidth": 1.5, "linestyle": ":"},
    "ANN": {"marker": "d", "linewidth": 1.5, "linestyle": "-."},
    "RCM": {"marker": "x", "linewidth": 1.5, "linestyle": ":"},
}

metrics = [
    ("RMSE", "Root Mean Square Error (RMSE)", axes[0, 0], "lower left"),
    ("MAE", "Mean Absolute Error (MAE)", axes[0, 1], "lower left"),
    ("AUC", "Area Under ROC Curve (ROC-AUC)", axes[1, 0], "upper right"),
    ("Accuracy", "Classification Accuracy", axes[1, 1], "upper right"),
]

for metric_col, title, ax, leg_loc in metrics:
    for model_name, group in df_comp.groupby("model"):
        grp = group.sort_values("lead")
        ax.plot(
            grp["lead"],
            grp[metric_col],
            label=model_name,
            color=palette.get(model_name, "black"),
            **styles.get(model_name, {"marker": "o", "linewidth": 1})
        )
    ax.set_title(title, fontweight="bold", pad=8)
    ax.set_xlabel("Forecast Lead Time (Months)")
    ax.set_ylabel(metric_col)
    ax.set_xticks(range(1, 13))
    ax.grid(True, linestyle="--", alpha=0.5)

axes[0, 0].legend(loc="upper left", framealpha=0.9, fontsize=8)
plt.suptitle("Figure 1: Comparative Evaluation of Alternative Models Across Forecast Leads (1–12 Months)\n(Evaluating SuperHybrid vs. CNN-LSTM, CNN, LSTM, ANN, and Regional Climate Models)", fontsize=13, fontweight="bold", y=0.98)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])
plt.savefig("docs/assets/figures/fig1_comparative_models.png", dpi=300)
plt.close()

# ==============================================================================
# Figure 2: Historical Data-Based Model Validation (Required Inputs 2)
# ==============================================================================
print("Generating Figure 2: Historical Data-Based Model Validation...")
df_hist = pd.read_csv("data/outputs/historical_validation.csv")
df_h1 = df_hist[df_hist["lead"] == 1].sort_values("date")
dates = pd.to_datetime(df_h1["date"])
obs = df_h1["observed"].values
pred = df_h1["predicted"].values
r_val = df_h1["PearsonR"].iloc[0]
rmse_val = df_h1["RMSE"].iloc[0]
mae_val = df_h1["MAE"].iloc[0]

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), gridspec_kw={"height_ratios": [2.5, 1]})

# Background bands for Sc-PDSI classification
ax1.axhspan(3, 5, color="#0d47a1", alpha=0.15, label="Extremely Wet (> +3.0)")
ax1.axhspan(2, 3, color="#1976d2", alpha=0.12, label="Very Wet (+2.0 to +3.0)")
ax1.axhspan(1, 2, color="#42a5f5", alpha=0.10, label="Moderately Wet (+1.0 to +2.0)")
ax1.axhspan(-1, 1, color="#81c784", alpha=0.10, label="Near Normal (-1.0 to +1.0)")
ax1.axhspan(-2, -1, color="#fff176", alpha=0.15, label="Moderately Dry (-2.0 to -1.0)")
ax1.axhspan(-3, -2, color="#ffb74d", alpha=0.20, label="Very Dry (-3.0 to -2.0)")
ax1.axhspan(-5, -3, color="#e57373", alpha=0.25, label="Extremely Dry (< -3.0)")

ax1.plot(dates, obs, color="#1565c0", marker="o", linewidth=2.2, label="Observed Historical Sc-PDSI", zorder=4)
ax1.plot(dates, pred, color="#c62828", marker="s", linewidth=2.0, linestyle="--", label="Model Predicted Sc-PDSI (Lead 1)", zorder=5)

# Annotate metrics box
metric_text = f"Out-of-Sample Validation (2011–2025)\nTraining Period: 1990–2010\nPearson Correlation (R) = {r_val:.3f}\nRMSE = {rmse_val:.3f}\nMAE = {mae_val:.3f}"
ax1.text(0.02, 0.95, metric_text, transform=ax1.transAxes, verticalalignment="top",
         bbox=dict(boxstyle="round,pad=0.6", facecolor="white", edgecolor="#37474f", alpha=0.95, lw=1.2),
         fontsize=9.5, fontweight="semibold")

ax1.set_ylabel("Self-Calibrated Palmer Drought Severity Index (Sc-PDSI)")
ax1.set_title("Out-of-Sample Hindcasting Validation of Super-Hybrid Model (2011–2025)", fontweight="bold")
ax1.grid(True, linestyle="--", alpha=0.6)
ax1.set_ylim(-4.5, 4.5)
ax1.legend(loc="lower right", ncol=3, fontsize=8, framealpha=0.9)

# Error residual plot
errors = pred - obs
ax2.bar(dates, errors, width=120, color=np.where(errors >= 0, "#e53935", "#1e88e5"), alpha=0.7, edgecolor="black", linewidth=0.5)
ax2.axhline(0, color="black", linewidth=1)
ax2.set_ylabel("Residual (Pred - Obs)")
ax2.set_xlabel("Validation Year (2011–2025)")
ax2.set_title("Prediction Error Residuals", fontsize=10, fontweight="bold")
ax2.grid(True, linestyle="--", alpha=0.5)

plt.suptitle("Figure 2: Historical Data-Based Model Validation (1990–2025)\nChronological Partitioning: 1990–2010 Calibration vs. 2011–2025 Independent Evaluation", fontsize=13, fontweight="bold", y=0.98)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])
plt.savefig("docs/assets/figures/fig2_historical_validation.png", dpi=300)
plt.close()

# ==============================================================================
# Figure 3: ENSO Teleconnection & Forecasting Skill
# ==============================================================================
print("Generating Figure 3: ENSO Teleconnection & Forecasting Skill...")
df_enso_m = pd.read_csv("data/outputs/enso_metrics.csv")
df_tele = pd.read_csv("data/outputs/enso_drought_correlation.csv")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

for model_name, grp in df_enso_m.groupby("model"):
    g = grp.sort_values("lead")
    ax1.plot(g["lead"], g["RMSE"], marker="o", label=f"{model_name} (RMSE)", linewidth=2)

ax1.set_title("(a) Niño 3.4 Forecast Error by Lead", fontweight="bold")
ax1.set_xlabel("Lead Month")
ax1.set_ylabel("Root Mean Square Error (°C)")
ax1.set_xticks(range(1, 13))
ax1.grid(True, linestyle="--", alpha=0.5)
ax1.legend()

ax2.plot(df_tele["lag_months"], df_tele["correlation"], marker="s", color="#b71c1c", linewidth=2.2, label="Niño 3.4 vs Sc-PDSI")
ax2.axhline(0, color="grey", linestyle="--")
ax2.set_title("(b) Atmospheric Teleconnection Lag Correlation (0–9 Months)", fontweight="bold")
ax2.set_xlabel("Lag (Months)")
ax2.set_ylabel("Pearson Correlation (R)")
ax2.set_xticks(range(0, 10))
ax2.grid(True, linestyle="--", alpha=0.5)
ax2.legend()

plt.suptitle("Figure 3: Hydro-Climatic Teleconnections and Multi-Lead ENSO Forecast Accuracy", fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig("docs/assets/figures/fig3_enso_teleconnection.png", dpi=300)
plt.close()

# ==============================================================================
# Figure 4: End-to-End System Architecture Blueprint
# ==============================================================================
print("Generating Figure 4: System Architecture Blueprint...")
fig, ax = plt.subplots(figsize=(13, 8))
ax.axis("off")

# Draw architecture boxes
layers = [
    {"title": "1. Multi-Source Hydro-Climatic Data Ingestion Layer", "color": "#e8f5e9", "border": "#2e7d32",
     "items": ["NOAA PSL (ERSST v6): Niño 3.4, Niño 1+2, Niño 4, SOI",
               "ERA5 Reanalysis: 2m Temperature, Precip, Soil Moisture, Wind u/v, PET",
               "CHIRPS v2.0: High-Resolution Satellite Rainfall Validation (0.05°)",
               "MODIS MOD13Q1: NDVI / EVI Greenness & Vegetation Condition Index (VCI)",
               "FAOSTAT & CSA: Regional Crop Area, Yield, and Production Statistics"]},
    {"title": "2. Feature Engineering & Spatial Discretization Engine", "color": "#e3f2fd", "border": "#1565c0",
     "items": ["Water Balance Sc-PDSI: Evapotranspiration, Soil Recharge, Runoff, Moisture Loss",
               "Multi-Scalar Drought Indices: SPI-1, SPI-3, SPI-6 & Vegetation Condition Index (VCI)",
               "Choke Mountain Watershed 8×8 Spatial Grid (18,948 km² surveyed polygon boundary)",
               "Polygon Masking: 49 Active Hydrological Cells | 15 Masked Exterior Cells",
               "Immutable Manifests & Data Provenance Hashes (Zero fabricated values)"]},
    {"title": "3. Super-Hybrid Deep Learning Predictive Core", "color": "#fff3e0", "border": "#e65100",
     "items": ["Conv1D-LSTM ENSO Forecaster: Nino 3.4 Trajectory Modeling (Leads 1–12)",
               "Spatial Branch (Xs): 2D-CNN capturing spatial climate gradients across grid",
               "Temporal Branch (Xt): LSTM modeling multi-month antecedent atmospheric bridge",
               "Periodic Branch (Xp): Fast Fourier Transform (FFT) modeling seasonal harmonics",
               "Global Context Fusion & Transposition Head: P(SPI-3 <= -1) probability maps"]},
    {"title": "4. Agro-Ecological Decision Support & IEK Consensus Engine", "color": "#f3e5f5", "border": "#6a1b9a",
     "items": ["Crop Sensitivity Calibration: Tef (0.8), Wheat (1.0), Maize (1.3)",
               "Dynamic Risk Tiering: Low (<0.25), Moderate (0.25–0.45), High (0.45–0.65), Severe (>0.65)",
               "Action Packages: Certified drought seed, planting window shifts, deficit irrigation",
               "Indigenous Ecological Knowledge (IEK): Bi-directional traditional sign consensus",
               "Dual-Track Horizon: Probabilistic warning (Lead 1) & Qualitative Outlook (Leads 2–12)"]},
    {"title": "5. Enterprise Backend & Presentation Ecosystem", "color": "#eceff1", "border": "#37474f",
     "items": ["Async API Core: FastAPI, SQLAlchemy 2, Redis 7 Caching, PostgreSQL 17",
               "Security & Scoping: Argon2id hashing, rotating JWTs, RBAC (Farmer / Agent / Minister)",
               "Read-Only Analytics Star Schema: agriminds_bi role & embedded Metabase BI",
               "Web Command Centre: Next.js 16, React 19, Tailwind CSS v4, Lucide, Recharts",
               "Mobile Field App: Expo React Native, offline-first AsyncStorage, Trilingual (EN/AM/OR)"]}
]

y_top = 0.94
box_height = 0.16
gap = 0.025

for i, layer in enumerate(layers):
    y = y_top - i * (box_height + gap)
    rect = patches.FancyBboxPatch((0.05, y - box_height), 0.90, box_height,
                                  boxstyle="round,pad=0.015,rounding_size=0.02",
                                  facecolor=layer["color"], edgecolor=layer["border"], linewidth=2)
    ax.add_patch(rect)
    ax.text(0.08, y - 0.035, layer["title"], fontsize=11.5, fontweight="bold", color=layer["border"])
    
    # Text items
    for j, item in enumerate(layer["items"]):
        col = j % 2
        row = j // 2
        x_pos = 0.09 + col * 0.44
        y_pos = y - 0.07 - row * 0.035
        ax.text(x_pos, y_pos, f"• {item}", fontsize=8.5, color="#212121")

plt.title("Figure 4: AgriMinds / AI-DREWS End-to-End System Architecture Blueprint\nFrom Global Climate Intelligence to Farm-Level Decision Support", fontsize=13, fontweight="bold", pad=15)
plt.tight_layout()
plt.savefig("docs/assets/figures/fig4_system_architecture.png", dpi=300)
plt.close()

# ==============================================================================
# Figure 5: Agro-Ecological Decision Support Workflow & IEK Consensus Matrix
# ==============================================================================
print("Generating Figure 5: Decision Support & IEK Consensus Matrix...")
fig, ax = plt.subplots(figsize=(12, 7))
ax.axis("off")

boxes = [
    {"x": 0.05, "y": 0.70, "w": 0.25, "h": 0.22, "title": "Input Climate Data", "bg": "#e1f5fe", "bc": "#0288d1",
     "text": "• Raw Drought Prob (P)\n• Lead Month (1–12)\n• Target Month & Season\n• Niño 3.4 ENSO Anomaly\n• Farm Plot Coordinates"},
    {"x": 0.38, "y": 0.70, "w": 0.25, "h": 0.22, "title": "Agronomic Tuning", "bg": "#fff9c4", "bc": "#fbc02d",
     "text": "• Crop Profile Selection:\n  - Tef (s = 0.8)\n  - Wheat (s = 1.0)\n  - Maize (s = 1.3)\n• Adjusted Prob: P * s\n• Risk Level Assignment"},
    {"x": 0.71, "y": 0.70, "w": 0.25, "h": 0.22, "title": "IEK Consensus Engine", "bg": "#f1f8e9", "bc": "#689f38",
     "text": "• Traditional Cues:\n  - Wind direction shifts\n  - Bird migration patterns\n  - Plant phenology signs\n• Cross-Validation Filter:\n  - High / Moderate / Divergent"},
    {"x": 0.15, "y": 0.20, "w": 0.32, "h": 0.38, "title": "Prescriptive Action Package", "bg": "#fbe9e7", "bc": "#d84315",
     "text": "• Low Risk:\n  - Certified seed, standard sowing\n• Moderate Risk:\n  - Early maturing seed, micro-catchment\n• High Risk:\n  - Drought varieties, deficit irrigation\n• Severe Risk:\n  - Emergency crop pivot (maize -> tef)\n  - Fodder reserve, safety net mobilization"},
    {"x": 0.55, "y": 0.20, "w": 0.32, "h": 0.38, "title": "Multi-Channel Delivery & Audit", "bg": "#ede7f6", "bc": "#512da8",
     "text": "• Web Command Centre (Ministry/Agent)\n  - Woreda-level exposure & crop mix\n• Offline Mobile App (Field Agent/Farmer)\n  - Trilingual UI: English, Amharic, Oromo\n  - Plot-level advice with read-receipt\n• Analytics BI Integration\n  - Read-only Star Schema auditing"}
]

for b in boxes:
    rect = patches.FancyBboxPatch((b["x"], b["y"]), b["w"], b["h"],
                                  boxstyle="round,pad=0.015,rounding_size=0.02",
                                  facecolor=b["bg"], edgecolor=b["bc"], linewidth=2)
    ax.add_patch(rect)
    ax.text(b["x"] + 0.02, b["y"] + b["h"] - 0.04, b["title"], fontsize=10.5, fontweight="bold", color=b["bc"])
    ax.text(b["x"] + 0.02, b["y"] + 0.03, b["text"], fontsize=8.5, color="#212121")

# Connectors
arrow_style = dict(arrowstyle="->", lw=2, color="#37474f")
ax.annotate("", xy=(0.38, 0.81), xytext=(0.30, 0.81), arrowprops=arrow_style)
ax.annotate("", xy=(0.71, 0.81), xytext=(0.63, 0.81), arrowprops=arrow_style)
ax.annotate("", xy=(0.31, 0.58), xytext=(0.50, 0.70), arrowprops=arrow_style)
ax.annotate("", xy=(0.71, 0.58), xytext=(0.83, 0.70), arrowprops=arrow_style)
ax.annotate("", xy=(0.55, 0.39), xytext=(0.47, 0.39), arrowprops=arrow_style)

plt.title("Figure 5: Agro-Ecological Decision Support Pipeline & Indigenous Ecological Knowledge (IEK) Integration", fontsize=13, fontweight="bold", pad=15)
plt.tight_layout()
plt.savefig("docs/assets/figures/fig5_decision_workflow.png", dpi=300)
plt.close()

# ==============================================================================
# Figure 6: UI Interface Design & Multi-Role Client Visual Mockups
# ==============================================================================
print("Generating Figure 6: UI Interface Design & Mockup Panels...")
fig, axes = plt.subplots(2, 2, figsize=(13, 9))

# Panel 1: Ministry Command Dashboard
ax1 = axes[0, 0]
ax1.set_facecolor("#f8f9fa")
ax1.set_title("Panel A: Web Ministry Command Centre (/ministry)", fontweight="bold", fontsize=10.5)
ax1.text(0.05, 0.88, "Choke Mountain Watershed Exposure Overview", fontsize=10, fontweight="bold", color="#1b5e20")
ax1.text(0.05, 0.75, "Total Registered Farmers: 1,420\nTotal Monitored Area: 3,840 Hectares\nHectares at Moderate/Severe Risk: 1,120 Ha (29.2%)\nAdvisory Delivery Read Rate: 84.6%", fontsize=8.5)
# Draw mini table mockup
y_t = 0.52
ax1.text(0.05, y_t, "Woreda        | Farms | Area (Ha) | Top Crop | Risk Exposure", fontsize=8, family="monospace", fontweight="bold")
ax1.text(0.05, y_t - 0.08, "Sinan         |   412 |   1,210   | Wheat    | [High: 42%]  ", fontsize=8, family="monospace", color="#d32f2f")
ax1.text(0.05, y_t - 0.16, "Machakel      |   355 |     980   | Tef      | [Moderate:28%]", fontsize=8, family="monospace", color="#f57c00")
ax1.text(0.05, y_t - 0.24, "Debre Markos  |   290 |     750   | Tef/Maize| [Low: 14%]   ", fontsize=8, family="monospace", color="#388e3c")
ax1.text(0.05, y_t - 0.32, "Bibugn        |   363 |     900   | Wheat    | [High: 38%]  ", fontsize=8, family="monospace", color="#d32f2f")
ax1.set_xticks([])
ax1.set_yticks([])

# Panel 2: Farmer Action Portal
ax2 = axes[0, 1]
ax2.set_facecolor("#f8f9fa")
ax2.set_title("Panel B: Farmer Decision Portal (/farm)", fontweight="bold", fontsize=10.5)
ax2.text(0.05, 0.88, "Farmer Dashboard (0912000001) · Sinan Woreda", fontsize=10, fontweight="bold", color="#0d47a1")
rect_plot = patches.FancyBboxPatch((0.05, 0.45), 0.90, 0.36, boxstyle="round,pad=0.02", facecolor="#fff3e0", edgecolor="#e65100", lw=1.5)
ax2.add_patch(rect_plot)
ax2.text(0.08, 0.74, "Plot 1: Upper Ridge (1.2 Ha) · Wheat", fontsize=9.5, fontweight="bold", color="#bf360c")
ax2.text(0.08, 0.66, "Drought Risk: HIGH (P = 0.62) | Season: Kiremt (Meher)", fontsize=8.5, color="#d84315")
ax2.text(0.08, 0.58, "Advisory: Switch to verified drought-tolerant wheat variety.\nStagger planting; initiate deficit irrigation at tillering stage.", fontsize=8)
ax2.text(0.08, 0.49, "IEK Consensus: HIGH (Traditional bird and wind cues agree)", fontsize=8, fontweight="semibold", color="#2e7d32")
# Button mockup
btn = patches.FancyBboxPatch((0.05, 0.25), 0.50, 0.12, boxstyle="round,pad=0.01", facecolor="#2e7d32", edgecolor="none")
ax2.add_patch(btn)
ax2.text(0.12, 0.30, "✓ Confirm Acknowledged", fontsize=8.5, fontweight="bold", color="white")
ax2.set_xticks([])
ax2.set_yticks([])

# Panel 3: Mobile Field App (Trilingual & Offline)
ax3 = axes[1, 0]
ax3.set_facecolor("#f8f9fa")
ax3.set_title("Panel C: Mobile Field Application (React Native / Expo)", fontweight="bold", fontsize=10.5)
ax3.text(0.05, 0.88, "Offline-First Mobile Architecture", fontsize=10, fontweight="bold", color="#4a148c")
ax3.text(0.05, 0.72, "• Local Persistence: TanStack Query + AsyncStorage\n• Low-Connectivity Resilient: Full cache replay & background sync\n• ThumbPad Navigation: Single-hand field operation for agents\n• Trilingual Language Switcher:\n  - English (en)\n  - Amharic / አማርኛ (am)\n  - Afaan Oromoo (or)", fontsize=8.5)
# Draw language tags
for idx, (lang, code) in enumerate([("English", "EN"), ("አማርኛ", "AM"), ("Afaan Oromoo", "OR")]):
    lbox = patches.FancyBboxPatch((0.05 + idx * 0.30, 0.18), 0.26, 0.14, boxstyle="round,pad=0.01", facecolor="#ede7f6", edgecolor="#673ab7", lw=1)
    ax3.add_patch(lbox)
    ax3.text(0.08 + idx * 0.30, 0.24, f"{lang}\n({code})", fontsize=8, fontweight="bold", color="#512da8")
ax3.set_xticks([])
ax3.set_yticks([])

# Panel 4: Analytics Star Schema & Metabase Embedding
ax4 = axes[1, 1]
ax4.set_facecolor("#f8f9fa")
ax4.set_title("Panel D: Analytical Star Schema & BI Architecture", fontweight="bold", fontsize=10.5)
ax4.text(0.05, 0.88, "analytics Schema Views & Role Isolation", fontsize=10, fontweight="bold", color="#263238")
ax4.text(0.05, 0.68, "• Dedicated read-only role: agriminds_bi\n• Zero PII leakage: No passwords, phones, or names visible\n• Star Schema Topology:\n  - Dimensions: dim_woreda, dim_crop, dim_month, dim_risk_level\n  - Facts: fact_farm, fact_advisory, fact_risk, fact_farm_risk\n• Zero-Licence Self-Hosted Metabase Embedding\n• Automated forecast snapshotting on model retraining", fontsize=8.5)
ax4.set_xticks([])
ax4.set_yticks([])

plt.suptitle("Figure 6: AgriMinds Multi-Platform User Interface Ecosystem & Feature Architecture", fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig("docs/assets/figures/fig6_ui_interfaces.png", dpi=300)
plt.close()

print("All publication figures generated successfully in docs/assets/figures/!")
