// ========================================
// GAME TICK HANDLERS
// Boucle de jeu principale (120 FPS)
// ========================================

import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { PaddleSide } from '../../../game/gameState.js';
import { rooms } from '../roomManager.js';
import { getSocketIdForUser } from '../socketAuth.js';

// ========================================
// PADDLE INITIALIZATION
// ========================================

/**
 * Initialise l'objet paddleInputs avec les bonnes clés selon le nombre de joueurs
 */
export function initPaddleInputs(maxPlayers: number): Record<PaddleSide, { up: boolean; down: boolean }>
{
    const inputs: any = {};
    
    if (maxPlayers === 2)
    {
        inputs['LEFT'] = { up: false, down: false };
        inputs['RIGHT'] = { up: false, down: false };
    }
    else if (maxPlayers === 4)
    {
        inputs['LEFT'] = { up: false, down: false };
        inputs['DOWN'] = { up: false, down: false };
        inputs['RIGHT'] = { up: false, down: false };
        inputs['TOP'] = { up: false, down: false };
    }
    
    return inputs;
}

/**
 * S'assure que paddleInputs est initialisé pour une room
 */
export function ensurePaddleInputsInitialized(room: RoomType): void
{
    if (!room.paddleInputs)
        room.paddleInputs = initPaddleInputs(room.maxPlayers);
}

// ========================================
// PADDLE MOVEMENT
// ========================================

/**
 * Applique le mouvement d'un paddle horizontal (B ou D)
 * up = gauche, down = droite
 */
export function applyHorizontalPaddleMovement(
    paddle: any,
    input: { up: boolean; down: boolean },
    speed: number,
    canvasWidth: number
): void
{
    if (input.up)
        paddle.x = Math.max(0, paddle.x - speed);
    if (input.down)
        paddle.x = Math.min(canvasWidth - paddle.width, paddle.x + speed);
}

/**
 * Applique le mouvement d'un paddle vertical (A ou C)
 * up = haut, down = bas
 */
export function applyVerticalPaddleMovement(
    paddle: any,
    input: { up: boolean; down: boolean },
    speed: number,
    canvasHeight: number
): void
{
    if (input.up)
        paddle.y = Math.max(0, paddle.y - speed);
    if (input.down)
        paddle.y = Math.min(canvasHeight - paddle.height, paddle.y + speed);
}

/**
 * Met à jour la position de tous les paddles selon leurs inputs
 */
export function updateAllPaddlesPositions(room: RoomType): void
{
    const speed = room.pongGame!.state.paddleSpeed;
    const canvasWidth = room.pongGame!.state.canvasWidth;
    const canvasHeight = room.pongGame!.state.canvasHeight;
    
    for (const paddle of room.pongGame!.state.paddles)
    {
        const input = room.paddleInputs![paddle.side];
        if (!input)
            continue;
        
        if (paddle.side === 'DOWN' || paddle.side === 'TOP')
            applyHorizontalPaddleMovement(paddle, input, speed, canvasWidth);
        else
            applyVerticalPaddleMovement(paddle, input, speed, canvasHeight);
    }
}

// ========================================
// GAME STATE BROADCAST
// ========================================

/**
 * Envoie l'état actuel du jeu à tous les clients de la room
 */
export function broadcastGameState(room: RoomType, roomName: string, io: Server): void
{
    io.to(roomName).emit('gameState', room.pongGame!.state);
}

/**
 * Envoie l'état du jeu aux joueurs de la finale de tournoi
 * Utilise les user IDs pour trouver les socket IDs actuels
 */
export function broadcastFinalGameState(room: RoomType, io: Server): void
{
    if (!room.tournamentState || !room.tournamentState.currentMatch) return;
    
    const state = room.tournamentState;
    const oldPlayer1SocketId = state.semifinal1Winner!;
    const oldPlayer2SocketId = state.semifinal2Winner!;
    
    // Récupérer les user IDs
    const player1UserId = state.playerUserIds[oldPlayer1SocketId];
    const player2UserId = state.playerUserIds[oldPlayer2SocketId];
    
    // Récupérer les socket IDs actuels
    const player1CurrentSocketId = getSocketIdForUser(player1UserId);
    const player2CurrentSocketId = getSocketIdForUser(player2UserId);
    
    // Envoyer à chaque joueur
    if (player1CurrentSocketId) {
        io.to(player1CurrentSocketId).emit('gameState', room.pongGame!.state);
    }
    if (player2CurrentSocketId) {
        io.to(player2CurrentSocketId).emit('gameState', room.pongGame!.state);
    }
}

