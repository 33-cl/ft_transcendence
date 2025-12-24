import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getJwtFromRequest } from '../../helpers/http/cookie.helper.js';
import { handleLogout } from '../../helpers/auth/logout.helper.js';

/*
POST /auth/logout
User logout: revoke token, notify friends, clear cookie
*/
export async function logoutRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const jwtToken = getJwtFromRequest(request);
  
  if (jwtToken)
    handleLogout(jwtToken, fastify);
  
  reply.setCookie('jwt', '', {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: 0
  });
  
  return reply.send({ ok: true });
}
