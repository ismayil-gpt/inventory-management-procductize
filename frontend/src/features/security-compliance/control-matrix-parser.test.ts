import { describe, it, expect } from 'vitest';
import { parseControlMatrix } from './control-matrix-parser';

describe('parseControlMatrix', () => {
  it('reads all 20 DESC controls from the real evidence file, each with a known status', () => {
    const { rows, lastUpdated } = parseControlMatrix();
    expect(rows.map((r) => r.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    rows.forEach((r) => expect(['NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED']).toContain(r.status));
    expect(lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('maps each status symbol and strips markdown from the evidence text', () => {
    const { rows } = parseControlMatrix([
      'Last updated: **2026-10-01** (note)',
      '| 3 | Password storage | ✔ | **Policy enforced** in `user.schema.ts` |',
      '| 4 | Sessions | ◐ | pending |',
      '| 5 | Lockout | ☑ | done |',
      '| 6 | Idle | ☐ | — |',
    ].join('\n'));
    expect(rows.map((r) => r.status)).toEqual(['VERIFIED', 'IN_PROGRESS', 'IMPLEMENTED', 'NOT_STARTED']);
    expect(rows[0].evidence).toBe('Policy enforced in user.schema.ts');
  });
});
