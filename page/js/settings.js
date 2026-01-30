window.initSettings = function () {
    const botUsernameEl = document.getElementById('bot-username');
    const botIdEl = document.getElementById('bot-id');
    const botFirstNameEl = document.getElementById('bot-first-name');
    const botIsBotEl = document.getElementById('bot-is-bot');
    const loadedCommandsListEl = document.getElementById('loaded-commands-list');
    const requiredChannelsListEl = document.getElementById('required-channels-list');
    const checkLatencyBtn = document.getElementById('check-latency-btn');
    const latencyDisplayEl = document.getElementById('latency-display');

    // Initial Load
    fetchSettingsData();
    setupEventListeners();

    function setupEventListeners() {
        if (checkLatencyBtn) {
            checkLatencyBtn.addEventListener('click', fetchLatency);
        }
    }

    async function fetchSettingsData() {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Failed to fetch settings data');
            const data = await res.json();

            updateBotInfo(data.botInfo);
            updateLoadedCommands(data.loadedCommands);
            updateRequiredChannels(data.requiredChannels);

        } catch (error) {
            console.error('Error fetching settings:', error);
            showToast('Error loading settings data', 'error');
        }
    }

    function updateBotInfo(botInfo) {
        if (botUsernameEl) botUsernameEl.textContent = `@${botInfo.username || 'N/A'}`;
        if (botIdEl) botIdEl.textContent = botInfo.id || 'N/A';
        if (botFirstNameEl) botFirstNameEl.textContent = botInfo.firstName || 'N/A';
        if (botIsBotEl) botIsBotEl.textContent = botInfo.isBot ? 'Yes' : 'No';
    }

    function updateLoadedCommands(commands) {
        if (!loadedCommandsListEl) return;
        if (commands.length === 0) {
            loadedCommandsListEl.innerHTML = '<p class="text-gray-400">No commands loaded.</p>';
            return;
        }
        loadedCommandsListEl.innerHTML = commands.map(cmd => `
            <div class="glass p-4 rounded-lg border border-gray-700">
                <p class="font-medium text-white">/${cmd.name}</p>
                <p class="text-xs text-gray-400">${cmd.description}</p>
                <p class="text-xs text-gray-500 mt-1">Category: ${cmd.category}</p>
            </div>
        `).join('');
    }

    function updateRequiredChannels(channels) {
        if (!requiredChannelsListEl) return;
        if (channels.length === 0) {
            requiredChannelsListEl.innerHTML = '<p class="text-gray-400">No required channels configured.</p>';
            return;
        }
        requiredChannelsListEl.innerHTML = channels.map(channel => `
            <div class="glass p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                <div>
                    <p class="font-medium text-white">${channel.title}</p>
                    <p class="text-xs text-gray-400">ID: ${channel.id}</p>
                </div>
            </div>
        `).join('');
    }

    async function fetchLatency() {
        if (latencyDisplayEl) latencyDisplayEl.textContent = 'Latency: Checking...';
        if (checkLatencyBtn) checkLatencyBtn.disabled = true;

        try {
            const res = await fetch('/api/settings/ping');
            if (!res.ok) throw new Error('Failed to fetch latency');
            const data = await res.json();
            if (latencyDisplayEl) latencyDisplayEl.textContent = `Latency: ${data.latency}`;
            showToast('Latency check complete', 'success');
        } catch (error) {
            console.error('Error checking latency:', error);
            if (latencyDisplayEl) latencyDisplayEl.textContent = 'Latency: Error';
            showToast('Failed to check latency', 'error');
        } finally {
            if (checkLatencyBtn) checkLatencyBtn.disabled = false;
        }
    }
};
