// websocket.ts
//'io' is already available in the page via the socket.io-clients CDN

declare var io: any;

// Pre-import load to avoid dynamic imports in event handlers
import { load } from '../navigation/utils.js';
import { sessionDisconnectedHTML } from '../navigation/sessionDisconnected.html.js';
import { updateMatchmakingForTournament, updateTournamentWaiting } from './matchmaking.html.js';
import { installSocketGuard } from '../navigation/securityGuard.js';

// Function to display the session disconnected overlay
function showSessionDisconnectedOverlay(message: string)
{
    // Prevent duplicates
    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
    if (existingOverlay)
        existingOverlay.remove();
    
    // Create a div element to contain the overlay
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'sessionDisconnectedOverlay';
    overlayDiv.innerHTML = sessionDisconnectedHTML(message);
    
    // Add the overlay to the body
    document.body.appendChild(overlayDiv);
}

// Socket.io connection on the same domain
let socket = io('', { 
  transports: ["websocket"], 
  secure: true,
  withCredentials: true,  // IMPORTANT: Allows session cookies to be sent
  reconnection: true,
  reconnectionAttempts: 5,      // Limit to 5 reconnection attempts
  reconnectionDelay: 1000,      // Initial delay of 1 second
  reconnectionDelayMax: 5000    // Max delay of 5 seconds
});
window.socket = socket;

// Install the security guard on the socket
installSocketGuard();

// Variables to avoid duplication of global event listeners
let connectListenerSet = false;
let roomJoinedListenerSet = false;
let disconnectBasicListenerSet = false;
let pongListenerSet = false;
let errorListenerSet = false;
let gameFinishedListenerActive = false;
let tournamentSemifinalFinishedListenerActive = false;
let tournamentFinalFinishedListenerActive = false;
let leaderboardUpdatedListenerSet = false;
let tournamentListenersSet = false;
let otherSemifinalUpdateListenerSet = false;

