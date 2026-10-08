import am from '@/i18n/am.json';
import en from '@/i18n/en.json';
import or from '@/i18n/or.json';
import { translate } from '@/i18n';

function leaves(o: unknown, prefix = ''): string[] {
  if (o && typeof o === 'object') {
    return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('i18n catalogues', () => {
  it('have identical key sets', () => {
    const base = leaves(en).sort();
    expect(leaves(am).sort()).toEqual(base);
    expect(leaves(or).sort()).toEqual(base);
  });
  it('interpolates variables', () => {
    expect(translate('en', 'common.minutesAgo', { n: 4 })).toBe('4 min ago');
    expect(translate('am', 'common.daysAgo', { n: 2 })).toContain('2');
  });
});
