// websocket.ts
//'io' est déjà disponible dans la page via le CDN socket.io-clients

declare var io: any;

// Connexion socket.io sur le même domaine
const socket = io('', { transports: ["websocket"], secure: true }); // Connexion sur le même domaine
(window as any).socket = socket;

// Quand la connexion avec le serveur est établie, ce code s'exécute
socket.on("connect", () => {
    console.log("[FRONT] Connecté au serveur WebSocket avec l'id:", socket.id);
});

// --- Ajout : écoute l'attribution du paddle lors du joinRoom ---
socket.on('roomJoined', (data: any) => {
    if (data && data.paddle) {
        window.controlledPaddle = data.paddle;
        console.log('[FRONT] Vous contrôlez le paddle :', data.paddle);
    } else {
        window.controlledPaddle = null;
        console.log('[FRONT] Pas de paddle attribué, controlledPaddle=null');
    }
    console.log('[FRONT] roomJoined event, controlledPaddle=', window.controlledPaddle);
    document.dispatchEvent(new Event('roomJoined'));
});

// Ajout : log lors de la déconnexion
socket.on('disconnect', () => {
    console.log('[FRONT] Déconnecté du serveur WebSocket');
    window.controlledPaddle = null;
    console.log('[FRONT] controlledPaddle reset à null (disconnect)');
});


// Fonction pour envoyer un message "ping" au serveur
function sendPing()
{
	// Envoie un message nommé "ping" avec un objet au serveur
    socket.emit("ping", { message: "Hello serveur!" });
}

// Écoute les messages nommés "pong" envoyés par le serveur
socket.on("pong", (data: any) =>
{
	// Affiche le contenu du message reçu dans la console
	console.log("Message reçu du serveur:", data);
});

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
    socket.send(msg);
}

// Expose la fonction pour test dans la console navigateur
window.sendMessage = sendMessage;

let joinInProgress = false;

// Fonction pour rejoindre ou créer une room de n joueurs (workflow 100% backend)
async function joinOrCreateRoom(maxPlayers: number)
{
    if (joinInProgress)
        return;
    joinInProgress = true;
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
        socket.emit('joinRoom', { maxPlayers });
        // On considère la promesse résolue dès qu'on a émis la demande (le handler UX gère la suite)
        cleanup();
        resolve();
    });
}

// Expose la fonction pour test dans la console navigateur
window.joinOrCreateRoom = joinOrCreateRoom;

import { initPongRenderer, draw } from './pongRenderer.js';

// Initialisation du renderer Pong au chargement de la page jeu
function setupPongCanvas() {
    initPongRenderer('map');
}

document.addEventListener('componentsReady', () => {
    // Si la page jeu est affichée, on initialise le renderer
    if (document.getElementById('map')) {
        setupPongCanvas();
    }
});

socket.on('gameState', (state: any) => {
    draw(state);
});

// Suppression de sendMove et du keydown listener (déplacés dans pongControls.ts)
import './pongControls.js'; // Ajoute les contrôles clavier (modularité)
