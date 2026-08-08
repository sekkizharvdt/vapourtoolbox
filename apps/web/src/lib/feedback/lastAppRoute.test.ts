/**
 * Tests for last-app-route capture.
 *
 * Phase D2: document.referrer is empty on Next.js client-side navigation, which
 * is why feature requests carried a pageUrl only 16% of the time. This is the
 * fallback that gives the form the screen the user came from.
 */

import { recordAppRoute, getLastAppRouteUrl } from './lastAppRoute';

describe('lastAppRoute', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('returns an absolute URL for the recorded route', () => {
    recordAppRoute('/procurement/pos/abc123');

    expect(getLastAppRouteUrl()).toBe(`${window.location.origin}/procurement/pos/abc123`);
  });

  it('returns empty when nothing has been recorded', () => {
    expect(getLastAppRouteUrl()).toBe('');
  });

  it('keeps the most recent route', () => {
    recordAppRoute('/accounting/bills');
    recordAppRoute('/procurement/rfqs');

    expect(getLastAppRouteUrl()).toBe(`${window.location.origin}/procurement/rfqs`);
  });

  it('ignores feedback routes, which are never the origin screen', () => {
    recordAppRoute('/procurement/pos/abc123');
    recordAppRoute('/feedback');
    recordAppRoute('/feedback/xyz');

    expect(getLastAppRouteUrl()).toBe(`${window.location.origin}/procurement/pos/abc123`);
  });

  it('ignores an empty path', () => {
    recordAppRoute('/accounting/bills');
    recordAppRoute('');

    expect(getLastAppRouteUrl()).toBe(`${window.location.origin}/accounting/bills`);
  });

  it('degrades to empty rather than throwing when storage is unavailable', () => {
    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => recordAppRoute('/accounting/bills')).not.toThrow();
    expect(getLastAppRouteUrl()).toBe('');

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
