// routes/tournaments.ts - Endpoints HTTP - Routes API pour les tournois (C'est la couche HTTP qui reçoit les requêtes des clients (frontend).)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { validateLength, sanitizeUsername, validateId, validateUUID, checkRateLimit } from '../security.js';
import jwt from 'jsonwebtoken';
import { getJwtFromRequest } from '../helpers/http/cookie.helper.js';
import { generateBracket, updateMatchResult } from '../tournament.js';
import { emitTournamentPlayerUpdate, emitTournamentStarted } from '../socket/handlers/tournamentHandlers.js';
import { rooms, roomExists } from '../socket/roomManager.js';
import { createInitialGameState } from '../../game/gameState.js';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Typages minimaux pour les résultats SQL utilisés ici
interface TournamentRow {
    id: string;
    name?: string;
    status: 'registration' | 'active' | 'completed' | 'cancelled';
    max_players: number;
    current_players: number;
    winner_id?: number | null;
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
    // SECURITY: Rate limiting pour éviter le spam de création
    fastify.post('/tournaments', async (request: FastifyRequest<{ Body: CreateTournamentBody }>, reply: FastifyReply) => {
        try {
            // SECURITY: Validation de l'utilisateur
            const token = getJwtFromRequest(request);
            if (!token) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId: number;
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = decoded.userId;
            } catch (error) {
                return reply.status(401).send({ error: 'Invalid token' });
            }

            // SECURITY: Rate limiting - 5 créations de tournoi par minute par user
            if (!checkRateLimit(`tournament_create_${userId}`, 5, 60000)) {
                return reply.status(429).send({ error: 'Too many tournament creations. Please wait.' });
            }

            const body = request.body as CreateTournamentBody;
            const { name, maxPlayers = 4 } = body;

            // SECURITY: Validation du nom du tournoi
            if (!name || name.trim().length === 0) {
                return reply.status(400).send({ error: 'Tournament name is required' });
            }

            if (!validateLength(name, 1, 50)) {
                return reply.status(400).send({ error: 'Tournament name must be between 1 and 50 characters' });
            }
            
            // Sanitize le nom pour éviter les injections
            const sanitizedName = name.replace(/<[^>]*>/g, '').trim();

            // SECURITY: Validation stricte - 4 joueurs uniquement pour les specs
            if (maxPlayers !== 4) {
                return reply.status(400).send({ error: 'Max players must be 4 for tournament specs' });
            }

            // Générer un ID unique
            const tournamentId = uuidv4();

            // Insérer en base de données avec le creator_id
            const stmt = db.prepare(`
                INSERT INTO tournaments (id, name, creator_id, status, max_players, current_players)
                VALUES (?, ?, ?, 'registration', ?, 0)
            `);

            stmt.run(tournamentId, sanitizedName, userId, maxPlayers);

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

    // GET /tournaments/:id - Récupérer les détails d'un tournoi (participants + bracket)
    fastify.get('/tournaments/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: string };

            if (!validateUUID(id)) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
            }

            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(id) as TournamentRow | undefined;
            if (!tournament) {
                return reply.status(404).send({ error: 'Tournament not found' });
            }

            const participants = db.prepare(
                `SELECT id, tournament_id, user_id, alias, joined_at FROM tournament_participants WHERE tournament_id = ? ORDER BY joined_at`
            ).all(id);

            const matches = db.prepare(
                `SELECT id, tournament_id, round, player1_id, player2_id, winner_id, status, scheduled_at FROM tournament_matches WHERE tournament_id = ? ORDER BY round, id`
            ).all(id);

            reply.send({ success: true, tournament, participants, matches });
        } catch (error) {
            fastify.log.error(`Error fetching tournament details: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // GET /tournaments - Récupérer la liste des tournois
    fastify.get('/tournaments', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const tournaments = db.prepare(`SELECT * FROM tournaments ORDER BY created_at DESC`).all() as TournamentRow[];
            
            // Get current user if authenticated
            const token = getJwtFromRequest(request);
            let userId: number | null = null;
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET) as any;
                    userId = decoded.userId;
                } catch (error) {
                    // Token invalid, continue without user
                }
            }
            
            // Add is_participant and is_creator flags to each tournament
            const tournamentsWithParticipation = tournaments.map(t => {
                let is_participant = false;
                let is_creator = false;
                if (userId) {
                    const participant = db.prepare(`
                        SELECT id FROM tournament_participants 
                        WHERE tournament_id = ? AND user_id = ?
                    `).get(t.id, userId);
                    is_participant = !!participant;
                    
                    // Check if current user is the creator
                    is_creator = (t as any).creator_id === userId;
                }
                return { ...t, is_participant, is_creator };
            });
            
            reply.send({ success: true, tournaments: tournamentsWithParticipation });
        } catch (error) {
            fastify.log.error(`Error fetching tournaments: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // POST /tournaments/:id/join - Inscrire un utilisateur à un tournoi
    // SECURITY: Rate limiting pour éviter le spam de join
    interface JoinTournamentBody {} // Empty body, we use authenticated user

    fastify.post('/tournaments/:id/join', async (request: FastifyRequest<{ Params: { id: string }, Body: JoinTournamentBody }>, reply: FastifyReply) => {
        try {
            // SECURITY: Require authentication - get user from JWT
            const jwtToken = getJwtFromRequest(request);
            if (!jwtToken) {
                return reply.status(401).send({ error: 'Authentication required' });
            }

            let userId: number;
            let alias: string;
            try {
                const payload = jwt.verify(jwtToken, JWT_SECRET) as { userId: number };
                
                // Verify token is in active_tokens table
                const activeToken = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(payload.userId, jwtToken);
                if (!activeToken) {
                    return reply.status(401).send({ error: 'Session expired or logged out' });
                }
                
                // Get user info to use username as alias
                const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.userId) as { id: number; username: string } | undefined;
                if (!user) {
                    return reply.status(401).send({ error: 'User not found' });
                }
                
                userId = user.id;
                alias = user.username; // Force alias = username
            } catch (jwtError) {
                return reply.status(401).send({ error: 'Invalid or expired JWT' });
            }

            // SECURITY: Rate limiting - 20 joins par minute par user (permet plusieurs tournois)
            if (!checkRateLimit(`tournament_join_${userId}`, 20, 60000)) {
                return reply.status(429).send({ error: 'Too many join attempts. Please wait.' });
            }

            const { id } = request.params as { id: string };

            // SECURITY: Validate userId (already validated from JWT/DB)
            const validUserId = validateId(userId);
            if (!validUserId) {
                return reply.status(400).send({ error: 'Invalid userId' });
            }

            // SECURITY: Validate alias (username from DB is already sanitized)
            if (!alias || !validateLength(alias, 1, 30)) {
                return reply.status(400).send({ error: 'Username must be between 1 and 30 characters' });
            }
            
            const sanitizedAlias = sanitizeUsername(alias);
            
            // SECURITY: Validate tournament ID format (UUID)
            if (!validateUUID(id)) {
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

            // Si le tournoi est désormais plein, générer automatiquement le bracket complet
            const updatedTournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(id) as TournamentRow;
            
            // Emit WebSocket event to notify player joined
            emitTournamentPlayerUpdate(id, 'joined', {
                user_id: validUserId,
                alias: sanitizedAlias,
                current_players: updatedTournament.current_players
            });
            
            if (updatedTournament.current_players >= updatedTournament.max_players) {
                // Générer le bracket complet (2 demi-finales + 1 finale)
                generateBracket(id);
                
                // Marquer le tournoi comme actif
                db.prepare(`UPDATE tournaments SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
                
                fastify.log.info(`Tournament ${id} auto-started with ${updatedTournament.current_players} players`);
            }

            reply.status(201).send({ success: true, participant });
        } catch (error) {
            fastify.log.error(`Error joining tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // POST /tournaments/:id/leave - Quitter un tournoi
    fastify.post('/tournaments/:id/leave', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            // SECURITY: Validation de l'utilisateur
            const token = getJwtFromRequest(request);
            if (!token) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId: number;
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = decoded.userId;
            } catch (error) {
                return reply.status(401).send({ error: 'Invalid token' });
            }

            const { id } = request.params as { id: string };
            
            // SECURITY: Validate tournament ID
            if (!validateUUID(id)) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
            }

            // Vérifier que le tournoi existe et est en phase d'inscription
            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(id) as TournamentRow | undefined;
            if (!tournament) {
                return reply.status(404).send({ error: 'Tournament not found' });
            }

            if (tournament.status !== 'registration') {
                return reply.status(400).send({ error: 'Cannot leave tournament: registration is closed' });
            }

            // Vérifier que l'utilisateur est bien participant
            const participant = db.prepare(`
                SELECT id, alias FROM tournament_participants 
                WHERE tournament_id = ? AND user_id = ?
            `).get(id, userId) as { id: number; alias: string } | undefined;

            if (!participant) {
                return reply.status(400).send({ error: 'You are not a participant of this tournament' });
            }

            // Supprimer le participant
            db.prepare(`DELETE FROM tournament_participants WHERE tournament_id = ? AND user_id = ?`).run(id, userId);
            
            // Décrémenter le compteur de participants
            db.prepare(`UPDATE tournaments SET current_players = current_players - 1 WHERE id = ?`).run(id);

            // Get updated player count
            const updatedTournament = db.prepare(`SELECT current_players FROM tournaments WHERE id = ?`).get(id) as { current_players: number } | undefined;

            // Emit WebSocket event to notify player left
            emitTournamentPlayerUpdate(id, 'left', {
                user_id: userId,
                alias: participant.alias,
                current_players: updatedTournament?.current_players || 0
            });

            reply.send({ success: true, message: 'Left tournament successfully' });
        } catch (error) {
            fastify.log.error(`Error leaving tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // POST /tournaments/:id/start - Démarrer manuellement un tournoi (si 4 joueurs)
    fastify.post('/tournaments/:id/start', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const { id } = request.params as { id: string };
            
            // SECURITY: Validate tournament ID
            if (!validateUUID(id)) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
            }

            // Vérifier que le tournoi existe et est en registration
            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(id) as TournamentRow | undefined;
            if (!tournament) {
                return reply.status(404).send({ error: 'Tournament not found' });
            }

            if (tournament.status !== 'registration') {
                return reply.status(400).send({ error: 'Tournament is not in registration phase' });
            }

            if (tournament.current_players < tournament.max_players) {
                return reply.status(400).send({ error: `Tournament needs ${tournament.max_players} players to start (current: ${tournament.current_players})` });
            }

            // Générer le bracket du tournoi (2 demi-finales + 1 finale) via la fonction dédiée
            // Cette fonction crée automatiquement les 3 matchs nécessaires pour un tournoi à 4 joueurs
            generateBracket(id);
            
            // Mettre à jour le statut du tournoi (maintenant géré par generateBracket pour la cohérence)
            db.prepare(`UPDATE tournaments SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
            
            fastify.log.info(`Tournament ${id} started manually with ${tournament.current_players} players`);
            
            // Récupérer les matchs générés pour l'événement WebSocket
            const matches = db.prepare(
                `SELECT id, round, player1_id, player2_id FROM tournament_matches WHERE tournament_id = ? ORDER BY round, id`
            ).all(id) as Array<{ id: number; round: number; player1_id: number | null; player2_id: number | null }>;
            
            // Emit WebSocket event to notify tournament started
            emitTournamentStarted(id, matches);

            reply.send({ success: true, message: 'Tournament started successfully' });
        } catch (error) {
            fastify.log.error(`Error starting tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // POST /tournaments/:id/matches/:matchId/result - Enregistrer le résultat d'un match de tournoi
    // SECURITY: Route protégée par JWT - seul un participant du match peut enregistrer le résultat
    interface MatchResultBody {
        winnerId: number;
        loserId: number;
        winnerScore: number;
        loserScore: number;
    }

    fastify.post('/tournaments/:id/matches/:matchId/result', async (request: FastifyRequest<{ Params: { id: string, matchId: string }, Body: MatchResultBody }>, reply: FastifyReply) => {
        try {
            // SECURITY: Vérifier l'authentification
            const token = getJwtFromRequest(request);
            if (!token) {
                return reply.status(401).send({ error: 'Authentication required' });
            }

            let currentUserId: number;
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                const activeToken = db.prepare('SELECT 1 FROM active_tokens WHERE user_id = ? AND token = ?').get(decoded.userId, token);
                if (!activeToken) {
                    return reply.status(401).send({ error: 'Session expired or logged out' });
                }
                currentUserId = decoded.userId;
            } catch (error) {
                return reply.status(401).send({ error: 'Invalid token' });
            }

            const { id, matchId } = request.params as { id: string, matchId: string };
            const body = request.body as MatchResultBody;

            if (!validateUUID(id)) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
            }

            const tid = id;
            const mid = parseInt(matchId, 10);
            if (Number.isNaN(mid)) return reply.status(400).send({ error: 'Invalid matchId' });

            const { winnerId, loserId, winnerScore = 0, loserScore = 0 } = body || {};
            if (!validateId(winnerId) || !validateId(loserId)) {
                return reply.status(400).send({ error: 'Invalid winnerId or loserId' });
            }

            // Vérifier que le tournoi et le match existent
            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(tid) as TournamentRow | undefined;
            if (!tournament) return reply.status(404).send({ error: 'Tournament not found' });

            const tm = db.prepare(`SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?`).get(mid, tid) as any;
            if (!tm) return reply.status(404).send({ error: 'Match not found for this tournament' });

            if (tm.status === 'finished') return reply.status(400).send({ error: 'Match already finished' });

            // Validate winner belongs to the match
            if (tm.player1_id !== winnerId && tm.player2_id !== winnerId) {
                return reply.status(400).send({ error: 'Winner is not a participant of this match' });
            }

            // SECURITY: Vérifier que l'utilisateur courant est bien un des participants du match
            const participant1 = db.prepare(`SELECT user_id FROM tournament_participants WHERE id = ?`).get(tm.player1_id) as any;
            const participant2 = db.prepare(`SELECT user_id FROM tournament_participants WHERE id = ?`).get(tm.player2_id) as any;
            
            if ((!participant1 || participant1.user_id !== currentUserId) && 
                (!participant2 || participant2.user_id !== currentUserId)) {
                return reply.status(403).send({ error: 'You are not a participant of this match' });
            }

            // Use dedicated function to update match result and advance bracket automatically
            updateMatchResult(mid, winnerId);

            // Insert global match record for statistics
            const insertGlobal = db.prepare(`
                INSERT INTO matches (winner_id, loser_id, winner_score, loser_score, match_type)
                VALUES (?, ?, ?, ?, 'tournament')
            `);
            insertGlobal.run(winnerId, loserId, winnerScore, loserScore);

            reply.send({ success: true });
        } catch (error) {
            fastify.log.error(`Error recording tournament match result: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });



    
    // POST /tournaments/:id/matches/:matchId/play - Créer une room Pong pour jouer un match de tournoi
    fastify.post('/tournaments/:id/matches/:matchId/play', async (request: FastifyRequest<{ Params: { id: string, matchId: string } }>, reply: FastifyReply) => {
        try {
            // SECURITY: Authentification
            const token = getJwtFromRequest(request);
            if (!token) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId: number;
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = decoded.userId;
            } catch (error) {
                return reply.status(401).send({ error: 'Invalid token' });
            }

            const { id, matchId } = request.params as { id: string, matchId: string };

            // Validation des paramètres
            if (!validateUUID(id)) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
            }

            const tid = id;
            const mid = parseInt(matchId, 10);
            if (Number.isNaN(mid)) {
                return reply.status(400).send({ error: 'Invalid matchId' });
            }

            // Vérifier que le tournoi existe et est actif
            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(tid) as TournamentRow | undefined;
            if (!tournament) {
                return reply.status(404).send({ error: 'Tournament not found' });
            }

            if (tournament.status !== 'active') {
                return reply.status(400).send({ error: 'Tournament is not active. Cannot start match.' });
            }

            // Vérifier que le match existe et appartient au tournoi
            const match = db.prepare(`
                SELECT tm.*, 
                       u1.username as player1_username, 
                       u2.username as player2_username
                FROM tournament_matches tm
                LEFT JOIN tournament_participants tp1 ON tm.player1_id = tp1.id
                LEFT JOIN users u1 ON tp1.user_id = u1.id
                LEFT JOIN tournament_participants tp2 ON tm.player2_id = tp2.id
                LEFT JOIN users u2 ON tp2.user_id = u2.id
                WHERE tm.id = ? AND tm.tournament_id = ?
            `).get(mid, tid) as any;

            if (!match) {
                return reply.status(404).send({ error: 'Match not found for this tournament' });
            }

            if (match.status !== 'scheduled') {
                return reply.status(400).send({ error: 'Match is not scheduled. Cannot start match.' });
            }

            // Vérifier que les 2 joueurs sont définis
            if (!match.player1_id || !match.player2_id) {
                return reply.status(400).send({ error: 'Match does not have 2 players assigned' });
            }

            // Récupérer les user_id des participants pour la vérification de sécurité
            const participant1 = db.prepare(`SELECT user_id FROM tournament_participants WHERE id = ?`).get(match.player1_id) as any;
            const participant2 = db.prepare(`SELECT user_id FROM tournament_participants WHERE id = ?`).get(match.player2_id) as any;

            if (!participant1 || !participant2) {
                return reply.status(400).send({ error: 'Could not find participant data' });
            }

            // SECURITY: Vérifier que l'utilisateur est l'un des 2 joueurs du match
            if (userId !== participant1.user_id && userId !== participant2.user_id) {
                return reply.status(403).send({ error: 'You are not a participant of this match' });
            }

            // Générer le nom de la room (unique par match)
            const roomName = `tournament_${tid}_match_${mid}`;

            // Vérifier si la room existe déjà
            if (roomExists(roomName)) {
                // Room existe déjà, retourner ses infos
                return reply.send({
                    success: true,
                    roomName: roomName,
                    match: {
                        id: match.id,
                        player1_id: match.player1_id,
                        player2_id: match.player2_id,
                        player1_username: match.player1_username,
                        player2_username: match.player2_username,
                        round: match.round
                    },
                    message: 'Match room already exists. Join with socket.emit(\'joinRoom\', { roomName })'
                });
            }

            // Créer la room manuellement avec métadonnées
            const newRoom = {
                players: [],
                maxPlayers: 2,
                gameState: createInitialGameState(2),
                isLocalGame: false, // Tournoi = online game
                tournamentId: tid,  // Métadonnée pour retrouver le tournoi
                matchId: mid        // Métadonnée pour retrouver le match
            };

            rooms[roomName] = newRoom;

            fastify.log.info(`✅ Tournament match room created: ${roomName} for tournament ${tid}, match ${mid}`);

            // Retourner les infos de la room créée
            return reply.send({
                success: true,
                roomName: roomName,
                match: {
                    id: match.id,
                    player1_id: match.player1_id,
                    player2_id: match.player2_id,
                    player1_username: match.player1_username,
                    player2_username: match.player2_username,
                    round: match.round
                },
                message: 'Match room created. Join with socket.emit(\'joinRoom\', { roomName })'
            });

        } catch (error) {
            fastify.log.error(`Error creating tournament match room: ${error}`);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });



    
    // DELETE /tournaments/:id - Supprimer un tournoi
    fastify.delete('/tournaments/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const tournamentId = request.params.id;

            // SECURITY: Authentification de l'utilisateur
            const token = getJwtFromRequest(request);
            if (!token)
                return reply.status(401).send({ error: 'Unauthorized' });
            let userId: number;
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as any;
                userId = decoded.userId;
            } catch (error) {
                return reply.status(401).send({ error: 'Invalid token' });
            }

            // Validation de l'ID du tournoi (UUID)
            if (!validateUUID(tournamentId)) {
                return reply.status(400).send({ error: 'Invalid tournament ID' });
            }

            // Vérifier que le tournoi existe
            const tournament = db.prepare(`SELECT * FROM tournaments WHERE id = ?`).get(tournamentId) as TournamentRow | undefined;
            if (!tournament) {
                return reply.status(404).send({ error: 'Tournament not found' });
            }

            // SECURITY: Seuls les tournois en statut 'registration' peuvent être supprimés
            if (tournament.status !== 'registration') {
                return reply.status(403).send({ error: 'Cannot delete tournament that has already started' });
            }

            // Vérifier si l'utilisateur est le créateur du tournoi (ou admin)
            const creatorCheck = db.prepare(`
                SELECT creator_id FROM tournaments WHERE id = ?
            `).get(tournamentId) as { creator_id: number } | undefined;

            if (creatorCheck && creatorCheck.creator_id !== userId) {
                return reply.status(403).send({ error: 'Only the tournament creator can delete it' });
            }

            // Supprimer le tournoi et ses données associées (cascade)
            const deleteResult = db.transaction(() => {
                // Supprimer les participations
                db.prepare(`DELETE FROM tournament_participants WHERE tournament_id = ?`).run(tournamentId);
                // Supprimer les matches (si il y en a)
                db.prepare(`DELETE FROM tournament_matches WHERE tournament_id = ?`).run(tournamentId);
                // Supprimer le tournoi
                const result = db.prepare(`DELETE FROM tournaments WHERE id = ?`).run(tournamentId);
                return result;
            })();

            if (deleteResult.changes === 0) {
                return reply.status(404).send({ error: 'Tournament not found or already deleted' });
            }

            reply.send({ 
                success: true, 
                message: `Tournament "${tournament.name || 'Unknown'}" has been deleted` 
            });
        } catch (error) {
            fastify.log.error(`Error deleting tournament: ${error}`);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}