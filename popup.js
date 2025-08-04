// Focus Shield Popup Logic
class FocusShieldPopup {
    constructor() {
        this.isActive = false;
        this.currentSession = null;
        this.init();
    }

    async init() {
        await this.loadState();
        this.setupEventListeners();
        this.updateUI();
        this.loadStats();
    }

    async loadState() {
        const result = await chrome.storage.local.get([
            'isActive', 
            'currentSession', 
            'todayStats',
            'blockedSites'
        ]);
        
        this.isActive = result.isActive || false;
        this.currentSession = result.currentSession || null;
        this.todayStats = result.todayStats || {
            focusTime: 0,
            blockedCount: 0,
            sessionCount: 0,
            date: new Date().toDateString()
        };
        this.blockedSites = result.blockedSites || [
            'facebook.com', 'twitter.com', 'youtube.com', 'reddit.com',
            'instagram.com', 'tiktok.com', 'netflix.com', 'twitch.tv'
        ];
    }

    setupEventListeners() {
        document.getElementById('startFocusBtn').addEventListener('click', () => {
            this.startFocusSession(25);
        });

        document.getElementById('quickBlockBtn').addEventListener('click', () => {
            this.startFocusSession(5);
        });

        document.getElementById('emergencyBreakBtn').addEventListener('click', () => {
            this.handleEmergencyBreak();
        });

        document.getElementById('settingsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openSettings();
        });
    }

    async startFocusSession(minutes) {
        const session = {
            startTime: Date.now(),
            duration: minutes * 60 * 1000,
            endTime: Date.now() + (minutes * 60 * 1000)
        };

        this.currentSession = session;
        this.isActive = true;

        await chrome.storage.local.set({
            isActive: true,
            currentSession: session
        });

        // Set alarm for session end
        await chrome.alarms.create('focusSessionEnd', {
            when: session.endTime
        });

        // Notify background script to start blocking
        chrome.runtime.sendMessage({
            action: 'startBlocking',
            sites: this.blockedSites
        });

        this.updateUI();
        this.incrementSessionCount();
    }

    async handleEmergencyBreak() {
        // Add friction - require confirmation and wait
        const confirmed = confirm(
            "Emergency break will end your focus session.\n\n" +
            "Are you sure you want to break your focus? This will be recorded in your stats."
        );

        if (confirmed) {
            // Add a 10-second delay to create friction
            document.getElementById('emergencyBreakBtn').textContent = '⏳ Breaking in 10s...';
            document.getElementById('emergencyBreakBtn').disabled = true;

            setTimeout(async () => {
                await this.endSession(true);
                this.incrementEmergencyBreaks();
            }, 10000);
        }
    }

    async endSession(isEmergencyBreak = false) {
        if (this.currentSession) {
            const sessionDuration = Date.now() - this.currentSession.startTime;
            await this.addFocusTime(sessionDuration);
        }

        this.isActive = false;
        this.currentSession = null;

        await chrome.storage.local.set({
            isActive: false,
            currentSession: null
        });

        // Clear alarms
        chrome.alarms.clear('focusSessionEnd');

        // Notify background script to stop blocking
        chrome.runtime.sendMessage({
            action: 'stopBlocking'
        });

        this.updateUI();
    }

    updateUI() {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const statusSubtitle = document.getElementById('statusSubtitle');
        const startBtn = document.getElementById('startFocusBtn');
        const quickBtn = document.getElementById('quickBlockBtn');
        const emergencyBtn = document.getElementById('emergencyBreakBtn');

        if (this.isActive && this.currentSession) {
            const remaining = this.currentSession.endTime - Date.now();
            const minutes = Math.floor(remaining / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            statusIndicator.textContent = '🔒';
            statusIndicator.classList.add('active');
            statusText.textContent = 'Focus Mode Active';
            statusSubtitle.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;

            startBtn.style.display = 'none';
            quickBtn.style.display = 'none';
            emergencyBtn.style.display = 'block';

            // Update timer every second
            setTimeout(() => this.updateUI(), 1000);
        } else {
            statusIndicator.textContent = '⏰';
            statusIndicator.classList.remove('active');
            statusText.textContent = 'Ready to Focus';
            statusSubtitle.textContent = 'Click to start a focus session';

            startBtn.style.display = 'block';
            quickBtn.style.display = 'block';
            emergencyBtn.style.display = 'none';
        }
    }

    loadStats() {
        // Check if we need to reset daily stats
        const today = new Date().toDateString();
        if (this.todayStats.date !== today) {
            this.todayStats = {
                focusTime: 0,
                blockedCount: 0,
                sessionCount: 0,
                date: today
            };
            chrome.storage.local.set({ todayStats: this.todayStats });
        }

        // Display stats
        const hours = Math.floor(this.todayStats.focusTime / (1000 * 60 * 60));
        const minutes = Math.floor((this.todayStats.focusTime % (1000 * 60 * 60)) / (1000 * 60));
        
        document.getElementById('todayFocusTime').textContent = `${hours}h ${minutes}m`;
        document.getElementById('todayBlockedCount').textContent = this.todayStats.blockedCount;
        document.getElementById('todaySessionCount').textContent = this.todayStats.sessionCount;

        // Display blocked sites
        this.displayBlockedSites();
    }

    displayBlockedSites() {
        const container = document.getElementById('blockedSitesPreview');
        container.innerHTML = '';
        
        this.blockedSites.slice(0, 6).forEach(site => {
            const siteElement = document.createElement('div');
            siteElement.className = 'site-item';
            siteElement.textContent = site;
            container.appendChild(siteElement);
        });

        if (this.blockedSites.length > 6) {
            const moreElement = document.createElement('div');
            moreElement.className = 'site-item';
            moreElement.textContent = `+${this.blockedSites.length - 6} more`;
            container.appendChild(moreElement);
        }
    }

    async addFocusTime(duration) {
        this.todayStats.focusTime += duration;
        await chrome.storage.local.set({ todayStats: this.todayStats });
        this.loadStats();
    }

    async incrementSessionCount() {
        this.todayStats.sessionCount++;
        await chrome.storage.local.set({ todayStats: this.todayStats });
        this.loadStats();
    }

    async incrementBlockedCount() {
        this.todayStats.blockedCount++;
        await chrome.storage.local.set({ todayStats: this.todayStats });
        this.loadStats();
    }

    async incrementEmergencyBreaks() {
        this.todayStats.emergencyBreaks = (this.todayStats.emergencyBreaks || 0) + 1;
        await chrome.storage.local.set({ todayStats: this.todayStats });
    }

    openSettings() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('settings.html')
        });
        window.close();
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FocusShieldPopup();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sessionEnded') {
        // Refresh popup state
        location.reload();
    }
});