// routes/rooms.ts
// Ce fichier expose une API REST pour gérer les rooms (création, listing, suppression)
import { rooms, roomExists } from '../socket/roomManager.js';
// Compteur local pour générer des noms uniques de room
let localRoomCounter = 1;
export default async function roomsRoutes(fastify) {
    // Route POST /rooms : créer une nouvelle room
    fastify.post('/rooms', async (request, reply) => {
        const { maxPlayers } = request.body;
        if (!maxPlayers || typeof maxPlayers !== 'number')
            return reply.status(400).send({ error: 'maxPlayers requis' });
        // Génère un nom unique pour la room
        let roomName;
        do {
            roomName = `room${localRoomCounter++}`;
        } while (roomExists(roomName));
        // Crée la room vide
        rooms[roomName] = { players: [], maxPlayers };
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
}
