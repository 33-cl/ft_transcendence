/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: maeferre <maeferre@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/07/01 22:25:00 by maeferre         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// src/socket/socketHandlers.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import https from 'https';
import { PongGame } from '../../Rayan/pong.js';
import { Buffer } from 'buffer';
import { createInitialGameState } from '../../Rayan/gameState.js';
import { PaddleSide } from '../../Rayan/gameState.js';

// Mutex to prevent concurrent joinRoom for the same socket
const joinRoomLocks = new Set<string>();

// Vérifie si le client peut rejoindre la room (nom valide et room existante)
function canJoinRoom(socket: Socket, roomName: string): boolean {
	if (!roomName || typeof roomName !== 'string')
	{
		socket.emit('error', { error: 'roomName requested' });
		return false;
	}
	if (!roomExists(roomName))
	{
		socket.emit('error', { error: 'Room does not exist' });
		return false;
	}
	return true;
}

// Vérifie si la room est pleine
function handleRoomFull(socket: Socket, room: RoomType, fastify: FastifyInstance): boolean
{
	if (room.players.length >= room.maxPlayers)
	{
		// Protection : refuse si la room est pleine
		socket.emit('error', { error: 'Room is full' });
		return true;
	}
	return false;
}

// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket: Socket, fastify: FastifyInstance, io?: Server) {
    for (const rName in rooms)
    {
        if (rooms[rName].players.includes(socket.id))
        {
			// room actuelle = room actuelle - client actuel
            rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
            if (rooms[rName].players.length === 0) {
                delete rooms[rName];
                // Suppression silencieuse de la room vide (log retiré)
            }
            else
			{
                const room = rooms[rName];
                // Si la partie est en cours, on stoppe et on supprime la room (ranked)
                if (room.pongGame && room.pongGame.state && room.pongGame.state.running === true)
				{
                    room.pongGame.stop();
                    // On retire tous les joueurs restants via leurs socket et on supprime la room
                    if (io)
					{
                        for (const socketId of room.players)
						{
							//ne pas retirer le client actu c deja fait
                            if (socketId !== socket.id && io.sockets.sockets.get(socketId))
							{
                                io.sockets.sockets.get(socketId)?.leave(rName);
                            }
                        }
                    }
                    room.players = [];
                    delete rooms[rName];
                    break;
                }
                // RESET COMPLET DE LA ROOM, la remettre a 0 
                const gameEnded = room.pongGame && room.pongGame.state && room.pongGame.state.running === false;
                if (gameEnded)
				{
                    delete room.pongGame;
                    delete room.paddleBySocket;
                    delete room.paddleInputs;
                    room.gameState = createInitialGameState();
                }
            }
        }
    }
}

// Ajoute le joueur à la room et le fait rejoindre côté socket.io
// Ajout : attribution dynamique des paddles pour 1v1v1
function assignPaddleToPlayer(room: RoomType): PaddleSide | null {
    const paddleSides: PaddleSide[] = ['A', 'B', 'C'];
    for (const side of paddleSides.slice(0, room.maxPlayers)) {
        if (!room.paddleBySocket || !Object.values(room.paddleBySocket).includes(side)) {
            return side;
        }
    }
    return null;
}

