import { hideAllPages, show } from '../navigation/utils.js';
import { Star } from './Star.js';
import { BlackHole } from './BlackHole.js';
import { ShootingStar } from './ShootingStar.js';
import { Planet } from './Planet.js';
import {
  calculateStarCount,
  CollapseState,
  ATTRACTION_RADIUS_INITIAL,
  SHOOTING_STAR_COUNT,
  SHOOTING_STAR_SPAWN_RATE,
  PLANET_COUNT,
  PLANET_SPAWN_RATE,
  RESET_DURATION,
  LONG_PRESS_DURATION,
  RING_RADIUS,
  LONG_PRESS_MOVE_TOLERANCE,
  updateLastMouseMoveTime,
  getAttractionRadius,
  setAttractionRadius
} from './config.js';

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

export class BackgroundStarfield {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private shootingStars: ShootingStar[] = [];
  private blackHole: BlackHole | null = null;
  private planets: Planet[] = []; // Array of planets
  private animationFrameId: number | null = null;
  private hasResetStarted: boolean = false; // Ensure reset only starts once
  private currentStarCount: number = 0; // Track current number of stars
  
  // Properties for long press
  private isLongPressing: boolean = false;
  private longPressStartTime: number = 0;
  private longPressX: number = 0;
  private longPressY: number = 0;
  private longPressProgress: number = 0;

  // Throttle mode for performance during game (50 FPS vs 60 normal)
  private throttleMode: boolean = false;
  private lastFrameTime: number = 0;
  private readonly THROTTLE_FRAME_TIME = 1000 / 50; // ~20ms entre frames

  constructor(canvasId: string) {
    const canvasElement = document.getElementById(canvasId);
    if (!(canvasElement instanceof HTMLCanvasElement)) {
      throw new Error(`Element with ID ${canvasId} is not an HTML canvas`);
    }

    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2D context');
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
    
    // Recreate stars only if count has changed and not in reset
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
    
    // Create black hole only the first time
    if (!this.blackHole) {
      this.blackHole = new BlackHole(centerX, centerY);
    }
    
    // Initialize planet pool (like shooting stars, max PLANET_COUNT simultaneous)
    // Create a pool of PLANET_COUNT * 2 for reusable objects
    if (this.planets.length === 0) {
      for (let i = 0; i < PLANET_COUNT * 2; i++) {
        const planet = new Planet(this.canvas.width, this.canvas.height);
        this.planets.push(planet);
      }
    }
  }

