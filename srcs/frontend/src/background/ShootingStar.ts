import {
    SHOOTING_STAR_SPEED_RANGE,
    SHOOTING_STAR_LENGTH_RANGE,
    SHOOTING_STAR_OPACITY,
    SHOOTING_STAR_FADE_RATE,
    SHOOTING_STAR_GRAVITY_RADIUS,
    SHOOTING_STAR_GRAVITY_STRENGTH_MAX,
    SHOOTING_STAR_GRAVITY_STRENGTH_MIN
} from './config.js';

export class ShootingStar
{
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

    constructor(canvasWidth: number, canvasHeight: number)
    {
        // Spawn from random screen edge with velocity directed into viewport for natural meteor appearance
        const side = Math.floor(Math.random() * 4);
        const speed = Math.random() * (SHOOTING_STAR_SPEED_RANGE[1] - SHOOTING_STAR_SPEED_RANGE[0]) + SHOOTING_STAR_SPEED_RANGE[0];
        
        switch (side)
        {
            case 0:
                this.x = Math.random() * canvasWidth;
                this.y = -50;
                this.velocityX = (Math.random() - 0.5) * speed;
                this.velocityY = speed * 0.7;
                break;
            case 1:
                this.x = canvasWidth + 50;
                this.y = Math.random() * canvasHeight;
                this.velocityX = -speed * 0.7;
                this.velocityY = (Math.random() - 0.5) * speed;
                break;
            case 2:
                this.x = Math.random() * canvasWidth;
                this.y = canvasHeight + 50;
                this.velocityX = (Math.random() - 0.5) * speed;
                this.velocityY = -speed * 0.7;
                break;
            default:
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

    startCollapseToBlackHole(_blackHoleX: number, _blackHoleY: number): void
    {
        this.isCollapsingToBlackHole = true;
    }

    update(canvasWidth: number, canvasHeight: number, mouseX: number, mouseY: number, blackHoleX?: number, blackHoleY?: number): void
    {
        this.age++;

        if (this.isCollapsingToBlackHole && blackHoleX !== undefined && blackHoleY !== undefined)
        {
            // Override normal physics to pull shooting star directly toward black hole at increased speed
            const dx = blackHoleX - this.x;
            const dy = blackHoleY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 10)
            {
                this.velocityX = (dx / distance) * this.baseSpeed * 1.5;
                this.velocityY = (dy / distance) * this.baseSpeed * 1.5;
                this.x += this.velocityX;
                this.y += this.velocityY;
                
                this.opacity *= 0.97;
                this.maxOpacity *= 0.97;
            }
            else
            {
                this.active = false;
                return;
            }
        }
        else
        {
            // Three-phase fade animation: fade in, sustain, fade out for smooth appearance and disappearance
            const lifeProgress = this.age / this.lifespan;
            
            if (lifeProgress < 0.2)
                this.opacity = (lifeProgress / 0.2) * this.maxOpacity;
            else if (lifeProgress < 0.7)
                this.opacity = this.maxOpacity;
            else
            {
                const fadeProgress = (lifeProgress - 0.7) / 0.3;
                this.opacity = this.maxOpacity * (1 - fadeProgress);
            }

            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const distanceToMouse = Math.sqrt(dx * dx + dy * dy);

            // Apply gravitational pull toward cursor with quadratic falloff for natural attraction feel
            if (!this.isCollapsingToBlackHole && distanceToMouse < SHOOTING_STAR_GRAVITY_RADIUS && distanceToMouse > 0)
            {
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

            // Maintain constant speed by normalizing velocity vector after gravity application
            if (!this.isCollapsingToBlackHole)
            {
                const currentSpeed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
                if (currentSpeed > 0)
                {
                    this.velocityX = (this.velocityX / currentSpeed) * this.baseSpeed;
                    this.velocityY = (this.velocityY / currentSpeed) * this.baseSpeed;
                }
            }

            this.x += this.velocityX;
            this.y += this.velocityY;
        }

        // Build trail by storing position history with opacity for gradient rendering
        this.tailPoints.push({
            x: this.x,
            y: this.y,
            opacity: this.opacity
        });

        if (this.tailPoints.length > this.length / 5)
            this.tailPoints.shift();

        // Accelerate trail fade during collapse for dramatic absorption effect
        this.tailPoints.forEach(point =>
        {
            if (point)
                point.opacity -= SHOOTING_STAR_FADE_RATE * (this.isCollapsingToBlackHole ? 3 : 1.5);
        });

        this.tailPoints = this.tailPoints.filter(point => point && point.opacity > 0.01);

        // Deactivate when lifespan complete or trail fully faded to enable object pool reuse
        if (!this.isCollapsingToBlackHole && (this.age >= this.lifespan || (this.opacity <= 0.01 && this.tailPoints.length === 0)))
            this.active = false;

        // Safety deactivation for shooting stars that somehow escape viewport bounds
        if (!this.isCollapsingToBlackHole && (this.x < -200 || this.x > canvasWidth + 200 || 
            this.y < -200 || this.y > canvasHeight + 200))
            this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D): void
    {
        if (this.tailPoints.length < 2)
            return;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0)';
        ctx.lineWidth = 2;
        
        // Draw trail segments with linear gradients between consecutive points for smooth opacity transition
        for (let i = 1; i < this.tailPoints.length; i++)
        {
            const point = this.tailPoints[i];
            const prevPoint = this.tailPoints[i - 1];
            
            if (!point || !prevPoint)
                continue;
            
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

        // Draw bright head with radial halo for emphasis and depth
        const headPoint = this.tailPoints[this.tailPoints.length - 1];
        if (headPoint)
        {
            ctx.beginPath();
            ctx.arc(headPoint.x, headPoint.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${headPoint.opacity})`;
            ctx.fill();
            
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