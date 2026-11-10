/**
 * progress-tracker.js
 * Tracks student practice attempts and saves them to Supabase.
 * 
 * Step 3 Update: Refactored for new schema
 * - Old: quiz_attempts table with detailed attempt tracking
 * - New: practice_scores table with final scores
 * - Ready for Step 4: Full progress system integration
 */

window.ProgressTracker = (() => {
    const startTimes = new Map();

    let progressCache = null;
    let progressCachePromise = null;
    let progressCacheSite = null;
    let progressCacheUserId = null;

    function resetProgressCache() {
        progressCache = null;
        progressCachePromise = null;
        progressCacheSite = null;
        progressCacheUserId = null;
    }

    async function ensureProgressCache(site, session) {
        const userId = session?.user?.id;
        if (!site || !userId) {
            resetProgressCache();
            return null;
        }

        if (progressCache && progressCacheSite === site && progressCacheUserId === userId) {
            return progressCache;
        }

        if (progressCachePromise && progressCacheSite === site && progressCacheUserId === userId) {
            return progressCachePromise;
        }

        resetProgressCache();
        progressCacheSite = site;
        progressCacheUserId = userId;

        progressCachePromise = (async () => {
            try {
                if (!window.supabaseClient) return null;

                const { data, error } = await window.supabaseClient
                    .from('progress')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('site', site);

                if (error) {
                    return null;
                }

                const map = new Map();
                (data || []).forEach(row => {
                    map.set(row.item_path, row);
                });
                return map;
            } catch (err) {
                return null;
            }
        })();

        const result = await progressCachePromise;
        if (progressCacheSite !== site || progressCacheUserId !== userId) {
            return null;
        }

        if (result) {
            progressCache = result;
        } else {
            resetProgressCache();
        }
        return result;
    }

    function sanitizeText(value, maxLength) {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
        if (!normalized) {
            return null;
        }

        return normalized.slice(0, maxLength);
    }

    function clampInteger(value, min, max, fallback = 0) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed)) {
            return fallback;
        }

        return Math.min(max, Math.max(min, parsed));
    }

    function normalizeQuizUrl(rawUrl) {
        const fallbackPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        try {
            const url = new URL(typeof rawUrl === 'string' ? rawUrl : fallbackPath, window.location.origin);
            if (url.origin !== window.location.origin) {
                return fallbackPath;
            }

            return `${url.pathname}${url.search}${url.hash}`.slice(0, 500);
        } catch (error) {
            return fallbackPath;
        }
    }

    function normalizeQuestionNumber(value) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed < 1) {
            return null;
        }

        return parsed;
    }

    return {
        startQuestion(questionId) {
            const normalizedId = sanitizeText(questionId, 120);
            if (!normalizedId) {
                return;
            }

            startTimes.set(normalizedId, Date.now());
        },

        getElapsedTime(questionId) {
            const normalizedId = sanitizeText(questionId, 120);
            if (!normalizedId) {
                return 0;
            }

            const startTime = startTimes.get(normalizedId);
            if (!startTime) {
                return 0;
            }

            return Math.max(0, Math.round((Date.now() - startTime) / 1000));
        },

        async saveAttempt(attemptData) {
            try {
                if (!window.supabaseClient) {
                    window.logEvent('Cannot save practice attempt: Supabase client not initialized');
                    return false;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    console.warn('Cannot save attempt: user is not authenticated.');
                    return false;
                }

                if (typeof attemptData?.is_correct !== 'boolean') {
                    window.logEvent('Invalid attempt data', { attemptData });
                    return false;
                }

                // New schema: practice_scores stores final scores (0-100)
                // Convert boolean is_correct to score
                const score = attemptData.is_correct ? 100 : 0;
                
                const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;
                const practicePath = window.normalizePath 
                    ? window.normalizePath(attemptData.practice_url || attemptData.quiz_url)
                    : normalizeQuizUrl(attemptData.practice_url || attemptData.quiz_url);

                const sanitizedData = {
                    user_id: session.user.id,
                    site: site,
                    practice_path: practicePath,
                    score: clampInteger(score, 0, 100)
                };

                const { error } = await window.supabaseClient
                    .from('practice_scores')
                    .upsert(sanitizedData, { onConflict: 'user_id,site,practice_path' });

                if (error) {
                    window.logEvent('Failed to save practice attempt', { error });
                    return false;
                }

                window.logEvent('Practice score saved');
                return true;
            } catch (error) {
                window.logEvent('Unexpected error saving attempt', { error });
                return false;
            }
        },

        async getAttemptHistory(filters = {}) {
            try {
                if (!window.supabaseClient) {
                    return [];
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return [];
                }

                const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;

                let query = window.supabaseClient
                    .from('practice_scores')
                    .select('id, practice_path, score, updated_at')
                    .eq('user_id', session.user.id)
                    .eq('site', site)
                    .order('updated_at', { ascending: false });

                if (filters.practice_path) {
                    const normalizedPath = window.normalizePath 
                        ? window.normalizePath(filters.practice_path)
                        : normalizeQuizUrl(filters.practice_path);
                    query = query.eq('practice_path', normalizedPath);
                }
                if (filters.limit) {
                    query = query.limit(clampInteger(filters.limit, 1, 100, 10));
                }

                const { data, error } = await query;
                if (error) {
                    window.logEvent('Failed to fetch practice attempts', { error });
                    return [];
                }

                return data || [];
            } catch (error) {
                window.logEvent('Unexpected error fetching attempts', { error });
                return [];
            }
        },

        async getPracticeStats(practicePath) {
            try {
                const attempts = await this.getAttemptHistory({ practice_path: practicePath });
                const totalAttempts = attempts.length;
                const averageScore = totalAttempts
                    ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / totalAttempts)
                    : 0;
                const highestScore = totalAttempts
                    ? Math.max(...attempts.map(a => a.score || 0))
                    : 0;

                return {
                    total_attempts: totalAttempts,
                    average_score: averageScore,
                    highest_score: highestScore,
                    passing: averageScore >= 70 ? 'Yes' : 'No'
                };
            } catch (error) {
                window.logEvent('Failed to calculate practice stats', { error });
                return null;
            }
        },

        async getQuizStats(quizUrl) {
            // Deprecated: Use getPracticeStats instead
            // Kept for backward compatibility
            return this.getPracticeStats(quizUrl);
        },

        async getOverallStats() {
            try {
                if (!window.supabaseClient) {
                    return null;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return null;
                }

                const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;

                const { data: scores, error } = await window.supabaseClient
                    .from('practice_scores')
                    .select('practice_path, score')
                    .eq('user_id', session.user.id)
                    .eq('site', site);

                if (error) {
                    window.logEvent('Failed to fetch scores for overall stats', { error });
                    return null;
                }

                const safeScores = scores || [];
                const totalPractices = safeScores.length;
                const averageScore = totalPractices
                    ? Math.round(safeScores.reduce((sum, s) => sum + (s.score || 0), 0) / totalPractices)
                    : 0;
                const uniquePractices = new Set(safeScores.map(s => s.practice_path)).size;
                const passingCount = safeScores.filter(s => s.score >= 70).length;

                return {
                    total_practices: totalPractices,
                    unique_practices: uniquePractices,
                    average_score: averageScore,
                    passing_practices: passingCount,
                    failing_practices: totalPractices - passingCount
                };
            } catch (error) {
                window.logEvent('Failed to calculate overall stats', { error });
                return null;
            }
        },

        /**
         * STEP 4: Progress Tick System
         * New functions for full progress tracking
         */

        detectItemType(path) {
            // Auto-detect item type from URL path
            if (!path || typeof path !== 'string') {
                return 'article'; // Default to article
            }

            const lowerPath = path.toLowerCase();
            
            // Practice detection
            if (lowerPath.includes('/practice/') || 
                lowerPath.includes('/practice-advanced/') ||
                lowerPath.includes('/practice-solution/')) {
                return 'practice';
            }

            // Check if it's a practice page (renamed from quiz)
            if (lowerPath.includes('/practice') && lowerPath.endsWith('.html')) {
                return 'practice';
            }

            // Articles in notes folder
            if (lowerPath.includes('/notes/')) {
                // If it has practice in the name, it's a practice
                if (lowerPath.includes('practice') || lowerPath.includes('quiz')) {
                    return 'practice';
                }
                return 'article';
            }

            return 'article'; // Default
        },

        async getProgress(site, itemPath) {
            try {
                if (!window.supabaseClient) {
                    return null;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return null;
                }

                const normalizedPath = window.normalizePath 
                    ? window.normalizePath(itemPath)
                    : normalizeQuizUrl(itemPath);

                // Use bulk cache if possible
                await ensureProgressCache(site, session);
                if (progressCache) {
                    return progressCache.get(normalizedPath) || null;
                }

                // Fallback to single fetch if bulk fails
                // Use limit(1) to avoid PostgREST 406 when multiple rows exist
                const { data: rows, error } = await window.supabaseClient
                    .from('progress')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .eq('site', site)
                    .eq('item_path', normalizedPath)
                    .limit(1);

                if (error) {
                    // Log and return null on unexpected errors
                    window.logEvent('Failed to fetch progress', { error });
                    return null;
                }

                // Return the first row if present
                return (rows && rows.length) ? rows[0] : null;
            } catch (error) {
                window.logEvent('Error fetching progress', { error });
                return null;
            }
        },

        async setProgress(site, itemPath, itemType, completed) {
            try {
                if (!window.supabaseClient) {
                    return false;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return false;
                }

                const normalizedPath = window.normalizePath 
                    ? window.normalizePath(itemPath)
                    : normalizeQuizUrl(itemPath);

                const progressData = {
                    user_id: session.user.id,
                    site: site,
                    item_path: normalizedPath,
                    item_type: itemType,
                    completed: completed
                };

                const { error } = await window.supabaseClient
                    .from('progress')
                    .upsert(progressData, { onConflict: 'user_id,site,item_path' });

                if (error) {
                    window.logEvent('Failed to set progress', { error });
                    return false;
                }

                // Update local cache to keep it in sync
                if (progressCache && progressCacheSite === site && progressCacheUserId === session.user.id) {
                    progressCache.set(normalizedPath, {
                        ...progressData,
                        completed: completed
                    });
                }

                window.logEvent('Progress updated');
                return true;
            } catch (error) {
                window.logEvent('Unexpected error setting progress', { error });
                return false;
            }
        },

        async toggleProgress(site, itemPath, itemType) {
            try {
                // NOTE: Potential race condition between read and write if multiple tabs
                // are open. However, Supabase upsert ensures consistency.
                // Multi-tab sync would need additional server-side versioning.
                const currentProgress = await this.getProgress(site, itemPath);
                const newCompletedState = currentProgress ? !currentProgress.completed : true;
                
                return await this.setProgress(site, itemPath, itemType, newCompletedState);
            } catch (error) {
                window.logEvent('Error toggling progress', { error });
                return false;
            }
        },

        async markCompleted(site, itemPath, itemType) {
            return await this.setProgress(site, itemPath, itemType, true);
        },

        clearProgressCache() {
            resetProgressCache();
        },

        async loadPageProgress() {
            try {
                if (!window.isUserLoggedIn || !window.isUserLoggedIn()) {
                    return null;
                }

                const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;
                const path = window.getCurrentPath ? window.getCurrentPath() : window.location.pathname;
                const itemType = this.detectItemType(path);

                const progress = await this.getProgress(site, path);
                
                return {
                    completed: progress ? progress.completed : false,
                    itemType: itemType,
                    site: site,
                    itemPath: path,
                    data: progress
                };
            } catch (error) {
                window.logEvent('Error loading page progress', { error });
                return null;
            }
        },

        async savePracticeScore(site, practicePath, score) {
            try {
                if (!window.supabaseClient) {
                    return false;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return false;
                }

                // Validate score
                const validScore = clampInteger(score, 0, 100);

                const normalizedPath = window.normalizePath 
                    ? window.normalizePath(practicePath)
                    : normalizeQuizUrl(practicePath);

                const scoreData = {
                    user_id: session.user.id,
                    site: site,
                    practice_path: normalizedPath,
                    score: validScore
                };

                const { error } = await window.supabaseClient
                    .from('practice_scores')
                    .upsert(scoreData, { onConflict: 'user_id,site,practice_path' });

                if (error) {
                    window.logEvent('Failed to save practice score', { error });
                    return false;
                }

                window.logEvent('Practice score saved successfully');
                return true;
            } catch (error) {
                window.logEvent('Unexpected error saving practice score', { error });
                return false;
            }
        },

        async getPracticeScore(site, practicePath) {
            try {
                if (!window.supabaseClient) {
                    return null;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return null;
                }

                const normalizedPath = window.normalizePath 
                    ? window.normalizePath(practicePath)
                    : normalizeQuizUrl(practicePath);

                const { data: rows, error } = await window.supabaseClient
                    .from('practice_scores')
                    .select('score')
                    .eq('user_id', session.user.id)
                    .eq('site', site)
                    .eq('practice_path', normalizedPath)
                    .limit(1);

                if (error) {
                    window.logEvent('Failed to fetch practice score', { error });
                    return null;
                }

                return (rows && rows[0] && Number.isFinite(rows[0].score)) ? rows[0].score : null;
            } catch (error) {
                window.logEvent('Error fetching practice score', { error });
                return null;
            }
        },

        async deleteAllAttempts() {
            if (!window.confirm('Are you sure? This will delete all of your practice scores.')) {
                return false;
            }

            try {
                if (!window.supabaseClient) {
                    return false;
                }

                const session = await window.getCurrentSession();
                if (!session) {
                    return false;
                }

                const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;

                const { error } = await window.supabaseClient
                    .from('practice_scores')
                    .delete()
                    .eq('user_id', session.user.id)
                    .eq('site', site);

                if (error) {
                    window.logEvent('Failed to delete practice scores', { error });
                    return false;
                }

                window.logEvent('All practice scores deleted');
                return true;
            } catch (error) {
                window.logEvent('Unexpected error deleting practice scores', { error });
                return false;
            }
        }
    };
})();

if (window.addEventListener) {
    window.addEventListener('rs:auth-state-change', () => {
        if (window.ProgressTracker && typeof window.ProgressTracker.clearProgressCache === 'function') {
            window.ProgressTracker.clearProgressCache();
        }
    });
}

window.logEvent('Progress tracker loaded');
