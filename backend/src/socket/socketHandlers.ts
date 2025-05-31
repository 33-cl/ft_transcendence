// src/socket/socketHandlers.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';

interface Room {
  players: string[];
  maxPlayers: number;
}

const rooms: Record<string, Room> = {};
let roomCounter = 1;

export default function registerSocketHandlers(io: Server, fastify: FastifyInstance) {
    io.on('connection', (socket: Socket) => {
        fastify.log.info(`Client connecté : ${socket.id}`);

        socket.on('joinRoom', (data: any) => {
            const maxPlayers = data && data.maxPlayers ? data.maxPlayers : 2;
            let assignedRoom: string | null = null;
            for (const roomName in rooms) {
                if (rooms[roomName].maxPlayers === maxPlayers && rooms[roomName].players.length < maxPlayers) {
                    fastify.log.info(`Room trouvée : ${roomName} (max ${maxPlayers})`);
                    assignedRoom = roomName;
                    break;
                }
            }
            if (!assignedRoom) {
                assignedRoom = `room${roomCounter++}`;
                rooms[assignedRoom] = { players: [], maxPlayers };
            }
            socket.join(assignedRoom);
            rooms[assignedRoom].players.push(socket.id);
            fastify.log.info(`Joueur ${socket.id} rejoint la room ${assignedRoom} (max ${maxPlayers})`);
            socket.emit('roomJoined', { room: assignedRoom, maxPlayers });
        });

        socket.on('ping', (data: any) => {
            fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
            socket.emit('pong', { message: 'Hello client!' });
        });

        socket.on('message', (msg: string) => {
            let message: any;
            try {
                message = JSON.parse(msg);
            } catch (e) {
                fastify.log.warn(`Message non JSON reçu: ${msg}`);
                return;
            }
            let playerRoom: string | null = null;
            for (const roomName in rooms) {
                if (rooms[roomName].players.includes(socket.id)) {
                    playerRoom = roomName;
                    break;
                }
            }
            if (!playerRoom) {
                fastify.log.warn(`Aucune room trouvée pour le joueur ${socket.id}`);
                return;
            }
            if (message.type === 'move') {
                if (typeof message.data !== 'object' || typeof message.data.y !== 'number') {
                    fastify.log.warn(`Move invalide: ${JSON.stringify(message)}`);
                    return;
                }
                fastify.log.info(`Move reçu: y=${message.data.y}`);
                socket.to(playerRoom).emit('message', msg);
            } else if (message.type === 'score') {
                if (typeof message.data !== 'object' || typeof message.data.left !== 'number' || typeof message.data.right !== 'number') {
                    fastify.log.warn(`Score invalide: ${JSON.stringify(message)}`);
                    return;
                }
                fastify.log.info(`Score reçu: left=${message.data.left}, right=${message.data.right}`);
                socket.to(playerRoom).emit('message', msg);
            } else {
                fastify.log.warn(`Type de message inconnu: ${message.type}`);
            }
        });

        socket.on('disconnect', () => {
            let playerRoom: string | null = null;
            for (const roomName in rooms) {
                if (rooms[roomName].players.includes(socket.id)) {
                    playerRoom = roomName;
                    break;
                }
            }
            if (playerRoom) {
                rooms[playerRoom].players = rooms[playerRoom].players.filter(id => id !== socket.id);
                fastify.log.info(`Joueur ${socket.id} quitte la room ${playerRoom}`);
                if (rooms[playerRoom].players.length === 0) {
                    delete rooms[playerRoom];
                }
            }
        });
    });
}
