"use strict";
// websocket.ts
//'io' est déjà disponible dans la page via le CDN socket.io-clients
const socket = io("http://localhost:8080"); // Port backend (socket.io) selon docker-compose.yml et exigences 42
// Quand la connexion avec le serveur est établie, ce code s'exécute
socket.on("connect", () => {
    // Affiche l'identifiant unique de la connexion dans la console
    console.log("Connecté au serveur WebSocket avec l'id:", socket.id);
});
// Fonction pour envoyer un message "ping" au serveur
function sendPing() {
    // Envoie un message nommé "ping" avec un objet au serveur
    socket.emit("ping", { message: "Hello serveur!" });
}
// Écoute les messages nommés "pong" envoyés par le serveur
socket.on("pong", (data) => {
    // Affiche le contenu du message reçu dans la console
    console.log("Message reçu du serveur:", data);
});
// Rend la fonction sendPing accessible depuis la console du navigateur
// Tu peux taper sendPing() dans la console pour tester l'envoi d'un message
window.sendPing = sendPing;
function sendMessage(type, data) {
    const msg = JSON.stringify({ type, data }); // Convertit l'objet en chaîne JSON
    socket.send(msg);
}
// Handler pour les messages relayés par le serveur (socket.io)
socket.on('message', (data) => {
    let message;
    try {
        message = typeof data === "string" ? JSON.parse(data) : data;
    }
    catch (e) {
        console.error('Message non JSON:', data);
        return;
    }
    handleWebSocketMessage(message);
});
function handleWebSocketMessage(message) {
    console.log("Message reçu du serveur:", message);
    switch (message.type) {
        case 'move':
            // Traiter le mouvement reçu
            // Exemple: updatePaddlePosition(message.data)
            break;
        case 'score':
            // Traiter la mise à jour du score
            break;
        // Ajouter d'autres types de messages ici
        default:
            console.warn('Type de message inconnu:', message.type);
    }
}
