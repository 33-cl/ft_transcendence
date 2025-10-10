# 🛡️ Security Implementation Guide

## Overview
This document describes the security measures implemented to protect against XSS (Cross-Site Scripting) and SQL Injection attacks in the ft_transcendence project.

---

## 🔒 Protection Against SQL Injection

### ✅ Already Secured
We use **better-sqlite3** with **prepared statements**, which automatically protects against SQL injection by separating SQL code from data.

### Example of Safe Queries:
```typescript
// ✅ SAFE - Uses prepared statements with ? placeholders
db.prepare('SELECT * FROM users WHERE username = ?').get(username);
db.prepare('INSERT INTO users (email, username) VALUES (?, ?)').run(email, username);

// ❌ NEVER DO THIS - Vulnerable to SQL injection
db.exec(`SELECT * FROM users WHERE username = '${username}'`);
```

### Key Points:
- ✅ Always use `.prepare()` with `?` placeholders
- ✅ Never concatenate user input directly into SQL strings
- ✅ Use `.get()`, `.all()`, `.run()` with parameters

---

## 🛡️ Protection Against XSS (Cross-Site Scripting)

### What is XSS?
XSS occurs when malicious code (usually JavaScript) is injected into a webpage through user input and executed in other users' browsers.

### Example of XSS Attack:
```typescript
// If username = "<script>alert('XSS')</script>"
// ❌ VULNERABLE:
element.innerHTML = user.username; // Script will execute!

// ✅ SAFE:
import { escapeHtml } from './utils/security.js';
element.innerHTML = escapeHtml(user.username); // Script becomes harmless text
```

---

## 🔧 Frontend Security Implementation

### 1. Security Utilities (`/srcs/frontend/src/utils/security.ts`)

We created a comprehensive security utility with the following functions:

#### `escapeHtml(unsafe: string): string`
Converts dangerous HTML characters to safe entities:
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`
- `"` → `&quot;`
- `'` → `&#039;`

**Usage:**
```typescript
import { escapeHtml } from '../utils/security.js';

const safeUsername = escapeHtml(user.username);
element.innerHTML = `<span>${safeUsername}</span>`;
```

#### `sanitizeUrl(url: string): string`
Prevents dangerous URL protocols:
- ✅ Allows: `http:`, `https:`, relative URLs
- ❌ Blocks: `javascript:`, `data:`, `vbscript:`, `file:`

**Usage:**
```typescript
import { sanitizeUrl } from '../utils/security.js';

const safeUrl = sanitizeUrl(user.avatar_url);
img.src = safeUrl;
```

#### `setTextContent(element: HTMLElement, text: string): void`
The safest way to set text content (never executes scripts):

**Usage:**
```typescript
import { setTextContent } from '../utils/security.js';

setTextContent(nameElement, user.username); // Always safe
```

#### `sanitizeUsername(username: string): string`
Removes HTML tags and keeps only alphanumeric + underscore:

**Usage:**
```typescript
import { sanitizeUsername } from '../utils/security.js';

const clean = sanitizeUsername(input.value);
```

### 2. Secured Components

#### `addFriends.html.ts` - Fixed XSS Vulnerability
**Before (Vulnerable):**
```typescript
searchResults.innerHTML = users.map(user => `
    <span>${user.username}</span>
`).join('');
```

**After (Secured):**
```typescript
import { escapeHtml, sanitizeUrl } from '../utils/security.js';

searchResults.innerHTML = users.map(user => {
    const safeUsername = escapeHtml(user.username);
    const safeAvatarUrl = sanitizeUrl(user.avatar_url);
    return `<span>${safeUsername}</span>`;
}).join('');
```

---

## 🔧 Backend Security Implementation

### 1. Security Utilities (`/srcs/backend/src/security.ts`)

#### `sanitizeUsername(username: string): string`
- Removes HTML tags
- Keeps only alphanumeric + underscore
- Throws error if input is not a string

#### `sanitizeEmail(email: string): string`
- Removes HTML tags
- Trims and lowercases
- Validates format

#### `validateLength(input: string, min: number, max: number): boolean`
- Prevents DoS attacks by limiting input length
- Returns false if input is too short or too long

#### `checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean`
- Prevents brute-force attacks
- Tracks requests per key (e.g., IP address, user ID)
- Returns false if rate limit exceeded

### 2. Secured Routes

