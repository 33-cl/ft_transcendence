export default async function pingRoutes(fastify) {
    fastify.get('/ping', async (request, reply) => {
        return { pong: true };
    });
}
