export function initAvatarChange() {
    const changeButton = document.getElementById('change-pp');
    const fileInput = document.getElementById('avatarUpload');
    if (!changeButton || !fileInput) {
        console.error("Éléments pour le changement d'avatar non trouvés");
        return;
    }
    // Ouvrir le sélecteur de fichiers au clic sur [Change]
    changeButton.addEventListener('click', () => {
        fileInput.click();
    });
    // Écouter le changement de fichier avec vérification de nullité
    fileInput.addEventListener('change', (event) => {
        const target = event.target;
        // Vérifications de sécurité
        if (!target || !target.files || target.files.length === 0) {
            console.log("Aucun fichier sélectionné");
            return;
        }
        const file = target.files[0];
        if (file) {
            console.log("Fichier sélectionné:", file.name, "- Type:", file.type, "- Taille:", file.size, "bytes");
            // Stocker temporairement le fichier pour traitement ultérieur
            window.temporaryAvatarFile = file;
        }
    });
}
//# sourceMappingURL=user.js.map