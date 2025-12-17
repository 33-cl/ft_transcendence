import { getSafeAvatarUrl } from '../services/avatarProxy.js';

// Sends an asynchronous API request to invite a user as a friend and updates the UI button state upon success
async function addFriend(userId: number, buttonElement?: HTMLButtonElement): Promise<void>
{
    try
    {
        const response = await fetch(`/users/${userId}/friend`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok)
        {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add friend');
        }

        // We provide immediate visual feedback by disabling the button and changing its text
        if (buttonElement)
        {
            buttonElement.textContent = 'Sent';
            buttonElement.disabled = true;
            buttonElement.classList.remove('active');
            buttonElement.classList.add('sent');
        }
    }
    catch (error)
    {
    }
}

// Handles the acceptance of a friend request, triggering a refresh of the UI lists and notification badges
async function acceptFriendRequest(requestId: number): Promise<void>
{
    try
    {
        const response = await fetch(`/users/friend-requests/${requestId}/accept`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok)
        {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to accept friend request');
        }

        await refreshFriendRequests();

        const { updateFriendRequestsBadge } = await import('./friendList.html.js');
        await updateFriendRequestsBadge();
    }
    catch (error)
    {
    }
}

// Handles the rejection of a friend request and cleans up the UI accordingly
async function rejectFriendRequest(requestId: number): Promise<void>
{
    try
    {
        const response = await fetch(`/users/friend-requests/${requestId}/reject`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok)
        {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reject friend request');
        }

        await refreshFriendRequests();

        const { updateFriendRequestsBadge } = await import('./friendList.html.js');
        await updateFriendRequestsBadge();
    }
    catch (error)
    {
    }
}

// Fetches the latest list of incoming requests from the server and re-renders the request list DOM
async function refreshFriendRequests(): Promise<void>
{
    try
    {
        const response = await fetch('/users/friend-requests/received', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok)
            throw new Error('Failed to fetch friend requests');

        const data = await response.json();
        const friendRequests = data.requests || [];

        const requestsList = document.getElementById('friendRequestsList');
        if (!requestsList)
            return;

        let requestsHTML = '';
        if (friendRequests.length > 0)
        {
            requestsHTML = friendRequests.map((request: any) => `
                <div class="friend-request-item">
                    <img src="${getSafeAvatarUrl(request.avatar_url)}" 
                         alt="${request.username}"
                        onerror="this.onerror=null;this.src='/img/planet.gif';">
                    <span>${request.username}</span>
                    <button class="friend-request-accept-btn" 
                            data-request-id="${request.request_id}">
                        ✓
                    </button>
                    <button class="friend-request-reject-btn" 
                            data-request-id="${request.request_id}">
                        ✗
                    </button>
                </div>
            `).join('');
        }
        else
        {
            requestsHTML = '<p class="friend-requests-empty">No friend requests</p>';
        }

        requestsList.innerHTML = requestsHTML;

        // We must re-attach event listeners to the newly created DOM elements
        initializeFriendRequestListeners();
    }
    catch (error)
    {
    }
}

