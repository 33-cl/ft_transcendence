// REST API for Pong game control and inspection
// NOTE: Most routes are for CLI/debug only - the frontend uses WebSocket for real-time game control
// Only GET routes are used by the frontend for spectate feature

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rooms, getNextRoomName, roomExists } from '../socket/roomManager.js';
import { PongGame } from '../../game/pongGame.js';
import { validateId } from '../security.js';
import { PaddleSide } from '../../game/gameState.js';
import { verifyAuthFromRequest } from '../helpers/http/cookie.helper.js';

// Request types
interface PaddleControlBody {
  player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP';
  direction: 'up' | 'down';
}

interface GameIdParams {
  id: string;
}

// Convert game state to JSON format for API responses
function serializeGameState(roomName: string)
{
  const room = rooms[roomName];
  if (!room) return null;

  return {
    id: roomName,
    status: room.pongGame?.state.running ? 'playing' : 'waiting',
    numPlayers: room.maxPlayers,
    players: room.players.length,
    ball: room.gameState ? {
      x: room.gameState.ballX,
      y: room.gameState.ballY,
      vx: room.gameState.ballSpeedX,
      vy: room.gameState.ballSpeedY,
      radius: room.gameState.ballRadius
    } : null,
    paddles: room.gameState?.paddles || [],
    scores: room.gameState?.paddles.map(p => ({ side: p.side, score: p.score })) || [],
    canvas: room.gameState ? {
      width: room.gameState.canvasWidth,
      height: room.gameState.canvasHeight
    } : null,
    createdAt: Date.now() // Approximation
  };
}

