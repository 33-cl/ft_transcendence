import { FastifyRequest, FastifyReply } from 'fastify';
import { validateRegisterInput } from '../../services/validation.service.js';
import { createUser, generateJwt, storeActiveToken, getJwtMaxAge } from '../../services/auth.service.js';

/**
 * POST /auth/register
 * Inscription d'un nouvel utilisateur
 * 
 * Flux :
 * 1. Validation des inputs (validateRegisterInput)
 * 2. Création du user dans la DB (createUser)
 * 3. Génération du JWT (generateJwt)
 * 4. Stockage du token actif (storeActiveToken)
 * 5. Envoi du cookie + réponse
 */
export async function registerRoute(request: FastifyRequest, reply: FastifyReply)
{
    //Validation et sanitization des inputs
  const validation = validateRegisterInput(request.body as any);
  if (!validation.success)
    return reply.code(400).send({ error: validation.error });

  const { email, username, password } = validation.data;

  try {
    const user = createUser({ email, username, password });

    const jwtToken = generateJwt(user);
    storeActiveToken(user.id, jwtToken);

    reply.setCookie('jwt', jwtToken, {
      httpOnly: true,    // empeche l acces javscript, personne peut lire le cookie
      secure: true,      // https only
      path: '/',         // dispo sur tout le site
      sameSite: 'strict',// protection, evite de pouvoir s'envoyer le cookie vers un site malveillant
      maxAge: getJwtMaxAge() // 7 jours
    });

    //  Reponse avec les données du user (sans password_hash)
    return reply.code(201).send({ user });

  } catch (e: any) {
    // Gestion des erreurs d'unicité (email ou username déjà pris)
    const msg = typeof e?.message === 'string' ? e.message : '';
    
    if (msg.includes('UNIQUE') && msg.includes('users.email'))
      return reply.code(409).send({ error: 'Email already in use.' });
    if (msg.includes('UNIQUE') && msg.includes('users.username'))
      return reply.code(409).send({ error: 'Username already taken.' });
    
    // Erreur serveur inconnue
    request.log.error(e);
    return reply.code(500).send({ error: 'Server error.' });
  }
}
