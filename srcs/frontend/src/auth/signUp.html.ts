export const signUpHTML = /*html*/`
    <h2>Sign up</h2>
    <input type="text" id="username" placeholder="Username" maxlength="10">
    <input type="email" id="email" placeholder="Email" required maxlength="255">
    <input type="password" id="password" placeholder="Password" maxlength="255">
    <input type="password" id="confirmPassword" placeholder="Confirm password" maxlength="255">
    <button id="signUpSubmit" class="default-button">SIGN UP</button>
    <div id="signUpMsg" style="margin-top:8px"></div>

    <p>Already have an account? <a id="signInBtn" class="link">Sign in</a></p>
`;