import os
import joblib
import pandas as pd
import numpy as np

def load_crop_model(model_path: str = None):
    if model_path is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, 'models', 'best_crop_yield_model.joblib')
    artifact = joblib.load(model_path)
    return artifact

def predict_yield(
    crop: str,
    zone: str,
    year: int = 2024,
    temperature_c: float = 18.0,
    precipitation_mm: float = 85.0,
    enso_index: float = 1.0,
    yield_lag1: float = None,
    yield_rolling3_mean: float = None
):
    """
    Predicts yield (quintals/ha) for a specific crop and agro-climatic altitude zone.
    
    Parameters:
    - crop: 'Teff', 'Wheat', or 'Maize'
    - zone: 'Lowland' (<1500m), 'Midland' (1500-2500m), or 'Highland' (>2500m)
    - year: prediction year (trend component)
    - temperature_c: mean temperature in °C
    - precipitation_mm: monthly precipitation in mm
    - enso_index: Nino 3.4 index (> 0.5 = El Nino, < -0.5 = La Nina)
    """
    artifact = load_crop_model()
    pipeline = artifact['pipeline']
    
    # Altitude approximations
    alt_map = {'Lowland': 1000, 'Midland': 2000, 'Highland': 2800}
    alt_m = alt_map.get(zone, 2000)
    
    # ENSO Phase categorization
    if enso_index >= 0.5:
        enso_phase = 'El Nino'
    elif enso_index <= -0.5:
        enso_phase = 'La Nina'
    else:
        enso_phase = 'Neutral'
        
    pt_ratio = precipitation_mm / (temperature_c + 1e-5)
    
    # If lags are not provided, estimate from training defaults per crop & zone
    if yield_lag1 is None or yield_rolling3_mean is None:
        clean_data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'crop_climate_clean.csv')
        df_hist = pd.read_csv(clean_data_path)
        hist_sub = df_hist[(df_hist['crop'] == crop) & (df_hist['zone'] == zone)]
        default_lag = hist_sub['yield'].iloc[-1]
        default_roll = hist_sub['yield'].tail(3).mean()
        yield_lag1 = yield_lag1 if yield_lag1 is not None else default_lag
        yield_rolling3_mean = yield_rolling3_mean if yield_rolling3_mean is not None else default_roll
        
    input_row = pd.DataFrame([{
        'crop': crop,
        'zone': zone,
        'altitude_approx_m': alt_m,
        'temperature_c': temperature_c,
        'precipitation_mm': precipitation_mm,
        'pt_ratio': pt_ratio,
        'enso_index': enso_index,
        'enso_phase': enso_phase,
        'year': year,
        'yield_lag1': yield_lag1,
        'yield_rolling3_mean': yield_rolling3_mean
    }])
    
    pred = pipeline.predict(input_row)[0]
    return float(pred)

def simulate_enso_scenarios():
    """
    Simulates and compares predicted yields across Neutral vs. El Nino conditions
    to check consistency with the Ethiopian agro-ecological findings.
    """
    print("\n================ ENSO IMPACT SIMULATION (EL NINO vs NEUTRAL) ================")
    crops = ['Teff', 'Wheat', 'Maize']
    zones = ['Lowland', 'Midland', 'Highland']
    
    results = []
    for c in crops:
        for z in zones:
            # Baseline / Neutral scenario (ENSO index = 0.0, typical rain = 85mm, temp = 17.5C)
            y_neutral = predict_yield(c, z, year=2024, temperature_c=17.5, precipitation_mm=85.0, enso_index=0.0)
            
            # El Nino scenario (Drier & Warmer in Lowlands, ENSO index = 1.3)
            # In Ethiopia, El Nino tends to decrease precipitation and increase cloud base height
            y_elnino = predict_yield(c, z, year=2024, temperature_c=18.5, precipitation_mm=65.0, enso_index=1.3)
            
            pct_change = ((y_elnino - y_neutral) / y_neutral) * 100
            results.append({
                'Crop': c,
                'Zone': z,
                'Neutral_Yield (q/ha)': round(y_neutral, 2),
                'ElNino_Yield (q/ha)': round(y_elnino, 2),
                'Impact (%)': f"{pct_change:+.2f}%"
            })
            
    df_sim = pd.DataFrame(results)
    print(df_sim.to_string(index=False))
    print("============================================================================\n")

if __name__ == '__main__':
    simulate_enso_scenarios()
