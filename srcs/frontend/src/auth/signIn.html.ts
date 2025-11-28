export const signInHTML = /*html*/`
    <h2>Sign in</h2>
    <input type="text" id="username" placeholder="Username">
    <input type="password" id="password" placeholder="Password">
    
    <!-- Champ 2FA (masqué par défaut) -->
    <div id="twoFactorSection" style="display: none;">
        <p style="margin: 10px 0; color: #22c55e;">A verification code has been sent to your email.</p>
        <input type="text" id="twoFactorCode" placeholder="6-digit code" maxlength="6" pattern="[0-9]{6}">
    </div>
    
    <button id="signInButton" class="default-button">SIGN IN</button>
    <div id="signInMsg" style="margin-top:8px"></div>

    <p>Don't have an account? <a id="signUpBtn" class="link">Sign up</a></p>
`;