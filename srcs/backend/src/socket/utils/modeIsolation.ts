// src/socket/utils/modeIsolation.ts
// Module d'isolation entre le mode Tournoi et le mode Online
// Empêche un utilisateur d'être dans les deux modes simultanément

import db from '../../db.js';
import { rooms } from '../roomManager.js';
import { getSocketUser } from '../socketAuth.js';
import { Socket } from 'socket.io';

// ========================================
// TYPES
// ========================================

interface ActiveTournament {
    id: string;
    name: string;
    status: string;
}

interface OnlineGameInfo {
    roomName: string;
    isTournamentRoom: boolean;
}

// ========================================
// TOURNAMENT CHECKS
// ========================================

/**
 * Vérifie si un utilisateur (par userId) est inscrit à un tournoi actif (registration ou active)
 * @returns L'info du tournoi actif ou null
 */
export function getUserActiveTournament(userId: number): ActiveTournament | null {
    try {
        const result = db.prepare(`
            SELECT t.id, t.name, t.status
            FROM tournaments t
            JOIN tournament_participants tp ON t.id = tp.tournament_id
            WHERE tp.user_id = ?
            AND t.status IN ('registration', 'active')
            LIMIT 1
        `).get(userId) as ActiveTournament | undefined;

        return result || null;
    } catch (error) {
        console.error('Error checking user active tournament:', error);
        return null;
    }
}

/**
 * Vérifie si un utilisateur est dans un match de tournoi en cours
 * (c'est-à-dire dans une room avec tournamentId)
 */
export function isUserInTournamentMatch(userId: number): boolean {
    for (const [roomName, room] of Object.entries(rooms)) {
        // Vérifier si c'est une room de tournoi
        if (room.tournamentId && room.playerUsernames) {
            // Vérifier si l'utilisateur est dans cette room
            for (const [socketId, username] of Object.entries(room.playerUsernames)) {
                const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
                if (user && user.id === userId && room.pongGame) {
                    return true;
                }
            }
        }
    }
    return false;
}

// ========================================
// ONLINE GAME CHECKS
// ========================================

/**
 * Vérifie si un utilisateur (par userId) est dans un jeu online (non-tournoi)
 * @returns L'info de la room ou null
 */
export function getUserOnlineGame(userId: number): OnlineGameInfo | null {
    for (const [roomName, room] of Object.entries(rooms)) {
        // Ignorer les rooms de tournoi et les jeux locaux
        if (room.tournamentId || room.isLocalGame) {
            continue;
        }

        // Vérifier si l'utilisateur est dans cette room
        if (room.playerUsernames) {
            for (const [socketId, username] of Object.entries(room.playerUsernames)) {
                const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
                if (user && user.id === userId) {
                    return {
                        roomName,
                        isTournamentRoom: false
                    };
                }
            }
        }
    }
    return null;
}

/**
 * Vérifie si un utilisateur est dans un jeu online en cours (partie démarrée)
 */
export function isUserInActiveOnlineGame(userId: number): boolean {
    const gameInfo = getUserOnlineGame(userId);
    if (!gameInfo) return false;

    const room = rooms[gameInfo.roomName];
    return room && !!room.pongGame && room.pongGame.state.running;
}

// ========================================
// SOCKET-BASED CHECKS
// ========================================

/**
 * Vérifie si un socket peut rejoindre un jeu online (non-tournoi)
 * Bloque si l'utilisateur est dans un tournoi actif
 */
export function canSocketJoinOnlineGame(socket: Socket): { allowed: boolean; reason?: string; tournament?: ActiveTournament } {
    const user = getSocketUser(socket.id);
    if (!user) {
        // Non authentifié, laisser passer (les autres checks géreront)
        return { allowed: true };
    }

    // Vérifier si l'utilisateur est dans un tournoi actif
    const activeTournament = getUserActiveTournament(user.id);
    if (activeTournament) {
        return {
            allowed: false,
            reason: `You are registered in an active tournament "${activeTournament.name}". Please complete or leave the tournament before joining online games.`,
            tournament: activeTournament
        };
    }

    return { allowed: true };
}

/**
 * Vérifie si un utilisateur peut rejoindre/créer un tournoi
 * Bloque si l'utilisateur est dans un jeu online actif
 */
export function canUserJoinTournament(userId: number): { allowed: boolean; reason?: string } {
    // Vérifier si l'utilisateur est dans un jeu online
    const onlineGame = getUserOnlineGame(userId);
    if (onlineGame) {
        return {
            allowed: false,
            reason: 'You are currently in an online game. Please finish your game before joining a tournament.'
        };
    }

    // Vérifier si l'utilisateur est déjà dans un autre tournoi actif
    const activeTournament = getUserActiveTournament(userId);
    if (activeTournament) {
        return {
            allowed: false,
            reason: `You are already registered in tournament "${activeTournament.name}". You can only be in one active tournament at a time.`
        };
    }

    return { allowed: true };
}

/**
 * Vérifie si une room est une room de tournoi
 */
export function isTournamentRoom(roomName: string): boolean {
    const room = rooms[roomName];
    return room ? !!room.tournamentId : roomName.startsWith('tournament-');
}

// ========================================
// CLEANUP
// ========================================

/**
 * Vérifie et nettoie l'état d'un utilisateur si nécessaire
 * Appelé lors de la déconnexion pour s'assurer que l'utilisateur n'est pas bloqué
 */
export function cleanupUserIsolationState(userId: number): void {
    // Les rooms sont gérées automatiquement par le roomManager
    // Ici on pourrait ajouter une logique de nettoyage additionnelle si nécessaire
    console.log(`[Isolation] Cleanup state for user ${userId}`);
}