#### `auth.ts` - Registration Route
```typescript
import { sanitizeUsername, sanitizeEmail, validateLength } from '../security.js';

fastify.post('/auth/register', async (request, reply) => {
    const { email, username, password } = request.body;

    // 1. Validate length (DoS protection)
    if (!validateLength(email, 1, 255) || 
        !validateLength(username, 1, 50) || 
        !validateLength(password, 1, 255)) {
        return reply.code(400).send({ error: 'Input too long' });
    }

    // 2. Sanitize inputs (XSS protection)
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedUsername = sanitizeUsername(username);

    // 3. Validate format
    if (!isValidEmail(sanitizedEmail)) {
        return reply.code(400).send({ error: 'Invalid email' });
    }

    // 4. Use prepared statements (SQL injection protection)
    db.prepare('INSERT INTO users (email, username) VALUES (?, ?)').run(
        sanitizedEmail, 
        sanitizedUsername
    );
});
```

---

## 📋 Security Checklist

### ✅ Frontend
- [x] Escape HTML when using `innerHTML`
- [x] Sanitize URLs before setting `src`, `href`
- [x] Use `textContent` instead of `innerHTML` when possible
- [x] Validate user input client-side
- [x] Import security utilities in all components handling user data

### ✅ Backend
- [x] Use prepared statements for all SQL queries
- [x] Sanitize all user inputs (username, email, etc.)
- [x] Validate input lengths to prevent DoS
- [x] Hash passwords with strong algorithms (scrypt)
- [x] Use secure cookies (httpOnly, secure, sameSite)
- [x] Implement rate limiting on sensitive endpoints

### 🔐 Password Security
- [x] Minimum 8 characters
- [x] Hashed with `scrypt` (salt + hash)
- [x] Timing-safe comparison (`timingSafeEqual`)

### 🖼️ File Upload Security
- [x] Validate file types with `file-type` library
- [x] Process images with `sharp` (strips metadata, re-encodes)
- [x] Generate unique filenames with UUID
- [x] Limit file sizes

### 🔑 Session Security
- [x] JWT tokens with expiration
- [x] HttpOnly cookies (prevents JavaScript access)
- [x] Secure flag (HTTPS only)
- [x] SameSite=strict (prevents CSRF)
- [x] Token stored in database for validation
- [x] Single session per user enforcement

---

## 🚨 Common Vulnerabilities to Avoid

### ❌ DON'T:
```typescript
// SQL Injection
db.exec(`SELECT * FROM users WHERE id = ${userId}`);

// XSS
element.innerHTML = userInput;
img.src = userProvidedUrl;

// Path Traversal
fs.readFile(`./uploads/${req.body.filename}`);

// Weak Passwords
if (password.length >= 6) // Too weak!

// Exposed Secrets
const JWT_SECRET = 'hardcoded_secret';
```

### ✅ DO:
```typescript
// SQL Injection Protection
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// XSS Protection
element.innerHTML = escapeHtml(userInput);
img.src = sanitizeUrl(userProvidedUrl);

// Path Traversal Protection
const safePath = sanitizeFilePath(req.body.filename);
fs.readFile(path.join('./uploads', safePath));

// Strong Passwords
if (password.length >= 8 && hasComplexity(password))

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_for_dev';
```

---

## 🧪 Testing Security

### Manual Testing:

#### Test XSS:
1. Try registering with username: `<script>alert('XSS')</script>`
2. Check if script executes or appears as harmless text
3. ✅ Expected: Text should be escaped and not execute

#### Test SQL Injection:
1. Try logging in with username: `admin' OR '1'='1`
2. Check if you can bypass authentication
3. ✅ Expected: Login should fail (prepared statements prevent this)

#### Test Path Traversal:
1. Try uploading a file with name: `../../etc/passwd`
2. Check if file is saved outside intended directory
3. ✅ Expected: Filename should be sanitized

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## 🎓 Key Takeaways

1. **Never trust user input** - Always validate and sanitize
2. **Use prepared statements** - They're your best defense against SQL injection
3. **Escape HTML** - Before inserting user content into the DOM
4. **Validate on both sides** - Client-side for UX, server-side for security
5. **Keep dependencies updated** - Security patches are released regularly
6. **Use security headers** - Content-Security-Policy, X-Frame-Options, etc.

---

**Last Updated:** $(date)
**Maintainer:** ft_transcendence security team
