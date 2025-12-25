export function isValidEmailSimple(email: string): boolean
{
    if (!email || typeof email !== 'string')
        return false;
    if (email.includes(' '))
        return false;
    
    const at = email.indexOf('@');
    if (at <= 0 || at !== email.lastIndexOf('@'))
        return false;
    
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    if (dot <= 0 || dot === domain.length - 1)
        return false;
    
    return true;
}

export function isValidUsername(username: string): boolean
{
    if (!username || typeof username !== 'string')
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

export function isValidPassword(password: string): boolean
{
    return password.length >= 8;
}

export function passwordsMatch(password: string, confirm: string): boolean
{
    return password === confirm;
}

export interface RegisterInputs
{
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

export interface ValidationResult
{
    valid: boolean;
    error?: string;
}

export function validateRegisterInputs(inputs: RegisterInputs): ValidationResult
{
    const { username, email, password, confirmPassword } = inputs;

    if (!isValidUsername(username))
    {
        return {
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
