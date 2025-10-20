# 🧪 Commandes de Test Console - Session Security

## 🔍 Mode Debug

Les fonctions de test sont accessibles via `window.__sessionDebug` :

```javascript
// Afficher toutes les fonctions disponibles
console.log(window.__sessionDebug)

// Fonctions disponibles :
window.__sessionDebug.isSessionBlocked()        // Vérifie si session bloquée
window.__sessionDebug.getTabId()                // ID de cet onglet
window.__sessionDebug.getKnownTabs()            // Liste des tabs connus
window.__sessionDebug.hasActiveSession()        // Ce tab a une session ?
window.__sessionDebug.isSessionOwner()          // Ce tab est le propriétaire ?
window.__sessionDebug.overlayWatchdogActive()   // Watchdog actif ?
```

---

## ⚡ Tests Rapides (Nouvelles Protections)

### 1️⃣ Test : Overlay se recrée automatiquement

```javascript
// Supprimer l'overlay
document.getElementById('sessionDisconnectedOverlay')?.remove()

// Attendre 2 secondes et vérifier
setTimeout(() => {
  const recreated = !!document.getElementById('sessionDisconnectedOverlay')
  console.log('✅ TEST 1:', recreated ? 'PASS - Overlay recréé' : 'FAIL - Overlay pas recréé')
}, 2000)
```

**Résultat attendu** : ✅ PASS - Overlay recréé

---

### 2️⃣ Test : BroadcastChannel malveillant bloqué

```javascript
// Envoyer un faux message SESSION_DESTROYED avec un tab ID inconnu
const fakeChannel = new BroadcastChannel('ft_transcendence_session')
fakeChannel.postMessage({ type: 'SESSION_DESTROYED', tabId: 'hacker123' })
fakeChannel.close()

// Vérifier après 1.5 secondes
setTimeout(() => {
  const stillBlocked = window.__sessionDebug.isSessionBlocked()
  const overlayPresent = !!document.getElementById('sessionDisconnectedOverlay')
  console.log('✅ TEST 2:', stillBlocked && overlayPresent ? 'PASS - Toujours bloqué' : 'FAIL - Débloqué!')
}, 1500)
```

**Résultat attendu** : ✅ PASS - Toujours bloqué

⚠️ **Note** : Dans la console, vous devriez voir :
```
⚠️ SECURITY: Ignoring SESSION_DESTROYED from unknown tab: hacker123
   Known tabs: []
```

---

### 3️⃣ Test : Variables privées inaccessibles

```javascript
// Essayer d'accéder aux variables privées
const tests = {
  'sessionBlockedByAnotherTab': typeof sessionBlockedByAnotherTab,
  'hasActiveSession': typeof hasActiveSession,
  'TAB_ID': typeof TAB_ID,
  'knownSessionTabs': typeof knownSessionTabs,
  'isSessionOwner': typeof isSessionOwner
}

console.log('✅ TEST 3:', Object.values(tests).every(v => v === 'undefined') ? 'PASS - Toutes variables privées' : 'FAIL - Variables exposées')
console.table(tests)
```

**Résultat attendu** : ✅ PASS - Toutes variables privées

---

### 4️⃣ Test : Fetch bloqué

```javascript
// Tester plusieurs endpoints
const endpoints = ['/api/users/me', '/api/profile', '/api/matches']
let blockedCount = 0

endpoints.forEach(url => {
  fetch(url)
    .then(() => console.log(`❌ ${url}: NON BLOQUÉ`))
    .catch(err => {
      blockedCount++
      if (blockedCount === endpoints.length) {
        console.log('✅ TEST 4: PASS - Tous les fetch bloqués')
      }
    })
})
```

**Résultat attendu** : ✅ PASS - Tous les fetch bloqués

---

### 5️⃣ Test Complet de Sécurité

```javascript
console.log('🔒 === TEST DE SÉCURITÉ COMPLET ===\n')

let passedTests = 0
const totalTests = 6

// Test 1: Variables privées
try { 
  sessionBlockedByAnotherTab 
  console.log('❌ Test 1: FAIL - Variables accessibles')
} catch(e) { 
  console.log('✅ Test 1: PASS - Variables privées')
  passedTests++
}

// Test 2: État de blocage
const blocked = window.__sessionDebug.isSessionBlocked()
if (blocked) {
  console.log('✅ Test 2: PASS - Session bloquée')
  passedTests++
} else {
  console.log('❌ Test 2: FAIL - Session non bloquée')
}

// Test 3: Overlay présent
const overlayPresent = !!document.getElementById('sessionDisconnectedOverlay')
if (overlayPresent) {
  console.log('✅ Test 3: PASS - Overlay présent')
  passedTests++
} else {
  console.log('❌ Test 3: FAIL - Overlay absent')
}

// Test 4: currentUser null
if (window.currentUser === null) {
  console.log('✅ Test 4: PASS - currentUser = null')
  passedTests++
} else {
  console.log('❌ Test 4: FAIL - currentUser présent')
}

// Test 5: Fetch bloqué
fetch('/api/users/me')
  .then(() => console.log('❌ Test 5: FAIL - Fetch non bloqué'))
  .catch(err => {
    console.log('✅ Test 5: PASS - Fetch bloqué')
    passedTests++
    
    // Test 6: BroadcastChannel malveillant (après fetch)
    const malicious = new BroadcastChannel('ft_transcendence_session')
    malicious.postMessage({ type: 'SESSION_DESTROYED', tabId: 'attacker' })
    malicious.close()
    
    setTimeout(() => {
      const stillBlocked = window.__sessionDebug.isSessionBlocked()
      if (stillBlocked) {
        console.log('✅ Test 6: PASS - BroadcastChannel bloqué')
        passedTests++
      } else {
        console.log('❌ Test 6: FAIL - BroadcastChannel accepté')
      }
      
      // Résultat final
      console.log(`\n🎯 RÉSULTAT: ${passedTests}/${totalTests} tests réussis`)
      if (passedTests === totalTests) {
        console.log('🏆 SÉCURITÉ: EXCELLENTE ✅')
      } else if (passedTests >= 4) {
        console.log('⚠️ SÉCURITÉ: ACCEPTABLE')
      } else {
        console.log('🚨 SÉCURITÉ: INSUFFISANTE')
      }
    }, 1500)
  })
```

