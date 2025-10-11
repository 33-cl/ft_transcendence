# Système de Forfait - Changements Implémentés

## Date: 11 Octobre 2025

## Problème
Quand un joueur quitte une partie multijoueur en ligne (en fermant l'onglet, en faisant retour arrière, ou en naviguant ailleurs), le score n'était pas enregistré. Il fallait implémenter un système de victoire par forfait.

## Solution Implémentée

### Backend (`srcs/backend/src/socket/socketHandlers.ts`)

#### 1. Modification de `handleLeaveAllRooms()`
Cette fonction est appelée quand un joueur quitte volontairement la partie (navigation SPA, retour arrière, etc.).

**Changements:**
- Détection si le joueur quitte pendant une partie active en ligne
- Récupération des scores actuels des deux joueurs
- Détermination du gagnant (le joueur restant avec le meilleur score)
- Enregistrement du match dans la base de données avec `updateUserStats()`
- Émission de l'événement `gameFinished` avec le flag `forfeit: true`
- Arrêt du jeu et notification des amis

**Code clé:**
```typescript
const wasInActiveGame = !!room.pongGame && room.pongGame.state.running && !room.isLocalGame;

if (wasInActiveGame) {
    // Record match with current scores
    updateUserStats(winnerUser.id, loserUser.id, winningScore, leavingScore, 'online');
    
    // Émettre gameFinished avec message de forfait
    io.to(previousRoom).emit('gameFinished', {
        winner,
        loser,
        forfeit: true,
        forfeitMessage: `${leavingUsername} a quitté la partie - Victoire par forfait !`
    });
}
```

#### 2. Fonction `handleSocketDisconnect()` (déjà existante, vérifiée)
Cette fonction est appelée quand un joueur se déconnecte complètement (fermeture navigateur, perte connexion).
- Le système de forfait existait déjà ici
- Fonctionne de la même manière que `handleLeaveAllRooms()`
- Enregistre le match et émet `gameFinished` avec forfait

### Frontend

#### 1. Modification de `gameFinished.html.ts`
**Avant:** Template HTML statique simple avec 2 boutons

**Après:** Fonction dynamique qui affiche:
- Le titre adapté (forfait ou victoire normale)
- Le message de forfait s'il y en a un
- Les noms des joueurs (username ou side)
- Les scores finaux
- Section gagnant (vert) et perdant (rouge)
- Bouton "Rejouer" seulement si pertinent (pas en mode forfait online)
- Bouton "Menu Principal"

**Code clé:**
```typescript
export const gameFinishedHTML = (data?: any) => {
    const isForfeit = data?.forfeit === true;
    const forfeitMessage = data?.forfeitMessage || '';
    
    return /*html*/`
        <div class="game-finished-container">
            <h1>${isForfeit ? '🏆 VICTOIRE PAR FORFAIT!' : '🏆 GAME OVER!'}</h1>
            ${isForfeit ? `<div class="forfeit-message">${forfeitMessage}</div>` : ''}
            <!-- Affichage des scores -->
        </div>
    `;
};
```

#### 2. Modification de `utils.ts`
- Ajout du cas spécial pour passer les données à `gameFinished`
- La fonction `load('gameFinished', data)` transmet maintenant correctement les données au template

**Code clé:**
```typescript
// Dans show()
else if (pageName === 'gameFinished') {
    htmlResult = component.html(data);
}

// Dans load()
else if (pageName === 'gameFinished')
    await show('gameFinished', data);
```

#### 3. Ajout de styles CSS (`styles/pages.css`)
- Styles pour `.game-finished-container`
- Styles pour `.winner-section` et `.loser-section`
- Styles pour `.forfeit-message`
- Design moderne avec glassmorphism et couleurs différenciées (vert/rouge)

## Tests à Effectuer

### Scénario 1: Navigation pendant une partie
1. Joueur A et Joueur B commencent une partie ranked
2. Pendant la partie, Joueur A clique sur "Menu Principal"
3. **Résultat attendu:**
   - Joueur B voit l'écran de fin avec "VICTOIRE PAR FORFAIT!"
   - Message: "[Username A] a quitté la partie - Victoire par forfait !"
   - Le match est enregistré en base de données
   - Les stats sont mises à jour (victoire pour B, défaite pour A)

### Scénario 2: Retour arrière navigateur
1. Joueur A et Joueur B commencent une partie ranked
2. Joueur A clique sur le bouton "Retour" du navigateur
3. **Résultat attendu:** Même que scénario 1

### Scénario 3: Fermeture onglet/navigateur
1. Joueur A et Joueur B commencent une partie ranked
2. Joueur A ferme l'onglet ou le navigateur
3. **Résultat attendu:** Même que scénario 1

### Scénario 4: Jeu local (ne doit PAS enregistrer)
1. Un joueur lance une partie locale (2P ou 4P)
2. Le joueur quitte la partie
3. **Résultat attendu:**
   - Aucun match enregistré (car jeu local)
   - Pas de message de forfait
   - Retour au menu proprement

## Points Techniques Importants

### Ordre des Opérations
L'ordre est crucial pour que le système fonctionne:
1. **Vérifier** si partie active en ligne
2. **Récupérer** les données des joueurs et scores
3. **Enregistrer** le match en base de données
4. **Émettre** l'événement `gameFinished` (pendant que le socket est encore dans la room)
5. **Arrêter** le jeu
6. **Retirer** le joueur de la room
7. **Notifier** les amis du changement de statut

### Différence entre Déconnexion et Navigation
- **`handleSocketDisconnect`**: Appelé automatiquement quand le socket se déconnecte (fermeture navigateur, perte connexion)
- **`handleLeaveAllRooms`**: Appelé explicitement par le frontend lors de la navigation SPA

Les deux gèrent maintenant le forfait de la même manière.

### Éviter les Doublons
- On vérifie que `winnerUser.id !== loserUser.id` pour éviter d'enregistrer un match contre soi-même
- On vérifie `!room.isLocalGame` pour éviter d'enregistrer les jeux locaux

## Logs pour Debug
Les logs suivants permettent de tracer le système:
```
[FORFAIT] Player {username} left active game in room {roomName} - Recording forfeit
[FORFAIT] Match recorded: {winner} wins by forfeit {winScore}-{loseScore} against {loser}
[FORFAIT] gameFinished émis pour room {roomName}: {winner} bat {loser} par forfait
```

## Fichiers Modifiés
1. `srcs/backend/src/socket/socketHandlers.ts` - Ajout logique forfait dans `handleLeaveAllRooms`
2. `srcs/frontend/src/components/gameFinished.html.ts` - Template dynamique avec affichage forfait
3. `srcs/frontend/src/pages/utils.ts` - Passage des données à gameFinished
4. `srcs/frontend/styles/pages.css` - Styles pour l'écran de fin
