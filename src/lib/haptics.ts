import * as Haptics from 'expo-haptics';

/** Kevyt napautuspalaute (turvallinen myös webissä / jos ei tuettu). */
export function tapFeedback(): void {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ohitetaan jos haptiikkaa ei tueta
  }
}

export function successFeedback(): void {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // ohitetaan
  }
}
