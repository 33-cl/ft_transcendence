import { GameState, createInitialGameState, PaddleSide } from '../../game/gameState.js';
import { PongGame } from '../../game/PongGame.js';

// src/socket/roomManager.ts

export interface Room
{
  players: string[];
  maxPlayers: number;
  gameState: GameState;
  isLocalGame?: boolean; // Ajouté : flag pour indiquer si c'est un jeu local
  pongGame?: PongGame; // Ajouté : instance du jeu Pong pour cette room
  // Nouvelle structure : paddleInputs indexé par PaddleSide ('LEFT', 'DOWN', 'RIGHT', 'TOP')
  paddleInputs?: Record<PaddleSide, { up: boolean; down: boolean }>;
  // Mapping socket.id -> PaddleSide (attribution du contrôle des paddles)
  paddleBySocket?: Record<string, PaddleSide>;
  // Mapping socket.id -> username for authenticated players (online games only)
  playerUsernames?: Record<string, string>;
  // Mapping socket.id -> user_id for authenticated players (needed for tournament results)
  playerUserIds?: Record<string, number>;
  // Tournament metadata (pour les rooms de tournoi)
  tournamentId?: string;
  matchId?: number;
}

// record c'est un type typescript qui permet de creer un objet avec des cles dynamiques
// on utilise un objet pour stocker les rooms, ou la cle est le nom de la room et la valeur est un objet room
export const rooms: Record<string, Room> = {};
export let roomCounter = 1;

// Helper: vérifier si une room existe
export function roomExists(roomName: string): boolean
{
	// retourne true si la room existe, false sinon
	// le !! permet de convertir la valeur en boolean (! convertit en boolean, puis ! le re-inverse(le true devient false et vice versa))
  return !!rooms[roomName];
}

// Helper: ajouter un joueur à une room existante
export function addPlayerToRoom(roomName: string, socketId: string): boolean
{
	if (rooms[roomName]
		&& !rooms[roomName].players.includes(socketId)
		&& rooms[roomName].players.length < rooms[roomName].maxPlayers)
	{
		rooms[roomName].players.push(socketId);
		return true;
	}
	return false;
}

// Retirer le joueur de sa room
export function removePlayerFromRoom(socketId: string): void
{
	let playerRoom: string | null = null;
	for (const roomName in rooms)
	{
		if (rooms[roomName].players.includes(socketId))
		{
			playerRoom = roomName;
			break;
		}
	}
	if (playerRoom && rooms[playerRoom])
	{
		const room = rooms[playerRoom];
		const typedRoom = room as any;
		
		// PROTECTION TOURNOI : Ne pas retirer les joueurs pendant un tournoi actif
		// Les tournois gèrent leur propre cycle de vie
		if (typedRoom.isTournament && typedRoom.tournamentState) {
			const phase = typedRoom.tournamentState.phase;
			// Ne pas retirer pendant les phases actives du tournoi
			if (phase === 'waiting' || phase === 'semifinals' || phase === 'waiting_final' || phase === 'final') {
				console.log(`🛡️ removePlayerFromRoom: BLOCKED removal of ${socketId} from ${playerRoom} - tournament in phase '${phase}'`);
				return; // Ne pas retirer le joueur
			}
		}
		
		// Log pour debug
		console.log(`🔴 removePlayerFromRoom: Removing ${socketId} from ${playerRoom}, isTournament=${typedRoom.isTournament}, phase=${typedRoom.tournamentState?.phase}, players before=${room.players.length}`);
		
		// Remove the player
		room.players = room.players.filter(id => id !== socketId);
		
		// Clean up username mapping when player leaves
		if (room.playerUsernames && room.playerUsernames[socketId])
			delete room.playerUsernames[socketId];
		
		// Clean up userId mapping when player leaves
		if (room.playerUserIds && room.playerUserIds[socketId])
			delete room.playerUserIds[socketId];
		
		// Clean up paddle assignments
		if (room.paddleBySocket && room.paddleBySocket[socketId])
			delete room.paddleBySocket[socketId];
		
		if (room.players.length === 0)
			delete rooms[playerRoom];
	}
}

// Helper: récupérer la room d'un joueur
export function getPlayerRoom(socketId: string): string | null
{
	for (const roomName in rooms)
	{
		if (rooms[roomName].players.includes(socketId))
		{
			return roomName;
		}
	}
	return null;
}

// Helper: récupérer la capacité max d'une room
export function getRoomMaxPlayers(roomName: string): number | null
{
	// retourne le nombre maximum de joueurs pour une room donnee
	// si la room n existe pas, retourne null
	return rooms[roomName]?.maxPlayers ?? null;
}

// Utilitaire: générer le nom d'une nouvelle room
export function getNextRoomName(): string {
  return `room${roomCounter++}`;
}

// Helper: vérifier si un utilisateur (par socketId) est en jeu
export function isUserInGame(socketId: string): boolean
{
  const playerRoom = getPlayerRoom(socketId);
  if (!playerRoom || !rooms[playerRoom])
    return false;
  
  const room = rooms[playerRoom];
  // L'utilisateur est en jeu s'il est dans une room avec au moins 2 joueurs
  // et que le jeu a commencé (existence de pongGame)
  return room.players.length >= 2 && !!room.pongGame;
}

// Helper: vérifier si un utilisateur (par username) est en jeu
// excludeTournaments: si true, ignore les rooms de tournoi
export function isUsernameInGame(username: string, excludeTournaments: boolean = false): boolean
{
  for (const roomName in rooms)
{
    const room = rooms[roomName];
    if (room.playerUsernames)
	{
      // Vérifier si ce username est dans cette room et si le jeu a commencé
      const usernameInRoom = Object.values(room.playerUsernames).includes(username);
      if (usernameInRoom && room.players.length >= 2 && !!room.pongGame) {
        // Si on exclut les tournois et c'est un tournoi, on skip
        if (excludeTournaments && (room as any).isTournament)
          continue;
        return true;
      }
    }
  }
  return false;
}

// Helper: créer une nouvelle room avec un nom unique
export function createRoom(maxPlayers: number, roomPrefix: string = 'room'): string
{
  let roomName: string;
  do {
    roomName = `${roomPrefix}-${getNextRoomName()}`;
  } while (roomExists(roomName));
  
  const room: Room = {
    players: [],
    maxPlayers,
    gameState: createInitialGameState(),
    isLocalGame: roomPrefix === 'local'
  };
  
  rooms[roomName] = room;
  return roomName;
}
