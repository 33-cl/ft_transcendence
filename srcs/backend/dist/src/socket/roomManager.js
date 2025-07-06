// record c'est un type typescript qui permet de creer un objet avec des cles dynamiques
// on utilise un objet pour stocker les rooms, ou la cle est le nom de la room et la valeur est un objet room
export const rooms = {};
export let roomCounter = 1;
// Helper: vérifier si une room existe
export function roomExists(roomName) {
    // retourne true si la room existe, false sinon
    // le !! permet de convertir la valeur en boolean (! convertit en boolean, puis ! le re-inverse(le true devient false et vice versa))
    return !!rooms[roomName];
}
// Helper: ajouter un joueur à une room existante
export function addPlayerToRoom(roomName, socketId) {
    if (rooms[roomName]
        && !rooms[roomName].players.includes(socketId)
        && rooms[roomName].players.length < rooms[roomName].maxPlayers) {
        rooms[roomName].players.push(socketId);
        return true;
    }
    return false;
}
// Retirer le joueur de sa room
export function removePlayerFromRoom(socketId) {
    let playerRoom = null;
    for (const roomName in rooms) {
        if (rooms[roomName].players.includes(socketId)) {
            playerRoom = roomName;
            break;
        }
    }
    if (playerRoom) {
        rooms[playerRoom].players = rooms[playerRoom].players.filter(id => id !== socketId);
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
// Utilitaire: générer le nom d'une nouvelle room
export function getNextRoomName() {
    return `room${roomCounter++}`;
}
