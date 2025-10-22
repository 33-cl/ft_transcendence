/**
 * Client-side validation utilities
 * Validation des inputs côté frontend (avant envoi au backend)
 */

/**
 * Valide un email (format simple)
 */
export function isValidEmailSimple(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    if (email.includes(' ')) return false;
    const at = email.indexOf('@');
    if (at <= 0 || at !== email.lastIndexOf('@')) return false;
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot <= 0 || dot === domain.length - 1) return false;
    return true;
}

/**
 * Valide un username (3-10 caractères alphanumériques + underscore)
 */
export function isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_]{3,10}$/.test(username);
}

/**
 * Valide un mot de passe (min 8 caractères)
 */
export function isValidPassword(password: string): boolean {
    return password.length >= 8;
}

/**
 * Valide que deux mots de passe correspondent
 */
export function passwordsMatch(password: string, confirm: string): boolean {
    return password === confirm;
}

/**
 * Interface pour les données de registration
 */
export interface RegisterInputs {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

/**
 * Interface pour le résultat de validation
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Valide tous les inputs de registration
 * Retourne { valid: true } si tout est OK, sinon { valid: false, error: "message" }
 */
export function validateRegisterInputs(inputs: RegisterInputs): ValidationResult {
    const { username, email, password, confirmPassword } = inputs;

    if (!isValidUsername(username))
    {
        return{
            valid: false,
            error: 'Invalid username (3-10 characters, alphanumeric and underscore).'
        };
    }

    if (!isValidEmailSimple(email))
    {
        return {
            valid: false,
            error: 'Invalid email.'
        };
    }

    if (!isValidPassword(password))
    {
        return {
            valid: false,
            error: 'Password too short (min 8).'
        };
    }

    if (!passwordsMatch(password, confirmPassword))
    {
        return {
            valid: false,
            error: 'Passwords do not match.'
        };
    }

    return { valid: true };
}
