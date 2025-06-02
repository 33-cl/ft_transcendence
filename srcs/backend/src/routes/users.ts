import { FastifyInstance } from 'fastify';

export default async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/users', async (request, reply) => {
    return { users: [] };
  });
}
