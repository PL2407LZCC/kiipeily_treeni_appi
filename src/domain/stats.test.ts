import { gradePyramid, isoWeekStart, volumeOverTime } from './stats';
import type { Climb } from './types';

describe('gradePyramid', () => {
  const climbs: Climb[] = [
    { discipline: 'boulder', gradeSystem: 'font', gradeValue: '6B', count: 3 },
    { discipline: 'boulder', gradeSystem: 'font', gradeValue: '6A', count: 1 },
    { discipline: 'boulder', gradeSystem: 'v', gradeValue: 'V4', count: 2 }, // = 6B fontissa
    { discipline: 'sport', gradeSystem: 'french', gradeValue: '7a', count: 5 },
  ];

  test('yhdistää sendit ja normalisoi V -> Font', () => {
    const p = gradePyramid(climbs, 'boulder', 'font');
    // 6A: 1, 6B: 3 + 2 (V4->6B) = 5
    const m = new Map(p.map((r) => [r.grade, r.count]));
    expect(m.get('6A')).toBe(1);
    expect(m.get('6B')).toBe(5);
  });

  test('järjestää helpoimmasta vaikeimpaan', () => {
    const p = gradePyramid(climbs, 'boulder', 'font');
    expect(p.map((r) => r.grade)).toEqual(['6A', '6B']);
  });

  test('sport käyttää french-asteikkoa', () => {
    const p = gradePyramid(climbs, 'sport', 'font');
    expect(p).toEqual([{ grade: '7a', count: 5 }]);
  });

  test('normalisoi näyttöasteikkoon V', () => {
    const p = gradePyramid(climbs, 'boulder', 'v');
    const m = new Map(p.map((r) => [r.grade, r.count]));
    // 6A->V3 (1), 6B->V4 (3), V4 (2) => V4: 5, V3: 1
    expect(m.get('V3')).toBe(1);
    expect(m.get('V4')).toBe(5);
  });
});

describe('volumeOverTime', () => {
  test('isoWeekStart palauttaa maanantain', () => {
    // 2026-06-23 on tiistai -> viikon alku maanantai 2026-06-22
    expect(isoWeekStart('2026-06-23')).toBe('2026-06-22');
    // 2026-06-21 on sunnuntai -> sama viikko alkaa 2026-06-15
    expect(isoWeekStart('2026-06-21')).toBe('2026-06-15');
  });

  test('aggregoi päivittäin', () => {
    const v = volumeOverTime(
      [
        { date: '2026-06-23', count: 2 },
        { date: '2026-06-23', count: 3 },
        { date: '2026-06-24', count: 1 },
      ],
      'day',
    );
    expect(v.map((b) => b.count)).toEqual([5, 1]);
    expect(v[0].key).toBe('2026-06-23');
  });

  test('aggregoi viikoittain ja järjestää ajassa', () => {
    const v = volumeOverTime(
      [
        { date: '2026-06-24', count: 2 }, // vko 2026-06-22
        { date: '2026-06-15', count: 4 }, // vko 2026-06-15
      ],
      'week',
    );
    expect(v.map((b) => b.key)).toEqual(['2026-06-15', '2026-06-22']);
    expect(v.map((b) => b.count)).toEqual([4, 2]);
  });
});
