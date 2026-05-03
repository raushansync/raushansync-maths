/**
 * auth-config.js
 * Shared Supabase configuration and auth helpers for the platform.
 *
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4"></script>
 *   <script src="/assets/js/auth-config.js"></script>
 */

// Initialize auth-pending only on sensitive routes so public pages can render immediately.
(function initAuthPending() {
    if (!document.documentElement.classList) {
        return;
    }

    const pathname = window.location.pathname || '/';
    const normalizedPathname = pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname;
    const shouldHideDuringAuth =
        normalizedPathname === '/login' ||
        normalizedPathname === '/login/index.html' ||
        normalizedPathname === '/signup' ||
        normalizedPathname === '/signup/index.html' ||
        normalizedPathname === '/dashboard' ||
        (normalizedPathname.includes('/practice') && !normalizedPathname.includes('/practice-solution'));

    if (shouldHideDuringAuth) {
        document.documentElement.classList.add('auth-pending');
    }
})();

const DEFAULT_SUPABASE_URL = 'https://vqchjavjcfrewulqpjcl.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mV-vgkc6YeAYi8JMPPHQyQ_eLPj0IPs';

const AUTH_ROUTE_LOGIN = '/login';
const AUTH_ROUTE_SIGNUP = '/signup';
const AUTH_ROUTE_DASHBOARD = '/dashboard';

const DEBUG_AUTH =
    Boolean(window.__AUTH_DEBUG__) ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

const runtimeConfig =
    typeof window.__SUPABASE_CONFIG__ === 'object' && window.__SUPABASE_CONFIG__ !== null
        ? window.__SUPABASE_CONFIG__
        : {};

const SUPABASE_URL = runtimeConfig.url || DEFAULT_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = runtimeConfig.publishableKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

function normalizePathname(pathname = '/') {
    if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
        return '/';
    }

    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }

    return pathname;
}

const AUTH_PAGE_PATHS = new Set([
    AUTH_ROUTE_LOGIN,
    '/login/index.html',
    AUTH_ROUTE_SIGNUP,
    '/signup/index.html',
    AUTH_ROUTE_DASHBOARD
]);

const PROTECTED_PATH_PREFIXES = [
    AUTH_ROUTE_DASHBOARD,
    '/practice/',
    '/practice-advanced/'
];

// Keep route constants available globally for other scripts.
window.AUTH_ROUTE_LOGIN = AUTH_ROUTE_LOGIN;
window.AUTH_ROUTE_SIGNUP = AUTH_ROUTE_SIGNUP;
window.AUTH_ROUTE_DASHBOARD = AUTH_ROUTE_DASHBOARD;

let authState = {
    initialized: false,
    session: null
};

// Expose authState on window so other scripts can read initial/updated auth state
window.authState = authState;

let authReadyResolved = false;
let resolveAuthReady;

const authReadyPromise = new Promise((resolve) => {
    resolveAuthReady = resolve;
});

function resolveAuthReadyOnce(session) {
    if (authReadyResolved) {
        return;
    }

    authReadyResolved = true;
    resolveAuthReady(session || null);
}

function matchesProtectedPath(pathname, prefix) {
    if (prefix.endsWith('/')) {
        return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
    }

    return pathname === prefix || pathname.startsWith(prefix + '/');
}

function isProtectedPath(pathname = window.location.pathname) {
    const normalizedPath = normalizePathname(pathname);

    if (normalizedPath.includes('/practice') && !normalizedPath.includes('/practice-solution')) {
        return true;
    }
    return PROTECTED_PATH_PREFIXES.some((prefix) => matchesProtectedPath(normalizedPath, prefix));
}

function isSensitivePath(pathname = window.location.pathname) {
    const normalizedPath = normalizePathname(pathname);
    return AUTH_PAGE_PATHS.has(normalizedPath) || isProtectedPath(normalizedPath);
}

function sanitizeText(value, maxLength) {
    if (typeof value !== 'string') {
        return '';
    }

    const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
    if (!normalized) {
        return '';
    }

    return normalized.slice(0, maxLength);
}

