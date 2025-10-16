// Configuration file for webhook URLs and app settings
const CONFIG = {
    // n8n webhook URLs - Replace these with your actual webhook endpoints
    WEBHOOKS: {
        START_ANALYSIS: 'https://ethum.app.n8n.cloud/webhook/245fb954-b409-42c3-95a5-9400a00ebead',
        // If you have a separate return webhook, add it here
        // RETURN_DATA: 'https://example.com/webhook/return'
    },
    
    // App settings
    SETTINGS: {
        // How long to wait for analysis completion (in milliseconds)
        ANALYSIS_TIMEOUT: 300000, // 5 minutes
        
        // Local storage key for persisting data
        STORAGE_KEY: 'ethum_analysis_data',
        
        // Chart colors
        CHART_COLORS: {
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#22c55e',
            warning: '#fbbf24',
            danger: '#ef4444',
            info: '#3b82f6'
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}