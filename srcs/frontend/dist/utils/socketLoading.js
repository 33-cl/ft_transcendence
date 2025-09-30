// socketLoading.ts
// Gestion centralisée de l'écran de chargement socket et de la connexion
export function showSocketLoadingScreen() {
    if (document.getElementById('socketLoadingScreen'))
        return;
    document.body.insertAdjacentHTML('beforeend', `
		<div id="socketLoadingScreen" style="position:fixed;z-index:99999;top:0;left:0;width:100vw;height:100vh;background:#111;display:flex;align-items:center;justify-content:center;transition:opacity 0.3s;">
		<span style="color:#fff;font-size:2rem;letter-spacing:0.1em;">Connexion...</span>
		</div>
	`);
}
export function hideSocketLoadingScreen() {
    const el = document.getElementById('socketLoadingScreen');
    if (el) {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 350);
    }
}
// Gère l'attente de connexion socket et l'affichage de l'écran de chargement
export function waitForSocketConnection(socket, onSuccess) {
    showSocketLoadingScreen();
    const onConnect = () => {
        hideSocketLoadingScreen();
        onSuccess();
        socket && socket.off('connect', onConnect);
    };
    socket?.on('connect', onConnect);
    setTimeout(() => {
        if (socket && socket.connected)
            onConnect();
    }, 100);
    setTimeout(() => {
    }, 5000);
}
//# sourceMappingURL=socketLoading.js.map