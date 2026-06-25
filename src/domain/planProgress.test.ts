import { buildEfforts, type ClimbEffort } from './aggregate';
import { evaluateLog, planProgress, planTargetsByGrade } from './planProgress';
import type { SessionPlan } from './types';

const dateBySession = new Map<number, string>([[1, '2026-06-24']]);

function efforts(input: Parameters<typeof buildEfforts>[0]): ClimbEffort[] {
  return buildEfforts(input, dateBySession);
}

const fontPlan: SessionPlan = {
  discipline: 'boulder',
  label: 'Testi',
  sourceSessionId: null,
  modifier: {},
  targets: [
    { gradeSystem: 'font', gradeValue: '6C', target: 6 }, // -> V5
    { gradeSystem: 'font', gradeValue: '7A', target: 2 }, // -> V6
  ],
};

describe('planTargetsByGrade', () => {
  it('keeps targets in same display system', () => {
    const map = planTargetsByGrade(fontPlan, 'font');
    expect(map.get('6C')).toBe(6);
    expect(map.get('7A')).toBe(2);
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
    expect(map.get('V3')).toBe(3);
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
      { grade: '6C', current: 3, target: 6 },
      { grade: '7A', current: 1, target: 2 },
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
});
