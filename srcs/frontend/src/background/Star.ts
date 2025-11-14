import {
  BACKGROUND_SCALE,
  STAR_SIZE_RANGE,
  STAR_OPACITY_RANGE,
  EASE,
  RESET_DURATION,
  getCurrentHoverColor,
  coloredStarsRatio
} from './config.js';

export class Star {
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
  originalOpacity: number; // Save original opacity
  originalSize: number; // Save original size
  
  // New properties for reset
  isResetting: boolean = false;
  resetStartTime: number = 0;
  resetStartX: number = 0;
  resetStartY: number = 0;
  originalAngle: number;
  originalDistance: number;
  shouldChangeColor: boolean; // Determines if this star should change color
  
  // Properties for reset explosion effect
  explosionAngle: number = 0;
  explosionSpeed: number = 0;

  constructor(private centerX: number, private centerY: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.distance = Math.pow(Math.random(), 0.5) * (centerX * BACKGROUND_SCALE);
    this.size = Math.random() * (STAR_SIZE_RANGE[1] - STAR_SIZE_RANGE[0]) + STAR_SIZE_RANGE[0];
    this.opacity = Math.random() * (STAR_OPACITY_RANGE[1] - STAR_OPACITY_RANGE[0]) + STAR_OPACITY_RANGE[0];
    this.originalOpacity = this.opacity; // Save original opacity
    this.originalSize = this.size; // Save original size
    this.speed = 0.0005 + Math.random() * 0.001;
    
    // Save original properties for reset
    this.originalAngle = this.angle;
    this.originalDistance = this.distance;
    
    // Randomly determine if this star should change color
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
    this.size = this.originalSize * 0.2; // Start small
    
    // Recalculate final position based on original properties
    this.targetX = this.centerX + Math.cos(this.originalAngle) * this.originalDistance;
    this.targetY = this.centerY + Math.sin(this.originalAngle) * this.originalDistance;
  }

  update(blackHoleX?: number, blackHoleY?: number): void {
    if (this.isResetting) {
      const currentTime = Date.now();
      if (currentTime >= this.resetStartTime) {
        // Reset animation from black hole to original position
        const resetProgress = Math.min((currentTime - this.resetStartTime) / (RESET_DURATION * 16.67), 1);
        const easeProgress = 1 - Math.pow(1 - resetProgress, 3); // Ease out cubic
        
        // Position interpolation
        this.x = this.resetStartX + (this.targetX - this.resetStartX) * easeProgress;
        this.y = this.resetStartY + (this.targetY - this.resetStartY) * easeProgress;
        
        // Gradual opacity restoration
        this.opacity = this.originalOpacity * easeProgress;
        
        // Gradual size restoration
        this.size = this.originalSize * 0.2 + (this.originalSize * 0.8) * easeProgress;
        
        // Gradual angle and distance restoration for continuing orbit
        this.angle = this.originalAngle;
        this.distance = this.originalDistance;
        
        if (resetProgress >= 1) {
          this.isResetting = false;
          this.attractionTimer = 0;
          this.size = this.originalSize; // Ensure size is exactly restored
        }
      }
      return;
    }

    // Always rotate orbital angle
    this.angle += this.speed;

    // Calculate normal orbital position
    const orbitX = this.centerX + Math.cos(this.angle) * this.distance;
    const orbitY = this.centerY + Math.sin(this.angle) * this.distance;

    // Check if star is in collapse mode and delay has passed
    if (this.isCollapsingToBlackHole && blackHoleX !== undefined && blackHoleY !== undefined) {
      const currentTime = Date.now();
      if (currentTime >= this.collapseStartTime) {
        // Delay has passed, direct attraction to black hole
        const dx = blackHoleX - this.x;
        const dy = blackHoleY - this.y;
        const distanceToBlackHole = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceToBlackHole > 1) {
          // Move directly towards black hole
          const speed = 0.05;
          this.x += dx * speed;
          this.y += dy * speed;
          
          // Gradually reduce size based on distance to black hole
          // Closer = smaller
          const sizeRatio = Math.max(0.2, distanceToBlackHole / 1000); // Minimum 20% of size
          this.size = this.originalSize * sizeRatio;
        } else {
          // Star at center of black hole - minimum size
          this.x = blackHoleX;
          this.y = blackHoleY;
          this.size = this.originalSize * 0.2;
        }
        return; // Don't do normal orbit
      }
      // If delay hasn't passed yet, continue normal orbit (no return)
    }

    // Normal behavior (mouse attraction or orbit)
    if (this.attractionTimer > 0) {
      // Attracted to mouse
      this.x += (this.targetX - this.x) * (EASE * 0.5);
      this.y += (this.targetY - this.y) * (EASE * 0.5);
      this.attractionTimer -= 16; // ~frame time
    } else {
      // Return to normal orbit
      this.targetX = orbitX;
      this.targetY = orbitY;
      this.x += (this.targetX - this.x) * EASE;
      this.y += (this.targetY - this.y) * EASE;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Don't draw if resetting and not yet visible
    if (this.isResetting && this.opacity <= 0) return;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    
    // Use hover color if applicable, otherwise white
    let color = '255, 255, 255';
    const currentHoverColor = getCurrentHoverColor();
    if (currentHoverColor && this.shouldChangeColor) {
      color = currentHoverColor;
    }
    
    // Use original opacity when not resetting
    const displayOpacity = this.isResetting ? this.opacity : this.originalOpacity;
    ctx.fillStyle = `rgba(${color}, ${displayOpacity})`;
    ctx.fill();
  }
}
