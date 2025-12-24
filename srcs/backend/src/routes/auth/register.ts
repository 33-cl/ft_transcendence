import { FastifyRequest, FastifyReply } from 'fastify';
import { validateRegisterInput } from '../../services/validation.service.js';
import { createUser, generateJwt, storeActiveToken, getJwtMaxAge } from '../../services/auth.service.js';
import { checkRateLimit, RATE_LIMITS } from '../../security.js';

// POST /auth/register
// User registration: validate input, create user, generate JWT and send cookie
export async function registerRoute(request: FastifyRequest, reply: FastifyReply)
{
  const clientIp = request.ip;
  if (!checkRateLimit(`register_${clientIp}`, RATE_LIMITS.REGISTER.max, RATE_LIMITS.REGISTER.window))
    return reply.code(429).send({ error: 'Too many registration attempts. Please try again later.' });

  // Validate and sanitize input
  const validation = validateRegisterInput(request.body as any);
  if (!validation.success)
    return reply.code(400).send({ error: validation.error });

  const { email, username, password } = validation.data;

  try {
    const user = createUser({ email, username, password });

    const jwtToken = generateJwt(user);
    storeActiveToken(user.id, jwtToken);

    reply.setCookie('jwt', jwtToken, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'strict',
      maxAge: getJwtMaxAge()
    });

    return reply.code(201).send({ user });

  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : '';
    
    if (msg.includes('UNIQUE') && msg.includes('users.email'))
      return reply.code(409).send({ error: 'Email already in use.' });
    if (msg.includes('UNIQUE') && msg.includes('users.username'))
      return reply.code(409).send({ error: 'Username already taken.' });
    
    // Unknown server error
    request.log.error(e);
    return reply.code(500).send({ error: 'Server error.' });
  }
}
