document.addEventListener('DOMContentLoaded', () => {

    // --- Dark Mode Toggle ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    // Read the current primary theme color from CSS variables
    function getPrimaryThemeColor() {
        const styles = getComputedStyle(document.documentElement);
        const primaryColor = styles.getPropertyValue('--primary-color').trim();
        if (primaryColor) return primaryColor;

        const meta = document.getElementById('theme-color-meta');
        const fallbackColor = meta ? meta.getAttribute('content') : '';
        return (fallbackColor || '').trim();
    }

    // Sync Chrome UI theme color with the current site theme
    function updateBrowserThemeColor() {
        const meta = document.getElementById('theme-color-meta');
        if (!meta) return;

        const primaryColor = getPrimaryThemeColor();
        if (!primaryColor) return;

        meta.setAttribute('content', primaryColor);
    }

    const applySavedTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            root.classList.add('dark-mode');
        } else {
            root.classList.remove('dark-mode');
        }

        updateBrowserThemeColor();
    };

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = root.classList.toggle('dark-mode');
            updateBrowserThemeColor();
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    applySavedTheme();

    // --- Mobile Navigation Setup Function ---
    function setupMobileNav() {
        const hamburgerBtn = document.getElementById('hamburger');
        const navLinksContainer = document.querySelector('.nav-links');

        if (!hamburgerBtn || !navLinksContainer) return;

        // Avoid attaching duplicate listeners when this runs multiple times
        if (hamburgerBtn.dataset.mobileNavInit === 'true') return;
        hamburgerBtn.dataset.mobileNavInit = 'true';

        const onHamburgerClick = () => {
            const isOpen = navLinksContainer.classList.toggle('active');
            hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
        };

        const onNavLinksClick = (event) => {
            if (event.target.tagName === 'A') {
                navLinksContainer.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
            }
        };

        hamburgerBtn.addEventListener('click', onHamburgerClick);
        navLinksContainer.addEventListener('click', onNavLinksClick);
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

    // --- Auto-hide Navbar on Scroll ---
    function setupAutoHideNav() {
        const header = document.querySelector('.header');
        if (!header || header.dataset.autoHideInit === 'true') return;

        header.dataset.autoHideInit = 'true';
        header.classList.add('header--auto-hide');

        let lastScrollY = window.scrollY;
        let headerHeight = header.offsetHeight || 0;
        const scrollThreshold = 12;
        let ticking = false;

        const updateHeaderVisibility = () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY <= headerHeight) {
                header.classList.remove('header--hidden');
                lastScrollY = currentScrollY;
                return;
            }

            const navLinks = document.querySelector('.nav-links');
            if (navLinks && navLinks.classList.contains('active')) {
                header.classList.remove('header--hidden');
                lastScrollY = currentScrollY;
                return;
            }

            const delta = currentScrollY - lastScrollY;
            if (Math.abs(delta) < scrollThreshold) return;

            if (delta > 0) {
                header.classList.add('header--hidden');
            } else {
                header.classList.remove('header--hidden');
            }

            lastScrollY = currentScrollY;
        };

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                updateHeaderVisibility();
                ticking = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', () => {
            headerHeight = header.offsetHeight || 0;
        }, { passive: true });
    }

    // --- Mobile Navigation (placeholder, will run after components load) ---
    const hamburgerBtn = document.getElementById('hamburger');
    const navLinksContainer = document.querySelector('.nav-links');

    if (hamburgerBtn && navLinksContainer) {
        setupMobileNav();
        highlightActiveLink();
    }

    setupAutoHideNav();

    // --- Service Worker Registration (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js').catch((error) => {
                console.warn('Service worker registration failed:', error);
            });
        });
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

    // (Component loading handled below together with progress initialization)

    // --- New Navbar Setup Function ---
    function setupNewNavbar() {
        const hamburger = document.getElementById('navbarHamburger');
        const menu = document.getElementById('navbarMenu');
        const signoutBtn = document.getElementById('navbarSignoutBtn');
        const signoutBtnDesktop = document.getElementById('navbarSignoutBtnDesktop');
        if (!hamburger || !menu) return;

        // Prevent duplicate initialization
        if (hamburger.dataset.newNavbarInit === 'true') return;
        hamburger.dataset.newNavbarInit = 'true';

        // Toggle menu on hamburger click
        const onNavbarHamburger = () => {
            const isOpen = menu.classList.toggle('active');
            hamburger.classList.toggle('active', isOpen);
            hamburger.setAttribute('aria-expanded', String(isOpen));
        };

        hamburger.addEventListener('click', onNavbarHamburger);

        // Close menu when clicking on menu items
        const menuItems = menu.querySelectorAll('.navbar-menu-item');
        menuItems.forEach(item => {
            if (item.dataset.menuItemInit === 'true') return;
            item.dataset.menuItemInit = 'true';
            item.addEventListener('click', () => {
                menu.classList.remove('active');
                hamburger.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close menu when clicking outside - attach once globally
        if (document.documentElement.dataset.navDocClickInit !== 'true') {
            document.documentElement.dataset.navDocClickInit = 'true';
            document.addEventListener('click', (e) => {
                const themeToggleBtn = document.getElementById('theme-toggle');
                const clickedInsideThemeToggle = themeToggleBtn && themeToggleBtn.contains(e.target);

                if (!hamburger.contains(e.target) && !menu.contains(e.target) && !clickedInsideThemeToggle) {
                    menu.classList.remove('active');
                    hamburger.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // Handle sign out for both menu and desktop buttons
        function attachSignOut(el) {
            if (!el || el.dataset.signoutInit === 'true') return;
            el.dataset.signoutInit = 'true';
            el.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await window.signOut?.();
                } catch (error) {
                    console.error('Sign out error:', error);
                }
            });
        }

        attachSignOut(signoutBtn);
        attachSignOut(signoutBtnDesktop);

        // Display user info if logged in
        displayUserInfo();
    }

    // --- STEP 4: Progress Tick System Initialization ---
    // Initialize tick manager and page progress tracking
    async function initializeProgressTracking() {
        try {
            // Wait for auth to be ready
            if (window.whenAuthReady && typeof window.whenAuthReady === 'function') {
                await window.whenAuthReady();
            }

            // Initialize tick manager for all data-tick-container elements
            if (window.TickManager && typeof window.TickManager.initializePageTicks === 'function') {
                await window.TickManager.initializePageTicks();
            }

            // Track this page view if user is logged in
            if (window.isUserLoggedIn && window.isUserLoggedIn()) {
                if (window.ProgressTracker && typeof window.ProgressTracker.loadPageProgress === 'function') {
                    const pageProgress = await window.ProgressTracker.loadPageProgress();
                    if (pageProgress) {
                        window.logEvent('Page progress loaded', { 
                            completed: pageProgress.completed, 
                            itemType: pageProgress.itemType 
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error initializing progress tracking:', error);
        }
    }

    // Update the component loading to also initialize progress tracking
    (async () => {
        await Promise.all([
            loadComponent('nav', 'nav'),
            loadComponent('footer', 'footer'),
            loadComponent('support-cta', 'support-cta')
        ]);
        
        // After components are loaded, set up mobile nav and active link highlighting
        setupMobileNav();
        highlightActiveLink();
        setupAutoHideNav();

        // --- Setup New Navbar (Hamburger & Auth) ---
        setupNewNavbar();

        // Initialize progress tracking (STEP 4)
        await initializeProgressTracking();
    })();

    // Expose updateProgressDisplay globally for dashboard updates
    window.updateProgressDisplay = async function() {
        try {
            if (window.TickManager && typeof window.TickManager.updateAllTicks === 'function') {
                await window.TickManager.updateAllTicks();
            }
        } catch (error) {
            console.error('Error updating progress display:', error);
        }
    };

    // Listen for auth state changes and reinitialize progress tracking if needed
    window.addEventListener('rs:auth-state-change', (event) => {
        const session = event.detail?.session;
        if (session && session.user) {
            // User logged in - reinitialize progress tracking
            if (window.ProgressTracker && typeof window.ProgressTracker.loadPageProgress === 'function') {
                window.ProgressTracker.loadPageProgress().catch(error => {
                    console.error('Error reloading page progress on login:', error);
                });
            }
        }
        // Logout handled by tick-manager
    });

    // Re-run initialization when page is restored from bfcache or shown again
    window.addEventListener('pageshow', (event) => {
        // pageshow can fire when the page is restored from the back/forward cache
        setupMobileNav();
        highlightActiveLink();
        setupAutoHideNav();
        setupNewNavbar();
    });

});

    // --- Display User Info in Navbar ---
    function displayUserInfo() {
        const userInfoDisplay = document.getElementById('userInfoDisplay');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const authDivider = document.getElementById('authDivider');
        const signoutBtn = document.getElementById('navbarSignoutBtn');
        const signoutBtnDesktop = document.getElementById('navbarSignoutBtnDesktop');

        if (!userInfoDisplay) return;

        // Listen for auth state changes
        window.addEventListener('rs:auth-state-change', (event) => {
            const session = event.detail?.session;

            if (session?.user) {
                const fullName = session.user.user_metadata?.full_name || session.user.email;
                if (userNameDisplay) {
                    userNameDisplay.textContent = fullName;
                }

                // Show user info display on desktop
                userInfoDisplay.style.display = 'flex';

                // Show sign out buttons
                if (authDivider) authDivider.style.display = 'block';
                if (signoutBtn) signoutBtn.style.display = 'flex';
                if (signoutBtnDesktop) signoutBtnDesktop.style.display = 'inline-flex';
            } else {
                // Hide user info and sign out button when not logged in
                userInfoDisplay.style.display = 'none';
                if (authDivider) authDivider.style.display = 'none';
                if (signoutBtn) signoutBtn.style.display = 'none';
                if (signoutBtnDesktop) signoutBtnDesktop.style.display = 'none';
            }
        });

        // Check initial auth state
        if (window.authState?.session?.user) {
            const fullName = window.authState.session.user.user_metadata?.full_name || window.authState.session.user.email;
            if (userNameDisplay) {
                userNameDisplay.textContent = fullName;
            }

            // Show user info display on desktop
            userInfoDisplay.style.display = 'flex';

            // Show sign out buttons
            if (authDivider) authDivider.style.display = 'block';
            if (signoutBtn) signoutBtn.style.display = 'flex';
            if (signoutBtnDesktop) signoutBtnDesktop.style.display = 'inline-flex';
        }
    }
