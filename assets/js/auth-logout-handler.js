/**
 * auth-logout-handler.js
 * Simple utility to handle logout functionality on any page.
 * 
 * Usage in your page:
 *   <script src="/assets/js/auth-logout-handler.js"></script>
 * 
 *   Then add data-action="logout" to any button:
 *   <button data-action="logout">Sign Out</button>
 * 
 * Or call programmatically:
 *   window.handleLogout();
 */

(function logoutHandler() {
    // Handler for logout action
    window.handleLogout = async function (options = {}) {
        const { quiet = false } = options;

        if (!quiet) {
            const confirmed = window.confirm('Are you sure you want to sign out?');
            if (!confirmed) {
                return false;
            }
        }

        try {
            await window.signOut();
            // signOut() automatically redirects to login, so we won't reach here
            return true;
        } catch (error) {
            if (DEBUG_AUTH) {
                console.error('Logout error:', error);
            }
            if (!quiet) {
                alert('Logout failed. Please try again.');
            }
            return false;
        }
    };

    // Attach event listeners to all elements with data-action="logout"
    // Use stopImmediatePropagation to prevent double-firing
    document.addEventListener('click', async (event) => {
        if (event.target.getAttribute('data-action') === 'logout') {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            // Dispatch user-logout event for progress system cleanup (STEP 4)
            try {
                document.dispatchEvent(new CustomEvent('user-logout'));
            } catch (e) {
                // Ignore dispatch errors
            }
            
            await window.handleLogout();
        }
    }, true); // Use capturing phase to fire before other handlers
})();