function getProfileSeed(session) {
    const user = session?.user;
    if (!user?.id) {
        return null;
    }

    // Step 3 Update: Only extract fields for new profiles table
    // Email stays in auth.users, grade_class/school_name removed
    return {
        id: user.id,
        full_name: sanitizeText(user.user_metadata?.full_name || '', 120) || null,
        education_level: sanitizeText(user.user_metadata?.education_level || '', 50) || null,
        phone: sanitizeText(user.user_metadata?.phone || '', 20) || null
    };
}

function buildProfilePatch(existingProfile, seed) {
    const patch = {};

    if (!existingProfile) {
        // Creating new profile
        patch.id = seed.id;

        if (seed.full_name) {
            patch.full_name = seed.full_name;
        }
        if (seed.education_level) {
            patch.education_level = seed.education_level;
        }
        if (seed.phone) {
            patch.phone = seed.phone;
        }
    } else {
        // Updating existing profile - sync all fields that differ
        // For full_name and education_level, avoid wiping out valid data with accidental nulls
        if (seed.full_name && seed.full_name !== existingProfile.full_name) {
            patch.full_name = seed.full_name;
        }
        if (seed.education_level && seed.education_level !== existingProfile.education_level) {
            patch.education_level = seed.education_level;
        }
        // Phone is optional and user might want to remove it, so allow syncing null
        if (seed.phone !== existingProfile.phone) {
            patch.phone = seed.phone;
        }
    }

    return patch;
}

function buildFallbackProfile(seed, existingProfile) {
    if (!seed && !existingProfile) {
        return null;
    }

    return {
        id: existingProfile?.id || seed?.id || null,
        full_name: existingProfile?.full_name || seed?.full_name || '',
        education_level: existingProfile?.education_level || seed?.education_level || null,
        phone: existingProfile?.phone || seed?.phone || null
    };
}

function updateAuthState(session) {
    authState = {
        initialized: true,
        session: session || null
    };
    // Mirror the authState on window for other scripts to read synchronously
    window.authState = authState;
    resolveAuthReadyOnce(authState.session);

    window.dispatchEvent(
        new CustomEvent('rs:auth-state-change', {
            detail: {
                session: authState.session
            }
        })
    );
}

function handleAuthStateChange(eventName, session) {
    updateAuthState(session);

    if (!session && isProtectedPath(window.location.pathname)) {
        window.redirectToLogin();
        return;
    }

    if (DEBUG_AUTH) {
        window.logEvent('Auth state changed', { eventName });
    }
}

async function fetchProfileForSession(session) {
    if (!window.supabaseClient || !session?.user?.id) {
        return null;
    }

    const { data, error } = await window.supabaseClient
        .from('profiles')
        .select('id, full_name, education_level, phone, created_at')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error) {
        if (DEBUG_AUTH) {
            console.error('Failed to fetch profile:', error);
        }
        return null;
    }

    return data || null;
}

async function initializeAuth() {
    if (!window.supabaseClient) {
        resolveAuthReadyOnce(null);
        return;
    }

    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
        if (DEBUG_AUTH) {
            console.error('Failed to initialize auth state:', error);
        }
        updateAuthState(null);
        return;
    }

    updateAuthState(data.session);

    window.supabaseClient.auth.onAuthStateChange((eventName, session) => {
        handleAuthStateChange(eventName, session);
    });

    if (DEBUG_AUTH) {
        window.logEvent('Auth system initialized');
    }
}

window.supabaseClient = (() => {
    if (typeof supabase === 'undefined') {
        if (DEBUG_AUTH) {
            console.error('Supabase library not loaded. Add this script before auth-config.js.');
        }
        return null;
    }

    return supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
})();

window.whenAuthReady = function () {
    return authReadyPromise;
};

/**
 * Shared learning scope helpers.
 * Progress, scores, and dashboard data are intentionally shared across the
 * maths and science domains, so this returns a neutral identifier instead of
 * partitioning by hostname.
 */
window.SHARED_SITE_SCOPE = 'shared';

window.getCurrentSite = function() {
    return window.SHARED_SITE_SCOPE;
};

