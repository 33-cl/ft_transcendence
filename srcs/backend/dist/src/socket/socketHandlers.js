/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/11 17:27:36 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import { handleMessage } from './messageHandlers.js';
// Mutex to prevent concurrent joinRoom for the same socket
const joinRoomLocks = new Set();
// Vérifie si le client peut rejoindre la room (nom valide et room existante)
function canJoinRoom(socket, roomName) {
    if (!roomName || typeof roomName !== 'string') {
        socket.emit('error', { error: 'roomName requested' });
        return false;
    }
    if (!roomExists(roomName)) {
        socket.emit('error', { error: 'Room does not exist' });
        return false;
    }
    return true;
}
// Bloque le "zapping" si le client est déjà dans une room non pleine du même type
function hardBlockAntiZap(socket, previousRoom, room) {
    if (previousRoom) {
        const prevRoomObj = rooms[previousRoom];
        if (prevRoomObj && prevRoomObj.players.length < prevRoomObj.maxPlayers && prevRoomObj.maxPlayers === room.maxPlayers) {
            // Refuse le join et renvoie le client dans sa room actuelle
            socket.emit('roomJoined', { room: previousRoom });
            return true;
        }
    }
    return false;
}
// Si le client demande à rejoindre la même room où il est déjà, on confirme simplement
function handleRoomSwitch(socket, previousRoom, roomName) {
    if (previousRoom === roomName) {
        socket.emit('roomJoined', { room: roomName });
        return true;
    }
    return false;
}
// Vérifie si la room est pleine
function handleRoomFull(socket, room) {
    if (room.players.length >= room.maxPlayers) {
        socket.emit('error', { error: 'Room is full' });
        return true;
    }
    return false;
}
// Retire le joueur de toutes les rooms où il pourrait être (sécurité)
function cleanUpPlayerRooms(socket) {
    for (const rName in rooms) {
        if (rooms[rName].players.includes(socket.id)) {
            rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
            if (rooms[rName].players.length === 0) {
                delete rooms[rName]; // Supprime la room si elle est vide
            }
        }
    }
}
// Ajoute le joueur à la room et le fait rejoindre côté socket.io
function joinPlayerToRoom(socket, roomName, room) {
    //si le joueur n'est pas déjà dans la room, on l'ajoute
    if (!room.players.includes(socket.id)) {
        addPlayerToRoom(roomName, socket.id);
        socket.join(roomName);
    }
    socket.emit('roomJoined', { room: roomName });
}
// Fonction principale qui enregistre tous les handlers socket.io
export default function registerSocketHandlers(io, fastify) {
    io.on('connection', (socket) => {
        // Log la connexion d'un nouveau client
        fastify.log.info(`Client connecté : ${socket.id}`);
        // Handler pour rejoindre une room existante (créée via REST)
        socket.on('joinRoom', async (data) => {
            // Empêche le double join simultané pour un même client
            if (joinRoomLocks.has(socket.id)) {
                fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
                return;
            }
            joinRoomLocks.add(socket.id);
            try {
                const { roomName } = data || {};
                // Vérifie la validité de la room demandée
                if (!canJoinRoom(socket, roomName))
                    return;
                const room = rooms[roomName];
                const previousRoom = getPlayerRoom(socket.id);
                // Applique la sécurité anti-zap
                if (hardBlockAntiZap(socket, previousRoom, room))
                    return;
                // Si déjà dans la room demandée, confirme simplement
                if (handleRoomSwitch(socket, previousRoom, roomName))
                    return;
                // Refuse si la room est pleine
                if (handleRoomFull(socket, room))
                    return;
                // Retire le joueur de sa room précédente (si besoin)
                if (previousRoom) {
                    removePlayerFromRoom(socket.id);
                    socket.leave(previousRoom);
                }
                // Nettoie toutes les rooms où il pourrait être
                cleanUpPlayerRooms(socket);
                // Ajoute le joueur à la nouvelle room
                joinPlayerToRoom(socket, roomName, room);
            }
            finally {
                // Retire le lock pour permettre de rejoindre une autre room ensuite
                joinRoomLocks.delete(socket.id);
            }
        });
        // Handler pour le ping/pong (test de connexion)
        socket.on('ping', (data) => {
            socket.emit('pong', { message: 'Hello client!' });
        });
        // Handler pour les messages relayés dans la room
        socket.on('message', (msg) => {
            handleMessage(socket, fastify, msg);
        });
        // Handler pour la déconnexion du client
        socket.on('disconnect', () => {
            removePlayerFromRoom(socket.id);
        });
    });
}
