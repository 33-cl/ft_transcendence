// src/routes/games.ts
// API REST pour le contrôle et la consultation des parties Pong server-side
// Ce module expose les endpoints nécessaires pour interagir avec le jeu via HTTP/CLI

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rooms, getNextRoomName, roomExists } from '../socket/roomManager.js';
import { PongGame } from '../../game/PongGame.js';
import { validateId } from '../security.js';
import { PaddleSide } from '../../game/gameState.js';
import { verifyAuthFromRequest } from '../helpers/http/cookie.helper.js';
import { getUserById } from '../services/auth.service.js';

// Helper: Vérifier si un utilisateur fait partie d'une room
function isUserInRoom(userId: number, roomName: string): boolean {
  const room = rooms[roomName];
  if (!room || !room.playerUsernames) return false;
  
  const user = getUserById(userId);
  if (!user) return false;
  
  // Vérifier si le username de l'utilisateur est dans la room
  return Object.values(room.playerUsernames).includes(user.username);
}

// Types pour les requêtes
interface CreateGameBody {
  numPlayers?: number;
  player1?: string;
  player2?: string;
}

interface PaddleControlBody {
  player: 'LEFT' | 'DOWN' | 'RIGHT' | 'TOP';
  direction: 'up' | 'down';
}

interface GameIdParams {
  id: string;
}

// Helper: Convertir l'état du jeu en format JSON pour l'API
function serializeGameState(roomName: string) {
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

export default async function gamesRoutes(fastify: FastifyInstance) {
  
  // ============================================================================
  // GET /api/games - Liste toutes les parties actives
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
  // GET /api/games/:id - Récupère l'état complet d'une partie
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
  // POST /api/games - Crée/initialise une nouvelle partie
  // SECURITY: Route protégée par JWT
  // ============================================================================
  fastify.post<{ Body: CreateGameBody }>('/api/games', async (request: FastifyRequest<{ Body: CreateGameBody }>, reply: FastifyReply) => {
    try {
      // SECURITY: Vérifier l'authentification
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

      const { numPlayers = 2, player1, player2 } = request.body || {};

      // Validate numPlayers
      if (numPlayers !== 2 && numPlayers !== 4) {
        return reply.code(400).send({
          success: false,
          error: 'numPlayers must be 2 or 4'
        });
      }

      // Create a new room
      const roomName = getNextRoomName();
      const pongGame = new PongGame(numPlayers);

      rooms[roomName] = {
        players: [],
        maxPlayers: numPlayers,
        gameState: pongGame.state,
        isLocalGame: false,
        pongGame: pongGame,
        paddleInputs: {} as any,
        paddleBySocket: {},
        playerUsernames: {}
      };

      fastify.log.info(`Game created via API: ${roomName} (${numPlayers} players)`);

      return reply.code(201).send({
        success: true,
        game: {
          id: roomName,
          numPlayers,
          status: 'waiting',
          message: 'Game created successfully. Use /api/games/:id/start to begin.'
        }
      });
    } catch (error) {
      fastify.log.error(`Error creating game: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create game'
      });
    }
  });

  // ============================================================================
  // POST /api/games/:id/start - Démarre une partie
  // SECURITY: Route protégée par JWT
  // ============================================================================
  fastify.post<{ Params: GameIdParams }>('/api/games/:id/start', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
      // SECURITY: Vérifier l'authentification
      const currentUserId = verifyAuthFromRequest(request, reply);
      if (!currentUserId) return;

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

      const room = rooms[id];
      if (!room.pongGame) {
        return reply.code(500).send({
          success: false,
          error: 'Game instance not found'
        });
      }

      // Check if game is already running
      if (room.pongGame.state.running) {
        return reply.code(400).send({
          success: false,
          error: 'Game is already running'
        });
      }

      // Start the game
      room.pongGame.start();
      fastify.log.info(`Game started via API: ${id}`);

      return reply.send({
        success: true,
        message: 'Game started successfully',
        game: serializeGameState(id)
      });
    } catch (error) {
      fastify.log.error(`Error starting game: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to start game'
      });
    }
  });

  // ============================================================================
  // POST /api/games/:id/paddle - Contrôle un paddle (up/down)
  // SECURITY: Route protégée par JWT
  // ============================================================================
  fastify.post<{ Params: GameIdParams; Body: PaddleControlBody }>('/api/games/:id/paddle', async (request: FastifyRequest<{ Params: GameIdParams; Body: PaddleControlBody }>, reply: FastifyReply) => {
    try {
      // SECURITY: Vérifier l'authentification
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

  // ============================================================================
  // GET /api/games/:id/ball - Position de la balle
  // ============================================================================
  fastify.get<{ Params: GameIdParams }>('/api/games/:id/ball', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
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
      if (!room.gameState) {
        return reply.code(500).send({
          success: false,
          error: 'Ball state not found'
        });
      }

      return reply.send({
        success: true,
        ball: {
          x: room.gameState.ballX,
          y: room.gameState.ballY,
          vx: room.gameState.ballSpeedX,
          vy: room.gameState.ballSpeedY,
          radius: room.gameState.ballRadius
        }
      });
    } catch (error) {
      fastify.log.error(`Error getting ball position: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve ball position'
      });
    }
  });

  // ============================================================================
  // GET /api/games/:id/paddles - Position des paddles
  // ============================================================================
  fastify.get<{ Params: GameIdParams }>('/api/games/:id/paddles', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
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
      if (!room.gameState?.paddles) {
        return reply.code(500).send({
          success: false,
          error: 'Paddles state not found'
        });
      }

      return reply.send({
        success: true,
        paddles: room.gameState.paddles
      });
    } catch (error) {
      fastify.log.error(`Error getting paddles position: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve paddles position'
      });
    }
  });

  // ============================================================================
  // GET /api/games/:id/scores - Scores actuels
  // ============================================================================
  fastify.get<{ Params: GameIdParams }>('/api/games/:id/scores', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
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
      if (!room.gameState?.paddles) {
        return reply.code(500).send({
          success: false,
          error: 'Scores not found'
        });
      }

      // Extract scores from paddles
      const scores = room.gameState.paddles.map(p => ({
        side: p.side,
        score: p.score
      }));

      return reply.send({
        success: true,
        scores
      });
    } catch (error) {
      fastify.log.error(`Error getting scores: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve scores'
      });
    }
  });

  // ============================================================================
  // DELETE /api/games/:id - Arrête/supprime une partie
  // SECURITY: Route protégée par JWT + vérification que l'utilisateur fait partie de la game
  // ============================================================================
  fastify.delete<{ Params: GameIdParams }>('/api/games/:id', async (request: FastifyRequest<{ Params: GameIdParams }>, reply: FastifyReply) => {
    try {
      // SECURITY: Vérifier l'authentification
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

      // SECURITY: Vérifier que l'utilisateur fait partie de la game
      if (!isUserInRoom(currentUserId, id)) {
        return reply.code(403).send({
          success: false,
          error: 'You can only delete games you are participating in'
        });
      }

      const room = rooms[id];
      
      // Stop the game if running
      if (room.pongGame) {
        room.pongGame.stop();
      }

      // Delete the room
      delete rooms[id];
      fastify.log.info(`Game deleted via API: ${id} by user ${currentUserId}`);

      return reply.send({
        success: true,
        message: 'Game stopped and deleted successfully'
      });
    } catch (error) {
      fastify.log.error(`Error deleting game: ${error}`);
      return reply.code(500).send({
        success: false,
        error: 'Failed to delete game'
      });
    }
  });

  fastify.log.info('✅ Games API routes registered');
}
