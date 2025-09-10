// pongControls.ts
// Gère les contrôles clavier et l'envoi des mouvements de raquette au backend

// Le backend envoie le paddle attribué lors du joinRoom : { room: ..., paddle: 'A'|'B'|'C'|'left'|'right' }
(window as any).controlledPaddle = null;

function sendKeyEvent(type: 'keydown' | 'keyup', player: 'A' | 'B' | 'C' | 'D' | 'left' | 'right', direction: 'up' | 'down') {
    // Log des touches actives pour debug visuel
    if (type === 'keydown') {
        console.log(`🎮 Touche active: ${player} ${direction}`);
    }
    
    // console.log(`[FRONT] sendKeyEvent: type=${type}, player=${player}, direction=${direction}, controlledPaddle=${(window as any).controlledPaddle}`);
    if ((window as any).isLocalGame) {
        (window as any).sendMessage(type, { player, direction });
    } else {
        if ((window as any).controlledPaddle === player) {
            (window as any).sendMessage(type, { player, direction });
        }
    }
}

// Mapping dynamique selon le mode de jeu
let keyToMove: Record<string, { player: 'A' | 'B' | 'C' | 'D' | 'left' | 'right', direction: 'up' | 'down' }> = {};

function updatePaddleKeyBindings() {
    const paddle = (window as any).controlledPaddle;
    const isLocal = (window as any).isLocalGame;
    
    if (isLocal) {
        let paddles = paddle;
        if (Array.isArray(paddle) && paddle.length === 2 && paddle.includes('A') && paddle.includes('C')) {
            paddles = ['left', 'right'];
        }
        if (Array.isArray(paddles)) {
            keyToMove = {};
            // 1v1 local : left/right (patch appliqué)
            if (!(window as any).aiMode){
                if (paddles.includes('left')) {
                    keyToMove['w'] = { player: 'left', direction: 'up' };
                    keyToMove['s'] = { player: 'left', direction: 'down' };
                }
            }
            if (paddles.includes('right')) {
                keyToMove['ArrowUp'] = { player: 'right', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'right', direction: 'down' };
            }
            // 1v1v1v1 local : A/B/C/D 
            if (paddles.includes('A')) {
                keyToMove['w'] = { player: 'A', direction: 'up' };
                keyToMove['s'] = { player: 'A', direction: 'down' };
            }
            if (paddles.includes('B')) {
                // Paddle B est horizontal : i = gauche, k = droite
                keyToMove['i'] = { player: 'B', direction: 'up' }; // up = gauche pour paddle horizontal
                keyToMove['k'] = { player: 'B', direction: 'down' }; // down = droite pour paddle horizontal
            }
            if (paddles.includes('C')) {
                keyToMove['ArrowUp'] = { player: 'C', direction: 'up' };
                keyToMove['ArrowDown'] = { player: 'C', direction: 'down' };
            }
            if (paddles.includes('D')) {
                // Paddle D est horizontal : v = gauche, b = droite
                keyToMove['v'] = { player: 'D', direction: 'up' }; // up = gauche pour paddle horizontal
                keyToMove['b'] = { player: 'D', direction: 'down' }; // down = droite pour paddle horizontal
            }
        } 
        else if (['A', 'B', 'C', 'D'].includes(paddle)) {
            // Cas fallback (jamais utilisé normalement)
            keyToMove = {
                w: { player: 'A', direction: 'up' },
                s: { player: 'A', direction: 'down' },
                i: { player: 'B', direction: 'up' }, // up = gauche pour paddle B horizontal
                k: { player: 'B', direction: 'down' }, // down = droite pour paddle B horizontal
                ArrowUp: { player: 'C', direction: 'up' },
                ArrowDown: { player: 'C', direction: 'down' },
                v: { player: 'D', direction: 'up' }, // up = gauche pour paddle D horizontal
                b: { player: 'D', direction: 'down' } // down = droite pour paddle D horizontal
            };
        }
    }
    else {
        // Mode online : chaque joueur utilise les flèches directionnelles
        
        if (paddle === 'A' || paddle === 'B' || paddle === 'C' || paddle === 'D') {
            keyToMove = {
                ArrowUp: { player: paddle, direction: 'up' },
                ArrowDown: { player: paddle, direction: 'down' }
            };
        } else if (paddle === 'left') {
            keyToMove = {
                ArrowUp: { player: 'left', direction: 'up' },
                ArrowDown: { player: 'left', direction: 'down' }
            };
        } else if (paddle === 'right') {
            keyToMove = {
                ArrowUp: { player: 'right', direction: 'up' },
                ArrowDown: { player: 'right', direction: 'down' }
            };
        } else {
            keyToMove = {};
        }
    }
}

