import { classifyUsageTrend, daysUntilStockout, estimatedReorderCost, round2 } from './predictive-analytics-calculator';

describe('daysUntilStockout', () => {
  it('returns null when there is no recent usage to divide by', () => {
    expect(daysUntilStockout(40, 0)).toBeNull();
    expect(daysUntilStockout(40, -1)).toBeNull();
  });

  it('floors whole days of cover remaining', () => {
    expect(daysUntilStockout(40, 4)).toBe(10);
    expect(daysUntilStockout(15, 4)).toBe(3); // 3.75 -> 3, never rounds up past what's actually left
  });

  it('returns 0 for a product already at or below zero stock with active usage', () => {
    expect(daysUntilStockout(0, 2)).toBe(0);
  });
});

describe('classifyUsageTrend', () => {
  it('flags UP when recent usage is at least 15% above baseline', () => {
    expect(classifyUsageTrend(11.5, 10)).toBe('UP');
    expect(classifyUsageTrend(20, 10)).toBe('UP');
  });

  it('flags DOWN when recent usage is at least 15% below baseline', () => {
    expect(classifyUsageTrend(8.5, 10)).toBe('DOWN');
    expect(classifyUsageTrend(2, 10)).toBe('DOWN');
  });

  it('flags FLAT inside the +-15% band', () => {
    expect(classifyUsageTrend(10, 10)).toBe('FLAT');
    expect(classifyUsageTrend(10.5, 10)).toBe('FLAT');
    expect(classifyUsageTrend(9.5, 10)).toBe('FLAT');
  });

  it('treats a zero baseline with genuine new usage as UP, not a division error', () => {
    expect(classifyUsageTrend(5, 0)).toBe('UP');
  });

  it('treats a zero baseline with no recent usage either as FLAT', () => {
    expect(classifyUsageTrend(0, 0)).toBe('FLAT');
  });
});

describe('estimatedReorderCost', () => {
  it('multiplies suggested quantity by unit cost', () => {
    expect(estimatedReorderCost(48, 12.5)).toBe(600);
  });

  it('costs zero, never fabricates a price, when unit cost is unset', () => {
    expect(estimatedReorderCost(48, null)).toBe(0);
    expect(estimatedReorderCost(48, undefined)).toBe(0);
  });

  it('is zero when nothing is being reordered', () => {
    expect(estimatedReorderCost(0, 12.5)).toBe(0);
  });
});

describe('round2', () => {
  it('rounds to two decimal places without floating-point drift', () => {
    expect(round2(29702.5049999)).toBe(29702.5);
    expect(round2(10.005)).toBeCloseTo(10.01, 2);
  });
});
