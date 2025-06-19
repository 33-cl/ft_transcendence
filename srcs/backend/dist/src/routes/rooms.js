// routes/rooms.ts
// Ce fichier expose une API REST pour gérer les rooms (création, listing, suppression)
import { rooms, roomExists, getNextRoomName } from '../socket/roomManager.js';
import { createInitialGameState } from '../../Rayan/gameState.js';
// Supprime le compteur local, on utilise le compteur global partagé
export default async function roomsRoutes(fastify) {
    // Route POST /rooms : créer une nouvelle room
    fastify.post('/rooms', async (request, reply) => {
        const { maxPlayers } = request.body;
        if (!maxPlayers || typeof maxPlayers !== 'number')
            return reply.status(400).send({ error: 'maxPlayers needed' });
        // Génère un nom unique pour la room, incrémental et global
        let roomName;
        do {
            roomName = getNextRoomName();
        } while (roomExists(roomName));
        // Crée la room vide avec un gameState initialisé
        rooms[roomName] = { players: [], maxPlayers, gameState: createInitialGameState() };
        return { roomName, maxPlayers };
    });
    // Route GET /rooms : lister toutes les rooms existantes
    fastify.get('/rooms', async (request, reply) => {
        return { rooms };
    });
    // Route DELETE /rooms/:roomName : supprimer une room par son nom
    fastify.delete('/rooms/:roomName', async (request, reply) => {
        const { roomName } = request.params;
        if (!rooms[roomName])
            return reply.status(404).send({ error: 'Room not found' });
        delete rooms[roomName];
        return { success: true };
    });
    // ===============================
    // !!! ROUTE DE TEST DEV UNIQUEMENT !!!
    // /db-test : à SUPPRIMER avant la mise en production !
    // ===============================
    /*
    fastify.get('/db-test', async (request, reply) => {
        const db = (await import('../../Rayan/db.js')).default;
        const row = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
        return { gamesCount: row.count };
    });
    */
    // ===============================
    // FIN ROUTE DE TEST DEV UNIQUEMENT
    // ===============================
}
