// ========================================
// GAME TICK HANDLERS
// Main game loop (120 FPS)
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
 * Initializes the paddleInputs object with the correct keys depending on the number of players
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
 * Ensures that paddleInputs is initialized for a room
 */
export function ensurePaddleInputsInitialized(room: RoomType): void
{
    if (!room.paddleInputs)
    {
        room.paddleInputs = initPaddleInputs(room.maxPlayers);
    }
}

// ========================================
// PADDLE MOVEMENT
// ========================================

/**
 * Applies movement to a horizontal paddle (B or D)
 * up = left, down = right
 */
export function applyHorizontalPaddleMovement(
    paddle: any,
    input: { up: boolean; down: boolean },
    speed: number,
    canvasWidth: number
): void
{
    if (input.up)
    {
        paddle.x = Math.max(0, paddle.x - speed);
    }
    if (input.down)
    {
        paddle.x = Math.min(canvasWidth - paddle.width, paddle.x + speed);
    }
}

/**
 * Applies movement to a vertical paddle (A or C)
 * up = up, down = down
 */
export function applyVerticalPaddleMovement(
    paddle: any,
    input: { up: boolean; down: boolean },
    speed: number,
    canvasHeight: number
): void
{
    if (input.up)
    {
        paddle.y = Math.max(0, paddle.y - speed);
    }
    if (input.down)
    {
        paddle.y = Math.min(canvasHeight - paddle.height, paddle.y + speed);
    }
}

/**
 * Updates the position of all paddles according to their inputs
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
        {
            continue;
        }

        if (paddle.side === 'DOWN' || paddle.side === 'TOP')
        {
            applyHorizontalPaddleMovement(paddle, input, speed, canvasWidth);
        }
        else
        {
            applyVerticalPaddleMovement(paddle, input, speed, canvasHeight);
        }
    }
}

// ========================================
// GAME STATE BROADCAST
// ========================================

/**
 * Enriches the game state with player names for display
 */
function enrichGameStateWithPlayerNames(room: RoomType): any
{
    const state = room.pongGame!.state;

    // If there is no paddle->socket or socket->username mapping, return the state as is
    if (!room.paddleBySocket || !room.playerUsernames)
    {
        return state;
    }

    // Create a reverse mapping: PaddleSide -> username
    const paddleToUsername: Record<string, string> = {};
    for (const [socketId, paddleSide] of Object.entries(room.paddleBySocket))
    {
        const username = room.playerUsernames[socketId];
        if (username)
        {
            paddleToUsername[paddleSide as string] = username;
        }
    }

    // Enrich each paddle with the player's name
    const enrichedPaddles = state.paddles.map((paddle: any) =>
    ({
        ...paddle,
        playerName: paddleToUsername[paddle.side] || paddle.side
    }));

    // Return the enriched state (without modifying the original)
    return {
        ...state,
        paddles: enrichedPaddles
    };
}

/**
 * Enriches a state with an explicit PaddleSide -> playerName mapping.
 * Useful for tournament matches (where the state is broadcast without using broadcastGameState).
 */
function enrichStateWithSideNames(state: any, sideToName: Record<string, string>): any
{
    if (!state || !Array.isArray(state.paddles))
    {
        return state;
    }

    const enrichedPaddles = state.paddles.map((paddle: any) =>
    ({
        ...paddle,
        playerName: sideToName[paddle.side] || paddle.playerName || paddle.side
    }));

    return {
        ...state,
        paddles: enrichedPaddles
    };
}

/**
 * Sends the current game state to all clients in the room
 */
export function broadcastGameState(room: RoomType, roomName: string, io: Server): void
{
    const enrichedState = enrichGameStateWithPlayerNames(room);
    io.to(roomName).emit('gameState', enrichedState);
}

/**
 * Sends the game state to the players in the tournament final
 * Uses user IDs to find the current socket IDs
 */
export function broadcastFinalGameState(room: RoomType, io: Server): void
{
    if (!room.tournamentState || !room.tournamentState.currentMatch)
    {
        return;
    }

    const state = room.tournamentState;
    const oldPlayer1SocketId = state.semifinal1Winner!;
    const oldPlayer2SocketId = state.semifinal2Winner!;

    // Get user IDs
    const player1UserId = state.playerUserIds[oldPlayer1SocketId];
    const player2UserId = state.playerUserIds[oldPlayer2SocketId];

    // Get current socket IDs
    const player1CurrentSocketId = getSocketIdForUser(player1UserId);
    const player2CurrentSocketId = getSocketIdForUser(player2UserId);

    // Enrich with usernames (final = LEFT: semifinal1Winner, RIGHT: semifinal2Winner)
    const leftName = state.playerUsernames[oldPlayer1SocketId] || 'P1';
    const rightName = state.playerUsernames[oldPlayer2SocketId] || 'P2';
    const enrichedState = enrichStateWithSideNames(room.pongGame!.state, { LEFT: leftName, RIGHT: rightName });

    // Send to each player
    if (player1CurrentSocketId)
    {
        io.to(player1CurrentSocketId).emit('gameState', enrichedState);
    }
    if (player2CurrentSocketId)
    {
        io.to(player2CurrentSocketId).emit('gameState', enrichedState);
    }
}

// ========================================
// ROOM CLEANUP
// ========================================

/**
 * Cleans up a room where the game is finished
 * Makes all players leave and deletes the room
 */
