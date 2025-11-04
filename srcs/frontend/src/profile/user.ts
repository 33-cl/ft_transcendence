export function initAvatarChange(): void {
    const changeButton = document.getElementById('change-pp');
    const fileInput = document.getElementById('avatarUpload') as HTMLInputElement | null;
    
    if (!changeButton || !fileInput) {
        console.error("Éléments pour le changement d'avatar non trouvés");
        return;
    }
    
    // Ouvrir le sélecteur de fichiers au clic sur [Change]
    if (!(changeButton as any)._listenerSet) {
        (changeButton as any)._listenerSet = true;
        changeButton.addEventListener('click', (): void => {
            fileInput.click();
        });
    }
    
    // Écouter le changement de fichier avec vérification de nullité
    if (!(fileInput as any)._listenerSet) {
        (fileInput as any)._listenerSet = true;
        fileInput.addEventListener('change', (event: Event): void => {
            const target = event.target as HTMLInputElement;
            
            // Vérifications de sécurité
            if (!target || !target.files || target.files.length === 0) {
                return;
            }
            
            const file = target.files[0];
            if (file) {
                
                // Stocker temporairement le fichier pour traitement ultérieur
                window.temporaryAvatarFile = file;
            }
        });
    }
}