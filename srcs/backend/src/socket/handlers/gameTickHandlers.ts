// ========================================
// GAME TICK HANDLERS
// Boucle de jeu principale (120 FPS)
// ========================================

import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { PaddleSide } from '../../../game/gameState.js';
import { rooms } from '../roomManager.js';

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
 * Boucle principale du jeu (appelée 120 fois par seconde)
 * - Met à jour les positions des paddles
 * - Envoie l'état aux clients
 * - Nettoie les rooms terminées
 */
export function handleGameTick(io: any, fastify: FastifyInstance): void
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        const typedRoom = room as RoomType;
        
        // Mise à jour des jeux en cours
        if (typedRoom.pongGame && typedRoom.pongGame.state.running)
        {
            ensurePaddleInputsInitialized(typedRoom);
            updateAllPaddlesPositions(typedRoom);
            broadcastGameState(typedRoom, roomName, io);
        }
        
        // Nettoyage des jeux terminés
        if (typedRoom.pongGame && typedRoom.pongGame.state.running === false)
            cleanupFinishedRoom(typedRoom, roomName, io);
    }
}
