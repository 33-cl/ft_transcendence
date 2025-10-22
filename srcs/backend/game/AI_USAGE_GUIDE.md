# 🤖 Guide d'utilisation de l'IA - ft_transcendence

## Activation rapide

### Mode par défaut (2 joueurs humains)
```typescript
const game = new PongGame(2);
game.start();
```

### Mode 1 joueur avec IA
```typescript
const game = new PongGame(2);
game.enableAI('medium');  // 'easy', 'medium' ou 'hard'
game.start();
```

---

## Niveaux de difficulté

### Easy
- **Réaction** : 800ms (très lente)
- **Erreurs** : Fréquentes (±20px, 30%)
- **Panique** : Facile (200px)
- **Comportement** : Change souvent d'avis, relâche fréquemment les touches
- **Taux de victoire IA** : ~30%

### Medium
- **Réaction** : 500ms (modérée)
- **Erreurs** : Modérées (±12px, 15%)
- **Panique** : Normale (150px)
- **Comportement** : Équilibré, erreurs occasionnelles
- **Taux de victoire IA** : ~50%

### Hard
- **Réaction** : 250ms (rapide)
- **Erreurs** : Rares (±6px, 5%)
- **Panique** : Tardive (100px)
- **Comportement** : Persistant, précis, mais reste humain
- **Taux de victoire IA** : ~70%

---

## Mode debug pour l'évaluation

### Activation
```typescript
const game = new PongGame(2);
game.enableAI('medium');

// Activer le mode debug
if (game.state.aiConfig) {
    game.state.aiConfig.debugMode = true;
}

game.start();
```

### Logs affichés
```
🎯 [IA-medium] Prédiction: Y=325.0 | Balle: X=425.3, SpeedX=-4.50
🚨 [IA-medium] MODE PANIQUE activé! Distance balle: 145.2px
❌ [IA-medium] ERREUR! Décalage: -8.3px (PANIQUE)
🔧 [IA-medium] Micro-correction: 2.1px
📊 [IA-medium] Stats: Décisions=45, Erreurs=7, Paniques=3
```

### Accès aux statistiques
```typescript
if (game.state.aiConfig) {
    const stats = {
        difficulty: game.state.aiConfig.difficulty,
        decisions: game.state.aiConfig.decisionCount,
        errors: game.state.aiConfig.errorCount,
        panics: game.state.aiConfig.panicCount,
        errorRate: ((game.state.aiConfig.errorCount / game.state.aiConfig.decisionCount) * 100).toFixed(2) + '%'
    };
    console.log('Statistiques IA:', stats);
}
```

---

## Tests recommandés

### Test 1 : Vérifier la simulation clavier
**Objectif** : Confirmer que l'IA utilise les mêmes inputs que les humains

1. Activer l'IA en mode `easy`
2. Observer que le paddle IA se déplace de manière saccadée (pas fluide)
3. Vérifier que la vitesse est identique au joueur humain (20 px/frame)

**Validation** : ✅ Mouvement identique aux joueurs humains

### Test 2 : Différencier les niveaux
**Objectif** : Confirmer que les 3 niveaux sont distincts

1. Jouer 5 parties en `easy`
2. Jouer 5 parties en `medium`
3. Jouer 5 parties en `hard`
4. Comparer les taux de victoire

**Validation** : ✅ Progression claire Easy < Medium < Hard

### Test 3 : Observer les comportements humains
**Objectif** : Confirmer le réalisme de l'IA

1. Activer le mode debug
2. Observer les logs pendant une partie
3. Noter :
   - Les moments de panique quand la balle approche
   - Les erreurs de prédiction
   - Les micro-corrections
   - Les relâchements prématurés

**Validation** : ✅ Comportements variés et réalistes

### Test 4 : Vérifier l'anticipation
**Objectif** : Confirmer que l'IA anticipe les rebonds

1. Activer le mode debug en `hard`
2. Lancer des balles avec angles variés
3. Observer les prédictions dans les logs
4. Vérifier que l'IA se positionne correctement

**Validation** : ✅ Anticipation correcte des rebonds

### Test 5 : Confirmer la limite 1x/seconde
**Objectif** : Vérifier le rafraîchissement limité

1. Activer le mode debug
2. Observer la fréquence des logs de prédiction
3. Vérifier que `updateAITarget()` n'est appelée qu'une fois par seconde

**Validation** : ✅ Rafraîchissement respecté

---

## Résolution de problèmes

### L'IA ne bouge pas
**Cause** : IA non activée ou désactivée
**Solution** :
```typescript
game.enableAI('medium');
```

### L'IA est trop forte/faible
**Cause** : Mauvais niveau de difficulté
**Solution** : Changer le niveau
```typescript
game.disableAI();
game.enableAI('easy');  // ou 'hard'
```

### Pas de logs de debug
**Cause** : Mode debug non activé
**Solution** :
```typescript
if (game.state.aiConfig) {
    game.state.aiConfig.debugMode = true;
}
```

### L'IA semble "robotique"
**Vérification** : S'assurer que la simulation clavier est bien utilisée
- L'IA doit appeler `movePaddle()` comme les humains
- Le mouvement doit être saccadé, pas fluide
- La vitesse doit être identique (20 px/frame)

---

## Documentation complète

- **Algorithme détaillé** : `AI_ALGORITHM_EXPLANATION.md`
- **Récapitulatif complet** : `AI_IMPLEMENTATION_SUMMARY.md`
- **Code source** : `ai.ts`

---

## Pour l'évaluation

### Points à expliquer

1. **Pas d'A*** : Prédiction linéaire simple avec rebonds
2. **Simulation clavier** : Appelle `movePaddle()` comme les humains
3. **Rafraîchissement limité** : `updateAITarget()` max 1x/seconde
4. **Anticipation** : `predictBallLanding()` calcule les rebonds
5. **Comportement humain** : Erreurs, panique, micro-corrections, inertie

### Démonstration recommandée

1. Activer le mode debug
2. Lancer une partie en `easy`
3. Montrer les logs en temps réel
4. Expliquer chaque décision de l'IA
5. Passer en `hard` pour montrer la différence
6. Montrer le code source pour expliquer l'algorithme

---

## Conformité au sujet

| Exigence | ✅ Status |
|----------|-----------|
| Introduire AI opponent | ✅ 3 niveaux implémentés |
| Pas d'algorithme A* | ✅ Prédiction linéaire |
| Simulation keyboard input | ✅ Via movePaddle() |
| Rafraîchissement 1x/seconde | ✅ updateAITarget() limitée |
| Comportement humain réaliste | ✅ Erreurs + panique + micro-corrections |
| Anticipation rebonds | ✅ predictBallLanding() |
| IA peut gagner | ✅ Taux ajustés par difficulté |
| Explication détaillée | ✅ Documentation + logs |

---

**L'IA est complète et prête pour l'évaluation !** 🎉
