/* No changes needed to this file */
document.addEventListener('DOMContentLoaded', () => {

    // --- Dark Mode Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;
    const applySavedTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') root.classList.add('dark-mode');
        else root.classList.remove('dark-mode');
    };
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            root.classList.toggle('dark-mode');
            localStorage.setItem('theme', root.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }
    applySavedTheme();

    // --- Mobile Navigation ---
    const hamburgerBtn = document.getElementById('hamburger');
    const navLinksContainer = document.querySelector('.nav-links');
    if (hamburgerBtn && navLinksContainer) {
        hamburgerBtn.addEventListener('click', () => {
            const isOpen = navLinksContainer.classList.toggle('active');
            hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
        });
        navLinksContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'A') navLinksContainer.classList.remove('active');
        });
    }

    // --- Active Navbar Link Highlighter ---
    const currentPagePath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        // Get the path from the link's href
        const linkPath = new URL(link.href).pathname;
        // Check if the current page path starts with the link's path
        // This handles cases like '/class06/' being active when on that page.
        if (currentPagePath.startsWith(linkPath) && linkPath !== '/') {
            link.classList.add('active');
        }
    });
});