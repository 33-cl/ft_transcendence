// Configuration globale
const STAR_COUNT = 2000;
const STAR_SIZE_RANGE: [number, number] = [0.5, 3];
const STAR_OPACITY_RANGE: [number, number] = [0.1, 2];

const BACKGROUND_SCALE = 2;

let ATTRACTION_RADIUS = 25; // valeur dynamique
const ATTRACTION_RADIUS_INITIAL = 50;
const ATTRACTION_RADIUS_MAX = 4000;
const ATTRACTION_RADIUS_EXP_FACTOR = 1.002; // facteur exponentiel (>1 pour croître)
let lastMouseMoveTime = Date.now();
const INACTIVITY_THRESHOLD = 2000; // ms avant d'augmenter

const EASE = 0.1;

// Configuration des étoiles filantes
const SHOOTING_STAR_COUNT = 3; // nombre maximum d'étoiles filantes simultanées
const SHOOTING_STAR_SPAWN_RATE = 0.0015; // probabilité de spawn par frame
const SHOOTING_STAR_SPEED_RANGE: [number, number] = [3, 8];
const SHOOTING_STAR_LENGTH_RANGE: [number, number] = [50, 150];
const SHOOTING_STAR_OPACITY = 0.8;
const SHOOTING_STAR_FADE_RATE = 0.02;
const SHOOTING_STAR_GRAVITY_RADIUS = 150; // rayon d'attraction pour les étoiles filantes
const SHOOTING_STAR_GRAVITY_STRENGTH_MAX = 0.3; // force d'attraction maximale (quand très proche)
const SHOOTING_STAR_GRAVITY_STRENGTH_MIN = 0.05; // force d'attraction minimale (à la limite du rayon)

