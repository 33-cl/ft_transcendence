import { DEV_CONFIG } from '../config/dev.js';

export const signInHTML = /*html*/`
    <h2>Sign in</h2>
    <input type="text" id="username" placeholder="Username">
    <input type="password" id="password" placeholder="Password">
    <button id="signInButton">SIGN IN</button>
    <div id="signInMsg" style="margin-top:8px"></div>

    ${DEV_CONFIG.SKIP_LOGIN_ENABLED ? `
    <!-- DEV ONLY: Bouton pour contourner l'auth en mode test -->
    <button id="skipLoginBtn" style="background-color: #ff6b6b; margin-top: 10px; font-size: 12px;">Skip Login (DEV)</button>
    ` : ''}

    <p>Don't have an account? <a id="signUpBtn" class="link">Sign up</a></p>
`;