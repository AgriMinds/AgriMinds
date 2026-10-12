import os
import pandas as pd
import numpy as np

def prepare_crop_dataset(input_excel_path: str, output_csv_path: str) -> pd.DataFrame:
    """
    Transforms the wide Ethiopian climate-crop dataset into a tidy long panel format
    enriched with altitude approximations from agro-climatic zones and ENSO features.
    """
    df_raw = pd.read_excel(input_excel_path)
    
    # Altitude approximations from the Ethiopian agro-ecological infographic:
    # Lowland (Kolla): < 1500m (approx 1000m)
    # Midland (Woina Dega): 1500 - 2500m (approx 2000m)
    # Highland (Dega): > 2500m (approx 2800m)
    zone_mapping = {
        'kola': {
            'zone': 'Lowland',
            'altitude_approx_m': 1000,
            'altitude_min_m': 500,
            'altitude_max_m': 1500
        },
        'w/d': {
            'zone': 'Midland',
            'altitude_approx_m': 2000,
            'altitude_min_m': 1500,
            'altitude_max_m': 2500
        },
        'dega': {
            'zone': 'Highland',
            'altitude_approx_m': 2800,
            'altitude_min_m': 2500,
            'altitude_max_m': 3500
        }
    }
    
    crops = ['teff', 'wheat', 'maiz']
    crop_display = {'teff': 'Teff', 'wheat': 'Wheat', 'maiz': 'Maize'}
    
    records = []
    
    for _, row in df_raw.iterrows():
        year = int(row['Year'])
        temp = float(row['Tem(oc)'])
        precip = float(row['pr(mm/mo)'])
        enso = float(row['ElniNo'])
        
        # Categorize ENSO Phase based on Oceanic Nino Index (ONI / Nino 3.4)
        if enso >= 0.5:
            enso_phase = 'El Nino'
        elif enso <= -0.5:
            enso_phase = 'La Nina'
        else:
            enso_phase = 'Neutral'
            
        pt_ratio = precip / (temp + 1e-5)
        
        for crop_key in crops:
            for zone_key, zone_meta in zone_mapping.items():
                col_name = f"{crop_key} {zone_key}"
                if col_name in df_raw.columns:
                    yield_val = row[col_name]
                    records.append({
                        'year': year,
                        'crop': crop_display[crop_key],
                        'zone': zone_meta['zone'],
                        'altitude_approx_m': zone_meta['altitude_approx_m'],
                        'altitude_min_m': zone_meta['altitude_min_m'],
                        'altitude_max_m': zone_meta['altitude_max_m'],
                        'temperature_c': temp,
                        'precipitation_mm': precip,
                        'pt_ratio': pt_ratio,
                        'enso_index': enso,
                        'enso_phase': enso_phase,
                        'yield': float(yield_val)
                    })
                    
    df_long = pd.DataFrame(records)
    
    # Sort chronologically within each crop-zone time series
    df_long = df_long.sort_values(by=['crop', 'zone', 'year']).reset_index(drop=True)
    
    # Feature Engineering: Lag 1 year yield & rolling 3-year mean yield
    df_long['yield_lag1'] = df_long.groupby(['crop', 'zone'])['yield'].shift(1)
    df_long['yield_rolling3_mean'] = df_long.groupby(['crop', 'zone'])['yield'].shift(1).rolling(3, min_periods=1).mean()
    
    # Backfill first year lag with initial yield to avoid losing the first year entirely
    df_long['yield_lag1'] = df_long['yield_lag1'].fillna(df_long['yield'])
    df_long['yield_rolling3_mean'] = df_long['yield_rolling3_mean'].fillna(df_long['yield'])
    
    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)
    df_long.to_csv(output_csv_path, index=False)
    print(f"Successfully processed {len(df_long)} records. Saved to {output_csv_path}")
    return df_long

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(base_dir)
    excel_path = os.path.join(parent_dir, 'climate-crop.xlsx')
    output_path = os.path.join(base_dir, 'data', 'crop_climate_clean.csv')
    prepare_crop_dataset(excel_path, output_path)
