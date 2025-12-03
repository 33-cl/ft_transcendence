// websocket.ts
//'io' est déjà disponible dans la page via le CDN socket.io-clients

declare var io: any;

// Pre-import load to avoid dynamic imports in event handlers
import { load } from '../navigation/utils.js';
import { sessionDisconnectedHTML, initializeSessionDisconnectedListeners } from '../navigation/sessionDisconnected.html.js';

// NOTE: La fonction updateFriendStatus et updateFriendStatusIndicator ont été déplacées dans friendList.html.ts
// pour centraliser la gestion des mises à jour de la friendlist et éviter les conflits

// Fonction pour afficher l'overlay de session déconnectée
function showSessionDisconnectedOverlay(message: string) {
    console.log('🎨 showSessionDisconnectedOverlay() called with message:', message);
    
    // Éviter les doublons
    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
    if (existingOverlay) {
        console.log('🗑️ Removing existing overlay in showSessionDisconnectedOverlay()');
        existingOverlay.remove();
    }
    
    // Créer un élément div pour contenir l'overlay
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'sessionDisconnectedOverlay';
    overlayDiv.innerHTML = sessionDisconnectedHTML(message);
    
    // Ajouter l'overlay au body
    document.body.appendChild(overlayDiv);
    console.log('✅ Overlay appended to body by showSessionDisconnectedOverlay()');
    
    // Initialiser les event listeners pour le bouton
    initializeSessionDisconnectedListeners();
}

// Connexion socket.io sur le même domaine
let socket = io('', { 
  transports: ["websocket"], 
  secure: true,
  withCredentials: true  // IMPORTANT: Permet la transmission des cookies de session
});
(window as any).socket = socket;

// Variables pour éviter la duplication d'event listeners globaux
let connectListenerSet = false;
let roomJoinedListenerSet = false;
let disconnectBasicListenerSet = false;
let pongListenerSet = false;
let errorListenerSet = false;
let gameFinishedListenerActive = false;
// 🚨 NOTE IMPORTANTE: Les listeners suivants sont maintenant gérés par friendList.html.ts
// pour avoir un meilleur contrôle sur les mises à jour de la liste d'amis:
// - friendStatusChanged → updateFriendStatus() (préserve le statut actuel)
// - friendAdded → reloadFriendList() (avec fetch des statuts)
// - friendRemoved → reloadFriendList() (avec fetch des statuts)
// - profileUpdated → updateFriendProfile() (préserve le statut actuel)
// - friendRequestReceived → updateFriendRequestsBadge()
// Les listeners ici sont maintenus pour compatibilité mais ne font plus les mises à jour du DOM

