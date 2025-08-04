// Focus Shield Background Service Worker
class FocusShieldBackground {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.restoreState();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener(() => {
            this.initializeExtension();
        });

        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep the message channel open for async responses
        });

        // Handle alarms
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // Handle tab updates to check for blocked sites
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'loading' && tab.url) {
                this.checkAndBlockSite(tab.url, tabId);
            }
        });

        // Handle tab activation
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (tab.url) {
                this.checkAndBlockSite(tab.url, activeInfo.tabId);
            }
        });
    }

    async initializeExtension() {
        const defaultSettings = {
            blockedSites: [
                'facebook.com', 'twitter.com', 'youtube.com', 'reddit.com',
                'instagram.com', 'tiktok.com', 'netflix.com', 'twitch.tv',
                'linkedin.com', 'snapchat.com', 'pinterest.com', 'tumblr.com'
            ],
            defaultSessionDuration: 25,
            isActive: false,
            currentSession: null,
            settings: {
                enableMotivationalQuotes: true,
                enableSoundNotifications: true,
                strictMode: false,
                emergencyBreakDelay: 10
            },
            todayStats: {
                focusTime: 0,
                blockedCount: 0,
                sessionCount: 0,
                emergencyBreaks: 0,
                date: new Date().toDateString()
            }
        };

        // Only set defaults if they don't exist
        const existing = await chrome.storage.local.get(Object.keys(defaultSettings));
        const toSet = {};
        
        for (const [key, value] of Object.entries(defaultSettings)) {
            if (!(key in existing)) {
                toSet[key] = value;
            }
        }

        if (Object.keys(toSet).length > 0) {
            await chrome.storage.local.set(toSet);
        }

        console.log('Focus Shield initialized');
    }

    async restoreState() {
        const { isActive, currentSession } = await chrome.storage.local.get(['isActive', 'currentSession']);
        
        if (isActive && currentSession) {
            const now = Date.now();
            if (now < currentSession.endTime) {
                // Session is still active, restore alarm
                chrome.alarms.create('focusSessionEnd', {
                    when: currentSession.endTime
                });
                console.log('Restored active focus session');
            } else {
                // Session has expired, clean up
                await this.endSession();
            }
        }
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startBlocking':
                await this.startBlocking(message.sites);
                sendResponse({ success: true });
                break;

            case 'stopBlocking':
                await this.stopBlocking();
                sendResponse({ success: true });
                break;

            case 'checkIfBlocked':
                const isBlocked = await this.isUrlBlocked(message.url);
                sendResponse({ blocked: isBlocked });
                break;

            case 'incrementBlockedCount':
                await this.incrementBlockedCount();
                sendResponse({ success: true });
                break;

            case 'getMotivationalQuote':
                const quote = this.getRandomMotivationalQuote();
                sendResponse({ quote });
                break;

            case 'openNewTab':
                chrome.tabs.create({ url: 'chrome://newtab/' });
                sendResponse({ success: true });
                break;

            case 'settingsUpdated':
                // Handle settings updates from settings page
                console.log('Settings updated');
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
        }
    }

    async handleAlarm(alarm) {
        if (alarm.name === 'focusSessionEnd') {
            await this.endSession();
            this.showSessionCompleteNotification();
        }
    }

    async startBlocking(sites) {
        const rules = sites.map((site, index) => ({
            id: index + 1,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    url: chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site)
                }
            },
            condition: {
                urlFilter: `*://*.${site}/*`,
                resourceTypes: ['main_frame']
            }
        }));

        // Update declarative net request rules
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: Array.from({ length: 100 }, (_, i) => i + 1), // Remove existing rules
            addRules: rules
        });

        console.log(`Started blocking ${sites.length} sites`);
    }

    async stopBlocking() {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: Array.from({ length: 100 }, (_, i) => i + 1) // Remove all rules
        });

        console.log('Stopped blocking sites');
    }

    async checkAndBlockSite(url, tabId) {
        const { isActive } = await chrome.storage.local.get(['isActive']);
        if (!isActive) return;

        const isBlocked = await this.isUrlBlocked(url);
        if (isBlocked) {
            await this.incrementBlockedCount();
        }
    }

    async isUrlBlocked(url) {
        try {
            const { blockedSites, isActive } = await chrome.storage.local.get(['blockedSites', 'isActive']);
            
            if (!isActive || !blockedSites) return false;

            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace('www.', '');

            return blockedSites.some(site => 
                hostname === site || hostname.endsWith('.' + site)
            );
        } catch (error) {
            console.error('Error checking if URL is blocked:', error);
            return false;
        }
    }

    async endSession() {
        await chrome.storage.local.set({
            isActive: false,
            currentSession: null
        });

        await this.stopBlocking();

        // Notify popup to update
        chrome.runtime.sendMessage({ action: 'sessionEnded' }).catch(() => {
            // Popup might not be open, ignore error
        });

        console.log('Focus session ended');
    }

    async incrementBlockedCount() {
        const { todayStats } = await chrome.storage.local.get(['todayStats']);
        const today = new Date().toDateString();

        if (todayStats && todayStats.date === today) {
            todayStats.blockedCount++;
            await chrome.storage.local.set({ todayStats });
        }
    }

    showSessionCompleteNotification() {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Focus Shield - Session Complete! 🎉',
            message: 'Great job! You completed your focus session. Time for a well-deserved break.'
        });
    }

    getRandomMotivationalQuote() {
        const quotes = [
            "The way to get started is to quit talking and begin doing. - Walt Disney",
            "Don't let yesterday take up too much of today. - Will Rogers",
            "If you are working on something that you really care about, you don't have to be pushed. The vision pulls you. - Steve Jobs",
            "Believe you can and you're halfway there. - Theodore Roosevelt",
            "The only impossible journey is the one you never begin. - Tony Robbins",
            "Focus on being productive instead of busy. - Tim Ferriss",
            "You are never too old to set another goal or to dream a new dream. - C.S. Lewis",
            "The future depends on what you do today. - Mahatma Gandhi",
            "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
            "The only way to do great work is to love what you do. - Steve Jobs"
        ];

        return quotes[Math.floor(Math.random() * quotes.length)];
    }
}

// Initialize the background service
new FocusShieldBackground();