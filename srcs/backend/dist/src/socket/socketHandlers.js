/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/09 19:58:44 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import { handleMessage } from './messageHandlers.js';
// Mutex to prevent concurrent joinRoom for the same socket
const joinRoomLocks = new Set();
export default function registerSocketHandlers(io, fastify) {
    io.on('connection', (socket) => {
        fastify.log.info(`Client connecté : ${socket.id}`);
        // Handler pour rejoindre une room existante (créée via REST)
        socket.on('joinRoom', async (data) => {
            if (joinRoomLocks.has(socket.id)) {
                fastify.log.warn(`joinRoom already in progress for ${socket.id}`);
                return;
            }
            joinRoomLocks.add(socket.id);
            try {
                const { roomName } = data || {};
                if (!roomName || typeof roomName !== 'string') {
                    socket.emit('error', { error: 'roomName requis' });
                    return;
                }
                if (!roomExists(roomName)) {
                    socket.emit('error', { error: 'Room does not exist' });
                    return;
                }
                const room = rooms[roomName];
                const previousRoom = getPlayerRoom(socket.id);
                // HARD BLOCK: Si déjà dans une room non pleine du même type, refuser le join
                if (previousRoom) {
                    const prevRoomObj = rooms[previousRoom];
                    if (prevRoomObj &&
                        prevRoomObj.players.length < prevRoomObj.maxPlayers &&
                        prevRoomObj.maxPlayers === room.maxPlayers // bloque seulement si on veut une room du même type
                    ) {
                        socket.emit('roomJoined', { room: previousRoom });
                        return;
                    }
                }
                if (previousRoom === roomName) {
                    socket.emit('roomJoined', { room: roomName });
                    return;
                }
                if (room.players.length >= room.maxPlayers) {
                    socket.emit('error', { error: 'Room is full' });
                    return;
                }
                if (previousRoom) {
                    removePlayerFromRoom(socket.id);
                    socket.leave(previousRoom);
                }
                // Nettoyage simple : retire le joueur de toutes les rooms où il pourrait être
                for (const rName in rooms) {
                    if (rooms[rName].players.includes(socket.id)) {
                        rooms[rName].players = rooms[rName].players.filter(id => id !== socket.id);
                        if (rooms[rName].players.length === 0) {
                            delete rooms[rName];
                        }
                    }
                }
                // Ajout du joueur si pas déjà présent
                if (!room.players.includes(socket.id)) {
                    addPlayerToRoom(roomName, socket.id);
                    socket.join(roomName);
                }
                socket.emit('roomJoined', { room: roomName });
            }
            finally {
                joinRoomLocks.delete(socket.id);
            }
        });
        socket.on('ping', (data) => {
            socket.emit('pong', { message: 'Hello client!' });
        });
        // Handler pour les messages (envoyés avec socket.send)
        socket.on('message', (msg) => {
            handleMessage(socket, fastify, msg);
        });
        socket.on('disconnect', () => {
            removePlayerFromRoom(socket.id);
        });
    });
}
