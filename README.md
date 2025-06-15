# ft_transcendence

Ce projet utilise Docker pour lancer automatiquement l'application web.

## Structure du projet

```
.
├── Makefile
├── docker-compose.yml
├── README.md
└── srcs/
    ├── frontend/
    ├── backend/
    └── docker/
        ├── frontend/
        │   └── Dockerfile
        └── backend/
            └── Dockerfile
```

## Commandes disponibles

- `make` : Construire les images Docker et démarrer les conteneurs
- `make up` : Démarrer les conteneurs en arrière-plan
- `make down` : Arrêter les conteneurs
- `make build` : Construire les images Docker
- `make rebuild` : Reconstruire les images Docker sans utiliser le cache
- `make logs` : Afficher les logs des conteneurs
- `make clean` : Arrêter les conteneurs et supprimer les ressources Docker non utilisées
- `make fclean` : Effectuer un nettoyage complet (conteneurs, images, volumes)
- `make re` : Reconstruire et redémarrer tous les conteneurs

## Accès aux services

- Frontend : http://localhost:3000
- Backend : http://localhost:8080 