"use strict";
// src/socket/roomManager.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomCounter = exports.rooms = void 0;
exports.roomExists = roomExists;
exports.addPlayerToRoom = addPlayerToRoom;
exports.removePlayerFromRoom = removePlayerFromRoom;
exports.getPlayerRoom = getPlayerRoom;
exports.getRoomMaxPlayers = getRoomMaxPlayers;
// record c'est un type typescript qui permet de creer un objet avec des cles dynamiques
// on utilise un objet pour stocker les rooms, ou la cle est le nom de la room et la valeur est un objet room
exports.rooms = {};
exports.roomCounter = 1;
// Helper: vérifier si une room existe
function roomExists(roomName) {
    return !!exports.rooms[roomName];
}
// Helper: ajouter un joueur à une room existante
function addPlayerToRoom(roomName, socketId) {
    if (exports.rooms[roomName]
        && !exports.rooms[roomName].players.includes(socketId)
        && exports.rooms[roomName].players.length < exports.rooms[roomName].maxPlayers) {
        exports.rooms[roomName].players.push(socketId);
        return true;
    }
    return false;
}
// Retirer le joueur de sa room
function removePlayerFromRoom(socketId) {
    let playerRoom = null;
    for (const roomName in exports.rooms) {
        if (exports.rooms[roomName].players.includes(socketId)) {
            playerRoom = roomName;
            break;
        }
    }
    if (playerRoom) {
        exports.rooms[playerRoom].players = exports.rooms[playerRoom].players.filter(id => id !== socketId);
        if (exports.rooms[playerRoom].players.length === 0) {
            delete exports.rooms[playerRoom];
        }
    }
}
// Helper: récupérer la room d'un joueur
function getPlayerRoom(socketId) {
    for (const roomName in exports.rooms) {
        if (exports.rooms[roomName].players.includes(socketId)) {
            return roomName;
        }
    }
    return null;
}
// Helper: récupérer la capacité max d'une room
function getRoomMaxPlayers(roomName) {
    // retourne le nombre maximum de joueurs pour une room donnee
    // si la room n existe pas, retourne null
    return exports.rooms[roomName]?.maxPlayers ?? null;
}
