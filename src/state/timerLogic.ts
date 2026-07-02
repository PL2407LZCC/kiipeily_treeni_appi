/**
 * Puhtaat siirtymäfunktiot treeniajastimelle (yksikkötestattava, ei Date.now()-kutsuja).
 * Aika (`now`, epoch-ms) annetaan aina parametrina, jotta logiikka on deterministinen.
 *
 * Kaksi tilaa:
 *  - simple: yksi "Lepo"-kello joka nollautuu jokaisella kirjauksella ja jatkaa laskemista.
 *  - complex: kaksi toisensa poissulkevaa ajastinta — nousu (climbing) ja palautuminen (resting).
 *    Nousu käynnistetään painamalla; kirjaus pysäyttää nousun ja käynnistää palautumisen;
 *    palautuminen pysähtyy kun nousu käynnistetään uudelleen.
 */

export type TimerMode = 'simple' | 'complex';
export type TimerPhase = 'idle' | 'climbing' | 'resting';

export interface TimerState {
  enabled: boolean;
  mode: TimerMode;
  phase: TimerPhase;
  /** Epoch-ms jolloin nyt käynnissä oleva jakso alkoi; null = mikään ei käynnissä. */
  anchorAt: number | null;
  /** Viimeisimmän mitatun nousun kesto sekunteina (vain complex); null = ei vielä mitattu. */
  lastClimbSec: number | null;
}

export const INITIAL_TIMER: TimerState = {
  enabled: false,
  mode: 'simple',
  phase: 'idle',
  anchorAt: null,
  lastClimbSec: null,
};

/** Käynnistä ajastin sessiota aloitettaessa. */
export function applyStart(mode: TimerMode, now: number): TimerState {
  if (mode === 'simple') {
    // Lepokello alkaa heti session alusta (ei koskaan tyhjä ennen ensimmäistä kirjausta).
    return { enabled: true, mode, phase: 'resting', anchorAt: now, lastClimbSec: null };
  }
  return { enabled: true, mode, phase: 'idle', anchorAt: null, lastClimbSec: null };
}

/** Complex: aloita (tai käynnistä uudelleen) nousuajastin. Sallittu mistä tahansa vaiheesta. */
export function applyStartClimb(state: TimerState, now: number): Partial<TimerState> {
  if (!state.enabled || state.mode !== 'complex') return {};
  return { phase: 'climbing', anchorAt: now };
}

/**
 * Kirjaus tapahtui (send / attempt / projektin +yritys / merkitse lähetetyksi).
 *  - simple: nollaa lepokellon (anchor = now).
 *  - complex & nousu käynnissä: mittaa nousun kesto (− subtractSec, min 0), aloita palautuminen.
 *  - complex & idle/resting: aloita/uudista palautuminen mittaamatta nousua.
 */
export function applyLog(state: TimerState, subtractSec: number, now: number): Partial<TimerState> {
  if (!state.enabled) return {};
  if (state.mode === 'simple') {
    return { anchorAt: now };
  }
  if (state.phase === 'climbing' && state.anchorAt != null) {
    const dur = Math.max(0, Math.round((now - state.anchorAt) / 1000) - subtractSec);
    return { lastClimbSec: dur, phase: 'resting', anchorAt: now };
  }
  return { phase: 'resting', anchorAt: now };
}

/** Nollaa ajastin sessiota lopetettaessa. */
export function applyClear(): TimerState {
  return { ...INITIAL_TIMER };
}
