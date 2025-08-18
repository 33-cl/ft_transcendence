// websocket.ts
//'io' est déjà disponible dans la page via le CDN socket.io-clients

declare var io: any;

// Connexion socket.io sur le même domaine
const socket = io('', { transports: ["websocket"], secure: true });
(window as any).socket = socket;

// Variables pour éviter la duplication d'event listeners globaux
let connectListenerSet = false;
let roomJoinedListenerSet = false;
let disconnectBasicListenerSet = false;
let pongListenerSet = false;

// Fonction pour configurer les event listeners globaux (une seule fois)
function setupGlobalSocketListeners() {
    // Event listener connect
    if (!connectListenerSet) {
        socket.on("connect", () => {
            // Connexion établie
        });
        connectListenerSet = true;
    }
    
    // Event listener roomJoined
    if (!roomJoinedListenerSet) {
    socket.on('roomJoined', (data: any) => {
        if (data && data.paddle) {
            window.controlledPaddle = data.paddle;
        } else {
            window.controlledPaddle = null;
        }
        if (data && data.maxPlayers) {
            (window as any).maxPlayers = data.maxPlayers;
        }
        document.dispatchEvent(new Event('roomJoined'));
    });
        roomJoinedListenerSet = true;
    }
    
    // Event listener disconnect basique
    if (!disconnectBasicListenerSet) {
        socket.on('disconnect', () => {
            window.controlledPaddle = null;
        });
        disconnectBasicListenerSet = true;
    }
    
    // Event listener pong
    if (!pongListenerSet) {
        socket.on("pong", () => {
            // Message reçu du serveur
        });
        pongListenerSet = true;
    }
}

// Configurer les listeners globaux au chargement
setupGlobalSocketListeners();


// Fonction pour envoyer un message "ping" au serveur
function sendPing()
{
	// Envoie un message nommé "ping" avec un objet au serveur
    socket.emit("ping", { message: "Hello serveur!" });
}

// Rend la fonction sendPing accessible depuis la console du navigateur
// Tu peux taper sendPing() dans la console pour tester l'envoi d'un message
window.sendPing = sendPing;



// Fonction pour envoyer un message structuré
// a terme, ne plus avoir string, afin d'avoid les merdes si on reçoit un message innatendu
type MessageType = 'move' | 'score' | string;

// Cette interface permet de créer un objet avec autant de propriétés que l'on souhaite.
// Chaque propriété (clé) doit être une chaîne de caractères, et sa valeur peut être de n'importe quel type.
// Exemple d'utilisation : { y: 120, player: "left" }
//remplacer le any plus tard par un type plus précis si possible
interface MessageData
{
    [key: string]: any;
}

// Fonction pour envoyer un message structuré (exposée pour usage externe)
function sendMessage(type: MessageType, data: MessageData)
{
    const msg = JSON.stringify({ type, data });// Convertit l'objet en chaîne JSON
    socket.emit('message', msg); // Utilise emit au lieu de send pour Socket.IO
}

// Expose la fonction pour test dans la console navigateur
window.sendMessage = sendMessage;

let joinInProgress = false;

// Fonction pour rejoindre ou créer une room de n joueurs (workflow 100% backend)
async function joinOrCreateRoom(maxPlayers: number, isLocalGame: boolean = false)
{
    if (joinInProgress) {
        return;
    }
    joinInProgress = true;
    
    (window as any).setIsLocalGame(isLocalGame);
    
    return new Promise<void>((resolve, reject) =>
    {
        const cleanup = () => {
            joinInProgress = false;
            socket.off('error', failure);
        };
        const failure = () => {
            cleanup();
            reject(new Error("Error during joinRoom"));
        };
        // On n'utilise plus 'once' sur roomJoined pour ne pas consommer l'event
        socket.once('error', failure);
        socket.emit('joinRoom', { maxPlayers, isLocalGame }); // <-- Ajout du flag
        // On considère la promesse résolue dès qu'on a émis la demande (le handler UX gère la suite)
        cleanup();
        resolve();
    });
}

// Expose la fonction pour test dans la console navigateur
window.joinOrCreateRoom = joinOrCreateRoom;

// Fonction pour définir le mode local
(window as any).setIsLocalGame = (isLocal: boolean) => {
    (window as any).isLocalGame = isLocal;
};

import { initPongRenderer, draw } from './pongRenderer.js';
import { cleanupGameState } from './gameCleanup.js';

// Initialisation du renderer Pong au chargement de la page jeu
function setupPongCanvas() {
    initPongRenderer('map');
}

document.addEventListener('componentsReady', () => {
    // Attendre un peu que le DOM soit vraiment prêt, puis vérifier le canvas
    setTimeout(() => {
        const mapCanvas = document.getElementById('map');
        if (mapCanvas) {
            setupPongCanvas();
            setupGameEventListeners();
        }
    }, 100);
});

// Variables pour éviter la duplication d'event listeners
let gameStateListenerActive = false;
let disconnectListenerActive = false;
let leftRoomListenerActive = false;

// Fonction pour nettoyer les event listeners du jeu
function cleanupGameEventListeners() {
    if (gameStateListenerActive) {
        socket.removeAllListeners('gameState');
        gameStateListenerActive = false;
    }
    if (disconnectListenerActive) {
        socket.removeAllListeners('disconnect');
        disconnectListenerActive = false;
    }
    if (leftRoomListenerActive) {
        socket.removeAllListeners('leftRoom');
        leftRoomListenerActive = false;
    }
}

// Fonction pour configurer les event listeners du jeu (une seule fois)
function setupGameEventListeners() {
    // Nettoyer d'abord les anciens listeners
    cleanupGameEventListeners();
    
    // Event listener pour les états de jeu
    if (!gameStateListenerActive) {
        socket.on('gameState', (state: any) => {
            draw(state);
        });
        gameStateListenerActive = true;
    }

    // Nettoyage lors de la déconnexion d'une room
    if (!disconnectListenerActive) {
        socket.on('disconnect', () => {
            cleanupGameState();
            cleanupGameEventListeners();
        });
        disconnectListenerActive = true;
    }

    // Nettoyage lors de la sortie d'une room
    if (!leftRoomListenerActive) {
        socket.on('leftRoom', () => {
            cleanupGameState();
        });
        leftRoomListenerActive = true;
    }
}

// Exposer les fonctions de cleanup globalement
(window as any).cleanupGameEventListeners = cleanupGameEventListeners;
(window as any).setupGameEventListeners = setupGameEventListeners;

// Suppression de sendMove et du keydown listener (déplacés dans pongControls.ts)
import './pongControls.js'; // Ajoute les contrôles clavier (modularité)
