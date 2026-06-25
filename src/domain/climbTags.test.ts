import { holdTypeFromX, steepnessFromDy } from './climbTags';

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
