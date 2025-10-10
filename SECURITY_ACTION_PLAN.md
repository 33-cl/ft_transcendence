# 🔒 PLAN COMPLET DE SÉCURISATION - Backend Routes

## 📊 ÉTAT ACTUEL (mis à jour)

### ✅ Routes **SÉCURISÉES** (5/30+)

#### `auth.ts` (3/8)
- ✅ `/auth/register` - Validation + sanitization
- ✅ `/auth/login` - Validation + sanitization  
- ✅ `/auth/profile` (PUT) - Validation + sanitization
- ❌ `/auth/me` (GET) - Pas de validation nécessaire (lecture seule)
- ❌ `/auth/logout` (POST) - Pas de validation nécessaire
- ❌ `/auth/avatar/upload` (POST) - **À sécuriser** (validation fichier)
- ❌ `/auth/avatar/save` (POST) - **À sécuriser** (validation temp file)
- ❌ `/auth/avatar/reset` (POST) - Pas de validation nécessaire

#### `users.ts` (1/10)
- ✅ `/users/search` (GET) - Validation query
- ❌ `/users` (GET) - Lecture seule, OK
- ❌ `/users/:id/friend` (POST) - **À sécuriser** (validation ID)
- ❌ `/users/friend-requests/received` (GET) - Lecture seule, OK
- ❌ `/users/friend-requests/:requestId/accept` (POST) - **À sécuriser** (validation ID)
- ❌ `/users/friend-requests/:requestId/reject` (POST) - **À sécuriser** (validation ID)
- ❌ `/users/:id/friend` (DELETE) - **À sécuriser** (validation ID)
- ❌ `/users/leaderboard` (GET) - Lecture seule, OK
- ❌ `/users/:id/rank` (GET) - **À sécuriser** (validation ID)
- ❌ `/users/leaderboard/around/:rank` (GET) - **À sécuriser** (validation rank)
- ❌ `/users/status` (GET) - Lecture seule, OK

#### `rooms.ts` (1/4)
- ✅ `/rooms/friend/:username` (GET) - Validation username
- ❌ `/rooms` (POST) - **À sécuriser** (validation maxPlayers, roomPrefix)
- ❌ `/rooms` (GET) - Lecture seule, OK
- ❌ `/rooms/:roomName` (DELETE) - **À sécuriser** (validation roomName)

#### `matches.ts` (0/3)
- ❌ `/matches` (POST) - **À sécuriser**
- ❌ `/matches/record` (POST) - **À sécuriser**
- ❌ `/matches/history/:userId` (GET) - **À sécuriser** (validation userId)

#### `tournaments.ts` (0/3)
- ❌ `/tournaments` (POST) - **À sécuriser** (validation name, etc.)
- ❌ `/tournaments` (GET) - Lecture seule, OK
- ❌ `/tournaments/:id/join` (POST) - **À sécuriser** (validation ID, username)

---

## 🎯 PRIORITÉS PAR NIVEAU DE RISQUE

### 🔴 **CRITIQUE** (à faire EN PREMIER)
Ces routes acceptent des inputs utilisateur et modifient la DB :

1. `/users/:id/friend` (POST) - Envoyer demande d'ami
2. `/users/friend-requests/:requestId/accept` (POST) - Accepter demande
3. `/users/friend-requests/:requestId/reject` (POST) - Rejeter demande
4. `/users/:id/friend` (DELETE) - Supprimer ami
5. `/rooms` (POST) - Créer room
6. `/rooms/:roomName` (DELETE) - Supprimer room
7. `/tournaments` (POST) - Créer tournoi
8. `/tournaments/:id/join` (POST) - Rejoindre tournoi

### 🟡 **IMPORTANT** (à faire APRÈS)
Ces routes lisent des données avec des IDs :

9. `/users/:id/rank` (GET) - Lire rang
10. `/users/leaderboard/around/:rank` (GET) - Lire leaderboard
11. `/matches/history/:userId` (GET) - Lire historique
12. `/auth/avatar/upload` (POST) - Upload fichier
13. `/auth/avatar/save` (POST) - Sauvegarder avatar

### 🟢 **OPTIONNEL** (déjà assez sécurisé)
Ces routes sont en lecture seule ou déjà OK :

- ❌ `/users` (GET) - Lecture friends
- ❌ `/users/friend-requests/received` (GET) - Lecture requêtes
- ❌ `/users/leaderboard` (GET) - Lecture classement
- ❌ `/users/status` (GET) - Lecture status
- ❌ `/rooms` (GET) - Lecture rooms
- ❌ `/tournaments` (GET) - Lecture tournois
- ❌ `/auth/me` (GET) - Lecture profil
- ❌ `/auth/logout` (POST) - Logout
- ❌ `/auth/avatar/reset` (POST) - Reset avatar

---

## ⚡ PLAN D'ACTION RAPIDE

