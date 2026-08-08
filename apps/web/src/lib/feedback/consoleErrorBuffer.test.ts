/**
 * Tests for automatic console-error capture (Phase B2).
 */

import {
  installConsoleErrorCapture,
  getRecentConsoleErrors,
  getConsoleErrorCount,
  __resetConsoleErrorBufferForTests,
} from './consoleErrorBuffer';

describe('consoleErrorBuffer', () => {
  let originalError: typeof console.error;

  beforeEach(() => {
    __resetConsoleErrorBufferForTests();
    originalError = console.error;
  });

  afterEach(() => {
    console.error = originalError;
    __resetConsoleErrorBufferForTests();
  });

  it('captures nothing before anything has gone wrong', () => {
    installConsoleErrorCapture();

    expect(getRecentConsoleErrors()).toBe('');
    expect(getConsoleErrorCount()).toBe(0);
  });

  it('captures console.error output', () => {
    installConsoleErrorCapture();

    console.error('Permission denied: create goods receipt requires INSPECT_GOODS');

    expect(getRecentConsoleErrors()).toContain('INSPECT_GOODS');
    expect(getConsoleErrorCount()).toBe(1);
  });

  it('still calls through to the original console.error', () => {
    const spy = jest.fn();
    console.error = spy;
    installConsoleErrorCapture();

    console.error('boom');

    // Devtools behaviour must be unchanged.
    expect(spy).toHaveBeenCalledWith('boom');
  });

  it('records an Error name, message and stack', () => {
    installConsoleErrorCapture();

    console.error(new Error('Bill not found'));

    const captured = getRecentConsoleErrors();
    expect(captured).toContain('Error: Bill not found');
  });

  it('does not throw on circular objects', () => {
    installConsoleErrorCapture();
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;

    expect(() => console.error(circular)).not.toThrow();
    expect(getConsoleErrorCount()).toBe(1);
  });

  it('keeps only the most recent entries', () => {
    installConsoleErrorCapture();

    for (let i = 0; i < 25; i++) console.error(`error ${i}`);

    expect(getConsoleErrorCount()).toBe(10);
    const captured = getRecentConsoleErrors();
    expect(captured).toContain('error 24');
    expect(captured).not.toContain('error 0');
  });

  it('truncates a single very long entry', () => {
    installConsoleErrorCapture();

    console.error('x'.repeat(5000));

    // Capped per entry so one runaway log cannot dominate the report.
    expect(getRecentConsoleErrors().length).toBeLessThan(1200);
  });

  it('ignores empty output', () => {
    installConsoleErrorCapture();

    console.error('   ');

    expect(getConsoleErrorCount()).toBe(0);
  });

  it('only patches once even if installed repeatedly', () => {
    installConsoleErrorCapture();
    installConsoleErrorCapture();
    installConsoleErrorCapture();

    console.error('once');

    // A second patch would record the same message twice.
    expect(getConsoleErrorCount()).toBe(1);
  });

  it('does not capture console.log or console.warn', () => {
    installConsoleErrorCapture();

    // eslint-disable-next-line no-console -- asserting these are NOT captured
    console.log('ordinary logging that may contain business data');
    console.warn('a warning');

    expect(getConsoleErrorCount()).toBe(0);
  });
});
