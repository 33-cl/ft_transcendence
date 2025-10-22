/**
 * Service de validation
 * Contient toutes les validations d'inputs (email, username, password, etc.)
 */

import { sanitizeEmail, sanitizeUsername, validateLength } from '../security.js';

// ============================================
// Types pour les erreurs de validation
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidatedRegisterInput {
  email: string;
  username: string;
  password: string;
}

// ============================================
// Validateurs de format
// ============================================

/**
 * Vérifie si un email est valide
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Vérifie si un username est valide (3-10 caractères alphanumériques + underscore)
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,10}$/.test(username);
}

/**
 * Vérifie si un password est valide (minimum 8 caractères)
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8;
}

// ============================================
// Validation complète pour l'inscription
// ============================================

/**
 * Valide et sanitize les données d'inscription
 * @param data - Les données brutes de l'inscription
 * @returns Les données validées et sanitizées, ou une erreur
 */
export function validateRegisterInput(data: {
  email?: string;
  username?: string;
  password?: string;
}): { success: true; data: ValidatedRegisterInput } | { success: false; error: string } {
  const { email, username, password } = data;

  if (!email || !username || !password)
    return { success: false, error: 'Missing required fields (email, username, password)' };

  // protection input trop long
  if (!validateLength(email, 1, 255))
    return { success: false, error: 'Email length invalid (max 255 characters)' };

  if (!validateLength(username, 1, 50))
    return { success: false, error: 'Username length invalid (max 50 characters)' };

  if (!validateLength(password, 1, 255))
    return { success: false, error: 'Password length invalid (max 255 characters)' };


  // Sanitize (protection XSS) (del balise html, maj)
  const sanitizedEmail = sanitizeEmail(email);
  const sanitizedUsername = sanitizeUsername(username);

  // Valider les formats
  if (!sanitizedEmail || !isValidEmail(sanitizedEmail))
    return { success: false, error: 'Invalid email format' };

  if (!sanitizedUsername || !isValidUsername(sanitizedUsername))
    return { success: false, error: 'Invalid username (3-10 characters, alphanumeric and underscore only)' };

  if (!isValidPassword(password))
    return { success: false, error: 'Password too short (minimum 8 characters)' };

  // Retourner les données validées et sanitizées
  return{
    success: true,
    data: {
      email: sanitizedEmail,
      username: sanitizedUsername,
      password: password // Le password n'est pas sanitizé (on le hash directement)
    }
  };
}

/**
 * Valide les données de login
 */
export function validateLoginInput(data: {
  login?: string;
  password?: string;
}): { success: true; data: { login: string; password: string } } | { success: false; error: string } {
  const { login, password } = data;

  if (!login || !password) {
    return { success: false, error: 'Missing credentials (login and password required)' };
  }

  if (!validateLength(login, 1, 255)) {
    return { success: false, error: 'Login length invalid' };
  }
  if (!validateLength(password, 1, 255)) {
    return { success: false, error: 'Password length invalid' };
  }

  // Sanitize le login
  const sanitizedLogin = login.toLowerCase().replace(/<[^>]*>/g, '');

  return {
    success: true,
    data: {
      login: sanitizedLogin,
      password: password
    }
  };
}