// Function to set up global socket event listeners (only once)
function setupGlobalSocketListeners() {
    // Event listener connect
    if (!connectListenerSet) {
        socket.on("connect", () => {
            // Connection established
        });
        connectListenerSet = true;
    }
    
    // Event listener roomJoined
    if (!roomJoinedListenerSet) {
        socket.on('roomJoined', (data: any) => {
            // Set global variables
            if (data && data.paddle) {
                window.controlledPaddle = data.paddle;
            } else {
                window.controlledPaddle = null;
            }
            if (data && data.maxPlayers) {
                window.maxPlayers = data.maxPlayers;
            }
            // Store spectator status
            if (data && typeof data.spectator === 'boolean') {
                window.isSpectator = data.spectator;
            } else {
                window.isSpectator = false;
            }
            // Update paddle key bindings immediately after setting controlledPaddle
            if (window.updatePaddleKeyBindings) {
                window.updatePaddleKeyBindings();
            }
            // Use pre-imported load function instead of dynamic import
            // If local mode, directly display the game page
            if (window.isLocalGame) {
                if (data.maxPlayers === 3) {
                    load('game3');
                } else {
                    load('game');
                }
                return;
            }
            // If spectator, go directly to the spectate page
            if (window.isSpectator) {
                if (data.maxPlayers === 4) {
                    load('spectate4');
                } else if (data.maxPlayers === 3) {
                    load('spectate');
                } else {
                    load('spectate');
                }
                // Force setup of game event listeners after navigation for spectators
                setTimeout(() => {
                    const mapCanvas = document.getElementById('map');
                    if (mapCanvas) {
                        if (typeof window.setupGameEventListeners === 'function') {
                            window.setupGameEventListeners();
                        }
                        if (typeof window.initPongRenderer === 'function') {
                            window.initPongRenderer('map');
                        }
                    }
                }, 200);
                return;
            }
            // Always show the waiting screen as long as the room is not full
            if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number') {
                if (data.players < data.maxPlayers) {
                    load('matchmaking');
                    // If tournament mode, update the display after loading
                    if (window.isTournamentMode) {
                        setTimeout(() => {
                            updateMatchmakingForTournament(data.players, data.maxPlayers);
                        }, 100);
                    }
                } else {
                    // Room is full - start the game
                    if (data.isTournament) {
                        // TOURNAMENT:
                        // - If maxPlayers=4, we are in the initial phase -> stay in matchmaking
                        // - If maxPlayers=2, it's a 1v1 semifinal/final match -> load game
                        if (data.maxPlayers === 4) {
                            // Initial phase of the tournament - wait for matches to start
                            load('matchmaking');
                            setTimeout(() => {
                                updateTournamentWaiting('All players ready! Tournament starting...');
                            }, 100);
                        } else {
                            // Tournament 1v1 match - use standard game (up/down control)
                            load('game');
                            // Reconfigure game listeners after page load
                            // Wait for the canvas to be in the DOM
                            const waitForCanvas = () => {
                                const mapCanvas = document.getElementById('map');
                                if (mapCanvas) {
                                    if (typeof window.setupGameEventListeners === 'function') {
                                        window.setupGameEventListeners();
                                    } else {
                                        // Fallback: call the local function directly
                                        setupGameEventListeners();
                                    }
                                    if (typeof window.initPongRenderer === 'function') {
                                        window.initPongRenderer('map');
                                    } else {
                                        // Fallback: call directly
                                        initPongRenderer('map');
                                    }
                                } else {
                                    setTimeout(waitForCanvas, 50);
                                }
                            };
                            setTimeout(waitForCanvas, 100);
                        }
                    } else if (data.maxPlayers === 4) {
                        load('game4');
                        // Apply canvas rotation so the controlled paddle is at the bottom
                        // The canvas is hidden by default (visibility: hidden in game4.html.ts)
                        const waitForCanvasRotation = () => {
                            const mapCanvas = document.getElementById('map') as HTMLCanvasElement;
                            if (mapCanvas && typeof window.applyCanvasRotation === 'function') {
                                // Apply rotation while the canvas is hidden
                                window.applyCanvasRotation(window.controlledPaddle, 'map');
                                // Force the browser to apply CSS before making visible
                                // Double requestAnimationFrame ensures the style is applied
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        mapCanvas.style.visibility = 'visible';
                                    });
                                });
                            } else {
                                setTimeout(waitForCanvasRotation, 20);
                            }
                        };
                        // Start immediately
                        waitForCanvasRotation();
                    } else if (data.maxPlayers === 3) {
                        load('game3');
                    } else {
                        load('game');
                    }
                }
            }
        });
        roomJoinedListenerSet = true;
    }
    
    // Basic disconnect event listener
    if (!disconnectBasicListenerSet) {
        socket.on('disconnect', () => {
            window.controlledPaddle = null;
        });
        disconnectBasicListenerSet = true;
    }
    
    // Pong event listener
    if (!pongListenerSet) {
        socket.on("pong", () => {
            // Message received from server
        });
        pongListenerSet = true;
    }

    // Event listener for errors
    if (!errorListenerSet) {
        socket.on('error', (data: any) => {
            // Handle specific error types
            if (data && data.code === 'JOIN_IN_PROGRESS') {
                // Don't show error to user for this case, just log it
                return;
            }

            // Handle tournament isolation error
            if (data && data.code === 'TOURNAMENT_ISOLATION') {
                // Show a user-friendly message
                alert(data.error || 'You cannot join online games while in an active tournament.');
                return;
            }
            
            // Handle user already connected error
            // NOTE: Normally this is already handled by BroadcastChannel (sessionBroadcast.ts)
            // This is just a fallback for edge cases (e.g., BroadcastChannel not supported)
            if (data && data.code === 'USER_ALREADY_CONNECTED') {
                
                // Import isSessionBlocked dynamically to check if BroadcastChannel already handled this
                import('../navigation/sessionBroadcast.js').then(({ isSessionBlocked }) => {
                    // Check if already blocked by BroadcastChannel OR if overlay already exists
                    const alreadyBlocked = isSessionBlocked();
                    const overlayExists = document.getElementById('sessionDisconnectedOverlay');
                    
                    if (alreadyBlocked || overlayExists) {
                        socket.disconnect();
                        return;
                    }
                    
                    // Stop friend list auto-refresh to prevent background requests
                    if (window.stopFriendListAutoRefresh) {
                        window.stopFriendListAutoRefresh();
                    }
                    
                    // Disconnect the socket
                    socket.disconnect();
                    
                    // Show the session disconnected overlay
                    showSessionDisconnectedOverlay(
                        'This account is already active in another tab or browser. Please close the other session first.'
                    );
                });
                return;
            }
        });
        errorListenerSet = true;
    }
    
    // ========================================
    // TOURNAMENT EVENT LISTENERS
    // ========================================
    if (!tournamentListenersSet) {
        // Tournament starts
        socket.on('tournamentStart', (_data: any) => {
            // Show the matchmaking screen with tournament info
            load('matchmaking');
            setTimeout(() => {
                updateTournamentWaiting('Tournament starting...');
            }, 100);
        });
        
        // Tournament update (phases, matches)
        socket.on('tournamentUpdate', (data: any) => {
            if (data.phase === 'semifinal1' || data.phase === 'semifinal2' || data.phase === 'final') {
                // A match starts - the game will be loaded via roomJoined
                updateTournamentWaiting(data.message || 'Match starting...');
            } else if (data.phase?.includes('complete')) {
                // A match is finished
                load('matchmaking');
                setTimeout(() => {
                    updateTournamentWaiting(data.message || 'Preparing next match...');
                }, 100);
            }
        });
        
        // Spectator during a match
        socket.on('tournamentSpectator', (data: any) => {
            load('matchmaking');
            setTimeout(() => {
                const title = document.getElementById('matchmakingTitle');
                if (title) title.textContent = 'TOURNAMENT';
                updateTournamentWaiting(`Watching: ${data.match?.player1 || data.currentMatch?.player1} vs ${data.match?.player2 || data.currentMatch?.player2}`);
            }, 100);
        });
        
        // Real-time update of the other semifinal score
        if (!otherSemifinalUpdateListenerSet) {
            socket.on('otherSemifinalUpdate', (data: any) => {
                console.log('📊 otherSemifinalUpdate received:', data);
                // Try to find the element by ID first (more specific), then by class
                const waitingText = document.getElementById('other-semifinal-waiting-text') || document.querySelector('.waiting-text');
                console.log('📊 waiting-text element:', waitingText);
                if (waitingText) {
                    if (data.finished) {
                        const winner = data.score1 > data.score2 ? data.player1 : data.player2;
                        waitingText.textContent = `Other semi-final: ${data.player1} vs ${data.player2} (${winner} won)`;
                    } else {
                        waitingText.textContent = `Other semi-final: ${data.player1} vs ${data.player2}`;
                    }
                    console.log('📊 Updated text to:', waitingText.textContent);
                }
            });
            otherSemifinalUpdateListenerSet = true;
        }
        
        // Final start - dedicated event to load the game
        socket.on('tournamentFinalStart', (data: any) => {
            // Set the controlled paddle
            window.controlledPaddle = data.paddle;
            window.maxPlayers = 2;
            window.isSpectator = false;
            
            // Update key bindings
            if (window.updatePaddleKeyBindings) {
                window.updatePaddleKeyBindings();
            }
            
            // Load the game page
            load('game');
            
            // Wait for the canvas to be in the DOM then initialize
            const initGame = () => {
                const mapCanvas = document.getElementById('map');
                if (mapCanvas) {
                    if (typeof window.setupGameEventListeners === 'function') {
                        window.setupGameEventListeners();
                    }
                    if (typeof window.initPongRenderer === 'function') {
                        window.initPongRenderer('map');
                    }
                } else {
                    setTimeout(initGame, 50);
                }
            };
            setTimeout(initGame, 100);
        });
        
        // Tournament complete
        socket.on('tournamentComplete', (data: any) => {
            // Reset tournament mode
            window.isTournamentMode = false;
            
            // Show a tournament end screen
            alert(`🏆 Tournament Champion: ${data.winner}!`);
            load('mainMenu');
        });
        
        tournamentListenersSet = true;
    }

    // Event listener for leaderboard updates (broadcast to ALL clients when any user changes profile)
    if (!leaderboardUpdatedListenerSet) {
        socket.on('leaderboardUpdated', async (_data: { userId: number; username: string; avatar_url: string; timestamp: number }) => {
            // Check that we are on the main menu (the only place where the leaderboard is displayed)
            const mainMenuElement = document.getElementById('mainMenu');
            const isOnMainMenu = mainMenuElement !== null && mainMenuElement.innerHTML.trim() !== '';
            
            if (isOnMainMenu) {
                const leaderboardContainer = document.getElementById('leaderboard');
                if (leaderboardContainer) {
                    try {
                        const { leaderboardHTML } = await import('../leaderboard/leaderboard.html.js');
                        leaderboardContainer.innerHTML = await leaderboardHTML();
                    } catch (error) {
                    }
                }
            }
        });
        leaderboardUpdatedListenerSet = true;
    }
    
    // Tournament feature removed: no tournament socket listeners to set up
}

