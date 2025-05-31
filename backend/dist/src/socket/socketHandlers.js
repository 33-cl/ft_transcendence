"use strict";
// src/socket/socketHandlers.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerSocketHandlers;
const roomManager_1 = require("./roomManager");
const messageHandlers_1 = require("./messageHandlers");
function registerSocketHandlers(io, fastify) {
    io.on('connection', (socket) => {
        fastify.log.info(`Client connecté : ${socket.id}`);
        // Handler pour rejoindre une room dynamiquement
        socket.on('joinRoom', (data) => {
            // Avant de rejoindre une nouvelle room, retirer le joueur de l'ancienne
            const previousRoom = (0, roomManager_1.getPlayerRoom)(socket.id);
            if (previousRoom) {
                (0, roomManager_1.removePlayerFromRoom)(socket.id, fastify.log.info.bind(fastify.log));
                socket.leave(previousRoom);
            }
            // 4 ou 2 players dans la room
            const maxPlayers = data && data.maxPlayers ? data.maxPlayers : 2;
            // itere sur les rooms existantes et cherche une room avec la capacitee demandee (2 ou 4)
            // le dernier parametre permet d'ecrire dans les logs avec le bon this
            const assignedRoom = (0, roomManager_1.findOrCreateRoom)(maxPlayers, socket.id, fastify.log.info.bind(fastify.log));
            socket.join(assignedRoom);
            fastify.log.info(`Joueur ${socket.id} rejoint la room ${assignedRoom} (max ${maxPlayers})`);
            // On informe le client de la room rejointe
            socket.emit('roomJoined', { room: assignedRoom, maxPlayers });
        });
        socket.on('ping', (data) => {
            fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
            socket.emit('pong', { message: 'Hello client!' });
        });
        // Handler pour les messages (envoyés avec socket.send)
        socket.on('message', (msg) => {
            (0, messageHandlers_1.handleMessage)(socket, fastify, msg);
        });
        socket.on('disconnect', () => {
            // Retirer le joueur de sa room
            (0, roomManager_1.removePlayerFromRoom)(socket.id, fastify.log.info.bind(fastify.log));
        });
    });
}
