import { GameState, createInitialGameState } from '../../Rayan/gameState.js';
import { PongGame } from '../../Rayan/pong.js';

// src/socket/roomManager.ts

export interface Room
{
  players: string[];
  maxPlayers: number;
  gameState: GameState;
  pongGame?: PongGame; // Ajouté : instance du jeu Pong pour cette room
}

// record c'est un type typescript qui permet de creer un objet avec des cles dynamiques
// on utilise un objet pour stocker les rooms, ou la cle est le nom de la room et la valeur est un objet room
export const rooms: Record<string, Room> = {};
export let roomCounter = 1;

// Helper: vérifier si une room existe
export function roomExists(roomName: string): boolean
{
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
export function removePlayerFromRoom(socketId: string)
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
	if (playerRoom)
	{
		rooms[playerRoom].players = rooms[playerRoom].players.filter(id => id !== socketId);
		if (rooms[playerRoom].players.length === 0)
		{
			delete rooms[playerRoom];
		}
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
