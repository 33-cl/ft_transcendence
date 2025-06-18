class BackgroundCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(canvasId: string) {
        // Récupérer le canvas existant plutôt que d'en créer un nouveau
        const canvasElement = document.getElementById(canvasId);
        
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            throw new Error(`L'élément avec l'ID ${canvasId} n'est pas un canvas HTML`);
        }

        this.canvas = canvasElement;
        const context = this.canvas.getContext('2d');
        
        if (!context) {
            throw new Error('Impossible d\'obtenir le contexte 2D');
        }
        
        this.ctx = context;
        
        this.initializeCanvas();
        this.setupEventListeners();
    }

    private initializeCanvas(): void {
        // Pas besoin de styliser car c'est déjà fait dans le CSS
        this.resizeCanvas();
    }

    private resizeCanvas(): void {
        // Ajuster la taille réelle du canvas
        this.canvas.width = window.innerWidth * window.devicePixelRatio;
        this.canvas.height = window.innerHeight * window.devicePixelRatio;
        
        // Ajuster le contexte pour compenser le devicePixelRatio
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Redessiner le contenu
        this.draw();
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    private draw(): void {
        // Effacer le canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Fond blanc
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        
        // Ajoutez ici vos éléments de dessin personnalisés
        this.drawStars();

    }

    // Méthode pour ajouter des éléments personnalisés
    private drawStars(): void {
        const starCount = 1500;
        const minRadius = 0.5;
        const maxRadius = 2.5;
        for (let i = 0; i < starCount; i++) {
            // Random position
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;

            // Random size
            const radius = minRadius + Math.pow(Math.random(), 3) * (maxRadius - minRadius);

            // Random yellow teint
            const yellowTint = Math.floor(200 + Math.random() * 25); // 230 à 255

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgb(255, 255, ${yellowTint})`;
            this.ctx.fill();
        }
    }
}

// Initialiser lorsque la page est chargée
window.addEventListener('DOMContentLoaded', () => {
    new BackgroundCanvas('background');
});