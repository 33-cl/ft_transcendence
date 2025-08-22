/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/08/19 15:45:47 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import https from 'https';
import { PongGame } from '../../Rayan/pong.js';
import { Buffer } from 'buffer';
import { createInitialGameState } from '../../Rayan/gameState.js';
import { authenticateSocket, getSocketUser, removeSocketUser } from './socketAuth.js';
import { updateUserStats, getUserByUsername } from '../user.js';
// Mutex to prevent concurrent joinRoom for the same socket
const joinRoomLocks = new Set();
// Vérifie si le client peut rejoindre la room (nom valide et room existante)
function canJoinRoom(socket, roomName) {
    if (!roomName || typeof roomName !== 'string') {
        socket.emit('error', { error: 'roomName requested' });
        return false;
    }
    if (!roomExists(roomName)) {
        socket.emit('error', { error: 'Room does not exist' });
        return false;
    }
    return true;
}
// Vérifie si la room est pleine
function handleRoomFull(socket, room, fastify) {
    if (room.players.length >= room.maxPlayers) {
        // Protection : refuse si la room est pleine
        socket.emit('error', { error: 'Room is full' });
        return true;
    }
    return false;
}
// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket, fastify, io) {
    for (const rName in rooms) {
        if (rooms[rName].players.includes(socket.id)) {
            // room actuelle = room actuelle - client actuel
            rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
            if (rooms[rName].players.length === 0) {
                delete rooms[rName];
                // Suppression silencieuse de la room vide (log retiré)
            }
            else {
                const room = rooms[rName];
                // NOUVEAU : Pour les jeux locaux, on supprime toujours la room complètement
                // Cela évite le problème de double clic pour relancer une partie locale
                if (room.isLocalGame) {
                    if (room.pongGame) {
                        room.pongGame.stop();
                    }
                    // Retirer tous les joueurs de la room
                    if (io) {
                        for (const socketId of room.players) {
                            if (socketId !== socket.id && io.sockets.sockets.get(socketId)) {
                                io.sockets.sockets.get(socketId)?.leave(rName);
                            }
                        }
                    }
                    room.players = [];
                    delete rooms[rName];
                    continue;
                }
                // Pour les jeux non-locaux : comportement original
                // Si la partie est en cours, on stoppe et on supprime la room (ranked)
                if (room.pongGame && room.pongGame.state && room.pongGame.state.running === true) {
                    room.pongGame.stop();
                    // On retire tous les joueurs restants via leurs socket et on supprime la room
                    if (io) {
                        for (const socketId of room.players) {
                            //ne pas retirer le client actu c deja fait
                            if (socketId !== socket.id && io.sockets.sockets.get(socketId)) {
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
                if (gameEnded) {
                    delete room.pongGame;
                    delete room.paddleBySocket;
                    delete room.paddleInputs;
                    delete room.playerUsernames; // Clean up username mappings
                    room.gameState = createInitialGameState();
                }
            }
        }
    }
}
// Ajoute le joueur à la room et le fait rejoindre côté socket.io
// Ajout : attribution dynamique des paddles pour 1v1v1
function assignPaddleToPlayer(room) {
    const paddleSides = ['A', 'B', 'C'];
    for (const side of paddleSides.slice(0, room.maxPlayers)) {
        if (!room.paddleBySocket || !Object.values(room.paddleBySocket).includes(side)) {
            return side;
        }
    }
    return null;
}
// Modifie joinPlayerToRoom pour gérer le mode 1v1v1
function joinPlayerToRoom(socket, roomName, room, io) {
    //si le joueur n'est pas déjà dans la room, on l'ajoute
    if (!room.players.includes(socket.id)) {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    // --- Attribution automatique du contrôle paddle (1v1, 1v1v1, 2v2) ---
    // Ajout : si isLocalGame, attribuer tous les paddles au même socket
    if (room.isLocalGame) {
        if (!room.paddleBySocket)
            room.paddleBySocket = {};
        if (room.maxPlayers === 2) {
            room.paddleBySocket[socket.id] = ['A', 'C']; // A = gauche, C = droite (B reste pour horizontal en 1v1v1)
        }
        else if (room.maxPlayers === 3) {
            room.paddleBySocket[socket.id] = ['A', 'B', 'C'];
        }
        // Broadcast à toute la room l'état matchmaking
        if (io) {
            for (const id of room.players) {
                const targetSocket = io.sockets.sockets.get(id);
                if (!targetSocket)
                    continue;
                targetSocket.emit('roomJoined', {
                    room: roomName,
                    players: room.players.length,
                    maxPlayers: room.maxPlayers,
                    paddle: room.paddleBySocket[id]
                });
            }
        }
        else {
            socket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: room.paddleBySocket[socket.id]
            });
        }
        return;
    }
    if (room.maxPlayers === 2 || room.maxPlayers === 3 || room.maxPlayers === 4) {
        if (!room.paddleBySocket)
            room.paddleBySocket = {};
        // Purge les anciennes attributions de paddle (joueurs plus dans la room)
        for (const id in room.paddleBySocket) {
            if (!room.players.includes(id))
                delete room.paddleBySocket[id];
        }
        // Attribution stricte selon l'ordre d'arrivée dans la room
        if (!(socket.id in room.paddleBySocket)) {
            if (room.maxPlayers === 2) {
                // En mode 1v1 (local et non-local) : toujours A=gauche et C=droite
                // B reste réservé pour le paddle horizontal du mode 1v1v1
                const paddles = ['A', 'C'];
                const idx = room.players.indexOf(socket.id);
                room.paddleBySocket[socket.id] = paddles[idx] || null;
            }
            else if (room.maxPlayers === 3) {
                // Attribution dynamique pour 1v1v1
                const paddle = assignPaddleToPlayer(room);
                room.paddleBySocket[socket.id] = paddle;
            }
            else if (room.maxPlayers === 4) {
                const paddles = ['left', 'right', 'top', 'bottom'];
                const idx = room.players.indexOf(socket.id);
                room.paddleBySocket[socket.id] = paddles[idx] || null;
            }
        }
        // --- Broadcast à toute la room l'état matchmaking ---
        if (io) {
            for (const id of room.players) {
                const targetSocket = io.sockets.sockets.get(id);
                if (!targetSocket)
                    continue;
                targetSocket.emit('roomJoined', {
                    room: roomName,
                    players: room.players.length,
                    maxPlayers: room.maxPlayers,
                    paddle: room.paddleBySocket[id]
                });
            }
        }
        else {
            socket.emit('roomJoined', {
                room: roomName,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                paddle: room.paddleBySocket[socket.id]
            });
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
async function handleJoinRoom(socket, data, fastify, io) {
    if (joinRoomLocks.has(socket.id)) {
        fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
        return;
    }
    joinRoomLocks.add(socket.id);
    try {
        const maxPlayers = data?.maxPlayers;
        const isLocalGame = data?.isLocalGame === true;
        const previousRoom = getPlayerRoom(socket.id);
        let roomName = data?.roomName;
        if (!roomName && typeof maxPlayers === 'number') {
            roomName = null;
            // IMPORTANT: Pour les jeux locaux, on cherche/crée des rooms différentes
            // Cela évite que les rooms locales interfèrent avec le multiplayer
            for (const [name, room] of Object.entries(rooms)) {
                if (room.maxPlayers === maxPlayers &&
                    room.players.length < maxPlayers &&
                    room.isLocalGame === isLocalGame) {
                    roomName = name;
                    break;
                }
            }
            if (!roomName) {
                const roomPrefix = isLocalGame ? 'local' : 'multi';
                const postData = JSON.stringify({
                    maxPlayers,
                    roomPrefix
                });
                const options = {
                    hostname: 'localhost',
                    port: 8080,
                    path: '/rooms',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    },
                    rejectUnauthorized: false // auto-signé en dev
                };
                roomName = await new Promise((resolve, reject) => {
                    const req = https.request(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => { data += chunk; });
                        res.on('end', () => {
                            try {
                                const json = JSON.parse(data);
                                resolve(json.roomName);
                            }
                            catch (e) {
                                reject(e);
                            }
                        });
                    });
                    req.on('error', (err) => {
                        reject(err);
                    });
                    req.write(postData);
                    req.end();
                });
            }
        }
        if (!canJoinRoom(socket, roomName))
            return;
        const room = rooms[roomName];
        // Ajout : stocke le flag isLocalGame dans la room
        // IMPORTANT: On set le flag à la valeur actuelle, pas seulement si true
        room.isLocalGame = isLocalGame;
        if (handleRoomFull(socket, room, fastify))
            return;
        if (previousRoom) {
            removePlayerFromRoom(socket.id);
            socket.leave(previousRoom);
            fastify.log.info(`[DEBUG] socket.id=${socket.id} leave previousRoom=${previousRoom}`);
        }
        cleanUpPlayerRooms(socket, fastify, io);
        joinPlayerToRoom(socket, roomName, room, io);
        // For online games, store username if authenticated
        if (!isLocalGame) {
            const user = getSocketUser(socket.id);
            if (user) {
                if (!room.playerUsernames)
                    room.playerUsernames = {};
                room.playerUsernames[socket.id] = user.username;
            }
        }
        // --- Ajout : en local, on démarre la partie immédiatement ---
        if (isLocalGame && !room.pongGame) {
            room.pongGame = new PongGame(room.maxPlayers);
            room.pongGame.start();
        }
        // --- Sinon, comportement normal ---
        else if (!room.pongGame && room.players.length === room.maxPlayers) {
            // Create game end callback for online multiplayer games
            const gameEndCallback = !isLocalGame ? (winner, loser) => {
                handleGameEnd(roomName, room, winner, loser, fastify);
            } : undefined;
            room.pongGame = new PongGame(room.maxPlayers, gameEndCallback);
            room.pongGame.start();
        }
    }
    finally {
        joinRoomLocks.delete(socket.id);
    }
}
// Helper pour initialiser paddleInputs avec toutes les clés nécessaires
function initPaddleInputs(maxPlayers) {
    const inputs = {
        'A': { up: false, down: false },
        'B': { up: false, down: false },
        'C': { up: false, down: false }
    };
    return inputs;
}
// Handle game end for online multiplayer games
function handleGameEnd(roomName, room, winner, loser, fastify) {
    // Only process win/loss for online games with authenticated players
    if (room.isLocalGame) {
        fastify.log.info(`Game ended in local room ${roomName} - no win/loss tracking (local games don't count)`);
        return;
    }
    if (!room.playerUsernames || !room.paddleBySocket) {
        fastify.log.warn(`Game ended in room ${roomName} but missing player username data`);
        return;
    }
    try {
        // Find the socket IDs for winner and loser based on paddle sides
        let winnerSocketId = null;
        let loserSocketId = null;
        for (const [socketId, paddleSide] of Object.entries(room.paddleBySocket)) {
            if (paddleSide === winner.side) {
                winnerSocketId = socketId;
            }
            else if (paddleSide === loser.side) {
                loserSocketId = socketId;
            }
        }
        // Get usernames for winner and loser
        const winnerUsername = winnerSocketId ? room.playerUsernames[winnerSocketId] : null;
        const loserUsername = loserSocketId ? room.playerUsernames[loserSocketId] : null;
        if (winnerUsername && loserUsername) {
            // Get users from database by username
            const winnerUser = getUserByUsername(winnerUsername);
            const loserUser = getUserByUsername(loserUsername);
            if (winnerUser && loserUser) {
                // Update user statistics using user IDs from database
                updateUserStats(winnerUser.id, loserUser.id, winner.score, loser.score, 'online');
                fastify.log.info(`Game ended in room ${roomName}: Winner ${winnerUsername} (${winner.score}) vs Loser ${loserUsername} (${loser.score})`);
            }
            else {
                fastify.log.warn(`Could not find users in database. Winner: ${winnerUsername}, Loser: ${loserUsername}`);
            }
        }
        else {
            fastify.log.warn(`Could not get usernames for match result. Winner: ${winnerUsername}, Loser: ${loserUsername}`);
        }
    }
    catch (error) {
        fastify.log.error(`Error recording match result: ${error}`);
    }
}
// Tick global pour toutes les rooms avec un jeu en cours (adapté pour paddles dynamiques)
function handleGameTick(io) {
    for (const [roomName, room] of Object.entries(rooms)) {
        const typedRoom = room; // Cast pour éviter l'erreur TS2339
        if (typedRoom.pongGame && typedRoom.pongGame.state.running) {
            // Initialise l'état des touches pour chaque paddle si besoin
            if (!typedRoom.paddleInputs) {
                typedRoom.paddleInputs = initPaddleInputs(typedRoom.maxPlayers);
            }
            // Applique le mouvement pour chaque paddle
            const speed = typedRoom.pongGame.state.paddleSpeed;
            for (const paddle of typedRoom.pongGame.state.paddles) {
                const input = typedRoom.paddleInputs[paddle.side];
                if (!input)
                    continue;
                // Paddle B horizontal : bouge sur l'axe X
                if (paddle.side === 'B') {
                    if (input.up) // up = gauche pour paddle horizontal
                        paddle.x = Math.max(0, paddle.x - speed);
                    if (input.down) // down = droite pour paddle horizontal
                        paddle.x = Math.min(typedRoom.pongGame.state.canvasWidth - paddle.width, paddle.x + speed);
                }
                else {
                    // Paddles A et C verticaux : bougent sur l'axe Y
                    if (input.up)
                        paddle.y = Math.max(0, paddle.y - speed);
                    if (input.down)
                        paddle.y = Math.min(typedRoom.pongGame.state.canvasHeight - paddle.height, paddle.y + speed);
                }
            }
            io.to(roomName).emit('gameState', typedRoom.pongGame.state);
        }
        if (typedRoom.pongGame && typedRoom.pongGame.state.running === false) {
            for (const socketId of typedRoom.players) {
                if (io.sockets.sockets.get(socketId))
                    io.sockets.sockets.get(socketId)?.leave(roomName);
            }
            typedRoom.players = [];
            delete rooms[roomName];
        }
    }
}
// Handler pour les messages relayés dans la room (adapté pour paddleInputs dynamiques)
function handleSocketMessage(socket, msg) {
    let message;
    try {
        message = JSON.parse(msg);
    }
    catch (e) {
        return;
    }
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom)
        return;
    const room = rooms[playerRoom];
    if (!room.paddleInputs) {
        room.paddleInputs = initPaddleInputs(room.maxPlayers);
    }
    // Ajout : en local, le client peut contrôler tous les paddles
    if ((message.type === 'keydown' || message.type === 'keyup') && room.pongGame && room.paddleBySocket) {
        const { player, direction } = message.data || {};
        const allowedPaddle = room.paddleBySocket[socket.id];
        if (room.isLocalGame) {
            let mappedPlayer = player;
            if (player === 'left')
                mappedPlayer = 'A';
            else if (player === 'right')
                mappedPlayer = 'C';
            if (Array.isArray(allowedPaddle) && allowedPaddle.includes(mappedPlayer)) {
                if ((mappedPlayer === 'A' || mappedPlayer === 'B' || mappedPlayer === 'C' || mappedPlayer === 'left' || mappedPlayer === 'right') && (direction === 'up' || direction === 'down')) {
                    room.paddleInputs[mappedPlayer][direction] = (message.type === 'keydown');
                    if (message.type === 'keydown') {
                        try {
                            room.pongGame.movePaddle(mappedPlayer, direction);
                        }
                        catch (error) {
                            // Log supprimé pour améliorer les performances
                        }
                    }
                }
            }
        }
        else {
            if (player !== allowedPaddle)
                return;
            if ((player === 'A' || player === 'B' || player === 'C') && (direction === 'up' || direction === 'down')) {
                room.paddleInputs[player][direction] = (message.type === 'keydown');
                if (message.type === 'keydown') {
                    room.pongGame.movePaddle(player, direction);
                }
            }
        }
    }
}
// Handler pour la déconnexion du client
function handleSocketDisconnect(socket) {
    removePlayerFromRoom(socket.id);
    removeSocketUser(socket.id); // Clean up user authentication data
}
// Handler pour quitter toutes les rooms explicitement (SPA navigation)
function handleLeaveAllRooms(socket, fastify, io) {
    cleanUpPlayerRooms(socket, fastify, io);
}
// Fonction principale qui enregistre tous les handlers socket.io
export default function registerSocketHandlers(io, fastify) {
    // Tick rate à 60 FPS pour un gameplay fluide
    setInterval(() => {
        handleGameTick(io);
    }, 1000 / 60);
    io.on('connection', (socket) => {
        fastify.log.info(`Client connecté : ${socket.id}`);
        // Authenticate the socket connection
        const user = authenticateSocket(socket);
        if (user) {
            fastify.log.info(`Socket ${socket.id} authenticated as user ${user.username} (${user.id})`);
        }
        socket.on('joinRoom', (data) => handleJoinRoom(socket, data, fastify, io));
        socket.on('ping', () => socket.emit('pong', { message: 'Hello client!' }));
        socket.on('message', (msg) => handleSocketMessage(socket, msg));
        socket.on('disconnect', () => handleSocketDisconnect(socket));
        socket.on('leaveAllRooms', () => handleLeaveAllRooms(socket, fastify, io));
    });
}