// Met à jour le mapping lors de l'attribution du paddle (événement roomJoined)
if (!(window as any)._pongControlsRoomJoinedListener) {
    (window as any)._pongControlsRoomJoinedListener = true;
    document.addEventListener('roomJoined', () => {
        updatePaddleKeyBindings();
    });
}

(window as any).setIsLocalGame = (isLocal: boolean) => {
    (window as any).isLocalGame = isLocal;
    updatePaddleKeyBindings();
    // Mettre à jour l'affichage du sélecteur de difficulté
    setTimeout(updateDifficultySelector, 100); // Petit délai pour s'assurer que le DOM est prêt
};

updatePaddleKeyBindings(); // Initial

// Expose the function globally so websocket.ts can call it
(window as any).updatePaddleKeyBindings = updatePaddleKeyBindings;

const pressedKeys: Record<string, boolean> = {};

// Fonction de nettoyage des contrôles
export function cleanupPongControls(): void {
    keyToMove = {};
    (window as any).controlledPaddle = null;
    (window as any).isLocalGame = false;
    (window as any)._pongControlsRoomJoinedListener = false;
    
    Object.keys(pressedKeys).forEach(key => {
        pressedKeys[key] = false;
    });
}

// Expose la fonction de cleanup globalement
(window as any).cleanupPongControls = cleanupPongControls;

document.addEventListener("keydown", function (e) {
    const move = keyToMove[e.key as string];
    if (move && !pressedKeys[e.key]) {
        sendKeyEvent('keydown', move.player, move.direction);
        pressedKeys[e.key] = true;
    }
});

document.addEventListener("keyup", function (e) {
    const move = keyToMove[e.key as string];
    if (move && pressedKeys[e.key]) {
        sendKeyEvent('keyup', move.player, move.direction);
        pressedKeys[e.key] = false;
    }
});

(window as any).sendKeyEvent = sendKeyEvent;

// Affiche un message temporaire en haut de l'écran
function showIaModeBanner(enabled: boolean) {
    let banner = document.getElementById('ia-mode-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'ia-mode-banner';
        banner.style.position = 'fixed';
        banner.style.top = '20px';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.background = enabled ? '#1e90ff' : '#444';
        banner.style.color = '#fff';
        banner.style.padding = '8px 24px';
        banner.style.borderRadius = '8px';
        banner.style.zIndex = '9999';
        banner.style.fontSize = '1.1em';
        document.body.appendChild(banner);
    }
    banner.textContent = enabled ? 'Mode IA activé 🤖' : 'Mode IA désactivé';
    banner.style.display = 'block';
    setTimeout(() => {
        if (banner) banner.style.display = 'none';
    }, 1200);
}

// Patch global pour afficher le feedback lors du changement de mode IA
Object.defineProperty(window, 'aiMode', {
    set: function (val) {
        (this as any)._aiMode = val;
        showIaModeBanner(val);
        updateDifficultySelector(); // Met à jour l'affichage du sélecteur de difficulté
    },
    get: function () {
        return (this as any)._aiMode;
    },
    configurable: true
});
// Valeur initiale
(window as any)._aiMode = false;

// =============================================================================
// SYSTÈME DE DIFFICULTÉ IA
// =============================================================================

// Types de difficulté disponibles
type AIDifficulty = 'easy' | 'medium' | 'hard';

// Difficulté par défaut
let currentAIDifficulty: AIDifficulty = 'medium';

// Fonction pour afficher/masquer le sélecteur de difficulté selon le mode de jeu
function updateDifficultySelector() {
    const selector = document.getElementById('ai-difficulty-selector');
    const isLocalGame = (window as any).isLocalGame;
    const aiModeActive = (window as any).aiMode;
    
    if (selector) {
        // Afficher le sélecteur uniquement en mode jeu local avec IA activée
        if (isLocalGame && aiModeActive) {
            selector.style.display = 'flex';
        } else {
            selector.style.display = 'none';
        }
    }
}

// Fonction pour initialiser le sélecteur de difficulté
function initAIDifficultySelector() {
    const select = document.getElementById('ai-difficulty') as HTMLSelectElement;
    if (!select) return;

    // Charger la difficulté sauvegardée depuis localStorage
    const savedDifficulty = localStorage.getItem('aiDifficulty') as AIDifficulty;
    if (savedDifficulty && ['easy', 'medium', 'hard'].includes(savedDifficulty)) {
        currentAIDifficulty = savedDifficulty;
        select.value = savedDifficulty;
    }

    // Gérer les changements de difficulté
    select.addEventListener('change', (event) => {
        const newDifficulty = (event.target as HTMLSelectElement).value as AIDifficulty;
        setAIDifficulty(newDifficulty);
    });

    console.log(`🎮 Sélecteur de difficulté IA initialisé : ${currentAIDifficulty}`);
}
