class BackgroundCanvas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private rotationAngle: number = 0;
    private animationId: number | null = null;
    private stars: Array<{x: number, y: number, radius: number, color: string}> = [];

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
        this.startRotation();
    }

    private initializeCanvas(): void {
        // Configurer le style du canvas pour qu'il déborde de l'écran
        this.setupCanvasStyle();
        this.resizeCanvas();
        this.generateStars(); // Générer les étoiles une seule fois
    }

    private setupCanvasStyle(): void {
        // Positionner le canvas pour qu'il déborde de l'écran
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '50%';
        this.canvas.style.left = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';
        this.canvas.style.zIndex = '-1';
    }

    private resizeCanvas(): void {
        // Calculer la taille nécessaire avec une marge supplémentaire pour éviter les vides lors de la rotation
        const diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
        const canvasSize = diagonal * 1.5; // Multiplier par 1.5 pour avoir une marge confortable
        
        // Définir la taille CSS du canvas (ce que l'utilisateur voit)
        this.canvas.style.width = canvasSize + 'px';
        this.canvas.style.height = canvasSize + 'px';
        
        // Ajuster la taille réelle du canvas (pour la résolution)
        this.canvas.width = canvasSize * window.devicePixelRatio;
        this.canvas.height = canvasSize * window.devicePixelRatio;
        
        // Ajuster le contexte pour compenser le devicePixelRatio
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Régénérer les étoiles seulement si elles n'existent pas encore
        if (this.stars.length === 0) {
            this.generateStars();
        }
        
        // Redessiner le contenu
        this.draw();
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    private startRotation(): void {
        const animate = () => {
            // Incrémenter l'angle de rotation (très lentement)
            this.rotationAngle += 0.0003; // Ajustez cette valeur pour changer la vitesse
            
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    private draw(): void {
        // Calculer la taille du canvas en unités logiques
        const diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
        const canvasSize = diagonal * 1.5; // Même facteur que dans resizeCanvas
        
        // Effacer le canvas
        this.ctx.clearRect(0, 0, canvasSize, canvasSize);
        
        // Sauvegarder l'état du contexte
        this.ctx.save();
        
        // Déplacer l'origine au centre du canvas
        this.ctx.translate(canvasSize / 2, canvasSize / 2);
        
        // Appliquer la rotation
        this.ctx.rotate(this.rotationAngle);
        
        // Déplacer l'origine pour dessiner depuis le coin supérieur gauche
        this.ctx.translate(-canvasSize / 2, -canvasSize / 2);
        
        // Fond noir
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        // Dessiner les étoiles
        this.drawStars();
        
        // Restaurer l'état du contexte
        this.ctx.restore();
    }

    // Méthode pour générer les étoiles une seule fois
    private generateStars(): void {
        const diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
        const canvasSize = diagonal * 1.5; // Même facteur que dans les autres méthodes
        const starCount = 5000; // Augmenté pour couvrir la surface plus grande
        const minRadius = 0.5;
        const maxRadius = 2.5;
        
        this.stars = []; // Vider le tableau existant
        
        for (let i = 0; i < starCount; i++) {
            // Position aléatoire sur tout le canvas agrandi
            const x = Math.random() * canvasSize;
            const y = Math.random() * canvasSize;

            // Taille aléatoire
            const radius = minRadius + Math.pow(Math.random(), 3) * (maxRadius - minRadius);

            // Teinte jaune aléatoire
            const yellowTint = Math.floor(200 + Math.random() * 25); // 200 à 225
            const color = `rgb(255, 255, ${yellowTint})`;

            this.stars.push({ x, y, radius, color });
        }
    }

    // Méthode pour dessiner les étoiles pré-générées
    private drawStars(): void {
        for (const star of this.stars) {
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.fill();
        }
    }

    // Méthode pour arrêter l'animation si nécessaire
    public stopRotation(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Initialiser lorsque la page est chargée
window.addEventListener('DOMContentLoaded', () => {
    new BackgroundCanvas('background');
});