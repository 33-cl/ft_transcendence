/**
 * Page de vérification 2FA lors du login
 * Même style que signIn
 */
export const twoFactorHTML = /*html*/`
    <h2>Two-Factor Authentication</h2>
    <p style="color: #ccc; margin-bottom: 1rem; text-align: center;">A verification code has been sent to your email.</p>
    <input type="text" id="twoFactorCode" placeholder="6-digit code" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code">
    <button id="verifyCodeButton" class="default-button">VERIFY</button>
    <div id="twoFactorMsg" style="margin-top:8px"></div>
    
    <p>Go back to <a id="cancel2FABtn" class="link">Sign in</a></p>
`;
