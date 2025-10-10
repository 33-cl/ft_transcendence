// Session Broadcast - Communication entre onglets pour bloquer les connexions multiples

import { sessionDisconnectedHTML, initializeSessionDisconnectedListeners } from '../components/sessionDisconnected.html.js';

const CHANNEL_NAME = 'ft_transcendence_session';

// Create a BroadcastChannel for cross-tab communication
let sessionChannel: BroadcastChannel | null = null;

// Flag global pour bloquer toute action quand un autre onglet a une session active
let sessionBlockedByAnotherTab = false;

// Unique ID for this tab to avoid self-blocking
const TAB_ID = Math.random().toString(36).substring(7);

// Track if this tab has an active session
let hasActiveSession = false;

// Export function to check if session is blocked
export function isSessionBlocked(): boolean {
    return sessionBlockedByAnotherTab;
}

// Export function to mark this tab as having an active session
export function markSessionActive() {
    hasActiveSession = true;
    sessionBlockedByAnotherTab = false;
}

// Export function to mark this tab as not having a session
export function markSessionInactive() {
    hasActiveSession = false;
}

// Initialize the broadcast channel
export function initSessionBroadcast() {
    if (typeof BroadcastChannel === 'undefined') {
        console.warn('BroadcastChannel not supported');
        return;
    }

    // Don't initialize multiple times
    if (sessionChannel) {
        console.log('Session broadcast already initialized');
        return;
    }

    sessionChannel = new BroadcastChannel(CHANNEL_NAME);

    // Listen for session events from other tabs
    sessionChannel.onmessage = (event) => {
        // Ignore messages from this tab itself
        if (event.data.tabId === TAB_ID) {
            return;
        }
        
        if (event.data.type === 'SESSION_CREATED') {
            // If this tab already has an active session, ignore the message
            if (hasActiveSession) {
                console.log('⚠️ Ignoring SESSION_CREATED - this tab already has an active session');
                return;
            }
            
            console.log('⚠️ Session created in another tab, showing overlay and blocking this tab');
            
            // Set the global block flag
            sessionBlockedByAnotherTab = true;
            
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
            
            // Clear current user in this tab only (don't logout as it would destroy the session for all tabs)
            (window as any).currentUser = null;
        } else if (event.data.type === 'SESSION_DESTROYED') {
            console.log('✅ Session destroyed in another tab, removing overlay and unblocking');
            
            // Unblock this tab
            sessionBlockedByAnotherTab = false;
            
            // Remove overlay to unblock this tab
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
        } else if (event.data.type === 'SESSION_CHECK') {
            // Another tab is checking if there's an active session
            // Respond only if we have an active session (hasActiveSession flag)
            if (hasActiveSession) {
                console.log('📢 Responding to session check - we have an active session');
                sessionChannel?.postMessage({ type: 'SESSION_ACTIVE', tabId: TAB_ID });
            }
        } else if (event.data.type === 'SESSION_ACTIVE') {
            // If this tab already has an active session, ignore the message
            if (hasActiveSession) {
                console.log('⚠️ Ignoring SESSION_ACTIVE - this tab already has an active session');
                return;
            }
            
            // Another tab has an active session, block this tab
            console.log('⚠️ Another tab has an active session, blocking this tab');
            
            // Set the global block flag
            sessionBlockedByAnotherTab = true;
            
            // Remove existing overlay if any
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            // Create overlay
            const overlayDiv = document.createElement('div');
            overlayDiv.id = 'sessionDisconnectedOverlay';
            overlayDiv.innerHTML = sessionDisconnectedHTML(
                'A session is already active in another tab. Please close this tab or logout from the other session.'
            );
            
            document.body.appendChild(overlayDiv);
            initializeSessionDisconnectedListeners();
            
            // Clear current user in this tab
            (window as any).currentUser = null;
        }
    };
    
    // Check if there's already an active session in another tab
    sessionChannel.postMessage({ type: 'SESSION_CHECK', tabId: TAB_ID });
}

// Broadcast that a session has been created (after successful login/register)
export function broadcastSessionCreated() {
    if (sessionChannel) {
        console.log('📢 Broadcasting session creation to other tabs');
        sessionChannel.postMessage({ type: 'SESSION_CREATED', tabId: TAB_ID });
    }
}

// Broadcast that a session has been destroyed (after logout)
export function broadcastSessionDestroyed() {
    if (sessionChannel) {
        console.log('📢 Broadcasting session destruction to other tabs');
        sessionChannel.postMessage({ type: 'SESSION_DESTROYED', tabId: TAB_ID });
    }
}

// Clean up
export function cleanupSessionBroadcast() {
    if (sessionChannel) {
        sessionChannel.close();
        sessionChannel = null;
    }
}