export function cleanupFinishedRoom(room: RoomType, roomName: string, io: Server): void
{
    for (const socketId of room.players)
    {
        const socket = io.sockets.sockets.get(socketId);
        if (socket)
        {
            socket.leave(roomName);
        }
    }
    room.players = [];
    delete rooms[roomName];
}

// ========================================
// MAIN TICK HANDLER
// ========================================

/**
 * Updates and broadcasts a tournament semifinal match
 * IMPORTANT: Calls tick() to advance physics THEN broadcasts
 * @param otherSemifinal - The other semifinal to display the real-time score
 */
function updateSemifinalMatch(
    semifinal: any,
    semifinalNumber: number,
    playerUsernames: Record<string, string> | undefined,
    io: any,
    otherSemifinal?: any
): void
{
    // Robust check: the match can be null or the game can be stopped during transition
    if (!semifinal || !semifinal.pongGame)
    {
        return;
    }
    if (!semifinal.pongGame.state || !semifinal.pongGame.state.running)
    {
        return;
    }

    // Update paddle positions
    const paddleInputs = semifinal.paddleInputs;
    if (paddleInputs)
    {
        for (const side of ['LEFT', 'RIGHT'])
        {
            const input = paddleInputs[side];
            if (input)
            {
                if (input.up) semifinal.pongGame.movePaddle(side, 'up');
                if (input.down) semifinal.pongGame.movePaddle(side, 'down');
            }
        }
    }

    // Advance physics by one tick BEFORE broadcasting
    semifinal.pongGame.tick();

    // Check that the game still exists before sending (can be null after tick if match ended)
    if (semifinal.pongGame && semifinal.pongGame.state)
    {
        const leftName = playerUsernames?.[semifinal.player1] || 'P1';
        const rightName = playerUsernames?.[semifinal.player2] || 'P2';
        const enrichedState = enrichStateWithSideNames(semifinal.pongGame.state, { LEFT: leftName, RIGHT: rightName });

        // Add information about the other semifinal for real-time display
        if (otherSemifinal && otherSemifinal.pongGame && otherSemifinal.pongGame.state)
        {
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

        // Send the game state to the players in this match
        io.to(semifinal.player1).emit('gameState', enrichedState);
        io.to(semifinal.player2).emit('gameState', enrichedState);
    }
}

/**
 * Sends the score of the other semifinal to players who have finished their match
 */
function sendOtherSemifinalUpdate(
    finishedSemifinal: any,
    ongoingSemifinal: any,
    playerUsernames: Record<string, string> | undefined,
    io: any
): void
{
    if (!ongoingSemifinal || !ongoingSemifinal.pongGame || !ongoingSemifinal.pongGame.state)
    {
        return;
    }

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

    // Send to players of the finished semifinal
    io.to(finishedSemifinal.player1).emit('otherSemifinalUpdate', updateData);
    io.to(finishedSemifinal.player2).emit('otherSemifinalUpdate', updateData);
}

/**
 * Main game loop (called 120 times per second)
 * - Advances the physics by one tick (via pongGame.tick())
 * - Updates paddle positions
 * - Sends the state to clients
 * - Cleans up finished rooms
 *
 * NOTE: Physics and broadcast are now synchronized in the same loop.
 * This avoids duplicates and visual jumps caused by two unsynchronized loops.
 */
export function handleGameTick(io: any, fastify: FastifyInstance): void
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        const typedRoom = room as RoomType;

        // Tournament management with simultaneous semifinals
        if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'semifinals')
        {
            const state = typedRoom.tournamentState;
            // Update both semifinals (tick + broadcast in the function)
            // Also pass the other semifinal to display the real-time score
            updateSemifinalMatch(state.semifinal1, 1, state.playerUsernames, io, state.semifinal2);
            updateSemifinalMatch(state.semifinal2, 2, state.playerUsernames, io, state.semifinal1);

            // Send updates to players who have finished their match
            // so they can see the score of the other semifinal in real time
            if (state.semifinal1?.finished && state.semifinal2 && !state.semifinal2.finished)
            {
                sendOtherSemifinalUpdate(state.semifinal1, state.semifinal2, state.playerUsernames, io);
            }
            if (state.semifinal2?.finished && state.semifinal1 && !state.semifinal1.finished)
            {
                sendOtherSemifinalUpdate(state.semifinal2, state.semifinal1, state.playerUsernames, io);
            }

            continue;
        }

        // Update ongoing games (normal games and tournament final)
        if (typedRoom.pongGame && typedRoom.pongGame.state.running)
        {
            ensurePaddleInputsInitialized(typedRoom);
            updateAllPaddlesPositions(typedRoom);

            // Advance physics by one tick BEFORE broadcasting
            typedRoom.pongGame.tick();

            // For the tournament final, send directly to the current socket IDs
            if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'final')
            {
                broadcastFinalGameState(typedRoom, io);
            }
            else
            {
                broadcastGameState(typedRoom, roomName, io);
            }
        }

        // Clean up finished games (but not tournaments in the final phase)
        if (typedRoom.pongGame && typedRoom.pongGame.state.running === false)
        {
            // Do not clean up if it is a tournament in the final phase (handled by handleFinalEnd)
            if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'final')
            {
                continue;
            }
            // Do not clean up if it is a completed tournament (already handled)
            if (typedRoom.isTournament && typedRoom.tournamentState?.phase === 'completed')
            {
                continue;
            }
            cleanupFinishedRoom(typedRoom, roomName, io);
        }
    }
}