// Modifie joinPlayerToRoom pour gérer le mode 1v1v1
function joinPlayerToRoom(socket: Socket, roomName: string, room: RoomType, io?: Server)
{
    //si le joueur n'est pas déjà dans la room, on l'ajoute
    if (!room.players.includes(socket.id))
    {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    // --- Attribution automatique du contrôle paddle (1v1, 1v1v1, 2v2) ---
    // Ajout : si isLocalGame, attribuer tous les paddles au même socket
    if (room.isLocalGame) {
        if (!room.paddleBySocket) room.paddleBySocket = {};
        if (room.maxPlayers === 2) {
            room.paddleBySocket[socket.id] = ['A', 'C']; // A = gauche, C = droite (B reste pour horizontal en 1v1v1)
        } else if (room.maxPlayers === 3) {
            room.paddleBySocket[socket.id] = ['A', 'B', 'C'];
        }
        // Broadcast à toute la room l'état matchmaking
        if (io) {
            for (const id of room.players) {
                const targetSocket = io.sockets.sockets.get(id);
                if (!targetSocket) continue;
                targetSocket.emit('roomJoined', {
                    room: roomName,
                    players: room.players.length,
                    maxPlayers: room.maxPlayers,
                    paddle: room.paddleBySocket[id]
                });
            }
        } else {
            socket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: room.paddleBySocket[socket.id]
            });
        }
        return;
    }
    if (room.maxPlayers === 2 || room.maxPlayers === 3 || room.maxPlayers === 4)
	{
		if (!room.paddleBySocket) room.paddleBySocket = {};
		// Purge les anciennes attributions de paddle (joueurs plus dans la room)
		for (const id in room.paddleBySocket)
		{
			if (!room.players.includes(id))
				delete room.paddleBySocket[id];
		}
		// Attribution stricte selon l'ordre d'arrivée dans la room
		if (!(socket.id in room.paddleBySocket))
		{
			if (room.maxPlayers === 2) {
				// En mode 1v1 (local et non-local) : toujours A=gauche et C=droite
				// B reste réservé pour le paddle horizontal du mode 1v1v1
				const paddles = ['A', 'C'];
				const idx = room.players.indexOf(socket.id);
				room.paddleBySocket[socket.id] = paddles[idx] || null;
				console.log(`[BACKEND] Attribution paddle 1v1: socketId=${socket.id}, index=${idx}, paddle=${paddles[idx]}, isLocal=${room.isLocalGame}`);
			} else if (room.maxPlayers === 3) {
				// Attribution dynamique pour 1v1v1
				const paddle = assignPaddleToPlayer(room);
				room.paddleBySocket[socket.id] = paddle;
			} else if (room.maxPlayers === 4) {
				const paddles = ['left', 'right', 'top', 'bottom'];
				const idx = room.players.indexOf(socket.id);
				room.paddleBySocket[socket.id] = paddles[idx] || null;
			}
		}
		// --- Broadcast à toute la room l'état matchmaking ---
		if (io)
		{
			for (const id of room.players)
			{
				const targetSocket = io.sockets.sockets.get(id);
				if (!targetSocket) continue;
				targetSocket.emit('roomJoined',
				{
					room: roomName,
					players: room.players.length,
					maxPlayers: room.maxPlayers,
					paddle: room.paddleBySocket[id]
				});
				console.log(`[BACKEND] roomJoined envoyé à ${id}: paddle=${room.paddleBySocket[id]}, players=${room.players.length}/${room.maxPlayers}`);
			}
		}
		else
		{
			socket.emit('roomJoined',
			{
				room: roomName,
				players: room.players.length,
				maxPlayers: room.maxPlayers,
				paddle: room.paddleBySocket[socket.id]
			});
			console.log(`[BACKEND] roomJoined envoyé à ${socket.id}: paddle=${room.paddleBySocket[socket.id]}, players=${room.players.length}/${room.maxPlayers}`);
		}
		return;
	}
	// Cas générique (solo, etc.)
	socket.emit('roomJoined', {
		room: roomName,
		players: room.players.length,
		maxPlayers: room.maxPlayers
	});
}

// Handler pour rejoindre ou créer une room
async function handleJoinRoom(socket: Socket, data: any, fastify: FastifyInstance, io: Server)
{
    if (joinRoomLocks.has(socket.id))
    {
        fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
        return;
    }
    joinRoomLocks.add(socket.id);
    try
    {
        const maxPlayers = data?.maxPlayers;
        const isLocalGame = data?.isLocalGame === true; // <--- Ajout
        const previousRoom = getPlayerRoom(socket.id);
        let roomName = data?.roomName;
        if (!roomName && typeof maxPlayers === 'number')
        {
            roomName = null;
            for (const [name, room] of Object.entries(rooms))
            {
                if (room.maxPlayers === maxPlayers && room.players.length < maxPlayers)
                {
                    roomName = name;
                    break;
                }
            }
            if (!roomName)
            {
                // Création de la room via l'API REST (POST /rooms)
                // NOTE : Le backend s'auto-appelle ici en HTTPS pour garantir que toute création de room
                // passe par l'API REST
                // L'option rejectUnauthorized: false permet d'accepter les certificats auto-signés.
                const postData = JSON.stringify({ maxPlayers });
                const options = {
                    hostname: 'localhost',
                    port: 8080,
                    path: '/rooms',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    rejectUnauthorized: false // pour auto-signé en dev
                };
                roomName = await new Promise((resolve, reject) =>
                {
                    const req = https.request(options, (res: any) =>
                    {
                        let data = '';
                        res.on('data', (chunk: any) => { data += chunk; });
                        res.on('end', () =>
                        {
                            try
                            {
                                const json = JSON.parse(data);
                                resolve(json.roomName);
                            }
                            catch (e) { reject(e); }
                        });
                    });
                    req.on('error', reject);
                    req.write(postData);
                    req.end();
                });
            }
        }
        if (!canJoinRoom(socket, roomName))
            return;
        const room = rooms[roomName] as RoomType;
        // Ajout : stocke le flag isLocalGame dans la room
        if (isLocalGame) room.isLocalGame = true;
        if (handleRoomFull(socket, room, fastify))
            return;
        if (previousRoom)
        {
            removePlayerFromRoom(socket.id);
            socket.leave(previousRoom);
            fastify.log.info(`[DEBUG] socket.id=${socket.id} leave previousRoom=${previousRoom}`);
        }
        cleanUpPlayerRooms(socket, fastify, io);
        joinPlayerToRoom(socket, roomName, room, io);
        // --- Ajout : en local, on démarre la partie immédiatement ---
        if (isLocalGame && !room.pongGame) {
            room.pongGame = new PongGame(room.maxPlayers);
            room.pongGame.start();
        }
        // --- Sinon, comportement normal ---
        else if (!room.pongGame && room.players.length === room.maxPlayers)
        {
            room.pongGame = new PongGame(room.maxPlayers);
            room.pongGame.start();
        }
    }
    finally
    {
        joinRoomLocks.delete(socket.id);
    }
}

