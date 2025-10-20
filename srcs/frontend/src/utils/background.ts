import { hideAllPages, show } from '../pages/utils.js';

// Configuration globale
const BASE_STAR_COUNT = 2000; // Nombre de référence pour une fenêtre de taille standard
const REFERENCE_SCREEN_AREA = 1920 * 1080; // Taille de référence (Full HD)
const STAR_SIZE_RANGE: [number, number] = [0.5, 3];
const STAR_OPACITY_RANGE: [number, number] = [0.1, 2];

const BACKGROUND_SCALE = 2;

// Configuration pour la coloration des étoiles au hover
let currentHoverColor: string | null = null;
let coloredStarsRatio = 0.5; // Proportion d'étoiles qui changent de couleur

let ATTRACTION_RADIUS = 25; // valeur dynamique
const ATTRACTION_RADIUS_INITIAL = 50;
const ATTRACTION_RADIUS_MAX = 4000;
const ATTRACTION_RADIUS_EXP_FACTOR = 1.002; // facteur exponentiel (>1 pour croître)
let lastMouseMoveTime = Date.now();
const INACTIVITY_THRESHOLD = 2000; // ms avant d'augmenter

const EASE = 0.1;

// Configuration des étoiles filantes
const SHOOTING_STAR_COUNT = 3; // nombre maximum d'étoiles filantes simultanées
// const SHOOTING_STAR_SPAWN_RATE = 0; // probabilité de spawn par frame
const SHOOTING_STAR_SPAWN_RATE = 0.003; // probabilité de spawn par frame
const SHOOTING_STAR_SPEED_RANGE: [number, number] = [3, 8];
const SHOOTING_STAR_LENGTH_RANGE: [number, number] = [50, 150];
const SHOOTING_STAR_OPACITY = 0.8;
const SHOOTING_STAR_FADE_RATE = 0.02;
const SHOOTING_STAR_GRAVITY_RADIUS = 150; // rayon d'attraction pour les étoiles filantes
const SHOOTING_STAR_GRAVITY_STRENGTH_MAX = 0.3; // force d'attraction maximale (quand très proche)
const SHOOTING_STAR_GRAVITY_STRENGTH_MIN = 0.05; // force d'attraction minimale (à la limite du rayon)

const PLANET_COUNT = 2; // nombre maximum de planètes simultanées
const PLANET_SIZE_RANGE: [number, number] = [50, 100]; // taille aléatoire (px)
const PLANET_SPEED_RANGE: [number, number] = [1.5, 4.0]; // vitesse de traversée
const PLANET_ROTATION_SPEED_RANGE: [number, number] = [0.001, 0.02]; // vitesse de rotation
const PLANET_SPAWN_RATE = 0.002; // probabilité de spawn par frame (même logique que shooting stars)
const PLANET_SIZE_PULSE_SPEED: number = 0.005; // vitesse de pulsation de la taille (petit pulse)
const PLANET_OPACITY = 0.9; // opacité de base
const PLANET_SHRINK_FACTOR = 0.5;

// Configuration du trou noir
const BLACK_HOLE_SIZE = 15; // taille réduite
// const BLACK_HOLE_SIZE = 0; // taille réduite
const BLACK_HOLE_SPEED = 0.0005; // vitesse la plus lente des étoiles
const BLACK_HOLE_MIN_DISTANCE = 200; // distance minimale du centre
const BLACK_HOLE_MAX_DISTANCE = 500; // distance maximale du centre
const BLACK_HOLE_RING_STARS = 200; // nombre d'étoiles dans l'anneau
// const BLACK_HOLE_RING_STARS = 0; // nombre d'étoiles dans l'anneau
const BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER = 2; // multiplicateur pour le rayon minimum (taille * 2)
const BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER = 3.5; // multiplicateur pour le rayon maximum (taille * 6)
const BLACK_HOLE_RING_SPEED = 0.02; // vitesse de rotation de l'anneau
const BLACK_HOLE_RING_TRAIL_LENGTH = 10; // longueur de la traînée des étoiles de l'anneau

// Configuration de l'easter egg
const COLLAPSE_DETECTION_RADIUS = 25; // Distance pour détecter la collision avec le trou noir
const COLLAPSE_RING_DURATION = 120; // Durée d'absorption des étoiles de l'anneau (frames)
const COLLAPSE_STARS_DURATION = 300; // Durée d'absorption des étoiles du background (frames)
const COLLAPSE_SHOOTING_STARS_DURATION = 180; // Durée d'absorption des étoiles filantes (frames)
const COLLAPSE_FINAL_DURATION = 180; // Durée avant le reset (frames)
const COLLAPSE_WAIT_DURATION = 240; // Durée d'attente après l'aspiration avant le reset (frames) ~4 secondes
const RESET_DURATION = 100; // Durée de la régénération des étoiles (frames)

// Configuration du long clic pour retour au menu
const LONG_PRESS_DURATION = 1500; // Durée du long clic en ms
const RING_RADIUS = 15; // Rayon de l'anneau de chargement

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

