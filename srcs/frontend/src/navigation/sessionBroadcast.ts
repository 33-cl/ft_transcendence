// Session Broadcast - Communication entre onglets pour bloquer les connexions multiples

import { sessionDisconnectedHTML, initializeSessionDisconnectedListeners } from '../navigation/sessionDisconnected.html.js';

const CHANNEL_NAME = 'ft_transcendence_session';

// Create a BroadcastChannel for cross-tab communication
let sessionChannel: BroadcastChannel | null = null;

// Flag global pour bloquer toute action quand un autre onglet a une session active
let sessionBlockedByAnotherTab = false;

// Unique ID for this tab to avoid self-blocking
const TAB_ID = Math.random().toString(36).substring(7);

// Track if this tab has an active session
let hasActiveSession = false;

// Track if this tab was the one that created the session (for security)
let isSessionOwner = false;

// Interval pour recréer l'overlay s'il est supprimé
let overlayWatchdog: number | null = null;

// MutationObserver pour détecter instantanément la suppression de l'overlay
let overlayObserver: MutationObserver | null = null;

// Store known tab IDs that have confirmed sessions
const knownSessionTabs = new Set<string>();

// Rate limiting: Track message timestamps to prevent DoS
const messageTimestamps: number[] = [];
const MAX_MESSAGES_PER_MINUTE = 10;

// Export function to check if session is blocked
export function isSessionBlocked(): boolean {
    return sessionBlockedByAnotherTab;
}

// Export function to mark this tab as having an active session
export function markSessionActive() {
    
    // ⚠️ CRITICAL: Don't mark as active if this tab is blocked by another tab!
    // This happens when a cookie exists but another tab already has the session
    if (sessionBlockedByAnotherTab)
        return;
    
    hasActiveSession = true;
    isSessionOwner = true;
    knownSessionTabs.add(TAB_ID); // Register this tab as having a session
}

// Export function to mark this tab as not having a session
export function markSessionInactive() {
    hasActiveSession = false;
    isSessionOwner = false;
    
    // Stop overlay watchdog
    if (overlayWatchdog !== null) {
        clearInterval(overlayWatchdog);
        overlayWatchdog = null;
    }
    
    // Stop mutation observer
    if (overlayObserver !== null) {
        overlayObserver.disconnect();
        overlayObserver = null;
    }
}

// Helper function to create blocked overlay
function createBlockedOverlay(message: string) {
    // Remove existing overlay if any
    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
    if (existingOverlay)
        existingOverlay.remove();
    
    // Create overlay
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'sessionDisconnectedOverlay';
    overlayDiv.innerHTML = sessionDisconnectedHTML(message);
    
    // Add a data attribute to prevent removal
    overlayDiv.setAttribute('data-protected', 'true');
    
    document.body.appendChild(overlayDiv);
    initializeSessionDisconnectedListeners();
}

// MutationObserver to instantly detect and prevent overlay removal
function startOverlayMutationObserver()
{
    // Stop existing observer if any
    if (overlayObserver)
        overlayObserver.disconnect();
    
    overlayObserver = new MutationObserver((mutations) => {
        if (!sessionBlockedByAnotherTab) return;
        
        for (const mutation of mutations) {
            // Check if overlay was removed
            if (mutation.type === 'childList') {
                for (const removedNode of mutation.removedNodes) {
                    if (removedNode instanceof HTMLElement && removedNode.id === 'sessionDisconnectedOverlay') {
                        console.warn('🚨 SECURITY: Overlay removal detected! Recreating IMMEDIATELY...');
                        // Recreate overlay immediately (not after 1 second)
                        setTimeout(() => {
                            if (sessionBlockedByAnotherTab && !document.getElementById('sessionDisconnectedOverlay')) {
                                createBlockedOverlay('A session is active in another tab. Please close this tab or logout from the other session.');
                            }
                        }, 0); // Execute in next tick
                    }
                }
            }
        }
    });
    
    // Observe the body for child removals
    overlayObserver.observe(document.body, {
        childList: true,
        subtree: false
    });
}

// Watchdog to recreate overlay if it's removed by malicious user (backup to MutationObserver)
function startOverlayWatchdog() {
    // Clear existing watchdog
    if (overlayWatchdog !== null) {
        clearInterval(overlayWatchdog);
    }
    
    overlayWatchdog = window.setInterval(() => {
        if (sessionBlockedByAnotherTab) {
            const overlay = document.getElementById('sessionDisconnectedOverlay');
            if (!overlay) {
                console.warn('⚠️ Watchdog: Overlay missing! Recreating...');
                createBlockedOverlay('A session is active in another tab. Please close this tab or logout from the other session.');
            }
        }
    }, 200); // Check every 200ms instead of 1000ms
}

