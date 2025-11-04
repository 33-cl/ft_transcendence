/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   notificationHandlers.ts                            :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/11/04 00:00:00 by qordoux           #+#    #+#             */
/*   Updated: 2025/11/04 00:00:00 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// src/socket/notificationHandlers.ts

import { Server } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getUserBasicInfo, emitToUser, getUserWithAvatar, getUserFriends } from './utils/friendNotifications.js';

/**
 * Notifie deux utilisateurs qu'ils sont devenus amis
 * 
 * Fonctionnement :
 * 1. Vérifie que Socket.IO est disponible
 * 2. Récupère les infos des deux utilisateurs depuis la DB
 * 3. Envoie à user1 une notification avec les infos de user2
 * 4. Envoie à user2 une notification avec les infos de user1
 * 
 * @param globalIo - Instance Socket.IO globale
 * @param user1Id - ID du premier utilisateur
 * @param user2Id - ID du second utilisateur
 * @param fastify - Instance Fastify pour les logs
 */
export function notifyFriendAdded(globalIo: Server | null, user1Id: number, user2Id: number, fastify: FastifyInstance)
{
    if (!globalIo)
        return;
    
    try {
        const user1 = getUserBasicInfo(user1Id);
        const user2 = getUserBasicInfo(user2Id);
        
        if (!user1 || !user2)
            return;
        
        emitToUser(globalIo, user1.id, 'friendAdded', {
            friend: {
                id: user2.id,
                username: user2.username
            },
            timestamp: Date.now()
        });
        
        emitToUser(globalIo, user2.id, 'friendAdded', {
            friend: {
                id: user1.id,
                username: user1.username
            },
            timestamp: Date.now()
        });
        
    } catch (error) {
        fastify.log.error(`Error notifying friend added: ${error}`);
    }
}

/**
 * Notifie deux utilisateurs que leur amitié a été supprimée
 * 
 * Fonctionnement similaire à notifyFriendAdded mais envoie 'friendRemoved'
 * 
 * @param globalIo - Instance Socket.IO globale
 * @param user1Id - ID du premier utilisateur
 * @param user2Id - ID du second utilisateur
 * @param fastify - Instance Fastify pour les logs
 */
export function notifyFriendRemoved(globalIo: Server | null, user1Id: number, user2Id: number, fastify: FastifyInstance) 
{
    if (!globalIo)
        return;
    
    try {
        const user1 = getUserBasicInfo(user1Id);
        const user2 = getUserBasicInfo(user2Id);
        
        if (!user1 || !user2)
            return;
        
        emitToUser(globalIo, user1.id, 'friendRemoved', {
            friendId: user2.id,
            timestamp: Date.now()
        });
        
        emitToUser(globalIo, user2.id, 'friendRemoved', {
            friendId: user1.id,
            timestamp: Date.now()
        });
        
    } catch (error) {
        fastify.log.error(`Error notifying friend removed: ${error}`);
    }
}

/**
 * Notifie tous les amis d'un utilisateur que son profil a été mis à jour
 * 
 * Fonctionnement :
 * 1. Vérifie que Socket.IO est disponible
 * 2. Récupère les infos de l'utilisateur (avec avatar)
 * 3. Récupère la liste de tous ses amis
 * 4. Envoie à chaque ami une notification avec les nouvelles infos
 * 
 * @param globalIo - Instance Socket.IO globale
 * @param userId - ID de l'utilisateur dont le profil a changé
 * @param updates - Les champs modifiés (username et/ou avatar_url)
 * @param fastify - Instance Fastify pour les logs
 */
export function notifyProfileUpdated(globalIo: Server | null, userId: number, updates: { username?: string; avatar_url?: string }, fastify: FastifyInstance)
{
    if (!globalIo)
        return;
    
    try {
        const user = getUserWithAvatar(userId);
        if (!user)
            return;
        const friends = getUserFriends(userId);
        for (const friend of friends)
        {
            emitToUser(globalIo, friend.id, 'profileUpdated', {
                userId: user.id,
                username: updates.username || user.username,
                avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
                timestamp: Date.now()
            });
        }
        
    } catch (error) {
        fastify.log.error(`Error notifying profile updated: ${error}`);
    }
}

/**
 * Notifie tous les amis d'un utilisateur de son changement de statut
 * 
 * Fonctionnement :
 * 1. Vérifie que Socket.IO est disponible
 * 2. Récupère les infos de l'utilisateur
 * 3. Récupère la liste de tous ses amis
 * 4. Envoie à chaque ami une notification avec le nouveau statut
 * 
 * @param globalIo - Instance Socket.IO globale
 * @param userId - ID de l'utilisateur dont le statut a changé
 * @param status - Le nouveau statut ('online', 'in-game', ou 'offline')
 * @param fastify - Instance Fastify pour les logs
 */
export function broadcastUserStatusChange(globalIo: Server | null, userId: number, status: 'online' | 'in-game' | 'offline', fastify: FastifyInstance)
{
    if (!globalIo) 
        return;
    
    try {
        const user = getUserBasicInfo(userId);
        if (!user)
            return;
        
        const friends = getUserFriends(userId);
        
        for (const friend of friends)
        {
            emitToUser(globalIo, friend.id, 'friendStatusChanged', {
                username: user.username,
                status: status,
                timestamp: Date.now()
            });
        }
        
    } catch (error) {
        fastify.log.error(`Error broadcasting user status change: ${error}`);
    }
}
