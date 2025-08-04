// Focus Shield Settings Page Logic
class FocusShieldSettings {
    constructor() {
        this.defaultSettings = {
            blockedSites: [
                'facebook.com', 'twitter.com', 'youtube.com', 'reddit.com',
                'instagram.com', 'tiktok.com', 'netflix.com', 'twitch.tv'
            ],
            defaultSessionDuration: 25,
            breakDuration: 5,
            emergencyBreakDelay: 10,
            enableNotifications: true,
            enableSounds: false,
            enableMotivationalQuotes: true,
            strictMode: false,
            blockSubdomains: true,
            showFocusReminder: true,
            enableSchedule: false,
            scheduleWeekdays: false,
            weekdayStart: '09:00',
            weekdayEnd: '17:00',
            scheduleWeekends: false,
            weekendStart: '10:00',
            weekendEnd: '16:00'
        };

        this.presetSites = {
            social: [
                'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
                'snapchat.com', 'tiktok.com', 'pinterest.com', 'tumblr.com'
            ],
            entertainment: [
                'youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com',
                'disney.com', 'primevideo.com', 'spotify.com', 'soundcloud.com'
            ],
            news: [
                'cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com',
                'theguardian.com', 'washingtonpost.com', 'foxnews.com', 'npr.org'
            ],
            shopping: [
                'amazon.com', 'ebay.com', 'aliexpress.com', 'etsy.com',
                'walmart.com', 'target.com', 'bestbuy.com', 'alibaba.com'
            ]
        };

        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.renderBlockedSites();
        this.loadStatistics();
        this.updateScheduleVisibility();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'blockedSites', 'settings', 'todayStats', 'allTimeStats'
            ]);

            // Merge with defaults
            this.settings = { ...this.defaultSettings, ...(result.settings || {}) };
            this.blockedSites = result.blockedSites || this.defaultSettings.blockedSites;
            this.todayStats = result.todayStats || {};
            this.allTimeStats = result.allTimeStats || {};

            this.applySettingsToUI();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showToast('Error loading settings', 'error');
        }
    }

    applySettingsToUI() {
        // Session settings
        document.getElementById('defaultDuration').value = this.settings.defaultSessionDuration;
        document.getElementById('breakDuration').value = this.settings.breakDuration;
        document.getElementById('emergencyDelay').value = this.settings.emergencyBreakDelay;

        // Notification settings
        document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
        document.getElementById('enableSounds').checked = this.settings.enableSounds;
        document.getElementById('enableQuotes').checked = this.settings.enableMotivationalQuotes;

        // Advanced settings
        document.getElementById('strictMode').checked = this.settings.strictMode;
        document.getElementById('blockSubdomains').checked = this.settings.blockSubdomains;
        document.getElementById('showReminder').checked = this.settings.showFocusReminder;

        // Schedule settings
        document.getElementById('enableSchedule').checked = this.settings.enableSchedule;
        document.getElementById('scheduleWeekdays').checked = this.settings.scheduleWeekdays;
        document.getElementById('weekdayStart').value = this.settings.weekdayStart;
        document.getElementById('weekdayEnd').value = this.settings.weekdayEnd;
        document.getElementById('scheduleWeekends').checked = this.settings.scheduleWeekends;
        document.getElementById('weekendStart').value = this.settings.weekendStart;
        document.getElementById('weekendEnd').value = this.settings.weekendEnd;
    }

    setupEventListeners() {
        // Schedule toggle
        document.getElementById('enableSchedule').addEventListener('change', (e) => {
            this.updateScheduleVisibility();
        });

        // Enter key for adding sites
        document.getElementById('newSiteInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addSite();
            }
        });

        // Auto-save on changes
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.autoSave();
            });
        });
    }

    updateScheduleVisibility() {
        const scheduleSettings = document.getElementById('scheduleSettings');
        const enableSchedule = document.getElementById('enableSchedule').checked;
        scheduleSettings.style.display = enableSchedule ? 'block' : 'none';
    }

    renderBlockedSites() {
        const container = document.getElementById('blockedSitesList');
        container.innerHTML = '';

        if (this.blockedSites.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No blocked sites yet. Add some above!</p>';
            return;
        }

        this.blockedSites.forEach((site, index) => {
            const siteElement = document.createElement('div');
            siteElement.className = 'site-item';
            siteElement.innerHTML = `
                <span class="site-url">${site}</span>
                <div class="site-actions">
                    <button onclick="settings.editSite(${index})" class="btn btn-small btn-secondary">✏️ Edit</button>
                    <button onclick="settings.removeSite(${index})" class="btn btn-small btn-danger">🗑️ Remove</button>
                </div>
            `;
            container.appendChild(siteElement);
        });
    }

    addSite() {
        const input = document.getElementById('newSiteInput');
        const site = input.value.trim().toLowerCase();

        if (!site) {
            this.showToast('Please enter a website URL', 'error');
            return;
        }

        // Clean up the URL
        const cleanSite = site
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '');

        if (!this.isValidDomain(cleanSite)) {
            this.showToast('Please enter a valid domain name', 'error');
            return;
        }

        if (this.blockedSites.includes(cleanSite)) {
            this.showToast('This site is already blocked', 'error');
            return;
        }

        this.blockedSites.push(cleanSite);
        input.value = '';
        this.renderBlockedSites();
        this.autoSave();
        this.showToast(`Added ${cleanSite} to blocked sites`);
    }

    removeSite(index) {
        const site = this.blockedSites[index];
        if (confirm(`Remove ${site} from blocked sites?`)) {
            this.blockedSites.splice(index, 1);
            this.renderBlockedSites();
            this.autoSave();
            this.showToast(`Removed ${site} from blocked sites`);
        }
    }

    editSite(index) {
        const currentSite = this.blockedSites[index];
        const newSite = prompt('Edit website:', currentSite);
        
        if (newSite && newSite.trim() !== currentSite) {
            const cleanSite = newSite.trim().toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/.*$/, '');

            if (this.isValidDomain(cleanSite)) {
                this.blockedSites[index] = cleanSite;
                this.renderBlockedSites();
                this.autoSave();
                this.showToast(`Updated site to ${cleanSite}`);
            } else {
                this.showToast('Invalid domain name', 'error');
            }
        }
    }

    addPresetSites(category) {
        const sites = this.presetSites[category];
        let addedCount = 0;

        sites.forEach(site => {
            if (!this.blockedSites.includes(site)) {
                this.blockedSites.push(site);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            this.renderBlockedSites();
            this.autoSave();
            this.showToast(`Added ${addedCount} ${category} sites`);
        } else {
            this.showToast(`All ${category} sites are already blocked`);
        }
    }

    isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
        return domainRegex.test(domain) && domain.includes('.');
    }

    async loadStatistics() {
        const container = document.getElementById('statsGrid');
        
        // Get all-time stats
        const result = await chrome.storage.local.get(['allTimeStats', 'todayStats']);
        const allTime = result.allTimeStats || {};
        const today = result.todayStats || {};

        const stats = [
            {
                label: 'Total Focus Time',
                value: this.formatTime(allTime.totalFocusTime || 0),
                icon: '⏱️'
            },
            {
                label: 'Sessions Completed',
                value: allTime.totalSessions || 0,
                icon: '🎯'
            },
            {
                label: 'Sites Blocked',
                value: allTime.totalBlocked || 0,
                icon: '🚫'
            },
            {
                label: 'Today\'s Focus',
                value: this.formatTime(today.focusTime || 0),
                icon: '📅'
            },
            {
                label: 'Current Streak',
                value: `${allTime.currentStreak || 0} days`,
                icon: '🔥'
            },
            {
                label: 'Best Streak',
                value: `${allTime.bestStreak || 0} days`,
                icon: '🏆'
            }
        ];

        container.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <span class="stat-number">${stat.value}</span>
                <div class="stat-label">${stat.icon} ${stat.label}</div>
            </div>
        `).join('');
    }

    formatTime(milliseconds) {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    async autoSave() {
        // Collect all settings from UI
        const newSettings = {
            defaultSessionDuration: parseInt(document.getElementById('defaultDuration').value),
            breakDuration: parseInt(document.getElementById('breakDuration').value),
            emergencyBreakDelay: parseInt(document.getElementById('emergencyDelay').value),
            enableNotifications: document.getElementById('enableNotifications').checked,
            enableSounds: document.getElementById('enableSounds').checked,
            enableMotivationalQuotes: document.getElementById('enableQuotes').checked,
            strictMode: document.getElementById('strictMode').checked,
            blockSubdomains: document.getElementById('blockSubdomains').checked,
            showFocusReminder: document.getElementById('showReminder').checked,
            enableSchedule: document.getElementById('enableSchedule').checked,
            scheduleWeekdays: document.getElementById('scheduleWeekdays').checked,
            weekdayStart: document.getElementById('weekdayStart').value,
            weekdayEnd: document.getElementById('weekdayEnd').value,
            scheduleWeekends: document.getElementById('scheduleWeekends').checked,
            weekendStart: document.getElementById('weekendStart').value,
            weekendEnd: document.getElementById('weekendEnd').value
        };

        try {
            await chrome.storage.local.set({
                blockedSites: this.blockedSites,
                settings: newSettings
            });

            this.settings = newSettings;
        } catch (error) {
            console.error('Error auto-saving:', error);
        }
    }

    async saveSettings() {
        try {
            await this.autoSave();
            
            // Notify background script of settings change
            chrome.runtime.sendMessage({
                action: 'settingsUpdated',
                settings: this.settings,
                blockedSites: this.blockedSites
            });

            this.showToast('Settings saved successfully! 🎉');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Error saving settings', 'error');
        }
    }

    async resetToDefaults() {
        if (confirm('Reset all settings to defaults? This cannot be undone.')) {
            this.settings = { ...this.defaultSettings };
            this.blockedSites = [...this.defaultSettings.blockedSites];
            
            this.applySettingsToUI();
            this.renderBlockedSites();
            
            await this.saveSettings();
            this.showToast('Settings reset to defaults');
        }
    }

    async resetStats() {
        if (confirm('Reset all statistics? This cannot be undone.')) {
            await chrome.storage.local.set({
                todayStats: {
                    focusTime: 0,
                    blockedCount: 0,
                    sessionCount: 0,
                    emergencyBreaks: 0,
                    date: new Date().toDateString()
                },
                allTimeStats: {
                    totalFocusTime: 0,
                    totalSessions: 0,
                    totalBlocked: 0,
                    currentStreak: 0,
                    bestStreak: 0
                }
            });

            this.loadStatistics();
            this.showToast('Statistics reset successfully');
        }
    }

    exportSettings() {
        const exportData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            settings: this.settings,
            blockedSites: this.blockedSites
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focus-shield-settings-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Settings exported successfully! 📤');
    }

    async importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            if (!importData.settings || !importData.blockedSites) {
                throw new Error('Invalid settings file format');
            }

            if (confirm('Import these settings? This will overwrite your current configuration.')) {
                this.settings = { ...this.defaultSettings, ...importData.settings };
                this.blockedSites = importData.blockedSites;

                this.applySettingsToUI();
                this.renderBlockedSites();
                
                await this.saveSettings();
                this.showToast('Settings imported successfully! 📥');
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Error importing settings file', 'error');
        }

        // Clear the file input
        event.target.value = '';
    }

    async exportStats() {
        const result = await chrome.storage.local.get(['todayStats', 'allTimeStats']);
        
        const exportData = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            todayStats: result.todayStats || {},
            allTimeStats: result.allTimeStats || {}
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focus-shield-stats-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Statistics exported successfully! 📊');
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Global functions for onclick handlers
let settings;

function addSite() {
    settings.addSite();
}

function addPresetSites(category) {
    settings.addPresetSites(category);
}

function saveSettings() {
    settings.saveSettings();
}

function resetToDefaults() {
    settings.resetToDefaults();
}

function resetStats() {
    settings.resetStats();
}

function exportSettings() {
    settings.exportSettings();
}

function importSettings(event) {
    settings.importSettings(event);
}

function exportStats() {
    settings.exportStats();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    settings = new FocusShieldSettings();
});