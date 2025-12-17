// 404 error page
export function notFoundHTML(): string {
    return /*html*/ `
    <div class="notfound-container">
        <h1 class="notfound-title">404 error</h1>
        <h2 class="notfound-subtitle">Page not found</h2>
    </div>
    `;
}