window.getCurrentSiteScope = function() {
    return window.SHARED_SITE_SCOPE;
};

window.getCurrentPath = function() {
    return window.location.pathname + window.location.search + window.location.hash;
};

window.normalizePath = function(path) {
    if (!path || typeof path !== 'string') {
        return window.getCurrentPath();
    }
    try {
        const url = new URL(path, window.location.origin);
        if (url.origin !== window.location.origin) {
            return window.getCurrentPath();
        }
        return (url.pathname + url.search + url.hash).slice(0, 500);
    } catch (error) {
        return window.getCurrentPath();
    }
};

window.isUserLoggedIn = function() {
    return window.authState && window.authState.session && window.authState.session.user;
};

window.getCurrentSession = async function() {
    if (!window.supabaseClient) {
        return null;
    }
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
        if (DEBUG_AUTH) {
            console.error('Failed to get session:', error);
        }
        return null;
    }
    return data?.session || null;
};

window.logEvent = function (eventName, eventData = {}) {
    if (!DEBUG_AUTH) {
        return;
    }

    console.log(`[${new Date().toISOString()}] ${eventName}:`, eventData);
};

window.markAuthReady = function () {
    document.documentElement.classList.remove('auth-pending');
    document.documentElement.classList.add('auth-ready');
};

window.getSafeRedirectPath = function (rawValue, fallback = AUTH_ROUTE_DASHBOARD, options = {}) {
    const allowAuthPages = Boolean(options.allowAuthPages);
    const safeFallback = typeof fallback === 'string' && fallback.startsWith('/') ? fallback : AUTH_ROUTE_DASHBOARD;
    const normalizedFallback = normalizePathname(safeFallback);

    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return normalizedFallback;
    }

    try {
        const url = new URL(rawValue, window.location.origin);
        if (url.origin !== window.location.origin) {
            return normalizedFallback;
        }

        const safePath = `${url.pathname}${url.search}${url.hash}`;
        if (!safePath.startsWith('/')) {
            return normalizedFallback;
        }

        const normalizedPathname = normalizePathname(url.pathname);
        const normalizedSafePath = `${normalizedPathname}${url.search}${url.hash}`;

        if (!allowAuthPages && AUTH_PAGE_PATHS.has(normalizedPathname)) {
            return normalizedFallback;
        }

        return normalizedSafePath;
    } catch (error) {
        return normalizedFallback;
    }
};

window.getPostAuthRedirectPath = function (fallback = AUTH_ROUTE_DASHBOARD) {
    const params = new URLSearchParams(window.location.search);
    return window.getSafeRedirectPath(params.get('redirect'), fallback);
};

