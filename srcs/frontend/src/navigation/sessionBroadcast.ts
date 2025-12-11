
// Empeche qu'un utilisateur ouvre plusieurs onglets avec la meme session
// Utilise l'API BroadcastChannel pour communiquer entre les onglets du navigateur
//
// FONCTIONNEMENT:
// 1 Quand un onglet se connecte, il envoie SESSION_CHECK pour voir si un autre onglet a deja une session
// 2 Si un autre onglet repond SESSION_ACTIVE, l'onglet courant est bloque avec un overlay
// 3 Quand un onglet se deconnecte, il envoie SESSION_DESTROYED pour debloquer les autres
//
// SECURITE:
// - Rate limiting pour eviter les attaques DoS
// - Validation des messages recus
// - Verification des tabId connus avant de debloquer
// - MutationObserver + Watchdog pour empecher la suppression de l'overlay

import { sessionDisconnectedHTML } from '../navigation/sessionDisconnected.html.js';

// Nom du canal de communication entre onglets
const CHANNEL_NAME = 'ft_transcendence_session';

// Canal BroadcastChannel pour la communication entre onglets
let sessionChannel: BroadcastChannel | null = null;
let sessionBlockedByAnotherTab = false;

// Id onglet (evite de s auto bloquer)
const TAB_ID = Math.random().toString(36).substring(7);
let hasActiveSession = false;
let isSessionOwner = false;

// Timer du watchdog qui verifie periodiquement si l'overlay existe
let overlayWatchdog: number | null = null;

// Observer qui detecte si l'overlay est supprime du DOM
let overlayObserver: MutationObserver | null = null;

// Set des tabId qui ont une session confirmee (pour valider SESSION_DESTROYED)
const knownSessionTabs = new Set<string>();

// Rate limiting: stocke les timestamps des messages recus
const messageTimestamps: number[] = [];
const MAX_MESSAGES_PER_MINUTE = 10;


// Initialise le canal de communication et verifie si un autre onglet a une session
export async function initSessionBroadcast(): Promise<void>
{
    // si le nav use pas broadcastchannel
    if (typeof BroadcastChannel === 'undefined')
        return;

    // si on a deja cree le canal
    if (sessionChannel)
        return;

    // Cree le canal de communication
    sessionChannel = new BroadcastChannel(CHANNEL_NAME);
    
    // Attache le handler de messages
    sessionChannel.onmessage = handleIncomingMessage;
    
    // Verifie si un autre onglet a deja une session
    await checkForExistingSession();
}

// Annonce aux autres onglets qu une session a ete creee (appele apres login)
export function broadcastSessionCreated()
{
    if (sessionChannel)
        sessionChannel.postMessage({ type: 'SESSION_CREATED', tabId: TAB_ID });
}

// Annonce aux autres onglets que la session est detruite (appele apres logout)
export function broadcastSessionDestroyed()
{
    if (sessionChannel)
        sessionChannel.postMessage({ type: 'SESSION_DESTROYED', tabId: TAB_ID });
}

// Nettoie toutes les ressources du module
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


// Verifie si cet onglet est bloque par un autre onglet
export function isSessionBlocked(): boolean
{
    return sessionBlockedByAnotherTab;
}

// Marque cet onglet comme ayant une session active (appele apres login reussi)
// ne pas marquer comme actif si on est deja bloque par un autre onglet
// arrive quand un cookie existe mais qu un autre onglet a deja la session
export function markSessionActive()
{
    if (sessionBlockedByAnotherTab)
        return;
    
    hasActiveSession = true;
    isSessionOwner = true;
    knownSessionTabs.add(TAB_ID);
}

// Marque cet onglet comme n ayant plus de session (appele apres logout)
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

// Cree et affiche l overlay qui bloque l interface (supprime l ancien si il y en a un)
function createBlockedOverlay(message: string)
{
    const existingOverlay = document.getElementById('sessionDisconnectedOverlay');

    if (existingOverlay)
        existingOverlay.remove();
    
    // Cree le nouvel overlay
    const overlayDiv = document.createElement('div');
    overlayDiv.id = 'sessionDisconnectedOverlay';
    overlayDiv.innerHTML = sessionDisconnectedHTML(message);
    
    // Attribut pour identifier l overlay comme protege
    overlayDiv.setAttribute('data-protected', 'true');
    
    document.body.appendChild(overlayDiv);
}

