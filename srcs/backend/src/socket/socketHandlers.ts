/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   socketHandlers.ts                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: qordoux <qordoux@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/05/31 16:43:18 by qordoux           #+#    #+#             */
/*   Updated: 2025/06/04 20:02:45 by qordoux          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

// src/socket/socketHandlers.ts

import { Server, Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getPlayerRoom, findOrCreateRoom, removePlayerFromRoom } from './roomManager.js';
import { handleMessage } from './messageHandlers.js';


export default function registerSocketHandlers(io: Server, fastify: FastifyInstance)
{
	io.on('connection', (socket: Socket) =>
	{
		fastify.log.info(`Client connecté : ${socket.id}`);

		// Handler pour rejoindre une room dynamiquement
		socket.on('joinRoom', (data: any) =>
		{
			// Avant de rejoindre une nouvelle room, retirer le joueur de l'ancienne
			const previousRoom = getPlayerRoom(socket.id);
    		if (previousRoom)
			{
				removePlayerFromRoom(socket.id, fastify.log.info.bind(fastify.log));
				socket.leave(previousRoom);
    		}
			// 4 ou 2 players dans la room
			const maxPlayers = data && data.maxPlayers ? data.maxPlayers : 2;

			// itere sur les rooms existantes et cherche une room avec la capacitee demandee (2 ou 4)
			// le dernier parametre permet d'ecrire dans les logs avec le bon this
			const assignedRoom = findOrCreateRoom(maxPlayers, socket.id, fastify.log.info.bind(fastify.log));
			socket.join(assignedRoom);
			fastify.log.info(`Joueur ${socket.id} rejoint la room ${assignedRoom} (max ${maxPlayers})`);
			
			// On informe le client de la room rejointe
			socket.emit('roomJoined', { room: assignedRoom, maxPlayers });
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
