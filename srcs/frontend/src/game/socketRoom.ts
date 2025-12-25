import { socket } from './socketConnection.js';

let joinInProgress = false;
let lastJoinAttempt = 0;
const JOIN_DEBOUNCE_MS = 1000;

// Sends joinRoom request to server (server decides to join existing or create new room)
export async function requestJoinRoom(maxPlayers: number, isLocalGame: boolean = false)
{
    const now = Date.now();
    
    if (now - lastJoinAttempt < JOIN_DEBOUNCE_MS)
        return;
    
    if (joinInProgress)
        return;
    
    lastJoinAttempt = now;
    joinInProgress = true;
    
    window.setIsLocalGame(isLocalGame);
    
    return new Promise<void>((resolve, reject) =>
    {
        const cleanup = () =>
        {
            joinInProgress = false;
            socket.off('error', failure);
        };
        const failure = () =>
        {
            cleanup();
            reject(new Error("Error during joinRoom"));
        };
        socket.once('error', failure);
        
        const roomData: any = { maxPlayers, isLocalGame };
        
        if (window.aiMode)
        {
            roomData.enableAI = true;
            roomData.aiDifficulty = window.aiDifficulty || 'medium';
        }
        
        if (window.isTournamentMode)
            roomData.isTournament = true;
        
        socket.emit('joinRoom', roomData);
        cleanup();
        resolve();
    });
}

export async function leaveCurrentRoomAsync(): Promise<void>
{
    return new Promise<void>((resolve) =>
    {
        if (!socket || !socket.connected)
        {
            resolve();
            return;
        }
        
        socket.once('leaveAllRoomsComplete', () =>
        {
            resolve();
        });
        
        const fallbackTimeout = setTimeout(() =>
        {
            resolve();
        }, 3000);
        
        socket.once('leaveAllRoomsComplete', () =>
        {
            clearTimeout(fallbackTimeout);
        });
        
        socket.emit('leaveAllRooms');
    });
}

window.leaveCurrentRoomAsync = leaveCurrentRoomAsync;
window.joinOrCreateRoom = requestJoinRoom;
