/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/06 17:35:33 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom } from './roomManager.js';
import { handleMessage } from './messageHandlers.js';
export default function registerSocketHandlers(io, fastify) {
    io.on('connection', (socket) => {
        fastify.log.info(`Client connecté : ${socket.id}`);
        // Handler pour rejoindre une room existante (créée via REST)
        socket.on('joinRoom', (data) => {
            const { roomName } = data || {};
            if (!roomName || typeof roomName !== 'string') {
                socket.emit('error', { error: 'roomName requis' });
                return;
            }
            if (!roomExists(roomName)) {
                socket.emit('error', { error: 'Room does not exist' });
                return;
            }
            const previousRoom = getPlayerRoom(socket.id);
            if (previousRoom) {
                removePlayerFromRoom(socket.id, fastify.log.info.bind(fastify.log));
                socket.leave(previousRoom);
            }
            addPlayerToRoom(roomName, socket.id, fastify.log.info.bind(fastify.log));
            socket.join(roomName);
            fastify.log.info(`Joueur ${socket.id} rejoint la room ${roomName}`);
            socket.emit('roomJoined', { room: roomName });
        });
        socket.on('ping', (data) => {
            fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
            socket.emit('pong', { message: 'Hello client!' });
        });
        // Handler pour les messages (envoyés avec socket.send)
        socket.on('message', (msg) => {
            handleMessage(socket, fastify, msg);
        });
        socket.on('disconnect', () => {
            // Retirer le joueur de sa room
            removePlayerFromRoom(socket.id, fastify.log.info.bind(fastify.log));
        });
    });
}
