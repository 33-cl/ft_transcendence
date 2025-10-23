/**
 * Types de côtés pour les raquettes dans le jeu Pong
 * A = gauche, B = bas, C = droite, D = haut
 */
export type PaddleSide = 'A' | 'B' | 'C' | 'D';

/* Niveaux de difficulté disponibles pour l'IA */
export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Configuration de l'Intelligence Artificielle pour le mode 1 joueur
 * Contrôle le comportement du paddle automatique (paddle gauche en mode 1v1)
 * Simule des inputs clavier comme un joueur humain
 */
export interface AIConfig {
    enabled: boolean;          // Active/désactive l'IA (false = mode 2 joueurs humains)
    difficulty: AIDifficulty;  // Niveau de difficulté (easy/medium/hard)
    reactionTime: number;      // Délai de réaction en millisecondes (300-700ms)
    errorMargin: number;       // Marge d'erreur en pixels pour les erreurs aléatoires (5-15px)
    lastUpdate: number;        // Timestamp de la dernière mise à jour des calculs IA
    targetY: number;           // Position Y cible calculée par l'IA
    currentY: number;          // Position Y actuelle du paddle IA (mise à jour par movePaddle)
    isMoving: boolean;         // Indique si le paddle IA est en mouvement
    reactionStartTime: number; // Timestamp du début du délai de réaction
    paddleSpeed: number;       // Vitesse de déplacement du paddle IA (identique aux joueurs)
    
    // Simulation des touches clavier
    keyPressed: 'up' | 'down' | null;  // Touche actuellement "pressée" par l'IA
    keyPressStartTime: number;         // Timestamp du début de la pression
    keyHoldDuration: number;           // Durée minimale de maintien d'une touche
    keyReleaseChance: number;          // Probabilité de relâcher prématurément la touche
    
    // Nouveaux comportements humains
    panicMode: boolean;                // L'IA est-elle en mode panique ?
    lastDecisionTime: number;          // Dernière fois qu'elle a changé d'avis
    microcorrectionTimer: number;      // Timer pour les micro-corrections
    panicThreshold: number;            // Distance balle où l'IA panique
    microcorrectionChance: number;     // Probabilité de micro-corrections
    persistanceTime: number;           // Temps avant de changer d'avis
    maxErrorFrequency: number;         // Fréquence maximale d'erreurs importantes
    
    // Debug et statistiques (pour l'évaluation)
    debugMode: boolean;                // Active les logs de debug
    decisionCount: number;             // Nombre de décisions prises
    errorCount: number;                // Nombre d'erreurs commises
    panicCount: number;                // Nombre de fois en mode panique
}

/**
 * Interface définissant l'état complet d'une partie de Pong
 * Contient toutes les informations nécessaires pour le rendu et la logique du jeu
 */
export interface GameState{
    // Dimensions du canvas de jeu
    canvasHeight:   number;
    canvasWidth:    number;

    // Propriétés des raquettes
    paddleHeight:   number;    // Hauteur des raquettes verticales (A, C)
    paddleWidth:    number;    // Largeur des raquettes verticales / hauteur des horizontales
    paddleMargin:   number;    // Distance entre les raquettes et les bords du canvas
    paddles: 
    {
        x: number;             // Position X de la raquette
        y: number;             // Position Y de la raquette
        width: number;         // Largeur de la raquette (varie selon orientation)
        height: number;        // Hauteur de la raquette (varie selon orientation)
        side: PaddleSide;      // Côté où se trouve la raquette (A, B, C, D)
        score: number;         // Score actuel du joueur
    }[];
    paddleSpeed:    number;    // Vitesse de déplacement des raquettes

    // Propriétés de la balle
    ballX:          number;    // Position X de la balle
    ballY:          number;    // Position Y de la balle
    ballRadius:     number;    // Rayon de la balle
    ballSpeedX:     number;    // Vitesse horizontale de la balle
    ballSpeedY:     number;    // Vitesse verticale de la balle

    // État de la partie
    win:            number;    // Score à atteindre pour gagner
    running:        boolean;   // Indique si la partie est en cours
    ballCountdown:  number;    // Compte à rebours avant que la balle commence à bouger
    
    // Timestamp pour l'interpolation client
    timestamp?:     number;    // Temps serveur (ms) au moment de l'émission de l'état
    
    // Configuration IA (pour le 1v1, undefined pour les autre mode)
    aiConfig: AIConfig | undefined;
}

/**
 * Crée l'état initial d'une partie de Pong
 * @param numPlayers Nombre de joueurs (2 pour 1v1, 4 pour battle royale)
 * @returns L'état initial du jeu avec les raquettes positionnées correctement
 */
