import {
  BLACK_HOLE_SIZE,
  BLACK_HOLE_SPEED,
  BLACK_HOLE_MIN_DISTANCE,
  BLACK_HOLE_MAX_DISTANCE,
  BLACK_HOLE_RING_STARS,
  BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER,
  BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER,
  BLACK_HOLE_RING_SPEED,
  BLACK_HOLE_RING_TRAIL_LENGTH,
  COLLAPSE_DETECTION_RADIUS,
  COLLAPSE_RING_DURATION,
  COLLAPSE_STARS_DURATION,
  COLLAPSE_SHOOTING_STARS_DURATION,
  COLLAPSE_FINAL_DURATION,
  COLLAPSE_WAIT_DURATION,
  CollapseState
} from './config.js';

export class BlackHole {
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
  finalBlackHoleX: number = 0; // Final black hole position for reset
  finalBlackHoleY: number = 0;

  constructor(private centerX: number, private centerY: number) {
    this.angle = Math.random() * Math.PI * 2;
    // Distance between minimum and maximum from center
    this.distance = BLACK_HOLE_MIN_DISTANCE + 
      Math.random() * (BLACK_HOLE_MAX_DISTANCE - BLACK_HOLE_MIN_DISTANCE);
    
    // Initial position
    this.x = this.centerX + Math.cos(this.angle) * this.distance;
    this.y = this.centerY + Math.sin(this.angle) * this.distance;
    
    // Create ring stars
    this.createRingStars();
  }

  private createRingStars(): void {
    this.ringStars = [];
    
    // Calculate radii based on black hole size
    const minRadius = BLACK_HOLE_SIZE * BLACK_HOLE_RING_MIN_RADIUS_MULTIPLIER;
    const maxRadius = BLACK_HOLE_SIZE * BLACK_HOLE_RING_MAX_RADIUS_MULTIPLIER;
    
    for (let i = 0; i < BLACK_HOLE_RING_STARS; i++) {
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      
      // Closer to black hole = whiter, further = more opaque
      const proximityRatio = (radius - minRadius) / (maxRadius - minRadius);
      
      const star = {
        angle: Math.random() * Math.PI * 2,
        radius: radius,
        opacity: 0.9 - proximityRatio * 0.5, // Closer = more opaque (0.9 to 0.4)
        speed: BLACK_HOLE_RING_SPEED * (2 - proximityRatio), // Faster when closer
        trail: [] as { x: number; y: number; opacity: number }[],
        isCollapsing: false,
        collapseStartTime: 0
      };
      
      // Pre-fill trail so it's visible from the start
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

  checkShootingStarCollision(shootingStar: { x: number; y: number }): boolean {
    const dx = shootingStar.x - this.x;
    const dy = shootingStar.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < COLLAPSE_DETECTION_RADIUS;
  }

  startCollapse(): void {
    if (this.collapseState === CollapseState.NORMAL) {
      this.collapseState = CollapseState.RING_COLLAPSE;
      this.collapseTimer = 0;
      
      // Start ring stars collapse with random delays
      this.ringStars.forEach((star) => {
        star.isCollapsing = true;
        star.collapseStartTime = Date.now() + Math.random() * 1000; // Random delay up to 1 second
      });
    }
  }

  update(): void {
    // Handle collapse states
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
          // Black hole remains visible during this phase
          if (this.collapseTimer >= COLLAPSE_FINAL_DURATION) {
            // Save final black hole position
            this.finalBlackHoleX = this.x;
            this.finalBlackHoleY = this.y;
            this.collapseState = CollapseState.WAITING;
            this.collapseTimer = 0;
            // Black hole remains visible during waiting
          }
          break;
          
        case CollapseState.WAITING:
          // Wait 4 seconds before starting reset
          // Black hole remains visible during entire wait
          if (this.collapseTimer >= COLLAPSE_WAIT_DURATION) {
            this.collapseState = CollapseState.RESETTING;
            this.collapseTimer = 0;
            this.isVisible = false;
            this.blackHoleOpacity = 0;
          }
          break;
          
        case CollapseState.RESETTING:
          // Black hole remains invisible and does nothing
          // Reset is handled by BackgroundStarfield class
          break;
          
        case CollapseState.RESET_COMPLETE:
          // Final definitive state - no more actions
          break;
      }
    }

    if (this.collapseState === CollapseState.NORMAL) {
      this.angle += BLACK_HOLE_SPEED;
      
      // Circular movement of black hole
      const newX = this.centerX + Math.cos(this.angle) * this.distance;
      const newY = this.centerY + Math.sin(this.angle) * this.distance;
      
      // Calculate black hole displacement
      const deltaX = newX - this.x;
      const deltaY = newY - this.y;
      
      this.x = newX;
      this.y = newY;
      
      // Update ring stars normally
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
      // During collapse, update ring stars
      this.ringStars.forEach(star => {
        if (star.isCollapsing) {
          const currentTime = Date.now();
          if (currentTime >= star.collapseStartTime) {
            // Gradually reduce radius
            star.radius = Math.max(0, star.radius - 1.5);
            // Reduce opacity
            star.opacity = Math.max(0, star.opacity - 0.02);
            
            // Continue rotation but slower
            star.angle += star.speed * 0.5;
            
            // Update trail
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
            
            // Fade trail faster
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
    // Don't draw anything if black hole is not visible
    if (!this.isVisible || this.collapseState === CollapseState.RESETTING || this.collapseState === CollapseState.RESET_COMPLETE) return;
    
    // Draw ring star trails first
    this.ringStars.forEach(star => {
      if (star.trail.length < 2 || star.opacity <= 0) return;
      
      // Draw trail
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
    
    // Draw ring stars (heads)
    this.ringStars.forEach(star => {
      if (star.opacity <= 0 || star.radius <= 0) return;
      
      const starX = this.x + Math.cos(star.angle) * star.radius;
      const starY = this.y + Math.sin(star.angle) * star.radius;
      
      ctx.beginPath();
      ctx.arc(starX, starY, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.fill();
    });
    
    // Draw black hole (black body with progressive opacity)
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
    return false; // No more permanent void state
  }
}
