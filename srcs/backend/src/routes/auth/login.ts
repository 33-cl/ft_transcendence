import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { validateAndGetUser, checkPassword, checkAlreadyConnected, authenticateUser, createSafeUser } from '../../helpers/auth.helper.js';

/**
 * POST /auth/login
 * Connexion d'un utilisateur
 * 
 * Flux :
 * 1. Validation, rate limiting et récupération de l'utilisateur (validateAndGetUser)
 * 2. Vérification du password (checkPassword)
 * 3. Vérification si déjà connecté (checkAlreadyConnected)
 * 4. Authentification - JWT + cookie + active_tokens (authenticateUser)
 * 5. Envoi de la réponse avec données sécurisées (createSafeUser)
 */
export async function loginRoute(request: FastifyRequest, reply: FastifyReply, fastify: FastifyInstance)
{
  const body = (request.body as any) || {};
  const login: string = (body.login ?? body.username ?? body.email ?? '').toString().trim();
  const password: string = (body.password ?? '').toString();

  // Validation, rate limiting et recup de l'utilisateur
  const user = validateAndGetUser(login, password, request.ip, reply);
  if (!user)
    return;

  if (!checkPassword(password, user, reply))
    return;

  if (!checkAlreadyConnected(user.id, user.username, reply, fastify))
    return;

  // Authentification (genere JWT, stocke token, envoie cookie)
  authenticateUser(user, reply);

  // sans pswd hash
  const safeUser = createSafeUser(user);

  return reply.send({ user: safeUser });
}
