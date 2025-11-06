// ========================================
// PADDLE CONTROL UTILITIES
// Gestion des inputs clavier pour controler les paddles
// ========================================

import { RoomType } from '../../types.js';
import { PaddleSide } from '../../../game/gameState.js';

// ========================================
// VALIDATION
// ========================================

/**
 * Verifie si la direction est valide (up ou down)
 * Type guard pour TypeScript
 * 
 * @param direction - La direction a valider
 * @returns true si 'up' ou 'down'
 */
export function isValidDirection(direction: any): direction is 'up' | 'down'
{
    return direction === 'up' || direction === 'down';
}

/**
 * Verifie si le paddle side est valide (A, B, C ou D)
 * Type guard pour TypeScript
 * 
 * @param side - Le cote du paddle a valider
 * @returns true si A, B, C ou D
 */
export function isValidPaddleSide(side: any): side is PaddleSide
{
    return side === 'A' || side === 'B' || side === 'C' || side === 'D';
}

// ========================================
// MAPPING
// ========================================

/**
 * Convertit les alias 'left'/'right' en sides reels A/C
 * 
 * En mode local, le client peut envoyer des alias humains
 * qu'on doit convertir en coordonnees internes du serveur
 * 
 * @param player - Le nom du paddle ('left', 'right', 'A', 'B', 'C', 'D')
 * @returns Le side normalise (A, B, C ou D)
 */
export function mapPlayerAliasToPaddleSide(player: string): string
{
    if (player === 'left') return 'A';
    if (player === 'right') return 'C';
    return player;
}

// ========================================
// INPUT STATE MANAGEMENT
// ========================================

/**
 * Met a jour l'etat d'un input de paddle
 * 
 * Cette fonction modifie room.paddleInputs qui est lu par la game loop (120 FPS)
 * - keydown → isPressed = true → le paddle bouge continuellement
 * - keyup → isPressed = false → le paddle s'arrete
 * 
 * @param room - La room contenant le jeu
 * @param paddleSide - Le paddle concerne (A, B, C ou D)
 * @param direction - La direction (up ou down)
 * @param isPressed - true si touche enfoncee, false si relachee
 */
export function updatePaddleInput(
    room: RoomType,
    paddleSide: PaddleSide,
    direction: 'up' | 'down',
    isPressed: boolean
): void
{
    room.paddleInputs![paddleSide][direction] = isPressed;
}

/**
 * Tente de bouger le paddle immediatement (feedback instantane)
 * 
 * En plus du mouvement continu gere par la game loop, on fait
 * un mouvement immediat pour donner un feedback reactif au joueur
 * 
 * @param room - La room contenant le jeu
 * @param paddleSide - Le paddle a bouger
 * @param direction - La direction du mouvement
 */
export function tryMovePaddle(room: RoomType, paddleSide: string, direction: string): void
{
    try {
        room.pongGame!.movePaddle(paddleSide, direction);
    } catch (error) {
        // Ignore silently for performance
    }
}

// ========================================
// LOCAL GAME CONTROL
// ========================================

/**
 * Gere le controle de paddle en mode local
 * 
 * En mode local, un seul joueur peut controler TOUS les paddles
 * (jeu solo, contre IA, ou local 2 joueurs sur meme clavier)
 * 
 * @param room - La room contenant le jeu
 * @param socketId - L'ID du socket du joueur
 * @param player - Le paddle demande ('A', 'C', 'left', 'right', etc.)
 * @param direction - La direction ('up' ou 'down')
 * @param messageType - Type du message ('keydown' ou 'keyup')
 */
export function handleLocalGamePaddleControl(
    room: RoomType,
    socketId: string,
    player: string,
    direction: string,
    messageType: string
): void
{
    const mappedPlayer = mapPlayerAliasToPaddleSide(player);
    const allowedPaddles = room.paddleBySocket![socketId];
    
    // Verifier que ce socket peut controler ce paddle
    if (!Array.isArray(allowedPaddles) || !allowedPaddles.includes(mappedPlayer))
        return;
    
    // Valider le paddle et la direction
    if (!isValidPaddleSide(mappedPlayer) || !isValidDirection(direction))
        return;
    
    // Mettre a jour l'input
    const isPressed = messageType === 'keydown';
    updatePaddleInput(room, mappedPlayer, direction, isPressed);
    
    // Mouvement immediat sur keydown
    if (isPressed)
        tryMovePaddle(room, mappedPlayer, direction);
}

// ========================================
// ONLINE GAME CONTROL
// ========================================

/**
 * Gere le controle de paddle en mode online
 * 
 * En mode online, chaque joueur ne peut controler QU'UN SEUL paddle
 * (multijoueur avec un paddle par joueur)
 * 
 * @param room - La room contenant le jeu
 * @param socketId - L'ID du socket du joueur
 * @param player - Le paddle demande ('A', 'B', 'C' ou 'D')
 * @param direction - La direction ('up' ou 'down')
 * @param messageType - Type du message ('keydown' ou 'keyup')
 */
export function handleOnlineGamePaddleControl(
    room: RoomType,
    socketId: string,
    player: string,
    direction: string,
    messageType: string
): void
{
    const allowedPaddle = room.paddleBySocket![socketId];
    
    // Verifier que ce joueur controle bien ce paddle (anti-triche)
    if (player !== allowedPaddle)
        return;
    
    // Valider le paddle et la direction
    if (!isValidPaddleSide(player) || !isValidDirection(direction))
        return;
    
    // Mettre a jour l'input
    const isPressed = messageType === 'keydown';
    updatePaddleInput(room, player, direction, isPressed);
    
    // Mouvement immediat sur keydown
    if (isPressed)
        room.pongGame!.movePaddle(player, direction);
}
