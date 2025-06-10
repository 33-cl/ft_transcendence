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
let currentRoom = null;
let joinInProgress = false;
let lastJoinPromise = null;
// Met à jour la room courante quand on reçoit la confirmation du backend
socket.on('roomJoined', (data) => {
    if (data && data.room) {
        currentRoom = data.room;
        joinInProgress = false;
        console.log('Room rejointe:', currentRoom);
    }
});
// Fonction pour rejoindre ou créer automatiquement une room de n joueurs
async function joinOrCreateRoom(maxPlayers) {
    if (joinInProgress) {
        if (lastJoinPromise)
            await lastJoinPromise;
        else
            return;
    }
    joinInProgress = true;
    let joinRoomName = null;
    let joinRoomResult = null;
    lastJoinPromise = (async () => {
        try {
            // Synchronise la room réelle côté backend en cherchant le socket.id dans toutes les rooms
            const resRooms = await fetch('http://localhost:8080/rooms');
            const dataRooms = await resRooms.json();
            const mySocketId = socket.id;
            let myRoom = null;
            for (const [name, room] of Object.entries(dataRooms.rooms)) {
                const r = room;
                if (r.players.includes(mySocketId)) {
                    myRoom = name;
                    break;
                }
            }
            // Si déjà dans une room non pleine du bon type, ne rien faire (FRONTEND GUARD)
            if (myRoom) {
                const room = dataRooms.rooms[myRoom];
                if (room.maxPlayers === maxPlayers && room.players.length < maxPlayers) {
                    currentRoom = myRoom;
                    console.log(`[FRONTEND GUARD] Déjà dans une room ${maxPlayers} joueurs non pleine (backend):`, myRoom);
                    joinInProgress = false;
                    lastJoinPromise = null;
                    return;
                }
            }
            // 1. Cherche une room non pleine du bon type
            let roomName = null;
            for (const [name, room] of Object.entries(dataRooms.rooms)) {
                const r = room;
                if (r.maxPlayers === maxPlayers && r.players.length < maxPlayers) {
                    roomName = name;
                    break;
                }
            }
            // 2. Si aucune room dispo, en crée une
            if (!roomName) {
                const res2 = await fetch('http://localhost:8080/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ maxPlayers })
                });
                const data2 = await res2.json();
                roomName = data2.roomName;
                // Ajout du print pour debug : taille de la room créée
                console.log(`[DEBUG] Room créée côté backend : ${roomName}, maxPlayers = ${data2.maxPlayers}`);
                // Vérification active que la room existe bien côté backend avant de join
                let found = false;
                for (let i = 0; i < 5; i++) { // 5 tentatives max
                    const check = await fetch('http://localhost:8080/rooms');
                    const checkData = await check.json();
                    if (checkData.rooms[roomName]) {
                        found = true;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 30)); // attend 30ms
                }
                if (!found) {
                    console.error("Room nouvellement créée introuvable côté backend, abandon du joinRoom.");
                    return;
                }
            }
            joinRoomName = roomName;
            // 3. Rejoint la room trouvée ou créée, avec retry si besoin
            let joined = false;
            let backendRoomReturned = null;
            for (let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 30)); // attend 30ms
                const joinPromise = new Promise((resolve) => {
                    const handler = (data) => {
                        // Toujours synchroniser currentRoom avec la room retournée par le backend
                        if (data && data.room) {
                            currentRoom = data.room;
                            joinRoomResult = data.room;
                            backendRoomReturned = data.room;
                            joined = (data.room === joinRoomName);
                            if (!joined) {
                                console.warn('[FRONTEND GUARD] Le backend a renvoyé une autre room que demandée. Arrêt des tentatives. Room backend:', data.room, 'Room demandée:', joinRoomName);
                            }
                            socket.off('roomJoined', handler);
                            socket.off('error', handler);
                            resolve();
                        }
                        else if (data && data.error === 'Room does not exist') {
                            socket.off('roomJoined', handler);
                            socket.off('error', handler);
                            resolve();
                        }
                    };
                    socket.once('roomJoined', handler);
                    socket.once('error', handler);
                });
                socket.emit('joinRoom', { roomName });
                await joinPromise;
                if (joined || backendRoomReturned)
                    break;
            }
            // Si le backend a renvoyé une autre room, on arrête tout
            if (backendRoomReturned && backendRoomReturned !== joinRoomName) {
                currentRoom = backendRoomReturned;
                joinInProgress = false;
                lastJoinPromise = null;
                return;
            }
            if (!joined) {
                if (joinRoomResult) {
                    currentRoom = joinRoomResult;
                    console.log('Room réelle côté backend après join:', currentRoom);
                }
                else {
                    console.error('Impossible de rejoindre la room après plusieurs tentatives.');
                }
            }
        }
        finally {
            joinInProgress = false;
            lastJoinPromise = null;
        }
    })();
    await lastJoinPromise;
}
// Expose la fonction pour test dans la console navigateur
window.joinOrCreateRoom = joinOrCreateRoom;
//# sourceMappingURL=websocket.js.map