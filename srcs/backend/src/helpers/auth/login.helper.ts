import { FastifyReply, FastifyInstance } from 'fastify';
import { isUserAlreadyConnected } from '../../socket/socketAuth.js';
import { validateLength, checkRateLimit } from '../../security.js';
import { isValidEmail } from '../../services/validation.service.js';
import { removeHtmlTags } from '../../utils/sanitize.js';
import { 
  generateJwt, 
  storeActiveToken, 
  getJwtMaxAge,
  getUserByEmail,
  getUserByUsername,
  verifyPassword
} from '../../services/auth.service.js';

interface DbUser {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
  two_factor_enabled: number;
}

interface SafeUser {
  id: number;
  email: string;
  username: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
  twoFactorEnabled: boolean;
}

// verifyPassword is imported from services/auth.service.js to avoid duplication

export function checkPassword(password: string, user: DbUser, reply: FastifyReply): boolean
{
  if (!verifyPassword(password, user.password_hash))
  {
    reply.code(401).send({ error: 'Invalid credentials.' });
    return false;
  }
  return true;
}

export function checkAlreadyConnected(
  userId: number, 
  username: string, 
  reply: FastifyReply, 
  fastify: FastifyInstance
): boolean
{
  if (isUserAlreadyConnected(userId))
  {
    fastify.log.warn(`User ${username} (${userId}) attempted to login but is already connected`);
    reply.code(403).send({ 
      error: 'This account is already connected elsewhere.',
      code: 'USER_ALREADY_CONNECTED'
    });
    return false;
  }
  return true;
}

export function authenticateUser(user: DbUser, reply: FastifyReply): string
{
  const jwtToken = generateJwt(user);
  storeActiveToken(user.id, jwtToken);
  const maxAge = getJwtMaxAge();
  reply.setCookie('jwt', jwtToken, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'strict',
    maxAge: maxAge
  });
  return jwtToken;
}

export function createSafeUser(user: DbUser): SafeUser
{
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatar_url: user.avatar_url ?? null,
    wins: user.wins,
    losses: user.losses,
    created_at: user.created_at,
    updated_at: user.updated_at,
    twoFactorEnabled: user.two_factor_enabled === 1
  };
}

export function validateAndGetUser(login: string, password: string, clientIp: string, reply: FastifyReply): DbUser | null
{
  if (!checkRateLimit(`login:${clientIp}`, 10, 60 * 1000))
  {
    reply.code(429).send({ error: 'Too many login attempts. Please try again later.' });
    return null;
  }

  if (!validateLength(login, 1, 255) || !validateLength(password, 1, 255))
  {
    reply.code(400).send({ error: 'Input length validation failed.' });
    return null;
  }

  if (!login || !password)
  {
    reply.code(400).send({ error: 'Missing credentials.' });
    return null;
  }

  const user = getUserByLoginCredential(login);

  if (!user)
  {
    reply.code(401).send({ error: 'Invalid credentials.' });
    return null;
  }

  return user;
}

function getUserByLoginCredential(login: string): DbUser | undefined
{
  const cleanLogin = removeHtmlTags(login);
  const looksLikeEmail = isValidEmail(cleanLogin);
  if (looksLikeEmail)
  {
    const normalizedEmail = cleanLogin.toLowerCase();
    return getUserByEmail(normalizedEmail) as DbUser | undefined;
  }
  else
    return getUserByUsername(cleanLogin) as DbUser | undefined;
}