### Phase 1 : Sécuriser les routes critiques (30 min)

```typescript
// 1. users.ts - Validation IDs
fastify.post('/users/:id/friend', ...)
  → Valider que id est un nombre positif
  → Vérifier qu'il existe en DB

// 2. users.ts - Validation request IDs  
fastify.post('/users/friend-requests/:requestId/accept', ...)
  → Valider que requestId est un nombre positif
  
// 3. rooms.ts - Validation inputs création
fastify.post('/rooms', ...)
  → Valider maxPlayers (entre 2 et 4)
  → Sanitizer roomPrefix (alphanumeric only)
  
// 4. tournaments.ts - Validation création
fastify.post('/tournaments', ...)
  → Valider et sanitizer le nom du tournoi
  → Valider maxParticipants
```

### Phase 2 : Helper function pour IDs (10 min)

Créer une fonction réutilisable :

```typescript
// Dans security.ts
export function validateId(id: any): number | null {
  const parsed = parseInt(id);
  if (isNaN(parsed) || parsed < 1) return null;
  return parsed;
}
```

### Phase 3 : Appliquer partout (20 min)

Utiliser `validateId()` dans toutes les routes qui acceptent des IDs.

---

## 📝 TEMPLATE DE SÉCURISATION

Pour chaque route, appliquer ce pattern :

```typescript
fastify.post('/route/:id', async (request, reply) => {
  // 1. AUTHENTICATION (si nécessaire)
  const jwtToken = getJwtFromRequest(request);
  if (!jwtToken) {
    return reply.code(401).send({ error: 'Not authenticated' });
  }
  
  // 2. VALIDATE IDs
  const id = validateId(request.params.id);
  if (!id) {
    return reply.code(400).send({ error: 'Invalid ID' });
  }
  
  // 3. VALIDATE INPUT LENGTHS
  const { name } = request.body;
  if (!validateLength(name, 1, 100)) {
    return reply.code(400).send({ error: 'Name too long' });
  }
  
  // 4. SANITIZE INPUTS
  const safeName = sanitizeName(name);
  
  // 5. USE PREPARED STATEMENTS
  db.prepare('INSERT INTO table (name) VALUES (?)').run(safeName);
});
```

---

## ✅ CHECKLIST PAR ROUTE

### users.ts

- [ ] `/users/:id/friend` (POST)
  - [ ] Valider ID ami
  - [ ] Vérifier auth JWT
  - [ ] Vérifier que l'ami existe
  - [ ] Empêcher de s'ajouter soi-même
  
- [ ] `/users/friend-requests/:requestId/accept` (POST)
  - [ ] Valider requestId
  - [ ] Vérifier que la demande existe
  - [ ] Vérifier qu'elle est bien pour l'utilisateur actuel
  
- [ ] `/users/friend-requests/:requestId/reject` (POST)
  - [ ] (même que accept)
  
- [ ] `/users/:id/friend` (DELETE)
  - [ ] Valider ID ami
  - [ ] Vérifier auth JWT
  - [ ] Vérifier que l'amitié existe
  
- [ ] `/users/:id/rank` (GET)
  - [ ] Valider ID utilisateur
  
- [ ] `/users/leaderboard/around/:rank` (GET)
  - [ ] Valider rank (nombre positif)

### rooms.ts

- [ ] `/rooms` (POST)
  - [ ] Valider maxPlayers (2-4)
  - [ ] Sanitizer roomPrefix (alphanumeric)
  - [ ] Limiter taux de création (rate limit)
  
- [ ] `/rooms/:roomName` (DELETE)
  - [ ] Valider roomName format
  - [ ] Vérifier auth (optionnel)
  - [ ] Vérifier que la room existe

### matches.ts

- [ ] `/matches` (POST)
  - [ ] Valider tous les IDs
  - [ ] Valider scores (nombres positifs)
  
- [ ] `/matches/record` (POST)
  - [ ] (même que ci-dessus)
  
- [ ] `/matches/history/:userId` (GET)
  - [ ] Valider userId

### tournaments.ts

- [ ] `/tournaments` (POST)
  - [ ] Valider et sanitizer name (3-50 chars, alphanumeric)
  - [ ] Valider maxParticipants (4-16)
  - [ ] Vérifier auth JWT
  
- [ ] `/tournaments/:id/join` (POST)
  - [ ] Valider tournament ID
  - [ ] Valider et sanitizer username
  - [ ] Vérifier auth JWT
  - [ ] Vérifier que le tournoi existe et n'est pas complet

---

## 🚀 ESTIMATION TEMPS

- **Phase 1 (critique)** : 30-45 min
- **Phase 2 (helper)** : 10 min
- **Phase 3 (application)** : 20-30 min

**TOTAL** : ~1h30 pour sécuriser **toutes** les routes importantes

---

**Tu veux qu'on continue route par route ?** 🎯
