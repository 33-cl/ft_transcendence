// routes/tournaments.ts - Routes API pour les tournois

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

// Typages minimaux pour les résultats SQL utilisés ici
interface TournamentRow {
    id: string;
    name?: string;
    status: 'registration' | 'active' | 'completed' | 'cancelled';
    max_players: number;
    current_players: number;
    created_at?: string;
    started_at?: string | null;
    completed_at?: string | null;
}

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

            // Retourner le tournoi créé (cast pour TypeScript)
            const createdTournament = db.prepare(`
                SELECT * FROM tournaments WHERE id = ?
            `).get(tournamentId) as TournamentRow | undefined;

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

    // GET /tournaments - Récupérer la liste des tournois
    fastify.get('/tournaments', async (_request: FastifyRequest, reply: FastifyReply) => {
        try {
            const tournaments = db.prepare(`SELECT * FROM tournaments ORDER BY created_at DESC`).all() as TournamentRow[];
            reply.send({ success: true, tournaments });
        } catch (error) {
            fastify.log.error(`Error fetching tournaments: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // POST /tournaments/:id/join - Inscrire un utilisateur à un tournoi
    interface JoinTournamentBody {
        userId: number;
        alias: string;
    }

    fastify.post('/tournaments/:id/join', async (request: FastifyRequest<{ Params: { id: string }, Body: JoinTournamentBody }>, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: string };
            const body = request.body as JoinTournamentBody;
            const { userId, alias } = body;

            if (!userId || !alias || alias.trim().length === 0) {
                return reply.status(400).send({ error: 'userId and alias are required' });
            }

            // Vérifier que le tournoi existe et est en phase d'inscription
            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(id) as TournamentRow | undefined;
            if (!tournament) {
                return reply.status(404).send({ error: 'Tournament not found' });
            }

            if (tournament.status !== 'registration') {
                return reply.status(400).send({ error: 'Tournament is not open for registration' });
            }

            if (tournament.current_players >= tournament.max_players) {
                return reply.status(400).send({ error: 'Tournament is full' });
            }

            // Insérer le participant (les contraintes UNIQUE en DB empêcheront les doublons)
            const insert = db.prepare(`
                INSERT INTO tournament_participants (tournament_id, user_id, alias)
                VALUES (?, ?, ?)
            `);

            try {
                const result = insert.run(id, userId, alias.trim());

                // Incrémenter le compteur de participants
                db.prepare(`UPDATE tournaments SET current_players = current_players + 1 WHERE id = ?`).run(id);

                const participant = db.prepare(`SELECT * FROM tournament_participants WHERE id = ?`).get(result.lastInsertRowid);

                reply.status(201).send({ success: true, participant });
            } catch (err: any) {
                // Gestion simple des erreurs de contrainte (user déjà inscrit ou alias déjà pris)
                if (err && err.code === 'SQLITE_CONSTRAINT') {
                    return reply.status(409).send({ error: 'User already joined or alias already taken' });
                }
                throw err;
            }
        } catch (error) {
            fastify.log.error(`Error joining tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}