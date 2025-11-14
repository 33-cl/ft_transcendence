// Configuration globale pour le background animé

// Configuration des étoiles de base
export const BASE_STAR_COUNT = 2000; // Nombre de référence pour une fenêtre de taille standard
export const REFERENCE_SCREEN_AREA = 1920 * 1080; // Taille de référence (Full HD)
export const STAR_SIZE_RANGE: [number, number] = [0.5, 3];
export const STAR_OPACITY_RANGE: [number, number] = [0.1, 2];

export const BACKGROUND_SCALE = 2;

// Configuration pour la coloration des étoiles au hover
export let currentHoverColor: string | null = null;
export let coloredStarsRatio = 0.5; // Proportion d'étoiles qui changent de couleur

// Configuration de l'attraction
export let ATTRACTION_RADIUS = 25; // valeur dynamique
export const ATTRACTION_RADIUS_INITIAL = 50;
export const ATTRACTION_RADIUS_MAX = 4000;
export const ATTRACTION_RADIUS_EXP_FACTOR = 1.002; // facteur exponentiel (>1 pour croître)
export let lastMouseMoveTime = Date.now();
export const INACTIVITY_THRESHOLD = 2000; // ms avant d'augmenter

export const EASE = 0.1;

// Configuration des étoiles filantes
export const SHOOTING_STAR_COUNT = 3; // nombre maximum d'étoiles filantes simultanées
export const SHOOTING_STAR_SPAWN_RATE = 0.003; // probabilité de spawn par frame
export const SHOOTING_STAR_SPEED_RANGE: [number, number] = [3, 8];
export const SHOOTING_STAR_LENGTH_RANGE: [number, number] = [50, 150];
export const SHOOTING_STAR_OPACITY = 0.8;
export const SHOOTING_STAR_FADE_RATE = 0.02;
export const SHOOTING_STAR_GRAVITY_RADIUS = 150; // rayon d'attraction pour les étoiles filantes
export const SHOOTING_STAR_GRAVITY_STRENGTH_MAX = 0.3; // force d'attraction maximale (quand très proche)
export const SHOOTING_STAR_GRAVITY_STRENGTH_MIN = 0.05; // force d'attraction minimale (à la limite du rayon)

// Configuration des planètes
export const PLANET_COUNT = 2; // nombre maximum de planètes simultanées
export const PLANET_SIZE_RANGE: [number, number] = [50, 100]; // taille aléatoire (px)
export const PLANET_SPEED_RANGE: [number, number] = [1.5, 3]; // vitesse de traversée
export const PLANET_ROTATION_SPEED_RANGE: [number, number] = [0.001, 0.02]; // vitesse de rotation
export const PLANET_SPAWN_RATE = 0.002; // probabilité de spawn par frame (même logique que shooting stars)
export const PLANET_SIZE_PULSE_SPEED: number = 0.005; // vitesse de pulsation de la taille (petit pulse)
export const PLANET_OPACITY = 0.9; // opacité de base
export const PLANET_SHRINK_FACTOR = 0.5;

// Configuration du trou noir
export const BLACK_HOLE_SIZE = 15; // taille réduite
export const BLACK_HOLE_SPEED = 0.0005; // vitesse la plus lente des étoiles
export const BLACK_HOLE_MIN_DISTANCE = 200; // distance minimale du centre
export const BLACK_HOLE_MAX_DISTANCE = 500; // distance maximale du centre
export const BLACK_HOLE_RING_STARS = 200; // nombre d'étoiles dans l'anneau
export const BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER = 2; // multiplicateur pour le rayon minimum (taille * 2)
export const BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER = 3.5; // multiplicateur pour le rayon maximum (taille * 6)
export const BLACK_HOLE_RING_SPEED = 0.02; // vitesse de rotation de l'anneau
export const BLACK_HOLE_RING_TRAIL_LENGTH = 10; // longueur de la traînée des étoiles de l'anneau

// Configuration de l'easter egg (collapse)
export const COLLAPSE_DETECTION_RADIUS = 25; // Distance pour détecter la collision avec le trou noir
export const COLLAPSE_RING_DURATION = 120; // Durée d'absorption des étoiles de l'anneau (frames)
export const COLLAPSE_STARS_DURATION = 300; // Durée d'absorption des étoiles du background (frames)
export const COLLAPSE_SHOOTING_STARS_DURATION = 180; // Durée d'absorption des étoiles filantes (frames)
export const COLLAPSE_FINAL_DURATION = 180; // Durée avant le reset (frames)
export const COLLAPSE_WAIT_DURATION = 240; // Durée d'attente après l'aspiration avant le reset (frames) ~4 secondes
export const RESET_DURATION = 100; // Durée de la régénération des étoiles (frames)

// Configuration du long clic pour retour au menu
export const LONG_PRESS_DURATION = 1500; // Durée du long clic en ms
export const RING_RADIUS = 15; // Rayon de l'anneau de chargement
export const LONG_PRESS_MOVE_TOLERANCE = 10; // Tolérance de mouvement en pixels avant d'annuler le long clic

// Getters et setters pour les valeurs mutables
export function setCurrentHoverColor(color: string | null): void {
  currentHoverColor = color;
}

export function getCurrentHoverColor(): string | null {
  return currentHoverColor;
}

export function setAttractionRadius(value: number): void {
  ATTRACTION_RADIUS = value;
}

export function getAttractionRadius(): number {
  return ATTRACTION_RADIUS;
}

export function updateLastMouseMoveTime(): void {
  lastMouseMoveTime = Date.now();
}

export function getLastMouseMoveTime(): number {
  return lastMouseMoveTime;
}

// Fonction pour calculer le nombre d'étoiles adaptatif
export function calculateStarCount(canvasWidth: number, canvasHeight: number): number {
  const currentArea = canvasWidth * canvasHeight;
  const scaleFactor = currentArea / REFERENCE_SCREEN_AREA;
  
  // Utiliser une racine carrée pour éviter des variations trop drastiques
  const adjustedScaleFactor = Math.sqrt(scaleFactor);
  
  // Appliquer un minimum et maximum pour éviter les extrêmes
  const minStars = Math.max(500, BASE_STAR_COUNT * 0.25);
  const maxStars = BASE_STAR_COUNT * 2;
  
  const calculatedStars = Math.round(BASE_STAR_COUNT * adjustedScaleFactor);
  
  return Math.max(minStars, Math.min(maxStars, calculatedStars));
}

// États pour le collapse
export enum CollapseState {
  NORMAL,
  RING_COLLAPSE,
  STARS_COLLAPSE,
  SHOOTING_STARS_COLLAPSE,
  FINAL_COLLAPSE,
  WAITING, // État d'attente avant le reset
  RESETTING, // État pour la régénération
  RESET_COMPLETE // État final - plus d'actions possibles
}
