/**
 * Treeniajastimen tila (zustand). Vain muistissa: nollautuu session lopetuksessa ja
 * sovelluksen uudelleenkäynnistyksessä (ei persistointia — ajastin on treeniapu, ei dataa).
 *
 * Ajat säilytetään absoluuttisina epoch-aikaleimoina (Date.now()), ei kertyvinä laskureina,
 * joten taustalle siirtyminen / JS-ajastimen throttlaus ei aiheuta driftiä — kulunut aika
 * lasketaan aina `now - anchorAt`. Siirtymälogiikka on puhtaana funktioina timerLogic.ts:ssä.
 */

import { create } from 'zustand';

import {
  applyClear,
  applyLog,
  applyStart,
  applyStartClimb,
  INITIAL_TIMER,
  type TimerMode,
  type TimerState,
} from './timerLogic';

interface TimerStore extends TimerState {
  /** Käynnistä ajastin sessiota aloitettaessa (valittu tila). */
  start: (mode: TimerMode) => void;
  /** Complex: aloita/uudista nousuajastin (painallus). */
  startClimb: () => void;
  /** Kirjaus tapahtui — reagoi tilan mukaan. */
  onLog: (subtractSec: number) => void;
  /** Nollaa ajastin (session lopetus). */
  clear: () => void;
}

export const useTimer = create<TimerStore>((set, get) => ({
  ...INITIAL_TIMER,

  start: (mode) => set(applyStart(mode, Date.now())),
  startClimb: () => set(applyStartClimb(get(), Date.now())),
  onLog: (subtractSec) => set(applyLog(get(), subtractSec, Date.now())),
  clear: () => set(applyClear()),
}));