// ========================================
// ROOM CLEANUP
// ========================================

/**
 * Nettoie une room dont le jeu est terminé
 * Fait quitter tous les joueurs et supprime la room
 */
export function cleanupFinishedRoom(room: RoomType, roomName: string, io: Server): void
{
    for (const socketId of room.players)
    {
        const socket = io.sockets.sockets.get(socketId);
        if (socket)
            socket.leave(roomName);
    }
    room.players = [];
    delete rooms[roomName];
}

// ========================================
// MAIN TICK HANDLER
// ========================================

/**
 * Met à jour et broadcast un match de demi-finale de tournoi
 * IMPORTANT: Appelle tick() pour avancer la physique PUIS broadcast
 */
function updateSemifinalMatch(
    semifinal: any,
    semifinalNumber: number,
    io: any
): void {
    // Vérification robuste : le match peut être null ou le jeu peut être arrêté pendant la transition
    if (!semifinal || !semifinal.pongGame) return;
    if (!semifinal.pongGame.state || !semifinal.pongGame.state.running) return;
    
    // Mettre à jour les positions des paddles
    const paddleInputs = semifinal.paddleInputs;
    if (paddleInputs) {
        for (const side of ['LEFT', 'RIGHT']) {
            const input = paddleInputs[side];
            if (input) {
                if (input.up) semifinal.pongGame.movePaddle(side, 'up');
                if (input.down) semifinal.pongGame.movePaddle(side, 'down');
            }
        }
    }
    
    // Avancer la physique d'un tick AVANT de broadcast
    semifinal.pongGame.tick();
    
    // Vérifier que le jeu existe toujours avant d'envoyer (peut être null après tick si fin de match)
    if (semifinal.pongGame && semifinal.pongGame.state) {
        // Envoyer l'état du jeu aux joueurs de ce match
        io.to(semifinal.player1).emit('gameState', semifinal.pongGame.state);
        io.to(semifinal.player2).emit('gameState', semifinal.pongGame.state);
    }
}

/**
 * Boucle principale du jeu (appelée 120 fois par seconde)
 * - Avance la physique d'un tick (via pongGame.tick())
 * - Met à jour les positions des paddles
 * - Envoie l'état aux clients
 * - Nettoie les rooms terminées
 * 
 * NOTE: La physique et le broadcast sont maintenant synchronisés dans la même boucle.
 * Cela évite les duplicates et les sauts visuels causés par deux boucles désynchronisées.
 */
export function handleGameTick(io: any, fastify: FastifyInstance): void
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        const typedRoom = room as RoomType;
        
        // Gestion des tournois avec demi-finales simultanées
        if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'semifinals') {
            // Mettre à jour les 2 demi-finales (tick + broadcast dans la fonction)
            updateSemifinalMatch(typedRoom.tournamentState.semifinal1, 1, io);
            updateSemifinalMatch(typedRoom.tournamentState.semifinal2, 2, io);
            continue;
        }
        
        // Mise à jour des jeux en cours (jeux normaux et finale de tournoi)
        if (typedRoom.pongGame && typedRoom.pongGame.state.running)
        {
            ensurePaddleInputsInitialized(typedRoom);
            updateAllPaddlesPositions(typedRoom);
            
            // Avancer la physique d'un tick AVANT de broadcast
            typedRoom.pongGame.tick();
            
            // Pour la finale de tournoi, envoyer directement aux socket IDs actuels
            if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'final') {
                broadcastFinalGameState(typedRoom, io);
            } else {
                broadcastGameState(typedRoom, roomName, io);
            }
        }
        
        // Nettoyage des jeux terminés (mais pas les tournois en phase finale)
        if (typedRoom.pongGame && typedRoom.pongGame.state.running === false) {
            // Ne pas nettoyer si c'est un tournoi en phase finale (géré par handleFinalEnd)
            if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'final') {
                continue;
            }
            // Ne pas nettoyer si c'est un tournoi complété (déjà géré)
            if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'completed') {
                continue;
            }
            cleanupFinishedRoom(typedRoom, roomName, io);
        }
    }
}
