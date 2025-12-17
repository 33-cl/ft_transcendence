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

export class BackgroundStarfield
{
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private stars: Star[] = [];
    private shootingStars: ShootingStar[] = [];
    private blackHole: BlackHole | null = null;
    private planets: Planet[] = [];
    private animationFrameId: number | null = null;
    private hasResetStarted: boolean = false;
    private currentStarCount: number = 0;
    
    private isLongPressing: boolean = false;
    private longPressStartTime: number = 0;
    private longPressX: number = 0;
    private longPressY: number = 0;
    private longPressProgress: number = 0;

    private throttleMode: boolean = false;
    private lastFrameTime: number = 0;
    private readonly THROTTLE_FRAME_TIME = 1000 / 50;
    
    private isPaused: boolean = false;

    constructor(canvasId: string)
    {
        const canvasElement = document.getElementById(canvasId);
        if (!(canvasElement instanceof HTMLCanvasElement))
            throw new Error(`Element with ID ${canvasId} is not an HTML canvas`);

        this.canvas = canvasElement;
        const context = this.canvas.getContext('2d');
        if (!context)
            throw new Error('Cannot get 2D context');
        this.ctx = context;

        this.init();
    }

    private init(): void
    {
        this.setupCanvasStyle();
        this.resizeCanvas();
        this.createStars();
        this.setupEventListeners();
        this.animate();
    }

    private setupCanvasStyle(): void
    {
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '0';
    }

    private resizeCanvas(): void
    {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        const newStarCount = calculateStarCount(this.canvas.width, this.canvas.height);
        
        // Recreate stars only when count changes and not during reset sequence to avoid interrupting animations
        if (newStarCount !== this.currentStarCount && 
            (!this.blackHole || (!this.blackHole.shouldReset() && !this.hasResetStarted)))
            this.createStars();
        
        // Render single frame when paused to prevent blank screen after window resize
        if (this.isPaused)
            this.draw();
    }

    private createStars(): void
    {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.currentStarCount = calculateStarCount(this.canvas.width, this.canvas.height);

        this.stars = Array.from({ length: this.currentStarCount }, () =>
            new Star(centerX, centerY)
        );
        
        // Initialize black hole singleton only on first creation to maintain state across resizes
        if (!this.blackHole)
            this.blackHole = new BlackHole(centerX, centerY);
        
        // Create reusable planet pool to avoid constant object creation and garbage collection
        if (this.planets.length === 0)
        {
            for (let i = 0; i < PLANET_COUNT * 2; i++)
            {
                const planet = new Planet(this.canvas.width, this.canvas.height);
                this.planets.push(planet);
            }
        }
    }

    private spawnPlanet(): void
    {
        const activePlanetsCount = this.planets.filter(p => p.isActive).length;
        
        // Probabilistic spawning with hard cap on simultaneous planets to maintain performance
        if (activePlanetsCount < PLANET_COUNT && Math.random() < PLANET_SPAWN_RATE)
        {
            const inactivePlanet = this.planets.find(p => !p.isActive);
            if (inactivePlanet)
                inactivePlanet.spawn();
        }
    }

    private updatePlanets(): void
    {
        this.planets.forEach(planet =>
        {
            planet.update();
        });
    }

    private spawnShootingStar(): void
    {
        if (this.shootingStars.length < SHOOTING_STAR_COUNT && Math.random() < SHOOTING_STAR_SPAWN_RATE)
            this.shootingStars.push(new ShootingStar(this.canvas.width, this.canvas.height));
    }

    private updateShootingStars(): void
    {
        this.shootingStars.forEach(shootingStar =>
        {
            // Black hole collision triggers collapse sequence and immediately absorbs the shooting star
            if (this.blackHole && this.blackHole.isVisible && this.blackHole.checkShootingStarCollision(shootingStar))
            {
                this.blackHole.startCollapse();
                shootingStar.active = false;
                return;
            }

            // When black hole enters collapse state, all shooting stars begin gravitational pull animation
            if (this.blackHole && this.blackHole.shouldCollapseShootingStars() && !shootingStar.isCollapsingToBlackHole)
                shootingStar.startCollapseToBlackHole(this.blackHole.x, this.blackHole.y);

            shootingStar.update(
                this.canvas.width, 
                this.canvas.height, 
                mouseX, 
                mouseY,
                this.blackHole?.x,
                this.blackHole?.y
            );
        });

        this.shootingStars = this.shootingStars.filter(shootingStar => shootingStar.active);
    }

