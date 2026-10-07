"""Researcher sandbox dashboard (legacy Streamlit). Run from the repo root:

    pip install -e "ml[research]"
    AI_DREWS_DATA_DIR=./data streamlit run ml/research/streamlit_app.py
"""

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

from ai_drews.advisory import advise
from ai_drews.config import DEFAULT_CONFIG, DataPaths
from ai_drews.inference import load_artifacts, predict_risk

cfg = DEFAULT_CONFIG
st.set_page_config(page_title="AI-DREWS", layout="wide")
st.title("AI-DREWS: Drought Early Warning, Choke Watershed")


@st.cache_resource
def get_artifacts():
    return load_artifacts(DataPaths.from_env())


art = get_artifacts()
P = predict_risk(art)
issue = pd.to_datetime(art.issued_date)
H, W = cfg.grid

with st.sidebar:
    crop = st.selectbox("Crop", ["tef", "wheat", "maize"])
    lead = st.radio("Lead time (months)", [1, 2, 3], horizontal=True)
    r = st.slider("Grid row", 0, H - 1, H // 2)
    c = st.slider("Grid column", 0, W - 1, W // 2)
    iek = {"Not entered": None, "Agrees (dry signs)": True, "Disagrees (normal/wet signs)": False}[
        st.selectbox("Local/indigenous indicators", ["Not entered", "Agrees (dry signs)", "Disagrees (normal/wet signs)"])
    ]
st.caption(
    f"Forecast issued from data ending {issue:%B %Y} | model {art.model_version} | data source: {art.data_source}. "
    "Prototype: validate with stakeholders before real use."
)

target = issue + pd.DateOffset(months=lead)
p = float(P[lead - 1, r, c])
fc = art.latest_enso_forecast()
nino_fc = float(fc[lead - 1]) if fc is not None else float(art.nino_history[-1])
a = advise(p, lead, crop, target.month, nino_fc, iek)

c1, c2 = st.columns([3, 2])
with c1:
    fig, ax = plt.subplots(figsize=(5, 4))
    im = ax.imshow(P[lead - 1], vmin=0, vmax=1, cmap="YlOrRd", extent=(cfg.bbox[0], cfg.bbox[2], cfg.bbox[1], cfg.bbox[3]))
    ax.set_title(f"P(drought) for {target:%b %Y}")
    fig.colorbar(im, label="probability")
    st.pyplot(fig)
with c2:
    st.metric("Selected cell drought probability", f"{p:.0%}")
    st.metric(f"Risk level for {crop}", a.risk_level, help="Probability scaled by crop sensitivity (placeholder rule)")
    st.write(f"**ENSO state:** {a.enso_state}  |  **Season:** {a.season}")
    for label, value in (
        ("Crop selection", a.crop_recommendation),
        ("Planting window", a.planting_window),
        ("Water management", a.water_management),
        ("Preparedness", a.preparedness_action),
    ):
        st.write(f"**{label}:** {value}")
    st.info(a.iek_assessment)

st.subheader("ENSO outlook (Nino3.4)")
d = pd.to_datetime(art.dates)
fig2, ax2 = plt.subplots(figsize=(9, 2.6))
ax2.plot(d[-60:], art.nino_history[-60:], "k")
ax2.axhline(0.5, ls=":", c="r")
ax2.axhline(-0.5, ls=":", c="b")
if fc is not None:
    ax2.plot([issue + pd.DateOffset(months=i + 1) for i in range(len(fc))], fc, "r--o", label="CNN-LSTM forecast")
    ax2.legend()
st.pyplot(fig2)
