// Focus Shield Content Script
// Runs on all web pages to provide additional blocking and user feedback

(function() {
    'use strict';

    class FocusShieldContent {
        constructor() {
            this.isBlocked = false;
            this.isActive = false;
            this.blockOverlay = null;
            this.focusReminder = null;
            this.init();
        }

        async init() {
            // Check if current site should be blocked
            await this.checkBlockStatus();
            
            // Listen for focus session changes
            this.setupMessageListener();
            
            // Monitor for dynamic content changes (SPA navigation)
            this.setupNavigationListener();
            
            // Add subtle focus reminder for non-blocked sites
            this.addFocusReminder();
        }

        async checkBlockStatus() {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'checkIfBlocked',
                    url: window.location.href
                });

                if (response && response.blocked) {
                    this.isBlocked = true;
                    this.showBlockOverlay();
                } else {
                    this.isBlocked = false;
                    this.removeBlockOverlay();
                }
            } catch (error) {
                console.log('Focus Shield: Unable to check block status');
            }
        }

        setupMessageListener() {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                switch (message.action) {
                    case 'sessionStarted':
                        this.isActive = true;
                        this.showFocusReminder();
                        break;
                    case 'sessionEnded':
                        this.isActive = false;
                        this.hideFocusReminder();
                        this.removeBlockOverlay();
                        break;
                    case 'checkBlock':
                        this.checkBlockStatus();
                        break;
                }
                sendResponse({ success: true });
            });
        }

        setupNavigationListener() {
            // Handle single-page application navigation
            let lastUrl = location.href;
            
            new MutationObserver(() => {
                const url = location.href;
                if (url !== lastUrl) {
                    lastUrl = url;
                    // URL changed, recheck block status
                    setTimeout(() => this.checkBlockStatus(), 100);
                }
            }).observe(document, { subtree: true, childList: true });

            // Also listen for popstate events (back/forward navigation)
            window.addEventListener('popstate', () => {
                setTimeout(() => this.checkBlockStatus(), 100);
            });
        }

        showBlockOverlay() {
            if (this.blockOverlay) return;

            this.blockOverlay = document.createElement('div');
            this.blockOverlay.id = 'focus-shield-overlay';
            this.blockOverlay.innerHTML = `
                <div class="focus-shield-modal">
                    <div class="focus-shield-icon">🛡️</div>
                    <h2>Focus Shield Active</h2>
                    <p>This site is blocked during your focus session</p>
                    <div class="focus-shield-timer" id="focus-timer">Loading...</div>
                    <div class="focus-shield-buttons">
                        <button id="focus-go-back" class="focus-btn focus-btn-primary">← Go Back</button>
                        <button id="focus-new-tab" class="focus-btn">🏠 New Tab</button>
                    </div>
                    <div class="focus-shield-quote" id="focus-quote">
                        "The way to get started is to quit talking and begin doing." - Walt Disney
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                #focus-shield-overlay {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                    z-index: 2147483647 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    color: white !important;
                }

                .focus-shield-modal {
                    background: rgba(255, 255, 255, 0.1) !important;
                    backdrop-filter: blur(20px) !important;
                    border-radius: 20px !important;
                    padding: 40px !important;
                    text-align: center !important;
                    max-width: 500px !important;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
                    animation: focusSlideIn 0.5s ease-out !important;
                }

                @keyframes focusSlideIn {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .focus-shield-icon {
                    font-size: 60px !important;
                    margin-bottom: 20px !important;
                    animation: focusPulse 2s infinite !important;
                }

                @keyframes focusPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                .focus-shield-modal h2 {
                    font-size: 28px !important;
                    margin-bottom: 10px !important;
                    font-weight: bold !important;
                    color: white !important;
                }

                .focus-shield-modal p {
                    font-size: 16px !important;
                    margin-bottom: 20px !important;
                    opacity: 0.9 !important;
                    color: white !important;
                }

                .focus-shield-timer {
                    font-size: 24px !important;
                    font-weight: bold !important;
                    font-family: 'Courier New', monospace !important;
                    background: rgba(255, 255, 255, 0.2) !important;
                    padding: 15px 30px !important;
                    border-radius: 50px !important;
                    margin: 20px 0 !important;
                    color: white !important;
                }

                .focus-shield-buttons {
                    margin: 30px 0 !important;
                }

                .focus-btn {
                    background: rgba(255, 255, 255, 0.2) !important;
                    border: 2px solid rgba(255, 255, 255, 0.3) !important;
                    color: white !important;
                    padding: 12px 25px !important;
                    margin: 0 10px !important;
                    border-radius: 25px !important;
                    cursor: pointer !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    transition: all 0.3s ease !important;
                    font-family: inherit !important;
                }

                .focus-btn:hover {
                    background: rgba(255, 255, 255, 0.3) !important;
                    transform: translateY(-2px) !important;
                }

                .focus-btn-primary {
                    background: rgba(76, 175, 80, 0.3) !important;
                    border-color: rgba(76, 175, 80, 0.5) !important;
                }

                .focus-shield-quote {
                    font-style: italic !important;
                    font-size: 14px !important;
                    opacity: 0.8 !important;
                    margin-top: 30px !important;
                    padding: 20px !important;
                    background: rgba(255, 255, 255, 0.1) !important;
                    border-radius: 10px !important;
                    border-left: 4px solid rgba(255, 255, 255, 0.5) !important;
                    color: white !important;
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(this.blockOverlay);

            // Set up button handlers
            document.getElementById('focus-go-back').addEventListener('click', () => {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = 'chrome://newtab/';
                }
            });

            document.getElementById('focus-new-tab').addEventListener('click', () => {
                try {
                    chrome.runtime.sendMessage({ action: 'openNewTab' });
                    // Also redirect current page
                    setTimeout(() => {
                        window.location.href = 'chrome://newtab/';
                    }, 100);
                } catch (error) {
                    window.location.href = 'chrome://newtab/';
                }
            });

            // Update timer
            this.updateOverlayTimer();
            this.timerInterval = setInterval(() => this.updateOverlayTimer(), 1000);

            // Load quote
            this.loadQuoteForOverlay();
        }

        removeBlockOverlay() {
            if (this.blockOverlay) {
                this.blockOverlay.remove();
                this.blockOverlay = null;
            }
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        }

        async updateOverlayTimer() {
            if (!this.blockOverlay) return;

            try {
                const result = await chrome.storage.local.get(['currentSession']);
                const session = result.currentSession;

                if (session) {
                    const remaining = session.endTime - Date.now();
                    if (remaining > 0) {
                        const minutes = Math.floor(remaining / (1000 * 60));
                        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
                        
                        const timerElement = document.getElementById('focus-timer');
                        if (timerElement) {
                            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
                        }
                    }
                }
            } catch (error) {
                console.log('Focus Shield: Error updating timer');
            }
        }

        async loadQuoteForOverlay() {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'getMotivationalQuote' });
                if (response && response.quote) {
                    const quoteElement = document.getElementById('focus-quote');
                    if (quoteElement) {
                        const [quote, author] = response.quote.split(' - ');
                        quoteElement.textContent = `"${quote}" ${author ? `- ${author}` : ''}`;
                    }
                }
            } catch (error) {
                console.log('Focus Shield: Error loading quote');
            }
        }

        addFocusReminder() {
            // Only show on productivity sites or when session is active
            if (this.isBlocked || this.focusReminder) return;

            this.focusReminder = document.createElement('div');
            this.focusReminder.id = 'focus-shield-reminder';
            this.focusReminder.innerHTML = `
                <div class="focus-reminder-content">
                    <span class="focus-reminder-icon">🛡️</span>
                    <span class="focus-reminder-text">Focus Shield</span>
                    <span class="focus-reminder-status" id="focus-status">Ready</span>
                </div>
            `;

            const reminderStyle = document.createElement('style');
            reminderStyle.textContent = `
                #focus-shield-reminder {
                    position: fixed !important;
                    top: 20px !important;
                    right: 20px !important;
                    background: rgba(102, 126, 234, 0.9) !important;
                    color: white !important;
                    padding: 10px 15px !important;
                    border-radius: 25px !important;
                    font-size: 12px !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    z-index: 1000000 !important;
                    backdrop-filter: blur(10px) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                    transition: all 0.3s ease !important;
                    cursor: pointer !important;
                    opacity: 0.7 !important;
                }

                #focus-shield-reminder:hover {
                    opacity: 1 !important;
                    transform: translateY(-2px) !important;
                }

                .focus-reminder-content {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }

                .focus-reminder-icon {
                    font-size: 14px !important;
                }

                .focus-reminder-text {
                    font-weight: 500 !important;
                }

                .focus-reminder-status {
                    background: rgba(255, 255, 255, 0.2) !important;
                    padding: 2px 8px !important;
                    border-radius: 10px !important;
                    font-size: 10px !important;
                }
            `;

            document.head.appendChild(reminderStyle);
            document.body.appendChild(this.focusReminder);

            // Click handler to open popup
            this.focusReminder.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'openPopup' });
            });

            // Update status
            this.updateReminderStatus();
        }

        async updateReminderStatus() {
            if (!this.focusReminder) return;

            try {
                const result = await chrome.storage.local.get(['isActive', 'currentSession']);
                const statusElement = document.getElementById('focus-status');
                
                if (statusElement) {
                    if (result.isActive && result.currentSession) {
                        const remaining = result.currentSession.endTime - Date.now();
                        const minutes = Math.floor(remaining / (1000 * 60));
                        statusElement.textContent = `${minutes}m left`;
                        statusElement.style.background = 'rgba(76, 175, 80, 0.3)';
                    } else {
                        statusElement.textContent = 'Ready';
                        statusElement.style.background = 'rgba(255, 255, 255, 0.2)';
                    }
                }
            } catch (error) {
                console.log('Focus Shield: Error updating reminder status');
            }
        }

        showFocusReminder() {
            if (this.focusReminder) {
                this.focusReminder.style.display = 'block';
                this.updateReminderStatus();
            }
        }

        hideFocusReminder() {
            if (this.focusReminder) {
                this.updateReminderStatus();
            }
        }

        // Detect if user is trying to access blocked content via JavaScript
        interceptAjaxRequests() {
            const originalXHR = window.XMLHttpRequest;
            const originalFetch = window.fetch;

            // Intercept XMLHttpRequest
            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const originalOpen = xhr.open;
                
                xhr.open = function(method, url) {
                    // Check if URL should be blocked
                    chrome.runtime.sendMessage({
                        action: 'checkIfBlocked',
                        url: url
                    }).then(response => {
                        if (response && response.blocked) {
                            console.log('Focus Shield: Blocked AJAX request to', url);
                            throw new Error('Focus Shield: Request blocked during focus session');
                        }
                    });
                    
                    return originalOpen.apply(this, arguments);
                };
                
                return xhr;
            };

            // Intercept fetch API
            window.fetch = function() {
                const url = arguments[0];
                
                return chrome.runtime.sendMessage({
                    action: 'checkIfBlocked',
                    url: url
                }).then(response => {
                    if (response && response.blocked) {
                        console.log('Focus Shield: Blocked fetch request to', url);
                        throw new Error('Focus Shield: Request blocked during focus session');
                    }
                    return originalFetch.apply(this, arguments);
                });
            };
        }
    }

    // Initialize Focus Shield content script
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new FocusShieldContent();
        });
    } else {
        new FocusShieldContent();
    }

})();