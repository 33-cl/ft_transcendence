// Extends the global Window object to track temporary avatar state during the upload workflow
// These properties store the pending avatar file, its temporary server URL, and whether a save action is required
declare global
{
    interface Window
    {
        tempAvatarUrl?: string;
        temporaryAvatarFile?: File;
        hasPendingAvatar?: boolean;
    }
}

// Handles the temporary upload of an avatar image to the server
// Validates file size and type before sending, then stores the temporary URL for later confirmation
async function uploadTempAvatar(file: File): Promise<{ ok: boolean; error?: string; message?: string; temp_avatar_url?: string }>
{
    const maxSizeInMB = 10;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    // Reject files exceeding the 10MB size limit before attempting upload
    if (file.size > maxSizeInBytes)
        return { ok: false, error: `File size too large. Maximum allowed: ${maxSizeInMB}MB` };

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    
    // Only accept standard web-compatible image formats
    if (!allowedTypes.includes(file.type))
        return { ok: false, error: 'Invalid file type. Only JPEG, PNG and GIF are allowed.' };

    const formData = new FormData();
    formData.append('avatar', file);

    try
    {
        // Send the file to the server endpoint responsible for temporary avatar storage
        const response = await fetch('/auth/avatar/upload',
        {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await response.json();

        if (!response.ok)
        {
            // Handle specific HTTP 413 payload too large error with clearer messaging
            if (response.status === 413)
                return { ok: false, error: 'File too large (maximum 10MB allowed)' };
            
            return { ok: false, error: data.error || 'Avatar upload failed' };
        }

        return { ok: true, message: data.message || 'Avatar uploaded', temp_avatar_url: data.temp_avatar_url };
    }
    catch (error)
    {
        // Catches connection failures or other network-related issues
        return { ok: false, error: 'Network error. Please check your connection and try again.' };
    }
}

// Confirms and permanently saves the temporarily uploaded avatar to the user profile
// This is called when the user clicks the Save button after selecting a new avatar
export async function saveAvatar(): Promise<{ ok: boolean; error?: string; message?: string; avatar_url?: string }>
{
    const tempAvatarUrl = window.tempAvatarUrl;
    
    // Ensure there is actually a pending avatar before attempting to save
    if (!tempAvatarUrl)
        return { ok: false, error: 'No avatar to save' };

    try
    {
        // Request the server to move the temporary avatar to permanent storage
        const response = await fetch('/auth/avatar/save',
        {
            method: 'POST',
            credentials: 'include',
            headers:
            {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ temp_avatar_url: tempAvatarUrl })
        });

        const data = await response.json();

        if (!response.ok)
            return { ok: false, error: data.error || 'Avatar save failed' };

        // Clean up the temporary state now that the avatar is permanently saved
        delete window.tempAvatarUrl;
        window.hasPendingAvatar = false;

        return { ok: true, message: data.message || 'Avatar saved successfully', avatar_url: data.avatar_url };
    }
    catch (error)
    {
        return { ok: false, error: 'Network error' };
    }
}

// Removes the current avatar and restores the default profile picture
// This provides users with a way to revert to the system default avatar
async function resetAvatar(): Promise<{ ok: boolean; error?: string; message?: string; avatar_url?: string }>
{
    try
    {
        // Request the server to delete the custom avatar and return to default
        const response = await fetch('/auth/avatar/reset',
        {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok)
            return { ok: false, error: data.error || 'Avatar reset failed' };

        return { ok: true, message: data.message || 'Avatar reset successfully', avatar_url: data.avatar_url };
    }
    catch (error)
    {
        return { ok: false, error: 'Network error' };
    }
}

// Initializes all event handlers for avatar management interface
// Sets up listeners for changing, deleting, and uploading avatar images
export function initAvatarHandlers(): void
{
    const changeBtn = document.getElementById('change-pp');
    const deleteBtn = document.getElementById('delete-pp');
    const fileInput = document.getElementById('avatarUpload') as HTMLInputElement;

    // Abort initialization if required DOM elements are missing
    if (!changeBtn || !fileInput)
        return;

    // Prevent duplicate event listeners by checking if already initialized
    if (!(changeBtn as any)._listenerSet)
    {
        (changeBtn as any)._listenerSet = true;
        
        // Clicking the Change button triggers the hidden file input dialog
        changeBtn.addEventListener('click', () =>
        {
            fileInput.click();
        });
    }

    // Prevent duplicate event listeners by checking if already initialized
    if (!(fileInput as any)._listenerSet)
    {
        (fileInput as any)._listenerSet = true;
        
        // Handles the file selection and upload process when user chooses an avatar
        fileInput.addEventListener('change', async () =>
        {
            const file = fileInput.files?.[0];
            
            // Exit if no file was actually selected
            if (!file)
                return;

            // Store the selected file temporarily in window state
            window.temporaryAvatarFile = file;

            const messageEl = document.getElementById('settings-message');
            const saveButton = document.querySelector('#settings-buttons button:first-child') as HTMLButtonElement;
            
            // Display upload progress feedback to the user
            if (messageEl)
            {
                messageEl.style.display = 'block';
                messageEl.style.color = '#fbbf24';
                messageEl.textContent = 'Uploading avatar... Please wait';
            }
            
            // Disable the Save button during upload to prevent premature save attempts
            if (saveButton)
            {
                saveButton.disabled = true;
                saveButton.style.opacity = '0.5';
                saveButton.style.cursor = 'not-allowed';
            }

            // Perform the actual upload operation to the server
            const result = await uploadTempAvatar(file);

            // Re-enable the Save button once upload completes
            if (saveButton)
            {
                saveButton.disabled = false;
                saveButton.style.opacity = '1';
                saveButton.style.cursor = 'pointer';
            }

            // Update the user interface with success or error status
            if (messageEl)
            {
                messageEl.style.display = 'block';
                
                if (result.ok)
                {
                    messageEl.style.color = '#22c55e';
                    messageEl.textContent = 'Avatar change pending - click [SAVE] to apply';
                    
                    // Store the temporary server URL for later confirmation via saveAvatar
                    if (result.temp_avatar_url)
                    {
                        window.tempAvatarUrl = result.temp_avatar_url;
                        window.hasPendingAvatar = true;
                    }
                }
                else
                {
                    messageEl.style.color = '#ef4444';
                    messageEl.textContent = result.error!;
                    window.hasPendingAvatar = false;
                }
            }

            // Clear the input to allow re-uploading the same file if needed
            fileInput.value = '';
        });
    }

    // Set up the delete button to trigger avatar reset to default
    if (deleteBtn)
    {
        // Prevent duplicate event listeners by checking if already initialized
        if (!(deleteBtn as any)._listenerSet)
        {
            (deleteBtn as any)._listenerSet = true;
            
            // Clicking delete removes the custom avatar and restores default
            deleteBtn.addEventListener('click', async () =>
            {
                const result = await resetAvatar();
                
                const messageEl = document.getElementById('settings-message');
                
                // Provide visual feedback on whether the reset succeeded or failed
                if (messageEl)
                {
                    messageEl.style.display = 'block';
                    
                    if (result.ok)
                    {
                        messageEl.style.color = '#22c55e';
                        messageEl.textContent = 'Avatar reset to default';
                        
                        // Update the current user object with the new default avatar URL
                        if (result.avatar_url && window.currentUser)
                            window.currentUser.avatar_url = result.avatar_url;
                        
                        // Trigger a refresh of UI components that display the avatar
                        if (window.refreshUserStats)
                            window.refreshUserStats();
                    }
                    else
                    {
                        messageEl.style.color = '#ef4444';
                        messageEl.textContent = result.error!;
                    }
                }
            });
        }
    }
}