import { load } from '../navigation/utils.js';
import { updateTournamentWaiting } from './matchmaking.html.js';
import
{
    socket,
    tournamentListenersSet,
    otherSemifinalUpdateListenerSet,
    setTournamentListenersSet,
    setOtherSemifinalUpdateListenerSet
} from './socketConnection.js';

export function setupTournamentListeners()
{
    if (tournamentListenersSet)
        return;

    socket.on('tournamentStart', (_data: any) =>
    {
        load('matchmaking');
        setTimeout(() =>
        {
            updateTournamentWaiting('Tournament starting...');
        }, 100);
    });
    
    socket.on('tournamentUpdate', (data: any) =>
    {
        if (data.phase === 'semifinal1' || data.phase === 'semifinal2' || data.phase === 'final')
            updateTournamentWaiting(data.message || 'Match starting...');
        else if (data.phase?.includes('complete'))
        {
            load('matchmaking');
            setTimeout(() =>
            {
                updateTournamentWaiting(data.message || 'Preparing next match...');
            }, 100);
        }
    });
    
    socket.on('tournamentSpectator', (data: any) =>
    {
        load('matchmaking');
        setTimeout(() =>
        {
            const title = document.getElementById('matchmakingTitle');
            if (title)
                title.textContent = 'TOURNAMENT';
            updateTournamentWaiting(`Watching: ${data.match?.player1 || data.currentMatch?.player1} vs ${data.match?.player2 || data.currentMatch?.player2}`);
        }, 100);
    });
    
    if (!otherSemifinalUpdateListenerSet)
    {
        socket.on('otherSemifinalUpdate', (data: any) =>
        {
            const waitingText = document.getElementById('other-semifinal-waiting-text') || document.querySelector('.waiting-text');
            if (waitingText)
            {
                if (data.finished)
                {
                    const winner = data.score1 > data.score2 ? data.player1 : data.player2;
                    waitingText.textContent = `Other semi-final: ${data.player1} vs ${data.player2} (${winner} won)`;
                }
                else
                    waitingText.textContent = `Other semi-final: ${data.player1} vs ${data.player2}`;
            }
        });
        setOtherSemifinalUpdateListenerSet(true);
    }
    
    socket.on('tournamentFinalStart', (data: any) =>
    {
        // Check if user is still in the tournament flow (waiting on semifinal finished screen or matchmaking)
        const semifinalFinishedElement = document.getElementById('tournamentSemifinalFinished');
        const matchmakingElement = document.getElementById('matchmaking');
        
        const isWaitingInSemifinal = semifinalFinishedElement && semifinalFinishedElement.innerHTML.trim() !== '';
        const isWaitingInMatchmaking = matchmakingElement && matchmakingElement.innerHTML.trim() !== '';
        
        if (!isWaitingInSemifinal && !isWaitingInMatchmaking)
            return;

        window.controlledPaddle = data.paddle;
        window.maxPlayers = 2;
        window.isSpectator = false;
        
        if (window.updatePaddleKeyBindings)
            window.updatePaddleKeyBindings();
        
        load('game');
        
        const initGame = () =>
        {
            const mapCanvas = document.getElementById('map');
            if (mapCanvas)
            {
                if (typeof window.setupGameEventListeners === 'function')
                    window.setupGameEventListeners();
                if (typeof window.initPongRenderer === 'function')
                    window.initPongRenderer('map');
            }
            else
                setTimeout(initGame, 50);
        };
        setTimeout(initGame, 100);
    });
    
    socket.on('tournamentComplete', (data: any) =>
    {
        window.isTournamentMode = false;
        alert(`🏆 Tournament Champion: ${data.winner}!`);
        load('mainMenu');
    });
    
    setTournamentListenersSet(true);
}

export function cleanupTournamentListeners()
{
    if (!tournamentListenersSet)
        return;

    socket.off('tournamentStart');
    socket.off('tournamentUpdate');
    socket.off('tournamentSpectator');
    socket.off('otherSemifinalUpdate');
    socket.off('tournamentFinalStart');
    socket.off('tournamentComplete');

    setTournamentListenersSet(false);
    setOtherSemifinalUpdateListenerSet(false);
}

window.cleanupTournamentListeners = cleanupTournamentListeners;
