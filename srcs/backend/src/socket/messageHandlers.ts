// src/socket/messageHandlers.ts
import { Socket } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { getPlayerRoom } from './roomManager.js';

export function handleMessage(socket: Socket, fastify: FastifyInstance, msg: string)
{
	let message: any;
	try {
	message = JSON.parse(msg);
	} catch (e) {
		fastify.log.warn(`Message non JSON reçu: ${msg}`);
		return;
	}

	// Trouver la room du joueur pour pouvoir ensuite utilisr playerRoom pour l'envoi de messages
	const playerRoom = getPlayerRoom(socket.id);
	if (!playerRoom)
	{
		fastify.log.warn(`Aucune room trouvée pour le joueur ${socket.id}`);
		return;
	}
	// Validation basique
	if (message.type === 'move')
	{
		if (typeof message.data !== 'object' || typeof message.data.y !== 'number')
		{
			fastify.log.warn(`Move invalide: ${JSON.stringify(message)}`);
			return;
		}
		fastify.log.info(`Move reçu: y=${message.data.y}`);
		socket.to(playerRoom).emit('message', msg);
	}
	else if (message.type === 'score')
	{
		if (typeof message.data !== 'object' || typeof message.data.left !== 'number' || typeof message.data.right !== 'number')
		{
			fastify.log.warn(`Score invalide: ${JSON.stringify(message)}`);
			return;
		}
		fastify.log.info(`Score reçu: left=${message.data.left}, right=${message.data.right}`);
		socket.to(playerRoom).emit('message', msg);
	}
	else
	{
		fastify.log.warn(`Type de message inconnu: ${message.type}`);
	}
}
