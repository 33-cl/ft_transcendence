// Stub for light build (no background animations)
// This file replaces background.ts when building without the background

export function setStarsHoverColor(_color: string | null): void {
  // No-op in light mode
}

export function getColorRgb(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return '74, 222, 128'; // green-400
    case 'medium':
      return '251, 191, 36'; // yellow-400
    case 'hard':
      return '248, 113, 113'; // red-400
    default:
      return '255, 255, 255'; // white
  }
}