**Résultat attendu** : 🏆 SÉCURITÉ: EXCELLENTE ✅ (6/6 tests)

---

### 6️⃣ Test : Suppression répétée de l'overlay

```javascript
// Test de persistence - essayer de supprimer l'overlay plusieurs fois
let attempts = 0
const maxAttempts = 5

const interval = setInterval(() => {
  const overlay = document.getElementById('sessionDisconnectedOverlay')
  if (overlay) {
    overlay.remove()
    attempts++
    console.log(`Tentative ${attempts}: Overlay supprimé`)
  }
  
  if (attempts >= maxAttempts) {
    clearInterval(interval)
    
    // Vérifier après 2 secondes
    setTimeout(() => {
      const stillPresent = !!document.getElementById('sessionDisconnectedOverlay')
      console.log(`\n✅ TEST 6: ${stillPresent ? 'PASS - Overlay persistant' : 'FAIL - Overlay définitivement supprimé'}`)
    }, 2000)
  }
}, 500)
```

**Résultat attendu** : ✅ PASS - Overlay persistant

---

## 📊 Logs Console Attendus

Lors d'un onglet bloqué, vous devriez voir dans la console :

```
📨 Received message: SESSION_ACTIVE from tab: abc123
🔴 SESSION_ACTIVE received from another tab
   Registered tab: abc123 - Known tabs: ["abc123"]
🚫 Setting sessionBlockedByAnotherTab = true (SESSION_ACTIVE)
🗑️ Removing existing overlay
🎨 Creating session blocked overlay
✅ Overlay created and appended to body
🐕 Starting overlay watchdog
```

Et lors d'une tentative malveillante :

```
📨 Received message: SESSION_DESTROYED from tab: hacker123
🟢 SESSION_DESTROYED received from another tab
⚠️ SECURITY: Ignoring SESSION_DESTROYED from unknown tab: hacker123
   Known tabs: ["abc123"]
```

---

## 🎯 Scénario de Test Complet

### Étape 1 : Ouvrir deux onglets
1. Se connecter dans l'onglet 1
2. Ouvrir l'onglet 2 (même URL)
3. L'onglet 2 affiche "SESSION BLOCKED"

### Étape 2 : Dans l'onglet 2, exécuter
```javascript
// Vérifier l'état avec le mode debug
console.log('Bloqué ?', window.__sessionDebug.isSessionBlocked())
console.log('Known tabs:', window.__sessionDebug.getKnownTabs())
console.log('Tab ID:', window.__sessionDebug.getTabId())
console.log('Watchdog actif ?', window.__sessionDebug.overlayWatchdogActive())

// Essayer de contourner
document.getElementById('sessionDisconnectedOverlay')?.remove()
fetch('/api/users/me').catch(e => console.log('Fetch:', e.message))

// Attendre 2 secondes et vérifier
setTimeout(() => {
  console.log('Overlay de retour ?', !!document.getElementById('sessionDisconnectedOverlay'))
}, 2000)
```

### Étape 3 : Dans l'onglet 1, se déconnecter
```javascript
// Cliquer sur logout dans l'UI
```

### Étape 4 : Dans l'onglet 2, vérifier
```javascript
setTimeout(() => {
  console.log('Débloqué ?', !window.__sessionDebug.isSessionBlocked())
  console.log('Overlay disparu ?', !document.getElementById('sessionDisconnectedOverlay'))
}, 1000)
```

**Résultat attendu** : L'onglet 2 est maintenant débloqué ✅

---

## 🛡️ Protection Summary

| Protection | Implémentée | Testable |
|------------|-------------|----------|
| Variables privées (closure) | ✅ | ✅ |
| Fetch guard | ✅ | ✅ |
| Overlay watchdog (1s) | ✅ | ✅ |
| Tab ID tracking | ✅ | ✅ |
| Message validation | ✅ | ✅ |
| Session owner flag | ✅ | ✅ |

