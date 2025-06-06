/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/06 20:51:46 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// src/socket/socketHandlers.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getPlayerRoom, removePlayerFromRoom, roomExists, addPlayerToRoom, rooms } from './roomManager.js';
import { handleMessage } from './messageHandlers.js';


export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
	io.on('connection', (socket: Socket) =>
	{
		fastify.log.info(`Client connecté : ${socket.id}`);

		// Handler pour rejoindre une room existante (créée via REST)
			socket.on('joinRoom', (data: any) =>
			{
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
				// Si déjà dans la bonne room, ne rien faire (ou renvoyer roomJoined)
				if (previousRoom === roomName) {
					socket.emit('roomJoined', { room: roomName });
					return;
				}
				// Si la room est pleine et qu'on n'est pas déjà dedans, refuser
				if (room.players.length >= room.maxPlayers) {
					socket.emit('error', { error: 'Room is full' });
					return;
				}
				// Si dans une autre room, quitter l'ancienne
				if (previousRoom) {
					removePlayerFromRoom(socket.id, fastify.log.info.bind(fastify.log));
					socket.leave(previousRoom);
				}
				addPlayerToRoom(roomName, socket.id, fastify.log.info.bind(fastify.log));
				socket.join(roomName);
				fastify.log.info(`Joueur ${socket.id} rejoint la room ${roomName}`);
				socket.emit('roomJoined', { room: roomName });
			});

		socket.on('ping', (data: any) =>
		{
			fastify.log.info(`Ping reçu : ${JSON.stringify(data)}`);
			socket.emit('pong', { message: 'Hello client!' });
		});

		// Handler pour les messages (envoyés avec socket.send)
		socket.on('message', (msg: string) => {
			handleMessage(socket, fastify, msg);
		});

		socket.on('disconnect', () =>
		{
			// Retirer le joueur de sa room
			removePlayerFromRoom(socket.id, fastify.log.info.bind(fastify.log));
		});
	});
}
