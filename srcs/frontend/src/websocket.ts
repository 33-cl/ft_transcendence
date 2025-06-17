// websocket.ts
//'io' est déjà disponible dans la page via le CDN socket.io-clients

declare var io: any;

// Connexion socket.io sur le même domaine
const socket = io('', { transports: ["websocket"], secure: true }); // Connexion sur le même domaine

// Quand la connexion avec le serveur est établie, ce code s'exécute
socket.on("connect", () => {
    // Affiche l'identifiant unique de la connexion dans la console
    console.log("Connecté au serveur WebSocket avec l'id:", socket.id);
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

// Handler pour les messages relayés par le serveur (socket.io)
socket.on('message', (data: any) =>
{
    let message;
    try {
        message = typeof data === "string" ? JSON.parse(data) : data;
    } catch (e) {
        console.error('Message non JSON:', data);
        return;
    }
    handleWebSocketMessage(message);
});

function handleWebSocketMessage(message: { type: MessageType, data: MessageData })
{
	console.log("Message reçu du serveur:", message);
    switch (message.type)
	{
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

let currentRoom: string | null = null;

// Handler global supprimé définitivement pour éviter tout effet de bord

let joinInProgress = false;

// Fonction pour rejoindre ou créer une room de n joueurs (workflow 100% backend)
async function joinOrCreateRoom(maxPlayers: number) {
    if (joinInProgress) return;
    joinInProgress = true;
    try {
        return new Promise<void>((resolve) => {
            const handler = (data: any) => {
                if (data && data.room) {
                    currentRoom = data.room;
                } else if (data && data.error) {
                    console.error('Erreur lors du joinRoom:', data.error);
                }
                socket.off('roomJoined', handler);
                socket.off('error', handler);
                resolve();
            };
            socket.once('roomJoined', handler);
            socket.once('error', handler);
            socket.emit('joinRoom', { maxPlayers });
        });
    } finally {
        joinInProgress = false;
    }
}
// Expose la fonction pour test dans la console navigateur
window.joinOrCreateRoom = joinOrCreateRoom;

