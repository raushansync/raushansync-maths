const EXACT_ALLOWED_ORIGINS = new Set([
    'https://maths.raushansync.com'
]);
const ALLOWED_PRODUCTION_DOMAIN = 'raushansync.com';

const LOCAL_DEV_HOSTS = new Set([
    'localhost',
    '127.0.0.1'
]);

const MODE_QUIZ_ASSISTANT = 'quiz-assistant';
const MODE_STUDENT_SUPPORT = 'student-support';

const DEFAULT_GROQ_MODEL = GROQ_MODELS.fast;
const FALLBACK_GROQ_MODEL = GROQ_MODELS.longContext;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_STORE = new Map();
const ACCOUNT_DELETE_ROUTE = '/api/account/delete';
const ACCOUNT_DELETE_CLEANUP_TARGETS = [
    { table: 'progress', column: 'user_id', optional: false },
    { table: 'practice_scores', column: 'user_id', optional: false },
    { table: 'profiles', column: 'id', optional: false },
    { table: 'completed_articles', column: 'user_id', optional: true },
    { table: 'practice_history', column: 'user_id', optional: true },
    { table: 'saved_resources', column: 'user_id', optional: true },
    { table: 'subscriptions', column: 'user_id', optional: true }
];

function isAllowedOrigin(origin) {
    if (typeof origin !== 'string') return false;
    if (EXACT_ALLOWED_ORIGINS.has(origin)) return true;

    try {
        const url = new URL(origin);

        if (url.protocol === 'http:' && LOCAL_DEV_HOSTS.has(url.hostname)) {
            return true;
        }

        if (url.protocol !== 'https:') {
            return false;
        }

        return url.hostname === ALLOWED_PRODUCTION_DOMAIN
            || url.hostname.endsWith('.' + ALLOWED_PRODUCTION_DOMAIN);
    } catch (error) {
        return false;
    }
}

function buildCorsHeaders(origin) {
    const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://maths.raushansync.com';
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function jsonResponse(data, status, origin, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...buildCorsHeaders(origin),
            ...extraHeaders
        }
    });
}

function cleanText(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
}

function tryParseJson(text) {
    if (typeof text !== 'string') return null;

    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

function extractBearerToken(authorizationHeader) {
    if (typeof authorizationHeader !== 'string') return '';
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return '';
    return cleanText(match[1], '');
}

function resolveClientAddress(request) {
    const cfIp = cleanText(request.headers.get('CF-Connecting-IP') || '', '');
    if (cfIp) return cfIp;

    const xForwardedFor = cleanText(request.headers.get('X-Forwarded-For') || '', '');
    if (!xForwardedFor) return 'unknown';

    return cleanText(xForwardedFor.split(',')[0] || '', 'unknown');
}

function enforceRateLimit(bucketKey) {
    const now = Date.now();

    for (const [key, value] of RATE_LIMIT_STORE.entries()) {
        if (!value || now - value.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
            RATE_LIMIT_STORE.delete(key);
        }
    }

    const existing = RATE_LIMIT_STORE.get(bucketKey);
    if (!existing) {
        RATE_LIMIT_STORE.set(bucketKey, {
            count: 1,
            windowStartedAt: now
        });
        return { limited: false, retryAfterSeconds: 0 };
    }

    if (now - existing.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
        RATE_LIMIT_STORE.set(bucketKey, {
            count: 1,
            windowStartedAt: now
        });
        return { limited: false, retryAfterSeconds: 0 };
    }

    if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfterSeconds = Math.max(
            1,
            Math.ceil((RATE_LIMIT_WINDOW_MS - (now - existing.windowStartedAt)) / 1000)
        );

        return {
            limited: true,
            retryAfterSeconds: retryAfterSeconds
        };
    }

    existing.count += 1;
    RATE_LIMIT_STORE.set(bucketKey, existing);

    return { limited: false, retryAfterSeconds: 0 };
}

async function verifySupabaseAccessToken(env, token) {
    const supabaseUrl = cleanText(env.SUPABASE_URL, '');
    const supabasePublishableKey = cleanText(env.SUPABASE_PUBLISHABLE_KEY, '');

    if (!supabaseUrl || !supabasePublishableKey) {
        return {
            ok: false,
            reason: 'misconfigured',
            userId: ''
        };
    }

    let endpoint;
    try {
        endpoint = new URL('/auth/v1/user', supabaseUrl).toString();
    } catch (error) {
        return {
            ok: false,
            reason: 'misconfigured',
            userId: ''
        };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': supabasePublishableKey
            }
        });

        if (!response.ok) {
            return {
                ok: false,
                reason: 'unauthorized',
                userId: ''
            };
        }

        const text = await response.text();
        const data = tryParseJson(text) || {};
        const userId = cleanText(data?.id, '');

        if (!userId) {
            return {
                ok: false,
                reason: 'unauthorized',
                userId: ''
            };
        }

        return {
            ok: true,
            reason: '',
            userId: userId
        };
    } catch (error) {
        return {
            ok: false,
            reason: 'unavailable',
            userId: ''
        };
    }
}

