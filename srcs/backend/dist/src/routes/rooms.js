"use strict";
// routes/rooms.ts
// Ce fichier expose une API REST pour gérer les rooms (création, listing, suppression)
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = roomsRoutes;
const roomManager_1 = require("../socket/roomManager");
// Compteur local pour générer des noms uniques de room
let localRoomCounter = 1;
async function roomsRoutes(fastify) {
    // Route POST /rooms : créer une nouvelle room
    fastify.post('/rooms', async (request, reply) => {
        const { maxPlayers } = request.body;
        if (!maxPlayers || typeof maxPlayers !== 'number')
            return reply.status(400).send({ error: 'maxPlayers needed' });
        // Génère un nom unique pour la room
        let roomName;
        do {
            roomName = `room${localRoomCounter++}`;
        } while ((0, roomManager_1.roomExists)(roomName));
        // Crée la room vide
        roomManager_1.rooms[roomName] = { players: [], maxPlayers };
        return { roomName, maxPlayers };
    });
    // Route GET /rooms : lister toutes les rooms existantes
    fastify.get('/rooms', async (request, reply) => {
        return { rooms: roomManager_1.rooms };
    });
    // Route DELETE /rooms/:roomName : supprimer une room par son nom
    fastify.delete('/rooms/:roomName', async (request, reply) => {
        const { roomName } = request.params;
        if (!roomManager_1.rooms[roomName])
            return reply.status(404).send({ error: 'Room not found' });
        delete roomManager_1.rooms[roomName];
        return { success: true };
    });
    // Route GET /ping : test de vie du backend
    fastify.get('/ping', async (request, reply) => {
        return { message: 'pong' };
    });
}
