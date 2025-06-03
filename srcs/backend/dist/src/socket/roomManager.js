// src/socket/roomManager.ts
// record c un type typescript qui permet de creer un objet avec des cles dynamiques
// on utilise un objet pour stocker les rooms, ou la cle est le nom de la room et la valeur est un objet room
const rooms = {};
// Compteur pour generer des noms de room qui leur sont propre
let roomCounter = 1;
export function findOrCreateRoom(maxPlayers, socketId, log) {
    //ne peut contenir qu'une str ou null, par default est a undefined et trigger !assignedRoom
    let assignedRoom = null;
    //itere sur les rooms existantes
    for (const roomName in rooms) {
        //cherche une room avec la capacitee demandee (2 ou 4)
        if (rooms[roomName].maxPlayers === maxPlayers && rooms[roomName].players.length < maxPlayers) {
            log(`Room trouvée : ${roomName} (max ${maxPlayers})`);
            assignedRoom = roomName;
            break;
        }
    }
    //aucune room existante ne repond a la demande, on en cree une nouvelle
    if (!assignedRoom) {
        //donne un nom unique a la nouvelle room
        assignedRoom = `room${roomCounter++}`;
        // on ajoute la nouvelle room a l'objet rooms
        rooms[assignedRoom] = { players: [], maxPlayers };
    }
    // ajoute le joueur a la room
    rooms[assignedRoom].players.push(socketId);
    return assignedRoom;
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
//export rend la fonction accessible par d'autres fichiers
//:string | null est le retour de la fct, une str ou null
export function getPlayerRoom(socketId) {
    for (const roomName in rooms) {
        if (rooms[roomName].players.includes(socketId)) {
            return roomName;
        }
    }
    return null;
}
export function getRoomMaxPlayers(roomName) {
    // retourne le nombre maximum de joueurs pour une room donnee
    // si la room n existe pas, retourne null
    return rooms[roomName]?.maxPlayers ?? null;
}
