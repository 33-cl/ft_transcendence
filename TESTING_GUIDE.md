# Guide de Test Multi-Comptes

## Problème
Le système d'authentification utilise des cookies de session. Un seul compte peut être connecté par navigateur à la fois.

## Solutions pour tester avec 2 comptes différents

### ✅ Solution 1 : Navigation Privée (Recommandée)
1. **Onglet normal** : Connectez-vous avec le compte 1
2. **Onglet privé** : Ouvrez un onglet en mode privé (Ctrl+Shift+N) et connectez-vous avec le compte 2
3. Les deux onglets auront des sessions indépendantes

### ✅ Solution 2 : Browsers Différents
1. **Chrome** : Connectez-vous avec le compte 1
2. **Firefox** : Connectez-vous avec le compte 2
3. Lancez un match entre les deux

### ✅ Solution 3 : Profils Différents (Chrome/Firefox)
1. Créez un nouveau profil dans Chrome/Firefox
2. Utilisez un profil par compte

### ❌ Ce qui ne fonctionne PAS
- Deux onglets normaux du même navigateur = même session = même compte

## Test du Système Win/Loss

### Comptes de test disponibles :
- **Compte 1** : `testuser1` / `password123`
- **Compte 2** : `player2` / `password123`

### Étapes de test :
1. Connectez-vous avec `testuser1` dans un navigateur/onglet normal
2. Connectez-vous avec `player2` dans un onglet privé ou autre navigateur
3. Lancez une partie en ligne entre les deux
4. Vérifiez que les stats sont correctement enregistrées

### Vérification des statistiques :
```bash
curl -k https://localhost:8080/matches/testuser1
curl -k https://localhost:8080/matches/player2
```

## Protection Anti-Triche
Le système détecte et empêche :
- ✅ Même utilisateur jouant contre lui-même (même username)
- ✅ Même ID utilisateur (double protection)
- ✅ Jeux locaux ne comptent pas dans les stats
- ✅ Messages informatifs dans les logs
