"use strict";
// /**
//  * Custom password masking utility to display asterisks (*) instead of dots in password fields
//  */
// export function initPasswordMasking(): void {
//   document.addEventListener('DOMContentLoaded', () => {
//     setupPasswordInputs();
//     // Set up a mutation observer to watch for dynamically added password fields
//     const observer = new MutationObserver((mutations) => {
//       mutations.forEach((mutation) => {
//         if (mutation.addedNodes.length) {
//           setupPasswordInputs();
//         }
//       });
//     });
//     observer.observe(document.body, { childList: true, subtree: true });
//   });
// }
// function setupPasswordInputs(): void {
//   // Find all password inputs
//   const passwordInputs = document.querySelectorAll('input[type="password"]');
//   passwordInputs.forEach((input) => {
//     if (!(input instanceof HTMLInputElement)) return;
//     if (input.dataset.customMasked === 'true') return; // Skip if already processed
//     // Create a custom input element
//     const customInput = document.createElement('input');
//     customInput.type = 'text';
//     customInput.className = input.className;
//     customInput.id = `custom-${input.id || Math.random().toString(36).substring(2, 9)}`;
//     customInput.placeholder = input.placeholder;
//     // Match all styles from the original input
//     copyStyles(input, customInput);
//     // Hide the original password input
//     input.style.display = 'none';
//     input.dataset.customMasked = 'true';
//     // Insert the custom input after the original
//     input.parentNode?.insertBefore(customInput, input.nextSibling);
//     // Handle input events
//     customInput.addEventListener('input', (event) => {
//       const target = event.target as HTMLInputElement;
//       const value = target.value;
//       const lastChar = value.charAt(value.length - 1);
//       // Update the original password input value
//       input.value = input.value + lastChar;
//       // Replace all characters with asterisks
//       setTimeout(() => {
//         target.value = '*'.repeat(value.length);
//       }, 0);
//     });
//     // Handle backspace and delete
//     customInput.addEventListener('keydown', (event) => {
//       const key = event.key;
//       if (key === 'Backspace' || key === 'Delete') {
//         event.preventDefault();
//         const target = event.target as HTMLInputElement;
//         const newLength = input.value.length - 1;
//         if (newLength >= 0) {
//           input.value = input.value.substring(0, newLength);
//           target.value = '*'.repeat(newLength);
//         }
//       }
//     });
//     // Handle focus events
//     customInput.addEventListener('focus', () => {
//       // Clear any existing messages when focusing on the password field
//       const signInMsg = document.getElementById('signInMsg');
//       if (signInMsg && signInMsg.textContent === 'Enter username/email and password.') {
//         signInMsg.textContent = '';
//       }
//       customInput.value = '*'.repeat(input.value.length);
//     });
//     // Handle form submission
//     const form = input.closest('form');
//     if (form) {
//       form.addEventListener('submit', () => {
//         // Ensure the original password value is submitted
//         input.style.display = '';
//         customInput.style.display = 'none';
//       });
//     }
//   });
// }
// function copyStyles(source: HTMLElement, target: HTMLElement): void {
//   const computedStyle = window.getComputedStyle(source);
//   for (let i = 0; i < computedStyle.length; i++) {
//     const property = computedStyle[i];
//     if (property) {
//       const value = computedStyle.getPropertyValue(property);
//       if (value) {
//         target.style.setProperty(property, value);
//       }
//     }
//   }
// } 
//# sourceMappingURL=passwordMasking.js.map