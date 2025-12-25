declare var io: any;

import { installSocketGuard } from '../navigation/securityGuard.js';

let socket = io('',
{ 
    transports: ["websocket"], 
    secure: true,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});
window.socket = socket;

installSocketGuard();

export let connectListenerSet = false;
export let roomJoinedListenerSet = false;
export let disconnectBasicListenerSet = false;
export let pongListenerSet = false;
export let errorListenerSet = false;
export let gameFinishedListenerActive = false;
export let tournamentSemifinalFinishedListenerActive = false;
export let tournamentFinalFinishedListenerActive = false;
export let leaderboardUpdatedListenerSet = false;
export let tournamentListenersSet = false;
export let otherSemifinalUpdateListenerSet = false;

export function resetListenerFlags()
{
    connectListenerSet = false;
    roomJoinedListenerSet = false;
    disconnectBasicListenerSet = false;
    pongListenerSet = false;
    errorListenerSet = false;
    leaderboardUpdatedListenerSet = false;
    otherSemifinalUpdateListenerSet = false;
}

export function setConnectListenerSet(value: boolean) { connectListenerSet = value; }
export function setRoomJoinedListenerSet(value: boolean) { roomJoinedListenerSet = value; }
export function setDisconnectBasicListenerSet(value: boolean) { disconnectBasicListenerSet = value; }
export function setPongListenerSet(value: boolean) { pongListenerSet = value; }
export function setErrorListenerSet(value: boolean) { errorListenerSet = value; }
export function setGameFinishedListenerActive(value: boolean) { gameFinishedListenerActive = value; }
export function setTournamentSemifinalFinishedListenerActive(value: boolean) { tournamentSemifinalFinishedListenerActive = value; }
export function setTournamentFinalFinishedListenerActive(value: boolean) { tournamentFinalFinishedListenerActive = value; }
export function setLeaderboardUpdatedListenerSet(value: boolean) { leaderboardUpdatedListenerSet = value; }
export function setTournamentListenersSet(value: boolean) { tournamentListenersSet = value; }
export function setOtherSemifinalUpdateListenerSet(value: boolean) { otherSemifinalUpdateListenerSet = value; }

type MessageType = 'move' | 'score' | string;

interface MessageData
{
    [key: string]: any;
}

function sendPing()
{
    socket.emit("ping", { message: "Hello server!" });
}

function sendMessage(type: MessageType, data: MessageData)
{
    const msg = JSON.stringify({ type, data });
    socket.emit('message', msg);
}

export function reconnectWebSocket(setupGlobalSocketListeners: () => void)
{
    if (socket && socket.connected)
    {
        socket.removeAllListeners();
        socket.disconnect();
    }
    
    setTimeout(() =>
    {
        socket = io('',
        { 
            transports: ["websocket"], 
            secure: true,
            withCredentials: true,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        
        window.socket = socket;
        installSocketGuard();
        resetListenerFlags();
        setupGlobalSocketListeners();
    }, 100);
}

window.sendPing = sendPing;
window.sendMessage = sendMessage;

export { socket };
