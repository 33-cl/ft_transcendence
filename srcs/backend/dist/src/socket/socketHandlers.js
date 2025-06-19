/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/19 13:53:30 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import https from 'https';
import { PongGame } from '../../Rayan/pong.js';
import { Buffer } from 'buffer';
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
// Bloque le "zapping" si le client est déjà dans une room non pleine du même type
function hardBlockAntiZap(socket, previousRoom, room, fastify) {
    if (previousRoom) {
        const prevRoomObj = rooms[previousRoom];
        if (prevRoomObj && prevRoomObj.players.length < prevRoomObj.maxPlayers && prevRoomObj.maxPlayers === room.maxPlayers) {
            // Refuse le join et renvoie le client dans sa room actuelle
            // Protection anti-zap : un joueur ne peut pas zapper entre rooms du même type non pleines
            socket.emit('roomJoined', { room: previousRoom });
            fastify.log.warn(`ANTI-ZAP: ${socket.id} tenté de zapper de ${previousRoom} vers ${room.name || previousRoom}`);
            return true;
        }
    }
    return false;
}
// Si le client demande à rejoindre la même room où il est déjà, on confirme simplement
function handleRoomSwitch(socket, previousRoom, roomName, fastify) {
    if (previousRoom === roomName) {
        // Protection : ne pas rejoindre deux fois la même room
        socket.emit('roomJoined', { room: roomName });
        fastify.log.warn(`ALREADY-IN-ROOM: ${socket.id} a tenté de rejoindre deux fois la room ${roomName}`);
        return true;
    }
    return false;
}
// Vérifie si la room est pleine
function handleRoomFull(socket, room, fastify) {
    if (room.players.length >= room.maxPlayers) {
        // Protection : refuse si la room est pleine
        socket.emit('error', { error: 'Room is full' });
        fastify.log.warn(`ROOM-FULL: ${socket.id} a tenté de rejoindre la room pleine ${room.name}`);
        return true;
    }
    return false;
}
// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket) {
    for (const rName in rooms) {
        if (rooms[rName].players.includes(socket.id)) {
            rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
            if (rooms[rName].players.length === 0) {
                delete rooms[rName]; // Supprime la room si elle est vide
            }
        }
    }
}
// Ajoute le joueur à la room et le fait rejoindre côté socket.io
function joinPlayerToRoom(socket, roomName, room) {
    //si le joueur n'est pas déjà dans la room, on l'ajoute
    if (!room.players.includes(socket.id)) {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    // --- Attribution automatique du contrôle paddle (1v1) ---
    if (room.maxPlayers === 2) {
        if (!room.paddleBySocket)
            room.paddleBySocket = {};
        // Si le joueur n'a pas encore de paddle attribué
        if (!room.paddleBySocket[socket.id]) {
            if (!Object.values(room.paddleBySocket).includes('left')) {
                room.paddleBySocket[socket.id] = 'left';
            }
            else {
                room.paddleBySocket[socket.id] = 'right';
            }
        }
        // On envoie au client le paddle qu'il contrôle
        socket.emit('roomJoined', { room: roomName, paddle: room.paddleBySocket[socket.id] });
        return;
    }
    // Cas générique (solo, 2v2, etc.)
    socket.emit('roomJoined', { room: roomName });
}
// Fonction principale qui enregistre tous les handlers socket.io
/**
 * Enregistre tous les handlers socket.io pour la gestion des rooms.
 * Toutes les protections (anti-zap, déjà dans la room, room pleine) sont centralisées ici côté backend.
 * Justification :
 * - Toute la logique métier de gestion de rooms doit être côté serveur (conformément au sujet).
 * - Les protections sont loguées pour audit/debug.
 * - Le frontend ne fait que demander à rejoindre une room, sans logique métier.
 */
export default function registerSocketHandlers(io, fastify) {
    // Tick global pour toutes les rooms avec un jeu en cours
    setInterval(() => {
        for (const [roomName, room] of Object.entries(rooms)) {
            if (room.pongGame && room.pongGame.state.running) {
                // --- Mouvement continu des paddles selon l'état des touches ---
                if (!room.paddleInputs) {
                    // Initialise l'état des touches pour chaque joueur
                    room.paddleInputs = {
                        left: { up: false, down: false },
                        right: { up: false, down: false }
                    };
                }
                // Applique le mouvement pour chaque joueur
                const speed = room.pongGame.state.paddleSpeed;
                if (room.paddleInputs.left.up) {
                    room.pongGame.state.leftPaddleY = Math.max(0, room.pongGame.state.leftPaddleY - speed);
                }
                if (room.paddleInputs.left.down) {
                    room.pongGame.state.leftPaddleY = Math.min(room.pongGame.state.canvasHeight - room.pongGame.state.paddleHeight, room.pongGame.state.leftPaddleY + speed);
                }
                if (room.paddleInputs.right.up) {
                    room.pongGame.state.rightPaddleY = Math.max(0, room.pongGame.state.rightPaddleY - speed);
                }
                if (room.paddleInputs.right.down) {
                    room.pongGame.state.rightPaddleY = Math.min(room.pongGame.state.canvasHeight - room.pongGame.state.paddleHeight, room.pongGame.state.rightPaddleY + speed);
                }
                // Envoie l'état du jeu à tous les clients de la room
                io.to(roomName).emit('gameState', room.pongGame.state);
            }
        }
    }, 1000 / 60); // 60 FPS
    io.on('connection', (socket) => {
        // Log la connexion d'un nouveau client
        fastify.log.info(`Client connecté : ${socket.id}`);
        // Handler pour rejoindre ou créer une room selon le nombre de joueurs demandé
        // Si data.maxPlayers est fourni, on cherche/crée une room adaptée
        // Si data.roomName est fourni, on garde le comportement existant
        socket.on('joinRoom', async (data) => {
            if (joinRoomLocks.has(socket.id)) {
                fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
                return;
            }
            joinRoomLocks.add(socket.id);
            try {
                const maxPlayers = data?.maxPlayers;
                const previousRoom = getPlayerRoom(socket.id);
                if (typeof maxPlayers === 'number' && previousRoom) {
                    const prevRoomObj = rooms[previousRoom];
                    if (prevRoomObj && prevRoomObj.maxPlayers === maxPlayers) {
                        // Anti-zap strict : déjà dans une room du bon type (pleine ou non), on ne bouge pas
                        socket.emit('roomJoined', { room: previousRoom });
                        fastify.log.warn(`ANTI-ZAP-STRICT: ${socket.id} déjà dans la room ${previousRoom} (type ${maxPlayers})`);
                        return;
                    }
                }
                let roomName = data?.roomName;
                if (!roomName && typeof maxPlayers === 'number') {
                    roomName = null;
                    for (const [name, room] of Object.entries(rooms)) {
                        if (room.maxPlayers === maxPlayers && room.players.length < maxPlayers) {
                            roomName = name;
                            break;
                        }
                    }
                    if (!roomName) {
                        // Création de la room via l'API REST (POST /rooms)
                        // NOTE : Le backend s'auto-appelle ici en HTTPS pour garantir que toute création de room
                        // passe par l'API REST officielle, même en interne (conformité au sujet, audit, sécurité).
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
                            req.on('error', reject);
                            req.write(postData);
                            req.end();
                        });
                    }
                }
                if (!canJoinRoom(socket, roomName)) {
                    return;
                }
                const room = rooms[roomName];
                if (hardBlockAntiZap(socket, previousRoom, room, fastify)) {
                    return; // Stoppe ici si anti-zap
                }
                if (handleRoomSwitch(socket, previousRoom, roomName, fastify)) {
                    return; // Stoppe ici si déjà dans la room
                }
                if (handleRoomFull(socket, room, fastify)) {
                    return;
                }
                if (previousRoom) {
                    removePlayerFromRoom(socket.id);
                    socket.leave(previousRoom);
                }
                cleanUpPlayerRooms(socket);
                joinPlayerToRoom(socket, roomName, room);
                if (!room.pongGame && room.players.length === room.maxPlayers) {
                    // Instancie et démarre le jeu Pong quand la room est pleine
                    room.pongGame = new PongGame();
                    room.pongGame.start();
                }
            }
            finally {
                joinRoomLocks.delete(socket.id);
            }
        });
        // Handler pour le ping/pong (test de connexion)
        socket.on('ping', (data) => {
            socket.emit('pong', { message: 'Hello client!' });
        });
        // Handler pour les messages relayés dans la room
        socket.on('message', (msg) => {
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
            // --- Nouvelle gestion : keydown/keyup pour paddleInputs ---
            if (!room.paddleInputs) {
                room.paddleInputs = {
                    left: { up: false, down: false },
                    right: { up: false, down: false }
                };
            }
            if ((message.type === 'keydown' || message.type === 'keyup') && room.pongGame) {
                // message.data = { player: 'left'|'right', direction: 'up'|'down' }
                const { player, direction } = message.data || {};
                // --- Sécurité : n'autoriser que le contrôle de son propre paddle (1v1) ---
                if (room.maxPlayers === 2 && room.paddleBySocket) {
                    const allowedPaddle = room.paddleBySocket[socket.id];
                    if (player !== allowedPaddle)
                        return; // Ignore si tentative de triche
                }
                if ((player === 'left' || player === 'right') && (direction === 'up' || direction === 'down')) {
                    (room.paddleInputs[player][direction]) = (message.type === 'keydown');
                }
            }
            // Ancienne gestion 'move' supprimée (plus utile)
            // Optionnel : relayer le message aux autres si besoin
            // handleMessage(socket, fastify, msg);
        });
        // Handler pour la déconnexion du client
        socket.on('disconnect', () => {
            removePlayerFromRoom(socket.id);
        });
    });
}