export default async function gamesRoutes(fastify: FastifyInstance)
{
  
  // ============================================================================
  // GET /api/games - List all active games
  // Used by frontend for spectate feature
  // ============================================================================
  fastify.get('/api/games', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const gamesList = Object.keys(rooms).map(roomName => {
        const room = rooms[roomName];
        return {
          id: roomName,
          status: room.pongGame?.state.running ? 'playing' : 'waiting',
          numPlayers: room.maxPlayers,
          currentPlayers: room.players.length,
          isLocalGame: room.isLocalGame || false
        };
      });

      return reply.send({
        success: true,
        count: gamesList.length,
        games: gamesList
      });
    } catch (error) {
      fastify.log.error(`Error listing games: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to list games'
      });
    }
  });

  // ============================================================================
  // GET /api/games/:id - Get complete game state
  // Used by frontend for spectate feature
  // ============================================================================
  fastify.get<{ Params: GameIdParams }>('/api/games/:id', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      // Validate game ID
      if (!id || typeof id !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid game ID'
        });
      }

      // Check if game exists
      if (!roomExists(id)) {
        return reply.code(404).send({
          success: false,
          error: 'Game not found'
        });
      }

      const gameState = serializeGameState(id);
      if (!gameState) {
        return reply.code(500).send({
          success: false,
          error: 'Failed to retrieve game state'
        });
      }

      return reply.send({
        success: true,
        game: gameState
      });
    } catch (error) {
      fastify.log.error(`Error getting game state: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve game state'
      });
    }
  });

  // ============================================================================
  // CLI/DEBUG ROUTES - Not used by frontend (WebSocket used instead)
  // Kept for debugging and CLI control purposes
  // ============================================================================

  // ============================================================================
  // POST /api/games/:id/join - Join a game as a player (CLI ONLY)
  // SECURITY: JWT protected
  // ============================================================================
  fastify.post<{ Params: GameIdParams }>('/api/games/:id/join', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      const { id } = request.params;

      if (!id || typeof id !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid game ID'
        });
      }

      if (!roomExists(id)) {
        return reply.code(404).send({
          success: false,
          error: 'Game not found'
        });
      }

      const room = rooms[id];
      
      // Check if room is full
      if (room.players.length >= room.maxPlayers) {
        return reply.code(400).send({
          success: false,
          error: 'Game is full'
        });
      }

      // Get user info
      const user = await import('../services/auth.service.js').then(m => m.getUserById(currentUserId));
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: 'User not found'
        });
      }

      // Check if already in game
      if (Object.values(room.playerUsernames || {}).includes(user.username)) {
        return reply.send({
          success: true,
          message: 'Already in game',
          paddle: room.players.indexOf('cli-player-' + user.id) >= 0 ? 
            ['LEFT', 'DOWN', 'RIGHT', 'TOP'][room.players.indexOf('cli-player-' + user.id)] : null
        });
      }

      // Add player to room
      const fakeSocketId = `cli-player-${user.id}`;
      room.players.push(fakeSocketId);

      // Assign paddle based on game mode
      let assignedPaddle: PaddleSide;
      if (room.maxPlayers === 2) {
        // 1v1: LEFT or RIGHT only
        const paddleSides: PaddleSide[] = ['LEFT', 'RIGHT'];
        assignedPaddle = paddleSides[room.players.length - 1];
      } else {
        // 4 players: LEFT, DOWN, RIGHT, TOP
        const paddleSides: PaddleSide[] = ['LEFT', 'DOWN', 'RIGHT', 'TOP'];
        assignedPaddle = paddleSides[room.players.length - 1];
      }
      
      if (!room.playerUsernames) room.playerUsernames = {};
      room.playerUsernames[assignedPaddle] = user.username;

      fastify.log.info(`User ${user.username} joined game ${id} via CLI as ${assignedPaddle}`);

      return reply.send({
        success: true,
        message: `Joined game as ${assignedPaddle}`,
        paddle: assignedPaddle
      });
    } catch (error) {
      fastify.log.error(`Error joining game: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to join game'
      });
    }
  });

  // ============================================================================
  // POST /api/games/:id/paddle - Control a paddle (CLI ONLY)
  // SECURITY: JWT protected
  // ============================================================================
  fastify.post<{ Params: GameIdParams; Body: PaddleControlBody }>('/api/games/:id/paddle', async (request: FastifyRequest<{ Params: GameIdParams; Body: PaddleControlBody }>, reply: FastifyReply) => {
    try {
      // SECURITY: Check authentication
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      const { id } = request.params;
      const { player, direction } = request.body || {};

      // Validate game ID
      if (!id || typeof id !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Invalid game ID'
        });
      }

      // Validate player and direction
      const validPlayers = ['LEFT', 'DOWN', 'RIGHT', 'TOP'];
      const validDirections = ['up', 'down'];

      if (!player || !validPlayers.includes(player)) {
        return reply.code(400).send({
          success: false,
          error: `Invalid player. Must be one of: ${validPlayers.join(', ')}`
        });
      }

      if (!direction || !validDirections.includes(direction)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid direction. Must be "up" or "down"'
        });
      }

      // Check if game exists
      if (!roomExists(id)) {
        return reply.code(404).send({
          success: false,
          error: 'Game not found'
        });
      }

      const room = rooms[id];
      if (!room.pongGame) {
        return reply.code(500).send({
          success: false,
          error: 'Game instance not found'
        });
      }

      // SECURITY: Verify user is part of this game and controls the requested paddle
      const user = await import('../services/auth.service.js').then(m => m.getUserById(currentUserId));
      if (!user) {
        return reply.code(401).send({
          success: false,
          error: 'User not found'
        });
      }

      // Check if user owns this paddle
      const paddleOwner = room.playerUsernames?.[player];
      if (paddleOwner !== user.username) {
        return reply.code(403).send({
          success: false,
          error: `You don't control the ${player} paddle. Your paddle is ${Object.keys(room.playerUsernames || {}).find(k => room.playerUsernames![k] === user.username) || 'none'}`
        });
      }

      // Check if game is running
      if (!room.pongGame.state.running) {
        return reply.code(400).send({
          success: false,
          error: 'Game is not running. Start the game first.'
        });
      }

      // Move the paddle
      room.pongGame.movePaddle(player as any, direction as any);
      fastify.log.info(`Paddle control via API: ${id} - ${player} ${direction}`);

      // Find the paddle for this player
      const paddleData = room.gameState.paddles.find(p => p.side === player);

      return reply.send({
        success: true,
        message: `Paddle ${player} moved ${direction}`,
        paddle: paddleData || null
      });
    } catch (error) {
      fastify.log.error(`Error controlling paddle: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to control paddle'
      });
    }
  });

}
