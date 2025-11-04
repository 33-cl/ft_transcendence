// src/socket/utils/roomJoining.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { RoomType } from '../../types.js';
import { getPlayerRoom, removePlayerFromRoom, rooms, createRoom } from '../roomManager.js';
import { authenticateSocket, getSocketUser } from '../socketAuth.js';
import { getUserByUsername } from '../../user.js';
import { PongGame } from '../../../game/PongGame.js';

/**
 * Parse et extrait les paramètres de la requête joinRoom
 */
export interface JoinRoomParams {
    maxPlayers: number | undefined;
    isLocalGame: boolean;
    enableAI: boolean;
    aiDifficulty: string;
    isSpectator: boolean;
    roomName: string | null;
}

export function parseJoinRoomData(data: any): JoinRoomParams {
    return {
        maxPlayers: data?.maxPlayers,
        isLocalGame: data?.isLocalGame === true,
        enableAI: data?.enableAI === true,
        aiDifficulty: data?.aiDifficulty || 'medium',
        isSpectator: data?.spectator === true,
        roomName: data?.roomName || null
    };
}

/**
 * Nettoie les assignations de paddle de l'ancienne room
 */
export function cleanupPreviousRoom(socket: Socket): void
{
    const previousRoom = getPlayerRoom(socket.id);
    
    if (previousRoom)
    {
        const oldRoom = rooms[previousRoom];
        if (oldRoom && oldRoom.paddleBySocket)
            delete oldRoom.paddleBySocket[socket.id];
        
        removePlayerFromRoom(socket.id);
        socket.leave(previousRoom);
    }
}

/**
 * Trouve une room disponible ou en crée une nouvelle
 */
export function findOrCreateRoom(params: JoinRoomParams): string
{
    let roomName = params.roomName;
    
    // Si pas de roomName fourni et maxPlayers est défini
    if (!roomName && typeof params.maxPlayers === 'number')
    {
        // Chercher une room existante non pleine
        if (!params.isLocalGame)
        {
            for (const [name, room] of Object.entries(rooms))
            {
                if (room.maxPlayers === params.maxPlayers && room.players.length < params.maxPlayers &&
                    room.isLocalGame === false)
                {
                    roomName = name;
                    break;
                }
            }
        }
        
        // creer une nouvelle room si aucune trouvee
        if (!roomName)
        {
            const roomPrefix = params.isLocalGame ? 'local' : 'multi';
            roomName = createRoom(params.maxPlayers, roomPrefix);
        }
    }
    
    return roomName as string;
}

/**
 * Gère le cas spécial des spectateurs
 * @returns true si le socket est un spectateur (et la fonction a géré tout), false sinon
 */
export function handleSpectatorJoin(socket: Socket, roomName: string, room: RoomType): boolean
{
    // Empêcher le spectate sur les jeux locaux
    if (room.isLocalGame)
    {
        socket.emit('error', { error: 'Cannot spectate local games' });
        return true;
    }
    
    socket.join(roomName);
    
    // Envoyer les données de la room au spectateur sans paddle
    socket.emit('roomJoined', {
        room: roomName,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        paddle: null,
        spectator: true
    });
    
    // Si le jeu est en cours, envoyer immédiatement l'état du jeu
    if (room.pongGame && room.pongGame.state.running)
        socket.emit('gameState', room.pongGame.state);
    
    return true;
}

/**
 * Authentifie le joueur pour les jeux en ligne
 * @returns L'utilisateur authentifié, ou null si échec
 */
export function authenticateOnlinePlayer(
    socket: Socket, 
    roomName: string, 
    room: RoomType, 
    fastify: FastifyInstance
): any | null
{
    let user = getSocketUser(socket.id);
    
    // Toujours réauthentifier depuis les cookies pour vérifier les connexions concurrentes
    const freshUser = authenticateSocket(socket, fastify);
    if (freshUser && typeof freshUser === 'object')
    {
        user = freshUser;
    }
    else if (freshUser === 'USER_ALREADY_CONNECTED')
    {
        // Utilisateur déjà connecté ailleurs
        socket.emit('error', { 
            error: 'User is already connected on another browser/tab. Please close the other connection first.',
            code: 'USER_ALREADY_CONNECTED' 
        });
        removePlayerFromRoom(socket.id);
        socket.leave(roomName);
        return null;
    }
    
    if (!user)
    {
        // Rejeter les sockets non authentifiés pour les jeux en ligne
        fastify.log.warn(`Socket ${socket.id} failed authentication for online game`);
        socket.emit('error', { error: 'Authentication failed. Please login again to play online multiplayer games.' });
        removePlayerFromRoom(socket.id);
        socket.leave(roomName);
        return null;
    }
    
    // Ajouter le username du joueur à la room
    if (!room.playerUsernames) room.playerUsernames = {};
    room.playerUsernames[socket.id] = user.username;
    fastify.log.info(`Socket ${socket.id} authenticated user ${user.username} added to room ${roomName}`);
    
    return user;
}

/**
 * Notifie les amis que les joueurs sont maintenant en jeu
 */
export function notifyFriendsGameStarted(
    room: RoomType, 
    fastify: FastifyInstance,
    broadcastUserStatusChange: Function,
    globalIo: any
): void {
    if (room.players.length !== room.maxPlayers) return;
    if (!room.playerUsernames) return;
    
    // Notifier pour TOUS les joueurs dans la room
    for (const [socketId, username] of Object.entries(room.playerUsernames)) {
        const player = getUserByUsername(username) as any;
        if (player) {
            broadcastUserStatusChange(globalIo, player.id, 'in-game', fastify);
            fastify.log.info(`🎮 Notified friends that ${username} is now in-game`);
        }
    }
}

/**
 * Démarre un jeu local (avec ou sans IA)
 */
export function startLocalGame(
    room: RoomType,
    roomName: string,
    params: JoinRoomParams,
    io: Server,
    fastify: FastifyInstance
): void {
    // Callback pour la fin du jeu local
    const localGameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        io.to(roomName).emit('gameFinished', {
            winner,
            loser,
            mode: params.enableAI ? 'ai' : 'local'
        });
        fastify.log.info(`[SOCKET] gameFinished envoyé pour jeu ${params.enableAI ? 'IA' : 'local'} room ${roomName}: ${winner.side} beat ${loser.side} (${winner.score}-${loser.score})`);
    };
    
    room.pongGame = new PongGame(room.maxPlayers!, localGameEndCallback);
    
    // Activer l'IA si demandé
    if (params.enableAI && room.maxPlayers === 2) {
        room.pongGame.enableAI(params.aiDifficulty as 'easy' | 'medium' | 'hard');
    }
    
    room.pongGame.start();
}

/**
 * Démarre un jeu en ligne (multiplayer)
 */
export function startOnlineGame(
    room: RoomType,
    roomName: string,
    handleGameEnd: Function,
    fastify: FastifyInstance,
    io: Server
): void {
    // Callback pour la fin du jeu en ligne
    const gameEndCallback = (winner: { side: string; score: number }, loser: { side: string; score: number }) => {
        handleGameEnd(roomName, room, winner, loser, fastify, io);
    };
    
    room.pongGame = new PongGame(room.maxPlayers, gameEndCallback);
    room.pongGame.start();
}