function getSupabaseAdminConfig(env) {
    const supabaseUrl = cleanText(env.SUPABASE_URL, '');
    const supabaseSecretKey = cleanText(env.SUPABASE_SECRET_KEY, '');

    if (!supabaseUrl || !supabaseSecretKey) {
        return {
            ok: false,
            supabaseUrl: '',
            supabaseSecretKey: ''
        };
    }

    return {
        ok: true,
        supabaseUrl: supabaseUrl,
        supabaseSecretKey: supabaseSecretKey
    };
}

function buildSupabaseSecretHeaders(supabaseSecretKey, includeJsonContentType = false) {
    const headers = {
        'Authorization': `Bearer ${supabaseSecretKey}`,
        'apikey': supabaseSecretKey
    };

    if (includeJsonContentType) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
}

function buildSupabaseApiUrl(supabaseUrl, path) {
    try {
        return new URL(path, supabaseUrl).toString();
    } catch (error) {
        return '';
    }
}

function isMissingRelationError(payload) {
    return payload && payload.code === '42P01';
}

async function deleteSupabaseTableRows(adminConfig, target, userId) {
    let endpoint;
    try {
        const url = new URL(`/rest/v1/${target.table}`, adminConfig.supabaseUrl);
        url.searchParams.set(target.column, `eq.${userId}`);
        endpoint = url.toString();
    } catch (error) {
        return {
            ok: false,
            status: 500,
            payload: { message: 'Failed to build Supabase REST endpoint.' },
            skipped: false
        };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                ...buildSupabaseSecretHeaders(adminConfig.supabaseSecretKey),
                'Prefer': 'return=minimal'
            }
        });

        if (response.ok) {
            return {
                ok: true,
                status: response.status,
                payload: {},
                skipped: false
            };
        }

        const raw = await response.text();
        const payload = tryParseJson(raw) || {};

        if (target.optional && isMissingRelationError(payload)) {
            return {
                ok: true,
                status: response.status,
                payload: payload,
                skipped: true
            };
        }

        return {
            ok: false,
            status: response.status,
            payload: payload,
            skipped: false
        };
    } catch (error) {
        return {
            ok: false,
            status: 503,
            payload: { message: error instanceof Error ? error.message : 'Supabase request failed.' },
            skipped: false
        };
    }
}

async function revokeSupabaseUserSessions(adminConfig, userId) {
    const endpoint = buildSupabaseApiUrl(
        adminConfig.supabaseUrl,
        `/auth/v1/admin/users/${encodeURIComponent(userId)}/logout`
    );

    if (!endpoint) {
        return {
            ok: false,
            status: 500,
            payload: { message: 'Failed to build Supabase logout endpoint.' }
        };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: buildSupabaseSecretHeaders(adminConfig.supabaseSecretKey)
        });

        if (response.ok || response.status === 404) {
            return {
                ok: true,
                status: response.status,
                payload: {}
            };
        }

        const raw = await response.text();
        return {
            ok: false,
            status: response.status,
            payload: tryParseJson(raw) || {}
        };
    } catch (error) {
        return {
            ok: false,
            status: 503,
            payload: { message: error instanceof Error ? error.message : 'Session revoke failed.' }
        };
    }
}

async function deleteSupabaseUser(adminConfig, userId) {
    const endpoint = buildSupabaseApiUrl(
        adminConfig.supabaseUrl,
        `/auth/v1/admin/users/${encodeURIComponent(userId)}`
    );

    if (!endpoint) {
        return {
            ok: false,
            status: 500,
            payload: { message: 'Failed to build Supabase auth delete endpoint.' }
        };
    }

    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: buildSupabaseSecretHeaders(adminConfig.supabaseSecretKey)
        });

        if (response.ok || response.status === 404) {
            return {
                ok: true,
                status: response.status,
                payload: {}
            };
        }

        const raw = await response.text();
        return {
            ok: false,
            status: response.status,
            payload: tryParseJson(raw) || {}
        };
    } catch (error) {
        return {
            ok: false,
            status: 503,
            payload: { message: error instanceof Error ? error.message : 'Auth delete failed.' }
        };
    }
}

