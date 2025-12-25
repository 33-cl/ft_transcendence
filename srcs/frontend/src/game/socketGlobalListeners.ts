import { load } from '../navigation/utils.js';
import { sessionDisconnectedHTML } from '../navigation/sessionDisconnected.html.js';
import { updateMatchmakingForTournament } from './matchmaking.html.js';
import { initPongRenderer } from './pongRenderer.js';
import
{
    socket,
    connectListenerSet,
    roomJoinedListenerSet,
    disconnectBasicListenerSet,
    pongListenerSet,
    errorListenerSet,
    leaderboardUpdatedListenerSet,
    setConnectListenerSet,
    setRoomJoinedListenerSet,
    setDisconnectBasicListenerSet,
    setPongListenerSet,
    setErrorListenerSet,
    setLeaderboardUpdatedListenerSet
} from './socketConnection.js';
import { setupTournamentListeners } from './socketTournamentListeners.js';

function showSessionDisconnectedOverlay(message: string)
{
    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
    if (existingOverlay)
        existingOverlay.remove();
    
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'sessionDisconnectedOverlay';
    overlayDiv.innerHTML = sessionDisconnectedHTML(message);
    
    document.body.appendChild(overlayDiv);
}

export function setupGlobalSocketListeners()
{
    if (!connectListenerSet)
    {
        socket.on("connect", () => {});
        setConnectListenerSet(true);
    }
    
    if (!roomJoinedListenerSet)
    {
        socket.on('roomJoined', (data: any) =>
        {
            if (data && data.paddle)
                window.controlledPaddle = data.paddle;
            else
                window.controlledPaddle = null;
            
            if (data && data.maxPlayers)
                window.maxPlayers = data.maxPlayers;
            
            if (data && typeof data.spectator === 'boolean')
                window.isSpectator = data.spectator;
            else
                window.isSpectator = false;
            
            if (window.updatePaddleKeyBindings)
                window.updatePaddleKeyBindings();
            
            if (window.isLocalGame)
            {
                if (data.maxPlayers === 4)
                    load('game4');
                else if (data.maxPlayers === 3)
                    load('game3');
                else
                    load('game');
                return;
            }
            
            if (window.isSpectator)
            {
                if (data.maxPlayers === 4)
                    load('spectate4');
                else if (data.maxPlayers === 3)
                    load('spectate');
                else
                    load('spectate');
                
                setTimeout(() =>
                {
                    const mapCanvas = document.getElementById('map');
                    if (mapCanvas)
                    {
                        if (typeof window.setupGameEventListeners === 'function')
                            window.setupGameEventListeners();
                        if (typeof window.initPongRenderer === 'function')
                            window.initPongRenderer('map');
                    }
                }, 200);
                return;
            }
            
            if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number')
            {
                if (data.players < data.maxPlayers)
                {
                    load('matchmaking');
                    if (window.isTournamentMode)
                    {
                        setTimeout(() =>
                        {
                            updateMatchmakingForTournament(data.players, data.maxPlayers);
                        }, 100);
                    }
                }
                else
                {
                    if (data.isTournament)
                    {
                        handleTournamentRoomJoined(data);
                    }
                    else if (data.maxPlayers === 4)
                    {
                        load('game4');
                        const waitForCanvasRotation = () =>
                        {
                            const mapCanvas = document.getElementById('map') as HTMLCanvasElement;
                            if (mapCanvas && typeof window.applyCanvasRotation === 'function')
                            {
                                window.applyCanvasRotation(window.controlledPaddle, 'map');
                                requestAnimationFrame(() =>
                                {
                                    requestAnimationFrame(() =>
                                    {
                                        mapCanvas.style.visibility = 'visible';
                                    });
                                });
                            }
                            else
                            {
                                setTimeout(waitForCanvasRotation, 20);
                            }
                        };
                        waitForCanvasRotation();
                    }
                    else if (data.maxPlayers === 3)
                        load('game3');
                    else
                        load('game');
                }
            }
        });
        setRoomJoinedListenerSet(true);
    }
    
    if (!disconnectBasicListenerSet)
    {
        socket.on('disconnect', () =>
        {
            window.controlledPaddle = null;
        });
        setDisconnectBasicListenerSet(true);
    }
    
    if (!pongListenerSet)
    {
        socket.on("pong", () => {});
        setPongListenerSet(true);
    }

    if (!errorListenerSet)
    {
        socket.on('error', (data: any) =>
        {
            if (data && data.code === 'JOIN_IN_PROGRESS')
                return;

            if (data && data.code === 'TOURNAMENT_ISOLATION')
            {
                alert(data.error || 'You cannot join online games while in an active tournament.');
                return;
            }
            
            if (data && data.code === 'USER_ALREADY_CONNECTED')
            {
                import('../navigation/sessionBroadcast.js').then(({ isSessionBlocked }) =>
                {
                    const alreadyBlocked = isSessionBlocked();
                    const overlayExists = document.getElementById('sessionDisconnectedOverlay');
                    
                    if (alreadyBlocked || overlayExists)
                    {
                        socket.disconnect();
                        return;
                    }
                    
                    if (window.stopFriendListAutoRefresh)
                        window.stopFriendListAutoRefresh();
                    
                    socket.disconnect();
                    showSessionDisconnectedOverlay(
                        'This account is already active in another tab or browser. Please close the other session first.'
                    );
                });
                return;
            }
        });
        setErrorListenerSet(true);
    }
    
    setupTournamentListeners();

    if (!leaderboardUpdatedListenerSet)
    {
        socket.on('leaderboardUpdated', async (_data: { userId: number; username: string; avatar_url: string; timestamp: number }) =>
        {
            const mainMenuElement = document.getElementById('mainMenu');
            const isOnMainMenu = mainMenuElement !== null && mainMenuElement.innerHTML.trim() !== '';
            
            if (isOnMainMenu)
            {
                const leaderboardContainer = document.getElementById('leaderboard');
                if (leaderboardContainer)
                {
                    try
                    {
                        const { leaderboardHTML } = await import('../leaderboard/leaderboard.html.js');
                        leaderboardContainer.innerHTML = await leaderboardHTML();
                    }
                    catch (error) {}
                }
            }
        });
        setLeaderboardUpdatedListenerSet(true);
    }
}

function handleTournamentRoomJoined(data: any)
{
    import('./matchmaking.html.js').then(({ updateTournamentWaiting }) =>
    {
        if (data.maxPlayers === 4)
        {
            load('matchmaking');
            setTimeout(() =>
            {
                updateTournamentWaiting('All players ready! Tournament starting...');
            }, 100);
        }
        else
        {
            load('game');
            const waitForCanvas = () =>
            {
                const mapCanvas = document.getElementById('map');
                if (mapCanvas)
                {
                    if (typeof window.setupGameEventListeners === 'function')
                        window.setupGameEventListeners();
                    
                    if (typeof window.initPongRenderer === 'function')
                        window.initPongRenderer('map');
                    else
                        initPongRenderer('map');
                }
                else
                {
                    setTimeout(waitForCanvas, 50);
                }
            };
            setTimeout(waitForCanvas, 100);
        }
    });
}