    private setupEventListeners(): void
    {
        window.addEventListener('resize', () => this.resizeCanvas());

        window.addEventListener('mousemove', (e) =>
        {
            mouseX = e.clientX;
            mouseY = e.clientY;
            setAttractionRadius(ATTRACTION_RADIUS_INITIAL);
            updateLastMouseMoveTime();
            
            // Cancel long press if cursor moves beyond tolerance threshold to prevent accidental triggers
            if (this.isLongPressing)
            {
                const dx = e.clientX - this.longPressX;
                const dy = e.clientY - this.longPressY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > LONG_PRESS_MOVE_TOLERANCE)
                    this.cancelLongPress();
            }
        });

        window.addEventListener('touchmove', (e) =>
        {
            const touch = e.touches[0];
            if (!touch)
                return;
            mouseX = touch.clientX;
            mouseY = touch.clientY;
            setAttractionRadius(ATTRACTION_RADIUS_INITIAL);
            updateLastMouseMoveTime();
            
            if (this.isLongPressing)
            {
                const dx = touch.clientX - this.longPressX;
                const dy = touch.clientY - this.longPressY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > LONG_PRESS_MOVE_TOLERANCE)
                    this.cancelLongPress();
            }
        });

        // Long press gesture only enabled on main menu to avoid interfering with game interactions
        this.canvas.addEventListener('mousedown', (e) =>
        {
            if (this.isOnMainMenu())
                this.startLongPress(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mouseup', () =>
        {
            this.cancelLongPress();
        });

        this.canvas.addEventListener('mouseleave', () =>
        {
            this.cancelLongPress();
        });

        this.canvas.addEventListener('touchstart', (e) =>
        {
            if (this.isOnMainMenu())
            {
                const touch = e.touches[0];
                if (touch)
                    this.startLongPress(touch.clientX, touch.clientY);
            }
        });

        this.canvas.addEventListener('touchend', () =>
        {
            this.cancelLongPress();
        });

        this.canvas.addEventListener('touchcancel', () =>
        {
            this.cancelLongPress();
        });
    }

    private isOnMainMenu(): boolean
    {
        const mainMenuElement = document.getElementById('mainMenu');
        return mainMenuElement !== null && mainMenuElement.innerHTML.trim() !== '';
    }

    private startLongPress(x: number, y: number): void
    {
        this.isLongPressing = true;
        this.longPressStartTime = Date.now();
        this.longPressX = x;
        this.longPressY = y;
        this.longPressProgress = 0;
    }

    private cancelLongPress(): void
    {
        this.isLongPressing = false;
        this.longPressProgress = 0;
    }

    private updateLongPress(): void
    {
        if (!this.isLongPressing)
            return;

        const elapsed = Date.now() - this.longPressStartTime;
        this.longPressProgress = Math.min(elapsed / LONG_PRESS_DURATION, 1);

        if (this.longPressProgress >= 1)
            this.triggerBackToMainMenu();
    }

    private triggerBackToMainMenu(): void
    {
        this.cancelLongPress();
        
        hideAllPages();
        show('goToMain');
    }

    private drawLongPressRing(): void
    {
        if (!this.isLongPressing || this.longPressProgress === 0)
            return;

        const ctx = this.ctx;
        const centerX = this.longPressX;
        const centerY = this.longPressY;
        const radius = RING_RADIUS;
        const lineWidth = 4;

        // Draw base ring showing full circle outline
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Draw progress arc that fills clockwise from top as user holds down
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * this.longPressProgress);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(169, 169, 169, 0.8)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    private attractStars(): void
    {
        this.stars.forEach(star =>
        {
            const dx = star.x - mouseX;
            const dy = star.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const ATTRACTION_RADIUS = getAttractionRadius();

            // Stars within radius smoothly move toward cursor unless already collapsing or resetting
            if (distance < ATTRACTION_RADIUS && !star.isCollapsingToBlackHole && !star.isResetting)
            {
                star.targetX = mouseX;
                star.targetY = mouseY;
                star.attractionTimer = 500;
            }
        });
    }

    private handleReset(): void
    {
        if (this.blackHole && this.blackHole.shouldReset() && !this.hasResetStarted)
        {
            this.hasResetStarted = true;
            const finalPosition = this.blackHole.getFinalPosition();
            
            // Staggered star reset creates visual wave effect spreading from black hole
            this.stars.forEach((star, index) =>
            {
                const delay = index * 2;
                star.startReset(finalPosition.x, finalPosition.y, delay);
            });
            
            // Clear shooting stars after brief delay to allow collapse animation to complete
            setTimeout(() =>
            {
                this.shootingStars = [];
            }, 1000);
            
            // Mark reset complete after full animation sequence to prevent retriggering
            setTimeout(() =>
            {
                this.hasResetStarted = false;
                if (this.blackHole)
                    this.blackHole.markResetComplete();
            }, RESET_DURATION * 16.67 + 2000);
        }
    }

    private draw(): void
    {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Skip computationally expensive features in throttle mode to maintain game performance
        if (!this.throttleMode)
        {
            this.handleReset();

            // Normal mouse attraction only applies when not in special animation states
            if (!this.blackHole || (!this.blackHole.shouldCollapseStars() && !this.blackHole.shouldReset()))
                this.attractStars();

            // Initiate background star collapse with distance-based delays for wave effect
            if (this.blackHole && this.blackHole.shouldCollapseStars())
            {
                this.stars.forEach((star) =>
                {
                    if (!star.isCollapsingToBlackHole && !star.isResetting)
                    {
                        const dx = star.x - this.blackHole!.x;
                        const dy = star.y - this.blackHole!.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const delay = (distance / 10) * 50;
                        
                        star.startCollapseToBlackHole(this.blackHole!.x, this.blackHole!.y, delay);
                    }
                });
            }
        }

        this.stars.forEach(star =>
        {
            star.update(this.blackHole?.x, this.blackHole?.y);
            star.draw(this.ctx);
        });

        // Planets continue spawning and moving even during throttle mode for visual continuity
        this.spawnPlanet();
        this.updatePlanets();
        this.planets.forEach(planet =>
        {
            planet.draw(this.ctx);
        });

        // Stop creating new shooting stars during black hole collapse or reset sequences
        if (!this.blackHole || (this.blackHole.collapseState === CollapseState.NORMAL))
            this.spawnShootingStar();
        
        this.updateShootingStars();
        
        if (this.blackHole)
        {
            this.blackHole.update();
            this.blackHole.draw(this.ctx);
        }
        
        this.shootingStars.forEach(shootingStar =>
        {
            shootingStar.draw(this.ctx);
        });

        this.updateLongPress();
        this.drawLongPressRing();
    }

    private animate(currentTime: number = 0): void
    {
        if (this.isPaused)
            return;
        
        // Frame rate limiting in throttle mode reduces CPU usage during gameplay
        if (this.throttleMode)
        {
            const elapsed = currentTime - this.lastFrameTime;
            if (elapsed < this.THROTTLE_FRAME_TIME)
            {
                this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
                return;
            }
            this.lastFrameTime = currentTime;
        }
        
        this.draw();
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }

    // Completely stops animation loop while keeping canvas visible in frozen state
    public pause(): void
    {
        this.isPaused = true;
        if (this.animationFrameId)
        {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Restarts animation loop from paused state
    public resume(): void
    {
        if (this.isPaused)
        {
            this.isPaused = false;
            this.lastFrameTime = performance.now();
            this.animate();
        }
    }

    // Reduces frame rate from 60 to 50 FPS to free up resources for game logic
    public setThrottleMode(enabled: boolean): void
    {
        this.throttleMode = enabled;
        if (enabled)
            this.lastFrameTime = performance.now();
    }

    public isThrottled(): boolean
    {
        return this.throttleMode;
    }

    public destroy(): void
    {
        if (this.animationFrameId)
            cancelAnimationFrame(this.animationFrameId);
        
        window.removeEventListener('resize', this.resizeCanvas.bind(this));
    }
}