  private spawnPlanet(): void {
    // Count active planets
    const activePlanetsCount = this.planets.filter(p => p.isActive).length;
    
    // Same logic as shooting stars: spawn if below limit and probability
    if (activePlanetsCount < PLANET_COUNT && Math.random() < PLANET_SPAWN_RATE) {
      // Find an inactive planet
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
      // Check collisions with black hole only if it's visible
      if (this.blackHole && this.blackHole.isVisible && this.blackHole.checkShootingStarCollision(shootingStar)) {
        this.blackHole.startCollapse();
        shootingStar.active = false; // Immediately absorb star that touched black hole
        return;
      }

      // If black hole requests shooting stars collapse
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

    // Remove inactive shooting stars
    this.shootingStars = this.shootingStars.filter(shootingStar => shootingStar.active);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.resizeCanvas());

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setAttractionRadius(ATTRACTION_RADIUS_INITIAL); // reset radius
      updateLastMouseMoveTime();
      
      // Cancel long press if mouse moves too much (with tolerance)
      if (this.isLongPressing) {
        const dx = e.clientX - this.longPressX;
        const dy = e.clientY - this.longPressY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > LONG_PRESS_MOVE_TOLERANCE) {
          this.cancelLongPress();
        }
      }
    });

    window.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      mouseX = touch.clientX;
      mouseY = touch.clientY;
      setAttractionRadius(ATTRACTION_RADIUS_INITIAL);
      updateLastMouseMoveTime();
      
      // Cancel long press if finger moves too much (with tolerance)
      if (this.isLongPressing) {
        const dx = touch.clientX - this.longPressX;
        const dy = touch.clientY - this.longPressY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > LONG_PRESS_MOVE_TOLERANCE) {
          this.cancelLongPress();
        }
      }
    });

    // Events for long press on canvas
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

    // Touch support
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
      // Long press completed - return to main menu
      this.triggerBackToMainMenu();
    }
  }

  private triggerBackToMainMenu(): void {
    this.cancelLongPress();
    
    // Use spa.ts functions
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

    // Draw background ring (light gray)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Draw progress ring (dark gray)
    const startAngle = -Math.PI / 2; // Start at top
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

      const ATTRACTION_RADIUS = getAttractionRadius();

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
      
      // Start reset of all stars with staggered delays
      this.stars.forEach((star, index) => {
        const delay = index * 2; // Progressive delay for wave effect
        star.startReset(finalPosition.x, finalPosition.y, delay);
      });
      
      // Progressively recreate shooting stars
      setTimeout(() => {
        this.shootingStars = []; // Empty existing shooting stars
      }, 1000);
      
      // Definitively mark end of reset
      setTimeout(() => {
        this.hasResetStarted = false;
        // Mark black hole as completely finished to avoid re-triggers
        if (this.blackHole) {
          this.blackHole.markResetComplete();
        }
      }, RESET_DURATION * 16.67 + 2000);
    }
  }

  private draw(): void {
    // Clear canvas - always black
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // En mode throttle, on skip les features lourdes (reset, attraction, collapse)
    if (!this.throttleMode) {
      // Handle reset if necessary
      this.handleReset();

      // Apply normal attraction if not in collapse or reset mode
      if (!this.blackHole || (!this.blackHole.shouldCollapseStars() && !this.blackHole.shouldReset())) {
        this.attractStars();
      }

      // Start background stars collapse if requested
      if (this.blackHole && this.blackHole.shouldCollapseStars()) {
        this.stars.forEach((star) => {
          if (!star.isCollapsingToBlackHole && !star.isResetting) {
            // Add delay based on distance to black hole for wave effect
            const dx = star.x - this.blackHole!.x;
            const dy = star.y - this.blackHole!.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const delay = (distance / 10) * 50; // Farther = more delay
            
            star.startCollapseToBlackHole(this.blackHole!.x, this.blackHole!.y, delay);
          }
        });
      }
    }

    // Update and draw each star
    this.stars.forEach(star => {
      star.update(this.blackHole?.x, this.blackHole?.y);
      star.draw(this.ctx);
    });

    // En mode throttle (pendant le jeu), skip les éléments lourds
    if (!this.throttleMode) {
      // Planètes
      this.spawnPlanet();
      this.updatePlanets();
      this.planets.forEach(planet => {
        planet.draw(this.ctx);
      });

      // Handle shooting stars - don't create more if black hole is in collapse or reset
      if (!this.blackHole || (this.blackHole.collapseState === CollapseState.NORMAL)) {
        this.spawnShootingStar();
      }
      this.updateShootingStars();
      
      // Update and draw black hole (if visible)
      if (this.blackHole) {
        this.blackHole.update();
        this.blackHole.draw(this.ctx);
      }
      
      // Draw shooting stars
      this.shootingStars.forEach(shootingStar => {
        shootingStar.draw(this.ctx);
      });
    }

    // Update and draw long press ring
    this.updateLongPress();
    this.drawLongPressRing();
  }

  private animate(currentTime: number = 0): void {
    // En mode throttle, skip des frames pour réduire la charge CPU
    if (this.throttleMode) {
      const elapsed = currentTime - this.lastFrameTime;
      if (elapsed < this.THROTTLE_FRAME_TIME) {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        return;
      }
      this.lastFrameTime = currentTime;
    }
    
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  }

  /**
   * Active le mode throttle (réduit le FPS du background)
   * Utile pour les performances pendant le jeu
   */
  public setThrottleMode(enabled: boolean): void {
    this.throttleMode = enabled;
    if (enabled) {
      this.lastFrameTime = performance.now();
    }
  }

  /**
   * Vérifie si le mode throttle est activé
   */
  public isThrottled(): boolean {
    return this.throttleMode;
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.resizeCanvas.bind(this));
  }
}
