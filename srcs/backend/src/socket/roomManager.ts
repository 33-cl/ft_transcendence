import { GameState, createInitialGameState, PaddleSide } from '../../game/gameState.js';
import { PongGame } from '../../game/pongGame.js';
import { TournamentState } from '../types.js';

export interface Room
{
  players: string[];
  maxPlayers: number;
  gameState: GameState;
  isLocalGame?: boolean;
  pongGame?: PongGame;
  paddleInputs?: Record<PaddleSide, { up: boolean; down: boolean }>;
  paddleBySocket?: Record<string, PaddleSide>;
  playerUsernames?: Record<string, string>;
  playerUserIds?: Record<string, number>;
  tournamentId?: string;
  matchId?: number;
  isTournament?: boolean;
  tournamentState?: TournamentState;
}

export const rooms: Record<string, Room> = {};
export let roomCounter = 1;

export function roomExists(roomName: string): boolean
{
  return !!rooms[roomName];
}

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

export function removePlayerFromRoom(socketId: string, force: boolean = false): void
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
		
		if (!force && typedRoom.isTournament && typedRoom.tournamentState)
		{
			const phase = typedRoom.tournamentState.phase;
			const state = typedRoom.tournamentState;
			
			if (phase === 'waiting_final' || phase === 'final')
			{
				const finalist1 = state.semifinal1Winner;
				const finalist2 = state.semifinal2Winner;
				const isFinalist = socketId === finalist1 || socketId === finalist2;
				if (isFinalist)
					return;
			}
			else if (phase === 'waiting' || phase === 'semifinals')
			{
				return;
			}
		}
		
		room.players = room.players.filter(id => id !== socketId);
		
		if (room.playerUsernames && room.playerUsernames[socketId])
			delete room.playerUsernames[socketId];
		
		if (room.playerUserIds && room.playerUserIds[socketId])
			delete room.playerUserIds[socketId];
		
		if (room.paddleBySocket && room.paddleBySocket[socketId])
			delete room.paddleBySocket[socketId];
		
		if (room.players.length === 0)
		{
			// Do not delete the room if it is an active tournament
			if (typedRoom.isTournament && typedRoom.tournamentState && typedRoom.tournamentState.phase !== 'completed')
			{
				// Keep the room alive for the tournament logic to proceed (e.g. startFinal)
			}
			else
			{
				delete rooms[playerRoom];
			}
		}
	}
}

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

export function getRoomMaxPlayers(roomName: string): number | null
{
	return rooms[roomName]?.maxPlayers ?? null;
}

export function getNextRoomName(): string
{
  return `room${roomCounter++}`;
}

export function isUserInGame(socketId: string): boolean
{
  const playerRoom = getPlayerRoom(socketId);
  if (!playerRoom || !rooms[playerRoom])
    return false;
  
  const room = rooms[playerRoom];
  // If the room has a pongGame instance, consider the user "in game" regardless of running state
  // This covers the initialization phase, countdown, etc.
  return room.players.length >= 2 && !!room.pongGame;
}

export function isUsernameInGame(username: string, excludeTournaments: boolean = false): boolean
{
  for (const roomName in rooms)
  {
    const room = rooms[roomName];
    if (room.playerUsernames)
    {
      const usernameInRoom = Object.values(room.playerUsernames).includes(username);
			if (usernameInRoom && room.players.length >= 2 && !!room.pongGame && room.pongGame.state?.running === true)
      {
        if (excludeTournaments && (room as any).isTournament)
          continue;
        return true;
      }
    }
  }
  return false;
}

export function createRoom(maxPlayers: number, roomPrefix: string = 'room'): string
{
  let roomName: string;
  do
  {
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