export function createInitialGameState(numPlayers: number = 2): GameState {
    // Constantes de configuration du jeu - Canvas agrandi pour meilleure visibilité
    const canvasHeight  = 800;   // Hauteur du terrain de jeu (650 -> 800)
    const canvasWidth   = 1200;  // Largeur du terrain de jeu (850 -> 1200)
    const paddleHeight  = 135;   // Hauteur des raquettes verticales (110 -> 135)
    const paddleWidth   = 12;    // Largeur des raquettes verticales (10 -> 12)
    const paddleMargin  = 12;    // Marge entre raquettes et bords (10 -> 12)
    const paddleY       = canvasHeight / 2 - paddleHeight / 2; // Position Y par défaut (centré)

    // Ordre des côtés pour l'attribution des raquettes
    const paddleSides: PaddleSide[] = ['A', 'B', 'C', 'D'];
    const paddles: { x: number; y: number; width: number; height: number; side: PaddleSide; score: number }[] = [];
    
    // Création et positionnement des raquettes selon le nombre de joueurs
    for (let i = 0; i < numPlayers; i++) {
        let side = paddleSides[i];
        let x = 0, y = paddleY, width = paddleWidth, height = paddleHeight;
        
        if (numPlayers === 2) 
        {
            // Mode 1v1 : on veut A (gauche) et C (droite), pas B
            // Cela donne une disposition classique de Pong horizontal
            if (i === 1) 
                side = 'C' as PaddleSide; // Deuxième paddle = C au lieu de B
            if (side === 'A')
                x = paddleMargin;                               // Raquette gauche
            else if (side === 'C')
                x = canvasWidth - paddleMargin - paddleWidth;   // Raquette droite
        } 
        else if (numPlayers === 4) 
        {
            // Mode 1v1v1v1 : disposition carrée avec 4 paddles (battle royale)
            // Chaque raquette est sur un côté différent du terrain
            if (side === 'A') {
                // Paddle A : gauche (vertical)
                x = paddleMargin;
                y = canvasHeight / 2 - paddleHeight / 2;
                width = paddleWidth;
                height = paddleHeight;
            } else if (side === 'B') {
                // Paddle B : bas (horizontal)
                x = canvasWidth / 2 - paddleHeight / 2;
                y = canvasHeight - paddleMargin - paddleWidth;
                width = paddleHeight; // 110 pixels de largeur (horizontale)
                height = paddleWidth; // 10 pixels de hauteur (horizontale)
            } else if (side === 'C') {
                // Paddle C : droite (vertical)
                x = canvasWidth - paddleMargin - paddleWidth;
                y = canvasHeight / 2 - paddleHeight / 2;
                width = paddleWidth;
                height = paddleHeight;
            } else if (side === 'D') {
                // Paddle D : haut (horizontal) - même taille que B
                x = canvasWidth / 2 - paddleHeight / 2;
                y = paddleMargin;
                width = paddleHeight; // 110 pixels de largeur (même que B)
                height = paddleWidth; // 10 pixels de hauteur (même que B)
            }
        }
        
        // Ajouter la raquette configurée à la liste
        paddles.push({ x, y, width, height, side, score: 0 });
    }
    // Retourner l'état initial complet du jeu
    return {
        // Configuration du terrain
        canvasHeight:   canvasHeight,
        canvasWidth:    canvasWidth,
        
        // Configuration des raquettes
        paddleHeight:   paddleHeight,
        paddleWidth:    paddleWidth,
        paddleMargin:   paddleMargin,
        paddles:        paddles,
        paddleSpeed:    24,              // Vitesse de déplacement des raquettes (20 -> 24 pour canvas plus grand)
        
        // Configuration de la balle
        ballX:          canvasWidth / 2,  // Position initiale au centre X
        ballY:          canvasHeight / 2, // Position initiale au centre Y
        ballRadius:     18,               // Rayon de la balle ajusté (15 -> 18)
        ballSpeedX:     6.5,              // Vitesse horizontale initiale ajustée (4 -> 5.5)
        ballSpeedY:     6.5,              // Vitesse verticale initiale ajustée (4 -> 5.5)
        
        // Configuration de la partie
        win:            3,                // Nombre de points pour gagner
        running:        false,            // Partie non démarrée au début
        ballCountdown:  3,                // Délai de 3 secondes avant que la balle commence
        
        // Timestamp de création de l'état
        timestamp:      Date.now(),       // Temps de création pour l'interpolation client
        
        // Configuration IA (désactivée par défaut)
        aiConfig:       undefined,        // Pas d'IA par défaut (mode 2 joueurs humains)
    };
}