// Initialize the broadcast channel and wait for session check response
export async function initSessionBroadcast(): Promise<void> {
    
    if (typeof BroadcastChannel === 'undefined') {
        console.warn('BroadcastChannel not supported');
        return;
    }

    // Don't initialize multiple times
    if (sessionChannel)
        return;

    sessionChannel = new BroadcastChannel(CHANNEL_NAME);

    // Listen for session events from other tabs
    sessionChannel.onmessage = (event) => {
        // Validate message structure FIRST (before accessing properties)
        // Check event.data exists and is an object BEFORE accessing any properties
        if (event.data === null || event.data === undefined || typeof event.data !== 'object') {
            console.warn('⚠️ SECURITY: Invalid message format (not an object) - Ignoring');
            return;
        }
        
        // Now safe to access properties
        if (!event.data.type || !event.data.tabId) {
            console.warn('⚠️ SECURITY: Invalid message format (missing type or tabId) - Ignoring');
            return;
        }
        
        // SECURITY: Rate limiting to prevent DoS
        const now = Date.now();
        messageTimestamps.push(now);
        // Remove timestamps older than 1 minute
        while (messageTimestamps.length > 0 && messageTimestamps[0]! < now - 60000) {
            messageTimestamps.shift();
        }
        
        if (messageTimestamps.length > MAX_MESSAGES_PER_MINUTE) {
            console.warn('⚠️ SECURITY: Rate limit exceeded - Ignoring message');
            console.warn('   Messages in last minute:', messageTimestamps.length);
            return;
        }
        
        // Ignore messages from this tab itself
        if (event.data.tabId === TAB_ID)
            return;
        
        if (event.data.type === 'SESSION_CREATED')
        {
            
            // Register this tab as a known session holder
            knownSessionTabs.add(event.data.tabId);
            
            // If this tab already has an active session, ignore the message
            if (hasActiveSession)
                return;
            
            // Set the global block flag
            sessionBlockedByAnotherTab = true;
            
            // Create and show overlay
            createBlockedOverlay('A session was just created in another tab. Please close this tab or logout from the other session.');
            
            // Start MutationObserver for instant detection
            startOverlayMutationObserver();
            
            // Start watchdog as backup
            startOverlayWatchdog();
            
            // Clear current user in this tab only (don't logout as it would destroy the session for all tabs)
            window.currentUser = null;
        }
        else if (event.data.type === 'SESSION_DESTROYED')
        {
            
            // SECURITY: Verify this is from a known tab ID before unblocking
            if (!knownSessionTabs.has(event.data.tabId)) {
                console.warn('⚠️ SECURITY: Ignoring SESSION_DESTROYED from unknown tab:', event.data.tabId);
                console.warn('   Known tabs:', Array.from(knownSessionTabs));
                return;
            }
            
            // SECURITY: Only unblock if this tab is NOT the session owner
            // This prevents malicious tabs from sending fake SESSION_DESTROYED messages
            if (!hasActiveSession && !isSessionOwner)
            {
                sessionBlockedByAnotherTab = false;
                
                // Remove the tab from known sessions
                knownSessionTabs.delete(event.data.tabId);
                
                // Stop overlay watchdog
                if (overlayWatchdog !== null) {
                    clearInterval(overlayWatchdog);
                    overlayWatchdog = null;
                }
                
                // Stop mutation observer
                if (overlayObserver !== null) {
                    overlayObserver.disconnect();
                    overlayObserver = null;
                }
                
                // Remove overlay to unblock this tab
                const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
                if (existingOverlay) {
                    existingOverlay.remove();
                }
                
            }
        }
        else if (event.data.type === 'SESSION_CHECK')
        {
            // Another tab is checking if there's an active session
            // Respond only if we have an active session (hasActiveSession flag)
            if (hasActiveSession)
                sessionChannel?.postMessage({ type: 'SESSION_ACTIVE', tabId: TAB_ID });
        }
        else if (event.data.type === 'SESSION_ACTIVE')
        {
            
            // Register this tab as a known session holder
            knownSessionTabs.add(event.data.tabId);
            
            // If this tab already has an active session, ignore the message
            if (hasActiveSession) 
                return;
            // Set the global block flag
            sessionBlockedByAnotherTab = true;
            
            // Create and show overlay
            createBlockedOverlay('A session is already active in another tab. Please close this tab or logout from the other session.');
            
            // Start MutationObserver for instant detection
            startOverlayMutationObserver();
            
            // Start watchdog as backup
            startOverlayWatchdog();
            
            // Clear current user in this tab
            window.currentUser = null;
        }
    };
    
    // Check if there's already an active session in another tab and WAIT for response
    if (!sessionChannel)
        return;
    
    return new Promise<void>((resolve) => {
        let responded = false;
        
        const timeout = setTimeout(() => {
            if (!responded)
            {
                responded = true;
                resolve();
            }
        }, 100); // Wait 100ms for response
        
        // Listen for SESSION_ACTIVE response
        const originalHandler = sessionChannel!.onmessage;
        const channel = sessionChannel!;
        sessionChannel!.onmessage = (event) => {
            if (originalHandler) originalHandler.call(channel, event);
            
            // SECURITY: Validate message before accessing properties
            if (event.data && typeof event.data === 'object' && event.data.type === 'SESSION_ACTIVE' && !responded) {
                responded = true;
                clearTimeout(timeout);
                resolve();
            }
        };
        
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
    
    // Stop overlay watchdog
    if (overlayWatchdog !== null) {
        clearInterval(overlayWatchdog);
        overlayWatchdog = null;
    }
    
    // Stop mutation observer
    if (overlayObserver !== null) {
        overlayObserver.disconnect();
        overlayObserver = null;
    }
}

// 🔍 DEBUG MODE: Expose functions to window for console testing
// Only for development/testing purposes
if (typeof window !== 'undefined') {
    window.__sessionDebug = {
        isSessionBlocked,
        getTabId: () => TAB_ID,
        getKnownTabs: () => Array.from(knownSessionTabs),
        hasActiveSession: () => hasActiveSession,
        isSessionOwner: () => isSessionOwner,
        overlayWatchdogActive: () => overlayWatchdog !== null
    };
}
