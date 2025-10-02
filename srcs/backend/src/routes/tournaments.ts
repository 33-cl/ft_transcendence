// routes/tournaments.ts - Routes API pour les tournois

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

// Interface pour la création d'un tournoi
interface CreateTournamentBody {
    name: string;
    maxPlayers?: number;
}