//Empeche la suppression manuelle

// MutationObserver detecte si l'overlay est supprime du DOM
//itere sur chaque changement du dom, si jamais c'est notre overlay on le recree
function startOverlayMutationObserver()
{
    if (overlayObserver)
        overlayObserver.disconnect();
    
    overlayObserver = new MutationObserver((mutations) => {
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
                        setTimeout(() => {
                            if (sessionBlockedByAnotherTab && !document.getElementById('sessionDisconnectedOverlay')) {
                                createBlockedOverlay('A session is active in another tab. Please close this tab or logout from the other session.');
                            }
                        }, 0);
                    }
                }
            }
        }
    });
    
    // Observe le body pour detecter les suppressions d'enfants directs
    overlayObserver.observe(document.body, {
        childList: true,
        subtree: false
    });
}

// check toutes les 200ms si l overlay est tjrs la
function startOverlayWatchdog()
{
    if (overlayWatchdog !== null)
        clearInterval(overlayWatchdog);
    
    overlayWatchdog = window.setInterval(() => {
        if (sessionBlockedByAnotherTab)
        {
            const overlay = document.getElementById('sessionDisconnectedOverlay');
            if (!overlay)
                createBlockedOverlay('A session is active in another tab. Please close this tab or logout from the other session.');
        }
    }, 200);
}

function isValidMessage(data: any): boolean
{
    if (data === null || data === undefined || typeof data !== 'object')
        return false;
    if (!data.type || !data.tabId)
        return false;
    return true;
}

// Verifie si on depasse la limite de messages par minute
function isRateLimited(): boolean
{
    const now = Date.now();
    messageTimestamps.push(now);
    
    // Supprime les timestamps de plus d une minute
    while (messageTimestamps.length > 0 && messageTimestamps[0]! < now - 60000)
        messageTimestamps.shift();
    
    return messageTimestamps.length > MAX_MESSAGES_PER_MINUTE;
}

// Bloque cet onglet car un autre a une session active
function blockThisTab(message: string)
{
    sessionBlockedByAnotherTab = true;
    createBlockedOverlay(message);
    startOverlayMutationObserver();
    startOverlayWatchdog();
    window.currentUser = null;
}

// Debloque cet onglet (quand l autre onglet se deconnecte)
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

// Un autre onglet vient de se connecter, on ne te bloque que si tu n a pas de session active
function handleSessionCreated(tabId: string)
{
    knownSessionTabs.add(tabId);
    
    if (hasActiveSession)
        return;
    
    blockThisTab('A session was just created in another tab. Please close this tab or logout from the other session.');
}

// Un autre onglet s est deconnecte
function handleSessionDestroyed(tabId: string)
{
    if (!knownSessionTabs.has(tabId))
        return;
    
    // Ne debloque que si cet onglet n est pas le proprietaire de la session
    if (!hasActiveSession && !isSessionOwner)
    {
        knownSessionTabs.delete(tabId);
        unblockThisTab();
    }
}

// Un autre onglet demande s il y a une session active
function handleSessionCheck()
{
    if (hasActiveSession)
        sessionChannel?.postMessage({ type: 'SESSION_ACTIVE', tabId: TAB_ID });
}

// Un autre onglet a une session
function handleSessionActive(tabId: string)
{
    knownSessionTabs.add(tabId);
    
    if (hasActiveSession)
        return;
    
    blockThisTab('A session is already active in another tab. Please close this tab or logout from the other session.');
}


// Recoit et dispatch les messages des autres onglets
function handleIncomingMessage(event: MessageEvent)
{
    if (!isValidMessage(event.data))
        return;
    
    if (isRateLimited())
        return;
    
    // skip ses propres messages
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


// Envoie session_check et attend une reponse
function checkForExistingSession(): Promise<void>
{
    return new Promise<void>((resolve) => {
        let responded = false;
        
        // Timeout si pas de reponse apres 100ms on considere qu il n y a pas d autre session
        const timeout = setTimeout(() => {
            if (!responded)// ne pas resolve deux fois
            {
                responded = true;
                resolve();
            }
        }, 100);
        
        const originalHandler = sessionChannel!.onmessage;
        const channel = sessionChannel!;
        
        sessionChannel!.onmessage = (event) => {
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