// Helper pour initialiser paddleInputs avec toutes les clés nécessaires
function initPaddleInputs(maxPlayers: number): Record<PaddleSide, { up: boolean; down: boolean }> {
    const inputs: any = {};
    
    if (maxPlayers === 2) {
        // Mode 1v1 : utiliser A (gauche) et C (droite)
        inputs['A'] = { up: false, down: false };
        inputs['C'] = { up: false, down: false };
    } else if (maxPlayers === 3) {
        // Mode 1v1v1 : utiliser A, B et C
        inputs['A'] = { up: false, down: false };
        inputs['B'] = { up: false, down: false };
        inputs['C'] = { up: false, down: false };
    }
    
    console.log(`[DEBUG] initPaddleInputs pour ${maxPlayers} joueurs:`, Object.keys(inputs));
    return inputs;
}

// Tick global pour toutes les rooms avec un jeu en cours (adapté pour paddles dynamiques)
function handleGameTick(io: any)
{
    for (const [roomName, room] of Object.entries(rooms))
    {
        const typedRoom = room as RoomType; // Cast pour éviter l'erreur TS2339
        if (typedRoom.pongGame && typedRoom.pongGame.state.running)
        {
            // Initialise l'état des touches pour chaque paddle si besoin
            if (!typedRoom.paddleInputs) {
                typedRoom.paddleInputs = initPaddleInputs(typedRoom.maxPlayers);
            }
            // Applique le mouvement pour chaque paddle
            const speed = typedRoom.pongGame.state.paddleSpeed;
            for (const paddle of typedRoom.pongGame.state.paddles) {
                const input = typedRoom.paddleInputs[paddle.side];
                if (!input) continue;
                
                // Paddle B horizontal : bouge sur l'axe X
                if (paddle.side === 'B') {
                    if (input.up) // up = gauche pour paddle horizontal
                        paddle.x = Math.max(0, paddle.x - speed);
                    if (input.down) // down = droite pour paddle horizontal
                        paddle.x = Math.min(typedRoom.pongGame.state.canvasWidth - paddle.width, paddle.x + speed);
                } else {
                    // Paddles A et C verticaux : bougent sur l'axe Y
                    if (input.up)
                        paddle.y = Math.max(0, paddle.y - speed);
                    if (input.down)
                        paddle.y = Math.min(typedRoom.pongGame.state.canvasHeight - paddle.height, paddle.y + speed);
                }
            }
            // --- LOG DEBUG : Affiche les paddles envoyés en local ---
            if (typedRoom.isLocalGame) {
                console.log(`[DEBUG LOCAL] room=${roomName} paddles=`, JSON.stringify(typedRoom.pongGame.state.paddles));
            }
            // Envoie l'état du jeu à tous les clients de la room
            io.to(roomName).emit('gameState', typedRoom.pongGame.state);
            
            // Log pour vérifier les scores envoyés
            if (typedRoom.pongGame.state.paddles && typedRoom.pongGame.state.paddles.some((p: any) => p.score > 0)) {
                console.log(`[DEBUG SCORES] room=${roomName} scores=`, typedRoom.pongGame.state.paddles.map((p: any) => p.score));
            }
        }
        // --- NETTOYAGE AUTO DES ROOMS FINIES (ranked) ---
        if (typedRoom.pongGame && typedRoom.pongGame.state.running === false)
        {
            for (const socketId of typedRoom.players)
            {
                if (io.sockets.sockets.get(socketId))
                    io.sockets.sockets.get(socketId)?.leave(roomName);
            }
            typedRoom.players = [];
            delete rooms[roomName];
        }
    }
}

