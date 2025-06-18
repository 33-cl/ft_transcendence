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
        // this.drawCustomElements();
    }

    // Méthode pour ajouter des éléments personnalisés
    // private drawCustomElements(): void {
    //     // Exemple : dessiner un cercle au centre
    //     this.ctx.beginPath();
    //     this.ctx.arc(
    //         window.innerWidth / 2,
    //         window.innerHeight / 2,
    //         Math.min(window.innerWidth, window.innerHeight) / 4,
    //         0,
    //         Math.PI * 2
    //     );
    //     this.ctx.fillStyle = 'rgba(100, 150, 255, 0.5)';
    //     this.ctx.fill();
    // }
}

// Initialiser lorsque la page est chargée
window.addEventListener('DOMContentLoaded', () => {
    new BackgroundCanvas('background');
});