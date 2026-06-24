import { type ClimbEffort } from './aggregate';
import { buildPlanTargets } from './plan';

function effort(partial: Partial<ClimbEffort>): ClimbEffort {
  return {
    discipline: 'boulder',
    gradeSystem: 'font',
    gradeValue: '7A',
    count: 1,
    kind: 'send',
    date: '2026-06-22',
    sessionId: 1,
    ...partial,
  };
}

describe('buildPlanTargets', () => {
  test('summaa per (gradeSystem, gradeValue) ilman modifikaattoria', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'font', gradeValue: '7A', count: 2, kind: 'send' }),
      effort({ gradeSystem: 'font', gradeValue: '7A', count: 1, kind: 'attempt' }),
      effort({ gradeSystem: 'font', gradeValue: '6C', count: 4, kind: 'send' }),
    ];
    const targets = buildPlanTargets(efforts, {});
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'font', gradeValue: '7A', target: 3 },
        { gradeSystem: 'font', gradeValue: '6C', target: 4 },
      ]),
    );
    expect(targets).toHaveLength(2);
  });

  test('pitää grade-systemit erillään (font ja v eivät sekoitu)', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'font', gradeValue: '7A', count: 2 }),
      effort({ gradeSystem: 'v', gradeValue: 'V6', count: 3 }),
    ];
    const targets = buildPlanTargets(efforts, {});
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'font', gradeValue: '7A', target: 2 },
        { gradeSystem: 'v', gradeValue: 'V6', target: 3 },
      ]),
    );
    expect(targets).toHaveLength(2);
  });

  test('soveltaa volyymimodifikaattorin (pyöristäen ylöspäin) per aste', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'v', gradeValue: 'V5', count: 5 }),
    ];
    expect(buildPlanTargets(efforts, { volumePct: 20 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 6 }, // 6.0
    ]);
    // 5 * 1.1 = 5.5 → ceil 6 (round olisi 6, mutta 5*1.05=5.25 → ceil 6 ≠ round 5)
    expect(buildPlanTargets(efforts, { volumePct: 5 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 6 },
    ]);
  });

  test('soveltaa vaikeussiirron lajin asteikolla ja summaa törmäykset', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'v', gradeValue: 'V4', count: 2 }),
      effort({ gradeSystem: 'v', gradeValue: 'V5', count: 3 }),
    ];
    // V4+1→V5, V5+1→V6
    const targets = buildPlanTargets(efforts, { gradeShift: 1 });
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'v', gradeValue: 'V5', target: 2 },
        { gradeSystem: 'v', gradeValue: 'V6', target: 3 },
      ]),
    );
    expect(targets).toHaveLength(2);
  });

  test('yhdistää siirron ja volyymin', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'v', gradeValue: 'V5', count: 5 }),
    ];
    const targets = buildPlanTargets(efforts, { gradeShift: 1, volumePct: 20 });
    expect(targets).toEqual([{ gradeSystem: 'v', gradeValue: 'V6', target: 6 }]);
  });

  test('pudottaa tavoitteet joiden määrä menee nollaan tai alle', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'v', gradeValue: 'V5', count: 1 }),
    ];
    // -100% → ceil(0) = 0 → pudotetaan. (Ylöspäin pyöristys: pienempi vähennys
    // ei koskaan tiputa astetta nollaan, esim. -60% → ceil(0.4) = 1.)
    expect(buildPlanTargets(efforts, { volumePct: -100 })).toEqual([]);
    expect(buildPlanTargets(efforts, { volumePct: -60 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 1 },
    ]);
  });

  test('tyhjä syöte → tyhjä lista', () => {
    expect(buildPlanTargets([], { volumePct: 20, gradeShift: 1 })).toEqual([]);
  });
});
