import {
  applyGradeShift,
  applyModifier,
  applyVolume,
  buildEfforts,
  compareTallies,
  countWorkouts,
  percentChange,
  dayRange,
  filterByPeriod,
  hardestGrade,
  inPeriod,
  lastWeekRange,
  monthRange,
  tallyByGrade,
  totalCount,
  weekRange,
  type ClimbEffort,
} from './aggregate';

const dateBySession = new Map<number, string>([
  [1, '2026-06-22'], // ma
  [2, '2026-06-24'], // ke
  [3, '2026-06-15'], // ed. viikko
]);

describe('buildEfforts', () => {
  const efforts = buildEfforts(
    {
      sends: [{ sessionId: 1, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 2 }],
      attemptLogs: [{ sessionId: 1, discipline: 'boulder', gradeSystem: 'v', gradeValue: 'V6', count: 3 }],
      projectAttempts: [
        { sessionId: 2, discipline: 'boulder', gradeSystem: 'font', gradeValue: '7B', attemptCount: 4 },
      ],
    },
    dateBySession,
  );

  test('luokittelee send/attempt ja käyttää attemptCountia projektiyrityksille', () => {
    expect(efforts).toHaveLength(3);
    const send = efforts.find((e) => e.kind === 'send')!;
    expect(send).toMatchObject({ gradeValue: '7A', count: 2, date: '2026-06-22' });
    const projectAttempt = efforts.find((e) => e.gradeValue === '7B')!;
    expect(projectAttempt).toMatchObject({ kind: 'attempt', count: 4, date: '2026-06-24' });
    expect(efforts.filter((e) => e.kind === 'attempt')).toHaveLength(2);
  });

  test('ohittaa rivit, joiden sessiolle ei löydy päivää', () => {
    const out = buildEfforts(
      { sends: [{ sessionId: 999, discipline: 'boulder', gradeSystem: 'font', gradeValue: '6A', count: 1 }] },
      dateBySession,
    );
    expect(out).toHaveLength(0);
  });
});

