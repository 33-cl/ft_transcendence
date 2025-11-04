/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   friendNotifications.ts                             :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/11/04 00:00:00 by qordoux           #+#    #+#             */
/*   Updated: 2025/11/04 00:00:00 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

/**
 * Utilitaires SIMPLES pour gérer les notifications liées aux amis
 * 
 * Ces fonctions sont des petits helpers pour éviter la duplication de code.
 * La logique principale reste dans socketHandlers.ts pour rester lisible.
 */

import { Server } from 'socket.io';
import db from '../../db.js';
import { getSocketIdForUser } from '../socketAuth.js';

/**
 * Interface représentant un utilisateur de base
 */
interface UserBasicInfo {
    id: number;
    username: string;
}

/**
 * Interface représentant un utilisateur avec son avatar
 */
interface UserWithAvatar {
    id: number;
    username: string;
    avatar_url: string | null;
}

/**
 * Récupère les informations basiques d'un utilisateur par son ID
 * 
 * C'est juste un wrapper simple pour éviter de répéter la requête SQL partout
 * 
 * @param userId - L'ID de l'utilisateur
 * @returns Les infos de l'utilisateur ou undefined si non trouvé
 */
export function getUserBasicInfo(userId: number): UserBasicInfo | undefined
{
    return db
        .prepare('SELECT id, username FROM users WHERE id = ?')
        .get(userId) as UserBasicInfo | undefined;
}

/**
 * Récupère les informations complètes d'un utilisateur (avec avatar)
 * 
 * @param userId - L'ID de l'utilisateur
 * @returns Les infos de l'utilisateur ou undefined si non trouvé
 */
export function getUserWithAvatar(userId: number): UserWithAvatar | undefined
{
    return db
        .prepare('SELECT id, username, avatar_url FROM users WHERE id = ?')
        .get(userId) as UserWithAvatar | undefined;
}

/**
 * Récupère tous les amis d'un utilisateur (dans les deux sens)
 * 
 * La requête SQL cherche :
 * - Les users où userId est friend_id (A a ajouté B)
 * - Les users où userId est user_id (B a ajouté A)
 * 
 * @param userId - L'ID de l'utilisateur
 * @returns La liste des amis (peut être vide)
 */
export function getUserFriends(userId: number): Array<UserBasicInfo>
{
    return db.prepare(`
        SELECT DISTINCT u.id, u.username
        FROM users u
        WHERE u.id IN (
            SELECT friend_id FROM friendships WHERE user_id = ?
            UNION
            SELECT user_id FROM friendships WHERE friend_id = ?
        )
    `).all(userId, userId) as Array<UserBasicInfo>;
}

/**
 * Récupère la socket d'un utilisateur et envoie un événement
 * 
 * Cette fonction encapsule la logique répétitive :
 * 1. Trouver l'ID de socket de l'utilisateur
 * 2. Récupérer l'objet socket
 * 3. Émettre l'événement
 * 
 * @param io - L'instance Socket.IO
 * @param userId - L'ID de l'utilisateur à notifier
 * @param eventName - Le nom de l'événement à émettre
 * @param data - Les données à envoyer
 * @returns true si la notification a été envoyée, false sinon
 */
export function emitToUser(
    io: Server,
    userId: number,
    eventName: string,
    data: any
): boolean {
    // 1. Trouver la socket de l'utilisateur
    const socketId = getSocketIdForUser(userId);
    if (!socketId) {
        return false; // L'utilisateur n'est pas connecté
    }

    // 2. Récupérer l'objet socket
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
        return false; // La socket n'existe plus
    }

    // 3. Envoyer l'événement
    socket.emit(eventName, data);
    return true;
}
