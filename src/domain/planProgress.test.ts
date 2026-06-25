import { buildEfforts, type ClimbEffort } from './aggregate';
import { evaluateLog, planProgress, planTargetsByGrade } from './planProgress';
import type { PlanDims, SessionPlan } from './types';

const dateBySession = new Map<number, string>([[1, '2026-06-24']]);
const NO_DIMS: PlanDims = { holdType: false, steepness: false };

function efforts(input: Parameters<typeof buildEfforts>[0]): ClimbEffort[] {
  return buildEfforts(input, dateBySession);
}

const fontPlan: SessionPlan = {
  discipline: 'boulder',
  label: 'Testi',
  sourceSessionId: null,
  modifier: {},
  dims: NO_DIMS,
  targets: [
    { gradeSystem: 'font', gradeValue: '6C', target: 6 }, // -> V5
    { gradeSystem: 'font', gradeValue: '7A', target: 2 }, // -> V6
  ],
};

describe('planTargetsByGrade', () => {
  it('keeps targets in same display system', () => {
    const map = planTargetsByGrade(fontPlan, 'font');
    expect(map.get('6C * *')?.target).toBe(6);
    expect(map.get('7A * *')?.target).toBe(2);
  });

  it('normalizes font targets to V display, summing colliding grades', () => {
    // 6A ja 6A+ molemmat -> V3 (FONT_TO_V), pitää summautua
    const plan: SessionPlan = {
      ...fontPlan,
      targets: [
        { gradeSystem: 'font', gradeValue: '6A', target: 2 },
        { gradeSystem: 'font', gradeValue: '6A+', target: 1 },
      ],
    };
    const map = planTargetsByGrade(plan, 'v');
    expect(map.get('V3 * *')?.target).toBe(3);
  });

  it('skips targets that cannot convert (boulder target, french display)', () => {
    const map = planTargetsByGrade(fontPlan, 'french');
    expect(map.size).toBe(0);
  });
});

describe('planProgress', () => {
  it('reports current vs target per grade, sorted easiest->hardest', () => {
    // 3x 6C send + 1x 7A attempt; display in font
    const rows = planProgress(
      fontPlan,
      efforts({
        sends: [{ sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '6C', count: 3 }],
        attemptLogs: [{ sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 1 }],
      }),
      'font',
    );
    expect(rows).toEqual([
      { grade: '6C', holdType: null, steepness: null, current: 3, target: 6 },
      { grade: '7A', holdType: null, steepness: null, current: 1, target: 2 },
    ]);
  });

  it('current includes project attempts and normalizes to display system', () => {
    // V5 effort should count toward 6C (font) target when display is font
    const rows = planProgress(
      fontPlan,
      efforts({
        projectAttempts: [
          { sessionId: 1, discipline: 'boulder', gradeSystem: 'v', gradeValue: 'V5', attemptCount: 4 },
        ],
      }),
      'font',
    );
    const row = rows.find((r) => r.grade === '6C');
    expect(row?.current).toBe(4);
  });

  it('returns empty for an empty plan', () => {
    const plan: SessionPlan = { ...fontPlan, targets: [] };
    expect(planProgress(plan, [], 'font')).toEqual([]);
  });
});

describe('evaluateLog', () => {
  const e = efforts({
    sends: [{ sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '6C', count: 5 }],
  });

  it('ok when staying within target', () => {
    expect(evaluateLog(fontPlan, e, 'boulder', 'font', 'font', '6C', 1)).toBe('ok');
  });

  it('over when log would exceed target', () => {
    // current 5, target 6, adding 2 -> 7 > 6
    expect(evaluateLog(fontPlan, e, 'boulder', 'font', 'font', '6C', 2)).toBe('over');
  });

  it('offplan for a grade not in the plan', () => {
    expect(evaluateLog(fontPlan, e, 'boulder', 'font', 'font', '8A', 1)).toBe('offplan');
  });

  it('ok on discipline mismatch', () => {
    expect(evaluateLog(fontPlan, e, 'sport', 'french', 'french', '7a', 99)).toBe('ok');
  });

  it('ok when grade cannot convert to display system', () => {
    // boulder grade, but plan display is french -> convert returns null -> ok
    expect(evaluateLog(fontPlan, e, 'boulder', 'french', 'font', '6C', 99)).toBe('ok');
  });

  it('over with empty plan treats every in-discipline grade as offplan', () => {
    const empty: SessionPlan = { ...fontPlan, targets: [] };
    expect(evaluateLog(empty, e, 'boulder', 'font', 'font', '6C', 1)).toBe('offplan');
  });

  it('ignores holdType/steepness args when plan has no dims', () => {
    // grade-only plan: dims-arvot eivät vaikuta avaimeen → pysyy 6C-tavoitteessa.
    expect(evaluateLog(fontPlan, e, 'boulder', 'font', 'font', '6C', 1, 'crimpy', 'overhang')).toBe(
      'ok',
    );
  });
});

/* --------------------- Ulottuvuus-suunnitelmat (dims) --------------------- */

