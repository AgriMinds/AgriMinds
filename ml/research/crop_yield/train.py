import os
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.dummy import DummyRegressor
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from lightgbm import LGBMRegressor

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# Set plot style
sns.set_theme(style="whitegrid")
plt.rcParams.update({'font.sans-serif': 'Arial', 'font.size': 11})

def mean_absolute_percentage_error(y_true, y_pred):
    return np.mean(np.abs((y_true - y_pred) / (y_true + 1e-6))) * 100

def train_and_evaluate_models(data_path: str, output_dir: str):
    os.makedirs(os.path.join(output_dir, 'models'), exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'plots'), exist_ok=True)
    
    df = pd.read_csv(data_path)
    print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns.")
    
    # Chronological Split (Strictly avoid temporal data leakage)
    # Train: 1990 - 2016 (27 years * 9 = 243 samples)
    # Test: 2017 - 2023 (7 years * 9 = 63 samples)
    train_mask = df['year'] <= 2016
    test_mask = df['year'] > 2016
    
    feature_cols = [
        'crop', 'zone', 'altitude_approx_m', 'temperature_c',
        'precipitation_mm', 'pt_ratio', 'enso_index', 'enso_phase',
        'year', 'yield_lag1', 'yield_rolling3_mean'
    ]
    target_col = 'yield'
    
    X_train = df.loc[train_mask, feature_cols].copy()
    y_train = df.loc[train_mask, target_col].copy()
    
    X_test = df.loc[test_mask, feature_cols].copy()
    y_test = df.loc[test_mask, target_col].copy()
    
    print(f"Training set: {len(X_train)} samples ({df.loc[train_mask, 'year'].min()}-{df.loc[train_mask, 'year'].max()})")
    print(f"Test set:     {len(X_test)} samples ({df.loc[test_mask, 'year'].min()}-{df.loc[test_mask, 'year'].max()})")
    
    # Preprocessing Pipeline (Strict Featurization Ordering: fit on train only)
    categorical_features = ['crop', 'zone', 'enso_phase']
    numerical_features = [
        'altitude_approx_m', 'temperature_c', 'precipitation_mm',
        'pt_ratio', 'enso_index', 'year', 'yield_lag1', 'yield_rolling3_mean'
    ]
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_features),
            ('cat', OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore'), categorical_features)
        ]
    )
    
    # Candidate Models
    models = {
        'Naive Baseline (Mean)': DummyRegressor(strategy='mean'),
        'Ridge Regression': Pipeline([
            ('prep', preprocessor),
            ('reg', Ridge(alpha=1.0, random_state=42))
        ]),
        'Random Forest': Pipeline([
            ('prep', preprocessor),
            ('reg', RandomForestRegressor(n_estimators=150, max_depth=8, min_samples_split=3, random_state=42))
        ]),
        'XGBoost': Pipeline([
            ('prep', preprocessor),
            ('reg', XGBRegressor(n_estimators=120, max_depth=5, learning_rate=0.06, subsample=0.85, random_state=42))
        ]),
        'LightGBM': Pipeline([
            ('prep', preprocessor),
            ('reg', LGBMRegressor(n_estimators=100, max_depth=5, learning_rate=0.06, random_state=42, verbose=-1))
        ])
    }
    
    results = {}
    predictions_dict = {}
    
    for name, model in models.items():
        if name == 'Naive Baseline (Mean)':
            model.fit(X_train, y_train)
        else:
            model.fit(X_train, y_train)
            
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        
        predictions_dict[name] = y_pred_test
        
        train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
        test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
        test_mae = mean_absolute_error(y_test, y_pred_test)
        test_r2 = r2_score(y_test, y_pred_test)
        test_mape = mean_absolute_percentage_error(y_test.values, y_pred_test)
        
        results[name] = {
            'train_rmse': round(float(train_rmse), 3),
            'test_rmse': round(float(test_rmse), 3),
            'test_mae': round(float(test_mae), 3),
            'test_r2': round(float(test_r2), 3),
            'test_mape': round(float(test_mape), 2)
        }
        print(f"[{name}] Test RMSE: {test_rmse:.2f} | MAE: {test_mae:.2f} | R²: {test_r2:.3f} | MAPE: {test_mape:.2f}%")
        
    # Save Metrics Summary
    metrics_file = os.path.join(output_dir, 'models', 'metrics_summary.json')
    with open(metrics_file, 'w') as f:
        json.dump(results, f, indent=2)
        
    # Determine Best Model by Test RMSE
    best_model_name = min(
        [m for m in results.keys() if m != 'Naive Baseline (Mean)'],
        key=lambda k: results[k]['test_rmse']
    )
    best_pipeline = models[best_model_name]
    print(f"\n---> Selected Best Model: {best_model_name} (Test RMSE: {results[best_model_name]['test_rmse']})")
    
    # Save Best Model Artifact
    model_save_path = os.path.join(output_dir, 'models', 'best_crop_yield_model.joblib')
    joblib.dump({
        'model_name': best_model_name,
        'pipeline': best_pipeline,
        'feature_cols': feature_cols,
        'categorical_features': categorical_features,
        'numerical_features': numerical_features,
        'metrics': results[best_model_name]
    }, model_save_path)
    print(f"Saved trained artifact to {model_save_path}")
    
    # ------------------ VISUALIZATION 1: MODEL COMPARISON BAR CHART ------------------
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    model_names_plot = list(results.keys())
    rmses = [results[m]['test_rmse'] for m in model_names_plot]
    maes = [results[m]['test_mae'] for m in model_names_plot]
    r2s = [results[m]['test_r2'] for m in model_names_plot]
    
    palette = sns.color_palette("muted", len(model_names_plot))
    
    axes[0].barh(model_names_plot, rmses, color=palette)
    axes[0].set_title("Test RMSE (Lower is Better)")
    axes[0].set_xlabel("RMSE (quintals/ha)")
    
    axes[1].barh(model_names_plot, maes, color=palette)
    axes[1].set_title("Test MAE (Lower is Better)")
    axes[1].set_xlabel("MAE (quintals/ha)")
    
    axes[2].barh(model_names_plot, r2s, color=palette)
    axes[2].set_title("Test R² Score (Higher is Better)")
    axes[2].set_xlabel("R²")
    
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'plots', 'model_comparison.png'), dpi=200)
    plt.close()
    
    # ------------------ VISUALIZATION 2: ACTUAL VS PREDICTED TIME SERIES ------------------
    df_test_eval = df.loc[test_mask].copy()
    df_test_eval['predicted_yield'] = best_pipeline.predict(X_test)
    
    fig, axes = plt.subplots(3, 3, figsize=(16, 12), sharex=True)
    crops_list = ['Teff', 'Wheat', 'Maize']
    zones_list = ['Lowland', 'Midland', 'Highland']
    
    for i, c in enumerate(crops_list):
        for j, z in enumerate(zones_list):
            subset = df_test_eval[(df_test_eval['crop'] == c) & (df_test_eval['zone'] == z)].sort_values('year')
            ax = axes[i, j]
            ax.plot(subset['year'], subset['yield'], marker='o', label='Actual', color='#2b5c8f', lw=2)
            ax.plot(subset['year'], subset['predicted_yield'], marker='s', linestyle='--', label=f'Pred ({best_model_name})', color='#e26d5c', lw=2)
            ax.set_title(f"{c} - {z}")
            ax.set_ylabel("Yield (q/ha)")
            if i == 0 and j == 0:
                ax.legend()
                
    plt.suptitle(f"Holdout Test Predictions (2017-2023) across Crops & Altitude Zones\nModel: {best_model_name}", fontsize=14, y=0.99)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'plots', 'actual_vs_predicted.png'), dpi=200)
    plt.close()

    # ------------------ VISUALIZATION 3: SLICE ERROR ANALYSIS BY CROP & ZONE ------------------
    slice_errors = []
    for c in crops_list:
        for z in zones_list:
            subset = df_test_eval[(df_test_eval['crop'] == c) & (df_test_eval['zone'] == z)]
            rmse_slice = np.sqrt(mean_squared_error(subset['yield'], subset['predicted_yield']))
            mae_slice = mean_absolute_error(subset['yield'], subset['predicted_yield'])
            slice_errors.append({'Crop': c, 'Zone': z, 'RMSE': rmse_slice, 'MAE': mae_slice})
            
    df_slices = pd.DataFrame(slice_errors)
    df_pivot = df_slices.pivot(index='Crop', columns='Zone', values='MAE')
    
    plt.figure(figsize=(7, 5))
    sns.heatmap(df_pivot, annot=True, fmt=".2f", cmap="YlOrRd", cbar_kws={'label': 'MAE (quintals/ha)'})
    plt.title(f"Test MAE Slices by Crop & Agro-Ecological Zone\n({best_model_name})")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, 'plots', 'slice_error_heatmap.png'), dpi=200)
    plt.close()
    
    print("All evaluation plots generated successfully in crop_ML/plots/")
    return results, best_model_name

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    clean_data_path = os.path.join(base_dir, 'data', 'crop_climate_clean.csv')
    train_and_evaluate_models(clean_data_path, base_dir)
