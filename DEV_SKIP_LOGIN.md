# Configuration de développement - Skip Login

## Description
Cette fonctionnalité permet de contourner l'authentification pendant les tests et le développement, rendant l'accès au jeu plus rapide pour les tests.

## Utilisation

### Activer/Désactiver le bouton Skip Login

Le bouton "Skip Login (DEV)" peut être facilement activé ou désactivé en modifiant le fichier :
```
srcs/frontend/src/config/dev.ts
```

Changez la valeur de `SKIP_LOGIN_ENABLED` :
- `true` : Le bouton apparaît sur la page de connexion
- `false` : Le bouton est masqué (mode production)

### Personnaliser l'utilisateur de test

Vous pouvez modifier les données de l'utilisateur de test dans le même fichier en changeant l'objet `DEV_USER`.

### Suppression complète pour la production

Pour supprimer complètement cette fonctionnalité en production :

1. **Méthode simple** : Changez `SKIP_LOGIN_ENABLED: false` dans `dev.ts`

2. **Méthode complète** : Supprimez les fichiers suivants :
   - `srcs/frontend/src/config/dev.ts`
   - Et supprimez les imports et références dans :
     - `srcs/frontend/src/components/signIn.ts`
     - `srcs/frontend/src/pages/auth.ts`

## Fonctionnement

Quand le bouton "Skip Login (DEV)" est cliqué :
1. Un utilisateur temporaire est créé côté frontend
2. `window.currentUser` est défini avec les données de test
3. L'utilisateur est redirigé vers le menu principal
4. Aucune vérification serveur n'est effectuée

⚠️ **Attention** : Cette fonctionnalité contourne complètement l'authentification et ne doit être utilisée qu'en développement/test.