// Fonction pour calculer le nombre d'étoiles adaptatif
function calculateStarCount(canvasWidth: number, canvasHeight: number): number {
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

// États modifiés pour inclure le reset
enum CollapseState {
  NORMAL,
  RING_COLLAPSE,
  STARS_COLLAPSE,
  SHOOTING_STARS_COLLAPSE,
  FINAL_COLLAPSE,
  WAITING, // État d'attente avant le reset
  RESETTING, // État pour la régénération
  RESET_COMPLETE // État final - plus d'actions possibles
}

class Star {
  angle: number;
  distance: number;
  size: number;
  opacity: number;
  speed: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  attractionTimer: number = 0;
  isCollapsingToBlackHole: boolean = false;
  collapseStartTime: number = 0;
  originalOpacity: number; // Sauvegarder l'opacité originale
  originalSize: number; // Sauvegarder la taille originale
  
  // Nouvelles propriétés pour le reset
  isResetting: boolean = false;
  resetStartTime: number = 0;
  resetStartX: number = 0;
  resetStartY: number = 0;
  originalAngle: number;
  originalDistance: number;
  shouldChangeColor: boolean; // Détermine si cette étoile doit changer de couleur
  
  // Propriétés pour l'effet d'explosion du reset
  explosionAngle: number = 0;
  explosionSpeed: number = 0;

  constructor(private centerX: number, private centerY: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.distance = Math.pow(Math.random(), 0.5) * (centerX * BACKGROUND_SCALE);
    this.size = Math.random() * (STAR_SIZE_RANGE[1] - STAR_SIZE_RANGE[0]) + STAR_SIZE_RANGE[0];
    this.opacity = Math.random() * (STAR_OPACITY_RANGE[1] - STAR_OPACITY_RANGE[0]) + STAR_OPACITY_RANGE[0];
    this.originalOpacity = this.opacity; // Sauvegarder l'opacité originale
    this.originalSize = this.size; // Sauvegarder la taille originale
    this.speed = 0.0005 + Math.random() * 0.001;
    
    // Sauvegarder les propriétés originales pour le reset
    this.originalAngle = this.angle;
    this.originalDistance = this.distance;
    
    // Déterminer aléatoirement si cette étoile doit changer de couleur
    this.shouldChangeColor = Math.random() < coloredStarsRatio;

    // Initial position
    this.x = this.centerX + Math.cos(this.angle) * this.distance;
    this.y = this.centerY + Math.sin(this.angle) * this.distance;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  startCollapseToBlackHole(blackHoleX: number, blackHoleY: number, delay: number = 0): void {
    this.isCollapsingToBlackHole = true;
    this.collapseStartTime = Date.now() + delay;
    this.targetX = blackHoleX;
    this.targetY = blackHoleY;
  }

  startReset(blackHoleX: number, blackHoleY: number, delay: number = 0): void {
    this.isResetting = true;
    this.isCollapsingToBlackHole = false;
    this.resetStartTime = Date.now() + delay;
    this.resetStartX = blackHoleX;
    this.resetStartY = blackHoleY;
    this.x = blackHoleX;
    this.y = blackHoleY;
    this.opacity = 0;
    this.size = this.originalSize * 0.2; // Commencer petit
    
    // Recalculer la position finale basée sur les propriétés originales
    this.targetX = this.centerX + Math.cos(this.originalAngle) * this.originalDistance;
    this.targetY = this.centerY + Math.sin(this.originalAngle) * this.originalDistance;
  }

  update(blackHoleX?: number, blackHoleY?: number): void {
    if (this.isResetting) {
      const currentTime = Date.now();
      if (currentTime >= this.resetStartTime) {
        // Animation de reset depuis le trou noir vers la position originale
        const resetProgress = Math.min((currentTime - this.resetStartTime) / (RESET_DURATION * 16.67), 1);
        const easeProgress = 1 - Math.pow(1 - resetProgress, 3); // Ease out cubic
        
        // Interpolation de position
        this.x = this.resetStartX + (this.targetX - this.resetStartX) * easeProgress;
        this.y = this.resetStartY + (this.targetY - this.resetStartY) * easeProgress;
        
        // Restauration progressive de l'opacité
        this.opacity = this.originalOpacity * easeProgress;
        
        // Restauration progressive de la taille
        this.size = this.originalSize * 0.2 + (this.originalSize * 0.8) * easeProgress;
        
        // Restauration progressive de l'angle et distance pour continuer l'orbite
        this.angle = this.originalAngle;
        this.distance = this.originalDistance;
        
        if (resetProgress >= 1) {
          this.isResetting = false;
          this.attractionTimer = 0;
          this.size = this.originalSize; // S'assurer que la taille est exactement restaurée
        }
      }
      return;
    }

    // Toujours faire tourner l'angle orbital
    this.angle += this.speed;

    // Calculer la position orbitale normale
    const orbitX = this.centerX + Math.cos(this.angle) * this.distance;
    const orbitY = this.centerY + Math.sin(this.angle) * this.distance;

    // Vérifier si l'étoile est en mode collapse et si le délai est passé
    if (this.isCollapsingToBlackHole && blackHoleX !== undefined && blackHoleY !== undefined) {
      const currentTime = Date.now();
      if (currentTime >= this.collapseStartTime) {
        // Le délai est passé, attraction directe vers le trou noir
        const dx = blackHoleX - this.x;
        const dy = blackHoleY - this.y;
        const distanceToBlackHole = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceToBlackHole > 1) {
          // Se déplacer directement vers le trou noir
          const speed = 0.05;
          this.x += dx * speed;
          this.y += dy * speed;
          
          // Réduire progressivement la taille en fonction de la distance au trou noir
          // Plus on est proche, plus on est petit
          const sizeRatio = Math.max(0.2, distanceToBlackHole / 1000); // Minimum 20% de la taille
          this.size = this.originalSize * sizeRatio;
        } else {
          // Étoile au centre du trou noir - taille minimale
          this.x = blackHoleX;
          this.y = blackHoleY;
          this.size = this.originalSize * 0.2;
        }
        return; // Ne pas faire l'orbite normale
      }
      // Si le délai n'est pas encore passé, continuer l'orbite normale (pas de return)
    }

    // Comportement normal (attraction souris ou orbite)
    if (this.attractionTimer > 0) {
      // Attirée vers la souris
      this.x += (this.targetX - this.x) * (EASE * 0.5);
      this.y += (this.targetY - this.y) * (EASE * 0.5);
      this.attractionTimer -= 16; // ~frame time
    } else {
      // Retour à l'orbite normale
      this.targetX = orbitX;
      this.targetY = orbitY;
      this.x += (this.targetX - this.x) * EASE;
      this.y += (this.targetY - this.y) * EASE;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Ne pas dessiner si en reset et pas encore visible
    if (this.isResetting && this.opacity <= 0) return;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    
    // Utiliser la couleur du hover si applicable, sinon blanc
    let color = '255, 255, 255';
    if (currentHoverColor && this.shouldChangeColor) {
      color = currentHoverColor;
    }
    
    // Utiliser l'opacité originale quand pas en reset
    const displayOpacity = this.isResetting ? this.opacity : this.originalOpacity;
    ctx.fillStyle = `rgba(${color}, ${displayOpacity})`;
    ctx.fill();
  }
}

class BlackHole {
  angle: number;
  distance: number;
  x: number;
  y: number;
  ringStars: { 
    angle: number; 
    radius: number; 
    opacity: number; 
    speed: number;
    trail: { x: number; y: number; opacity: number }[];
    isCollapsing: boolean;
    collapseStartTime: number;
  }[] = [];
  collapseState: CollapseState = CollapseState.NORMAL;
  collapseTimer: number = 0;
  isVisible: boolean = true;
  blackHoleOpacity: number = 1;
  finalBlackHoleX: number = 0; // Position finale du trou noir pour le reset
  finalBlackHoleY: number = 0;

  constructor(private centerX: number, private centerY: number) {
    this.angle = Math.random() * Math.PI * 2;
    // Distance entre minimum et maximum du centre
    this.distance = BLACK_HOLE_MIN_DISTANCE + 
      Math.random() * (BLACK_HOLE_MAX_DISTANCE - BLACK_HOLE_MIN_DISTANCE);
    
    // Position initiale
    this.x = this.centerX + Math.cos(this.angle) * this.distance;
    this.y = this.centerY + Math.sin(this.angle) * this.distance;
    
    // Créer les étoiles de l'anneau
    this.createRingStars();
  }

  private createRingStars(): void {
    this.ringStars = [];
    
    // Calculer les rayons en fonction de la taille du trou noir
    const minRadius = BLACK_HOLE_SIZE * BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER;
    const maxRadius = BLACK_HOLE_SIZE * BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER;
    
    for (let i = 0; i < BLACK_HOLE_RING_STARS; i++) {
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      
      // Plus proche du trou noir = plus blanc, plus loin = plus opaque
      const proximityRatio = (radius - minRadius) / (maxRadius - minRadius);
      
      const star = {
        angle: Math.random() * Math.PI * 2,
        radius: radius,
        opacity: 0.9 - proximityRatio * 0.5, // Plus proche = plus opaque (0.9 à 0.4)
        speed: BLACK_HOLE_RING_SPEED * (2 - proximityRatio), // Plus rapide quand plus proche
        trail: [] as { x: number; y: number; opacity: number }[],
        isCollapsing: false,
        collapseStartTime: 0
      };
      
      // Pré-remplir la traînée pour qu'elle soit visible dès le début
      for (let j = 0; j < BLACK_HOLE_RING_TRAIL_LENGTH; j++) {
        const trailAngle = star.angle - (j * star.speed);
        const trailX = this.x + Math.cos(trailAngle) * star.radius;
        const trailY = this.y + Math.sin(trailAngle) * star.radius;
        const fadeRatio = (BLACK_HOLE_RING_TRAIL_LENGTH - j) / BLACK_HOLE_RING_TRAIL_LENGTH;
        
        star.trail.unshift({
          x: trailX,
          y: trailY,
          opacity: star.opacity * fadeRatio * 0.5
        });
      }
      
      this.ringStars.push(star);
    }
  }

  checkShootingStarCollision(shootingStar: ShootingStar): boolean {
    const dx = shootingStar.x - this.x;
    const dy = shootingStar.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < COLLAPSE_DETECTION_RADIUS;
  }

  startCollapse(): void {
    if (this.collapseState === CollapseState.NORMAL) {
      this.collapseState = CollapseState.RING_COLLAPSE;
      this.collapseTimer = 0;
      
      // Démarrer l'effondrement des étoiles de l'anneau avec des délais aléatoires
      this.ringStars.forEach((star) => {
        star.isCollapsing = true;
        star.collapseStartTime = Date.now() + Math.random() * 1000; // Délai aléatoire jusqu'à 1 seconde
      });
    }
  }

  update(): void {
    // Gestion des états de collapse
    if (this.collapseState !== CollapseState.NORMAL) {
      this.collapseTimer++;
      
      switch (this.collapseState) {
        case CollapseState.RING_COLLAPSE:
          if (this.collapseTimer >= COLLAPSE_RING_DURATION) {
            this.collapseState = CollapseState.STARS_COLLAPSE;
            this.collapseTimer = 0;
          }
          break;
          
        case CollapseState.STARS_COLLAPSE:
          if (this.collapseTimer >= COLLAPSE_STARS_DURATION) {
            this.collapseState = CollapseState.SHOOTING_STARS_COLLAPSE;
            this.collapseTimer = 0;
          }
          break;
          
        case CollapseState.SHOOTING_STARS_COLLAPSE:
          if (this.collapseTimer >= COLLAPSE_SHOOTING_STARS_DURATION) {
            this.collapseState = CollapseState.FINAL_COLLAPSE;
            this.collapseTimer = 0;
          }
          break;
          
        case CollapseState.FINAL_COLLAPSE:
          // Le trou noir reste visible pendant cette phase
          if (this.collapseTimer >= COLLAPSE_FINAL_DURATION) {
            // Sauvegarder la position finale du trou noir
            this.finalBlackHoleX = this.x;
            this.finalBlackHoleY = this.y;
            this.collapseState = CollapseState.WAITING;
            this.collapseTimer = 0;
            // Le trou noir reste visible pendant l'attente
          }
          break;
          
        case CollapseState.WAITING:
          // Attendre 4 secondes avant de démarrer le reset
          // Le trou noir reste visible pendant toute l'attente
          if (this.collapseTimer >= COLLAPSE_WAIT_DURATION) {
            this.collapseState = CollapseState.RESETTING;
            this.collapseTimer = 0;
            this.isVisible = false;
            this.blackHoleOpacity = 0;
          }
          break;
          
        case CollapseState.RESETTING:
          // Le trou noir reste invisible et ne fait rien
          // Le reset est géré par la classe BackgroundStarfield
          break;
          
        case CollapseState.RESET_COMPLETE:
          // État final définitif - plus aucune action
          break;
      }
    }

    if (this.collapseState === CollapseState.NORMAL) {
      this.angle += BLACK_HOLE_SPEED;
      
      // Mouvement circulaire du trou noir
      const newX = this.centerX + Math.cos(this.angle) * this.distance;
      const newY = this.centerY + Math.sin(this.angle) * this.distance;
      
      // Calculer le déplacement du trou noir
      const deltaX = newX - this.x;
      const deltaY = newY - this.y;
      
      this.x = newX;
      this.y = newY;
      
      // Mettre à jour les étoiles de l'anneau normalement
      this.ringStars.forEach(star => {
        star.angle += star.speed;
        
        const starX = this.x + Math.cos(star.angle) * star.radius;
        const starY = this.y + Math.sin(star.angle) * star.radius;
        
        star.trail.forEach(point => {
          point.x += deltaX;
          point.y += deltaY;
        });
        
        star.trail.push({
          x: starX,
          y: starY,
          opacity: star.opacity
        });
        
        if (star.trail.length > BLACK_HOLE_RING_TRAIL_LENGTH) {
          star.trail.shift();
        }
        
        star.trail.forEach((point, index) => {
          const fadeRatio = (index + 1) / star.trail.length;
          point.opacity = star.opacity * fadeRatio * 0.5;
        });
      });
    } else if (this.collapseState !== CollapseState.RESETTING && this.collapseState !== CollapseState.RESET_COMPLETE) {
      // Pendant le collapse, mettre à jour les étoiles de l'anneau
      this.ringStars.forEach(star => {
        if (star.isCollapsing) {
          const currentTime = Date.now();
          if (currentTime >= star.collapseStartTime) {
            // Réduire le rayon progressivement
            star.radius = Math.max(0, star.radius - 1.5);
            // Réduire l'opacité
            star.opacity = Math.max(0, star.opacity - 0.02);
            
            // Continuer la rotation mais plus lentement
            star.angle += star.speed * 0.5;
            
            // Mettre à jour la traînée
            const starX = this.x + Math.cos(star.angle) * star.radius;
            const starY = this.y + Math.sin(star.angle) * star.radius;
            
            star.trail.push({
              x: starX,
              y: starY,
              opacity: star.opacity
            });
            
            if (star.trail.length > BLACK_HOLE_RING_TRAIL_LENGTH) {
              star.trail.shift();
            }
            
            // Faire disparaître la traînée plus rapidement
            star.trail.forEach((point, index) => {
              const fadeRatio = (index + 1) / star.trail.length;
              point.opacity = star.opacity * fadeRatio * 0.3;
            });
          }
        }
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Ne rien dessiner si le trou noir n'est pas visible
    if (!this.isVisible || this.collapseState === CollapseState.RESETTING || this.collapseState === CollapseState.RESET_COMPLETE) return;
    
    // Dessiner les traînées des étoiles de l'anneau d'abord
    this.ringStars.forEach(star => {
      if (star.trail.length < 2 || star.opacity <= 0) return;
      
      // Dessiner la traînée
      for (let i = 1; i < star.trail.length; i++) {
        const point = star.trail[i];
        const prevPoint = star.trail[i - 1];
        
        if (!point || !prevPoint || point.opacity <= 0) continue;
        
        const gradient = ctx.createLinearGradient(
          prevPoint.x, prevPoint.y,
          point.x, point.y
        );
        
        gradient.addColorStop(0, `rgba(255, 255, 255, ${prevPoint.opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, ${point.opacity})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    });
    
    // Dessiner les étoiles de l'anneau (têtes)
    this.ringStars.forEach(star => {
      if (star.opacity <= 0 || star.radius <= 0) return;
      
      const starX = this.x + Math.cos(star.angle) * star.radius;
      const starY = this.y + Math.sin(star.angle) * star.radius;
      
      ctx.beginPath();
      ctx.arc(starX, starY, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.fill();
    });
    
    // Dessiner le trou noir (corps noir avec opacité progressive)
    if (this.blackHoleOpacity > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, BLACK_HOLE_SIZE * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${this.blackHoleOpacity})`;
      ctx.fill();
    }
  }

  shouldCollapseStars(): boolean {
    return this.collapseState === CollapseState.STARS_COLLAPSE;
  }

  shouldCollapseShootingStars(): boolean {
    return this.collapseState === CollapseState.SHOOTING_STARS_COLLAPSE;
  }

  shouldReset(): boolean {
    return this.collapseState === CollapseState.RESETTING;
  }

  markResetComplete(): void {
    this.collapseState = CollapseState.RESET_COMPLETE;
  }

  getFinalPosition(): { x: number, y: number } {
    return { x: this.finalBlackHoleX, y: this.finalBlackHoleY };
  }

  isInVoidState(): boolean {
    return false; // Plus d'état void permanent
  }
}

class ShootingStar {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  length: number;
  opacity: number;
  maxOpacity: number;
  tailPoints: { x: number; y: number; opacity: number }[] = [];
  active: boolean = true;
  lifespan: number;
  age: number = 0;
  baseSpeed: number;
  isCollapsingToBlackHole: boolean = false;

  constructor(canvasWidth: number, canvasHeight: number) {
    // Spawn depuis les bords de l'écran
    const side = Math.floor(Math.random() * 4);
    const speed = Math.random() * (SHOOTING_STAR_SPEED_RANGE[1] - SHOOTING_STAR_SPEED_RANGE[0]) + SHOOTING_STAR_SPEED_RANGE[0];
    
    switch (side) {
      case 0: // Top
        this.x = Math.random() * canvasWidth;
        this.y = -50;
        this.velocityX = (Math.random() - 0.5) * speed;
        this.velocityY = speed * 0.7;
        break;
      case 1: // Right
        this.x = canvasWidth + 50;
        this.y = Math.random() * canvasHeight;
        this.velocityX = -speed * 0.7;
        this.velocityY = (Math.random() - 0.5) * speed;
        break;
      case 2: // Bottom
        this.x = Math.random() * canvasWidth;
        this.y = canvasHeight + 50;
        this.velocityX = (Math.random() - 0.5) * speed;
        this.velocityY = -speed * 0.7;
        break;
      default: // Left
        this.x = -50;
        this.y = Math.random() * canvasHeight;
        this.velocityX = speed * 0.7;
        this.velocityY = (Math.random() - 0.5) * speed;
        break;
    }

    this.length = Math.random() * (SHOOTING_STAR_LENGTH_RANGE[1] - SHOOTING_STAR_LENGTH_RANGE[0]) + SHOOTING_STAR_LENGTH_RANGE[0];
    this.maxOpacity = SHOOTING_STAR_OPACITY;
    this.opacity = 0;
    this.lifespan = 180 + Math.random() * 120;
    this.baseSpeed = speed;
  }

  startCollapseToBlackHole(_blackHoleX: number, _blackHoleY: number): void {
    this.isCollapsingToBlackHole = true;
  }

  update(canvasWidth: number, canvasHeight: number, mouseX: number, mouseY: number, blackHoleX?: number, blackHoleY?: number): void {
    this.age++;

    if (this.isCollapsingToBlackHole && blackHoleX !== undefined && blackHoleY !== undefined) {
      // Mouvement vers le trou noir
      const dx = blackHoleX - this.x;
      const dy = blackHoleY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 10) {
        this.velocityX = (dx / distance) * this.baseSpeed * 1.5;
        this.velocityY = (dy / distance) * this.baseSpeed * 1.5;
        this.x += this.velocityX;
        this.y += this.velocityY;
        
        // Faire disparaître progressivement
        this.opacity *= 0.97;
        this.maxOpacity *= 0.97;
      } else {
        // Étoile filante absorbée
        this.active = false;
        return;
      }
    } else {
      // Comportement normal
      const lifeProgress = this.age / this.lifespan;
      
      if (lifeProgress < 0.2) {
        this.opacity = (lifeProgress / 0.2) * this.maxOpacity;
      } else if (lifeProgress < 0.7) {
        this.opacity = this.maxOpacity;
      } else {
        const fadeProgress = (lifeProgress - 0.7) / 0.3;
        this.opacity = this.maxOpacity * (1 - fadeProgress);
      }

      // Calculer la distance à la souris
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const distanceToMouse = Math.sqrt(dx * dx + dy * dy);

      // Appliquer la gravité si dans le rayon d'attraction et pas en collapse
      if (!this.isCollapsingToBlackHole && distanceToMouse < SHOOTING_STAR_GRAVITY_RADIUS && distanceToMouse > 0) {
        const distanceRatio = distanceToMouse / SHOOTING_STAR_GRAVITY_RADIUS;
        const inverseDistanceRatio = 1 - distanceRatio;
        
        const gravityStrength = SHOOTING_STAR_GRAVITY_STRENGTH_MIN + 
          (SHOOTING_STAR_GRAVITY_STRENGTH_MAX - SHOOTING_STAR_GRAVITY_STRENGTH_MIN) * 
          Math.pow(inverseDistanceRatio, 2);
        
        const gravityX = (dx / distanceToMouse) * gravityStrength;
        const gravityY = (dy / distanceToMouse) * gravityStrength;
        
        this.velocityX += gravityX;
        this.velocityY += gravityY;
      }

      // Normaliser la vitesse pour maintenir la vitesse constante
      if (!this.isCollapsingToBlackHole) {
        const currentSpeed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
        if (currentSpeed > 0) {
          this.velocityX = (this.velocityX / currentSpeed) * this.baseSpeed;
          this.velocityY = (this.velocityY / currentSpeed) * this.baseSpeed;
        }
      }

      // Mettre à jour la position
      this.x += this.velocityX;
      this.y += this.velocityY;
    }

    // Ajouter un point de traînée avec l'opacité actuelle
    this.tailPoints.push({
      x: this.x,
      y: this.y,
      opacity: this.opacity
    });

    // Limiter la longueur de la traînée
    if (this.tailPoints.length > this.length / 5) {
      this.tailPoints.shift();
    }

    // Faire disparaître les points de traînée plus rapidement que l'étoile principale
    this.tailPoints.forEach(point => {
      if (point) {
        point.opacity -= SHOOTING_STAR_FADE_RATE * (this.isCollapsingToBlackHole ? 3 : 1.5);
      }
    });

    // Supprimer les points trop transparents
    this.tailPoints = this.tailPoints.filter(point => point && point.opacity > 0.01);

    // Désactiver l'étoile si elle a dépassé sa durée de vie ou si elle n'a plus de traînée visible
    if (!this.isCollapsingToBlackHole && (this.age >= this.lifespan || (this.opacity <= 0.01 && this.tailPoints.length === 0))) {
      this.active = false;
    }

    // Également désactiver si elle sort complètement de l'écran (sécurité)
    if (!this.isCollapsingToBlackHole && (this.x < -200 || this.x > canvasWidth + 200 || 
        this.y < -200 || this.y > canvasHeight + 200)) {
      this.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.tailPoints.length < 2) return;

    // Dessiner la traînée
    ctx.strokeStyle = 'rgba(255, 255, 255, 0)';
    ctx.lineWidth = 2;
    
    for (let i = 1; i < this.tailPoints.length; i++) {
      const point = this.tailPoints[i];
      const prevPoint = this.tailPoints[i - 1];
      
      if (!point || !prevPoint) continue;
      
      const gradient = ctx.createLinearGradient(
        prevPoint.x, prevPoint.y,
        point.x, point.y
      );
      
      gradient.addColorStop(0, `rgba(255, 255, 255, ${prevPoint.opacity * 0.3})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${point.opacity})`);
      
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    // Dessiner la tête de l'étoile filante
    const headPoint = this.tailPoints[this.tailPoints.length - 1];
    if (headPoint) {
      ctx.beginPath();
      ctx.arc(headPoint.x, headPoint.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${headPoint.opacity})`;
      ctx.fill();
      
      // Ajouter un petit halo
      const gradient = ctx.createRadialGradient(headPoint.x, headPoint.y, 0, headPoint.x, headPoint.y, 8);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${headPoint.opacity * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.beginPath();
      ctx.arc(headPoint.x, headPoint.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }
}

class Planet {
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  baseSize: number;
  currentSize: number;
  sizePulse: number; // Pour l'animation de taille
  opacity: number;
  image: HTMLImageElement;
  imageLoaded: boolean = false;
  isActive: boolean = false;
  // For curved path
  controlX: number = 0;
  controlY: number = 0;
  travelProgress: number = 0; // 0..1 along the bezier
  travelSpeed: number = 0; // how fast progress increases (depends on distance and speed)
  mass: number = 1; // heavier than stars
  glowColor: string = '0'; // Valeur de rotation de teinte (hue-rotate en degrés)
  
  constructor(
    private canvasWidth: number,
    private canvasHeight: number
  ) {
    // Taille aléatoire
    this.baseSize = Math.random() * (PLANET_SIZE_RANGE[1] - PLANET_SIZE_RANGE[0]) + PLANET_SIZE_RANGE[0];
    this.currentSize = this.baseSize;
    this.opacity = PLANET_OPACITY;
    this.rotation = 0;
    this.sizePulse = Math.random() * Math.PI * 2; // Phase aléatoire pour la pulsation
    
    // Couleur aléatoire pour la lueur
    this.generateRandomColor();
    
    // Rotation aléatoire
    this.rotationSpeed = Math.random() * (PLANET_ROTATION_SPEED_RANGE[1] - PLANET_ROTATION_SPEED_RANGE[0]) + PLANET_ROTATION_SPEED_RANGE[0];
    // 50% de chance d'avoir une rotation inverse
    if (Math.random() < 0.5) this.rotationSpeed *= -1;
    
    // Charger l'image de la planète
    this.image = new Image();
    this.image.src = '/img/planet.gif';
    this.image.onload = () => {
      this.imageLoaded = true;
    };
    
    // Initialisation de la trajectoire (sera définie par spawn())
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
    this.x = 0;
    this.y = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  // Générer une rotation de teinte aléatoire pour changer la couleur de l'image
  generateRandomColor(): void {
    // Valeurs de rotation de teinte prédéfinies pour des couleurs variées
    // 0° = couleur originale, 120° = vert, 240° = bleu, etc.
    const hueRotations = [
      '0',     // Couleur originale
      '30',    // Orange/Rouge
      '60',    // Jaune
      '120',   // Vert
      '180',   // Cyan
      '210',   // Bleu clair
      '240',   // Bleu
      '270',   // Violet
      '300',   // Magenta
      '330',   // Rose/Rouge
    ];
    
    // Choisir une rotation aléatoire
    const randomIndex = Math.floor(Math.random() * hueRotations.length);
    this.glowColor = hueRotations[randomIndex] || '0';
  }

  spawn(): void {
    if (!this.imageLoaded) return;
    
    this.isActive = true;
    this.opacity = PLANET_OPACITY;
    
    // Générer une nouvelle couleur aléatoire à chaque spawn
    this.generateRandomColor();
    
    // Vitesse aléatoire
    const speed = Math.random() * (PLANET_SPEED_RANGE[1] - PLANET_SPEED_RANGE[0]) + PLANET_SPEED_RANGE[0];
    
    // Choisir un bord aléatoire (0: haut, 1: droite, 2: bas, 3: gauche)
    const edge = Math.floor(Math.random() * 4);
    
    switch (edge) {
      case 0: // Haut -> Bas
        this.startX = Math.random() * this.canvasWidth;
        this.startY = -this.baseSize;
        this.endX = Math.random() * this.canvasWidth;
        this.endY = this.canvasHeight + this.baseSize;
        break;
      case 1: // Droite -> Gauche
        this.startX = this.canvasWidth + this.baseSize;
        this.startY = Math.random() * this.canvasHeight;
        this.endX = -this.baseSize;
        this.endY = Math.random() * this.canvasHeight;
        break;
      case 2: // Bas -> Haut
        this.startX = Math.random() * this.canvasWidth;
        this.startY = this.canvasHeight + this.baseSize;
        this.endX = Math.random() * this.canvasWidth;
        this.endY = -this.baseSize;
        break;
      case 3: // Gauche -> Droite
        this.startX = -this.baseSize;
        this.startY = Math.random() * this.canvasHeight;
        this.endX = this.canvasWidth + this.baseSize;
        this.endY = Math.random() * this.canvasHeight;
        break;
    }
    
    this.x = this.startX;
    this.y = this.startY;
  // Compute a control point for a curved quadratic bezier path
  // Control point near the center but jittered so trajectories vary
  const midX = (this.startX + this.endX) / 2;
  const midY = (this.startY + this.endY) / 2;
  const jitter = Math.min(this.canvasWidth, this.canvasHeight) * 0.25;
  this.controlX = midX + (Math.random() - 0.5) * jitter;
  this.controlY = midY + (Math.random() - 0.5) * jitter;

  // Travel progress speed normalized by distance so that speed approx equals 'speed' pixels/frame
  const dx = this.endX - this.startX;
  const dy = this.endY - this.startY;
  const chord = Math.sqrt(dx * dx + dy * dy);
  // approximate bezier length ~ chord + 0.25 * (distance from control to chord)
  const ctrlDist = Math.sqrt(Math.pow(this.controlX - midX, 2) + Math.pow(this.controlY - midY, 2));
  const approxLength = chord + 0.5 * ctrlDist;
  this.travelSpeed = speed / Math.max(approxLength, 1);
  this.travelProgress = 0;
  // set mass proportional to size (heavier = less affected by cursor)
  this.mass = this.baseSize / 40; // arbitrary scaling (e.g., baseSize 40 -> mass 1)
  }

  update(): void {
    if (!this.isActive) return;
    // Avancer le travel progress
    this.travelProgress += this.travelSpeed;
    if (this.travelProgress > 1) this.travelProgress = 1;

    // Quadratic Bezier interpolation
    const t = this.travelProgress;
    const oneMinusT = 1 - t;
    this.x = oneMinusT * oneMinusT * this.startX + 2 * oneMinusT * t * this.controlX + t * t * this.endX;
    this.y = oneMinusT * oneMinusT * this.startY + 2 * oneMinusT * t * this.controlY + t * t * this.endY;

    // Rotation
    this.rotation += this.rotationSpeed;

    // Shrink over the trajectory: start at baseSize and shrink towards factor
    const shrinkProgress = t; // linear along the path
    const shrinkMultiplier = 1 - (1 - PLANET_SHRINK_FACTOR) * shrinkProgress;
    // plus a small pulse
    this.sizePulse += PLANET_SIZE_PULSE_SPEED;
    const pulse = 1 + (Math.sin(this.sizePulse) * 0.5) * 0.04; // tiny pulse +-4%
    this.currentSize = this.baseSize * shrinkMultiplier * pulse;

    // If travel finished or planet outside bounds, deactivate
    if (this.travelProgress >= 1 || this.x < -this.baseSize || this.x > this.canvasWidth + this.baseSize ||
        this.y < -this.baseSize || this.y > this.canvasHeight + this.baseSize) {
      this.isActive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.isActive || !this.imageLoaded || this.opacity <= 0.01) return;
    
    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    // Appliquer la rotation
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Désactiver le lissage pour un effet pixelisé
    ctx.imageSmoothingEnabled = false;
    
    // Appliquer un filtre de couleur (teinte) à l'image de la planète
    // Format: hue-rotate pour changer la teinte de l'image
    const hueRotate = this.glowColor; // On va stocker une valeur de rotation de teinte
    ctx.filter = `hue-rotate(${hueRotate}deg) saturate(150%)`;
    
    // Dessiner l'image de la planète avec le filtre de couleur
    ctx.drawImage(
      this.image,
      -this.currentSize / 2,
      -this.currentSize / 2,
      this.currentSize,
      this.currentSize
    );
    
    ctx.restore();
  }
}

class BackgroundStarfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private shootingStars: ShootingStar[] = [];
  private blackHole: BlackHole | null = null;
  private planets: Planet[] = []; // Tableau de planètes
  private animationFrameId: number | null = null;
  private hasResetStarted: boolean = false; // Pour s'assurer que le reset ne se lance qu'une fois
  private currentStarCount: number = 0; // Suivre le nombre actuel d'étoiles
  
  // Propriétés pour le long clic
  private isLongPressing: boolean = false;
  private longPressStartTime: number = 0;
  private longPressX: number = 0;
  private longPressY: number = 0;
  private longPressProgress: number = 0;

  constructor(canvasId: string) {
    const canvasElement = document.getElementById(canvasId);
    if (!(canvasElement instanceof HTMLCanvasElement)) {
      throw new Error(`L'élément avec l'ID ${canvasId} n'est pas un canvas HTML`);
    }

    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Impossible d\'obtenir le contexte 2D');
    this.ctx = context;

    this.init();
  }

  private init(): void {
    this.setupCanvasStyle();
    this.resizeCanvas();
    this.createStars();
    this.setupEventListeners();
    this.animate();
  }

  private setupCanvasStyle(): void {
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '0';
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    const newStarCount = calculateStarCount(this.canvas.width, this.canvas.height);
    
    // Recréer les étoiles seulement si le nombre a changé et qu'on n'est pas en cours de reset
    if (newStarCount !== this.currentStarCount && 
        (!this.blackHole || (!this.blackHole.shouldReset() && !this.hasResetStarted))) {
      this.createStars();
    }
  }

  private createStars(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.currentStarCount = calculateStarCount(this.canvas.width, this.canvas.height);

    this.stars = Array.from({ length: this.currentStarCount }, () =>
      new Star(centerX, centerY)
    );
    
    // Créer le trou noir seulement la première fois
    if (!this.blackHole) {
      this.blackHole = new BlackHole(centerX, centerY);
    }
    
    // Initialiser le pool de planètes (comme les shooting stars, max PLANET_COUNT simultanées)
    // On crée un pool de PLANET_COUNT * 2 pour avoir des objets réutilisables
    if (this.planets.length === 0) {
      for (let i = 0; i < PLANET_COUNT * 2; i++) {
        const planet = new Planet(this.canvas.width, this.canvas.height);
        this.planets.push(planet);
      }
    }
  }

  private spawnPlanet(): void {
    // Compter le nombre de planètes actives
    const activePlanetsCount = this.planets.filter(p => p.isActive).length;
    
    // Même logique que les étoiles filantes : spawn si en dessous de la limite et probabilité
    if (activePlanetsCount < PLANET_COUNT && Math.random() < PLANET_SPAWN_RATE) {
      // Trouver une planète inactive
      const inactivePlanet = this.planets.find(p => !p.isActive);
      if (inactivePlanet) {
        inactivePlanet.spawn();
      }
    }
  }

  private updatePlanets(): void {
    this.planets.forEach(planet => {
      planet.update();
    });
  }

  private spawnShootingStar(): void {
    if (this.shootingStars.length < SHOOTING_STAR_COUNT && Math.random() < SHOOTING_STAR_SPAWN_RATE) {
      this.shootingStars.push(new ShootingStar(this.canvas.width, this.canvas.height));
    }
  }

  private updateShootingStars(): void {
    this.shootingStars.forEach(shootingStar => {
      // Vérifier les collisions avec le trou noir seulement s'il est visible
      if (this.blackHole && this.blackHole.isVisible && this.blackHole.checkShootingStarCollision(shootingStar)) {
        this.blackHole.startCollapse();
        shootingStar.active = false; // Absorber immédiatement l'étoile qui a touché le trou noir
        return;
      }

      // Si le trou noir demande l'effondrement des étoiles filantes
      if (this.blackHole && this.blackHole.shouldCollapseShootingStars() && !shootingStar.isCollapsingToBlackHole) {
        shootingStar.startCollapseToBlackHole(this.blackHole.x, this.blackHole.y);
      }

      shootingStar.update(
        this.canvas.width, 
        this.canvas.height, 
        mouseX, 
        mouseY,
        this.blackHole?.x,
        this.blackHole?.y
      );
    });

    // Supprimer les étoiles filantes inactives
    this.shootingStars = this.shootingStars.filter(shootingStar => shootingStar.active);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      ATTRACTION_RADIUS = ATTRACTION_RADIUS_INITIAL; // reset radius
      lastMouseMoveTime = Date.now();
      
      // Annuler le long clic si la souris bouge
      if (this.isLongPressing) {
        this.cancelLongPress();
      }
    });

    window.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      mouseX = touch.clientX;
      mouseY = touch.clientY;
      ATTRACTION_RADIUS = ATTRACTION_RADIUS_INITIAL;
      lastMouseMoveTime = Date.now();
      
      // Annuler le long clic si le doigt bouge
      if (this.isLongPressing) {
        this.cancelLongPress();
      }
    });

    // Événements pour le long clic sur le canvas
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isOnMainMenu()) {
        this.startLongPress(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.cancelLongPress();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.cancelLongPress();
    });

    // Support tactile
    this.canvas.addEventListener('touchstart', (e) => {
      if (this.isOnMainMenu()) {
        const touch = e.touches[0];
        if (touch) {
          this.startLongPress(touch.clientX, touch.clientY);
        }
      }
    });

    this.canvas.addEventListener('touchend', () => {
      this.cancelLongPress();
    });

    this.canvas.addEventListener('touchcancel', () => {
      this.cancelLongPress();
    });
  }

  private isOnMainMenu(): boolean {
    const mainMenuElement = document.getElementById('mainMenu');
    return mainMenuElement !== null && mainMenuElement.innerHTML.trim() !== '';
  }

  private startLongPress(x: number, y: number): void {
    this.isLongPressing = true;
    this.longPressStartTime = Date.now();
    this.longPressX = x;
    this.longPressY = y;
    this.longPressProgress = 0;
  }

  private cancelLongPress(): void {
    this.isLongPressing = false;
    this.longPressProgress = 0;
  }

  private updateLongPress(): void {
    if (!this.isLongPressing) return;

    const elapsed = Date.now() - this.longPressStartTime;
    this.longPressProgress = Math.min(elapsed / LONG_PRESS_DURATION, 1);

    if (this.longPressProgress >= 1) {
      // Long clic complété - retour au menu principal
      this.triggerBackToMainMenu();
    }
  }

  private triggerBackToMainMenu(): void {
    this.cancelLongPress();
    
    // Utiliser les fonctions de spa.ts
    hideAllPages();
    show('goToMain');
  }

  private drawLongPressRing(): void {
    if (!this.isLongPressing || this.longPressProgress === 0) return;

    const ctx = this.ctx;
    const centerX = this.longPressX;
    const centerY = this.longPressY;
    const radius = RING_RADIUS;
    const lineWidth = 4;

    // Dessiner l'anneau de fond (gris clair)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Dessiner l'anneau de progression (gris foncé)
    const startAngle = -Math.PI / 2; // Commencer en haut
    const endAngle = startAngle + (Math.PI * 2 * this.longPressProgress);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(169, 169, 169, 0.8)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  private attractStars(): void {
    this.stars.forEach(star => {
      const dx = star.x - mouseX;
      const dy = star.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      ATTRACTION_RADIUS = ATTRACTION_RADIUS_INITIAL; // Delete for blackhole

      if (distance < ATTRACTION_RADIUS && !star.isCollapsingToBlackHole && !star.isResetting) {
        star.targetX = mouseX;
        star.targetY = mouseY;
        star.attractionTimer = 500; // ms
      }
    });
  }

  private handleReset(): void {
    if (this.blackHole && this.blackHole.shouldReset() && !this.hasResetStarted) {
      this.hasResetStarted = true;
      const finalPosition = this.blackHole.getFinalPosition();
      
      // Démarrer le reset de toutes les étoiles avec des délais échelonnés
      this.stars.forEach((star, index) => {
        const delay = index * 2; // Délai progressif pour un effet de vague
        star.startReset(finalPosition.x, finalPosition.y, delay);
      });
      
      // Recréer progressivement les étoiles filantes
      setTimeout(() => {
        this.shootingStars = []; // Vider les étoiles filantes existantes
      }, 1000);
      
      // Marquer définitivement la fin du reset
      setTimeout(() => {
        this.hasResetStarted = false;
        // Marquer le trou noir comme complètement terminé pour éviter les re-déclenchements
        if (this.blackHole) {
          this.blackHole.markResetComplete();
        }
      }, RESET_DURATION * 16.67 + 2000);
    }
  }

  private draw(): void {
    // Effacer le canvas - toujours noir
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Gérer le reset si nécessaire
    this.handleReset();

    // Vérifier temps d'inactivité et augmenter exponentiellement le radius
    const now = Date.now();
    if (now - lastMouseMoveTime > INACTIVITY_THRESHOLD) {
      if (ATTRACTION_RADIUS < ATTRACTION_RADIUS_MAX) {
        ATTRACTION_RADIUS *= ATTRACTION_RADIUS_EXP_FACTOR;
        if (ATTRACTION_RADIUS > ATTRACTION_RADIUS_MAX) {
          ATTRACTION_RADIUS = ATTRACTION_RADIUS_MAX;
        }
      }
    }

    // Appliquer l'attraction normale si pas en mode collapse ou reset
    if (!this.blackHole || (!this.blackHole.shouldCollapseStars() && !this.blackHole.shouldReset())) {
      this.attractStars();
    }

    // Démarrer l'effondrement des étoiles du background si demandé
    if (this.blackHole && this.blackHole.shouldCollapseStars()) {
      this.stars.forEach((star) => {
        if (!star.isCollapsingToBlackHole && !star.isResetting) {
          // Ajouter un délai basé sur la distance au trou noir pour un effet de vague
          const dx = star.x - this.blackHole!.x;
          const dy = star.y - this.blackHole!.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const delay = (distance / 10) * 50; // Plus loin = plus de délai
          
          star.startCollapseToBlackHole(this.blackHole!.x, this.blackHole!.y, delay);
        }
      });
    }

    // Mettre à jour et dessiner chaque étoile
    this.stars.forEach(star => {
      star.update(this.blackHole?.x, this.blackHole?.y);
      star.draw(this.ctx);
    });

    // Gérer les étoiles filantes - ne plus en créer si le trou noir est en collapse ou reset
    if (!this.blackHole || (this.blackHole.collapseState === CollapseState.NORMAL)) {
      this.spawnShootingStar();
    }
    this.updateShootingStars();
    
    // Mettre à jour et dessiner le trou noir (s'il est visible)
    if (this.blackHole) {
      this.blackHole.update();
      this.blackHole.draw(this.ctx);
    }
    
    // Dessiner les étoiles filantes
    this.shootingStars.forEach(shootingStar => {
      shootingStar.draw(this.ctx);
    });

    // Gérer les planètes APRÈS le trou noir pour qu'elles soient au-dessus
    this.spawnPlanet(); // Tenter de faire apparaître une nouvelle planète
    this.updatePlanets(); // Mettre à jour toutes les planètes
    this.planets.forEach(planet => {
      planet.draw(this.ctx);
    });

    // Mettre à jour et dessiner l'anneau de long clic
    this.updateLongPress();
    this.drawLongPressRing();
  }

  private animate(): void {
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.resizeCanvas.bind(this));
  }
}

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
  new BackgroundStarfield('background');
});

// Fonctions export pour contrôler la couleur des étoiles
export function setStarsHoverColor(color: string | null): void {
  currentHoverColor = color;
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