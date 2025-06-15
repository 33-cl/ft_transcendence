"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = pingRoutes;
async function pingRoutes(fastify) {
    fastify.get('/ping', async (request, reply) => {
        return { pong: true };
    });
}
