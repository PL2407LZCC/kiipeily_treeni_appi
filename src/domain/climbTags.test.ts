import { holdTypeFromX, holdTypeFromXCentered, steepnessFromDy } from './climbTags';

describe('climbTags helpers', () => {
  describe('holdTypeFromX', () => {
    const W = 300; // kolmannekset: [0,100)=slopy, [100,200)=null, [200,300)=crimpy

    test('vasen kolmannes = slopy', () => {
      expect(holdTypeFromX(0, W)).toBe('slopy');
      expect(holdTypeFromX(50, W)).toBe('slopy');
      expect(holdTypeFromX(99, W)).toBe('slopy');
    });

    test('keskimmäinen kolmannes = null', () => {
      expect(holdTypeFromX(100, W)).toBeNull();
      expect(holdTypeFromX(150, W)).toBeNull();
      expect(holdTypeFromX(199, W)).toBeNull();
    });

    test('oikea kolmannes = crimpy', () => {
      expect(holdTypeFromX(200, W)).toBe('crimpy');
      expect(holdTypeFromX(250, W)).toBe('crimpy');
      expect(holdTypeFromX(299, W)).toBe('crimpy');
    });

    test('rajat leikataan riviin', () => {
      expect(holdTypeFromX(-20, W)).toBe('slopy');
      expect(holdTypeFromX(W, W)).toBe('crimpy');
      expect(holdTypeFromX(W + 100, W)).toBe('crimpy');
    });

    test('nolla- tai negatiivinen leveys = null', () => {
      expect(holdTypeFromX(50, 0)).toBeNull();
      expect(holdTypeFromX(50, -10)).toBeNull();
    });
  });

  describe('holdTypeFromXCentered', () => {
    // W=300, neutral=84 → keskitetty null-vyöhyke [108, 192]; vasen<108=slopy, oikea>192=crimpy.
    const W = 300;
    const N = 84;

    test('keskitetty null-vyöhyke', () => {
      expect(holdTypeFromXCentered(150, W, N)).toBeNull();
      expect(holdTypeFromXCentered(108, W, N)).toBeNull();
      expect(holdTypeFromXCentered(192, W, N)).toBeNull();
    });

    test('vyöhykkeen vasen puoli = slopy, oikea = crimpy', () => {
      expect(holdTypeFromXCentered(0, W, N)).toBe('slopy');
      expect(holdTypeFromXCentered(107, W, N)).toBe('slopy');
      expect(holdTypeFromXCentered(193, W, N)).toBe('crimpy');
      expect(holdTypeFromXCentered(300, W, N)).toBe('crimpy');
    });

    test('rajat leikataan ja nolla-leveys = null', () => {
      expect(holdTypeFromXCentered(-50, W, N)).toBe('slopy');
      expect(holdTypeFromXCentered(W + 50, W, N)).toBe('crimpy');
      expect(holdTypeFromXCentered(50, 0, N)).toBeNull();
    });
  });

  describe('steepnessFromDy', () => {
    const T = 40;

    test('riittävä ylösliuku = slab', () => {
      expect(steepnessFromDy(-40, T)).toBe('slab');
      expect(steepnessFromDy(-100, T)).toBe('slab');
    });

    test('riittävä alasliuku = overhang', () => {
      expect(steepnessFromDy(40, T)).toBe('overhang');
      expect(steepnessFromDy(100, T)).toBe('overhang');
    });

    test('kynnyksen alittava liuku (myös napautus) = null', () => {
      expect(steepnessFromDy(0, T)).toBeNull();
      expect(steepnessFromDy(-39, T)).toBeNull();
      expect(steepnessFromDy(39, T)).toBeNull();
    });
  });
});
