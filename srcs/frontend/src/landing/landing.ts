import { load } from '../navigation/utils.js';

// Entry point to bind user interactions to the landing page.
export function initLandingHandlers(): void
{
    const landingElement = document.getElementById('landing');

    if (!landingElement)
        return;

    // Prevent duplicate event bindings by checking a custom flag on the DOM element.
    if ((landingElement as any)._landingListenersSet)
        return;

    (landingElement as any)._landingListenersSet = true;

    // Define the callback to navigate to the sign-in view upon clicking.
    const handleLandingClick = async (event: MouseEvent) =>
    {
        event.preventDefault();
        await load('signIn');
    };

    // Define the callback to navigate when specific keys like Enter or Space are pressed.
    const handleLandingKeypress = async (event: KeyboardEvent) =>
    {
        if (event.key === 'Enter' || event.key === ' ')
        {
            event.preventDefault();
            await load('signIn');
        }
    };

    landingElement.addEventListener('click', handleLandingClick);
    document.addEventListener('keypress', handleLandingKeypress);

    // Create a cleanup routine to remove listeners and reset the state when leaving the page.
    const cleanup = () =>
    {
        landingElement.removeEventListener('click', handleLandingClick);
        document.removeEventListener('keypress', handleLandingKeypress);
        (landingElement as any)._landingListenersSet = false;
    };

    // Expose the cleanup function globally to allow external lifecycle management.
    window.cleanupLandingHandlers = cleanup;
}

// Trigger initialization automatically when the application signals that components are ready.
document.addEventListener('componentsReady', () =>
{
    const landingElement = document.getElementById('landing');

    if (landingElement && landingElement.innerHTML !== '')
        initLandingHandlers();
});