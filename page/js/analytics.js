let userGrowthChart = null;

window.initAnalytics = function () {
    let currentPeriod = '30d';

    // Initial Load
    setupEventListeners();
    // Set the initial active button state on load
    updateActiveButton(document.querySelector(`#analytics-period-filter button[data-period='${currentPeriod}']`));
    fetchAnalyticsData(currentPeriod);

    function setupEventListeners() {
        const filterContainer = document.getElementById('analytics-period-filter');
        if (filterContainer) {
            filterContainer.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (button) {
                    const newPeriod = button.dataset.period;
                    if (newPeriod !== currentPeriod) {
                        currentPeriod = newPeriod;
                        fetchAnalyticsData(currentPeriod);
                        updateActiveButton(button);
                    }
                }
            });
        }
    }

    function updateActiveButton(activeButton) {
        const filterContainer = document.getElementById('analytics-period-filter');
        filterContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('bg-gray-700', 'text-white');
            btn.classList.add('text-gray-400', 'hover:text-white');
        });
        activeButton.classList.add('bg-gray-700', 'text-white');
        activeButton.classList.remove('text-gray-400', 'hover:text-white');
    }

    async function fetchAnalyticsData(period) {
        try {
            const res = await fetch(`/api/analytics?period=${period}`);
            if (!res.ok) throw new Error('Failed to fetch analytics data');
            const data = await res.json();

            updateKpis(data, period);
            renderUserGrowthChart(data.userGrowth, period);
            renderTopCommandsList(data.topCommands);

        } catch (error) {
            console.error('Error fetching analytics:', error);
        }
    }
    
    function updateKpis(data, period) {
        const kpis = data.kpis;
        if (!kpis) return;

        document.getElementById('kpi-total-users-value').textContent = formatNumber(kpis.totalUsers.value);
        document.getElementById('kpi-total-users-change').innerHTML = createChangeHtml(kpis.totalUsers.change, period);

        document.getElementById('kpi-active-users-value').textContent = formatNumber(kpis.activeUsers.value);
        document.getElementById('kpi-active-users-change').innerHTML = createChangeHtml(kpis.activeUsers.change, period);

        document.getElementById('kpi-message-volume-value').textContent = formatNumber(kpis.messageVolume.value);
        document.getElementById('kpi-message-volume-change').innerHTML = createChangeHtml(kpis.messageVolume.change, period);

        document.getElementById('kpi-avg-commands-value').textContent = formatNumber(kpis.avgCommandsPerUser.value);
        document.getElementById('kpi-avg-commands-change').innerHTML = createChangeHtml(kpis.avgCommandsPerUser.change, period);
    }

    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        if (Number.isInteger(num)) return num.toLocaleString();
        return num.toFixed(1);
    }

    function createChangeHtml(change, period) {
        if (change === null || change === undefined) return '';

        const isPositive = change >= 0;
        const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
        const arrowSvg = isPositive
            ? '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clip-rule="evenodd"></path></svg>'
            : '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.78 5.22a.75.75 0 00-1.06 0l-7.22 7.22v-5.69a.75.75 0 00-1.5 0v7.5a.75.75 0 00.75.75h7.5a.75.75 0 000-1.5h-5.69l7.22-7.22a.75.75 0 000-1.06z" clip-rule="evenodd"></path></svg>';
        
        const periodText = period === '7d' ? 'vs last week' : 'vs last month';

        return `
            <div class="flex items-center ${colorClass}">
                ${arrowSvg}
                <span>${Math.abs(change).toFixed(1)}%</span>
            </div>
            <span class="text-gray-500 ml-1">${periodText}</span>
        `;
    }

    function renderUserGrowthChart(growthData, period) {
        const container = document.getElementById('user-growth-chart');
        if (!container || !growthData) return;

        const chartTitle = document.getElementById('user-growth-chart-title');
        if (chartTitle) chartTitle.textContent = `New Users Over Time`;

        const options = {
            chart: {
                type: 'area',
                height: '100%',
                zoom: { enabled: false },
                toolbar: { show: false },
                background: 'transparent'
            },
            theme: {
                mode: 'dark'
            },
            series: [{
                name: 'New Users',
                data: growthData.map(d => d.count)
            }],
            xaxis: {
                categories: growthData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                labels: { style: { colors: '#9ca3af' } }
            },
            yaxis: {
                labels: {
                    style: { colors: '#9ca3af' },
                    formatter: (value) => { return parseInt(value); }
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.1,
                    stops: [0, 90, 100]
                }
            },
            colors: ['#6366f1'],
            grid: {
                show: true,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                yaxis: { lines: { show: false } },
                xaxis: { lines: { show: true } }
            },
            markers: {
                size: 5,
                colors: ['#1f2937'],
                strokeColors: '#6366f1',
                strokeWidth: 2,
                hover: { size: 7 }
            }
        };

        if (userGrowthChart) {
            userGrowthChart.destroy();
        }
        userGrowthChart = new ApexCharts(container, options);
        userGrowthChart.render();
    }

    function renderTopCommandsList(commandData) {
        const container = document.getElementById('top-commands-list');
        if (!container || !commandData) return;

        container.innerHTML = ''; // Clear previous list

        if (commandData.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No command data available.</p>';
            return;
        }

        commandData.forEach(cmd => {
            const itemHtml = `
                <div class="flex justify-between items-center">
                    <p class="font-mono text-white">/${cmd.command}</p>
                    <p class="font-bold text-white">${formatNumber(cmd.count)} uses</p>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', itemHtml);
        });
    }
};
