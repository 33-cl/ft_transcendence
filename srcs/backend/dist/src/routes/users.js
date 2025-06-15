"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = usersRoutes;
async function usersRoutes(fastify) {
    fastify.get('/users', async (request, reply) => {
        return { users: [] };
    });
}
