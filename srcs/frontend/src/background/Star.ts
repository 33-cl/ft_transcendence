import {
    BACKGROUND_SCALE,
    STAR_SIZE_RANGE,
    STAR_OPACITY_RANGE,
    EASE,
    RESET_DURATION,
    getCurrentHoverColor,
    coloredStarsRatio
} from './config.js';

export class Star
{
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
    originalOpacity: number;
    originalSize: number;

    isResetting: boolean = false;
    resetStartTime: number = 0;
    resetStartX: number = 0;
    resetStartY: number = 0;
    originalAngle: number;
    originalDistance: number;
    shouldChangeColor: boolean;

    explosionAngle: number = 0;
    explosionSpeed: number = 0;

    // Initializes a star with random properties to create depth and variety in the background field
    constructor(private centerX: number, private centerY: number)
    {
        this.angle = Math.random() * Math.PI * 2;
        this.distance = Math.pow(Math.random(), 0.5) * (centerX * BACKGROUND_SCALE);
        this.size = Math.random() * (STAR_SIZE_RANGE[1] - STAR_SIZE_RANGE[0]) + STAR_SIZE_RANGE[0];
        this.opacity = Math.random() * (STAR_OPACITY_RANGE[1] - STAR_OPACITY_RANGE[0]) + STAR_OPACITY_RANGE[0];
        this.originalOpacity = this.opacity;
        this.originalSize = this.size;
        this.speed = 0.0005 + Math.random() * 0.001;

        // We persist the initial geometric properties to restore them after the black hole animation ends
        this.originalAngle = this.angle;
        this.originalDistance = this.distance;

        // Decides randomly if this specific star will participate in dynamic color shifting effects
        this.shouldChangeColor = Math.random() < coloredStarsRatio;

        this.x = this.centerX + Math.cos(this.angle) * this.distance;
        this.y = this.centerY + Math.sin(this.angle) * this.distance;
        this.targetX = this.x;
        this.targetY = this.y;
    }

    // Triggers the animation state where the star begins being sucked towards a central point
    startCollapseToBlackHole(blackHoleX: number, blackHoleY: number, delay: number = 0): void
    {
        this.isCollapsingToBlackHole = true;
        this.collapseStartTime = Date.now() + delay;
        this.targetX = blackHoleX;
        this.targetY = blackHoleY;
    }

    // Resets the star's state to the center to prepare for the outward explosion animation
    startReset(blackHoleX: number, blackHoleY: number, delay: number = 0): void
    {
        this.isResetting = true;
        this.isCollapsingToBlackHole = false;
        this.resetStartTime = Date.now() + delay;
        this.resetStartX = blackHoleX;
        this.resetStartY = blackHoleY;
        this.x = blackHoleX;
        this.y = blackHoleY;
        this.opacity = 0;
        this.size = this.originalSize * 0.2;

        this.targetX = this.centerX + Math.cos(this.originalAngle) * this.originalDistance;
        this.targetY = this.centerY + Math.sin(this.originalAngle) * this.originalDistance;
    }

    // Handles the frame-by-frame logic for the three main states: Resetting, Collapsing, and Normal Orbit
    update(blackHoleX?: number, blackHoleY?: number): void
    {
        // State 1: The 'Big Bang' effect where stars explode outwards from the center back to their original orbits
        if (this.isResetting)
        {
            const currentTime = Date.now();

            if (currentTime >= this.resetStartTime)
            {
                const resetProgress = Math.min((currentTime - this.resetStartTime) / (RESET_DURATION * 16.67), 1);
                
                // We use cubic easing to make the explosion start fast and slow down as it reaches the orbit
                const easeProgress = 1 - Math.pow(1 - resetProgress, 3);

                this.x = this.resetStartX + (this.targetX - this.resetStartX) * easeProgress;
                this.y = this.resetStartY + (this.targetY - this.resetStartY) * easeProgress;

                this.opacity = this.originalOpacity * easeProgress;

                this.size = this.originalSize * 0.2 + (this.originalSize * 0.8) * easeProgress;

                this.angle = this.originalAngle;
                this.distance = this.originalDistance;

                // Once the animation completes, we restore full control to the standard orbital logic
                if (resetProgress >= 1)
                {
                    this.isResetting = false;
                    this.attractionTimer = 0;
                    this.size = this.originalSize;
                }
            }
            return;
        }

        this.angle += this.speed;

        const orbitX = this.centerX + Math.cos(this.angle) * this.distance;
        const orbitY = this.centerY + Math.sin(this.angle) * this.distance;

        // State 2: The 'Black Hole' effect where the star is actively being sucked into the center
        if (this.isCollapsingToBlackHole && blackHoleX !== undefined && blackHoleY !== undefined)
        {
            const currentTime = Date.now();

            if (currentTime >= this.collapseStartTime)
            {
                const dx = blackHoleX - this.x;
                const dy = blackHoleY - this.y;
                const distanceToBlackHole = Math.sqrt(dx * dx + dy * dy);

                if (distanceToBlackHole > 1)
                {
                    const speed = 0.05;
                    this.x += dx * speed;
                    this.y += dy * speed;

                    // The star shrinks as it gets closer to the center to simulate disappearing into the void
                    const sizeRatio = Math.max(0.2, distanceToBlackHole / 1000);
                    this.size = this.originalSize * sizeRatio;
                }
                else
                {
                    this.x = blackHoleX;
                    this.y = blackHoleY;
                    this.size = this.originalSize * 0.2;
                }
                return;
            }
        }

        // State 3: Normal behavior, handling either mouse attraction or standard orbital drift
        if (this.attractionTimer > 0)
        {
            this.x += (this.targetX - this.x) * (EASE * 0.5);
            this.y += (this.targetY - this.y) * (EASE * 0.5);
            this.attractionTimer -= 16;
        }
        else
        {
            this.targetX = orbitX;
            this.targetY = orbitY;
            this.x += (this.targetX - this.x) * EASE;
            this.y += (this.targetY - this.y) * EASE;
        }
    }

    // Renders the star to the canvas, applying dynamic coloring if enabled in the config
    draw(ctx: CanvasRenderingContext2D): void
    {
        if (this.isResetting && this.opacity <= 0)
            return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

        let color = '255, 255, 255';
        const currentHoverColor = getCurrentHoverColor();

        // If the global hover effect is active and this star is eligible, we swap the color
        if (currentHoverColor && this.shouldChangeColor)
        {
            color = currentHoverColor;
        }

        const displayOpacity = this.isResetting ? this.opacity : this.originalOpacity;
        ctx.fillStyle = `rgba(${color}, ${displayOpacity})`;
        ctx.fill();
    }
}