describe('aikajaksot', () => {
  test('weekRange alkaa maanantaista ja kestää 7 päivää', () => {
    const wk = weekRange('2026-06-24');
    expect(new Date(`${wk.start}T00:00:00Z`).getUTCDay()).toBe(1); // ma
    expect(wk.end).toBe(addDays(wk.start, 6));
    expect(inPeriod('2026-06-24', wk)).toBe(true);
    expect(inPeriod(wk.start, wk)).toBe(true);
    expect(inPeriod(wk.end, wk)).toBe(true);
  });

  test('lastWeekRange on edellinen maanantai-sunnuntai', () => {
    const wk = weekRange('2026-06-24');
    const lw = lastWeekRange('2026-06-24');
    expect(lw.end).toBe(addDays(wk.start, -1));
    expect(addDays(lw.start, 7)).toBe(wk.start);
  });

  test('monthRange kattaa kuukauden (myös karkausvuosi)', () => {
    expect(monthRange('2026-03-15')).toEqual({ start: '2026-03-01', end: '2026-03-31' });
    expect(monthRange('2024-02-10')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
  });

  test('dayRange ja filterByPeriod', () => {
    expect(dayRange('2026-06-24')).toEqual({ start: '2026-06-24', end: '2026-06-24' });
    const items = [{ date: '2026-06-22' }, { date: '2026-06-24' }, { date: '2026-06-15' }];
    expect(filterByPeriod(items, weekRange('2026-06-24'))).toEqual([
      { date: '2026-06-22' },
      { date: '2026-06-24' },
    ]);
  });
});

describe('tallyByGrade / totals', () => {
  // font 7A (= V6) send 2, v V6 attempt 3 → V6 total 5; font 7B (=V8) attempt 4
  const efforts: ClimbEffort[] = [
    { discipline: 'boulder', gradeSystem: 'font', gradeValue: '7A', count: 2, kind: 'send', date: '2026-06-22', sessionId: 1, holdType: null, steepness: null },
    { discipline: 'boulder', gradeSystem: 'v', gradeValue: 'V6', count: 3, kind: 'attempt', date: '2026-06-22', sessionId: 1, holdType: null, steepness: null },
    { discipline: 'boulder', gradeSystem: 'font', gradeValue: '7B', count: 4, kind: 'attempt', date: '2026-06-24', sessionId: 2, holdType: null, steepness: null },
  ];

  test('total normalisoi V-asteikkoon ja summaa', () => {
    const rows = tallyByGrade(efforts, { metric: 'total', discipline: 'boulder', displaySystem: 'v' });
    expect(rows).toEqual([
      { grade: 'V6', count: 5 },
      { grade: 'V8', count: 4 },
    ]);
  });

  test('metric sends/attempts suodattaa lajin mukaan', () => {
    const sends = tallyByGrade(efforts, { metric: 'sends', discipline: 'boulder', displaySystem: 'v' });
    expect(sends).toEqual([{ grade: 'V6', count: 2 }]);
    const attempts = tallyByGrade(efforts, { metric: 'attempts', discipline: 'boulder', displaySystem: 'v' });
    expect(attempts).toEqual([
      { grade: 'V6', count: 3 },
      { grade: 'V8', count: 4 },
    ]);
  });

  test('totalCount ja hardestGrade', () => {
    expect(totalCount(efforts)).toBe(9);
    expect(totalCount(efforts, 'sends')).toBe(2);
    expect(hardestGrade(efforts, { discipline: 'boulder', displaySystem: 'v' })).toBe('V8');
  });
});

describe('countWorkouts', () => {
  test('laskee jakson sessiot', () => {
    const sessions = [{ date: '2026-06-22' }, { date: '2026-06-24' }, { date: '2026-06-15' }];
    expect(countWorkouts(sessions, weekRange('2026-06-24'))).toBe(2);
    expect(countWorkouts(sessions, lastWeekRange('2026-06-24'))).toBe(1);
  });
});

describe('compareTallies', () => {
  test('yhdistää, laskee deltan ja lajittelee asteen mukaan', () => {
    const a = [
      { grade: 'V4', count: 5 },
      { grade: 'V6', count: 2 },
    ];
    const b = [
      { grade: 'V6', count: 3 },
      { grade: 'V8', count: 1 },
    ];
    expect(compareTallies(a, b, 'v')).toEqual([
      { grade: 'V4', a: 5, b: 0, delta: -5 },
      { grade: 'V6', a: 2, b: 3, delta: 1 },
      { grade: 'V8', a: 0, b: 1, delta: 1 },
    ]);
  });
});

describe('modifikaattorit', () => {
  test('applyVolume pyöristää ylös vain jos murto-osa > 0.5', () => {
    expect(applyVolume([{ gradeValue: 'V5', count: 5 }], 20)).toEqual([{ gradeValue: 'V5', count: 6 }]); // 6.0
    expect(applyVolume([{ gradeValue: 'V5', count: 5 }], -20)).toEqual([{ gradeValue: 'V5', count: 4 }]); // 4.0
    expect(applyVolume([{ gradeValue: 'V5', count: 1 }], 60)).toEqual([{ gradeValue: 'V5', count: 2 }]); // 1.6 → 2
    expect(applyVolume([{ gradeValue: 'V5', count: 1 }], 50)).toEqual([{ gradeValue: 'V5', count: 1 }]); // 1.5 → 1 (ei > .5)
    expect(applyVolume([{ gradeValue: 'V5', count: 1 }], 40)).toEqual([{ gradeValue: 'V5', count: 1 }]); // 1.4 → 1
  });

  test('applyGradeShift siirtää asteita ja summaa törmäykset', () => {
    expect(applyGradeShift([{ gradeValue: 'V5', count: 5 }], 1, 'v')).toEqual([
      { gradeValue: 'V6', count: 5 },
    ]);
    // V5 +1 → V6, V6 +1 → V7 (ei törmää); V5 ja V4 molemmat +1 → V6, V5 → summautuu
    expect(
      applyGradeShift(
        [
          { gradeValue: 'V4', count: 2 },
          { gradeValue: 'V5', count: 3 },
        ],
        1,
        'v',
      ),
    ).toEqual([
      { gradeValue: 'V5', count: 2 },
      { gradeValue: 'V6', count: 3 },
    ]);
  });

  test('applyGradeShift klamppaa asteikon yläreunaan ja summaa', () => {
    // V17 on viimeinen; V16 ja V17 +1 → molemmat V17
    expect(
      applyGradeShift(
        [
          { gradeValue: 'V16', count: 1 },
          { gradeValue: 'V17', count: 2 },
        ],
        1,
        'v',
      ),
    ).toEqual([{ gradeValue: 'V17', count: 3 }]);
  });

  test('applyModifier yhdistää siirron ja volyymin', () => {
    expect(applyModifier([{ gradeValue: 'V5', count: 5 }], { gradeShift: 1, volumePct: 20 }, 'v')).toEqual([
      { gradeValue: 'V6', count: 6 },
    ]);
  });
});

describe('percentChange', () => {
  it('rounds the relative change a->b', () => {
    expect(percentChange(4, 6)).toBe(50);
    expect(percentChange(10, 8)).toBe(-20);
    expect(percentChange(3, 3)).toBe(0);
    expect(percentChange(3, 4)).toBe(33); // 33.33 -> 33
  });

  it('returns null when the baseline is zero', () => {
    expect(percentChange(0, 5)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

/** Testiapuri: lisää päiviä ISO-päivään (peilaa moduulin sisäistä logiikkaa). */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
