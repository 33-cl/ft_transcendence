// Initializes the avatar change functionality by setting up event listeners
// Handles opening the file picker and storing the selected file temporarily
export function initAvatarChange(): void
{
    const changeButton = document.getElementById('change-pp');
    const fileInput = document.getElementById('avatarUpload') as HTMLInputElement | null;
    
    if (!changeButton || !fileInput)
        return;
    
    // Prevent duplicate event listeners by checking if already initialized
    if (!(changeButton as any)._listenerSet)
    {
        (changeButton as any)._listenerSet = true;
        
        // Trigger the hidden file input when the Change button is clicked
        changeButton.addEventListener('click', (): void =>
        {
            fileInput.click();
        });
    }
    
    // Prevent duplicate event listeners by checking if already initialized
    if (!(fileInput as any)._listenerSet)
    {
        (fileInput as any)._listenerSet = true;
        
        // Handle the file selection event and store the chosen file
        fileInput.addEventListener('change', (event: Event): void =>
        {
            const target = event.target as HTMLInputElement;
            
            // Ensure the event target exists and contains valid file data
            if (!target || !target.files || target.files.length === 0)
                return;
            
            const file = target.files[0];
            
            // Store the selected file in window state for later processing
            if (file)
                window.temporaryAvatarFile = file;
        });
    }
}