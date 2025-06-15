"use strict";
/********Importation des modules necessaire au back****************/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//Imporation du module fastify
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const db_1 = __importDefault(require("./db"));
const gameState_1 = require("./gameState");
const rooms_1 = __importDefault(require("./src/routes/rooms"));
const fs_1 = __importDefault(require("fs"));
let gameState = (0, gameState_1.createInitialGameState)();
const key = fs_1.default.readFileSync('key.pem');
const cert = fs_1.default.readFileSync('cert.pem');
const app = (0, fastify_1.default)({
    logger: true,
    https: {
        key,
        cert
    }
});
/*****************Routes******************************************/
app.get('/', (request, reply) => {
    // request contient les infos de la requête
    // reply sert à envoyer la réponse
    reply.send({ message: "Welcome in my server =D" });
});
//  POST une game
app.post('/games', (request, reply) => {
    //Recuperer le contenu du corp html envoyer par le client pour init partiellement(Partial) un objet Game
    const body = request.body;
    if (!body.player1 || !body.player2)
        reply.code(400).send({ error: 'player1 and player2 are required' });
    // Insère la nouvelle partie dans la base
    //db.prepare : Cette méthode prépare une requête SQL pour l'exécution(run).
    const info = db_1.default.prepare('INSERT INTO games (player1, player2, score) VALUES (?, ?, ?)').run(body.player1, body.player2, '0-0');
    // Récupère la partie créée (avec son id auto-incrémenté)
    const newGame = {
        id: info.lastInsertRowid, // Utilise l'identifiant de la dernière ligne insérée
        player1: body.player1, //  Initialisation de player avec le contenu du body qui peut etre undifined (null)
        player2: body.player2, //donc mettre !(opérateur de non-null assertion) indique a TS que la var nest pas null ou dire que cest une string
        score: '0-0'
    };
    // Envoyer une réponse avec le nouveau jeu créé
    return reply.code(202).send(newGame);
});
//Route pour récupérer tous les parties
app.get('/games', (request, reply) => {
    //prepare une requSQL qui va select toute * les colonne de la Table games de la db
    const games = db_1.default.prepare('SELECT * FROM games').all(); //.all()execute la requ sous forme de tableau d'onjet JS
    reply.send(games);
});
//Route pour récupérer une partie
app.get('/games/:id', (request, reply) => {
    // 1. Récupère l'id depuis l'URL (c'est une string, donc on convertit en nombre)
    const id = Number(request.params.id);
    if (isNaN(id))
        return reply.code(400).send({ error: 'Invalid game id' });
    // 2. Prepare une requete SQL qui va selectionner toute les colonnes de la table games ou la colonne id correspond a une valeur voulu (?)ce param sera rempalcer par id lors de lexec de .get(id)
    const game = db_1.default.prepare('SELECT * FROM games WHERE id = ?').get(id);
    // 3. Si aucune partie trouvée, on renvoie une erreur 404
    if (!game)
        return (reply.code(404).send({ error: 'Game not found' }));
    // 4. Sinon, on renvoie la partie trouvée
    return (reply.send(game));
});
//PATCH le score
app.patch('/games/:id', (request, reply) => {
    //1. Recuperer l'id;
    const id = Number(request.params.id);
    //2. Recuperer le nouveau score dans le body
    const body = request.body;
    const newScore = body.score;
    //3. Verification de ce qu'on recupere
    if (!newScore)
        return reply.code(400).send({ error: 'score is required' });
    if (isNaN(id))
        return reply.code(400).send({ error: 'Invalid game id' });
    //5. Verifie que la partie existe
    const game = db_1.default.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game)
        reply.code(404).send({ error: 'Game not found' });
    //6. Mise a jour du score dans la db
    db_1.default.prepare('UPDATE games SET score = ? WHERE id = ?').run(newScore, id);
    //7. Renvoyer la partie update
    return reply.send(db_1.default.prepare('SELECT * FROM games WHERE id = ?').get(id));
});
//Suppression dune game
app.delete('/games/:id', (request, reply) => {
    //1. Recuperer l'id de la partie puis le verifier
    const id = Number(request.params.id);
    if (isNaN(id))
        return reply.code(400).send({ error: 'Invalid game id' });
    //2. Recuperer la partie puis verifier quelle existe
    const game = db_1.default.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game)
        reply.code(400).send({ error: 'Game not found' });
    //4. Supprimer la partie de la base
    db_1.default.prepare('DELETE FROM games WHERE id = ?').run(id);
    //5. Repondre avec un message de succès
    return reply.send({ message: 'Game deleted successfully', deleted: game });
});
//Reinitialisation de l'etat du jeu
app.post('/pong/init', (request, reply) => {
    gameState = (0, gameState_1.createInitialGameState)();
    return reply.send(gameState);
});
app.post('/pong/start', (request, reply) => {
    gameState.running = true;
});
//Recuperer l'etat actuelle du jeu
app.get('/pong/state', (request, reply) => {
    return reply.send(gameState);
});
app.post('/pong/move', (request, reply) => {
    //const player = request.body.player;
    //const direction = request.body.direction;
    // on peut le faire en une ligne avec une déstructuration d’objet
    const { player, direction } = request.body;
    const speed = gameState.paddleSpeed;
    if (player === 'left') {
        if (direction === 'up' && gameState.leftPaddleY > 0)
            gameState.leftPaddleY -= speed;
        if (direction === 'down' && gameState.leftPaddleY + gameState.paddleHeight < gameState.canvasHeight)
            gameState.leftPaddleY += speed;
    }
    else if (player === 'right') {
        if (direction === 'up' && gameState.rightPaddleY > 0)
            gameState.rightPaddleY -= speed;
        if (direction === 'down' && gameState.rightPaddleY + gameState.paddleHeight < gameState.canvasHeight)
            gameState.rightPaddleY += speed;
    }
    return reply.send(gameState);
});
/*************Fonction **************************************/
//Game loop --> setInterval(() => {code à exécuter toute les -> }, 16ms);
setInterval(() => {
    if (!gameState.running)
        return;
    const paddleCollisionSurface = gameState.paddleMargin + gameState.paddleWidth;
    //1 Init la vitesse de la balle
    gameState.ballX += gameState.ballSpeedX;
    gameState.ballY += gameState.ballSpeedY;
    //2. Colision avec les bords (haut et bas) --> inversion de la vitesse sur laxe Y
    if (gameState.ballY - gameState.ballRadius <= 0 ||
        gameState.ballY + gameState.ballRadius >= gameState.canvasHeight)
        gameState.ballSpeedY = -gameState.ballSpeedY; //(* -1)
    //3. Collision avec les paddles
    //RIGHT
    if ((gameState.ballY + gameState.ballRadius >= gameState.rightPaddleY) &&
        (gameState.ballY - gameState.ballRadius <= gameState.rightPaddleY + gameState.paddleHeight) &&
        (gameState.ballX + gameState.ballRadius >= gameState.canvasWidth - paddleCollisionSurface))
        gameState.ballSpeedX = -gameState.ballSpeedX;
    //LEFT
    if ((gameState.ballY + gameState.ballRadius >= gameState.leftPaddleY) &&
        (gameState.ballY - gameState.ballRadius <= gameState.leftPaddleY + gameState.paddleHeight) &&
        (gameState.ballX - gameState.ballRadius <= paddleCollisionSurface))
        gameState.ballSpeedX = -gameState.ballSpeedX;
    //4. But marqué (gauche, droite)
    //Sortie droite -> but gauche
    if (gameState.ballX - gameState.ballRadius >= gameState.canvasWidth) {
        gameState.leftScore++;
        gameState.ballX = gameState.canvasWidth / 2;
        gameState.ballY = gameState.canvasHeight / 2;
    }
    //Sortie gauche -> but droit
    if (gameState.ballX + gameState.ballRadius <= 0) {
        gameState.rightScore++;
        gameState.ballX = gameState.canvasWidth / 2;
        gameState.ballY = gameState.canvasHeight / 2;
    }
    //5. Verification de la win
    if (gameState.leftScore == gameState.win || gameState.rightScore == gameState.win)
        gameState.running = false;
}, 16); //toutes les 16ms = 60FPS (frames per second)
// Fonction main asynchrone pour tout lancer
(async () => {
    // Enregistre le plugin CORS pour Fastify
    await app.register(cors_1.default, {
        origin: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://localhost:3000",
            "https://127.0.0.1:3000"
        ],
        credentials: true
    });
    app.register(rooms_1.default);
    app.addHook('preHandler', (req, _reply, done) => {
        if (req.url.startsWith('/rooms') && req.method === 'POST') {
            app.log.info('POST /rooms body:', req.body);
        }
        done();
    });
    const address = await app.listen({ port: 8080, host: '0.0.0.0' });
    app.log.info(`✅ Serveur lancé sur ${address}`);
})();