// Set up global listeners on load
setupGlobalSocketListeners();

// Function to reconnect websocket after authentication
function reconnectWebSocket() {
    if (socket && socket.connected) {
        // Remove all listeners from the old socket to prevent duplicates
        socket.removeAllListeners();
        socket.disconnect();
    }
    
    // Wait a moment to ensure the old connection is fully closed
    setTimeout(() => {
        // Create a new socket connection with fresh cookies
        socket = io('', { 
            transports: ["websocket"], 
            secure: true,
            withCredentials: true,
            forceNew: true,  // Force a new connection
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        
        window.socket = socket;
        
        // Reinstall the security guard on the new socket
        installSocketGuard();
        
        // Reset listener flags to re-setup listeners
        connectListenerSet = false;
        roomJoinedListenerSet = false;
        disconnectBasicListenerSet = false;
        pongListenerSet = false;
        installSocketGuard();
        
        // Reset listener flags to re-setup listeners
        connectListenerSet = false;
        roomJoinedListenerSet = false;
        disconnectBasicListenerSet = false;
        pongListenerSet = false;
        errorListenerSet = false;
        leaderboardUpdatedListenerSet = false;
        otherSemifinalUpdateListenerSet = false;
        // NOTE: friendAdded, friendRemoved, profileUpdated, friendRequestReceived
        // are now managed by friendList.html.ts
        
        // Re-setup global listeners
        setupGlobalSocketListeners();
    }, 100); // Small delay to ensure clean reconnection
}

// Function to send a "ping" message to the server
function sendPing()
{
    // Send a message named "ping" with an object to the server
    socket.emit("ping", { message: "Hello server!" });
}

// You can type sendPing() in the console to test sending a message
window.sendPing = sendPing;

// Define types for structured messages
type MessageType = 'move' | 'score' | string;

// This interface allows you to create an object with as many properties as you want.
interface MessageData
{
    [key: string]: any;
}

// Function to send a structured message (exposed for external use)
function sendMessage(type: MessageType, data: MessageData)
{
    const msg = JSON.stringify({ type, data }); // Converts the object to a JSON string
    socket.emit('message', msg); // Use emit instead of send for Socket.IO
}

// Expose the function for testing in the browser console
window.sendMessage = sendMessage;

let joinInProgress = false;
let lastJoinAttempt = 0;
const JOIN_DEBOUNCE_MS = 1000; // 1 second debounce

// Function to join or create a room with n players (100% backend workflow)
async function joinOrCreateRoom(maxPlayers: number, isLocalGame: boolean = false)
{
    const now = Date.now();
    
    // Debounce check - prevent too rapid successive calls
    if (now - lastJoinAttempt < JOIN_DEBOUNCE_MS)
        return;
    
    if (joinInProgress)
        return;
    
    lastJoinAttempt = now;
    joinInProgress = true;
    
    window.setIsLocalGame(isLocalGame);
    
    return new Promise<void>((resolve, reject) =>
    {
        const cleanup = () => {
            joinInProgress = false;
            socket.off('error', failure);
        };
        const failure = () => {
            cleanup();
            reject(new Error("Error during joinRoom"));
        };
        // We no longer use 'once' on roomJoined to avoid consuming the event
        socket.once('error', failure);
        
        // Prepare the data to send to the server
        const roomData: any = { maxPlayers, isLocalGame };
        
        // Add AI information if AI mode is enabled
        if (window.aiMode) {
            roomData.enableAI = true;
            roomData.aiDifficulty = window.aiDifficulty || 'medium';
            // Do not reset the flag here to avoid blocking W/S in AI mode
        }
        
        // Add the tournament flag if tournament mode is enabled
        if (window.isTournamentMode) {
            roomData.isTournament = true;
        }
        
        socket.emit('joinRoom', roomData);
        // We consider the promise resolved as soon as we emit the request (the UX handler manages the rest)
        cleanup();
        resolve();
    });
}

// Async function to properly leave current room and wait for completion
async function leaveCurrentRoomAsync(): Promise<void> {
    return new Promise<void>((resolve) => {
        if (!socket || !socket.connected) {
            resolve();
            return;
        }
        
        // Set up a one-time listener for the completion event
        socket.once('leaveAllRoomsComplete', () => {
            resolve();
        });
        
        // Set up a timeout fallback in case the server doesn't respond
        const fallbackTimeout = setTimeout(() => {
            resolve();
        }, 3000); // 3 second timeout
        
        // Clean up the timeout when we get the response
        socket.once('leaveAllRoomsComplete', () => {
            clearTimeout(fallbackTimeout);
        });
        
        socket.emit('leaveAllRooms');
    });
}

// Expose the async cleanup function globally
window.leaveCurrentRoomAsync = leaveCurrentRoomAsync;

// Expose the function for testing in the browser console
window.joinOrCreateRoom = joinOrCreateRoom;

// Expose reconnectWebSocket globally for auth-triggered reconnections
window.reconnectWebSocket = reconnectWebSocket;

// Note: setIsLocalGame is defined in pongControls.ts and includes updateDifficultySelector() call

// Expose reconnectWebSocket globally for auth-triggered reconnections
window.reconnectWebSocket = reconnectWebSocket;

import { initPongRenderer, draw } from './pongRenderer.js';
import { cleanupGameState } from './gameCleanup.js';

// Initialize the Pong renderer when the game page loads
function setupPongCanvas() {
    initPongRenderer('map');
}

document.addEventListener('componentsReady', () => {
    // Wait a bit for the DOM to be really ready, then check the canvas
    setTimeout(() => {
        const mapCanvas = document.getElementById('map');
        if (mapCanvas) {
            setupPongCanvas();
            setupGameEventListeners();
            
            // Initialize the AI difficulty selector
            if (typeof window.initAIDifficultySelector === 'function') {
                window.initAIDifficultySelector();
            }
        }
    }, 100);
});

// Variables to avoid duplication of event listeners
let gameStateListenerActive = false;
let disconnectListenerActive = false;
let leftRoomListenerActive = false;
let spectatorGameFinishedListenerActive = false;

// Function to clean up game event listeners
function cleanupGameEventListeners()
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
        gameFinishedListenerActive = false;
    }
    if (tournamentSemifinalFinishedListenerActive)
    {
        socket.removeAllListeners('tournamentSemifinalFinished');
        tournamentSemifinalFinishedListenerActive = false;
    }
    if (tournamentFinalFinishedListenerActive)
    {
        socket.removeAllListeners('tournamentFinalFinished');
        tournamentFinalFinishedListenerActive = false;
    }
    if (spectatorGameFinishedListenerActive)
    {
        socket.removeAllListeners('spectatorGameFinished');
        spectatorGameFinishedListenerActive = false;
    }
    
    // Resume the background when the game ends
    if (typeof window.resumeBackground === 'function')
        window.resumeBackground();
}

