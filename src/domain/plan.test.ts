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
    holdType: null,
    steepness: null,
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

  test('soveltaa volyymimodifikaattorin (ylös vain jos murto-osa > 0.5) per aste', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeSystem: 'v', gradeValue: 'V5', count: 5 }),
    ];
    expect(buildPlanTargets(efforts, { volumePct: 20 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 6 }, // 6.0
    ]);
    expect(buildPlanTargets(efforts, { volumePct: 12 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 6 }, // 5.6 → 6 (> .5)
    ]);
    expect(buildPlanTargets(efforts, { volumePct: 8 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 5 }, // 5.4 → 5 (< .5)
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
    // 1 effort: -60% → 0.4 (< .5) → 0 → pudotetaan; -40% → 0.6 (> .5) → 1 → jää.
    expect(buildPlanTargets(efforts, { volumePct: -100 })).toEqual([]); // 0
    expect(buildPlanTargets(efforts, { volumePct: -60 })).toEqual([]); // 0.4 → 0
    expect(buildPlanTargets(efforts, { volumePct: -40 })).toEqual([
      { gradeSystem: 'v', gradeValue: 'V5', target: 1 }, // 0.6 → 1
    ]);
  });

  test('tyhjä syöte → tyhjä lista', () => {
    expect(buildPlanTargets([], { volumePct: 20, gradeShift: 1 })).toEqual([]);
  });

  test('ilman dimsejä otetyyppi/jyrkkyys jätetään huomiotta (yksi yhteistavoite)', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeValue: '7A', count: 5, holdType: 'crimpy' }),
      effort({ gradeValue: '7A', count: 7, holdType: 'slopy' }),
    ];
    const targets = buildPlanTargets(efforts, {});
    expect(targets).toEqual([{ gradeSystem: 'font', gradeValue: '7A', target: 12 }]);
  });
});

describe('buildPlanTargets ulottuvuuksilla (dims)', () => {
  test('holdType-dims jakaa saman asteen erillisiin tavoitteisiin', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeValue: '7A', count: 5, holdType: 'crimpy' }),
      effort({ gradeValue: '7A', count: 7, holdType: 'slopy' }),
    ];
    const targets = buildPlanTargets(efforts, {}, { holdType: true, steepness: false });
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'font', gradeValue: '7A', target: 5, holdType: 'crimpy' },
        { gradeSystem: 'font', gradeValue: '7A', target: 7, holdType: 'slopy' },
      ]),
    );
    expect(targets).toHaveLength(2);
    // steepness-kenttää ei kirjoiteta kun se ei ole käytössä.
    expect(targets.every((t) => !('steepness' in t))).toBe(true);
  });

  test('null-otetyyppi on oma varianttinsa', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeValue: '7A', count: 2, holdType: 'crimpy' }),
      effort({ gradeValue: '7A', count: 3, holdType: null }),
    ];
    const targets = buildPlanTargets(efforts, {}, { holdType: true, steepness: false });
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'font', gradeValue: '7A', target: 2, holdType: 'crimpy' },
        { gradeSystem: 'font', gradeValue: '7A', target: 3, holdType: null },
      ]),
    );
    expect(targets).toHaveLength(2);
  });

  test('molemmat dims jakavat (holdType × steepness) -varianteittain', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeValue: '7A', count: 1, holdType: 'crimpy', steepness: 'overhang' }),
      effort({ gradeValue: '7A', count: 4, holdType: 'crimpy', steepness: 'slab' }),
      effort({ gradeValue: '7A', count: 2, holdType: 'slopy', steepness: 'overhang' }),
    ];
    const targets = buildPlanTargets(efforts, {}, { holdType: true, steepness: true });
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'font', gradeValue: '7A', target: 1, holdType: 'crimpy', steepness: 'overhang' },
        { gradeSystem: 'font', gradeValue: '7A', target: 4, holdType: 'crimpy', steepness: 'slab' },
        { gradeSystem: 'font', gradeValue: '7A', target: 2, holdType: 'slopy', steepness: 'overhang' },
      ]),
    );
    expect(targets).toHaveLength(3);
  });

  test('modifikaattori sovelletaan per variantti', () => {
    const efforts: ClimbEffort[] = [
      effort({ gradeValue: '7A', count: 5, holdType: 'crimpy' }),
      effort({ gradeValue: '7A', count: 5, holdType: 'slopy' }),
    ];
    // +20% → kumpikin 5 → 6
    const targets = buildPlanTargets(efforts, { volumePct: 20 }, { holdType: true, steepness: false });
    expect(targets).toEqual(
      expect.arrayContaining([
        { gradeSystem: 'font', gradeValue: '7A', target: 6, holdType: 'crimpy' },
        { gradeSystem: 'font', gradeValue: '7A', target: 6, holdType: 'slopy' },
      ]),
    );
    expect(targets).toHaveLength(2);
  });
});