// Sets up the search bar with debouncing to prevent excessive API calls while the user types
export function initializeAddFriendSearch(): void
{
    const searchInput = document.getElementById('friendSearch') as HTMLInputElement;
    const searchResults = document.getElementById('searchResults');
    let searchTimeout: number;

    if (searchInput && searchResults && !(searchInput as any)._listenerSet)
    {
        (searchInput as any)._listenerSet = true;

        searchInput.addEventListener('input', async (e) =>
        {
            const query = (e.target as HTMLInputElement).value.trim();

            if (searchTimeout)
                clearTimeout(searchTimeout);

            if (query.length < 2)
            {
                searchResults.classList.add('hidden');
                return;
            }

            // We use a 300ms delay to wait for the user to stop typing before sending the query
            searchTimeout = window.setTimeout(async () =>
            {
                try
                {
                    const response = await fetch(`/users/search?q=${encodeURIComponent(query)}`, {
                        method: 'GET',
                        credentials: 'include'
                    });

                    if (!response.ok)
                        throw new Error('Failed to search users');

                    const data = await response.json();
                    const users = data.users || [];

                    const { escapeHtml } = await import('../navigation/security.js');

                    if (users.length === 0)
                    {
                        searchResults.innerHTML = '<div class="search-no-results">No users found</div>';
                    }
                    else
                    {
                        // We dynamically generate the result list, ensuring all user input is escaped to prevent XSS
                        searchResults.innerHTML = users.map((user: any) =>
                        {
                            const buttonState = user.hasPendingRequest
                                ? { text: 'Sent', class: 'sent', disabled: true }
                                : { text: 'Add', class: 'active', disabled: false };

                            const safeUserId = parseInt(user.id) || 0;
                            const safeUsername = escapeHtml(user.username || 'Unknown');
                            const safeAvatarUrl = getSafeAvatarUrl(user.avatar_url);

                            return `
                                <div class="search-result-item" data-user-id="${safeUserId}">
                                    <img src="${safeAvatarUrl}" 
                                         alt="${safeUsername}"
                                         onerror="this.onerror=null;this.src='./img/planet.gif';">
                                    <span>${safeUsername}</span>
                                    <button class="add-friend-btn ${buttonState.class}" 
                                            data-user-id="${safeUserId}"
                                            ${buttonState.disabled ? 'disabled' : ''}>
                                        ${buttonState.text}
                                    </button>
                                </div>
                            `;
                        }).join('');

                        // We attach click listeners specifically to the 'Add' buttons within the dynamic results
                        const addButtons = searchResults.querySelectorAll('.add-friend-btn');
                        addButtons.forEach(button =>
                        {
                            button.addEventListener('click', async (e) =>
                            {
                                e.stopPropagation();
                                const buttonElement = e.target as HTMLButtonElement;
                                const userId = parseInt(buttonElement.dataset.userId || '0');
                                if (userId && !buttonElement.disabled)
                                {
                                    await addFriend(userId, buttonElement);
                                }
                            });
                        });
                    }

                    searchResults.classList.remove('hidden');
                }
                catch (error)
                {
                    searchResults.innerHTML = '<div class="search-error">Error searching users</div>';
                    searchResults.classList.remove('hidden');
                }
            }, 300);
        });

        // We close the search results if the user clicks anywhere outside the search interface
        if (!(document as any)._friendSearchClickListenerSet)
        {
            (document as any)._friendSearchClickListenerSet = true;

            document.addEventListener('click', (e) =>
            {
                const target = e.target as HTMLElement;
                if (!searchInput.contains(target) && !searchResults.contains(target))
                {
                    searchResults.classList.add('hidden');
                }
            });
        }
    }
}

// Configures the navigation button to return from the 'Add Friends' view to the main 'Friend List' view
export function initializeBackToFriendsButton(): void
{
    const backBtn = document.getElementById('backToFriendsBtn');
    if (backBtn && !(backBtn as any)._listenerSet)
    {
        (backBtn as any)._listenerSet = true;

        backBtn.addEventListener('click', async () =>
        {
            const { show, hide } = await import('../navigation/utils.js');
            const { initializeAddFriendsButton, initializeFriendListEventListeners, startFriendListRealtimeUpdates, fetchInitialFriendStatuses } = await import('./friendList.html.js');

            hide('addFriends');
            await show('friendList');

            // We delay the re-initialization slightly to ensure the DOM transition is complete
            setTimeout(async () =>
            {
                initializeAddFriendsButton();
                initializeFriendListEventListeners();
                startFriendListRealtimeUpdates();

                await fetchInitialFriendStatuses();

                const { updateFriendRequestsBadge } = await import('./friendList.html.js');
                await updateFriendRequestsBadge();
            }, 100);
        });
    }
}

// Attaches event listeners to the Accept/Reject buttons for incoming friend requests
export function initializeFriendRequestListeners(): void
{
    const acceptButtons = document.querySelectorAll('.friend-request-accept-btn');
    acceptButtons.forEach(button =>
    {
        // We clone the node to strip any previously existing event listeners, preventing duplicates
        const newButton = button.cloneNode(true) as HTMLElement;
        button.parentNode?.replaceChild(newButton, button);

        newButton.addEventListener('click', async (e) =>
        {
            const btn = e.currentTarget as HTMLButtonElement;
            if (btn.disabled)
                return;

            const requestId = parseInt(btn.dataset.requestId || '0');
            if (requestId)
            {
                btn.disabled = true;
                btn.textContent = '...';
                await acceptFriendRequest(requestId);
            }
        });
    });

    const rejectButtons = document.querySelectorAll('.friend-request-reject-btn');
    rejectButtons.forEach(button =>
    {
        const newButton = button.cloneNode(true) as HTMLElement;
        button.parentNode?.replaceChild(newButton, button);

        newButton.addEventListener('click', async (e) =>
        {
            const btn = e.currentTarget as HTMLButtonElement;
            if (btn.disabled)
                return;

            const requestId = parseInt(btn.dataset.requestId || '0');
            if (requestId)
            {
                btn.disabled = true;
                btn.textContent = '...';
                await rejectFriendRequest(requestId);
            }
        });
    });
}

export default {};