// Function to set up game event listeners (only once)
function setupGameEventListeners()
{
    // Clean up old listeners first
    cleanupGameEventListeners();
    
    // Event listener for game states
    if (!gameStateListenerActive)
    {
        socket.on('gameState', (state: any) => {
            // Use the interpolation system if available
            if (typeof window.addGameState === 'function')
            {
                // Add the state to the interpolation buffer
                window.addGameState(state);
                
                // Start the render loop if not already active
                if (typeof window.startRenderLoop === 'function')
                    window.startRenderLoop();
            }
            else
            {
                // Fallback: draw directly with the standard function
                draw(state);
            }
        });
        gameStateListenerActive = true;
    }

    // Clean up when disconnecting from a room
    if (!disconnectListenerActive)
    {
        socket.on('disconnect', () => {
            cleanupGameState();
            cleanupGameEventListeners();
        });
        disconnectListenerActive = true;
    }

    // Clean up when leaving a room
    if (!leftRoomListenerActive)
    {
        socket.on('leftRoom', () => {
            cleanupGameState();
        });
        leftRoomListenerActive = true;
    }

    if (!gameFinishedListenerActive)
    {
        socket.on('gameFinished', (data: any) => {
            gameFinishedListenerActive = true;

            // Ignore if the user voluntarily left the game via navigation
            if (window.isNavigatingAwayFromGame) {
                window.isNavigatingAwayFromGame = false;
                return;
            }

            setTimeout(() => {
                load('gameFinished', data || {});
            }, 100);
        });
    }
    
    // Event listener for end of tournament semifinal
    if (!tournamentSemifinalFinishedListenerActive)
    {
        socket.on('tournamentSemifinalFinished', (data: any) => {
            tournamentSemifinalFinishedListenerActive = true;
            
            // Always show the end of semifinal screen, even if navigation is in progress
            // (forfeit by navigation must show the result)
            window.isNavigatingAwayFromGame = false;
            
            // Stop the game rendering
            cleanupGameState();
            
            // Show the end of semifinal screen
            load('tournamentSemifinalFinished', data);
        });
    }
    
    // Event listener for end of tournament final
    if (!tournamentFinalFinishedListenerActive)
    {
        socket.on('tournamentFinalFinished', (data: any) => {
            console.log('📥 Received tournamentFinalFinished event:', data);
            tournamentFinalFinishedListenerActive = true;
            
            // Always show the end of final screen, even if navigation is in progress
            // (forfeit by navigation must show the result)
            window.isNavigatingAwayFromGame = false;
            
            // Stop the game rendering
            console.log('🧹 Calling cleanupGameState before showing final screen');
            cleanupGameState();
            
            // Show the end of final screen
            console.log('🏆 Loading tournamentFinalFinished screen');
            load('tournamentFinalFinished', data);
        });
    }
    
    // Special event listener for spectators
    if (!spectatorGameFinishedListenerActive)
    {
        socket.on('spectatorGameFinished', (data: any) => {
            spectatorGameFinishedListenerActive = true;
            
            // Ignore if the user voluntarily left the game via navigation
            if (window.isNavigatingAwayFromGame) {
                window.isNavigatingAwayFromGame = false;
                return;
            }
            
            // Check that we are on a spectate page
            const currentPath = window.location.pathname;
            if (!currentPath.includes('spectate')) {
                // Not on the spectate page, ignore the end screen
                return;
            }
            
            // Stop the game and clean up the state
            cleanupGameState();
            
            // Show the SPA end screen for spectator with the real data
            setTimeout(() => {
                load('spectatorGameFinished', data);
            }, 100); // Reduced delay for faster display
        });
    }
}

// Expose the cleanup and setup functions globally
window.cleanupGameEventListeners = cleanupGameEventListeners;
window.setupGameEventListeners = setupGameEventListeners;

// Removal of sendMove and keydown listener (moved to pongControls.ts)
import './pongControls.js'; // Adds keyboard controls (modularity)
