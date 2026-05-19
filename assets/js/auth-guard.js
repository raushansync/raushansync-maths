/**
 * auth-guard.js
 * Global authentication guard for automatic page protection.
 * 
 * This script should be included on ALL pages in the <head> or early in <body>.
 * It automatically enforces authentication on protected routes.
 * 
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
 *   <script src="/assets/js/auth-config.js"></script>
 *   <script src="/assets/js/auth-guard.js"></script>
 * 
 * Features:
 * - Automatically redirects unauthenticated users to login
 * - Prevents page flash by hiding content during auth check
 * - Automatically redirects authenticated users away from auth pages
 * - Works seamlessly with existing auth system
 * - Non-blocking error handling
 */

(function authGuard() {
    // Early return if auth-config not loaded
    if (typeof window.whenAuthReady !== 'function') {
        console.warn('auth-guard.js: auth-config.js not loaded. Include auth-config.js before auth-guard.js');
        return;
    }

    const normalizePathname = (pathname) => {
        if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
            return '/';
        }

        if (pathname.length > 1 && pathname.endsWith('/')) {
            return pathname.slice(0, -1);
        }

        return pathname;
    };

    const isAuthPage = () => {
        const pathname = normalizePathname(window.location.pathname);
        const authPages = new Set(['/login', '/signup']);
        return authPages.has(pathname);
    };

    const isProtectedPage = () => {
        if (typeof window.isProtectedPath !== 'function') {
            console.warn('auth-guard.js: isProtectedPath not available');
            return false;
        }
        return window.isProtectedPath(window.location.pathname);
    };

    const markAuthReady = () => {
        if (typeof window.markAuthReady === 'function') {
            window.markAuthReady();
        }
    };

    const getDashboardFallback = () => (
        typeof window.AUTH_ROUTE_DASHBOARD !== 'undefined'
            ? window.AUTH_ROUTE_DASHBOARD
            : '/dashboard'
    );

    const redirectAuthenticatedUserToTarget = async () => {
        const fallback = getDashboardFallback();

        if (typeof window.redirectAuthenticatedUser === 'function') {
            await window.redirectAuthenticatedUser(fallback);
            return;
        }

        const redirectPath = typeof window.getPostAuthRedirectPath === 'function'
            ? window.getPostAuthRedirectPath(fallback)
            : fallback;

        if (typeof window.redirectToPath === 'function') {
            window.redirectToPath(redirectPath, { replace: true });
            return;
        }

        window.location.replace(redirectPath);
    };

    const handleAuthCheck = async () => {
        try {
            // Wait for auth to initialize
            const session = await window.whenAuthReady();

            // Case 1: Protected page without authentication
            if (isProtectedPage() && !session) {
                if (typeof window.redirectToLogin === 'function') {
                    window.redirectToLogin();
                    return; // Exit to prevent further execution
                }
            }

            // Case 2: Auth page with active session
            if (isAuthPage() && session) {
                await redirectAuthenticatedUserToTarget();
                return; // Exit to prevent further execution
            }

            // Case 3: All other cases - mark auth as ready and show content
            markAuthReady();

        } catch (error) {
            if (DEBUG_AUTH) {
                console.error('auth-guard.js: Unexpected error during auth check', error);
            }
            // On error, mark auth as ready to show content (assume user should see login page if needed)
            markAuthReady();
        }
    };

    // Initiate auth check when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleAuthCheck);
    } else {
        // DOM already loaded (e.g., script included late)
        handleAuthCheck();
    }

    // Safety timeout: if auth check doesn't complete within 10 seconds, show error
    // (Do not default to showing protected content as a security measure)
    setTimeout(() => {
        if (!document.documentElement.classList.contains('auth-ready')) {
            console.error('auth-guard.js: Auth check timeout after 10 seconds - not showing content');
            // Add error state instead of forcing content visibility
            document.documentElement.classList.add('auth-error');
        }
    }, 10000);
})();
