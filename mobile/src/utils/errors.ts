import type { MessageKey } from '@/i18n';
import { ApiError } from '@/services/api';

export function errorMessageKey(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'unauthorized':
        return 'common.unauthorized';
      case 'model_unavailable':
        return 'common.modelUnavailable';
      case 'invalid_location':
        return 'advisory.locationOutside';
      case 'network':
      case 'timeout':
        return 'common.network';
      default:
        return 'common.error';
    }
  }
  return 'common.error';
}
