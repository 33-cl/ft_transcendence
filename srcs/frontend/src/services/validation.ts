// Validation functions - Centralized validation logic
// These functions should match exactly with backend validation


export function isValidEmail(email: string): boolean
{
  if (typeof email !== 'string')
    return false;
  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@'))
    return false;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (local.length === 0 || domain.length < 3)
    return false;
  if (domain.indexOf('.') <= 0 || domain.endsWith('.'))
    return false;
  if (email.includes(' '))
    return false;
  return true;
}

// 3-10 chars, letters/numbers/underscore only 
export function isValidUsername(username: string): boolean
{
  if (typeof username !== 'string' || username.length < 3 || username.length > 10)
    return false;
  for (let i = 0; i < username.length; i++)
  {
    const c = username.charAt(i);
    if (!(
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c === '_'
    ))
      return false;
  }
  return true;
}

// Minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
export function isValidPassword(password: string): boolean
{
  if (typeof password !== 'string' || password.length < 8)
    return false;
  let hasUpper = false, hasLower = false, hasDigit = false, hasSpecial = false;
  for (let i = 0; i < password.length; i++)
  {
    const c = password.charAt(i);
    if (c >= 'A' && c <= 'Z') hasUpper = true;
    else if (c >= 'a' && c <= 'z') hasLower = true;
    else if (c >= '0' && c <= '9') hasDigit = true;
    else hasSpecial = true;
  }
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

// Combined validation function for forms
export function validateInput(username?: string, email?: string, password?: string):
{
  valid: boolean;
  error?: string;
}
{
  // Username validation
  if (username !== undefined && username !== '' && !isValidUsername(username))
    return {
      valid: false,
      error: 'Username must be 3-10 characters (letters, numbers, underscore only)'
    };

  // Email validation
  if (email !== undefined && email !== '' && !isValidEmail(email))
    return {
      valid: false,
      error: 'Invalid email format'
    };

  // Password validation
  if (password !== undefined && password !== '' && !isValidPassword(password))
    return {
      valid: false,
      error: 'Password must be at least 8 characters, with uppercase, lowercase, digit, and special character'
    };

  return { valid: true };
}
