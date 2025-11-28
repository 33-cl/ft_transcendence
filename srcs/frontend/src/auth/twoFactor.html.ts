/**
 * Page de vérification 2FA lors du login
 */
export const twoFactorHTML = /*html*/`
    <h2>Two-Factor Authentication</h2>
    <p>A verification code has been sent to your email.</p>
    <p>Please enter it below:</p>
    <input type="text" id="twoFactorCode" placeholder="6-digit code" maxlength="6" pattern="[0-9]{6}">
    <button id="verifyCodeButton" class="default-button">VERIFY CODE</button>
    <div id="twoFactorMsg" style="margin-top:8px"></div>
    
    <p><a id="cancel2FABtn" class="link">Cancel and go back</a></p>
`;
