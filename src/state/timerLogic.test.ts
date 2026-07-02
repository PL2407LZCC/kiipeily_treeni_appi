import {
  applyClear,
  applyLog,
  applyStart,
  applyStartClimb,
  INITIAL_TIMER,
  type TimerState,
} from './timerLogic';

const T0 = 1_000_000; // kiinteä epoch-ms testeihin

describe('timerLogic', () => {
  describe('applyStart', () => {
    test('simple: lepokello käyntiin heti (resting, anchor=now)', () => {
      expect(applyStart('simple', T0)).toEqual({
        enabled: true,
        mode: 'simple',
        phase: 'resting',
        anchorAt: T0,
        lastClimbSec: null,
      });
    });

    test('complex: idle, ei anchoria', () => {
      expect(applyStart('complex', T0)).toEqual({
        enabled: true,
        mode: 'complex',
        phase: 'idle',
        anchorAt: null,
        lastClimbSec: null,
      });
    });
  });

  describe('applyStartClimb', () => {
    test('complex: käynnistää nousun mistä tahansa vaiheesta', () => {
      const s = applyStart('complex', T0);
      expect(applyStartClimb(s, T0 + 5000)).toEqual({ phase: 'climbing', anchorAt: T0 + 5000 });
      const resting: TimerState = { ...s, phase: 'resting', anchorAt: T0 };
      expect(applyStartClimb(resting, T0 + 9000)).toEqual({ phase: 'climbing', anchorAt: T0 + 9000 });
    });

    test('simple / disabled: ei vaikutusta', () => {
      expect(applyStartClimb(applyStart('simple', T0), T0 + 1000)).toEqual({});
      expect(applyStartClimb(INITIAL_TIMER, T0 + 1000)).toEqual({});
    });
  });

  describe('applyLog', () => {
    test('disabled: no-op', () => {
      expect(applyLog(INITIAL_TIMER, 0, T0)).toEqual({});
    });

    test('simple: nollaa vain anchorin (pysyy resting)', () => {
      const s = applyStart('simple', T0);
      expect(applyLog(s, 5, T0 + 30_000)).toEqual({ anchorAt: T0 + 30_000 });
    });

    test('complex kiipeillessä: mittaa keston, vähentää subtractin, aloittaa palautumisen', () => {
      const climbing = applyStartClimb(applyStart('complex', T0), T0);
      const state: TimerState = { ...applyStart('complex', T0), ...climbing } as TimerState;
      // 8 s nousu, subtract 5 → 3 s
      expect(applyLog(state, 5, T0 + 8000)).toEqual({
        lastClimbSec: 3,
        phase: 'resting',
        anchorAt: T0 + 8000,
      });
    });

    test('complex: kesto leikataan nollaan kun subtract >= kulunut', () => {
      const state = { ...applyStart('complex', T0), phase: 'climbing', anchorAt: T0 } as TimerState;
      expect(applyLog(state, 5, T0 + 2000)).toEqual({
        lastClimbSec: 0,
        phase: 'resting',
        anchorAt: T0 + 2000,
      });
    });

    test('complex idle/resting: aloittaa palautumisen mittaamatta nousua (lastClimbSec ennallaan)', () => {
      const idle = applyStart('complex', T0);
      expect(applyLog(idle, 5, T0 + 1000)).toEqual({ phase: 'resting', anchorAt: T0 + 1000 });

      const resting = { ...idle, phase: 'resting', anchorAt: T0, lastClimbSec: 42 } as TimerState;
      expect(applyLog(resting, 5, T0 + 3000)).toEqual({ phase: 'resting', anchorAt: T0 + 3000 });
    });

    test('nopea tuplakirjaus: vain ensimmäinen (kiipeillessä) mittaa', () => {
      let state = { ...applyStart('complex', T0), phase: 'climbing', anchorAt: T0 } as TimerState;
      const first = applyLog(state, 0, T0 + 10_000);
      expect(first.lastClimbSec).toBe(10);
      state = { ...state, ...first } as TimerState; // nyt resting
      const second = applyLog(state, 0, T0 + 10_100);
      expect(second).toEqual({ phase: 'resting', anchorAt: T0 + 10_100 }); // ei uutta mittausta
    });
  });

  test('applyClear palauttaa alkutilan', () => {
    expect(applyClear()).toEqual(INITIAL_TIMER);
  });
});
