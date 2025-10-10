// Session Broadcast - Communication entre onglets pour bloquer les connexions multiples

import { sessionDisconnectedHTML, initializeSessionDisconnectedListeners } from '../components/sessionDisconnected.html.js';

const CHANNEL_NAME = 'ft_transcendence_session';

// Create a BroadcastChannel for cross-tab communication
let sessionChannel: BroadcastChannel | null = null;

// Initialize the broadcast channel
export function initSessionBroadcast() {
    if (typeof BroadcastChannel === 'undefined') {
        console.warn('BroadcastChannel not supported');
        return;
    }

    sessionChannel = new BroadcastChannel(CHANNEL_NAME);

    // Listen for session events from other tabs
    sessionChannel.onmessage = (event) => {
        if (event.data.type === 'SESSION_CREATED') {
            console.log('⚠️ Session created in another tab, showing overlay');
            
            // Remove existing overlay if any
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            // Create overlay
            const overlayDiv = document.createElement('div');
            overlayDiv.id = 'sessionDisconnectedOverlay';
            overlayDiv.innerHTML = sessionDisconnectedHTML(
                'A session was just created in another tab. Please close this tab or logout from the other session.'
            );
            
            document.body.appendChild(overlayDiv);
            initializeSessionDisconnectedListeners();
            
            // Clear current user in this tab
            (window as any).currentUser = null;
        } else if (event.data.type === 'SESSION_DESTROYED') {
            console.log('✅ Session destroyed in another tab, removing overlay');
            
            // Remove overlay to unblock this tab
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
        }
    };
}

// Broadcast that a session has been created (after successful login/register)
export function broadcastSessionCreated() {
    if (sessionChannel) {
        console.log('📢 Broadcasting session creation to other tabs');
        sessionChannel.postMessage({ type: 'SESSION_CREATED' });
    }
}

// Broadcast that a session has been destroyed (after logout)
export function broadcastSessionDestroyed() {
    if (sessionChannel) {
        console.log('📢 Broadcasting session destruction to other tabs');
        sessionChannel.postMessage({ type: 'SESSION_DESTROYED' });
    }
}

// Clean up
export function cleanupSessionBroadcast() {
    if (sessionChannel) {
        sessionChannel.close();
        sessionChannel = null;
    }
}