window.buildLoginRedirectUrl = function (targetPath) {
    const requestedPath =
        typeof targetPath === 'string' && targetPath.trim()
            ? targetPath
            : `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const safePath = window.getSafeRedirectPath(requestedPath, AUTH_ROUTE_DASHBOARD);
    const loginUrl = new URL(AUTH_ROUTE_LOGIN, window.location.origin);
    loginUrl.searchParams.set('redirect', safePath);
    return `${loginUrl.pathname}${loginUrl.search}`;
};

window.redirectToPath = function (path, options = {}) {
    const safePath = window.getSafeRedirectPath(
        path,
        options.fallback || AUTH_ROUTE_DASHBOARD,
        { allowAuthPages: Boolean(options.allowAuthPages) }
    );

    if (options.replace) {
        window.location.replace(safePath);
        return;
    }

    window.location.assign(safePath);
};

window.redirectToLogin = function (targetPath) {
    const loginUrl = new URL(window.buildLoginRedirectUrl(targetPath), window.location.origin);
    window.location.replace(`${loginUrl.pathname}${loginUrl.search}`);
};

window.getCurrentUser = async function () {
    const session = await window.getCurrentSession();
    return session?.user || null;
};

window.syncUserProfile = async function (options = {}) {
    const session = options.session || await window.getCurrentSession();
    if (!session || !window.supabaseClient) {
        return null;
    }

    // Use explicit profile data if provided (for updates), otherwise read from session
    let seed;
    if (options.explicitProfile) {
        seed = {
            id: session.user.id,
            full_name: sanitizeText(options.explicitProfile.full_name || '', 120) || null,
            education_level: sanitizeText(options.explicitProfile.education_level || '', 50) || null,
            phone: sanitizeText(options.explicitProfile.phone || '', 20) || null
        };
    } else {
        seed = getProfileSeed(session);
    }
    
    if (!seed?.id) {
        return null;
    }

    const existingProfile = options.profile !== undefined
        ? options.profile
        : await fetchProfileForSession(session);

    const patch = buildProfilePatch(existingProfile, seed);
    const fallbackProfile = buildFallbackProfile(seed, existingProfile);

    if (!Object.keys(patch).length) {
        return fallbackProfile;
    }

    try {
        let result;

        if (existingProfile) {
            // Step 3: Update new profiles table
            result = await window.supabaseClient
                .from('profiles')
                .update(patch)
                .eq('id', seed.id)
                .select('*')
                .maybeSingle();
        } else {
            // Step 3: Insert into new profiles table
            result = await window.supabaseClient
                .from('profiles')
                .insert(patch)
                .select('*')
                .maybeSingle();
        }

        if (result.error) {
            if (DEBUG_AUTH) {
                console.error('Failed to sync profile:', result.error);
            }
            return fallbackProfile;
        }

        return result.data || fallbackProfile;
    } catch (error) {
        if (DEBUG_AUTH) {
            console.error('Unexpected error while syncing profile:', error);
        }
        return fallbackProfile;
    }
};

window.getUserProfile = async function (options = {}) {
    const session = await window.getCurrentSession();
    if (!session) {
        return null;
    }

    const existingProfile = await fetchProfileForSession(session);

    if (options.sync === false) {
        return buildFallbackProfile(getProfileSeed(session), existingProfile);
    }

    return window.syncUserProfile({
        session,
        profile: existingProfile,
        updateLastLogin: Boolean(options.updateLastLogin)
    });
};

window.clearSensitiveCaches = async function () {
    if (!('caches' in window)) {
        return;
    }

    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(async (cacheName) => {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();

            await Promise.all(
                requests
                    .filter((request) => {
                        try {
                            const url = new URL(request.url);
                            return url.origin === window.location.origin && isSensitivePath(url.pathname);
                        } catch (error) {
                            return false;
                        }
                    })
                    .map((request) => cache.delete(request))
            );
        })
    );
};

window.signOut = async function () {
    if (!window.supabaseClient) {
        throw new Error('Supabase client is not initialized.');
    }

    const { error } = await window.supabaseClient.auth.signOut();
    if (error) {
        if (DEBUG_AUTH) {
            console.error('Sign out failed:', error);
        }
        throw error;
    }

    await window.clearSensitiveCaches();

    const loginUrl = new URL(window.buildLoginRedirectUrl(), window.location.origin);
    loginUrl.searchParams.set('message', 'signed-out');
    window.location.replace(`${loginUrl.pathname}${loginUrl.search}`);
};

window.requireAuth = async function () {
    const session = await window.getCurrentSession();
    if (!session) {
        window.redirectToLogin();
        return false;
    }

    return true;
};

window.redirectAuthenticatedUser = async function (fallback = AUTH_ROUTE_DASHBOARD) {
    const session = await window.getCurrentSession();
    if (!session) {
        return false;
    }

    const redirectPath = window.getPostAuthRedirectPath(fallback);
    window.redirectToPath(redirectPath, { replace: true });
    return true;
};

window.isAuthenticated = async function () {
    const session = await window.getCurrentSession();
    return session !== null;
};

window.isProtectedPath = function (pathname = window.location.pathname) {
    const normalizedPath = normalizePathname(pathname);
    if (normalizedPath.includes('/practice') && !normalizedPath.includes('/practice-solution')) {
        return true;
    }
    return PROTECTED_PATH_PREFIXES.some((prefix) => matchesProtectedPath(normalizedPath, prefix));
};

initializeAuth();
