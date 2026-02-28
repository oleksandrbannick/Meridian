// Kalshi Basketball Trader - New Frontend
const API_BASE = 'http://localhost:5001/api';
let allMarkets = [];
let autoMonitorInterval = null;
let selectedMarket = null;
let selectedSide = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Auto-login first, then load everything
    autoLogin();
});

// Auto-login with stored credentials
async function autoLogin() {
    const apiKey = 'e0623465-ab2e-4e6b-af50-a896fe5ddacc';
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEoQIBAAKCAQEA5vovFqOwM6v2yT4bu/kRggMULlxTAUS20ufKk1VYITYmlIFO
7hSqCQf6KDtntF0hl4DTmsme7VTvC8zli+cNHGGUa3OA9W7qSh+2ERFdSF+41RKC
yFuFxA12xn8fq1nBq4Bgh+cjP6rOkTvSXWpCnf0Hus/ZMFuwPCeMtnL+EAJ9OU8s
pqZHlaPkNBCgZ71syT2bIbS6m045DqeEB8vTJHp9VSFbs7fQmlFJKds9jBeL9unn
8yKcDWaxTJUlfYx9O169Qx1HewZAnG9zMP9ra9qIIQKaXD4+RKEXJnegGbAjMjf9
ulCW241M8BLL/9ryTZLq269TOmiHK9D1ltDhWwIDAQABAoIBACVXsnA7E5wvA62i
fHJmALYf0E30gDj2xoYPknlCdYadDhy5USz9q0Xdg8yoWgpXejxXyB5A1ZBySFmE
jWISf1Sk1A2RNXq4rWlBejqFL6spSqUsInfJEDXTpW3PFKwrzTtwfGrMbC75av8h
CFAxA0cupubFfswqLrJzBHVk3v1wUu+JoMrspoZvz+0LwIe3pY+TxCxukxEG+EWQ
NIiMow3sniDuZA+93RMCZuSD02DDnZg6K7QoefXrfOotjiXLIefuXVsUlWaWUdkQ
wF8BQaGO585K92YFOrkVMh8koy8P0ZFy6JMrtjViq6TQx1JPGc8n1tnitfSjdBhk
RgBuTwkCgYEA7apnS5G0QEobu/xYP2VltIcc7Rgj0bIV0V6tOUcxRvklhkJ91wKp
tQ2nZ/iqpyUKVEqtGiMUCU+0B5IGGJpRNOAxzOr9ICf46e766JZ+AhngtC2KL2id
uEvlxaeEnb3Y/gaZgt/KLYBQiIqWa3220n20IIPl1CoTWP5Ma0lBunkCgYEA+Mux
ngVpQM8FY06rSB+00XcRq29sdnHjJR9chFvMjwfoTIFxCJ7jQAYcRfJEzQp6Z8T7
+BMl8kCzgCSwBcODYw2AuROqktZvdXMagZjoZS5ZbM1WYdGtbn3QRfNjTXWC+fzk
UTjRvKyH2O8MrStz3Y5H9sUaWwsIE4s30aVjxXMCgYAv4ik1nIGIgmXcFhdhjnhT
SvWU/0wYL50dtcmIxMM03XWl+zeHXk364GleFUesrVXLbdA6d97NkXVgIReBVXYP
BSyDcMTW+ba4yyFaQxfYLIaNRq+UpatBOmlszTd24I0bgRDkwVnmmPegyutLdOSk
vBbShkCD4oZLY9DZvMS1YQKBgQCI2+wp5AohJ4BsP3NDKoXaD+i9aH6+rSlpW1YW
TTU6nPvxUecu+dBCgNn+tCWasR/ig16j+UyPdX4IiKX3lbRpwZzEsofLXIBVmGrF
TarRNezlSBMznhcMR9NRF3DRxEm3YKDr+RiO9E2KTP2pKNUE1GbL3WMBIBFiRtv+
zD8U9wJ/ZyogIUaMX7Rcu+KvbSujKg8nQHG/KdJeVO6NECD2+0iDden/c+ax9FFJ
mEE1rz0cViIPcKbw3hkKymdBdrHS6tKsPqMB7L4WQqjILYXJOiTJQQy0Gd+YEhSX
lSEc96isSV4HXYuYz2fNUUoH8e5s0+xRraON1cwscci9tC2vKg==
-----END RSA PRIVATE KEY-----`;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key_id: apiKey,
                private_key: privateKey,
                demo: false  // Using production, not demo
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Auto-login successful');
            loadMarkets();
            loadBots();
            setupSearch();
            loadBalance();
        } else {
            console.error('Auto-login failed:', data.error);
            alert('Login failed: ' + data.error + '\n\nPlease check your API credentials.');
        }
    } catch (error) {
        console.error('Auto-login error:', error);
        alert('Could not connect to server. Make sure the backend is running.');
    }
}

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
