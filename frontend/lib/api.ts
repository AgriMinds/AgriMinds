import { DroughtMapResponse, AdvisoryRequest, AdvisoryResponse, EnsoOutlookResponse } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: String(err) };
  }
}

export async function fetchDroughtMap(leadMonth: number = 1): Promise<DroughtMapResponse> {
  const res = await fetch(`${API_BASE}/drought/map?lead_month=${leadMonth}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch drought map: ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateAdvisory(payload: AdvisoryRequest): Promise<AdvisoryResponse> {
  const res = await fetch(`${API_BASE}/advisories/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to evaluate advisory: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchEnsoOutlook(): Promise<EnsoOutlookResponse> {
  const res = await fetch(`${API_BASE}/enso/outlook`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch ENSO outlook: ${res.statusText}`);
  }
  return res.json();
}
