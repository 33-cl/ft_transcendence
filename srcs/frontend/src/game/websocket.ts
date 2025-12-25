import { socket, reconnectWebSocket } from "./socketConnection.js";
import { setupGlobalSocketListeners } from "./socketGlobalListeners.js";
import { setupGameEventListeners, cleanupGameEventListeners } from "./socketGameListeners.js";
import { requestJoinRoom, leaveCurrentRoomAsync } from "./socketRoom.js";
import { initPongRenderer } from "./pongRenderer.js";

setupGlobalSocketListeners();

window.reconnectWebSocket = () => reconnectWebSocket(setupGlobalSocketListeners);

function setupPongCanvas()
{
    initPongRenderer("map");
}

document.addEventListener("componentsReady", () =>
{
    setTimeout(() =>
    {
        const mapCanvas = document.getElementById("map");
        if (mapCanvas)
        {
            setupPongCanvas();
            setupGameEventListeners();
            
            if (typeof window.initAIDifficultySelector === "function")
                window.initAIDifficultySelector();
        }
    }, 100);
});

import "./pongControls.js";

export { socket, setupGlobalSocketListeners, setupGameEventListeners, cleanupGameEventListeners, requestJoinRoom, leaveCurrentRoomAsync };
