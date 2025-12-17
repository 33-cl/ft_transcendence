import { sessionDisconnectedHTML } from '../navigation/sessionDisconnected.html.js';

const CHANNEL_NAME = 'ft_transcendence_session';

// Global references to the communication channel and the blocking state.
let sessionChannel: BroadcastChannel | null = null;
let sessionBlockedByAnotherTab = false;

// unique identifier for the current tab instance to distinguish self-sent messages.
const TAB_ID = Math.random().toString(36).substring(7);
let hasActiveSession = false;
let isSessionOwner = false;

// Watchdog timer reference used to enforce overlay persistence.
let overlayWatchdog: number | null = null;

// DOM observer reference used to detect unauthorized removal of the overlay.
let overlayObserver: MutationObserver | null = null;

// Registry of external tab IDs known to hold active sessions.
const knownSessionTabs = new Set<string>();

// Buffer for timestamp tracking to enforce rate limits on incoming messages.
const messageTimestamps: number[] = [];
const MAX_MESSAGES_PER_MINUTE = 10;

// Initialize the cross-tab communication channel and query for existing sessions.
export async function initSessionBroadcast(): Promise<void>
{
    // Abort if the browser does not support the required API.
    if (typeof BroadcastChannel === 'undefined')
        return;

    // Prevent re-initialization if the channel already exists.
    if (sessionChannel)
        return;

    sessionChannel = new BroadcastChannel(CHANNEL_NAME);
    sessionChannel.onmessage = handleIncomingMessage;

    await checkForExistingSession();
}

// Notify all other tabs that a new session has been established in this instance.
export function broadcastSessionCreated()
{
    if (sessionChannel)
        sessionChannel.postMessage({ type: 'SESSION_CREATED', tabId: TAB_ID });
}

// Notify all other tabs that the session in this instance has ended.
export function broadcastSessionDestroyed()
{
    if (sessionChannel)
        sessionChannel.postMessage({ type: 'SESSION_DESTROYED', tabId: TAB_ID });
}

// Teardown routine to close channels and stop all monitoring processes.
export function cleanupSessionBroadcast()
{
    if (sessionChannel)
    {
        sessionChannel.close();
        sessionChannel = null;
    }

    if (overlayWatchdog !== null)
    {
        clearInterval(overlayWatchdog);
        overlayWatchdog = null;
    }

    if (overlayObserver !== null)
    {
        overlayObserver.disconnect();
        overlayObserver = null;
    }
}

// Return the current blocking status of the tab.
export function isSessionBlocked(): boolean
{
    return sessionBlockedByAnotherTab;
}

// Flag this tab as the owner of the active session to prevent self-blocking.
export function markSessionActive()
{
    if (sessionBlockedByAnotherTab)
        return;

    hasActiveSession = true;
    isSessionOwner = true;
    knownSessionTabs.add(TAB_ID);
}

// Reset session flags and stop defense mechanisms upon logout.
export function markSessionInactive()
{
    hasActiveSession = false;
    isSessionOwner = false;

    if (overlayWatchdog !== null)
    {
        clearInterval(overlayWatchdog);
        overlayWatchdog = null;
    }

    if (overlayObserver !== null)
    {
        overlayObserver.disconnect();
        overlayObserver = null;
    }
}

// Inject the blocking overlay into the DOM, replacing any existing instances.
function createBlockedOverlay(message: string)
{
    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');

    if (existingOverlay)
        existingOverlay.remove();

    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'sessionDisconnectedOverlay';
    overlayDiv.innerHTML = sessionDisconnectedHTML(message);

    overlayDiv.setAttribute('data-protected', 'true');

    document.body.appendChild(overlayDiv);
}

// Monitor the DOM for removal of the overlay and immediately restore it if tampered with.
function startOverlayMutationObserver()
{
    if (overlayObserver)
        overlayObserver.disconnect();

    overlayObserver = new MutationObserver((mutations) =>
    {
        if (!sessionBlockedByAnotherTab)
            return;

        for (const mutation of mutations)
        {
            if (mutation.type === 'childList')
            {
                for (const removedNode of mutation.removedNodes)
                {
                    if (removedNode instanceof HTMLElement && removedNode.id === 'sessionDisconnectedOverlay')
                    {
                        // Use a timeout to break the synchronous deletion cycle and restore the element.
                        setTimeout(() =>
                        {
                            if (sessionBlockedByAnotherTab && !document.getElementById('sessionDisconnectedOverlay'))
                            {
                                createBlockedOverlay('A session is active in another tab. Please close this tab or logout from the other session.');
                            }
                        }, 0);
                    }
                }
            }
        }
    });

    overlayObserver.observe(document.body, {
        childList: true,
        subtree: false
    });
}

