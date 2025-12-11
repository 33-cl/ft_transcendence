// Main background entry point
import { BackgroundStarfield } from './BackgroundStarfield.js';
import { setCurrentHoverColor } from './config.js';

// Store reference to background instance for control
let backgroundInstance: BackgroundStarfield | null = null;

// Initialize background starfield on DOM load
window.addEventListener('DOMContentLoaded', () => {
  backgroundInstance = new BackgroundStarfield('background');
  
  // Expose throttle mode globally for game performance optimization
  window.setBackgroundThrottle = (enabled: boolean) => {
    if (backgroundInstance) backgroundInstance.setThrottleMode(enabled);
  };
  window.isBackgroundThrottled = () => {
    return backgroundInstance ? backgroundInstance.isThrottled() : false;
  };
  
  // Expose pause/resume globally for game
  window.pauseBackground = () => {
    if (backgroundInstance) backgroundInstance.pause();
  };
  window.resumeBackground = () => {
    if (backgroundInstance) backgroundInstance.resume();
  };
});

// Export functions to control star color
export function setStarsHoverColor(color: string | null): void {
  setCurrentHoverColor(color);
}

// Export function for throttle mode
export function setBackgroundThrottle(enabled: boolean): void {
  if (backgroundInstance) backgroundInstance.setThrottleMode(enabled);
}

export function isBackgroundThrottled(): boolean {
  return backgroundInstance ? backgroundInstance.isThrottled() : false;
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
