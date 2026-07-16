/**
 * Tests for the pure budget threshold alert logic (B5).
 */

import { evaluateBudgetAlerts } from './budgetAlerts';

const noStamps = {};
const stamped90 = { budgetAlert90SentAt: new Date() };
const stampedBoth = { budgetAlert90SentAt: new Date(), budgetAlert100SentAt: new Date() };

describe('evaluateBudgetAlerts', () => {
  it('does nothing below 90%', () => {
    expect(evaluateBudgetAlerts(0, noStamps)).toEqual({
      notify: null,
      stamp90: false,
      stamp100: false,
    });
    expect(evaluateBudgetAlerts(89.99, noStamps)).toEqual({
      notify: null,
      stamp90: false,
      stamp100: false,
    });
  });

  it('crossing 90% fires the warning once and stamps it', () => {
    expect(evaluateBudgetAlerts(92, noStamps)).toEqual({
      notify: 90,
      stamp90: true,
      stamp100: false,
    });
  });

  it('staying above 90% does not re-fire once stamped', () => {
    expect(evaluateBudgetAlerts(95, stamped90)).toEqual({
      notify: null,
      stamp90: false,
      stamp100: false,
    });
  });

  it('crossing 100% after the 90% alert fires the second (exceeded) alert', () => {
    expect(evaluateBudgetAlerts(101, stamped90)).toEqual({
      notify: 100,
      stamp90: false,
      stamp100: true,
    });
  });

  it('staying above 100% does not re-fire once both stamps exist', () => {
    expect(evaluateBudgetAlerts(120, stampedBoth)).toEqual({
      notify: null,
      stamp90: false,
      stamp100: false,
    });
  });

  it('jumping straight past 100% fires only the exceeded alert but stamps both', () => {
    expect(evaluateBudgetAlerts(105, noStamps)).toEqual({
      notify: 100,
      stamp90: true,
      stamp100: true,
    });
  });

  it('exactly 90% and exactly 100% count as crossings', () => {
    expect(evaluateBudgetAlerts(90, noStamps).notify).toBe(90);
    expect(evaluateBudgetAlerts(100, noStamps).notify).toBe(100);
  });

  it('dropping back into 90-100% after the exceeded alert stays silent (one-shot stamps)', () => {
    expect(evaluateBudgetAlerts(95, stampedBoth)).toEqual({
      notify: null,
      stamp90: false,
      stamp100: false,
    });
  });
});
