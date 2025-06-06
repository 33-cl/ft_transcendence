// src/socket/roomManager.ts
// record c'est un type typescript qui permet de creer un objet avec des cles dynamiques
// on utilise un objet pour stocker les rooms, ou la cle est le nom de la room et la valeur est un objet room
export const rooms = {};
export let roomCounter = 1;
// Helper: vérifier si une room existe
export function roomExists(roomName) {
    return !!rooms[roomName];
}
// Helper: ajouter un joueur à une room existante
export function addPlayerToRoom(roomName, socketId, log) {
    if (rooms[roomName] && !rooms[roomName].players.includes(socketId)) {
        rooms[roomName].players.push(socketId);
        log(`Joueur ${socketId} ajouté à la room ${roomName}`);
        return true;
    }
    return false;
}
// Retirer le joueur de sa room
export function removePlayerFromRoom(socketId, log) {
    let playerRoom = null;
    for (const roomName in rooms) {
        if (rooms[roomName].players.includes(socketId)) {
            playerRoom = roomName;
            break;
        }
    }
    if (playerRoom) {
        rooms[playerRoom].players = rooms[playerRoom].players.filter(id => id !== socketId);
        log(`Joueur ${socketId} quitte la room ${playerRoom}`);
        if (rooms[playerRoom].players.length === 0) {
            delete rooms[playerRoom];
        }
    }
}
// Helper: récupérer la room d'un joueur
export function getPlayerRoom(socketId) {
    for (const roomName in rooms) {
        if (rooms[roomName].players.includes(socketId)) {
            return roomName;
        }
    }
    return null;
}
// Helper: récupérer la capacité max d'une room
export function getRoomMaxPlayers(roomName) {
    // retourne le nombre maximum de joueurs pour une room donnee
    // si la room n existe pas, retourne null
    return rooms[roomName]?.maxPlayers ?? null;
}
