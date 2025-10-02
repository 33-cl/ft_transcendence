// routes/tournaments.ts - Routes API pour les tournois

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

// Interface pour la création d'un tournoi
interface CreateTournamentBody {
    name: string;
    maxPlayers?: number;
}

export default async function tournamentsRoutes(fastify: FastifyInstance) {
    // POST /tournaments - Créer un nouveau tournoi
    fastify.post('/tournaments', async (request: FastifyRequest<{ Body: CreateTournamentBody }>, reply: FastifyReply) => {
        try {
            const { name, maxPlayers = 8 } = request.body;

            // Validation basique
            if (!name || name.trim().length === 0) {
                return reply.status(400).send({ error: 'Tournament name is required' });
            }

           

        } catch (error) {
            fastify.log.error('Error creating tournament:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}