// Kalshi Basketball Trader - New Frontend
const API_BASE = 'http://localhost:5001/api';
let allMarkets = [];
let autoMonitorInterval = null;
let selectedMarket = null;
let selectedSide = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMarkets();
    loadBots();
    setupSearch();
    
    // Show balance if authenticated
    loadBalance();
});

// Load markets
async function loadMarkets() {
    try {
        const response = await fetch(`${API_BASE}/markets?status=open&limit=200`);
        const data = await response.json();
        
        if (data.error) {
            alert('Error loading markets: ' + data.error);
            return;
        }
        
        allMarkets = data;
        
        // Filter for basketball/sports markets
        const basketballMarkets = allMarkets.filter(m => {
            const ticker = m.ticker || '';
            const title = m.title || '';
            const series = m.series_ticker || '';
            return ticker.includes('NBA') || ticker.includes('BBALL') || 
                   title.toLowerCase().includes('nba') || 
                   title.toLowerCase().includes('basketball') ||
                   series.includes('NBA');
        });
        
        displayMarkets(basketballMarkets.length > 0 ? basketballMarkets : allMarkets);
    } catch (error) {
        console.error('Error loading markets:', error);
        document.getElementById('markets-grid').innerHTML = 
            '<p style="color: #ff4444; grid-column: 1 / -1;">Error loading markets. Make sure you are logged in.</p>';
    }
}

// Display markets
function displayMarkets(markets) {
    const grid = document.getElementById('markets-grid');
    
    if (markets.length === 0) {
        grid.innerHTML = '<p style="color: #8892a6; grid-column: 1 / -1;">No markets found. Try removing filters or refreshing.</p>';
        return;
    }
    
    grid.innerHTML = '';
    
    markets.forEach(market => {
        const yesPrice = market.yes_ask || market.yes_bid || 50;
        const noPrice = market.no_ask || market.no_bid || 50;
        
        // Calculate arb opportunity
        const arbProfit = 100 - (yesPrice + noPrice);
        const hasArb = arbProfit > 2;
        
        const card = document.createElement('div');
        card.className = 'market-card';
        card.innerHTML = `
            <div class="market-title">
                ${market.title}
                ${hasArb ? `<span class="arb-badge">⚡ ${arbProfit.toFixed(1)}¢ ARB</span>` : ''}
            </div>
            
            <div class="market-meta">
                <span>📊 ${market.ticker}</span>
                <span>💰 Volume: $${((market.volume || 0) / 100).toFixed(0)}</span>
                ${market.close_time ? `<span>⏰ ${new Date(market.close_time).toLocaleDateString()}</span>` : ''}
            </div>
            
            <div class="price-display">
                <div class="price-box yes" onclick='openBotModal(${JSON.stringify(market).replace(/'/g, "&apos;")}, "yes", ${yesPrice})'>
                    <div class="label">YES</div>
                    <div class="price">${yesPrice}¢</div>
                </div>
                
                <div class="price-box no" onclick='openBotModal(${JSON.stringify(market).replace(/'/g, "&apos;")}, "no", ${noPrice})'>
                    <div class="label">NO</div>
                    <div class="price">${noPrice}¢</div>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

// Search functionality
function setupSearch() {
    const searchBox = document.getElementById('search-box');
    searchBox.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        if (query === '') {
            displayMarkets(allMarkets);
            return;
        }
        
        const filtered = allMarkets.filter(m => {
            const title = (m.title || '').toLowerCase();
            const ticker = (m.ticker || '').toLowerCase();
            const series = (m.series_ticker || '').toLowerCase();
            return title.includes(query) || ticker.includes(query) || series.includes(query);
        });
        
        displayMarkets(filtered);
    });
}

// Open bot creation modal
function openBotModal(market, side, price) {
    selectedMarket = market;
    selectedSide = side;
    
    document.getElementById('bot-market-title').textContent = market.title;
    document.getElementById('bot-side').textContent = side.toUpperCase();
    document.getElementById('bot-side').style.color = side === 'yes' ? '#00ff88' : '#ff4444';
    document.getElementById('bot-target-price').value = price;
    
    document.getElementById('bot-modal').classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('bot-modal').classList.remove('show');
}

// Create bot
async function createBot() {
    if (!selectedMarket || !selectedSide) {
        alert('Invalid bot configuration');
        return;
    }
    
    const targetPrice = parseInt(document.getElementById('bot-target-price').value);
    const quantity = parseInt(document.getElementById('bot-quantity').value);
    const arbWidth = parseFloat(document.getElementById('bot-arb-width').value);
    const stopLoss = parseFloat(document.getElementById('bot-stop-loss').value);
    
    try {
        const response = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: selectedMarket.ticker,
                side: selectedSide,
                target_price: targetPrice,
                quantity: quantity,
                arb_width: arbWidth,
                stop_loss_pct: stopLoss,
                auto_arb: true
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Bot created! Monitoring ${selectedSide.toUpperCase()} at ${targetPrice}¢`);
            closeModal();
            loadBots();
            
            // Start auto-monitor if not already running
            if (!autoMonitorInterval) {
                toggleAutoMonitor();
            }
        } else {
            alert('Error creating bot: ' + data.error);
        }
    } catch (error) {
        alert('Error creating bot: ' + error.message);
    }
}

