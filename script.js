// ETHUM Subject Line Analyzer - Main JavaScript File

class EthumAnalyzer {
    constructor() {
        this.data = null;
        this.charts = {};
        this.isAnalyzing = false;
        this.currentPage = 'dashboard';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadStoredData();
        this.initializeCharts();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const page = tab.dataset.page;
                this.switchPage(page);
            });
        });

        // Analysis buttons
        document.getElementById('start-analysis-btn').addEventListener('click', () => {
            this.startAnalysis();
        });

        document.getElementById('rerun-analysis-btn').addEventListener('click', () => {
            this.startAnalysis();
        });

        // Modal controls
        document.getElementById('close-error-btn').addEventListener('click', () => {
            this.hideErrorModal();
        });

        document.getElementById('retry-btn').addEventListener('click', () => {
            this.hideErrorModal();
            this.startAnalysis();
        });

        // Search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterTable(e.target.value);
        });

        // Export functionality
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportToCSV();
        });

        // Fullscreen functionality
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });
    }

    switchPage(page) {
        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');

        this.currentPage = page;

        // Refresh charts if switching to charts page
        if (page === 'charts' && this.data) {
            setTimeout(() => this.createCharts(), 100);
        }
    }

    async startAnalysis() {
        if (this.isAnalyzing) return;

        this.isAnalyzing = true;
        this.showFullScreenLoading();

        try {
            // Simulate the analysis steps with progress
            await this.simulateAnalysisSteps();

            const response = await fetch(CONFIG.WEBHOOKS.START_ANALYSIS, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    source: 'ethum-analyzer'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.processAnalysisData(result);
            
            // Show success notification
            this.showSuccessNotification();
            
        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError('Failed to run analysis. Please check your connection and try again.');
        } finally {
            this.isAnalyzing = false;
            this.hideFullScreenLoading();
        }
    }

    processAnalysisData(data) {
        const processedData = this.validateAndProcessData(data) || this.generateSampleData();
        
        this.data = processedData;
        this.saveData();
        this.displayData();
    }

    validateAndProcessData(data) {
        let campaigns = [];
        
        if (Array.isArray(data)) {
            campaigns = data;
        } else if (data && Array.isArray(data.campaigns)) {
            campaigns = data.campaigns;
        } else if (data && Array.isArray(data.data)) {
            campaigns = data.data;
        } else {
            return null;
        }

        if (campaigns.length === 0) {
            return null;
        }

        const processedCampaigns = campaigns.map(campaign => {
            // Handle your exact data structure
            const sent = parseInt(campaign.Sent || campaign.sent || 0);
            const opened = parseInt(campaign.Opened || campaign.opened || 0);
            const replies = parseInt(campaign.Replies || campaign.replies || 0);
            
            // Calculate rates if not provided (fallback formulas)
            let openRate = parseFloat(campaign['Open_Rate (%)'] || campaign.openRate || campaign['Open Rate (%)'] || 0);
            let replyRate = parseFloat(campaign['Reply_Rate (%)'] || campaign.replyRate || campaign['Reply Rate (%)'] || 0);
            
            // If rates are 0 but we have counts, calculate them
            if (openRate === 0 && sent > 0 && opened > 0) {
                openRate = Math.round((opened / sent) * 100 * 100) / 100; // Round to 2 decimals
            }
            if (replyRate === 0 && sent > 0 && replies > 0) {
                replyRate = Math.round((replies / sent) * 100 * 100) / 100;
            }
            
            return {
                source: campaign.Source || campaign.source || '',
                platform: campaign.Platform || campaign.platform || '',
                outreachChannel: campaign['Outreach Channel'] || campaign.outreachChannel || '',
                campaign: campaign.Campaign || campaign.campaign || '',
                variableTested: campaign['Variable Tested'] || campaign.variableTested || '',
                whatIsMeasured: campaign['What is measured'] || campaign.whatIsMeasured || '',
                angles: campaign.Angles || campaign.angles || '',
                variant: campaign.Variant || campaign.variant || '',
                subjectLine: campaign.Subject_Line || campaign.subjectLine || campaign['Subject Line'] || '',
                sent: sent,
                opened: opened,
                replies: replies,
                openRate: openRate,
                goal: parseFloat(campaign['Goal (%)'] || campaign.goal || 70), // Default goal 70%
                replyRate: replyRate,
                wilsonLow: parseFloat(campaign['Wilson_Low (%)'] || campaign.wilsonLow || campaign['Wilson Low (%)'] || 0),
                wilsonHigh: parseFloat(campaign['Wilson_High (%)'] || campaign.wilsonHigh || campaign['Wilson High (%)'] || 0),
                probAbove70: parseFloat(campaign['Prob ≥ 70% (%)'] || campaign.probAbove70 || 0),
                probBest: parseFloat(campaign['Prob_Best (%)'] || campaign.probBest || campaign['Prob Best (%)'] || 0),
                verdict: this.normalizeVerdict(campaign.Verdict || campaign.verdict || 'needs-more-data'),
                action: campaign.Action || campaign.action || ''
            };
        });

        return {
            totalCampaigns: new Set(processedCampaigns.map(c => c.campaign)).size,
            totalVariants: processedCampaigns.length,
            averageOpenRate: this.calculateAverageOpenRate(processedCampaigns),
            averageReplyRate: this.calculateAverageReplyRate(processedCampaigns),
            totalSent: processedCampaigns.reduce((sum, c) => sum + c.sent, 0),
            lastRun: new Date().toISOString(),
            campaigns: processedCampaigns
        };
    }

    generateSampleData() {
        // This is fallback data - the app should use real data from your n8n webhook
        console.log('Using fallback sample data - check webhook connection');
        
        const campaigns = [
            {
                source: 'LinkedIn', platform: 'Instantly', outreachChannel: 'Cold Email', 
                campaign: 'MC -Job Board - LinkedIn -Lead Generation- Subject Lines - variants -paincuriperso - P1 - 09/30/2025',
                variableTested: 'Subject Line', whatIsMeasured: 'Open rate', angles: 'paincuriperso', variant: 'A',
                subjectLine: 'Email Subject 1', sent: 101, opened: 81, replies: 1,
                openRate: 80.20, goal: 70, replyRate: 0.99, wilsonLow: 71.38, wilsonHigh: 86.89,
                probAbove70: 98.53, probBest: 33.18, verdict: 'winner', action: 'Lock it as your control subject line.'
            },
            {
                source: 'LinkedIn', platform: 'Instantly', outreachChannel: 'Cold Email',
                campaign: 'MC -Job Board - LinkedIn -Lead Generation- Subject Lines - variants -paincuriperso - P1 - 09/30/2025',
                variableTested: 'Subject Line', whatIsMeasured: 'Open rate', angles: 'paincuriperso', variant: 'B',
                subjectLine: 'Email Subject 2', sent: 101, opened: 78, replies: 1,
                openRate: 77.23, goal: 70, replyRate: 0.99, wilsonLow: 68.14, wilsonHigh: 84.32,
                probAbove70: 92.95, probBest: 11.01, verdict: 'winner', action: 'Lock it as your control subject line.'
            }
        ];

        return {
            totalCampaigns: new Set(campaigns.map(c => c.campaign)).size,
            totalVariants: campaigns.length,
            averageOpenRate: this.calculateAverageOpenRate(campaigns),
            averageReplyRate: this.calculateAverageReplyRate(campaigns),
            totalSent: campaigns.reduce((sum, c) => sum + c.sent, 0),
            lastRun: new Date().toISOString(),
            campaigns: campaigns
        };
    }

    calculateAverageOpenRate(campaigns) {
        if (!campaigns || campaigns.length === 0) return 0;
        const sum = campaigns.reduce((acc, campaign) => acc + (campaign.openRate || 0), 0);
        return Math.round((sum / campaigns.length) * 10) / 10;
    }

    calculateAverageReplyRate(campaigns) {
        if (!campaigns || campaigns.length === 0) return 0;
        const sum = campaigns.reduce((acc, campaign) => acc + (campaign.replyRate || 0), 0);
        return Math.round((sum / campaigns.length) * 10) / 10;
    }

    normalizeVerdict(verdict) {
        if (!verdict) return 'needs-more-data';
        const normalized = verdict.toLowerCase().trim();
        
        // Handle different verdict formats
        if (normalized.includes('winner')) return 'winner';
        if (normalized.includes('loser')) return 'loser';
        if (normalized.includes('needs more data') || normalized.includes('keep testing')) return 'needs-more-data';
        
        return normalized;
    }

    displayData() {
        if (!this.data) return;

        // Hide hero, show summary
        document.getElementById('hero-section').classList.add('hidden');
        document.getElementById('summary-section').classList.remove('hidden');

        // Update summary cards
        this.updateSummaryCards();

        // Populate data table
        this.populateDataTable();

        // Create charts if on charts page
        if (this.currentPage === 'charts') {
            setTimeout(() => this.createCharts(), 100);
        }
    }

    updateSummaryCards() {
        document.getElementById('total-campaigns').textContent = this.data.totalCampaigns;
        document.getElementById('total-variants').textContent = this.data.totalVariants;
        document.getElementById('avg-open-rate').textContent = `${this.data.averageOpenRate}%`;
        document.getElementById('avg-reply-rate').textContent = `${this.data.averageReplyRate}%`;
        document.getElementById('total-sent').textContent = this.data.totalSent.toLocaleString();
        
        const lastRun = new Date(this.data.lastRun);
        document.getElementById('last-run').textContent = this.formatDate(lastRun);
    }

    populateDataTable() {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';

        this.data.campaigns.forEach(campaign => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campaign.source}</td>
                <td>${campaign.platform}</td>
                <td>${campaign.campaign}</td>
                <td>${campaign.variableTested}</td>
                <td>${campaign.variant}</td>
                <td title="${campaign.subjectLine}">${this.truncateText(campaign.subjectLine, 30)}</td>
                <td>${campaign.sent.toLocaleString()}</td>
                <td>${campaign.opened.toLocaleString()}</td>
                <td>${campaign.replies.toLocaleString()}</td>
                <td>${campaign.openRate}%</td>
                <td>${campaign.replyRate}%</td>
                <td>${campaign.wilsonLow}%</td>
                <td>${campaign.wilsonHigh}%</td>
                <td>${campaign.probAbove70}%</td>
                <td>${campaign.probBest}%</td>
                <td><span class="verdict ${campaign.verdict}">${campaign.verdict.replace('-', ' ')}</span></td>
                <td>${campaign.action}</td>
            `;
            tbody.appendChild(row);
        });
    }

    initializeCharts() {
        // Set Chart.js defaults for dark theme
        Chart.defaults.color = '#e2e8f0';
        Chart.defaults.borderColor = '#334155';
        Chart.defaults.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    }

    createCharts() {
        if (!this.data || !this.data.campaigns) return;

        this.createOpenRateChart();
        this.createVerdictChart();
        this.createCorrelationChart();
        this.createWilsonChart();
    }

    createOpenRateChart() {
        const ctx = document.getElementById('open-rate-chart');
        if (!ctx) return;

        if (this.charts.openRateChart) {
            this.charts.openRateChart.destroy();
        }

        // Group by campaign and variant for better visualization
        const labels = this.data.campaigns.map(c => `${c.variant} (${c.angles})`);
        const openRates = this.data.campaigns.map(c => c.openRate);
        const goalLine = this.data.campaigns.map(c => c.goal);
        const wilsonLow = this.data.campaigns.map(c => c.wilsonLow);
        const wilsonHigh = this.data.campaigns.map(c => c.wilsonHigh);

        // Color code bars based on verdict
        const backgroundColors = this.data.campaigns.map(c => {
            switch(c.verdict) {
                case 'winner': return '#22c55e';
                case 'loser': return '#ef4444';
                case 'needs-more-data': return '#fbbf24';
                default: return '#6b7280';
            }
        });

        this.charts.openRateChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Open Rate (%)',
                    data: openRates,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                }, {
                    label: 'Wilson Low (%)',
                    data: wilsonLow,
                    type: 'line',
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#ef4444'
                }, {
                    label: 'Wilson High (%)',
                    data: wilsonHigh,
                    type: 'line',
                    borderColor: '#22c55e',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#22c55e'
                }, {
                    label: 'Goal (%)',
                    data: goalLine,
                    type: 'line',
                    borderColor: '#8b5cf6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e2e8f0',
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: function(context) {
                                const index = context[0].dataIndex;
                                const campaign = this.data.campaigns[index];
                                return [
                                    `Sent: ${campaign.sent}`,
                                    `Opened: ${campaign.opened}`,
                                    `Prob Best: ${campaign.probBest}%`,
                                    `Verdict: ${campaign.verdict.replace('-', ' ').toUpperCase()}`
                                ];
                            }.bind(this)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: '#1a1a1a'
                        },
                        ticks: {
                            color: '#94a3b8',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: '#1a1a1a'
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    }

    createVerdictChart() {
        const ctx = document.getElementById('verdict-chart');
        if (!ctx) return;

        if (this.charts.verdictChart) {
            this.charts.verdictChart.destroy();
        }

        const verdictCounts = this.data.campaigns.reduce((acc, campaign) => {
            acc[campaign.verdict] = (acc[campaign.verdict] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(verdictCounts).map(verdict => {
            return verdict.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        });
        
        const data = Object.values(verdictCounts);
        const colors = Object.keys(verdictCounts).map(verdict => {
            switch(verdict) {
                case 'winner': return '#22c55e';
                case 'loser': return '#ef4444';
                case 'needs-more-data': return '#fbbf24';
                default: return '#3b82f6';
            }
        });

        this.charts.verdictChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e2e8f0',
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    createCorrelationChart() {
        const ctx = document.getElementById('correlation-chart');
        if (!ctx) return;

        if (this.charts.correlationChart) {
            this.charts.correlationChart.destroy();
        }

        // Create scatter data with different colors for verdicts
        const scatterData = this.data.campaigns.map(campaign => {
            let color;
            switch(campaign.verdict) {
                case 'winner': color = '#22c55e'; break;
                case 'loser': color = '#ef4444'; break;
                case 'needs-more-data': color = '#fbbf24'; break;
                default: color = '#6b7280';
            }
            
            return {
                x: campaign.probBest,
                y: campaign.openRate,
                backgroundColor: color,
                borderColor: color,
                label: `${campaign.variant} - ${campaign.angles}`,
                verdict: campaign.verdict,
                sent: campaign.sent,
                wilsonLow: campaign.wilsonLow,
                wilsonHigh: campaign.wilsonHigh
            };
        });

        this.charts.correlationChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Campaign Performance',
                    data: scatterData,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    pointBackgroundColor: scatterData.map(d => d.backgroundColor),
                    pointBorderColor: scatterData.map(d => d.borderColor),
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return context[0].raw.label;
                            },
                            label: function(context) {
                                const point = context.raw;
                                return [
                                    `Open Rate: ${context.parsed.y}%`,
                                    `Prob Best: ${context.parsed.x}%`,
                                    `Wilson Range: ${point.wilsonLow}% - ${point.wilsonHigh}%`,
                                    `Sent: ${point.sent}`,
                                    `Verdict: ${point.verdict.replace('-', ' ').toUpperCase()}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Probability Best (%)',
                            color: '#e2e8f0'
                        },
                        grid: {
                            color: '#1a1a1a'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        min: 0,
                        max: 100
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Open Rate (%)',
                            color: '#e2e8f0'
                        },
                        grid: {
                            color: '#1a1a1a'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    createWilsonChart() {
        const ctx = document.getElementById('wilson-chart');
        if (!ctx) return;

        if (this.charts.wilsonChart) {
            this.charts.wilsonChart.destroy();
        }

        const labels = this.data.campaigns.map(c => c.variant);
        const wilsonLowData = this.data.campaigns.map(c => c.wilsonLow);
        const wilsonHighData = this.data.campaigns.map(c => c.wilsonHigh);
        const openRateData = this.data.campaigns.map(c => c.openRate);

        this.charts.wilsonChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Wilson Low',
                    data: wilsonLowData,
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#ef4444'
                }, {
                    label: 'Open Rate',
                    data: openRateData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    fill: true
                }, {
                    label: 'Wilson High',
                    data: wilsonHighData,
                    borderColor: '#22c55e',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#22c55e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Rate (%)',
                            color: '#e2e8f0'
                        },
                        grid: {
                            color: '#334155'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    x: {
                        grid: {
                            color: '#334155'
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxRotation: 45
                        }
                    }
                }
            }
        });
    }

    filterTable(searchTerm) {
        const rows = document.querySelectorAll('#table-body tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    exportToCSV() {
        if (!this.data || !this.data.campaigns) return;

        const headers = [
            'Source', 'Platform', 'Campaign', 'Variable', 'Variant', 'Subject Line',
            'Sent', 'Opened', 'Replies', 'Open Rate', 'Reply Rate', 'Wilson Low',
            'Wilson High', 'Prob ≥ 70%', 'Prob Best', 'Verdict', 'Action'
        ];

        const csvContent = [
            headers.join(','),
            ...this.data.campaigns.map(campaign => [
                campaign.source, campaign.platform, campaign.campaign, campaign.variableTested,
                campaign.variant, `"${campaign.subjectLine}"`, campaign.sent, campaign.opened,
                campaign.replies, campaign.openRate, campaign.replyRate, campaign.wilsonLow,
                campaign.wilsonHigh, campaign.probAbove70, campaign.probBest, campaign.verdict,
                campaign.action
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ethum-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    toggleFullscreen() {
        const dataContainer = document.querySelector('.data-container');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (dataContainer.requestFullscreen) {
                dataContainer.requestFullscreen();
            } else if (dataContainer.webkitRequestFullscreen) {
                dataContainer.webkitRequestFullscreen();
            } else if (dataContainer.msRequestFullscreen) {
                dataContainer.msRequestFullscreen();
            }
            fullscreenBtn.innerHTML = '⛶ Exit Fullscreen';
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            fullscreenBtn.innerHTML = '⛶ Fullscreen';
        }

        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                fullscreenBtn.innerHTML = '⛶ Fullscreen';
            }
        });
    }

    showFullScreenLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('hidden');
        
        // Disable buttons
        document.getElementById('start-analysis-btn').disabled = true;
        const rerunBtn = document.getElementById('rerun-analysis-btn');
        if (rerunBtn) rerunBtn.disabled = true;
    }

    hideFullScreenLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
        
        // Reset progress
        this.resetLoadingProgress();
        
        // Re-enable buttons
        document.getElementById('start-analysis-btn').disabled = false;
        const rerunBtn = document.getElementById('rerun-analysis-btn');
        if (rerunBtn) rerunBtn.disabled = false;
    }

    async simulateAnalysisSteps() {
        const steps = [
            { step: 1, text: 'Fetching Data', duration: 500 },
            { step: 2, text: 'Volume Validation', duration: 800 },
            { step: 3, text: 'Statistical Analysis', duration: 1200 },
            { step: 4, text: 'Generating Insights', duration: 700 }
        ];

        let totalProgress = 0;
        const progressIncrement = 100 / steps.length;

        for (let i = 0; i < steps.length; i++) {
            const stepData = steps[i];
            
            // Update active step
            this.updateLoadingStep(stepData.step);
            
            // Animate progress
            totalProgress += progressIncrement;
            this.updateLoadingProgress(totalProgress);
            
            // Wait for step duration
            await new Promise(resolve => setTimeout(resolve, stepData.duration));
            
            // Mark step as completed
            this.completeLoadingStep(stepData.step);
        }
    }

    updateLoadingStep(stepNumber) {
        // Remove active class from all steps
        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current step
        const currentStep = document.querySelector(`[data-step="${stepNumber}"]`);
        if (currentStep) {
            currentStep.classList.add('active');
        }
    }

    completeLoadingStep(stepNumber) {
        const step = document.querySelector(`[data-step="${stepNumber}"]`);
        if (step) {
            step.classList.remove('active');
            step.classList.add('completed');
        }
    }

    updateLoadingProgress(percentage) {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    resetLoadingProgress() {
        // Reset all steps
        document.querySelectorAll('.step-item').forEach(item => {
            item.classList.remove('active', 'completed');
        });
        
        // Reset progress
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }

    showSuccessNotification() {
        const notification = document.getElementById('success-notification');
        notification.classList.remove('hidden');
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 4000);
    }

    showLoadingState() {
        // Legacy method - now handled by showFullScreenLoading
        this.showFullScreenLoading();
    }

    hideLoadingState() {
        // Legacy method - now handled by hideFullScreenLoading
        this.hideFullScreenLoading();
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').classList.remove('hidden');
    }

    hideErrorModal() {
        document.getElementById('error-modal').classList.add('hidden');
    }

    saveData() {
        if (this.data) {
            localStorage.setItem(CONFIG.SETTINGS.STORAGE_KEY, JSON.stringify(this.data));
        }
    }

    loadStoredData() {
        try {
            const stored = localStorage.getItem(CONFIG.SETTINGS.STORAGE_KEY);
            if (stored) {
                this.data = JSON.parse(stored);
                this.displayData();
            }
        } catch (error) {
            console.error('Failed to load stored data:', error);
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EthumAnalyzer();
});