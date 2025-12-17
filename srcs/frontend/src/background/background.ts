import { BackgroundStarfield } from './BackgroundStarfield.js';
import { setCurrentHoverColor } from './config.js';

// Maintains reference to the single background instance for global control and performance management
let backgroundInstance: BackgroundStarfield | null = null;

// Sets up background starfield and exposes control functions globally for cross-module access
window.addEventListener('DOMContentLoaded', () =>
{
    backgroundInstance = new BackgroundStarfield('background');
    
    // Throttle mode reduces animation frame rate during gameplay to preserve performance for game logic
    window.setBackgroundThrottle = (enabled: boolean) =>
    {
        if (backgroundInstance)
            backgroundInstance.setThrottleMode(enabled);
    };
    
    window.isBackgroundThrottled = () =>
    {
        return backgroundInstance ? backgroundInstance.isThrottled() : false;
    };
    
    // Pause and resume allow complete animation control during game states or transitions
    window.pauseBackground = () =>
    {
        if (backgroundInstance)
            backgroundInstance.pause();
    };
    
    window.resumeBackground = () =>
    {
        if (backgroundInstance)
            backgroundInstance.resume();
    };
});

// Updates the hover color effect applied to stars for visual feedback on UI interactions
export function setStarsHoverColor(color: string | null): void
{
    setCurrentHoverColor(color);
}

// Enables or disables throttle mode for background animation performance tuning
export function setBackgroundThrottle(enabled: boolean): void
{
    if (backgroundInstance)
        backgroundInstance.setThrottleMode(enabled);
}

// Checks current throttle state to determine if background is running at reduced frame rate
export function isBackgroundThrottled(): boolean
{
    return backgroundInstance ? backgroundInstance.isThrottled() : false;
}

// Converts AI difficulty level to corresponding RGB color value for visual difficulty indicators
export function getColorRgb(difficulty: 'easy' | 'medium' | 'hard'): string
{
    switch (difficulty)
    {
        case 'easy':
            return '74, 222, 128';
        case 'medium':
            return '251, 191, 36';
        case 'hard':
            return '248, 113, 113';
        default:
            return '255, 255, 255';
    }
}