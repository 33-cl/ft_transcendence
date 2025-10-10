# 🔒 Backend Routes Security Checklist

## État de sécurisation des routes

### ✅ Routes sécurisées

#### 1. **auth.ts** - Routes d'authentification
- ✅ `/auth/register` - Validation + sanitization (username, email, password)
- ✅ `/auth/login` - Validation + sanitization
- ✅ Utilise `scrypt` pour hasher les mots de passe
- ✅ JWT avec expiration
- ✅ Cookies HttpOnly + Secure + SameSite

**Protections appliquées :**
- `validateLength()` - Anti-DoS
- `sanitizeUsername()` - Anti-XSS
- `sanitizeEmail()` - Anti-XSS
- Prepared statements - Anti-SQL injection

---

#### 2. **users.ts** - Routes des utilisateurs
- ✅ `/users/search` - Validation + sanitization de la query
- ✅ Authentification JWT required
- ✅ Limite de 10 résultats (anti-DoS)

**Protections appliquées :**
- `validateLength(query, 1, 100)` - Limite longueur query
- Sanitization des caractères HTML `<>`
- Prepared statements pour toutes les queries SQL

---

#### 3. **rooms.ts** - Routes des rooms de jeu
- ✅ `/rooms/friend/:username` - Validation + sanitization du username
- ✅ Authentification JWT required
- ✅ Vérification d'amitié avant spectate

**Protections appliquées :**
- `validateLength(username, 1, 50)`
- `sanitizeUsername()` avant query SQL
- Vérification JWT pour chaque endpoint sensible

---

### ⚠️ Routes partiellement sécurisées

#### 4. **profile.ts**
**État :** Fichier vide (pas encore implémenté)
**Action :** Rien à faire pour le moment

---

#### 5. **matches.ts**
**État :** À vérifier
**Points à sécuriser :**
- Validation des IDs de match
- Authentification sur les endpoints sensibles
- Limite de résultats (pagination)

---

#### 6. **tournaments.ts**
**État :** À vérifier
**Points à sécuriser :**
- Validation des noms de tournois
- Authentification sur endpoints de création/modification
- Rate limiting sur création de tournois

---

## 🛡️ Protections globales appliquées

### 1. **Prepared Statements (SQL Injection)**
```typescript
// ✅ PARTOUT - déjà présent avant nos modifications
db.prepare('SELECT * FROM users WHERE username = ?').get(username);
```

### 2. **Validation de longueur (DoS)**
```typescript
// ✅ Appliqué sur :
- Usernames (1-50 caractères)
- Emails (1-255 caractères)
- Passwords (8-255 caractères)
- Search queries (1-100 caractères)
```

### 3. **Sanitization (XSS)**
```typescript
// ✅ Appliqué sur :
- Usernames → garde seulement a-zA-Z0-9_
- Emails → supprime HTML, trim, lowercase
- Search queries → supprime <> 
```

### 4. **Authentification JWT**
```typescript
// ✅ Required sur routes sensibles :
- /users/search
- /users/:id/friend (POST, DELETE)
- /users/friend-requests/*
- /rooms/friend/:username
```

---

## 📊 Récapitulatif par type d'attaque

| Type d'attaque | Protection | État |
|----------------|------------|------|
| **SQL Injection** | Prepared statements | ✅ Complet |
| **XSS Backend** | Sanitization inputs | ✅ Routes principales |
| **DoS** | Validation longueur | ✅ Routes principales |
| **Session Hijacking** | JWT + HttpOnly cookies | ✅ Complet |
| **Brute Force** | Rate limiting | ⚠️ Manquant |
| **CSRF** | SameSite=strict | ✅ Complet |

---

## 🔧 Fonctions de sécurité disponibles

### Fichier : `/srcs/backend/src/security.ts`

```typescript
// Validation
validateLength(input: string, min: number, max: number): boolean

// Sanitization
sanitizeUsername(username: string): string
sanitizeEmail(email: string): string
sanitizeFilePath(filePath: string): string

// Rate limiting
checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean

// Validation JWT
isValidJwtFormat(token: string): boolean
```

---

## 🚀 Prochaines étapes (optionnel)

### 1. Rate Limiting (Anti brute-force)
```typescript
// À ajouter dans auth.ts
import { checkRateLimit } from '../security.js';

// Dans /auth/login
const loginKey = `login:${request.ip}`;
if (!checkRateLimit(loginKey, 5, 60000)) {
  return reply.status(429).send({ error: 'Too many login attempts' });
}
```

### 2. Validation stricte des IDs
```typescript
// À ajouter partout où on reçoit des IDs
function validateId(id: any): number | null {
  const parsed = parseInt(id);
  if (isNaN(parsed) || parsed < 1) return null;
  return parsed;
}
```

### 3. Logs de sécurité
```typescript
// Logger les tentatives suspectes
fastify.log.warn(`Suspicious activity: ${event}`, { ip, userId, timestamp });
```

---

## ✅ Tests de sécurité

### Test SQL Injection
```bash
# Essayer ces queries :
curl -X GET "https://localhost:8080/users/search?q=admin' OR '1'='1"
# ✅ Résultat attendu : Aucun résultat malveillant
```

### Test XSS
```bash
# Essayer de créer un compte avec :
username: "<script>alert('XSS')</script>"
# ✅ Résultat attendu : Username devient "scriptalertXSSscript"
```

### Test DoS
```bash
# Essayer d'envoyer un username très long :
username: "a".repeat(10000)
# ✅ Résultat attendu : Erreur 400 "Input length validation failed"
```

---

**Dernière mise à jour :** $(date)
**Routes sécurisées :** 3/6 (50%)
**Protection globale :** 🟡 Bonne (manque rate limiting)
