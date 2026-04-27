# ft_transcendence - Web Pong Suite

**ft_transcendence** est une plateforme web complète permettant de jouer au célèbre jeu Pong en temps réel. Ce projet final du cursus commun de l'école 42 valide des compétences avancées en architecture logicielle, gestion de base de données et sécurité.

## 🚀 Tech Stack

* **Frontend :** TypeScript, Next.js / Svelte, TailwindCSS.
* **Backend :** Node.js, Fastify / NestJS.
* **Base de données :** PostgreSQL avec Prisma ORM.
* **Temps réel :** WebSockets (Socket.io) pour le jeu et le chat.
* **Infrastructure :** Docker, Docker-Compose.
* **Sécurité :** Authentification OAuth (API 42), JWT, Double Authentification (2FA).

## 🛠 Fonctionnalités Clés

* **Gestion Utilisateurs :** Profils personnalisables, système d'amis et historique des matchs.
* **Jeu en Temps Réel :** Moteur de jeu Pong synchronisé via WebSockets avec gestion des déconnexions.
* **Système de Chat :** Salons publics/privés, messages directs et administration (kick, ban, mute).
* **Sécurité & Permissions :** Implémentation du **RBAC** (Role-Based Access Control) et protection des routes via JWT.
* **Matchmaking :** Système de file d'attente pour mettre en relation les joueurs de niveau similaire.

## 🏗 Architecture & Backend

Le projet est entièrement conteneurisé pour garantir une parité parfaite entre les environnements de développement et de production.
* **API REST & WebSockets :** Une architecture hybride permettant des échanges de données classiques et des flux ultra-rapides pour le gameplay.
* **Base de données :** Utilisation de Prisma pour une gestion sécurisée et typée des schémas PostgreSQL.

## ⚙️ Installation

```bash
# Cloner le projet
git clone [https://github.com/Rayane-hub/ft_transcendence.git](https://github.com/Rayane-hub/ft_transcendence.git)
cd ft_transcendence

# Lancer l'infrastructure complète avec Docker
docker-compose up --build
```

L'application est alors accessible sur localhost:3000.
