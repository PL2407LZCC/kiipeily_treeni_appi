import {
  convert,
  defaultSystemForDiscipline,
  fontToV,
  gradeIndex,
  gradesFor,
  secondaryLabel,
  vToFont,
} from './grades';

describe('asteikot (grades)', () => {
  test('gradesFor palauttaa oikean asteikon', () => {
    expect(gradesFor('font')).toContain('6B');
    expect(gradesFor('v')).toContain('V5');
    expect(gradesFor('french')).toContain('7a+');
  });

  test('gradeIndex järjestää vaikeuden mukaan', () => {
    expect(gradeIndex('6A', 'font')).toBeLessThan(gradeIndex('7A', 'font'));
    expect(gradeIndex('V2', 'v')).toBeLessThan(gradeIndex('V10', 'v'));
    expect(gradeIndex('tuntematon', 'font')).toBe(-1);
  });

  test('fontToV ja vToFont (likimääräiset)', () => {
    expect(fontToV('7A')).toBe('V6');
    expect(fontToV('4')).toBe('V0');
    expect(vToFont('V6')).toBe('7A');
    expect(fontToV('tuntematon')).toBeNull();
  });

  test('convert: sama järjestelmä palauttaa arvon', () => {
    expect(convert('6B', 'font', 'font')).toBe('6B');
  });

  test('convert: font <-> v', () => {
    expect(convert('7A', 'font', 'v')).toBe('V6');
    expect(convert('V6', 'v', 'font')).toBe('7A');
  });

  test('convert: boulder <-> sport ei muunnu', () => {
    expect(convert('6B', 'font', 'french')).toBeNull();
    expect(convert('7a', 'french', 'font')).toBeNull();
  });

  test('defaultSystemForDiscipline', () => {
    expect(defaultSystemForDiscipline('sport', 'font')).toBe('french');
    expect(defaultSystemForDiscipline('boulder', 'font')).toBe('font');
    expect(defaultSystemForDiscipline('boulder', 'v')).toBe('v');
  });

  test('secondaryLabel näyttää muunnoksen vain eri järjestelmälle', () => {
    expect(secondaryLabel('7A', 'font', 'font')).toBeNull();
    expect(secondaryLabel('7A', 'font', 'v')).toBe('V6');
  });
});