// Configuration du trou noir
const BLACK_HOLE_SIZE = 15; // taille réduite
const BLACK_HOLE_SPEED = 0.0005; // vitesse la plus lente des étoiles
const BLACK_HOLE_MIN_DISTANCE = 150; // distance minimale du centre
const BLACK_HOLE_MAX_DISTANCE = 600; // distance maximale du centre
const BLACK_HOLE_RING_STARS = 200; // nombre d'étoiles dans l'anneau
const BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER = 2; // multiplicateur pour le rayon minimum (taille * 2)
const BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER = 4; // multiplicateur pour le rayon maximum (taille * 6)
const BLACK_HOLE_RING_SPEED = 0.02; // vitesse de rotation de l'anneau
const BLACK_HOLE_RING_TRAIL_LENGTH = 10; // longueur de la traînée des étoiles de l'anneau

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

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

  constructor(private centerX: number, private centerY: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.distance = Math.pow(Math.random(), 0.5) * (centerX * BACKGROUND_SCALE);
    this.size = Math.random() * (STAR_SIZE_RANGE[1] - STAR_SIZE_RANGE[0]) + STAR_SIZE_RANGE[0];
    this.opacity = Math.random() * (STAR_OPACITY_RANGE[1] - STAR_OPACITY_RANGE[0]) + STAR_OPACITY_RANGE[0];
    this.speed = 0.0005 + Math.random() * 0.001;

    // Initial position
    this.x = this.centerX + Math.cos(this.angle) * this.distance;
    this.y = this.centerY + Math.sin(this.angle) * this.distance;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  update(): void {
    this.angle += this.speed;

    const orbitX = this.centerX + Math.cos(this.angle) * this.distance;
    const orbitY = this.centerY + Math.sin(this.angle) * this.distance;

    if (this.attractionTimer > 0) {
      // Attirée vers la souris plus lentement
      this.x += (this.targetX - this.x) * (EASE * 0.5);
      this.y += (this.targetY - this.y) * (EASE * 0.5);
      this.attractionTimer -= 16; // ~frame time
    } else {
      // Retour à l'orbite
      this.targetX = orbitX;
      this.targetY = orbitY;
      this.x += (this.targetX - this.x) * EASE;
      this.y += (this.targetY - this.y) * EASE;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
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
  }[] = [];

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
        trail: [] as { x: number; y: number; opacity: number }[]
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

  update(): void {
    this.angle += BLACK_HOLE_SPEED;
    
    // Mouvement circulaire du trou noir
    const newX = this.centerX + Math.cos(this.angle) * this.distance;
    const newY = this.centerY + Math.sin(this.angle) * this.distance;
    
    // Calculer le déplacement du trou noir
    const deltaX = newX - this.x;
    const deltaY = newY - this.y;
    
    this.x = newX;
    this.y = newY;
    
    // Mettre à jour les étoiles de l'anneau
    this.ringStars.forEach(star => {
      star.angle += star.speed;
      
      // Calculer la nouvelle position de l'étoile
      const starX = this.x + Math.cos(star.angle) * star.radius;
      const starY = this.y + Math.sin(star.angle) * star.radius;
      
      // Déplacer tous les points de la traînée avec le trou noir
      star.trail.forEach(point => {
        point.x += deltaX;
        point.y += deltaY;
      });
      
      // Ajouter un nouveau point à la traînée
      star.trail.push({
        x: starX,
        y: starY,
        opacity: star.opacity
      });
      
      // Limiter la longueur de la traînée
      if (star.trail.length > BLACK_HOLE_RING_TRAIL_LENGTH) {
        star.trail.shift();
      }
      
      // Recalculer l'opacité des points de traînée pour le dégradé
      star.trail.forEach((point, index) => {
        const fadeRatio = (index + 1) / star.trail.length;
        point.opacity = star.opacity * fadeRatio * 0.5;
      });
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Dessiner les traînées des étoiles de l'anneau d'abord
    this.ringStars.forEach(star => {
      if (star.trail.length < 2) return;
      
      // Dessiner la traînée
      for (let i = 1; i < star.trail.length; i++) {
        const point = star.trail[i];
        const prevPoint = star.trail[i - 1];
        
        if (!point || !prevPoint) continue;
        
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
      const starX = this.x + Math.cos(star.angle) * star.radius;
      const starY = this.y + Math.sin(star.angle) * star.radius;
      
      ctx.beginPath();
      ctx.arc(starX, starY, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.fill();
    });
    
    // Dessiner le trou noir (corps noir avec bordure blanche)
    ctx.beginPath();
    ctx.arc(this.x, this.y, BLACK_HOLE_SIZE * 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fill();
    
    // Bordure blanche
    // ctx.beginPath();
    // ctx.arc(this.x, this.y, BLACK_HOLE_SIZE, 0, Math.PI * 2);
    // ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    // ctx.lineWidth = 1;
    // ctx.stroke();
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
  baseSpeed: number; // vitesse constante à maintenir

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
    this.lifespan = 180 + Math.random() * 120; // Durée de vie entre 180 et 300 frames (~3-5 secondes à 60fps)
    this.baseSpeed = speed; // Stocker la vitesse de base
  }

  update(canvasWidth: number, canvasHeight: number, mouseX: number, mouseY: number): void {
    this.age++;
    
    // Calculer l'opacité basée sur l'âge et la durée de vie
    const lifeProgress = this.age / this.lifespan;
    
    if (lifeProgress < 0.2) {
      // Fade in rapide (20% de la durée de vie)
      this.opacity = (lifeProgress / 0.2) * this.maxOpacity;
    } else if (lifeProgress < 0.7) {
      // Opacité maximale (50% de la durée de vie)
      this.opacity = this.maxOpacity;
    } else {
      // Fade out progressif (30% de la durée de vie)
      const fadeProgress = (lifeProgress - 0.7) / 0.3;
      this.opacity = this.maxOpacity * (1 - fadeProgress);
    }

    // Calculer la distance à la souris
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const distanceToMouse = Math.sqrt(dx * dx + dy * dy);

    // Appliquer la gravité si dans le rayon d'attraction
    if (distanceToMouse < SHOOTING_STAR_GRAVITY_RADIUS && distanceToMouse > 0) {
      // Calculer la force d'attraction inversement proportionnelle à la distance
      // Plus proche = plus d'attraction (utilise une fonction inverse avec normalisation)
      const distanceRatio = distanceToMouse / SHOOTING_STAR_GRAVITY_RADIUS; // 0 à 1
      const inverseDistanceRatio = 1 - distanceRatio; // 1 à 0 (1 = très proche, 0 = loin)
      
      // Interpolation entre force min et max basée sur la proximité
      const gravityStrength = SHOOTING_STAR_GRAVITY_STRENGTH_MIN + 
        (SHOOTING_STAR_GRAVITY_STRENGTH_MAX - SHOOTING_STAR_GRAVITY_STRENGTH_MIN) * 
        Math.pow(inverseDistanceRatio, 2); // Puissance 2 pour une courbe plus prononcée
      
      // Vecteur unitaire vers la souris
      const gravityX = (dx / distanceToMouse) * gravityStrength;
      const gravityY = (dy / distanceToMouse) * gravityStrength;
      
      // Appliquer la force de gravité
      this.velocityX += gravityX;
      this.velocityY += gravityY;
    }

    // Normaliser la vitesse pour maintenir la vitesse constante
    const currentSpeed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
    if (currentSpeed > 0) {
      this.velocityX = (this.velocityX / currentSpeed) * this.baseSpeed;
      this.velocityY = (this.velocityY / currentSpeed) * this.baseSpeed;
    }

    // Mettre à jour la position
    this.x += this.velocityX;
    this.y += this.velocityY;

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
        point.opacity -= SHOOTING_STAR_FADE_RATE * 1.5; // Plus rapide que l'original
      }
    });

    // Supprimer les points trop transparents
    this.tailPoints = this.tailPoints.filter(point => point && point.opacity > 0.01);

    // Désactiver l'étoile si elle a dépassé sa durée de vie ou si elle n'a plus de traînée visible
    if (this.age >= this.lifespan || (this.opacity <= 0.01 && this.tailPoints.length === 0)) {
      this.active = false;
    }

    // Également désactiver si elle sort complètement de l'écran (sécurité)
    if (this.x < -200 || this.x > canvasWidth + 200 || 
        this.y < -200 || this.y > canvasHeight + 200) {
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

class BackgroundStarfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private shootingStars: ShootingStar[] = [];
  private blackHole: BlackHole | null = null;
  private animationFrameId: number | null = null;

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
    this.createStars();
  }

  private createStars(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.stars = Array.from({ length: STAR_COUNT }, () =>
      new Star(centerX, centerY)
    );
    
    // Créer le trou noir
    this.blackHole = new BlackHole(centerX, centerY);
  }

  private spawnShootingStar(): void {
    if (this.shootingStars.length < SHOOTING_STAR_COUNT && Math.random() < SHOOTING_STAR_SPAWN_RATE) {
      this.shootingStars.push(new ShootingStar(this.canvas.width, this.canvas.height));
    }
  }

  private updateShootingStars(): void {
    this.shootingStars.forEach(shootingStar => {
      shootingStar.update(this.canvas.width, this.canvas.height, mouseX, mouseY);
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
    });

    window.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      mouseX = touch.clientX;
      mouseY = touch.clientY;
      ATTRACTION_RADIUS = ATTRACTION_RADIUS_INITIAL;
      lastMouseMoveTime = Date.now();
    });
  }

  private attractStars(): void {
    this.stars.forEach(star => {
      const dx = star.x - mouseX;
      const dy = star.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      ATTRACTION_RADIUS = ATTRACTION_RADIUS_INITIAL; // Delete for blackhole

      if (distance < ATTRACTION_RADIUS) {
        star.targetX = mouseX;
        star.targetY = mouseY;
        star.attractionTimer = 500; // ms
      }
    });
  }

  private draw(): void {
    // Effacer le canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

    // Appliquer l'attraction
    this.attractStars();

    // Mettre à jour et dessiner chaque étoile
    this.stars.forEach(star => {
      star.update();
      star.draw(this.ctx);
    });

    // Gérer les étoiles filantes
    this.spawnShootingStar();
    this.updateShootingStars();
    
    // Mettre à jour et dessiner le trou noir
    if (this.blackHole) {
      this.blackHole.update();
      this.blackHole.draw(this.ctx);
    }
    
    // Dessiner les étoiles filantes
    this.shootingStars.forEach(shootingStar => {
      shootingStar.draw(this.ctx);
    });
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