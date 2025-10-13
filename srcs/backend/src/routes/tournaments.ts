// routes/tournaments.ts - Routes API pour les tournois

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validateLength, sanitizeUsername, validateId } from '../security.js';

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

            // SECURITY: Validation du nom du tournoi
            if (!name || name.trim().length === 0) {
                return reply.status(400).send({ error: 'Tournament name is required' });
            }

            if (!validateLength(name, 1, 50)) {
                return reply.status(400).send({ error: 'Tournament name must be between 1 and 50 characters' });
            }
            
            // Sanitize le nom pour éviter les injections
            const sanitizedName = name.replace(/<[^>]*>/g, '').trim();

            // SECURITY: Validation stricte du nombre de joueurs
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

            stmt.run(tournamentId, sanitizedName, maxPlayers);

            // Indique l'URL de la ressource nouvellement créée
            reply.header('Location', `/tournaments/${tournamentId}`);

            // Retourner le tournoi créé (cast pour TypeScript)
            const createdTournament = db.prepare(`
                SELECT * FROM tournaments WHERE id = ?
            `).get(tournamentId) as TournamentRow | undefined;

            fastify.log.info(`Tournament created: ${sanitizedName} (${tournamentId})`);

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

            // SECURITY: Validate userId
            const validUserId = validateId(userId);
            if (!validUserId) {
                return reply.status(400).send({ error: 'Invalid userId' });
            }

            // SECURITY: Validate alias
            if (!alias || !validateLength(alias, 1, 30)) {
                return reply.status(400).send({ error: 'Alias must be between 1 and 30 characters' });
            }
            
            const sanitizedAlias = sanitizeUsername(alias);
            
            // SECURITY: Validate tournament ID format (UUID)
            if (!id || id.length < 10 || id.length > 50) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
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

            // Vérifications proactives pour renvoyer des erreurs précises
            const existingByUser = db.prepare(
                `SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?`
            ).get(id, validUserId);
            if (existingByUser) {
                return reply.status(409).send({ error: 'User already joined this tournament' });
            }

            const existingByAlias = db.prepare(
                `SELECT id FROM tournament_participants WHERE tournament_id = ? AND alias = ?`
            ).get(id, sanitizedAlias);
            if (existingByAlias) {
                return reply.status(409).send({ error: 'Alias already taken in this tournament' });
            }

            // Insérer le participant
            const insert = db.prepare(`
                INSERT INTO tournament_participants (tournament_id, user_id, alias)
                VALUES (?, ?, ?)
            `);

            const result = insert.run(id, validUserId, sanitizedAlias);

            // Incrémenter le compteur de participants
            db.prepare(`UPDATE tournaments SET current_players = current_players + 1 WHERE id = ?`).run(id);

            const participant = db.prepare(`SELECT * FROM tournament_participants WHERE id = ?`).get(result.lastInsertRowid);

            reply.status(201).send({ success: true, participant });
        } catch (error) {
            fastify.log.error(`Error joining tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}