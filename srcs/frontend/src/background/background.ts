// Main background entry point
import { BackgroundStarfield } from './BackgroundStarfield.js';
import { setCurrentHoverColor } from './config.js';

// Initialize background starfield on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new BackgroundStarfield('background');
});

// Export functions to control star color
export function setStarsHoverColor(color: string | null): void {
  setCurrentHoverColor(color);
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