// Handler pour les messages relayés dans la room (adapté pour paddleInputs dynamiques)
function handleSocketMessage(socket: Socket, msg: string)
{
    let message: any;
    try {
        message = JSON.parse(msg);
    } catch (e) { return; }
    
    // Log pour voir TOUS les messages reçus
    console.log(`[BACKEND] Message reçu de ${socket.id}: type=${message.type}, data=${JSON.stringify(message.data)}`);
    
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;
    const room = rooms[playerRoom] as RoomType;
    if (!room.paddleInputs) {
        room.paddleInputs = initPaddleInputs(room.maxPlayers);
    }
    // Ajout : en local, le client peut contrôler tous les paddles
    if ((message.type === 'keydown' || message.type === 'keyup') && room.pongGame && room.paddleBySocket) {
        const { player, direction } = message.data || {};
        const allowedPaddle = room.paddleBySocket[socket.id];
        console.log(`[BACKEND] Handler keydown/keyup: player=${player}, allowedPaddle=${JSON.stringify(allowedPaddle)}, isLocalGame=${room.isLocalGame}`);
        if (room.isLocalGame) {
            // Mapping pour 1v1 local : left/right → A/C (B reste pour 1v1v1 horizontal)
            let mappedPlayer = player;
            if (player === 'left') mappedPlayer = 'A';
            else if (player === 'right') mappedPlayer = 'C'; // Changé de B vers C
            
            console.log(`[BACKEND] Mapping: ${player} → ${mappedPlayer}, allowedPaddle=${JSON.stringify(allowedPaddle)}`);
            
            // allowedPaddle est un tableau de sides
            if (Array.isArray(allowedPaddle) && allowedPaddle.includes(mappedPlayer)) {
                console.log(`[BACKEND] Paddle autorisé, traitement de ${mappedPlayer} ${direction}`);
                if ((mappedPlayer === 'A' || mappedPlayer === 'B' || mappedPlayer === 'C' || mappedPlayer === 'left' || mappedPlayer === 'right') && (direction === 'up' || direction === 'down')) {
                    room.paddleInputs[mappedPlayer as PaddleSide][direction as 'up' | 'down'] = (message.type === 'keydown');
                    // Appliquer immédiatement le mouvement au jeu
                    if (message.type === 'keydown') {
                        console.log(`[BACKEND] Appel movePaddle(${mappedPlayer}, ${direction})`);
                        try {
                            room.pongGame.movePaddle(mappedPlayer, direction);
                            console.log(`[BACKEND] movePaddle réussi`);
                        } catch (error) {
                            console.error(`[BACKEND] Erreur dans movePaddle:`, error);
                        }
                    }
                }
            } else {
                console.log(`[BACKEND] Paddle NON autorisé: ${mappedPlayer} pas dans ${JSON.stringify(allowedPaddle)}`);
            }
        } else {
            if (player !== allowedPaddle) return;
            if ((player === 'A' || player === 'B' || player === 'C') && (direction === 'up' || direction === 'down')) {
                room.paddleInputs[player as PaddleSide][direction as 'up' | 'down'] = (message.type === 'keydown');
                // Appliquer immédiatement le mouvement au jeu
                if (message.type === 'keydown') {
                    room.pongGame.movePaddle(player, direction);
                }
            }
        }
    }
}

// Handler pour la déconnexion du client
function handleSocketDisconnect(socket: Socket)
{
    removePlayerFromRoom(socket.id);
}

// Handler pour quitter toutes les rooms explicitement (SPA navigation)
function handleLeaveAllRooms(socket: Socket, fastify: FastifyInstance, io: Server)
{
    cleanUpPlayerRooms(socket, fastify, io);
}

// Fonction principale qui enregistre tous les handlers socket.io
export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
    setInterval(() =>
	{
        handleGameTick(io);
    }, 1000 / 120);

    io.on('connection', (socket: Socket) =>
	{
        fastify.log.info(`Client connecté : ${socket.id}`);
        console.log('[BACKEND] Nouvelle connexion socket', socket.id, 'à', new Date().toISOString());

        socket.on('joinRoom', (data: any) => handleJoinRoom(socket, data, fastify, io));
        socket.on('ping', () => socket.emit('pong', { message: 'Hello client!' }));
        socket.on('message', (msg: string) => handleSocketMessage(socket, msg));
        socket.on('disconnect', () => handleSocketDisconnect(socket));
        socket.on('leaveAllRooms', () => handleLeaveAllRooms(socket, fastify, io));
    });
}

// Definition de l'interface RoomType directement ici pour éviter les problèmes d'import de type
export interface RoomType {
    players: string[];
    maxPlayers: number;
    isLocalGame?: boolean; // <-- Ajouté pour corriger l'erreur de typage
    paddleBySocket?: any;
    paddleInputs?: any;
    pongGame?: any;
    gameState?: any;
}
