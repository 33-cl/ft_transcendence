# Multi-Tab Session Management

## 🎯 Objectif
Empêcher qu'un utilisateur puisse avoir plusieurs sessions actives simultanément dans différents onglets.

## 🏗️ Architecture

### 1. BroadcastChannel (Principal)
**Fichier** : `src/utils/sessionBroadcast.ts`

Utilise l'API BroadcastChannel du navigateur pour la communication inter-onglets.

#### Messages
- **SESSION_CHECK** : Un nouvel onglet demande si une session existe déjà
- **SESSION_ACTIVE** : Réponse indiquant qu'une session est active
- **SESSION_CREATED** : Un onglet vient de créer une session
- **SESSION_DESTROYED** : Un onglet a détruit sa session (logout)

#### Scénarios

**Cas 1 : Nouvel onglet avec session existante**
```
Onglet A (connecté) ──────────────────────
                                          │
Onglet B (nouveau)                        │
    │                                     │
    ├─ initSessionBroadcast()             │
    ├─ envoie SESSION_CHECK ──────────────┤
    │                                     │
    │                         reçoit SESSION_CHECK
    │                                     │
    │                         répond SESSION_ACTIVE
    │                                     │
    ├─ reçoit SESSION_ACTIVE ─────────────┤
    ├─ sessionBlockedByAnotherTab = true
    ├─ Affiche overlay "SESSION BLOCKED"
    └─ Ne charge AUCUN composant
```

**Cas 2 : Connexion pendant que 2 onglets sont ouverts**
```
Onglet A (pas connecté)          Onglet B (pas connecté)
    │                                     │
    ├─ Login réussi                       │
    ├─ broadcast SESSION_CREATED ─────────┤
    │                                     │
    │                         reçoit SESSION_CREATED
    │                                     │
    │                         sessionBlockedByAnotherTab = true
    │                                     │
    │                         Affiche overlay
    └─────────────────────────────────────┘
```

### 2. WebSocket (Fallback)
**Fichier** : `src/game/websocket.ts`

Le backend peut aussi détecter une connexion déjà active et envoyer `USER_ALREADY_CONNECTED`.

**Rôle** : Fallback si le BroadcastChannel ne fonctionne pas (navigateurs anciens, ou cas edge).

Le WebSocket vérifie toujours si le BroadcastChannel a déjà géré le blocage avant de créer un overlay.

### 3. Blocage au niveau UI
**Fichier** : `src/pages/utils.ts`

La fonction `show()` vérifie `isSessionBlocked()` avant de charger tout composant :

```typescript
async function show(pageName: keyof typeof components) {
    if (isSessionBlocked() && pageName !== 'signIn' && pageName !== 'signUp') {
        console.warn('Component loading BLOCKED');
        return; // Ne charge rien
    }
    // ... charger le composant
}
```

**Résultat** : Même si on supprime l'overlay du DOM via DevTools, on ne voit qu'une page noire vide car aucun HTML n'a été chargé.

## 🔐 Sécurité

### Que se passe-t-il si l'utilisateur supprime l'overlay ?
1. L'overlay disparaît visuellement
2. **MAIS** : `sessionBlockedByAnotherTab = true` reste actif
3. Aucun composant n'est chargé (pas de HTML dans le DOM)
4. Aucune requête API ne peut être faite
5. Résultat : Page noire vide, aucune action possible

### Que se passe-t-il si l'utilisateur manipule les variables JS ?
```javascript
// Dans la console
sessionBlockedByAnotherTab = false; // ❌ Variable locale, pas accessible
```
Les variables `sessionBlockedByAnotherTab` et `hasActiveSession` sont **privées** dans le module, pas accessibles depuis la console.

### Points de contrôle
1. ✅ **BroadcastChannel** : Détection inter-onglets
2. ✅ **Backend WebSocket** : Vérification côté serveur
3. ✅ **UI Blocking** : Pas de composants chargés
4. ✅ **Cookies de session** : Un seul cookie par utilisateur

## 🧪 Test

1. Ouvre un onglet et connecte-toi
2. Ouvre un **nouvel onglet** (Ctrl+T)
3. Tu devrais voir "SESSION BLOCKED"
4. Essaie de supprimer l'overlay via DevTools
5. Tu verras une page noire vide, aucun bouton accessible

## 📝 Notes

- Le timeout de `SESSION_CHECK` est de 100ms (suffisant pour communication locale)
- L'overlay est recréé automatiquement si supprimé (via les messages BroadcastChannel)
- Le système fonctionne uniquement en local (même origine)
