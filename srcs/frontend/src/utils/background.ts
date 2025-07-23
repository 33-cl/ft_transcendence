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
  }

  update(canvasWidth: number, canvasHeight: number): void {
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
  }

  private spawnShootingStar(): void {
    if (this.shootingStars.length < SHOOTING_STAR_COUNT && Math.random() < SHOOTING_STAR_SPAWN_RATE) {
      this.shootingStars.push(new ShootingStar(this.canvas.width, this.canvas.height));
    }
  }

  private updateShootingStars(): void {
    this.shootingStars.forEach(shootingStar => {
      shootingStar.update(this.canvas.width, this.canvas.height);
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