const holdPlan: SessionPlan = {
  discipline: 'boulder',
  label: 'Hold dims',
  sourceSessionId: null,
  modifier: {},
  dims: { holdType: true, steepness: false },
  targets: [
    { gradeSystem: 'font', gradeValue: '7A', target: 5, holdType: 'crimpy' },
    { gradeSystem: 'font', gradeValue: '7A', target: 7, holdType: 'slopy' },
  ],
};

describe('planProgress with holdType dims', () => {
  it('keeps same-grade variants separate and counts efforts per variant', () => {
    const rows = planProgress(
      holdPlan,
      efforts({
        sends: [
          { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 2, holdType: 'crimpy' },
          { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 3, holdType: 'slopy' },
        ],
      }),
      'font',
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { grade: '7A', holdType: 'crimpy', steepness: null, current: 2, target: 5 },
        { grade: '7A', holdType: 'slopy', steepness: null, current: 3, target: 7 },
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it('an effort with the wrong holdType does not count toward the other variant', () => {
    const rows = planProgress(
      holdPlan,
      efforts({
        sends: [
          { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 4, holdType: 'slopy' },
        ],
      }),
      'font',
    );
    expect(rows.find((r) => r.holdType === 'crimpy')?.current).toBe(0);
    expect(rows.find((r) => r.holdType === 'slopy')?.current).toBe(4);
  });
});

describe('evaluateLog with holdType dims', () => {
  const e = efforts({
    sends: [
      { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 5, holdType: 'crimpy' },
    ],
  });

  it('over only against the matching variant', () => {
    // crimpy current 5, target 5, +1 -> over
    expect(evaluateLog(holdPlan, e, 'boulder', 'font', 'font', '7A', 1, 'crimpy', null)).toBe('over');
  });

  it('ok for the other variant even though grade matches', () => {
    // slopy current 0, target 7, +1 -> ok
    expect(evaluateLog(holdPlan, e, 'boulder', 'font', 'font', '7A', 1, 'slopy', null)).toBe('ok');
  });

  it('offplan for a holdType not present in the plan (null variant)', () => {
    expect(evaluateLog(holdPlan, e, 'boulder', 'font', 'font', '7A', 1, null, null)).toBe('offplan');
  });
});

/* ----------- Jokeri (null = "ei rajattu") + tarkkuus, molemmat dims ----------- */

const bothDims: PlanDims = { holdType: true, steepness: true };
const wildcardPlan: SessionPlan = {
  discipline: 'boulder',
  label: 'Wild',
  sourceSessionId: null,
  modifier: {},
  dims: bothDims,
  targets: [
    // 7C slopy, jyrkkyys rajaamaton (null) -> mikä tahansa jyrkkyys kelpaa
    { gradeSystem: 'font', gradeValue: '7C', target: 2, holdType: 'slopy', steepness: null },
    // 6B crimpy: tarkka slab-variantti JA rajaamaton (null) variantti
    { gradeSystem: 'font', gradeValue: '6B', target: 5, holdType: 'crimpy', steepness: 'slab' },
    { gradeSystem: 'font', gradeValue: '6B', target: 3, holdType: 'crimpy', steepness: null },
  ],
};

describe('evaluateLog with null = wildcard steepness', () => {
  it('a null-steepness target accepts any logged steepness', () => {
    expect(evaluateLog(wildcardPlan, [], 'boulder', 'font', 'font', '7C', 1, 'slopy', 'slab')).toBe('ok');
    expect(evaluateLog(wildcardPlan, [], 'boulder', 'font', 'font', '7C', 1, 'slopy', 'overhang')).toBe('ok');
    expect(evaluateLog(wildcardPlan, [], 'boulder', 'font', 'font', '7C', 1, 'slopy', null)).toBe('ok');
  });

  it('still offplan when the holdType has no matching target', () => {
    expect(evaluateLog(wildcardPlan, [], 'boulder', 'font', 'font', '7C', 1, 'crimpy', 'slab')).toBe('offplan');
  });

  it('most-specific target wins: a slab log fills the slab target, not the wildcard', () => {
    const rows = planProgress(
      wildcardPlan,
      efforts({
        sends: [
          { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '6B', count: 5, holdType: 'crimpy', steepness: 'slab' },
          { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '6B', count: 1, holdType: 'crimpy', steepness: 'overhang' },
        ],
      }),
      'font',
    );
    // 5 slab -> slab target; 1 overhang -> wildcard (null) target
    expect(rows.find((r) => r.steepness === 'slab')?.current).toBe(5);
    expect(rows.find((r) => r.holdType === 'crimpy' && r.steepness === null)?.current).toBe(1);
  });

  it('over fires against the specific variant once full, wildcard still ok', () => {
    const filled = efforts({
      sends: [
        { sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '6B', count: 5, holdType: 'crimpy', steepness: 'slab' },
      ],
    });
    // slab target full (5/5) -> +1 slab over
    expect(evaluateLog(wildcardPlan, filled, 'boulder', 'font', 'font', '6B', 1, 'crimpy', 'slab')).toBe('over');
    // overhang routes to the wildcard target (current 0/3) -> ok
    expect(evaluateLog(wildcardPlan, filled, 'boulder', 'font', 'font', '6B', 1, 'crimpy', 'overhang')).toBe('ok');
  });
});
