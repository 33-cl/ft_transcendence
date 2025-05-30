// websocket.ts
//'io' est déjà disponible dans la page via le CDN socket.io-clients

declare var io: any;

const socket = io("http://localhost:3000");

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
socket.on("pong", (data: any) => {
	// Affiche le contenu du message reçu dans la console
	console.log("Message reçu du serveur:", data);
});

// Rend la fonction sendPing accessible depuis la console du navigateur
// Tu peux taper sendPing() dans la console pour tester l'envoi d'un message
(window as any).sendPing = sendPing;
