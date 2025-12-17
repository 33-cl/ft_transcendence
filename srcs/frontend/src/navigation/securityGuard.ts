import { isSessionBlocked } from './sessionBroadcast.js';

// Attach a global event listener to catch and suppress specific security-related promise rejections.
export function installUnhandledRejectionHandler()
{
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) =>
    {
        // Extract the error message safely from the reason object.
        const errorMessage = event.reason?.message || event.reason || '';

        // Check against known security rejection messages to suppress console noise.
        if (typeof errorMessage === 'string' && (
            errorMessage.includes('Action blocked') ||
            errorMessage.includes('Fetch blocked') ||
            errorMessage.includes('not have an active session')
        ))
        {
            // Prevent the default browser handling (printing error to console).
            event.preventDefault();
            return;
        }

        // Allow other unrelated errors to pass through but suppress the "Uncaught" prefix in some environments.
    });
}

// Disables all interactive elements (inputs, buttons, links) when the session is marked as blocked.
export function installInputBlocker()
{
    // Helper to disable a single HTML element and remove pointer events.
    const blockElement = (el: HTMLElement) =>
    {
        if (el instanceof HTMLInputElement ||
            el instanceof HTMLButtonElement ||
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement)
        {
            el.disabled = true;
            el.style.pointerEvents = 'none';
        }

        if (el instanceof HTMLAnchorElement)
        {
            el.style.pointerEvents = 'none';
        }
    };

    // Helper to scan the entire document and disable all interactive elements if the session is blocked.
    const blockAllInteractiveElements = () =>
    {
        if (!isSessionBlocked())
            return;

        document.querySelectorAll('input, button, textarea, select, a').forEach(el =>
        {
            blockElement(el as HTMLElement);
        });
    };

    // Instantiate a MutationObserver to automatically block new elements added to the DOM dynamically.
    const observer = new MutationObserver((mutations) =>
    {
        if (!isSessionBlocked())
            return;

        mutations.forEach(mutation =>
        {
            mutation.addedNodes.forEach(node =>
            {
                if (node instanceof HTMLElement)
                {
                    // Block the new element itself if it is interactive.
                    blockElement(node);
                    // Recursively block any interactive children within the new element.
                    node.querySelectorAll('input, button, textarea, select, a').forEach(el =>
                    {
                        blockElement(el as HTMLElement);
                    });
                }
            });
        });
    });

    // Begin observing the document body for subtree modifications.
    observer.observe(document.body, { childList: true, subtree: true });

    // Perform an initial pass to block currently existing elements.
    blockAllInteractiveElements();

    // Set a fallback interval to enforce blocking in case mutations are missed or state changes rapidly.
    setInterval(blockAllInteractiveElements, 500);
}

// High-order function wrapper to prevent execution of sensitive functions if the session is blocked.
export function guardFunction<T extends (...args: any[]) => any>(
    fn: T,
    _functionName: string,
    requiresAuth: boolean = false
): T
{
    return ((...args: any[]) =>
    {
        // Immediately reject execution if the session is blocked in this tab.
        if (isSessionBlocked())
        {
            console.trace('Call stack:');
            return Promise.reject(new Error(`Action blocked: This tab does not have an active session`));
        }

        // If authentication is mandated, verify the current user exists before proceeding.
        if (requiresAuth)
        {
            const currentUser = window.currentUser;

            if (!currentUser)
                return Promise.reject(new Error(`Action blocked: User not authenticated`));
        }

        // Execute the original function if all checks pass.
        return fn(...args);
    }) as T;
}

// Boolean check to determine if actions are permissible in the current context.
export function canExecuteAction(): boolean
{
    const blocked = isSessionBlocked();
    return !blocked;
}

// High-order function wrapper for event handlers to stop propagation if the session is blocked.
export function guardEventHandler<T extends Event>(
    handler: (event: T) => void,
    _actionName: string
): (event: T) => void
{
    return (event: T) =>
    {
        if (isSessionBlocked())
        {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        handler(event);
    };
}

// Overrides the global window.fetch to intercept and block network requests when the session is invalid.
export function installFetchGuard()
{
    const originalFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    {
        const url = input?.toString() || 'unknown';

        // When blocked, intercept all requests except session validation endpoints.
        if (isSessionBlocked())
        {
            // Allow requests to /auth/me to verify session status.
            if (url.includes('/auth/me'))
                return originalFetch(input, init);

            // Return a mocked 403 Forbidden response for all other requests to avoid throwing errors.
            return Promise.resolve(new Response(JSON.stringify({ error: 'Session blocked' }), {
                status: 403,
                statusText: 'Forbidden',
                headers: { 'Content-Type': 'application/json' }
            }));
        }

        // For API routes, ensure the user is authenticated before sending the request.
        if (url.includes('/api/'))
        {
            const currentUser = window.currentUser;

            if (!currentUser)
            {
                return Promise.resolve(new Response(JSON.stringify({ error: 'Not authenticated' }), {
                    status: 401,
                    statusText: 'Unauthorized',
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
        }

        // Proceed with the standard fetch if no guards were triggered.
        return originalFetch(input, init);
    };
}

// Wraps the socket instance to prevent emitting events (except heartbeats) from blocked tabs.
export function installSocketGuard()
{
    const socket = window.socket;

    if (!socket)
    {
        console.warn('Socket not found, will retry socket guard installation later');
        return false;
    }

    // Prevent double wrapping of the socket instance.
    if ((socket as any)._guardInstalled)
        return true;

    // Cache the original emit function.
    const originalEmit = socket.emit.bind(socket);

    // Whitelist essential technical events that must pass even when blocked.
    const allowedWhenBlocked = ['ping', 'disconnect'];

    // Monkey-patch the emit function to enforce security checks.
    socket.emit = function (event: string, ...args: any[])
    {
        if (allowedWhenBlocked.includes(event))
            return originalEmit(event, ...args);

        // Silently block all other events if the session is inactive.
        if (isSessionBlocked())
            return socket; // Return socket for method chaining compatibility.

        return originalEmit(event, ...args);
    };

    (socket as any)._guardInstalled = true;
    return true;
}

// Orchestrates the installation of all security mechanisms (Fetch, Input, Socket, Promises).
export function installAllSecurityGuards()
{
    installUnhandledRejectionHandler();
    installFetchGuard();
    installInputBlocker();

    // Attempt to install the socket guard, retrying periodically until the socket is initialized.
    const checkSocket = setInterval(() =>
    {
        if (installSocketGuard())
            clearInterval(checkSocket);
    }, 100);

    // Stop retrying after a fixed timeout to prevent infinite intervals.
    setTimeout(() =>
    {
        clearInterval(checkSocket);
    }, 10000);
}