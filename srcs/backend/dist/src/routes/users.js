export default async function usersRoutes(fastify) {
    fastify.get('/users', async (request, reply) => {
        return { users: [] };
    });
}
