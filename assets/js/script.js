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

    // --- Mobile Navigation Setup Function ---
    function setupMobileNav() {
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
    }

    // --- Active Navbar Link Highlighter Function ---
    function highlightActiveLink() {
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
    }

    // --- Mobile Navigation (placeholder, will run after components load) ---
    const hamburgerBtn = document.getElementById('hamburger');
    const navLinksContainer = document.querySelector('.nav-links');

    if (hamburgerBtn && navLinksContainer) {
        setupMobileNav();
        highlightActiveLink();
    }

    // --- Component loader utility ---
    // Loads a component from /components/{name}.html into #mount-point
    async function loadComponent(name, mountPointId) {
        const mount = document.getElementById(mountPointId);
        if (!mount) return;

        const candidates = [];
        // try absolute path first (works on most static hosts when site root is used)
        candidates.push(`/components/${name}.html`);

        // build relative attempts based on URL depth
        const segments = window.location.pathname.split('/').filter(Boolean);
        // if the last segment looks like a file (contains a dot), don't count it as a directory
        let depth = segments.length;
        if (segments.length && segments[segments.length - 1].includes('.')) depth = Math.max(0, depth - 1);

        for (let i = 0; i <= depth; i++) {
            const rel = (i === 0 ? `components/${name}.html` : '../'.repeat(i) + `components/${name}.html`);
            if (!candidates.includes(rel)) candidates.push(rel);
        }

        for (const url of candidates) {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (!res.ok) continue;
                const html = await res.text();
                mount.innerHTML = html;
                return;
            } catch (e) {
                // try next candidate
            }
        }
    }

    // load both nav and footer components after DOM-ready UI wiring
    Promise.all([
        loadComponent('nav', 'nav'),
        loadComponent('footer', 'footer')
    ]).then(() => {
        // After components are loaded, set up mobile nav and active link highlighting
        setupMobileNav();
        highlightActiveLink();
    });
});
