export const signUpHTML = /*html*/`
    <h2>Sign up</h2>
	<form id="signUpForm">
    <input type="text" id="username" placeholder="Username">
    <input type="text" id="age" placeholder="Age">
    <input type="email" id="email" placeholder="Email">
    <input type="password" id="password" placeholder="Password">
    <input type="password" id="confirmPassword" placeholder="Confirm password">
    <button type="submit" id="signUp">SIGN UP</button>
	</form>
    <p>Already have an account? <a id="signInBtn" class="link">Sign in</a></p>
`;



// Variable to track if the form has been initialized
let formInitialized = false;


// This function sets up the sign-up form
export function setupSignUpForm() {

	// if the form has already been initialized
	if (formInitialized == true)
		return;

	const form = document.getElementById('signUpForm') as HTMLFormElement;
	if (!form)
		return;

	form.addEventListener('submit', (e) => {
		e.preventDefault();

	// Getting the values of each field
	const username = (document.getElementById('username') as HTMLInputElement).value.trim();
	const age = Number((document.getElementById('age') as HTMLInputElement).value);
	const email = (document.getElementById('email') as HTMLInputElement).value.trim();
	const password = (document.getElementById('password') as HTMLInputElement).value;
	const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement).value;

	// Mandatory test of the values
	if (!username || !email || !password) {
	  alert('Please fill in all the fields.');
	  return;
	}

	if (password !== confirmPassword) {
	  alert('Passwords are not matching.');
	  return;
	}

	if (isNaN(age) || age <= 10 || age > 80) {
	  alert("Age has to be a number between 10 and 80.");
	  return;
	}

	const data = { username, age, email, password };

	// To print in the console all the data that was entered in the form
	console.log('donnees du formulaire :', data);

	});

	// speaks for itlself
	formInitialized = true;
}