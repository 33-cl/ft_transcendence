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
    console.log('🔍 isSessionBlocked() called, sessionBlockedByAnotherTab =', sessionBlockedByAnotherTab);
    return sessionBlockedByAnotherTab;
}

// Export function to mark this tab as having an active session
export function markSessionActive() {
    console.log('✅ markSessionActive() called');
    console.log('   Current state: hasActiveSession =', hasActiveSession, ', sessionBlockedByAnotherTab =', sessionBlockedByAnotherTab);
    
    // ⚠️ CRITICAL: Don't mark as active if this tab is blocked by another tab!
    // This happens when a cookie exists but another tab already has the session
    if (sessionBlockedByAnotherTab) {
        console.log('🚫 NOT marking this tab as active - it is blocked by another tab');
        return;
    }
    
    hasActiveSession = true;
    console.log('✅ This tab is now marked as having an active session');
}

// Export function to mark this tab as not having a session
export function markSessionInactive() {
    hasActiveSession = false;
}

// Initialize the broadcast channel and wait for session check response
export async function initSessionBroadcast(): Promise<void> {
    console.log('🚀 initSessionBroadcast() called, TAB_ID =', TAB_ID);
    
    if (typeof BroadcastChannel === 'undefined') {
        console.warn('BroadcastChannel not supported');
        return;
    }

    // Don't initialize multiple times
    if (sessionChannel) {
        console.log('⚠️ BroadcastChannel already initialized, skipping');
        return;
    }

    console.log('📡 Creating new BroadcastChannel:', CHANNEL_NAME);
    sessionChannel = new BroadcastChannel(CHANNEL_NAME);

    // Listen for session events from other tabs
    sessionChannel.onmessage = (event) => {
        console.log('📨 Received message:', event.data.type, 'from tab:', event.data.tabId);
        
        // Ignore messages from this tab itself
        if (event.data.tabId === TAB_ID) {
            console.log('⏭️ Ignoring message from self');
            return;
        }
        
        if (event.data.type === 'SESSION_CREATED') {
            console.log('🔴 SESSION_CREATED received from another tab');
            // If this tab already has an active session, ignore the message
            if (hasActiveSession) {
                console.log('⏭️ This tab already has a session, ignoring SESSION_CREATED');
                return;
            }
            
            console.log('🚫 Setting sessionBlockedByAnotherTab = true (SESSION_CREATED)');
            // Set the global block flag
            sessionBlockedByAnotherTab = true;
            
            // Remove existing overlay if any
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                console.log('🗑️ Removing existing overlay (SESSION_CREATED)');
                existingOverlay.remove();
            }
            
            // Create overlay
            console.log('🎨 Creating session blocked overlay (SESSION_CREATED)');
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
            
            // Unblock this tab
            sessionBlockedByAnotherTab = false;
            
            // Remove overlay to unblock this tab
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
        } else if (event.data.type === 'SESSION_CHECK') {
            console.log('🔍 SESSION_CHECK received, hasActiveSession =', hasActiveSession);
            // Another tab is checking if there's an active session
            // Respond only if we have an active session (hasActiveSession flag)
            if (hasActiveSession) {
                console.log('📤 Responding with SESSION_ACTIVE');
                sessionChannel?.postMessage({ type: 'SESSION_ACTIVE', tabId: TAB_ID });
            }
        } else if (event.data.type === 'SESSION_ACTIVE') {
            console.log('🔴 SESSION_ACTIVE received from another tab');
            // If this tab already has an active session, ignore the message
            if (hasActiveSession) {
                console.log('⏭️ This tab already has a session, ignoring SESSION_ACTIVE');
                return;
            }
            
            console.log('🚫 Setting sessionBlockedByAnotherTab = true (SESSION_ACTIVE)');
            // Set the global block flag
            sessionBlockedByAnotherTab = true;
            
            // Remove existing overlay if any
            const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
            if (existingOverlay) {
                console.log('🗑️ Removing existing overlay (SESSION_ACTIVE)');
                existingOverlay.remove();
            }
            
            // Create overlay
            console.log('🎨 Creating session blocked overlay (SESSION_ACTIVE)');
            const overlayDiv = document.createElement('div');
            overlayDiv.id = 'sessionDisconnectedOverlay';
            overlayDiv.innerHTML = sessionDisconnectedHTML(
                'A session is already active in another tab. Please close this tab or logout from the other session.'
            );
            
            document.body.appendChild(overlayDiv);
            console.log('✅ Overlay appended to body');
            initializeSessionDisconnectedListeners();
            
            // Clear current user in this tab
            (window as any).currentUser = null;
        }
    };
    
    // Check if there's already an active session in another tab and WAIT for response
    if (!sessionChannel) {
        console.log('⚠️ sessionChannel is null, returning');
        return;
    }
    
    console.log('🔄 Starting session check with timeout...');
    return new Promise<void>((resolve) => {
        let responded = false;
        
        const timeout = setTimeout(() => {
            if (!responded) {
                responded = true;
                console.log('✅ Timeout: No active session found in other tabs (after 100ms)');
                console.log('   sessionBlockedByAnotherTab =', sessionBlockedByAnotherTab);
                resolve();
            }
        }, 100); // Wait 100ms for response
        
        // Listen for SESSION_ACTIVE response
        const originalHandler = sessionChannel!.onmessage;
        const channel = sessionChannel!;
        sessionChannel!.onmessage = (event) => {
            if (originalHandler) originalHandler.call(channel, event);
            
            if (event.data.type === 'SESSION_ACTIVE' && !responded) {
                responded = true;
                clearTimeout(timeout);
                console.log('🔴 SESSION_ACTIVE response received - blocking this tab');
                console.log('   sessionBlockedByAnotherTab =', sessionBlockedByAnotherTab);
                resolve();
            }
        };
        
        console.log('📤 Sending SESSION_CHECK message');
        sessionChannel!.postMessage({ type: 'SESSION_CHECK', tabId: TAB_ID });
    });
}

// Broadcast that a session has been created (after successful login/register)
export function broadcastSessionCreated() {
    if (sessionChannel) {
        sessionChannel.postMessage({ type: 'SESSION_CREATED', tabId: TAB_ID });
    }
}

// Broadcast that a session has been destroyed (after logout)
export function broadcastSessionDestroyed() {
    if (sessionChannel) {
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
