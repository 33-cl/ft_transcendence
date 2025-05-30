// src/routes/users.js

async function usersRoute(fastify, options) {
    fastify.get('/users', async (request, reply) => {
      const users = [
        { id: 1, name: 'Rayane', score: 42 },
        { id: 2, name: 'Iban', score: 58 },
        { id: 3, name: 'Quentin', score: 36 },
      ];
  
      return { users };
    });
  }
  
  module.exports = usersRoute;
  