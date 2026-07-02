import { formatDurationMmSs } from './dates';

describe('formatDurationMmSs', () => {
  test('alle tunnin: M:SS', () => {
    expect(formatDurationMmSs(0)).toBe('0:00');
    expect(formatDurationMmSs(5)).toBe('0:05');
    expect(formatDurationMmSs(65)).toBe('1:05');
    expect(formatDurationMmSs(600)).toBe('10:00');
    expect(formatDurationMmSs(3599)).toBe('59:59');
  });

  test('tunti tai yli: H:MM:SS', () => {
    expect(formatDurationMmSs(3600)).toBe('1:00:00');
    expect(formatDurationMmSs(3661)).toBe('1:01:01');
  });

  test('negatiivinen leikataan nollaan; desimaalit floorataan', () => {
    expect(formatDurationMmSs(-5)).toBe('0:00');
    expect(formatDurationMmSs(65.9)).toBe('1:05');
  });
});
