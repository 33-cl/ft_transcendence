# Guide de Test - Système de Forfait

## Prérequis
- Backend et Frontend démarrés avec `docker compose up` ou `make`
- Deux navigateurs ou deux onglets en navigation privée pour tester avec 2 comptes différents

## Test 1: Abandon par Navigation Menu

### Étapes
1. **Navigateur A**: Se connecter avec le compte `testuser1`
2. **Navigateur B**: Se connecter avec le compte `testuser2`
3. **Les deux**: Aller dans "1v1 Ranked" et attendre le matchmaking
4. **Les deux**: Une fois la partie commencée, jouer quelques secondes
5. **Navigateur A**: Cliquer sur "Menu Principal" pendant la partie

### Résultat Attendu
- **Navigateur B**: Voit l'écran "🏆 VICTOIRE PAR FORFAIT!"
- **Message affiché**: "testuser1 a quitté la partie - Victoire par forfait !"
- **Scores affichés**: Les scores actuels au moment de l'abandon
- **Base de données**: Un match enregistré avec `testuser2` gagnant

### Vérification en Base de Données
```bash
# Se connecter au container backend
docker compose exec backend sh

# Ouvrir la base de données SQLite
sqlite3 /app/db/pong.db

# Vérifier le dernier match
SELECT * FROM matches ORDER BY id DESC LIMIT 1;

# Vérifier les stats des utilisateurs
SELECT username, wins, losses, points FROM users WHERE username IN ('testuser1', 'testuser2');
```

## Test 2: Abandon par Retour Arrière

### Étapes
1. Répéter les étapes 1-4 du Test 1
2. **Navigateur A**: Cliquer sur le bouton "Retour" du navigateur

### Résultat Attendu
Identique au Test 1

## Test 3: Abandon par Fermeture Onglet

### Étapes
1. Répéter les étapes 1-4 du Test 1
2. **Navigateur A**: Fermer l'onglet/navigateur

### Résultat Attendu
Identique au Test 1 (avec un léger délai car déconnexion réseau)

## Test 4: Jeu Local (Pas d'Enregistrement)

### Étapes
1. **Un seul navigateur**: Se connecter ou pas (le jeu local marche sans auth)
2. Lancer un jeu "Local 2P"
3. Pendant la partie, cliquer sur "Menu Principal"

### Résultat Attendu
- Retour au menu sans message de forfait
- **AUCUN** match enregistré en base de données
- Pas d'affichage d'écran de fin avec forfait

## Test 5: Partie Normale (Fin Sans Forfait)

### Étapes
1. Répéter les étapes 1-4 du Test 1
2. **Jouer** jusqu'à ce qu'un joueur atteigne le score maximum (11 points par défaut)

### Résultat Attendu
- **Les deux navigateurs**: Voient l'écran "🏆 GAME OVER!" (sans "FORFAIT")
- **Pas de message de forfait**
- **Scores affichés**: 11 - [score perdant]
- **Bouton "Rejouer"**: Disponible
- **Base de données**: Match enregistré normalement

## Vérification des Logs Backend

Ouvrir les logs du backend:
```bash
docker compose logs -f backend
```

Chercher ces lignes lors d'un abandon:
```
[FORFAIT] Player {username} left active game in room {roomName} - Recording forfeit
[FORFAIT] Match recorded: {winner} wins by forfeit {score1}-{score2} against {loser}
[FORFAIT] gameFinished émis pour room {roomName}: {winner} bat {loser} par forfait
```

## Vérification Frontend

Ouvrir la console du navigateur (F12) et chercher:
- Aucune erreur JavaScript
- L'événement `gameFinished` reçu avec `forfeit: true`
- Le template `gameFinished` appelé avec les bonnes données

## Problèmes Possibles

### Le match n'est pas enregistré
- **Cause possible**: Les deux joueurs ne sont pas authentifiés
- **Solution**: Vérifier que les cookies de session sont valides

### L'écran de forfait ne s'affiche pas
- **Cause possible**: Le frontend n'a pas reçu l'événement `gameFinished`
- **Solution**: Vérifier les logs backend et la console frontend

### Message "undefined a quitté la partie"
- **Cause possible**: Le username n'est pas dans `room.playerUsernames`
- **Solution**: Vérifier que l'authentification socket fonctionne

### Les deux joueurs reçoivent le forfait
- **Cause possible**: Bug dans la logique de détection du gagnant
- **Solution**: Vérifier les logs et la logique de `findWinner`

## Commandes Utiles

```bash
# Redémarrer les services
docker compose restart

# Voir les logs en temps réel
docker compose logs -f

# Réinitialiser la base de données (ATTENTION: perte de données)
docker compose down -v
docker compose up -d

# Se connecter au backend
docker compose exec backend sh

# Voir la base de données
docker compose exec backend sqlite3 /app/db/pong.db
```

## Checklist Finale

- [ ] Test 1: Navigation Menu - Forfait enregistré ✅
- [ ] Test 2: Retour Arrière - Forfait enregistré ✅
- [ ] Test 3: Fermeture Onglet - Forfait enregistré ✅
- [ ] Test 4: Jeu Local - PAS enregistré ✅
- [ ] Test 5: Partie Normale - Fin normale ✅
- [ ] Logs backend corrects ✅
- [ ] Aucune erreur frontend ✅
- [ ] Base de données mise à jour ✅
- [ ] Affichage UI correct ✅