// Backup timer to periodically enforce the presence of the overlay if the observer is bypassed.
function startOverlayWatchdog()
{
    if (overlayWatchdog !== null)
        clearInterval(overlayWatchdog);

    overlayWatchdog = window.setInterval(() =>
    {
        if (sessionBlockedByAnotherTab)
        {
            const overlay = document.getElementById('sessionDisconnectedOverlay');
            if (!overlay)
                createBlockedOverlay('A session is active in another tab. Please close this tab or logout from the other session.');
        }
    }, 200);
}

// Verify the integrity and structure of incoming message payloads.
function isValidMessage(data: any): boolean
{
    if (data === null || data === undefined || typeof data !== 'object')
        return false;
    if (!data.type || !data.tabId)
        return false;
    return true;
}

// Implement a sliding window rate limiter to reject excessive messages.
function isRateLimited(): boolean
{
    const now = Date.now();
    messageTimestamps.push(now);

    // Prune timestamps older than the one-minute window.
    while (messageTimestamps.length > 0 && messageTimestamps[0]! < now - 60000)
        messageTimestamps.shift();

    return messageTimestamps.length > MAX_MESSAGES_PER_MINUTE;
}

// Activate the blocking state and engage defense mechanisms against removal.
function blockThisTab(message: string)
{
    sessionBlockedByAnotherTab = true;
    createBlockedOverlay(message);
    startOverlayMutationObserver();
    startOverlayWatchdog();
    window.currentUser = null;
}

// Deactivate the blocking state and clean up monitoring processes.
function unblockThisTab()
{
    sessionBlockedByAnotherTab = false;

    if (overlayWatchdog !== null)
    {
        clearInterval(overlayWatchdog);
        overlayWatchdog = null;
    }
    if (overlayObserver !== null)
    {
        overlayObserver.disconnect();
        overlayObserver = null;
    }

    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');
    if (existingOverlay)
        existingOverlay.remove();
}

// Handle notification of a new session created elsewhere; block self if not already active.
function handleSessionCreated(tabId: string)
{
    knownSessionTabs.add(tabId);

    if (hasActiveSession)
        return;

    blockThisTab('A session was just created in another tab. Please close this tab or logout from the other session.');
}

// Handle notification of a session teardown; unblock self if not the owner.
function handleSessionDestroyed(tabId: string)
{
    if (!knownSessionTabs.has(tabId))
        return;

    if (!hasActiveSession && !isSessionOwner)
    {
        knownSessionTabs.delete(tabId);
        unblockThisTab();
    }
}

// Respond to status checks from other tabs if this instance holds the active session.
function handleSessionCheck()
{
    if (hasActiveSession)
        sessionChannel?.postMessage({ type: 'SESSION_ACTIVE', tabId: TAB_ID });
}

// Handle confirmation that another tab is active; block self immediately.
function handleSessionActive(tabId: string)
{
    knownSessionTabs.add(tabId);

    if (hasActiveSession)
        return;

    blockThisTab('A session is already active in another tab. Please close this tab or logout from the other session.');
}

// Router for processing validated messages received from the broadcast channel.
function handleIncomingMessage(event: MessageEvent)
{
    if (!isValidMessage(event.data))
        return;

    if (isRateLimited())
        return;

    // Filter out messages originating from this specific tab instance.
    if (event.data.tabId === TAB_ID)
        return;

    switch (event.data.type)
    {
        case 'SESSION_CREATED':
            handleSessionCreated(event.data.tabId);
            break;
        case 'SESSION_DESTROYED':
            handleSessionDestroyed(event.data.tabId);
            break;
        case 'SESSION_CHECK':
            handleSessionCheck();
            break;
        case 'SESSION_ACTIVE':
            handleSessionActive(event.data.tabId);
            break;
    }
}

// broadcast a query to discover existing sessions and wait for a potential response.
function checkForExistingSession(): Promise<void>
{
    return new Promise<void>((resolve) =>
    {
        let responded = false;

        // Fallback timeout to proceed if no other tabs respond within the window.
        const timeout = setTimeout(() =>
        {
            if (!responded)
            {
                responded = true;
                resolve();
            }
        }, 100);

        const originalHandler = sessionChannel!.onmessage;
        const channel = sessionChannel!;

        // Temporarily override the handler to capture the immediate response to the check.
        sessionChannel!.onmessage = (event) =>
        {
            if (originalHandler)
                originalHandler.call(channel, event);

            if (event.data?.type === 'SESSION_ACTIVE' && !responded)
            {
                responded = true;
                clearTimeout(timeout);
                resolve();
            }
        };

        sessionChannel!.postMessage({ type: 'SESSION_CHECK', tabId: TAB_ID });
    });
}