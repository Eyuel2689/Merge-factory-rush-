import confetti, { type Options } from 'canvas-confetti';

export function triggerConfetti(options?: Options): void {
  try {
    confetti(options);
  } catch {
    // Ignore canvas/WebGL allocation failures on constrained WebViews
  }
}
