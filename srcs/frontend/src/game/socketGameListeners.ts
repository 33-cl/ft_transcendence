import { load } from '../navigation/utils.js';
import { draw } from './pongRenderer.js';
import { cleanupGameState } from './gameCleanup.js';
import
{
    socket,
    gameFinishedListenerActive,
    tournamentSemifinalFinishedListenerActive,
    tournamentFinalFinishedListenerActive,
    setGameFinishedListenerActive,
    setTournamentSemifinalFinishedListenerActive,
    setTournamentFinalFinishedListenerActive
} from './socketConnection.js';

let gameStateListenerActive = false;
let disconnectListenerActive = false;
let leftRoomListenerActive = false;
let spectatorGameFinishedListenerActive = false;

export function cleanupGameEventListeners()
{
    if (gameStateListenerActive)
    {
        socket.removeAllListeners('gameState');
        gameStateListenerActive = false;
    }
    if (disconnectListenerActive)
    {
        socket.removeAllListeners('disconnect');
        disconnectListenerActive = false;
    }
    if (leftRoomListenerActive)
    {
        socket.removeAllListeners('leftRoom');
        leftRoomListenerActive = false;
    }
    if (gameFinishedListenerActive)
    {
        socket.removeAllListeners('gameFinished');
        setGameFinishedListenerActive(false);
    }
    if (tournamentSemifinalFinishedListenerActive)
    {
        socket.removeAllListeners('tournamentSemifinalFinished');
        setTournamentSemifinalFinishedListenerActive(false);
    }
    if (tournamentFinalFinishedListenerActive)
    {
        socket.removeAllListeners('tournamentFinalFinished');
        setTournamentFinalFinishedListenerActive(false);
    }
    if (spectatorGameFinishedListenerActive)
    {
        socket.removeAllListeners('spectatorGameFinished');
        spectatorGameFinishedListenerActive = false;
    }
    
    if (typeof window.resumeBackground === 'function')
        window.resumeBackground();
}

export function setupGameEventListeners()
{
    cleanupGameEventListeners();
    
    if (!gameStateListenerActive)
    {
        socket.on('gameState', (state: any) =>
        {
            if (typeof window.addGameState === 'function')
            {
                window.addGameState(state);
                
                if (typeof window.startRenderLoop === 'function')
                    window.startRenderLoop();
            }
            else
                draw(state);
        });
        gameStateListenerActive = true;
    }

    if (!disconnectListenerActive)
    {
        socket.on('disconnect', () =>
        {
            cleanupGameState();
            cleanupGameEventListeners();
        });
        disconnectListenerActive = true;
    }

    if (!leftRoomListenerActive)
    {
        socket.on('leftRoom', () =>
        {
            cleanupGameState();
        });
        leftRoomListenerActive = true;
    }

    if (!gameFinishedListenerActive)
    {
        socket.on('gameFinished', (data: any) =>
        {
            setGameFinishedListenerActive(true);

            if (window.isNavigatingAwayFromGame)
            {
                window.isNavigatingAwayFromGame = false;
                return;
            }

            setTimeout(() =>
            {
                load('gameFinished', data || {});
            }, 100);
        });
    }
    
    if (!tournamentSemifinalFinishedListenerActive)
    {
        socket.on('tournamentSemifinalFinished', (data: any) =>
        {
            setTournamentSemifinalFinishedListenerActive(true);
            window.isNavigatingAwayFromGame = false;
            cleanupGameState();
            load('tournamentSemifinalFinished', data);
        });
    }
    
    if (!tournamentFinalFinishedListenerActive)
    {
        socket.on('tournamentFinalFinished', (data: any) =>
        {
            setTournamentFinalFinishedListenerActive(true);
            window.isNavigatingAwayFromGame = false;
            cleanupGameState();
            load('tournamentFinalFinished', data);
        });
    }
    
    if (!spectatorGameFinishedListenerActive)
    {
        socket.on('spectatorGameFinished', (data: any) =>
        {
            spectatorGameFinishedListenerActive = true;
            
            if (window.isNavigatingAwayFromGame)
            {
                window.isNavigatingAwayFromGame = false;
                return;
            }
            
            const currentPath = window.location.pathname;
            if (!currentPath.includes('spectate'))
                return;
            
            cleanupGameState();
            
            setTimeout(() =>
            {
                load('spectatorGameFinished', data);
            }, 100);
        });
    }
}

window.cleanupGameEventListeners = cleanupGameEventListeners;
window.setupGameEventListeners = setupGameEventListeners;
