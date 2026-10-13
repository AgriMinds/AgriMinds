import { api, ApiError, parseApiError } from '@/services/api';

describe('parseApiError', () => {
  it('maps typed backend errors', () => {
    expect(parseApiError(401, { error: { code: 'unauthorized', message: 'nope' } }).code).toBe('unauthorized');
    expect(parseApiError(503, { error: { code: 'model_unavailable', message: 'x' } }).code).toBe('model_unavailable');
    const e = parseApiError(422, { error: { code: 'invalid_location', message: 'outside' } });
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('invalid_location');
    expect(e.message).toBe('outside');
    expect(e.status).toBe(422);
  });

  it('falls back on status when body is not an error envelope', () => {
    expect(parseApiError(401, null).code).toBe('unauthorized');
    expect(parseApiError(422, { detail: [] }).code).toBe('validation');
    expect(parseApiError(503, '').code).toBe('model_unavailable');
    expect(parseApiError(500, {}).code).toBe('http');
  });

  it('has newly integrated CRUD and yield functions defined on api', () => {
    expect(typeof api.createFarm).toBe('function');
    expect(typeof api.updateFarm).toBe('function');
    expect(typeof api.deleteFarm).toBe('function');
    expect(typeof api.cropYieldOutlook).toBe('function');
    expect(typeof api.ensoImpact).toBe('function');
    expect(typeof api.cropYieldModel).toBe('function');
  });
});

