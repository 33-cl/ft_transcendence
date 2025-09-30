// Validation functions - Centralized validation logic
// These functions should match exactly with backend validation
export function isValidEmail(email) {
    // Validation simple et robuste - identique au backend
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function isValidUsername(username) {
    // 3-20 chars, lettres/chiffres/underscore uniquement - identique au backend
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
export function isValidPassword(password) {
    // Longueur minimale 8 - identique au backend
    return typeof password === 'string' && password.length >= 8;
}
// Fonction de validation combinée pour les formulaires
export function validateInput(username, email, password) {
    // Validation username
    if (username !== undefined && username !== '' && !isValidUsername(username)) {
        return { valid: false, error: 'Username must be 3-20 characters (letters, numbers, underscore only)' };
    }
    // Validation email
    if (email !== undefined && email !== '' && !isValidEmail(email)) {
        return { valid: false, error: 'Invalid email format' };
    }
    // Validation password
    if (password !== undefined && password !== '' && !isValidPassword(password)) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }
    return { valid: true };
}
//# sourceMappingURL=validation.js.map