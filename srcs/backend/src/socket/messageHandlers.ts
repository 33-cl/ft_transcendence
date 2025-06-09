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
		return;
	}

	const playerRoom = getPlayerRoom(socket.id);
	if (!playerRoom)
	{
		return;
	}
	if (message.type === 'move')
	{
		if (typeof message.data !== 'object' || typeof message.data.y !== 'number')
		{
			return;
		}
		socket.to(playerRoom).emit('message', msg);
	}
	else if (message.type === 'score')
	{
		if (typeof message.data !== 'object' || typeof message.data.left !== 'number' || typeof message.data.right !== 'number')
		{
			return;
		}
		socket.to(playerRoom).emit('message', msg);
	}
}
