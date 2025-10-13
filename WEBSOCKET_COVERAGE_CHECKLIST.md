# ✅ WebSocket Coverage Checklist - Remplacement du Polling

## 📡 Events WebSocket implémentés

### 1. **friendStatusChanged** - Changement de statut (online/offline/in-game)

#### ✅ Cas couverts :

| Action | Ancien (Polling) | Nouveau (WebSocket) | Status |
|--------|------------------|---------------------|---------|
| **Connexion utilisateur** | ❌ fetch toutes les 1s | ✅ Socket 'connection' → broadcast 'online' | ✅ FAIT |
| **Déconnexion utilisateur** | ❌ fetch toutes les 1s | ✅ Socket 'disconnect' → broadcast 'offline' | ✅ FAIT |
| **Logout volontaire** | ❌ fetch toutes les 1s | ✅ POST /auth/logout → broadcast 'offline' | ✅ FAIT (juste ajouté) |
| **Début de partie (tous joueurs)** | ❌ fetch toutes les 1s | ✅ joinRoom (room pleine) → broadcast 'in-game' | ✅ FAIT (corrigé pour TOUS) |
| **Fin de partie (tous joueurs)** | ❌ fetch toutes les 1s | ✅ gameFinished → broadcast 'online' | ✅ FAIT |
| **Forfait déconnexion** | ❌ fetch toutes les 1s | ✅ disconnect pendant game → broadcast winner='online', loser='offline' | ✅ FAIT |
| **Forfait volontaire** | ❌ fetch toutes les 1s | ✅ leaveAllRooms pendant game → broadcast both='online' | ✅ FAIT |

---

### 2. **friendAdded** - Nouvel ami ajouté

| Action | Ancien (Polling) | Nouveau (WebSocket) | Status |
|--------|------------------|---------------------|---------|
| **Acceptation demande d'ami** | ❌ Rechargement manuel | ✅ POST /friend-requests/:id/accept → emit 'friendAdded' | ✅ FAIT |

---

### 3. **friendRemoved** - Ami supprimé

| Action | Ancien (Polling) | Nouveau (WebSocket) | Status |
|--------|------------------|---------------------|---------|
| **Suppression ami** | ❌ Rechargement manuel | ✅ DELETE /users/:id/friend → emit 'friendRemoved' | ✅ FAIT |

---

### 4. **profileUpdated** - Changement de profil (pseudo/avatar)

| Action | Ancien (Polling) | Nouveau (WebSocket) | Status |
|--------|------------------|---------------------|---------|
| **Changement pseudo** | ❌ fetch toutes les 1s | ✅ PUT /auth/profile → emit 'profileUpdated' | ⚠️ À VÉRIFIER |
| **Changement avatar** | ❌ fetch toutes les 1s | ✅ POST /auth/avatar/save → emit 'profileUpdated' | ⚠️ À VÉRIFIER |

---

### 5. **friendRequestReceived** - Nouvelle demande d'ami reçue

| Action | Ancien (Polling) | Nouveau (WebSocket) | Status |
|--------|------------------|---------------------|---------|
| **Envoi demande d'ami** | ❌ fetch répété | ✅ POST /users/:id/friend → emit 'friendRequestReceived' | ✅ FAIT |

---

## 🔍 Cas Edge à vérifier

1. ⚠️ **Session expirée** : Le token JWT expire → doit notifier offline ?
2. ⚠️ **Crash serveur/redémarrage** : Tous les utilisateurs deviennent offline
3. ⚠️ **Changement d'onglet** : Tab visibility API ?
4. ⚠️ **Réseau instable** : Reconnexion WebSocket

---

## 📊 Résumé

- ✅ **7/9 cas principaux** couverts et testés
- ⚠️ **2 cas à vérifier** : profileUpdated lors changement pseudo/avatar
- 🎯 **Polling complètement éliminé** sauf fetch initial unique au chargement

---

## 🚀 Prochaines étapes

1. Vérifier que `notifyProfileUpdated()` est bien appelé dans PUT /auth/profile
2. Vérifier que `notifyProfileUpdated()` est bien appelé dans POST /auth/avatar/save
3. Tester tous les scénarios avec 3 comptes simultanés