// Load and display active bots
async function loadBots() {
    try {
        const response = await fetch(`${API_BASE}/bot/list`);
        const data = await response.json();
        
        const bots = data.bots || {};
        const botIds = Object.keys(bots);
        
        if (botIds.length === 0) {
            document.getElementById('bots-section').style.display = 'none';
            return;
        }
        
        document.getElementById('bots-section').style.display = 'block';
        
        const botsList = document.getElementById('bots-list');
        botsList.innerHTML = '';
        
        botIds.forEach(botId => {
            const bot = bots[botId];
            const botItem = document.createElement('div');
            botItem.className = 'bot-item';
            botItem.innerHTML = `
                <div>
                    <strong>${bot.ticker}</strong> - ${bot.side.toUpperCase()} @ ${bot.target_price}¢
                    <span class="bot-status ${bot.status}">${bot.status.replace('_', ' ').toUpperCase()}</span>
                    ${bot.leg1_fill_price ? `<span style="color: #8892a6; margin-left: 0.5rem;">Filled: ${bot.leg1_fill_price}¢</span>` : ''}
                </div>
                <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="cancelBot('${botId}')">Cancel</button>
            `;
            botsList.appendChild(botItem);
        });
    } catch (error) {
        console.error('Error loading bots:', error);
    }
}

// Cancel bot
async function cancelBot(botId) {
    if (!confirm('Cancel this bot?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/bot/cancel/${botId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            loadBots();
        }
    } catch (error) {
        alert('Error cancelling bot: ' + error.message);
    }
}

// Toggle auto-monitor
function toggleAutoMonitor() {
    const button = document.getElementById('auto-monitor-text');
    
    if (autoMonitorInterval) {
        clearInterval(autoMonitorInterval);
        autoMonitorInterval = null;
        button.textContent = '▶️ Start Auto-Monitor';
    } else {
        autoMonitorInterval = setInterval(monitorBots, 5000); // Check every 5 seconds
        button.textContent = '⏸️ Stop Auto-Monitor';
        monitorBots(); // Run immediately
    }
}

// Monitor bots
async function monitorBots() {
    try {
        const response = await fetch(`${API_BASE}/bot/monitor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success && data.actions && data.actions.length > 0) {
            // Show notifications for actions taken
            data.actions.forEach(action => {
                console.log('Bot action:', action);
                
                if (action.action === 'completed_arb') {
                    showNotification(`✅ ARB COMPLETED! Profit: ${action.profit}¢ (${action.profit_pct.toFixed(2)}%)`);
                } else if (action.action.includes('stop_loss')) {
                    showNotification(`⚠️ Stop loss triggered on ${action.bot_id}`);
                }
            });
            
            loadBots(); // Refresh bot list
        }
    } catch (error) {
        console.error('Error monitoring bots:', error);
    }
}

// Load balance
async function loadBalance() {
    try {
        const response = await fetch(`${API_BASE}/balance`);
        const data = await response.json();
        
        if (!data.error) {
            document.getElementById('balance-display').style.display = 'flex';
            document.getElementById('balance-amount').textContent = `$${(data.balance / 100).toFixed(2)}`;
            document.getElementById('portfolio-value').textContent = `$${((data.portfolio_value || 0) / 100).toFixed(2)}`;
        }
    } catch (error) {
        console.log('Balance not loaded (may not be authenticated)');
    }
}

// Show notification
function showNotification(message) {
    // Simple alert for now - could be replaced with toast notifications
    alert(message);
}
