import {
    PLANET_SIZE_RANGE,
    PLANET_SPEED_RANGE,
    PLANET_ROTATION_SPEED_RANGE,
    PLANET_SIZE_PULSE_SPEED,
    PLANET_OPACITY,
    PLANET_SHRINK_FACTOR
} from './config.js';

export class Planet
{
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
    sizePulse: number;
    opacity: number;
    image: HTMLImageElement;
    imageLoaded: boolean = false;
    isActive: boolean = false;
    controlX: number = 0;
    controlY: number = 0;
    travelProgress: number = 0;
    travelSpeed: number = 0;
    mass: number = 1;
    glowColor: string = '0';
    
    constructor(
        private canvasWidth: number,
        private canvasHeight: number
    )
    {
        this.baseSize = Math.random() * (PLANET_SIZE_RANGE[1] - PLANET_SIZE_RANGE[0]) + PLANET_SIZE_RANGE[0];
        this.currentSize = this.baseSize;
        this.opacity = 0.7 + Math.random() * 0.2;
        this.rotation = 0;
        this.sizePulse = Math.random() * Math.PI * 2;
        
        this.generateRandomColor();
        
        this.rotationSpeed = Math.random() * (PLANET_ROTATION_SPEED_RANGE[1] - PLANET_ROTATION_SPEED_RANGE[0]) + PLANET_ROTATION_SPEED_RANGE[0];
        if (Math.random() < 0.5)
            this.rotationSpeed *= -1;
        
        this.image = new Image();
        this.image.src = '/img/planet.gif';
        this.image.onload = () =>
        {
            this.imageLoaded = true;
        };
        
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.x = 0;
        this.y = 0;
        this.velocityX = 0;
        this.velocityY = 0;
    }

    // Selects random hue rotation value to create color variation without requiring multiple image assets
    generateRandomColor(): void
    {
        const hueRotations = [
            '0',
            '30',
            '60',
            '120',
            '180',
            '210',
            '240',
            '270',
            '300',
            '330',
        ];
        
        const randomIndex = Math.floor(Math.random() * hueRotations.length);
        this.glowColor = hueRotations[randomIndex] || '0';
    }

    spawn(): void
    {
        if (!this.imageLoaded)
            return;
        
        this.isActive = true;
        this.opacity = PLANET_OPACITY;
        
        this.generateRandomColor();
        
        const speed = Math.random() * (PLANET_SPEED_RANGE[1] - PLANET_SPEED_RANGE[0]) + PLANET_SPEED_RANGE[0];
        
        // Randomly select screen edge to determine entry and exit points for natural crossing motion
        const edge = Math.floor(Math.random() * 4);
        
        switch (edge)
        {
            case 0:
                this.startX = Math.random() * this.canvasWidth;
                this.startY = -this.baseSize;
                this.endX = Math.random() * this.canvasWidth;
                this.endY = this.canvasHeight + this.baseSize;
                break;
            case 1:
                this.startX = this.canvasWidth + this.baseSize;
                this.startY = Math.random() * this.canvasHeight;
                this.endX = -this.baseSize;
                this.endY = Math.random() * this.canvasHeight;
                break;
            case 2:
                this.startX = Math.random() * this.canvasWidth;
                this.startY = this.canvasHeight + this.baseSize;
                this.endX = Math.random() * this.canvasWidth;
                this.endY = -this.baseSize;
                break;
            case 3:
                this.startX = -this.baseSize;
                this.startY = Math.random() * this.canvasHeight;
                this.endX = this.canvasWidth + this.baseSize;
                this.endY = Math.random() * this.canvasHeight;
                break;
        }
        
        this.x = this.startX;
        this.y = this.startY;
        
        // Create curved path using quadratic Bezier with jittered control point for organic motion
        const midX = (this.startX + this.endX) / 2;
        const midY = (this.startY + this.endY) / 2;
        const jitter = Math.min(this.canvasWidth, this.canvasHeight) * 0.25;
        this.controlX = midX + (Math.random() - 0.5) * jitter;
        this.controlY = midY + (Math.random() - 0.5) * jitter;

        // Normalize travel speed based on approximate path length to maintain consistent visual speed
        const dx = this.endX - this.startX;
        const dy = this.endY - this.startY;
        const chord = Math.sqrt(dx * dx + dy * dy);
        const ctrlDist = Math.sqrt(Math.pow(this.controlX - midX, 2) + Math.pow(this.controlY - midY, 2));
        const approxLength = chord + 0.5 * ctrlDist;
        this.travelSpeed = speed / Math.max(approxLength, 1);
        this.travelProgress = 0;
        this.mass = this.baseSize / 40;
    }

    update(): void
    {
        if (!this.isActive)
            return;
        
        this.travelProgress += this.travelSpeed;
        if (this.travelProgress > 1)
            this.travelProgress = 1;

        // Quadratic Bezier interpolation creates smooth curved trajectory through control point
        const t = this.travelProgress;
        const oneMinusT = 1 - t;
        this.x = oneMinusT * oneMinusT * this.startX + 2 * oneMinusT * t * this.controlX + t * t * this.endX;
        this.y = oneMinusT * oneMinusT * this.startY + 2 * oneMinusT * t * this.controlY + t * t * this.endY;

        this.rotation += this.rotationSpeed;

        // Planet shrinks as it travels to simulate depth perspective with subtle pulsing animation
        const shrinkProgress = t;
        const shrinkMultiplier = 1 - (1 - PLANET_SHRINK_FACTOR) * shrinkProgress;
        this.sizePulse += PLANET_SIZE_PULSE_SPEED;
        const pulse = 1 + (Math.sin(this.sizePulse) * 0.5) * 0.04;
        this.currentSize = this.baseSize * shrinkMultiplier * pulse;

        // Deactivate when journey complete or planet exits visible bounds for object pool reuse
        if (this.travelProgress >= 1 || this.x < -this.baseSize || this.x > this.canvasWidth + this.baseSize ||
            this.y < -this.baseSize || this.y > this.canvasHeight + this.baseSize)
            this.isActive = false;
    }

    draw(ctx: CanvasRenderingContext2D): void
    {
        if (!this.isActive || !this.imageLoaded)
            return;
        
        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Disable smoothing to preserve pixelated aesthetic matching game style
        ctx.imageSmoothingEnabled = false;
        
        // Apply hue rotation filter to create color variety from single base image
        const hueRotate = this.glowColor;
        ctx.filter = `hue-rotate(${hueRotate}deg) saturate(150%)`;
        
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