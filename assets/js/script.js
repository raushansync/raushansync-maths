document.addEventListener('DOMContentLoaded', () => {

    // --- Dark Mode Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    const applySavedTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            root.classList.add('dark-mode');
        } else {
            root.classList.remove('dark-mode');
        }
    };

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = root.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
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
            if (event.target.tagName === 'A') {
                navLinksContainer.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- Active Navbar Link Highlighter ---
    const currentPagePath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        if (
            linkPath !== '/' &&
            (currentPagePath === linkPath || currentPagePath.startsWith(linkPath + '/'))
        ) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
});
