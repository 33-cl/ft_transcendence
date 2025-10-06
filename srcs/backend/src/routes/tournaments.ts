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
            const body = request.body as CreateTournamentBody;
            const { name, maxPlayers = 8 } = body;

            // Validation basique
            if (!name || name.trim().length === 0) {
                return reply.status(400).send({ error: 'Tournament name is required' });
            }

            if (name.trim().length > 50) {
                return reply.status(400).send({ error: 'Tournament name too long (max 50 characters)' });
            }

            if (![4, 6, 8].includes(maxPlayers)) {
                return reply.status(400).send({ error: 'Max players must be 4, 6, or 8' });
            }

            // Générer un ID unique
            const tournamentId = uuidv4();

            // Insérer en base de données
            const stmt = db.prepare(`
                INSERT INTO tournaments (id, name, status, max_players, current_players)
                VALUES (?, ?, 'registration', ?, 0)
            `);

            stmt.run(tournamentId, name.trim(), maxPlayers);

            // Indique l'URL de la ressource nouvellement créée
            reply.header('Location', `/tournaments/${tournamentId}`);

            // Retourner le tournoi créé
            const createdTournament = db.prepare(`
                SELECT * FROM tournaments WHERE id = ?
            `).get(tournamentId);

            fastify.log.info(`Tournament created: ${name} (${tournamentId})`);

            reply.status(201).send({
                success: true,
                tournament: createdTournament
            });
        } catch (error) {
            fastify.log.error(`Error creating tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}