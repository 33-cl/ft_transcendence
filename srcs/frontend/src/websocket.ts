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
let joinInProgress = false;
let lastJoinPromise: Promise<void> | null = null;

// Met à jour la room courante quand on reçoit la confirmation du backend
socket.on('roomJoined', (data: any) => {
    if (data && data.room) {
        currentRoom = data.room;
        joinInProgress = false;
        console.log('Room rejointe:', currentRoom);
    }
});

// Fonction pour rejoindre ou créer automatiquement une room de n joueurs
// Version simplifiée : le frontend demande juste au backend, qui gère tout
async function joinOrCreateRoom(maxPlayers: number) {
    return new Promise<void>((resolve) => {
        // On écoute la réponse du backend (room rejointe ou erreur)
        const handler = (data: any) => {
            if (data && data.room) {
                currentRoom = data.room;
                console.log('Room rejointe:', currentRoom);
            } else if (data && data.error) {
                console.error('Erreur lors du join:', data.error);
            }
            socket.off('roomJoined', handler);
            socket.off('error', handler);
            resolve();
        };
        socket.once('roomJoined', handler);
        socket.once('error', handler);
        // On demande au backend de nous placer dans une room du bon type
        socket.emit('joinRoom', { maxPlayers });
    });
}
// Expose la fonction pour test dans la console navigateur
window.joinOrCreateRoom = joinOrCreateRoom;

