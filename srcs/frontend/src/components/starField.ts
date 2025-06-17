class Star {
    x: number;
    y: number;
    size: number;
    opacity: number;
    speed: number;
  
    constructor(private canvasWidth: number, private canvasHeight: number) {
      this.x = Math.random() * canvasWidth;
      this.y = Math.random() * canvasHeight;
      this.size = Math.random() * (STAR_SIZE_RANGE[1] - STAR_SIZE_RANGE[0]) + STAR_SIZE_RANGE[0];
      this.opacity = Math.random() * (STAR_OPACITY_RANGE[1] - STAR_OPACITY_RANGE[0]) + STAR_OPACITY_RANGE[0];
      this.speed = this.size * 0.05;
    }
  
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      ctx.fill();
    }
  
    update(): void {
      this.y += this.speed;
      if (this.y > this.canvasHeight) {
        this.y = 0;
        this.x = Math.random() * this.canvasWidth;
      }
    }
  }
  
  // Configuration
  const STAR_COUNT = 500;
  const STAR_SIZE_RANGE: [number, number] = [0.5, 1.5];
  const STAR_OPACITY_RANGE: [number, number] = [0.1, 1];
  
  class Starfield {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private stars: Star[] = [];
    private animationFrameId: number | null = null;
  
    constructor(canvasId: string) {
      this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      const context = this.canvas.getContext('2d');
      if (!context) throw new Error('Could not get 2D context');
      this.ctx = context;
  
      this.init();
    }
  
    private init(): void {
      this.resizeCanvas();
      window.addEventListener('resize', this.resizeCanvas.bind(this));
      this.createStars();
      this.animate();
    }
  
    private resizeCanvas(): void {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      // Recreate stars when canvas resizes
      this.createStars();
    }
  
    private createStars(): void {
      this.stars = Array.from({ length: STAR_COUNT }, () => 
        new Star(this.canvas.width, this.canvas.height)
      );
    }
  
    private animate(): void {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.stars.forEach(star => {
        star.update();
        star.draw(this.ctx);
      });
  
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
  const starfield = new Starfield('starfield');
  
  // Pour nettoyer plus tard (si nécessaire)
  // starfield.destroy();