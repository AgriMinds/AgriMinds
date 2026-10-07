// Mobile API Client connecting to FastAPI backend
// Default host: 10.0.2.2 for Android Emulator, localhost for iOS Simulator, or host machine LAN IP for physical device.
import { Platform } from 'react-native';

export let API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8000/api/v1',
  ios: 'http://localhost:8000/api/v1',
  default: 'http://localhost:8000/api/v1',
});

export function setCustomApiUrl(url: string) {
  API_BASE_URL = url.trim().replace(/\/$/, '');
}

export interface MobileAdvisoryRequest {
  crop: 'tef' | 'wheat' | 'maize';
  lead_month: number;
  latitude?: number;
  longitude?: number;
  row?: number;
  col?: number;
  iek_agrees?: boolean | null;
}

export interface MobileAdvisoryResponse {
  crop: string;
  lead_month: number;
  raw_probability: number;
  adjusted_probability: number;
  risk_level: string;
  season: string;
  enso_state: string;
  crop_recommendation: string;
  planting_window: string;
  water_management: string;
  preparedness_action: string;
  iek_assessment: string;
  confidence_level: string;
}

export interface GridCell {
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  probability: number;
  risk_level: string;
}

export interface MobileDroughtMapResponse {
  lead_month: number;
  target_date: string;
  issued_date: string;
  grid_shape: [number, number];
  bbox: [number, number, number, number];
  mean_probability: number;
  min_probability: number;
  max_probability: number;
  probabilities: number[][];
  cells: GridCell[];
}

export interface EnsoPoint {
  date: string;
  nino34: number;
  is_forecast: boolean;
}

export interface MobileEnsoResponse {
  current_nino34: number;
  current_state: string;
  forecast_horizon_months: number;
  historical_series: EnsoPoint[];
  forecast_series: EnsoPoint[];
  teleconnection_summary: string;
}

// 1. Fetch Crop Advisory
export async function fetchMobileAdvisory(payload: MobileAdvisoryRequest): Promise<MobileAdvisoryResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${API_BASE_URL}/advisories/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// 2. Fetch Drought Map
export async function fetchMobileDroughtMap(leadMonth: number = 1): Promise<MobileDroughtMapResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${API_BASE_URL}/drought/map?lead_month=${leadMonth}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// 3. Fetch ENSO Outlook
export async function fetchMobileEnsoOutlook(): Promise<MobileEnsoResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${API_BASE_URL}/enso/outlook`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Offline Fallback Generators for resilient field use
export function getOfflineFallbackAdvisory(
  crop: 'tef' | 'wheat' | 'maize',
  lead: number,
  iekAgrees: boolean | null
): MobileAdvisoryResponse {
  const cropMult = crop === 'maize' ? 1.3 : crop === 'wheat' ? 1.0 : 0.8;
  const rawProb = 0.17 + (lead - 1) * 0.05;
  const adjProb = Math.min(Math.max(rawProb * cropMult + (iekAgrees === true ? 0.08 : iekAgrees === false ? -0.06 : 0), 0.05), 0.95);
  const risk = adjProb < 0.25 ? 'Low' : adjProb < 0.45 ? 'Moderate' : adjProb < 0.65 ? 'High' : 'Severe';

  return {
    crop,
    lead_month: lead,
    raw_probability: Math.round(rawProb * 100) / 100,
    adjusted_probability: Math.round(adjProb * 100) / 100,
    risk_level: risk,
    season: 'Kiremt (Main Rainy Season / Meher)',
    enso_state: 'Neutral (-0.47°C)',
    crop_recommendation:
      crop === 'tef'
        ? 'Proceed with planned certified seed variety of tef. Normal agronomic packages apply.'
        : crop === 'wheat'
        ? 'Monitor early rainfall onset. Standard highland wheat varieties recommended with timely top-dressing.'
        : 'Ensure sufficient moisture at tasseling stage. In shallow soils, consider short-duration hybrid.',
    planting_window: 'Early to mid-July for main season (Meher/Kiremt). Align with local kebele DA advisory.',
    water_management: 'Apply rainwater harvesting contour ridges, deep tilling, and vegetative soil cover.',
    preparedness_action: 'Input distribution ready at primary cooperative. Regular DA monitoring.',
    iek_assessment:
      iekAgrees === true
        ? 'Traditional indicators (winds, flowering cues) corroborate model warning: HIGH CONSENSUS.'
        : iekAgrees === false
        ? 'Traditional indicators suggest divergence from seasonal model: MODERATE CONFIDENCE.'
        : 'No traditional indicator registered. Model driven telemetry active.',
    confidence_level: iekAgrees !== null ? 'HIGH (IEK Integrated)' : 'STANDARD (Model Driven)',
  };
}

export function getOfflineFallbackDroughtMap(lead: number): MobileDroughtMapResponse {
  const baseProb = lead === 1 ? 0.17 : lead === 2 ? 0.22 : 0.28;
  const probs = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 8 }, (_, c) => {
      const v = Math.min(Math.max(baseProb + Math.sin(r + c) * 0.07, 0.08), 0.45);
      return Math.round(v * 100) / 100;
    })
  );

  return {
    lead_month: lead,
    target_date: lead === 1 ? 'July 2026' : lead === 2 ? 'August 2026' : 'September 2026',
    issued_date: 'June 2026',
    grid_shape: [8, 8],
    bbox: [37.6, 10.4, 38.4, 11.2],
    mean_probability: baseProb,
    min_probability: 0.10,
    max_probability: 0.38,
    probabilities: probs,
    cells: [],
  };
}
