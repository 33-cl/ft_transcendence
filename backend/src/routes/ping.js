// src/routes/ping.js

async function pingRoute(fastify, options) {
    fastify.get('/ping', async (request, reply) => {
      return { pong: true };
    });
  }
  
module.exports = pingRoute;