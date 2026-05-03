/**
 * quiz-score-handler.js
 * STEP 4: Quiz Score Calculation and Persistence
 * 
 * Handles score calculation, display, and saving for all quiz/practice pages.
 * Include this script in any quiz page to enable score tracking.
 * 
 * Usage:
 * 1. Include script tag: <script src="/assets/js/quiz-score-handler.js"></script>
 * 2. Ensure .quiz-card elements exist with data-answer attributes
 * 3. Score calculation and submission button are auto-initialized
 */

window.QuizScoreHandler = (() => {
    const quizState = {
        correctAnswers: new Set(),
        answeredCards: new Set(),  // Track which cards have been answered
        totalQuestions: 0,
        submitted: false
    };

    function getSelectedAnswers(card) {
        const inputs = card.querySelectorAll('input');
        const selected = [];
        inputs.forEach(input => {
            if (input.checked) {
                selected.push(input.value);
            }
        });
        return selected;
    }

    function getCorrectAnswers(card) {
        const raw = card.dataset.answer || '';
        return raw.split(',').map(a => a.trim()).filter(a => a);
    }

    function arraysMatch(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((val, idx) => val === sorted2[idx]);
    }

    function calculateAndSaveScore() {
        const totalQuestions = document.querySelectorAll('.quiz-card').length;
        const correctCount = quizState.correctAnswers.size;
        const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

        return { score, correctCount, totalQuestions };
    }

    function showScoreCard() {
        // Remove any existing score card
        const existingCard = document.querySelector('.quiz-score-card');
        if (existingCard) {
            existingCard.remove();
        }

        const { score, correctCount, totalQuestions } = calculateAndSaveScore();
        const passed = score >= 70;

        const scoreCard = document.createElement('section');
        scoreCard.className = 'quiz-score-card palette ' + (passed ? 'success' : 'warning');
        scoreCard.innerHTML = `
            <h2>Practice Complete!</h2>
            <div class="score-display">
                <div class="score-number">${score}%</div>
                <p class="score-text">${correctCount} out of ${totalQuestions} correct</p>
            </div>
            <p class="score-status">${passed ? '✓ Passed! Great work!' : '✗ Keep practicing. You can do better!'}</p>
            <p class="score-note">Your score has been saved to your progress dashboard.</p>
        `;

        // Insert after the last quiz card
        const lastCard = document.querySelector('.quiz-card:last-of-type');
        if (lastCard) {
            lastCard.parentElement.insertBefore(scoreCard, lastCard.nextSibling);
        }

        // Save score and mark completed together (atomic operation)
        if (window.isUserLoggedIn && window.isUserLoggedIn() && window.ProgressTracker) {
            const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;
            const practicePath = window.normalizePath 
                ? window.normalizePath(window.location.pathname)
                : window.location.pathname;
            const itemPath = window.getCurrentPath ? window.getCurrentPath() : window.location.pathname;

            // Execute both operations in sequence with error handling
            Promise.all([
                window.ProgressTracker.savePracticeScore(site, practicePath, score)
                    .then(success => {
                        if (success) {
                            window.logEvent('Practice score saved', { score, practicePath });
                        } else {
                            window.logEvent('Failed to save practice score', { score, practicePath });
                        }
                        return success;
                    })
                    .catch(error => {
                        window.logEvent('Error saving practice score', { error });
                        return false;
                    }),
                window.ProgressTracker.markCompleted(site, itemPath, 'practice')
                    .then(success => {
                        if (success) {
                            window.logEvent('Practice marked completed', { itemPath });
                        } else {
                            window.logEvent('Failed to mark practice completed', { itemPath });
                        }
                        return success;
                    })
                    .catch(error => {
                        window.logEvent('Error marking practice completed', { error });
                        return false;
                    })
            ]).catch(error => {
                console.error('Error in score save operations:', error);
            });
        }

        // Scroll to score card
        scoreCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        return { score, correctCount, totalQuestions };
    }

    function createSubmitButton() {
        if (document.getElementById('quiz-submit-btn')) return; // Prevent duplicate buttons

        const section = document.createElement('section');
        section.style.marginTop = '2rem';
        section.style.display = 'flex';
        section.style.flexDirection = 'column';
        section.style.alignItems = 'center';
        
        const button = document.createElement('button');
        button.className = 'quiz-submit-btn-custom';
        button.textContent = 'Submit and see score';
        button.id = 'quiz-submit-btn';

        const lastScoreDisplay = document.createElement('p');
        lastScoreDisplay.id = 'quiz-last-score-display';
        lastScoreDisplay.style.textAlign = 'center';
        lastScoreDisplay.style.marginTop = '1rem';
        lastScoreDisplay.style.fontWeight = 'bold';
        lastScoreDisplay.style.display = 'none';
        section.appendChild(button);
        section.appendChild(lastScoreDisplay);

        // Fetch and show last score
        if (window.isUserLoggedIn && window.isUserLoggedIn() && window.ProgressTracker) {
            const site = window.getCurrentSite ? window.getCurrentSite() : window.location.hostname;
            const practicePath = window.normalizePath 
                ? window.normalizePath(window.location.pathname)
                : window.location.pathname;

            window.ProgressTracker.getPracticeScore(site, practicePath).then(lastScore => {
                if (lastScore !== null) {
                    lastScoreDisplay.textContent = `Your Previous Score: ${lastScore}%`;
                    lastScoreDisplay.style.display = 'block';
                    button.textContent = 'Reattempt & Submit Again';
                }
            }).catch(e => console.error('Error fetching previous score', e));
        }

        button.addEventListener('click', () => {
            if (!window.isUserLoggedIn || !window.isUserLoggedIn()) {
                alert('Please log in to save your score.');
                return;
            }

            if (quizState.answeredCards.size === 0) {
                alert('Please answer at least one question before submitting.');
                return;
            }

            // Disable submit button
            button.disabled = true;
            button.textContent = 'Submitting...';

            // Show score after a brief delay, then re-enable button
            setTimeout(() => {
                const { score } = showScoreCard();
                button.textContent = 'Reattempt & Submit Again';
                button.disabled = false;  // Re-enable for viewing score again
                
                // Update local display immediately
                lastScoreDisplay.textContent = `Your Previous Score: ${score}%`;
                lastScoreDisplay.style.display = 'block';
            }, 500);
        });

        // Insert before the footer section or at the end of the container
        const footer = document.querySelector('.notes-watermark');
        if (footer) {
            footer.parentElement.insertBefore(section, footer);
        } else {
            const container = document.querySelector('.notes-container') || document.body;
            container.appendChild(section);
        }
    }

    function initializeScoreTracking() {
        quizState.totalQuestions = document.querySelectorAll('.quiz-card').length;

        // Track answers when quiz buttons are clicked
        document.querySelectorAll('.quiz-card').forEach((card, index) => {
            const button = card.querySelector('.quiz-btn:not(.discuss-ai-btn)');
            if (button && !button.dataset.scoreTrackingInitialized) {
                button.dataset.scoreTrackingInitialized = 'true';
                // Wrap with score tracking
                button.addEventListener('click', () => {
                    // Get answer state
                    const selected = getSelectedAnswers(card);
                    const correct = getCorrectAnswers(card);
                    const isCorrect = arraysMatch(selected, correct);
                    
                    // Track which cards have been answered
                    quizState.answeredCards.add(index);
                    
                    // Track correctness for score calculation
                    if (isCorrect) {
                        quizState.correctAnswers.add(index);
                    } else {
                        quizState.correctAnswers.delete(index);
                    }
                });
            }
        });

        // Create submit button
        createSubmitButton();
    }

    return {
        init: function() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeScoreTracking);
            } else {
                initializeScoreTracking();
            }
        },

        getState: function() {
            return { ...quizState };
        },

        getScore: function() {
            return calculateAndSaveScore();
        },

        showScore: function() {
            showScoreCard();
        }
    };
})();

// Auto-initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.QuizScoreHandler.init();
    });
} else {
    window.QuizScoreHandler.init();
}

window.logEvent('Quiz score handler loaded');