// Fonction pour configurer les event listeners globaux (une seule fois)
function setupGlobalSocketListeners() {
    // Event listener connect
    if (!connectListenerSet) {
        socket.on("connect", () => {
            // Connexion établie
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
                (window as any).maxPlayers = data.maxPlayers;
            }
            
            // Store spectator status
            if (data && typeof data.spectator === 'boolean') {
                (window as any).isSpectator = data.spectator;
            } else {
                (window as any).isSpectator = false;
            }
            
            // Update paddle key bindings immediately after setting controlledPaddle
            if ((window as any).updatePaddleKeyBindings) {
                (window as any).updatePaddleKeyBindings();
            }
            
            // Use pre-imported load function instead of dynamic import
            // Si mode local, on affiche directement la page de jeu
            if ((window as any).isLocalGame) {
                if (data.maxPlayers === 3) {
                    load('game3');
                } else {
                    load('game');
                }
                return;
            }
            
            // Si c'est un spectateur, aller directement à la page de jeu
            if ((window as any).isSpectator) {
                if (data.maxPlayers === 4) {
                    load('game4');
                } else if (data.maxPlayers === 3) {
                    load('game3');
                } else {
                    load('game');
                }
                // Force setup of game event listeners after navigation for spectators
                setTimeout(() => {
                    const mapCanvas = document.getElementById('map');
                    if (mapCanvas) {
                        if (typeof (window as any).setupGameEventListeners === 'function') {
                            (window as any).setupGameEventListeners();
                        }
                        if (typeof (window as any).initPongRenderer === 'function') {
                            (window as any).initPongRenderer('map');
                        }
                    }
                }, 200);
                return;
            }
            
            // Toujours afficher l'écran d'attente tant que la room n'est pas pleine
            if (data && typeof data.players === 'number' && typeof data.maxPlayers === 'number') {
                if (data.players < data.maxPlayers) {
                    load('matchmaking');
                } else {
                    if (data.maxPlayers === 4) {
                        load('game4');
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
    
    // Event listener disconnect basique
    if (!disconnectBasicListenerSet) {
        socket.on('disconnect', () => {
            window.controlledPaddle = null;
        });
        disconnectBasicListenerSet = true;
    }
    
    // Event listener pong
    if (!pongListenerSet) {
        socket.on("pong", () => {
            // Message reçu du serveur
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
                console.log('⚠️ WebSocket: TOURNAMENT_ISOLATION - User is in active tournament');
                // Show a user-friendly message
                alert(data.error || 'You cannot join online games while in an active tournament.');
                return;
            }
            
            // Handle user already connected error
            // NOTE: Normally this is already handled by BroadcastChannel (sessionBroadcast.ts)
            // This is just a fallback for edge cases (e.g., BroadcastChannel not supported)
            if (data && data.code === 'USER_ALREADY_CONNECTED') {
                console.log('⚠️ WebSocket: USER_ALREADY_CONNECTED received');
                
                // Import isSessionBlocked dynamically to check if BroadcastChannel already handled this
                import('../navigation/sessionBroadcast.js').then(({ isSessionBlocked }) => {
                    // Check if already blocked by BroadcastChannel OR if overlay already exists
                    const alreadyBlocked = isSessionBlocked();
                    const overlayExists = document.getElementById('sessionDisconnectedOverlay');
                    
                    if (alreadyBlocked || overlayExists) {
                        console.log('ℹ️ Session already blocked by BroadcastChannel, not creating duplicate overlay');
                        socket.disconnect();
                        return;
                    }
                    
                    // Fallback: BroadcastChannel didn't handle it (e.g., not supported in browser)
                    console.log('🎨 FALLBACK: Creating session blocked overlay from WebSocket');
                    
                    // Stop friend list auto-refresh to prevent background requests
                    if ((window as any).stopFriendListAutoRefresh) {
                        (window as any).stopFriendListAutoRefresh();
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
            
            // Note: BROWSER_ALREADY_CONNECTED errors are handled by auth forms, not here
            
            // Handle other errors by showing them to the user
            if (data && data.error) {
                // console.error('Server error:', data.error);
                // You could show a toast notification or alert here
            }
        });
        errorListenerSet = true;
    }
    
    // Event listener for friend status changes (real-time friend list updates)
    // NOTE: Ce listener est désormais géré par friendList.html.ts via startFriendListRealtimeUpdates()
    // pour éviter les conflits de double gestion des mises à jour de statut
    // if (!friendStatusListenerSet) {
    //     socket.on('friendStatusChanged', (data: any) => {
    //         updateFriendStatus(data.username, data.status);
    //     });
    //     friendStatusListenerSet = true;
    // }
    
    // 🚨 NOTE: Les listeners suivants sont maintenant entièrement gérés par friendList.html.ts
    // - friendAdded → reloadFriendList()
    // - friendRemoved → reloadFriendList()
    // - profileUpdated → updateFriendProfile()
    // - friendRequestReceived → updateFriendRequestsBadge()
    // Ils ont été supprimés d'ici pour éviter les doublons
}

// Configurer les listeners globaux au chargement
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
            forceNew: true  // Force a new connection
        });
        
        (window as any).socket = socket;
        
        // Reset listener flags to re-setup listeners
        connectListenerSet = false;
        roomJoinedListenerSet = false;
        disconnectBasicListenerSet = false;
        pongListenerSet = false;
        errorListenerSet = false;
        // NOTE: friendAdded, friendRemoved, profileUpdated, friendRequestReceived
        // sont maintenant gérés par friendList.html.ts
        
        // Re-setup global listeners
        setupGlobalSocketListeners();
    }, 100); // Small delay to ensure clean reconnection
}

// Fonction pour envoyer un message "ping" au serveur
function sendPing()
{
	// Envoie un message nommé "ping" avec un objet au serveur
    socket.emit("ping", { message: "Hello serveur!" });
}

// Rend la fonction sendPing accessible depuis la console du navigateur
// Tu peux taper sendPing() dans la console pour tester l'envoi d'un message
window.sendPing = sendPing;



// Fonction pour envoyer un message structuré
// a terme, ne plus avoir string, afin d'avoid les merdes si on reçoit un message innatendu
type MessageType = 'move' | 'score' | string;

// Cette interface permet de créer un objet avec autant de propriétés que l'on souhaite.
// Chaque propriété (clé) doit être une chaîne de caractères, et sa valeur peut être de n'importe quel type.
// Exemple d'utilisation : { y: 120, player: "left" }
//remplacer le any plus tard par un type plus précis si possible
interface MessageData
{
    [key: string]: any;
}

// Fonction pour envoyer un message structuré (exposée pour usage externe)
function sendMessage(type: MessageType, data: MessageData)
{
    const msg = JSON.stringify({ type, data });// Convertit l'objet en chaîne JSON
    socket.emit('message', msg); // Utilise emit au lieu de send pour Socket.IO
}

// Expose la fonction pour test dans la console navigateur
window.sendMessage = sendMessage;

let joinInProgress = false;
let lastJoinAttempt = 0;
const JOIN_DEBOUNCE_MS = 1000; // 1 second debounce

// Fonction pour rejoindre ou créer une room de n joueurs (workflow 100% backend)
async function joinOrCreateRoom(maxPlayers: number, isLocalGame: boolean = false)
{
    const now = Date.now();
    
    // Debounce check - prevent too rapid successive calls
    if (now - lastJoinAttempt < JOIN_DEBOUNCE_MS) {
        return;
    }
    
    if (joinInProgress) {
        return;
    }
    
    lastJoinAttempt = now;
    joinInProgress = true;
    
    (window as any).setIsLocalGame(isLocalGame);
    
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
        // On n'utilise plus 'once' sur roomJoined pour ne pas consommer l'event
        socket.once('error', failure);
        
        // Préparer les données à envoyer au serveur
        const roomData: any = { maxPlayers, isLocalGame };
        
        // Ajouter les informations IA si le mode IA est activé
        if ((window as any).aiMode) {
            roomData.enableAI = true;
            roomData.aiDifficulty = (window as any).aiDifficulty || 'medium';
            // Reset du flag après utilisation
            //(window as any).aiMode = false; retirer car cela empeche le blocage de W/S en mode IA
        }
        
        socket.emit('joinRoom', roomData);
        // On considère la promesse résolue dès qu'on a émis la demande (le handler UX gère la suite)
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
(window as any).leaveCurrentRoomAsync = leaveCurrentRoomAsync;

// Expose the function for test in the console navigateur
window.joinOrCreateRoom = joinOrCreateRoom;

// Expose reconnectWebSocket globally for auth-triggered reconnections
(window as any).reconnectWebSocket = reconnectWebSocket;

// Note: setIsLocalGame is defined in pongControls.ts and includes updateDifficultySelector() call

// Expose reconnectWebSocket globally for auth-triggered reconnections
(window as any).reconnectWebSocket = reconnectWebSocket;

import { initPongRenderer, draw } from './pongRenderer.js';
import { cleanupGameState } from './gameCleanup.js';

// Initialisation du renderer Pong au chargement de la page jeu
function setupPongCanvas() {
    initPongRenderer('map');
}

document.addEventListener('componentsReady', () => {
    // Attendre un peu que le DOM soit vraiment prêt, puis vérifier le canvas
    setTimeout(() => {
        const mapCanvas = document.getElementById('map');
        if (mapCanvas) {
            setupPongCanvas();
            setupGameEventListeners();
            
            // Initialiser le sélecteur de difficulté IA
            if (typeof (window as any).initAIDifficultySelector === 'function') {
                (window as any).initAIDifficultySelector();
            }
        }
    }, 100);
});

// Variables pour éviter la duplication d'event listeners
let gameStateListenerActive = false;
let disconnectListenerActive = false;
let leftRoomListenerActive = false;
let spectatorGameFinishedListenerActive = false;

// Fonction pour nettoyer les event listeners du jeu
function cleanupGameEventListeners() {
    if (gameStateListenerActive) {
        socket.removeAllListeners('gameState');
        gameStateListenerActive = false;
    }
    if (disconnectListenerActive) {
        socket.removeAllListeners('disconnect');
        disconnectListenerActive = false;
    }
    if (leftRoomListenerActive) {
        socket.removeAllListeners('leftRoom');
        leftRoomListenerActive = false;
    }
	if (gameFinishedListenerActive) {
        socket.removeAllListeners('gameFinished');
        gameFinishedListenerActive = false;
	}
	if (spectatorGameFinishedListenerActive) {
        socket.removeAllListeners('spectatorGameFinished');
        spectatorGameFinishedListenerActive = false;
	}
}

// Fonction pour configurer les event listeners du jeu (une seule fois)
function setupGameEventListeners() {
    // Nettoyer d'abord les anciens listeners
    cleanupGameEventListeners();
    
    // Event listener pour les états de jeu
    if (!gameStateListenerActive) {
        socket.on('gameState', (state: any) => {
            // Utiliser le système d'interpolation si disponible
            if (typeof (window as any).addGameState === 'function') {
                // Ajouter l'état au buffer d'interpolation
                (window as any).addGameState(state);
                
                // Démarrer la boucle de rendu si pas déjà active
                if (typeof (window as any).startRenderLoop === 'function') {
                    (window as any).startRenderLoop();
                }
            } else {
                // Fallback: dessiner directement avec la fonction standard
                draw(state);
            }
        });
        gameStateListenerActive = true;
    }

    // Nettoyage lors de la déconnexion d'une room
    if (!disconnectListenerActive) {
        socket.on('disconnect', () => {
            cleanupGameState();
            cleanupGameEventListeners();
        });
        disconnectListenerActive = true;
    }

    // Nettoyage lors de la sortie d'une room
    if (!leftRoomListenerActive) {
        socket.on('leftRoom', () => {
            cleanupGameState();
        });
        leftRoomListenerActive = true;
    }

	if (!gameFinishedListenerActive) {
        socket.on('gameFinished', (data: any) => {
            gameFinishedListenerActive = true;

            // Affiche la page de fin de partie avec les données reçues
            if (data && data.winner) {
                load('gameFinished', data);
            } else {
                load('gameFinished');
            }
        });
	}
    
    // Event listener spécial pour les spectateurs
    if (!spectatorGameFinishedListenerActive) {
        socket.on('spectatorGameFinished', (data: any) => {
            spectatorGameFinishedListenerActive = true;
            
            // Arrêter le jeu et nettoyer l'état
            cleanupGameState();
            
            // Afficher l'écran de fin SPA pour spectateur avec les vraies données
            setTimeout(() => {
                load('spectatorGameFinished', data);
            }, 100); // Délai réduit pour affichage plus rapide
        });
    }
}

// Exposer les fonctions de cleanup globalement
(window as any).cleanupGameEventListeners = cleanupGameEventListeners;
(window as any).setupGameEventListeners = setupGameEventListeners;

// Suppression de sendMove et du keydown listener (déplacés dans pongControls.ts)
import './pongControls.js'; // Ajoute les contrôles clavier (modularité)
