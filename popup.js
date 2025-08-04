// Focus Shield Popup Logic
class FocusShieldPopup {
    constructor() {
        this.isActive = false;
        this.currentSession = null;
        this.selectedMinutes = 25; // Default session time
        this.init();
    }

    async init() {
        await this.loadState();
        this.setupEventListeners();
        this.setupTimeSelector();
        this.updateUI();
        this.loadStats();
    }

    async loadState() {
        const result = await chrome.storage.local.get([
            'isActive', 
            'currentSession', 
            'todayStats',
            'blockedSites',
            'settings'
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
        
        // Load default session duration from settings
        const settings = result.settings || {};
        this.selectedMinutes = settings.defaultSessionDuration || 25;
    }

    setupEventListeners() {
        document.getElementById('startFocusBtn').addEventListener('click', () => {
            this.startFocusSession();
        });

        document.getElementById('emergencyBreakBtn').addEventListener('click', () => {
            this.handleEmergencyBreak();
        });

        document.getElementById('settingsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openSettings();
        });
    }

    setupTimeSelector() {
        // Handle time button clicks
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                // Set selected minutes
                this.selectedMinutes = parseInt(btn.dataset.minutes);
                // Clear custom input
                document.getElementById('customMinutes').value = '';
                // Update button text
                this.updateStartButtonText();
            });
        });

        // Handle custom input
        const customInput = document.getElementById('customMinutes');
        customInput.addEventListener('input', () => {
            const value = parseInt(customInput.value);
            if (value && value > 0 && value <= 180) {
                // Remove active class from preset buttons
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                // Set selected minutes
                this.selectedMinutes = value;
                this.updateStartButtonText();
            }
        });

        // Initialize button text
        this.updateStartButtonText();
    }

    updateStartButtonText() {
        const startBtn = document.getElementById('startFocusBtn');
        startBtn.textContent = `🎯 Start Focus Session (${this.selectedMinutes} min)`;
    }

    async startFocusSession() {
        const minutes = this.selectedMinutes;
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
            const btn = document.getElementById('emergencyBreakBtn');
            btn.textContent = '⏳ Breaking in 10s...';
            btn.disabled = true;

            let countdown = 10;
            const countdownInterval = setInterval(() => {
                countdown--;
                btn.textContent = `⏳ Breaking in ${countdown}s...`;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    this.endSession(true);
                    this.incrementEmergencyBreaks();
                    btn.textContent = '🚨 Emergency Break';
                    btn.disabled = false;
                }
            }, 1000);
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
        const emergencyBtn = document.getElementById('emergencyBreakBtn');

        if (this.isActive && this.currentSession) {
            const remaining = this.currentSession.endTime - Date.now();
            const minutes = Math.floor(remaining / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            statusIndicator.textContent = '🔒';
            statusIndicator.classList.add('active');
            statusText.textContent = 'Focus Mode Active';
            statusSubtitle.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;

            document.getElementById('timeSelector').style.display = 'none';
            startBtn.style.display = 'none';
            emergencyBtn.style.display = 'block';

            // Update timer every second
            setTimeout(() => this.updateUI(), 1000);
        } else {
            statusIndicator.textContent = '⏰';
            statusIndicator.classList.remove('active');
            statusText.textContent = 'Ready to Focus';
            statusSubtitle.textContent = 'Click to start a focus session';

            document.getElementById('timeSelector').style.display = 'block';
            startBtn.style.display = 'block';
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