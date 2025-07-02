// Configuration globale
const STAR_COUNT = 4000;
const STAR_SIZE_RANGE: [number, number] = [0.5, 3];
const STAR_OPACITY_RANGE: [number, number] = [0.1, 2];

const BACKGROUND_SCALE = 2;

let ATTRACTION_RADIUS = 50; // valeur dynamique
const ATTRACTION_RADIUS_INITIAL = 50;
const ATTRACTION_RADIUS_MAX = 4000;
const ATTRACTION_RADIUS_EXP_FACTOR = 1.01; // facteur exponentiel (>1 pour croître)
let lastMouseMoveTime = Date.now();
const INACTIVITY_THRESHOLD = 2000; // ms avant d'augmenter

const EASE = 0.1;

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

class BackgroundStarfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
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