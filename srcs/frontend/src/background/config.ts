// Base star configuration determines density and visual characteristics
export const BASE_STAR_COUNT = 2000;
export const REFERENCE_SCREEN_AREA = 1920 * 1080;
export const STAR_SIZE_RANGE: [number, number] = [0.5, 3];
export const STAR_OPACITY_RANGE: [number, number] = [0.1, 2];

export const BACKGROUND_SCALE = 2;

// Hover color effect configuration for interactive star coloring on mouse movement
export let currentHoverColor: string | null = null;
export let coloredStarsRatio = 0.5;

// Dynamic attraction system that grows exponentially during mouse inactivity
export let ATTRACTION_RADIUS = 25;
export const ATTRACTION_RADIUS_INITIAL = 50;
export const ATTRACTION_RADIUS_MAX = 4000;
export const ATTRACTION_RADIUS_EXP_FACTOR = 1.002;
export let lastMouseMoveTime = Date.now();
export const INACTIVITY_THRESHOLD = 2000;

export const EASE = 0.1;

// Shooting star spawn and behavior parameters for meteor-like effects
export const SHOOTING_STAR_COUNT = 3;
export const SHOOTING_STAR_SPAWN_RATE = 0.003;
export const SHOOTING_STAR_SPEED_RANGE: [number, number] = [3, 8];
export const SHOOTING_STAR_LENGTH_RANGE: [number, number] = [50, 150];
export const SHOOTING_STAR_OPACITY = 0.8;
export const SHOOTING_STAR_FADE_RATE = 0.02;
export const SHOOTING_STAR_GRAVITY_RADIUS = 150;
export const SHOOTING_STAR_GRAVITY_STRENGTH_MAX = 0.3;
export const SHOOTING_STAR_GRAVITY_STRENGTH_MIN = 0.05;

// Planet configuration for animated celestial bodies crossing the background
export const PLANET_COUNT = 2;
export const PLANET_SIZE_RANGE: [number, number] = [50, 100];
export const PLANET_SPEED_RANGE: [number, number] = [1.5, 3];
export const PLANET_ROTATION_SPEED_RANGE: [number, number] = [0.001, 0.02];
export const PLANET_SPAWN_RATE = 0.002;
export const PLANET_SIZE_PULSE_SPEED: number = 0.005;
export const PLANET_OPACITY = 0.9;
export const PLANET_SHRINK_FACTOR = 0.5;

// Black hole appearance and orbital ring parameters
export const BLACK_HOLE_SIZE = 15;
export const BLACK_HOLE_SPEED = 0.0005;
export const BLACK_HOLE_MIN_DISTANCE = 200;
export const BLACK_HOLE_MAX_DISTANCE = 500;
export const BLACK_HOLE_RING_STARS = 200;
export const BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER = 2;
export const BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER = 3.5;
export const BLACK_HOLE_RING_SPEED = 0.02;
export const BLACK_HOLE_RING_TRAIL_LENGTH = 10;

// Easter egg collapse sequence timing controls for black hole absorption animation
export const COLLAPSE_DETECTION_RADIUS = 25;
export const COLLAPSE_RING_DURATION = 120;
export const COLLAPSE_STARS_DURATION = 300;
export const COLLAPSE_SHOOTING_STARS_DURATION = 180;
export const COLLAPSE_FINAL_DURATION = 180;
export const COLLAPSE_WAIT_DURATION = 240;
export const RESET_DURATION = 100;

// Long press gesture configuration for main menu return functionality
export const LONG_PRESS_DURATION = 1500;
export const RING_RADIUS = 15;
export const LONG_PRESS_MOVE_TOLERANCE = 10;

// Accessor functions for mutable configuration values
export function setCurrentHoverColor(color: string | null): void
{
    currentHoverColor = color;
}

export function getCurrentHoverColor(): string | null
{
    return currentHoverColor;
}

export function setAttractionRadius(value: number): void
{
    ATTRACTION_RADIUS = value;
}

export function getAttractionRadius(): number
{
    return ATTRACTION_RADIUS;
}

export function updateLastMouseMoveTime(): void
{
    lastMouseMoveTime = Date.now();
}

export function getLastMouseMoveTime(): number
{
    return lastMouseMoveTime;
}

// Calculates adaptive star count based on viewport dimensions to maintain consistent density across screen sizes
export function calculateStarCount(canvasWidth: number, canvasHeight: number): number
{
    const currentArea = canvasWidth * canvasHeight;
    const scaleFactor = currentArea / REFERENCE_SCREEN_AREA;
    
    // Square root prevents extreme variations between small and large screens
    const adjustedScaleFactor = Math.sqrt(scaleFactor);
    
    const minStars = Math.max(500, BASE_STAR_COUNT * 0.25);
    const maxStars = BASE_STAR_COUNT * 2;
    
    const calculatedStars = Math.round(BASE_STAR_COUNT * adjustedScaleFactor);
    
    return Math.max(minStars, Math.min(maxStars, calculatedStars));
}

// State machine for black hole collapse animation sequence from collision to reset
export enum CollapseState
{
    NORMAL,
    RING_COLLAPSE,
    STARS_COLLAPSE,
    SHOOTING_STARS_COLLAPSE,
    FINAL_COLLAPSE,
    WAITING,
    RESETTING,
    RESET_COMPLETE
}