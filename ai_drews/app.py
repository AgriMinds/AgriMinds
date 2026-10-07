"""STEP 7 (Month 6): AI-DREWS dashboard.  Run:  streamlit run app.py"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent / "src"))
import numpy as np, pandas as pd, streamlit as st
import matplotlib.pyplot as plt
from config import *
from inference import load_artifacts, risk_at
from advisory import advise, risk_level

st.set_page_config(page_title="AI-DREWS", layout="wide")
st.title("AI-DREWS: Drought Early Warning, Choke Watershed")

@st.cache_resource
def get(): return load_artifacts()
art = get(); F = art["F"]; P = risk_at(art); issue = pd.to_datetime(F["dates"][-1])
H, W = GRID

with st.sidebar:
    crop = st.selectbox("Crop", ["tef", "wheat", "maize"])
    lead = st.radio("Lead time (months)", [1, 2, 3], horizontal=True)
    r = st.slider("Grid row", 0, H - 1, H // 2); c = st.slider("Grid column", 0, W - 1, W // 2)
    iek = {"Not entered": None, "Agrees (dry signs)": True, "Disagrees (normal/wet signs)": False}[
        st.selectbox("Local/indigenous indicators", ["Not entered", "Agrees (dry signs)", "Disagrees (normal/wet signs)"])]
st.caption(f"Forecast issued from data ending {issue:%B %Y}. Prototype: validate with stakeholders before real use.")

target = issue + pd.DateOffset(months=lead)
p = float(P[lead - 1, r, c])
nino_fc = float(art["fc"][-1, lead - 1]) if art["fc"].any() else float(F["nino"][-1])
a = advise(p, lead, crop, target.month, nino_fc, iek)

c1, c2 = st.columns([3, 2])
with c1:
    fig, ax = plt.subplots(figsize=(5, 4))
    im = ax.imshow(P[lead - 1], vmin=0, vmax=1, cmap="YlOrRd", extent=(BBOX[0], BBOX[2], BBOX[1], BBOX[3]))
    ax.set_title(f"P(drought) for {target:%b %Y}"); fig.colorbar(im, label="probability")
    st.pyplot(fig)
with c2:
    st.metric("Selected cell drought probability", f"{p:.0%}")
    st.metric(f"Risk level for {crop}", a["level"], help="Probability scaled by crop sensitivity (placeholder rule)")
    st.write(f"**ENSO state:** {a['enso']}  |  **Season:** {a['season']}")
    for k, lbl in (("crop", "Crop selection"), ("planting", "Planting window"), ("water", "Water management"), ("prep", "Preparedness")):
        st.write(f"**{lbl}:** {a[k]}")
    st.info(a["iek"])

st.subheader("ENSO outlook (Nino3.4)")
d = pd.to_datetime(F["dates"]); fig2, ax2 = plt.subplots(figsize=(9, 2.6))
ax2.plot(d[-60:], F["nino"][-60:], "k"); ax2.axhline(0.5, ls=":", c="r"); ax2.axhline(-0.5, ls=":", c="b")
if art["fc"].any():
    ax2.plot([issue + pd.DateOffset(months=i + 1) for i in range(ENSO_LEADS)], art["fc"][-1], "r--o", label="CNN-LSTM forecast")
    ax2.legend()
st.pyplot(fig2)
