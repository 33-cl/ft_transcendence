export const signUpHTML = /*html*/`
    <h2>Sign up</h2>
    <input type="text" id="username" placeholder="Username">
    <input type="email" id="email" placeholder="Email" required>
    <input type="password" id="password" placeholder="Password">
    <input type="password" id="confirmPassword" placeholder="Confirm password">
    <button id="signUpSubmit" class="default-button">SIGN UP</button>
    <div id="signUpMsg" style="margin-top:8px"></div>

    <p>Already have an account? <a id="signInBtn" class="link">Sign in</a></p>
`;