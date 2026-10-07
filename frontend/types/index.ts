export interface GridCellRisk {
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  probability: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Severe';
}

export interface DroughtMapResponse {
  lead_month: number;
  target_date: string;
  issued_date: string;
  grid_shape: [number, number];
  bbox: [number, number, number, number];
  mean_probability: number;
  min_probability: number;
  max_probability: number;
  probabilities: number[][];
  cells: GridCellRisk[];
}

export interface AdvisoryRequest {
  crop: 'tef' | 'wheat' | 'maize';
  lead_month: number;
  row?: number;
  col?: number;
  latitude?: number;
  longitude?: number;
  iek_agrees?: boolean | null;
}

export interface AdvisoryResponse {
  crop: string;
  lead_month: number;
  raw_probability: number;
  adjusted_probability: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Severe';
  season: string;
  enso_state: string;
  crop_note: string;
  crop_recommendation: string;
  planting_window: string;
  water_management: string;
  preparedness_action: string;
  iek_assessment: string;
  confidence_level: string;
}

export interface EnsoPoint {
  date: string;
  nino34: number;
  is_forecast: boolean;
}

export interface EnsoOutlookResponse {
  current_nino34: number;
  current_state: string;
  forecast_horizon_months: number;
  historical_series: EnsoPoint[];
  forecast_series: EnsoPoint[];
  teleconnection_summary: string;
}
