"use strict";
// server.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
// 1. On importe Fastify
const app = (0, fastify_1.default)({ logger: true });
// Création du serveur HTTP à partir de Fastify
const server = http_1.default.createServer(app.server);
// Configuration de socket.io avec CORS
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://127.0.0.1:5500", //5500 car c'est ce qui est utilise par live server
        methods: ["GET", "POST"]
    }
});
// Import des handlers socket.io + les executes 
const socketHandlers_1 = __importDefault(require("./src/socket/socketHandlers"));
(0, socketHandlers_1.default)(io, app);
// 2. Une route GET très simple
app.get('/', (request, reply) => __awaiter(void 0, void 0, void 0, function* () {
    return { message: 'Bienvenue sur ft_transcendence backend' };
}));
//Enregistre la route depuis un fichier externe
const ping_1 = __importDefault(require("./src/routes/ping"));
const users_1 = __importDefault(require("./src/routes/users"));
app.register(ping_1.default);
app.register(users_1.default);
// Lancement du serveur HTTP (Fastify + socket.io)
server.listen(3000, () => {
    app.log.info(`✅ Serveur lancé sur http://localhost:3000`);
});