async function cleanupDeletedAccountRows(adminConfig, userId) {
    const failures = [];

    for (const target of ACCOUNT_DELETE_CLEANUP_TARGETS) {
        const result = await deleteSupabaseTableRows(adminConfig, target, userId);
        if (!result.ok) {
            failures.push({
                table: target.table,
                status: result.status,
                payload: result.payload,
                optional: target.optional
            });
        }
    }

    return {
        ok: failures.length === 0,
        failures: failures
    };
}

async function handleAccountDeleteRequest(request, env, origin) {
    if (request.method !== 'DELETE') {
        return jsonResponse(
            { success: false, message: 'Method not allowed' },
            405,
            origin,
            { 'Allow': 'DELETE, OPTIONS' }
        );
    }

    const adminConfig = getSupabaseAdminConfig(env);
    if (!adminConfig.ok || !env.SUPABASE_PUBLISHABLE_KEY) {
        return jsonResponse(
            { success: false, message: 'Account deletion is not configured on the server.' },
            503,
            origin
        );
    }

    const bearerToken = extractBearerToken(request.headers.get('Authorization'));
    if (!bearerToken) {
        return jsonResponse(
            { success: false, message: 'Unauthorized' },
            401,
            origin,
            { 'WWW-Authenticate': 'Bearer realm="account-delete"' }
        );
    }

    const authResult = await verifySupabaseAccessToken(env, bearerToken);
    if (!authResult.ok) {
        if (authResult.reason === 'misconfigured') {
            return jsonResponse(
                { success: false, message: 'Unable to delete account. Try again.' },
                503,
                origin
            );
        }

        if (authResult.reason === 'unavailable') {
            return jsonResponse(
                { success: false, message: 'Authentication service unavailable' },
                503,
                origin
            );
        }

        return jsonResponse(
            { success: false, message: 'Unauthorized' },
            401,
            origin,
            { 'WWW-Authenticate': 'Bearer realm="account-delete"' }
        );
    }

    const userId = cleanText(authResult.userId, '');
    if (!userId) {
        return jsonResponse(
            { success: false, message: 'Unauthorized' },
            401,
            origin,
            { 'WWW-Authenticate': 'Bearer realm="account-delete"' }
        );
    }

    const clientAddress = resolveClientAddress(request);
    const rateLimitBucket = `account-delete:${userId}:${clientAddress}`;
    const rateLimitStatus = enforceRateLimit(rateLimitBucket);
    if (rateLimitStatus.limited) {
        return jsonResponse(
            { success: false, message: 'Too many requests. Please wait and try again.' },
            429,
            origin,
            { 'Retry-After': String(rateLimitStatus.retryAfterSeconds) }
        );
    }

    const revokeResult = await revokeSupabaseUserSessions(adminConfig, userId);
    if (!revokeResult.ok) {
        console.warn('[account-delete] failed to revoke sessions', {
            userId: userId,
            status: revokeResult.status,
            payload: revokeResult.payload
        });
    }

    const deleteResult = await deleteSupabaseUser(adminConfig, userId);
    if (!deleteResult.ok) {
        console.error('[account-delete] failed to delete auth user', {
            userId: userId,
            status: deleteResult.status,
            payload: deleteResult.payload
        });

        return jsonResponse(
            { success: false, message: 'Unable to delete account. Try again.' },
            500,
            origin
        );
    }

    const cleanupResult = await cleanupDeletedAccountRows(adminConfig, userId);
    if (!cleanupResult.ok) {
        console.error('[account-delete] cleanup failures', {
            userId: userId,
            failures: cleanupResult.failures
        });
    }

    return jsonResponse(
        { success: true, message: 'Account deleted successfully.' },
        200,
        origin
    );
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin');
        const requestUrl = new URL(request.url);
        const pathname = cleanText(requestUrl.pathname, '/');

        if (request.method === 'OPTIONS') {
            if (!origin || !isAllowedOrigin(origin)) {
                return jsonResponse({ error: 'Forbidden' }, 403, origin);
            }

            return new Response(null, {
                status: 204,
                headers: buildCorsHeaders(origin)
            });
        }

        if (!origin || !isAllowedOrigin(origin)) {
            return jsonResponse({ error: 'Forbidden' }, 403, origin);
        }

        if (pathname === ACCOUNT_DELETE_ROUTE) {
            return handleAccountDeleteRequest(request, env, origin);
        }

        return jsonResponse({ error: 'Not found' }, 404, origin);
    }
};
