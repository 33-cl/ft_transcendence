import { sanitizeEmail, sanitizeUsername, validateLength } from '../security.js';
import { removeHtmlTags } from '../utils/sanitize.js';

export interface ValidationResult
{
  valid: boolean;
  error?: string;
}

export interface ValidatedRegisterInput
{
  email: string;
  username: string;
  password: string;
}

// Validate email format
export function isValidEmail(email: string): boolean
{
  if (typeof email !== 'string')
    return false;
  
  if (email.includes(' '))
    return false;
  
  const atIndex = email.indexOf('@');
  if (atIndex <= 0)
    return false;
  if (email.lastIndexOf('@') !== atIndex)
    return false;
  
  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);
  
  if (localPart.length === 0)
    return false;
  if (domainPart.length === 0)
    return false;

  const dotIndex = domainPart.lastIndexOf('.');
  if (dotIndex <= 0)
    return false;
  if (dotIndex === domainPart.length - 1)
    return false;
  
  return true;
}

// Validate username (3-10 chars, alphanumeric and underscore only)
export function isValidUsername(username: string): boolean
{
  if (typeof username !== 'string')
    return false;
  
  if (username.length < 3 || username.length > 10)
    return false;

  for (const char of username)
  {
    const isLetter = (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    const isDigit = char >= '0' && char <= '9';
    const isUnderscore = char === '_';
    
    if (!isLetter && !isDigit && !isUnderscore)
      return false;
  }
  
  return true;
}

// Validate password (minimum 8 characters)
export function isValidPassword(password: string): boolean
{
  return typeof password === 'string' && password.length >= 8;
}

// Validate 2FA code (exactly 6 digits)
export function isValid2FACode(code: string): boolean
{
  if (typeof code !== 'string')
    return false;
  
  if (code.length !== 6)
    return false;
  
  for (const char of code)
  {
    if (char < '0' || char > '9')
      return false;
  }
  
  return true;
}

// Validate and sanitize registration data
export function validateRegisterInput(data: {
  email?: string;
  username?: string;
  password?: string;
}): { success: true; data: ValidatedRegisterInput } | { success: false; error: string }
{
  const { email, username, password } = data;

  if (!email || !username || !password)
    return { success: false, error: 'Missing required fields (email, username, password)' };

  if (!validateLength(email, 1, 255))
    return { success: false, error: 'Email length invalid (max 255 characters)' };

  if (!validateLength(username, 1, 50))
    return { success: false, error: 'Username length invalid (max 50 characters)' };

  if (!validateLength(password, 1, 255))
    return { success: false, error: 'Password length invalid (max 255 characters)' };

  const sanitizedEmail = sanitizeEmail(email);
  const sanitizedUsername = sanitizeUsername(username);

  if (!sanitizedEmail || !isValidEmail(sanitizedEmail))
    return { success: false, error: 'Invalid email format' };

  if (!sanitizedUsername || !isValidUsername(sanitizedUsername))
    return { success: false, error: 'Invalid username (3-10 characters, alphanumeric and underscore only)' };

  if (!isValidPassword(password))
    return { success: false, error: 'Password too short (minimum 8 characters)' };

  return{
    success: true,
    data: {
      email: sanitizedEmail,
      username: sanitizedUsername,
      password: password
    }
  };
}

// Validate login data
export function validateLoginInput(data: {
  login?: string;
  password?: string;
}): { success: true; data: { login: string; password: string } } | { success: false; error: string }
{
  const { login, password } = data;

  if (!login || !password)
    return { success: false, error: 'Missing credentials (login and password required)' };

  if (!validateLength(login, 1, 255))
    return { success: false, error: 'Login length invalid' };
  
  if (!validateLength(password, 1, 255))
    return { success: false, error: 'Password length invalid' };

  const sanitizedLogin = removeHtmlTags(login).toLowerCase();

  return {
    success: true,
    data: {
      login: sanitizedLogin,
      password: password
    }
  };
}
