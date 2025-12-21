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
 * Enrichit l'état du jeu avec les noms des joueurs pour l'affichage
 */
function enrichGameStateWithPlayerNames(room: RoomType): any {
    const state = room.pongGame!.state;
    
    // Si pas de mapping paddle->socket ou socket->username, retourner l'état tel quel
    if (!room.paddleBySocket || !room.playerUsernames) {
        return state;
    }
    
    // Créer un mapping inversé : PaddleSide -> username
    const paddleToUsername: Record<string, string> = {};
    for (const [socketId, paddleSide] of Object.entries(room.paddleBySocket)) {
        const username = room.playerUsernames[socketId];
        if (username) {
            paddleToUsername[paddleSide as string] = username;
        }
    }
    
    // Enrichir chaque paddle avec le nom du joueur
    const enrichedPaddles = state.paddles.map((paddle: any) => ({
        ...paddle,
        playerName: paddleToUsername[paddle.side] || paddle.side
    }));
    
    // Retourner l'état enrichi (sans modifier l'original)
    return {
        ...state,
        paddles: enrichedPaddles
    };
}

/**
 * Enrichit un état avec un mapping explicite PaddleSide -> playerName.
 * Utile pour les matchs de tournoi (où l'état est broadcast sans passer par broadcastGameState).
 */
function enrichStateWithSideNames(state: any, sideToName: Record<string, string>): any {
    if (!state || !Array.isArray(state.paddles))
        return state;

    const enrichedPaddles = state.paddles.map((paddle: any) => ({
        ...paddle,
        playerName: sideToName[paddle.side] || paddle.playerName || paddle.side
    }));

    return {
        ...state,
        paddles: enrichedPaddles
    };
}

/**
 * Envoie l'état actuel du jeu à tous les clients de la room
 */
export function broadcastGameState(room: RoomType, roomName: string, io: Server): void
{
    const enrichedState = enrichGameStateWithPlayerNames(room);
    io.to(roomName).emit('gameState', enrichedState);
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

    // Enrichir avec les usernames (finale = LEFT: semifinal1Winner, RIGHT: semifinal2Winner)
    const leftName = state.playerUsernames[oldPlayer1SocketId] || 'P1';
    const rightName = state.playerUsernames[oldPlayer2SocketId] || 'P2';
    const enrichedState = enrichStateWithSideNames(room.pongGame!.state, { LEFT: leftName, RIGHT: rightName });
    
    // Envoyer à chaque joueur
    if (player1CurrentSocketId) {
        io.to(player1CurrentSocketId).emit('gameState', enrichedState);
    }
    if (player2CurrentSocketId) {
        io.to(player2CurrentSocketId).emit('gameState', enrichedState);
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
 * @param otherSemifinal - L'autre demi-finale pour afficher le score en temps réel
 */
function updateSemifinalMatch(
    semifinal: any,
    semifinalNumber: number,
    playerUsernames: Record<string, string> | undefined,
    io: any,
    otherSemifinal?: any
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
        const leftName = playerUsernames?.[semifinal.player1] || 'P1';
        const rightName = playerUsernames?.[semifinal.player2] || 'P2';
        const enrichedState = enrichStateWithSideNames(semifinal.pongGame.state, { LEFT: leftName, RIGHT: rightName });
        
        // Ajouter les informations de l'autre demi-finale pour l'affichage en temps réel
        if (otherSemifinal && otherSemifinal.pongGame && otherSemifinal.pongGame.state) {
            const otherLeftName = playerUsernames?.[otherSemifinal.player1] || 'P1';
            const otherRightName = playerUsernames?.[otherSemifinal.player2] || 'P2';
            const otherScore = otherSemifinal.pongGame.state.score || { A: 0, C: 0 };
            
            (enrichedState as any).otherSemifinal = {
                semifinalNumber: semifinalNumber === 1 ? 2 : 1,
                player1: otherLeftName,
                player2: otherRightName,
                score1: otherScore.A || 0,
                score2: otherScore.C || 0,
                finished: otherSemifinal.finished || false
            };
        }

        // Envoyer l'état du jeu aux joueurs de ce match
        io.to(semifinal.player1).emit('gameState', enrichedState);
        io.to(semifinal.player2).emit('gameState', enrichedState);
    }
}

/**
 * Envoie le score de l'autre demi-finale aux joueurs qui ont terminé leur match
 */
function sendOtherSemifinalUpdate(
    finishedSemifinal: any,
    ongoingSemifinal: any,
    playerUsernames: Record<string, string> | undefined,
    io: any
): void {
    if (!ongoingSemifinal || !ongoingSemifinal.pongGame || !ongoingSemifinal.pongGame.state) return;
    
    const player1Name = playerUsernames?.[ongoingSemifinal.player1] || 'Player';
    const player2Name = playerUsernames?.[ongoingSemifinal.player2] || 'Player';
    const score = ongoingSemifinal.pongGame.state.score || { A: 0, C: 0 };
    
    const updateData = {
        player1: player1Name,
        player2: player2Name,
        score1: score.A || 0,
        score2: score.C || 0,
        finished: ongoingSemifinal.finished || false
    };
    
    // Envoyer aux joueurs de la demi-finale terminée
    // console.log(`📡 Sending otherSemifinalUpdate to ${finishedSemifinal.player1} and ${finishedSemifinal.player2}`);
    io.to(finishedSemifinal.player1).emit('otherSemifinalUpdate', updateData);
    io.to(finishedSemifinal.player2).emit('otherSemifinalUpdate', updateData);
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
            const state = typedRoom.tournamentState;
            // Mettre à jour les 2 demi-finales (tick + broadcast dans la fonction)
            // On passe aussi l'autre demi-finale pour afficher le score en temps réel
            updateSemifinalMatch(state.semifinal1, 1, state.playerUsernames, io, state.semifinal2);
            updateSemifinalMatch(state.semifinal2, 2, state.playerUsernames, io, state.semifinal1);
            
            // Envoyer des mises à jour aux joueurs qui ont terminé leur match
            // pour qu'ils voient le score de l'autre demi-finale en temps réel
            if (state.semifinal1?.finished && state.semifinal2 && !state.semifinal2.finished) {
                sendOtherSemifinalUpdate(state.semifinal1, state.semifinal2, state.playerUsernames, io);
            }
            if (state.semifinal2?.finished && state.semifinal1 && !state.semifinal1.finished) {
                sendOtherSemifinalUpdate(state.semifinal2, state.semifinal1, state.playerUsernames, io);
            }
            
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
