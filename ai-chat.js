(function () {
    const WORKER_URL = 'https://quiz-ai-tutor.raushanguptaicloud.workers.dev/';
    const SUPPORTED_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|.*\.raushansync\.com)(:\d+)?$/;
    const MODE_QUIZ_ASSISTANT = 'quiz-assistant';
    const MODE_STUDENT_SUPPORT = 'student-support';
    const DEFAULT_CHAT_CONFIG = {
        mode: MODE_QUIZ_ASSISTANT,
        title: 'Ask RaushanSYNC AI Tutor',
        subtitle: '',
        assistantGreeting: [
            'I can help you understand this question step-by-step.',
            'Ask me what confused you, or ask for a simpler explanation and an example.'
        ].join(' '),
        inputLabel: 'Ask a follow-up',
        inputPlaceholder: 'Ask why this answer is correct, request a hint, or ask for an example...',
        showContext: true
    };

    const state = {
        context: {},
        history: [],
        isSending: false,
        config: { ...DEFAULT_CHAT_CONFIG }
    };

    const ui = {};
    let isBound = false;

    function getText(value, fallback) {
        if (typeof value !== 'string') return fallback;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : fallback;
    }

    function sanitizeContext(context) {
        const ctx = context && typeof context === 'object' ? context : {};
        return {
            practiceTitle: getText(ctx.practiceTitle || ctx.quizTitle, 'Practice Discussion'),
            questionText: getText(ctx.questionText, 'Question unavailable'),
            userAnswer: getText(ctx.userAnswer, 'No answer selected yet'),
            correctAnswer: getText(ctx.correctAnswer, 'Correct answer unavailable'),
            explanation: getText(ctx.explanation, 'No explanation available'),
            pageUrl: getText(ctx.pageUrl, window.location.href)
        };
    }

    function normalizeMode(mode) {
        const normalized = getText(mode, '').toLowerCase();
        if (normalized === MODE_STUDENT_SUPPORT) {
            return MODE_STUDENT_SUPPORT;
        }

        return MODE_QUIZ_ASSISTANT;
    }

    function sanitizeConfig(config) {
        const safeConfig = config && typeof config === 'object' ? config : {};
        return {
            mode: normalizeMode(safeConfig.mode),
            title: getText(safeConfig.title, DEFAULT_CHAT_CONFIG.title),
            subtitle: getText(safeConfig.subtitle, DEFAULT_CHAT_CONFIG.subtitle),
            assistantGreeting: getText(safeConfig.assistantGreeting, DEFAULT_CHAT_CONFIG.assistantGreeting),
            inputLabel: getText(safeConfig.inputLabel, DEFAULT_CHAT_CONFIG.inputLabel),
            inputPlaceholder: getText(safeConfig.inputPlaceholder, DEFAULT_CHAT_CONFIG.inputPlaceholder),
            showContext: typeof safeConfig.showContext === 'boolean'
                ? safeConfig.showContext
                : DEFAULT_CHAT_CONFIG.showContext
        };
    }

    function getCurrentOrigin() {
        return typeof window.location.origin === 'string' && window.location.origin.length
            ? window.location.origin
            : 'null';
    }

    function isSupportedOrigin(origin) {
        // Allow localhost (dev), null (from file://), and any *.raushansync.com domain (production)
        return origin === 'null' || SUPPORTED_ORIGIN_PATTERN.test(origin);
    }

    function describeOrigin(origin) {
        if (origin === 'null') {
            return 'a direct file preview';
        }
        return origin;
    }

    async function getWorkerAccessToken() {
        try {
            if (typeof window.getCurrentSession === 'function') {
                const session = await window.getCurrentSession();
                if (session && typeof session.access_token === 'string' && session.access_token.trim()) {
                    return session.access_token.trim();
                }
            }

            if (
                window.supabaseClient &&
                window.supabaseClient.auth &&
                typeof window.supabaseClient.auth.getSession === 'function'
            ) {
                const sessionResult = await window.supabaseClient.auth.getSession();
                const accessToken = sessionResult?.data?.session?.access_token;
                if (typeof accessToken === 'string' && accessToken.trim()) {
                    return accessToken.trim();
                }
            }
        } catch (error) {
            return '';
        }

        return '';
    }

    function scrollToBottom() {
        if (!ui.history) return;
        ui.history.scrollTop = ui.history.scrollHeight;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
            if (char === '&') return '&amp;';
            if (char === '<') return '&lt;';
            if (char === '>') return '&gt;';
            if (char === '"') return '&quot;';
            return '&#39;';
        });
    }

    function formatInlineMarkdown(text) {
        const escaped = escapeHtml(text);
        const codeChunks = [];

        let formatted = escaped.replace(/`([^`]+)`/g, function (_, code) {
            const token = '@@CODE_' + codeChunks.length + '@@';
            codeChunks.push('<code>' + code + '</code>');
            return token;
        });

        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
        formatted = formatted.replace(/~~(.+?)~~/g, '<del>$1</del>');

        codeChunks.forEach(function (codeChunk, index) {
            const token = '@@CODE_' + index + '@@';
            formatted = formatted.split(token).join(codeChunk);
        });

        return formatted;
    }

    function renderAssistantMarkdown(text) {
        const normalized = getText(text, '').replace(/\r\n?/g, '\n');
        if (!normalized) return '';

        const lines = normalized.split('\n');
        const blocks = [];

        let paragraphLines = [];
        let listType = null;
        let listItems = [];

        function flushParagraph() {
            if (!paragraphLines.length) return;
            const content = paragraphLines
                .map(function (line) {
                    return formatInlineMarkdown(line.trim());
                })
                .join('<br>');
            blocks.push('<p>' + content + '</p>');
            paragraphLines = [];
        }

        function flushList() {
            if (!listItems.length || !listType) return;
            const items = listItems
                .map(function (item) {
                    return '<li>' + item + '</li>';
                })
                .join('');
            blocks.push('<' + listType + '>' + items + '</' + listType + '>');
            listType = null;
            listItems = [];
        }

        lines.forEach(function (line) {
            const trimmed = line.trim();

            if (!trimmed) {
                flushParagraph();
                flushList();
                return;
            }

            const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
            const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);

            if (unorderedMatch || orderedMatch) {
                flushParagraph();

                const nextListType = unorderedMatch ? 'ul' : 'ol';
                const itemText = (unorderedMatch || orderedMatch)[1].trim();

                if (listType && listType !== nextListType) {
                    flushList();
                }

                listType = nextListType;
                listItems.push(formatInlineMarkdown(itemText));
                return;
            }

            if (listType) {
                flushList();
            }

            paragraphLines.push(line);
        });

        flushParagraph();
        flushList();

        if (!blocks.length) {
            return '<p>' + formatInlineMarkdown(normalized) + '</p>';
        }

        return blocks.join('');
    }

    function addMessage(role, text, extraClass, skipScroll = false) {
        if (!ui.history) return null;

        const message = document.createElement('div');
        const roleClass = role === 'user' ? 'ai-user' : 'ai-assistant';
        message.className = 'ai-chat-message ' + roleClass + (extraClass ? ' ' + extraClass : '');

        if (extraClass === 'ai-typing') {
            message.setAttribute('aria-label', 'Thinking');
            message.innerHTML = [
                '<span class="ai-chat-thinking-label">Thinking</span>',
                '<span class="ai-chat-thinking-dots" aria-hidden="true">',
                '<span>.</span>',
                '<span>.</span>',
                '<span>.</span>',
                '</span>'
            ].join('');
        } else if (role === 'assistant') {
            message.innerHTML = renderAssistantMarkdown(text);
        } else {
            message.textContent = text;
        }

        ui.history.appendChild(message);
        
        if (!skipScroll) {
            scrollToBottom();
        }
        
        return message;
    }

    function setSending(isSending) {
        state.isSending = isSending;
        if (ui.input) ui.input.disabled = isSending;
        if (ui.send) ui.send.disabled = isSending;
    }

    function openModal() {
        if (!ui.modal) return;
        ui.modal.hidden = false;
        ui.modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('ai-chat-open');
        if (ui.input && window.matchMedia("(pointer: fine)").matches) {
            ui.input.focus();
        }
    }

    function closeModal() {
        if (!ui.modal) return;
        ui.modal.hidden = true;
        ui.modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('ai-chat-open');
    }

    function renderContext() {
        if (!ui.context) return;

        if (!state.config.showContext) {
            ui.context.hidden = true;
            ui.context.textContent = '';
            return;
        }

        ui.context.hidden = false;

        const contextLine = [
            'Topic: ' + state.context.practiceTitle,
            'Question: ' + state.context.questionText,
            'Your answer: ' + state.context.userAnswer,
            'Correct answer: ' + state.context.correctAnswer
        ].join(' | ');

        ui.context.textContent = contextLine;
    }

    function applyConfigToUI() {
        if (ui.title) {
            ui.title.textContent = state.config.title;
        }

        if (ui.subtitle) {
            if (state.config.subtitle) {
                ui.subtitle.hidden = false;
                ui.subtitle.textContent = state.config.subtitle;
            } else {
                ui.subtitle.hidden = true;
                ui.subtitle.textContent = '';
            }
        }

        if (ui.inputLabel) {
            ui.inputLabel.textContent = state.config.inputLabel;
        }

        if (ui.input) {
            ui.input.placeholder = state.config.inputPlaceholder;
        }
    }

    function addTutorGreeting() {
        const text = state.config.assistantGreeting || DEFAULT_CHAT_CONFIG.assistantGreeting;
        addMessage('assistant', text);
    }

    async function sendToWorker(userMessage) {
        const currentOrigin = getCurrentOrigin();
        if (!isSupportedOrigin(currentOrigin)) {
            throw new Error(
                'AI chat is blocked on ' + describeOrigin(currentOrigin) +
                '. Open this page from maths.raushansync.com or a localhost/127.0.0.1 preview server.'
            );
        }

        const accessToken = await getWorkerAccessToken();
        if (!accessToken) {
            throw new Error('Please sign in to use the AI assistant.');
        }

        const payload = {
            message: userMessage,
            context: state.context,
            history: state.history.slice(-10),
            mode: state.config.mode
        };

        let response;
        try {
            response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + accessToken
                },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            throw new Error(
                'Unable to reach the AI service. If you are previewing locally, use maths.raushansync.com or a localhost/127.0.0.1 server.'
            );
        }

        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            const detail = typeof data.detail === 'string' ? data.detail.trim() : '';
            const upstreamStatus = Number.isInteger(data.upstreamStatus) ? data.upstreamStatus : response.status;
            const model = typeof data.model === 'string' ? data.model.trim() : '';
            const provider = typeof data.provider === 'string' ? data.provider.trim() : 'AI service';
            const message = detail || data.error || 'AI service request failed. Please try again.';
            const prefix = upstreamStatus ? provider + ' ' + upstreamStatus : provider;
            const modelLabel = model ? ' [' + model + ']' : '';

            console.error('AI worker request failed', {
                responseStatus: response.status,
                upstreamStatus: upstreamStatus,
                provider: provider,
                model: model,
                detail: detail,
                error: data.error || null
            });

            throw new Error(prefix + modelLabel + ': ' + message);
        }

        const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
        if (!reply) {
            throw new Error('AI returned an empty response. Please ask again.');
        }

        return reply;
    }

    async function onSubmit(event) {
        event.preventDefault();
        if (state.isSending || !ui.input) return;

        const userMessage = ui.input.value.trim();
        if (!userMessage) return;

        ui.input.value = '';
        addMessage('user', userMessage);
        const typingMessage = addMessage('assistant', 'AI is typing...', 'ai-typing');

        state.history.push({ role: 'user', content: userMessage });
        setSending(true);

        try {
            const reply = await sendToWorker(userMessage);
            if (typingMessage) typingMessage.remove();
            addMessage('assistant', reply, null, true);
            state.history.push({ role: 'assistant', content: reply });
        } catch (error) {
            if (typingMessage) typingMessage.remove();
            const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
            addMessage('assistant', message);
        } finally {
            setSending(false);
            if (ui.input && window.matchMedia("(pointer: fine)").matches) {
                ui.input.focus();
            }
        }
    }

    function bindUI() {
        if (isBound) return;

        ui.modal = document.getElementById('ai-chat-modal');
        ui.context = document.getElementById('ai-chat-context');
        ui.history = document.getElementById('ai-chat-history');
        ui.form = document.getElementById('ai-chat-form');
        ui.input = document.getElementById('ai-chat-input');
        ui.send = document.getElementById('ai-chat-send');
        ui.close = document.getElementById('ai-chat-close');
        ui.overlay = document.querySelector('[data-ai-chat-close]');
        ui.title = document.getElementById('ai-chat-title');
        ui.subtitle = document.getElementById('ai-chat-subtitle');
        ui.inputLabel = document.querySelector('.ai-chat-label');

        if (!ui.modal || !ui.form || !ui.input) return;

        ui.form.addEventListener('submit', onSubmit);
        if (ui.close) ui.close.addEventListener('click', closeModal);
        if (ui.overlay) ui.overlay.addEventListener('click', closeModal);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && ui.modal && !ui.modal.hidden) {
                closeModal();
            }
        });

        isBound = true;
    }

    window.initAIChat = function initAIChat(context, config) {
        bindUI();
        if (!ui.modal || !ui.history) return;

        state.context = sanitizeContext(context);
        state.config = sanitizeConfig(config);
        state.history = [];

        ui.history.innerHTML = '';
        applyConfigToUI();
        renderContext();
        addTutorGreeting();
        openModal();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindUI);
    } else {
        bindUI();
    }
})();
