// ========================================
// PADDLE CONTROL UTILITIES
// Keyboard input management for controlling paddles
// ========================================

import { RoomType } from '../../types.js';
import { PaddleSide } from '../../../game/gameState.js';


// ========================================
// VALIDATION
// ========================================

/**
 * Checks if the direction is valid ('up' or 'down').
 * Type guard for TypeScript.
 *
 * @param direction - The direction to validate
 * @returns true if 'up' or 'down'
 */
export function isValidDirection(direction: string | undefined | null): direction is 'up' | 'down'
{
    return direction === 'up' || direction === 'down';
}

/**
 * Checks if the paddle side is valid (LEFT, DOWN, RIGHT, or TOP).
 * Type guard for TypeScript.
 *
 * @param side - The paddle side to validate
 * @returns true if LEFT, DOWN, RIGHT, or TOP
 */
export function isValidPaddleSide(side: string | undefined | null): side is PaddleSide
{
    return side === 'LEFT' || side === 'DOWN' || side === 'RIGHT' || side === 'TOP';
}


// ========================================
// INPUT STATE MANAGEMENT
// ========================================

/**
 * Updates the state of a paddle input.
 *
 * This function modifies room.paddleInputs, which is read by the game loop (120 FPS):
 * - keydown → isPressed = true → the paddle moves continuously
 * - keyup → isPressed = false → the paddle stops
 *
 * @param room - The room containing the game
 * @param paddleSide - The concerned paddle (A, B, C, or D)
 * @param direction - The direction ('up' or 'down')
 * @param isPressed - true if key is pressed, false if released
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
 * Attempts to move the paddle immediately (instant feedback).
 *
 * In addition to the continuous movement managed by the game loop,
 * this provides instant feedback to the player.
 *
 * @param room - The room containing the game
 * @param paddleSide - The paddle to move
 * @param direction - The direction to move
 */
export function tryMovePaddle(room: RoomType, paddleSide: string, direction: string): void
{
    try
    {
        room.pongGame!.movePaddle(paddleSide, direction);
    }
    catch (error)
    {
        // Silently ignore for performance
    }
}


// ========================================
// LOCAL GAME CONTROL
// ========================================

/**
 * Handles paddle control in local mode.
 *
 * In local mode, a single player can control ALL paddles
 * (solo game, against AI, or local 2 players on the same keyboard).
 *
 * @param room - The room containing the game
 * @param socketId - The socket ID of the player
 * @param player - The requested paddle ('LEFT', 'RIGHT', etc.)
 * @param direction - The direction ('up' or 'down')
 * @param messageType - Message type ('keydown' or 'keyup')
 */
export function handleLocalGamePaddleControl(
    room: RoomType,
    socketId: string,
    player: string,
    direction: string,
    messageType: string
): void
{
    const allowedPaddles = room.paddleBySocket![socketId];

    // Check if this socket can control this paddle
    if (!Array.isArray(allowedPaddles) || !allowedPaddles.includes(player))
    {
        return;
    }

    // Validate paddle and direction
    if (!isValidPaddleSide(player) || !isValidDirection(direction))
    {
        return;
    }

    // Update input
    const isPressed = messageType === 'keydown';
    updatePaddleInput(room, player, direction, isPressed);

    // Instant movement on keydown
    if (isPressed)
    {
        tryMovePaddle(room, player, direction);
    }
}


// ========================================
// ONLINE GAME CONTROL
// ========================================

/**
 * Handles paddle control in online mode.
 *
 * In online mode, each player can control ONLY ONE paddle
 * (multiplayer with one paddle per player).
 *
 * @param room - The room containing the game
 * @param socketId - The socket ID of the player
 * @param player - The requested paddle ('LEFT', 'DOWN', 'RIGHT', or 'TOP')
 * @param direction - The direction ('up' or 'down')
 * @param messageType - Message type ('keydown' or 'keyup')
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

    // Check that this player controls this paddle (anti-cheat)
    if (player !== allowedPaddle)
    {
        return;
    }

    // Validate paddle and direction
    if (!isValidPaddleSide(player) || !isValidDirection(direction))
    {
        return;
    }

    // Update input
    const isPressed = messageType === 'keydown';
    updatePaddleInput(room, player, direction, isPressed);

    // Instant movement on keydown
    if (isPressed)
    {
        room.pongGame!.movePaddle(player, direction);
    }
}
