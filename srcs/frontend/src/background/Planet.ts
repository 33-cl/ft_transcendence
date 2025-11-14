import {
  PLANET_SIZE_RANGE,
  PLANET_SPEED_RANGE,
  PLANET_ROTATION_SPEED_RANGE,
  PLANET_SIZE_PULSE_SPEED,
  PLANET_OPACITY,
  PLANET_SHRINK_FACTOR
} from './config.js';

export class Planet {
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
  sizePulse: number; // For size animation
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
  glowColor: string = '0'; // Hue-rotate value in degrees
  
  constructor(
    private canvasWidth: number,
    private canvasHeight: number
  ) {
    // Random size
    this.baseSize = Math.random() * (PLANET_SIZE_RANGE[1] - PLANET_SIZE_RANGE[0]) + PLANET_SIZE_RANGE[0];
    this.currentSize = this.baseSize;
    // Random opacity between 0.7 and 0.9
    this.opacity = 0.7 + Math.random() * 0.2;
    this.rotation = 0;
    this.sizePulse = Math.random() * Math.PI * 2; // Random phase for pulsation
    
    // Random color for glow
    this.generateRandomColor();
    
    // Random rotation
    this.rotationSpeed = Math.random() * (PLANET_ROTATION_SPEED_RANGE[1] - PLANET_ROTATION_SPEED_RANGE[0]) + PLANET_ROTATION_SPEED_RANGE[0];
    // 50% chance of inverse rotation
    if (Math.random() < 0.5) this.rotationSpeed *= -1;
    
    // Load planet image
    this.image = new Image();
    this.image.src = '/img/planet.gif';
    this.image.onload = () => {
      this.imageLoaded = true;
    };
    
    // Initialize trajectory (will be defined by spawn())
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
    this.x = 0;
    this.y = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  // Generate random hue rotation to change image color
  generateRandomColor(): void {
    // Predefined hue rotation values for varied colors
    // 0° = original color, 120° = green, 240° = blue, etc.
    const hueRotations = [
      '0',     // Original color
      '30',    // Orange/Red
      '60',    // Yellow
      '120',   // Green
      '180',   // Cyan
      '210',   // Light blue
      '240',   // Blue
      '270',   // Violet
      '300',   // Magenta
      '330',   // Pink/Red
    ];
    
    // Choose random rotation
    const randomIndex = Math.floor(Math.random() * hueRotations.length);
    this.glowColor = hueRotations[randomIndex] || '0';
  }

  spawn(): void {
    if (!this.imageLoaded) return;
    
    this.isActive = true;
    this.opacity = PLANET_OPACITY;
    
    // Generate new random color each spawn
    this.generateRandomColor();
    
    // Random speed
    const speed = Math.random() * (PLANET_SPEED_RANGE[1] - PLANET_SPEED_RANGE[0]) + PLANET_SPEED_RANGE[0];
    
    // Choose random edge (0: top, 1: right, 2: bottom, 3: left)
    const edge = Math.floor(Math.random() * 4);
    
    switch (edge) {
      case 0: // Top -> Bottom
        this.startX = Math.random() * this.canvasWidth;
        this.startY = -this.baseSize;
        this.endX = Math.random() * this.canvasWidth;
        this.endY = this.canvasHeight + this.baseSize;
        break;
      case 1: // Right -> Left
        this.startX = this.canvasWidth + this.baseSize;
        this.startY = Math.random() * this.canvasHeight;
        this.endX = -this.baseSize;
        this.endY = Math.random() * this.canvasHeight;
        break;
      case 2: // Bottom -> Top
        this.startX = Math.random() * this.canvasWidth;
        this.startY = this.canvasHeight + this.baseSize;
        this.endX = Math.random() * this.canvasWidth;
        this.endY = -this.baseSize;
        break;
      case 3: // Left -> Right
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
    
    // Advance travel progress
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
    if (!this.isActive || !this.imageLoaded) return;
    
    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    // Apply rotation
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Disable smoothing for pixelated effect
    ctx.imageSmoothingEnabled = false;
    
    // Apply color filter (hue) to planet image
    // Format: hue-rotate to change image hue
    const hueRotate = this.glowColor; // Storing hue rotation value
    ctx.filter = `hue-rotate(${hueRotate}deg) saturate(150%)`;
    
    // Draw planet image with color filter
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
