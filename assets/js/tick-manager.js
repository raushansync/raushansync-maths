/**
 * tick-manager.js
 * STEP 4: Progress Tick System
 * 
 * Manages the UI and interactions for progress completion ticks.
 * - Green tick = completed
 * - Blue tick = incomplete
 * - Toggleable by user click
 * - Persistent across sessions
 * - Syncs with Supabase progress table
 */

window.TickManager = (() => {
    const TICK_STATES = {
        COMPLETED: 'completed',
        INCOMPLETE: 'incomplete',
        LOADING: 'loading',
        ERROR: 'error'
    };

    const TICK_SYMBOLS = {
        completed: '\u2713',
        incomplete: '\u25CB'
    };

    // Progress-key -> Set<HTMLElement>. Multiple cards may legitimately point
    // to the same item, so each container owns its own button while states sync.
    const tickElements = new Map();
    const containerInitPromises = new WeakMap();
    let tickDomCounter = 0;

    function safeLog(eventName, eventData = {}) {
        if (typeof window.logEvent === 'function') {
            window.logEvent(eventName, eventData);
        }
    }

    function normalizeTickPath(itemPath) {
        if (window.normalizePath && typeof window.normalizePath === 'function') {
            return window.normalizePath(itemPath);
        }

        try {
            const url = new URL(itemPath || window.location.pathname, window.location.origin);
            if (url.origin !== window.location.origin) {
                return window.location.pathname + window.location.search + window.location.hash;
            }
            return `${url.pathname}${url.search}${url.hash}`.slice(0, 500);
        } catch (error) {
            return window.location.pathname + window.location.search + window.location.hash;
        }
    }

    function createTickId(site, itemPath) {
        return `${site}-${normalizeTickPath(itemPath)}`.replace(/[^\w-]/g, '_');
    }

    function getDirectTickChildren(container) {
        return Array.from(container.children).filter(child => child.classList?.contains('progress-tick'));
    }

    function registerTick(tickId, tick) {
        if (!tickElements.has(tickId)) {
            tickElements.set(tickId, new Set());
        }
        tickElements.get(tickId).add(tick);
    }

    function unregisterTick(tickId, tick) {
        const matchingTicks = tickElements.get(tickId);
        if (!matchingTicks) return;

        matchingTicks.delete(tick);
        if (!matchingTicks.size) {
            tickElements.delete(tickId);
        }
    }

    function updateMatchingTicks(tickElement, newState) {
        const tickId = tickElement.dataset.tickId;
        const matchingTicks = tickElements.get(tickId);

        if (!matchingTicks) {
            updateTickState(tickElement, newState);
            return;
        }

        for (const tick of matchingTicks) {
            if (tick.isConnected) {
                updateTickState(tick, newState);
            } else {
                matchingTicks.delete(tick);
            }
        }

        if (!matchingTicks.size) {
            tickElements.delete(tickId);
        }
    }

    function getCurrentTickState(tickElement) {
        if (tickElement.classList.contains(TICK_STATES.COMPLETED)) {
            return TICK_STATES.COMPLETED;
        }

        return TICK_STATES.INCOMPLETE;
    }

    /**
     * Create a tick element
     * @param {string} id - Unique identifier for this tick
     * @param {string} state - Initial state (completed/incomplete)
     * @returns {HTMLElement} Tick element
     */
    function createTickElement(id, state = TICK_STATES.INCOMPLETE) {
        const tick = document.createElement('button');
        tick.className = `progress-tick ${state}`;
        tick.id = `tick-${id}-${tickDomCounter++}`;
        tick.setAttribute('aria-label', state === TICK_STATES.COMPLETED ? 'Mark as incomplete' : 'Mark as complete');
        tick.setAttribute('type', 'button');
        tick.textContent = TICK_SYMBOLS[state] || '\u25CB';
        tick.dataset.tickId = id;
        
        return tick;
    }

    /**
     * Update tick visual state
     * @param {HTMLElement} tickElement - Tick DOM element
     * @param {string} newState - New state
     */
    function updateTickState(tickElement, newState) {
        // Remove all state classes
        Object.values(TICK_STATES).forEach(state => {
            tickElement.classList.remove(state);
        });

        // Add new state class
        tickElement.classList.add(newState);

        // Update symbol
        tickElement.textContent = TICK_SYMBOLS[newState] || '\u25CB';

        // Update aria label
        if (newState === TICK_STATES.COMPLETED) {
            tickElement.setAttribute('aria-label', 'Mark as incomplete');
        } else if (newState === TICK_STATES.INCOMPLETE) {
            tickElement.setAttribute('aria-label', 'Mark as complete');
        }
    }

    /**
     * Handle tick click event
     * @param {Event} event - Click event
     */
    async function handleTickClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const tickElement = event.currentTarget;
        const tickId = tickElement.dataset.tickId;

        if (!tickId) {
            safeLog('Tick error: ID not found on element');
            return;
        }

        // Check if user is logged in
        if (!window.isUserLoggedIn || !window.isUserLoggedIn()) {
            // Redirect directly to login with return path using the site's redirect helper
            if (window.redirectToLogin) {
                window.redirectToLogin(window.location.pathname + window.location.search + window.location.hash);
            } else {
                window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
            }
            return;
        }

        // Show loading state
        const previousState = getCurrentTickState(tickElement);
        updateMatchingTicks(tickElement, TICK_STATES.LOADING);

        try {
            // Get progress tracker
            if (!window.ProgressTracker) {
                throw new Error('ProgressTracker not initialized');
            }

            // Get current values from data attributes
            const site = tickElement.dataset.site || (window.getCurrentSite ? window.getCurrentSite() : window.location.hostname);
            const itemPath = tickElement.dataset.itemPath || (window.getCurrentPath ? window.getCurrentPath() : window.location.pathname);
            const itemType = tickElement.dataset.itemType || window.ProgressTracker.detectItemType(itemPath);

            // Toggle progress
            const success = await window.ProgressTracker.toggleProgress(site, itemPath, itemType);

            if (!success) {
                throw new Error('Failed to toggle progress');
            }

            // Get updated progress state
            const progress = await window.ProgressTracker.getProgress(site, itemPath);
            const newState = progress?.completed ? TICK_STATES.COMPLETED : TICK_STATES.INCOMPLETE;

            // Update UI
            updateMatchingTicks(tickElement, newState);

            // Trigger dashboard update if function exists
            if (window.updateProgressDisplay && typeof window.updateProgressDisplay === 'function') {
                window.updateProgressDisplay();
            }

            // Log success
            safeLog('Progress tick toggled', { site, itemPath, itemType, completed: progress?.completed });

        } catch (error) {
            console.error('Error toggling tick:', error);
            updateMatchingTicks(tickElement, TICK_STATES.ERROR);
            
            // Revert to previous state after delay
            setTimeout(() => {
                updateMatchingTicks(tickElement, previousState);
            }, 2000);

            safeLog('Error toggling tick', { error: error.message });
        }
    }

    return {
        /**
         * Initialize tick on a page
         * @param {string} containerId - ID of element where tick should be added
         * @param {object} options - Configuration
         *   - site: site identifier
         *   - itemPath: path to item
         *   - itemType: 'article' or 'practice'
         *   - position: 'header' or 'inline' (default)
         *   - className: additional CSS classes
         */
        async initTick(containerId, options = {}) {
            let container = null;
            try {
                container = document.getElementById(containerId);
                if (!container) {
                    safeLog('Tick error: Container not found', { containerId });
                    return null;
                }

                if (containerInitPromises.has(container)) {
                    return await containerInitPromises.get(container);
                }

                const initPromise = (async () => {
                    container.dataset.tickInitialized = 'initializing';

                    // Set defaults
                    const site = options.site || (window.getCurrentSite ? window.getCurrentSite() : window.location.hostname);
                    const itemPath = normalizeTickPath(options.itemPath || (window.getCurrentPath ? window.getCurrentPath() : window.location.pathname));
                    const itemType = options.itemType || (window.ProgressTracker ? window.ProgressTracker.detectItemType(itemPath) : 'article');
                    const position = options.position || 'inline';
                    const customClass = options.className || '';

                    // Generate a stable progress key for this tick.
                    const tickId = createTickId(site, itemPath);

                    // Keep only one direct tick button per container. This repairs pages
                    // that were partially initialized by an older/racing call.
                    let tick = null;
                    for (const existingTick of getDirectTickChildren(container)) {
                        if (!tick && existingTick.dataset.tickId === tickId) {
                            tick = existingTick;
                            continue;
                        }

                        unregisterTick(existingTick.dataset.tickId, existingTick);
                        existingTick.remove();
                    }

                    // Create tick element
                    let initialState = TICK_STATES.INCOMPLETE;
                    if (!tick) {
                        tick = createTickElement(tickId, initialState);
                    } else {
                        tick.dataset.tickId = tickId;
                    }

                    // Set data attributes
                    tick.dataset.site = site;
                    tick.dataset.itemPath = itemPath;
                    tick.dataset.itemType = itemType;

                    // Add custom classes
                    if (customClass) {
                        tick.classList.add(...customClass.split(/\s+/).filter(Boolean));
                    }

                    // Add position-specific classes
                    tick.classList.remove('page-header-tick', 'section-tick', 'item-tick');
                    if (position === 'header') {
                        tick.classList.add('page-header-tick');
                    } else if (position === 'section') {
                        tick.classList.add('section-tick');
                    } else if (position === 'item') {
                        tick.classList.add('item-tick');
                    }

                    // Add click handler once.
                    if (tick.dataset.tickClickBound !== 'true') {
                        tick.addEventListener('click', handleTickClick);
                        tick.dataset.tickClickBound = 'true';
                    }

                    registerTick(tickId, tick);

                    // Append before async state loading so the new button is
                    // included when matching ticks are synchronized.
                    if (tick.parentElement !== container) {
                        container.appendChild(tick);
                    }

                    // Load current progress state (async)
                    if (window.isUserLoggedIn && window.isUserLoggedIn()) {
                        if (window.ProgressTracker) {
                            const progress = await window.ProgressTracker.getProgress(site, itemPath);
                            initialState = progress?.completed ? TICK_STATES.COMPLETED : TICK_STATES.INCOMPLETE;
                            updateMatchingTicks(tick, initialState);
                        }
                    } else {
                        updateTickState(tick, initialState);
                    }

                    container.dataset.tickInitialized = 'true';
                    return tick;
                })();

                containerInitPromises.set(container, initPromise);

                return await initPromise;

            } catch (error) {
                if (container) {
                    delete container.dataset.tickInitialized;
                }
                console.error('Error initializing tick:', error);
                safeLog('Tick initialization error', { error: error.message });
                return null;
            } finally {
                if (container) {
                    containerInitPromises.delete(container);
                }
            }
        },

        /**
         * Initialize ticks for all elements with tick-container data attribute
         * Should be called on page load
         */
        async initializePageTicks() {
            try {
                const tickContainers = document.querySelectorAll('[data-tick-container]');
                
                for (const container of tickContainers) {
                    // Skip healthy containers, but repair any initialized marker
                    // that does not actually have a rendered tick.
                    if (container.dataset.tickInitialized === 'true' && container.querySelector('.progress-tick')) {
                        continue;
                    }

                    // Safety: if container already contains a progress-tick element,
                    // mark it initialized and skip to avoid duplicates (possible
                    // when initializePageTicks is called multiple times).
                    if (container.querySelector && container.querySelector('.progress-tick')) {
                        container.dataset.tickInitialized = 'true';
                        continue;
                    }

                    const options = {
                        position: container.dataset.tickPosition || 'inline',
                        className: container.dataset.tickClass || ''
                    };

                    // Get custom site/path if specified
                    if (container.dataset.tickSite) {
                        options.site = container.dataset.tickSite;
                    }
                    if (container.dataset.tickPath) {
                        options.itemPath = container.dataset.tickPath;
                    }
                    if (container.dataset.tickType) {
                        options.itemType = container.dataset.tickType;
                    }

                    await this.initTick(container.id, options);
                }

                // NEW: Dynamically process article/practice "cards" across the hub pages
                const cards = document.querySelectorAll('.card-grid > .card');
                let cardCounter = 0;

                for (const card of cards) {
                    if (card.dataset.tickInitialized === 'true' && card.querySelector('.card-tick-container .progress-tick')) {
                        continue;
                    }

                    const btn = Array.from(card.querySelectorAll('a.btn')).find(link => {
                        const href = link.getAttribute('href');
                        return href && !link.classList.contains('disabled') && link.getAttribute('aria-disabled') !== 'true';
                    });
                    const statusEl = card.querySelector('.status');
                    
                    if (!btn || !statusEl) continue;
                    
                    const href = btn.getAttribute('href');
                    if (!href) continue;

                    // Resolve the absolute path of the destination linked in the card
                    const a = document.createElement('a');
                    a.href = href; 
                    const itemPath = a.pathname + a.search + a.hash;

                    // Determine if it represents a practice or article based on URL
                    const itemType = window.ProgressTracker 
                        ? window.ProgressTracker.detectItemType(itemPath) 
                        : (itemPath.includes('/practice/') ? 'practice' : 'article');

                    let flexWrap = card.querySelector('.card-header-flex');
                    let container = card.querySelector('.card-tick-container');
                    
                    if (!flexWrap) {
                        flexWrap = document.createElement('div');
                        flexWrap.className = 'card-header-flex';
                        card.insertBefore(flexWrap, statusEl);
                    }

                    if (!container) {
                        container = document.createElement('div');
                        container.className = 'card-tick-container';
                        
                        // Generate a pseudo-unique ID required by initTick logic
                        container.id = 'card-tick-' + Date.now().toString(36) + '-' + (cardCounter++);
                    }

                    container.dataset.tickSite = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;
                    container.dataset.tickPath = itemPath;
                    container.dataset.tickType = itemType;
                    container.dataset.tickPosition = 'item';
                    container.removeAttribute('data-tick-container');

                    if (statusEl.parentElement !== flexWrap) {
                        flexWrap.insertBefore(statusEl, flexWrap.firstChild);
                    }

                    if (container.parentElement !== flexWrap) {
                        flexWrap.appendChild(container);
                    }

                    // Spin up the tick component
                    const tick = await this.initTick(container.id, {
                        site: container.dataset.tickSite,
                        itemPath: container.dataset.tickPath,
                        itemType: container.dataset.tickType,
                        position: 'item' // uses item-tick class which has small margins mapping
                    });

                    if (tick) {
                        card.dataset.tickInitialized = 'true';
                    } else {
                        delete card.dataset.tickInitialized;
                    }
                }

                safeLog('Page ticks initialized');

            } catch (error) {
                console.error('Error initializing page ticks:', error);
                safeLog('Page ticks initialization error', { error: error.message });
            }
        },

        /**
         * Get tick element by ID
         */
        getTick(tickId) {
            const matchingTicks = tickElements.get(tickId);
            if (!matchingTicks) return null;

            return Array.from(matchingTicks).find(tickElement => tickElement.isConnected) || null;
        },

        /**
         * Update multiple ticks (useful for dashboard updates)
         */
        async updateAllTicks() {
            try {
                for (const [tickId, matchingTicks] of tickElements) {
                    const activeTicks = Array.from(matchingTicks).filter(tickElement => tickElement.isConnected);
                    if (!activeTicks.length) {
                        tickElements.delete(tickId);
                        continue;
                    }

                    const firstTick = activeTicks[0];
                    if (firstTick.classList.contains(TICK_STATES.LOADING) ||
                        firstTick.classList.contains(TICK_STATES.ERROR)) {
                        continue;
                    }

                    // Get fresh progress
                    const site = firstTick.dataset.site;
                    const itemPath = firstTick.dataset.itemPath;

                    if (window.ProgressTracker) {
                        const progress = await window.ProgressTracker.getProgress(site, itemPath);
                        const newState = progress?.completed ? TICK_STATES.COMPLETED : TICK_STATES.INCOMPLETE;
                        activeTicks.forEach(tickElement => updateTickState(tickElement, newState));
                    }
                }
            } catch (error) {
                console.error('Error updating all ticks:', error);
                safeLog('Ticks update error', { error: error.message });
            }
        },

        /**
         * Clear all cached ticks (useful for logout)
         */
        clearAll() {
            for (const matchingTicks of tickElements.values()) {
                for (const tickElement of matchingTicks) {
                    const container = tickElement.parentElement;
                    const card = container?.closest?.('.card');

                    tickElement.remove();
                    if (container?.dataset) {
                        delete container.dataset.tickInitialized;
                    }
                    if (card?.dataset) {
                        delete card.dataset.tickInitialized;
                    }
                }
            }
            tickElements.clear();
        },

        // Expose states for external use
        STATES: TICK_STATES,
        SYMBOLS: TICK_SYMBOLS
    };
})();

// Auto-initialize ticks when page loads (if ProgressTracker is ready)
window.addEventListener('load', async () => {
    if (window.TickManager && window.isUserLoggedIn && window.isUserLoggedIn()) {
        await window.TickManager.initializePageTicks();
    }
});

// Cleanup on logout - listen to auth state changes
if (window.addEventListener) {
    // Primary: listen for auth state change events from auth-config.js
    window.addEventListener('rs:auth-state-change', (event) => {
        const session = event.detail?.session;
        if (session?.user) {
            if (window.TickManager && typeof window.TickManager.initializePageTicks === 'function') {
                window.TickManager.initializePageTicks().catch(error => {
                    console.error('Error initializing ticks after login:', error);
                });
            }
        } else {
            // User logged out - clear all tick UI and listeners
            if (window.TickManager && typeof window.TickManager.clearAll === 'function') {
                window.TickManager.clearAll();
            }
        }
    });
    
    // Fallback: also handle custom user-logout event for backward compatibility
    document.addEventListener('user-logout', () => {
        if (window.TickManager && typeof window.TickManager.clearAll === 'function') {
            window.TickManager.clearAll();
        }
    });
}

window.logEvent('Tick manager loaded');
