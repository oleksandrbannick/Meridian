// Kalshi Arbitrage Screener - Frontend JavaScript

const API_BASE = 'http://localhost:5001/api';
let isAuthenticated = false;
let currentMarkets = [];
let selectedMarket = null;
let arbMonitorInterval = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadMarkets();
});

// Event Listeners Setup
function setupEventListeners() {
    // Login
    document.getElementById('login-btn').addEventListener('click', openLoginModal);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Filters
    document.getElementById('status-filter').addEventListener('change', loadMarkets);
    document.getElementById('search-input').addEventListener('input', filterMarkets);
    
    // Arbitrage
    document.getElementById('find-arb-btn').addEventListener('click', findArbOpportunities);
    document.getElementById('monitor-arb-btn').addEventListener('click', monitorArbPositions);
    
    // View toggle
    document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const view = e.target.dataset.view;
            toggleView(view);
        });
    });
    
    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadMarkets();
        if (isAuthenticated) {
            loadBalance();
            loadPositions();
            loadArbPositions();
        }
    });
    
    // Arb price inputs
    document.getElementById('arb-yes-price')?.addEventListener('input', calculateArbProfit);
    document.getElementById('arb-no-price')?.addEventListener('input', calculateArbProfit);
    document.getElementById('arb-quantity')?.addEventListener('input', calculateArbProfit);
    document.getElementById('execute-arb-btn')?.addEventListener('click', executeArbitrage);
}

// Login Modal Functions
function openLoginModal() {
    // Pre-fill credentials
    document.getElementById('api-key-id').value = 'e0623465-ab2e-4e6b-af50-a896fe5ddacc';
    document.getElementById('private-key').value = `-----BEGIN RSA PRIVATE KEY-----
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
    document.getElementById('demo-mode').checked = true;
    
    document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    
    const apiKeyId = document.getElementById('api-key-id').value;
    const privateKey = document.getElementById('private-key').value;
    const demo = document.getElementById('demo-mode').checked;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key_id: apiKeyId, private_key: privateKey, demo })
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            closeLoginModal();
            document.getElementById('login-btn').textContent = 'Logout';
            document.getElementById('login-btn').onclick = logout;
            document.getElementById('refresh-btn').classList.remove('hidden');
            document.getElementById('monitor-arb-btn').classList.remove('hidden');
            
            // Show balance
            document.getElementById('balance-display').classList.remove('hidden');
            document.getElementById('balance-amount').textContent = `$${data.balance.toFixed(2)}`;
            document.getElementById('portfolio-value').textContent = `$${data.portfolio_value.toFixed(2)}`;
            
            // Load user data
            loadPositions();
            loadArbPositions();
            
            alert('Successfully connected to Kalshi!');
        } else {
            alert(`Login failed: ${data.error}`);
        }
    } catch (error) {
        alert(`Login error: ${error.message}`);
    }
}

function logout() {
    isAuthenticated = false;
    document.getElementById('login-btn').textContent = 'Login';
    document.getElementById('login-btn').onclick = openLoginModal;
    document.getElementById('refresh-btn').classList.add('hidden');
    document.getElementById('monitor-arb-btn').classList.add('hidden');
    document.getElementById('balance-display').classList.add('hidden');
    
    // Clear positions
    document.getElementById('positions-list').innerHTML = '<p class="text-muted">No active positions</p>';
    document.getElementById('arb-positions-list').innerHTML = '<p class="text-muted">No active arb trades</p>';
}

// Market Loading Functions
async function loadMarkets() {
    const status = document.getElementById('status-filter').value;
    const loading = document.getElementById('loading');
    const grid = document.getElementById('markets-grid');
    
    loading.classList.remove('hidden');
    grid.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE}/markets?status=${status}&limit=100`);
        const data = await response.json();
        
        currentMarkets = data.markets || [];
        displayMarkets(currentMarkets);
    } catch (error) {
        console.error('Error loading markets:', error);
        grid.innerHTML = '<p class="text-center text-muted">Failed to load markets</p>';
    } finally {
        loading.classList.add('hidden');
    }
}

function displayMarkets(markets) {
    const grid = document.getElementById('markets-grid');
    
    if (!markets || markets.length === 0) {
        grid.innerHTML = '<p class="text-center text-muted">No markets found</p>';
        return;
    }
    
    grid.innerHTML = markets.map(market => createMarketCard(market)).join('');
    
    // Add click handlers
    document.querySelectorAll('.market-card').forEach(card => {
        card.addEventListener('click', () => {
            const ticker = card.dataset.ticker;
            openMarketModal(ticker);
        });
    });
}

function createMarketCard(market) {
    const yesBid = parseFloat(market.yes_bid_dollars || 0);
    const yesAsk = parseFloat(market.yes_ask_dollars || 0);
    const noBid = parseFloat(market.no_bid_dollars || 0);
    const noAsk = parseFloat(market.no_ask_dollars || 0);
    
    // Check for arbitrage opportunity
    const arbProfit = 100 - ((yesAsk * 100) + (noAsk * 100));
    const hasArb = arbProfit > 0;
    
    return `
        <div class="market-card" data-ticker="${market.ticker}">
            <div class="market-header">
                <div class="market-ticker">${market.ticker}</div>
                <div class="market-title">${market.yes_sub_title || market.title || 'Untitled Market'}</div>
            </div>
            
            <div class="market-prices">
                <div class="price-box yes">
                    <div class="price-label">YES</div>
                    <div class="price-value">${(yesBid * 100).toFixed(0)}¢</div>
                    <div class="price-range">${(yesBid * 100).toFixed(0)}¢ - ${(yesAsk * 100).toFixed(0)}¢</div>
                </div>
                <div class="price-box no">
                    <div class="price-label">NO</div>
                    <div class="price-value">${(noBid * 100).toFixed(0)}¢</div>
                    <div class="price-range">${(noBid * 100).toFixed(0)}¢ - ${(noAsk * 100).toFixed(0)}¢</div>
                </div>
            </div>
            
            <div class="market-stats">
                <span>Vol: ${market.volume || 0}</span>
                <span>OI: ${market.open_interest || 0}</span>
                <span>${market.status || 'unknown'}</span>
            </div>
            
            ${hasArb ? `<div class="market-arb-badge">⚡ Arb: ${arbProfit.toFixed(1)}¢</div>` : ''}
        </div>
    `;
}

function filterMarkets() {
    const search = document.getElementById('search-input').value.toLowerCase();
    
    if (!search) {
        displayMarkets(currentMarkets);
        return;
    }
    
    const filtered = currentMarkets.filter(market => {
        const title = (market.title || '').toLowerCase();
        const ticker = (market.ticker || '').toLowerCase();
        const yesTitle = (market.yes_sub_title || '').toLowerCase();
        const noTitle = (market.no_sub_title || '').toLowerCase();
        
        return title.includes(search) || ticker.includes(search) || 
               yesTitle.includes(search) || noTitle.includes(search);
    });
    
    displayMarkets(filtered);
}

function toggleView(view) {
    const grid = document.getElementById('markets-grid');
    
    if (view === 'list') {
        grid.style.gridTemplateColumns = '1fr';
    } else {
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
    }
}

// Market Detail Modal
async function openMarketModal(ticker) {
    selectedMarket = ticker;
    document.getElementById('market-modal').classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/market/${ticker}`);
        const data = await response.json();
        const market = data.market;
        
        const yesBid = parseFloat(market.yes_bid_dollars || 0);
        const yesAsk = parseFloat(market.yes_ask_dollars || 0);
        const noBid = parseFloat(market.no_bid_dollars || 0);
        const noAsk = parseFloat(market.no_ask_dollars || 0);
        
        document.getElementById('market-detail').innerHTML = `
            <div class="market-detail-header">
                <div class="market-ticker">${market.ticker}</div>
                <div class="market-detail-title">${market.title || 'Untitled Market'}</div>
                <div class="market-detail-subtitle">YES: ${market.yes_sub_title || ''} | NO: ${market.no_sub_title || ''}</div>
            </div>
            
            <div class="market-detail-prices">
                <div class="price-box yes">
                    <h4>YES Side</h4>
                    <div class="price-value">${(yesBid * 100).toFixed(1)}¢</div>
                    <div class="price-range">Bid: ${(yesBid * 100).toFixed(1)}¢ | Ask: ${(yesAsk * 100).toFixed(1)}¢</div>
                </div>
                <div class="price-box no">
                    <h4>NO Side</h4>
                    <div class="price-value">${(noBid * 100).toFixed(1)}¢</div>
                    <div class="price-range">Bid: ${(noBid * 100).toFixed(1)}¢ | Ask: ${(noAsk * 100).toFixed(1)}¢</div>
                </div>
            </div>
            
            <div class="market-stats">
                <div><strong>Status:</strong> ${market.status}</div>
                <div><strong>Volume:</strong> ${market.volume || 0}</div>
                <div><strong>Open Interest:</strong> ${market.open_interest || 0}</div>
            </div>
            
            ${isAuthenticated ? `
                <div style="margin-top: 2rem;">
                    <button class="btn btn-success" onclick="openArbModal('${ticker}')">
                        Create Arbitrage Trade
                    </button>
                </div>
            ` : ''}
        `;
    } catch (error) {
        document.getElementById('market-detail').innerHTML = 
            `<p class="text-center text-muted">Failed to load market details</p>`;
    }
}

function closeMarketModal() {
    document.getElementById('market-modal').classList.add('hidden');
    selectedMarket = null;
}

// Arbitrage Functions
function findArbOpportunities() {
    const minProfit = parseInt(document.getElementById('min-profit').value) || 5;
    
    const opportunities = currentMarkets.filter(market => {
        const yesAsk = parseFloat(market.yes_ask_dollars || 0) * 100;
        const noAsk = parseFloat(market.no_ask_dollars || 0) * 100;
        const profit = 100 - (yesAsk + noAsk);
        return profit >= minProfit;
    }).sort((a, b) => {
        const profitA = 100 - ((parseFloat(a.yes_ask_dollars || 0) * 100) + (parseFloat(a.no_ask_dollars || 0) * 100));
        const profitB = 100 - ((parseFloat(b.yes_ask_dollars || 0) * 100) + (parseFloat(b.no_ask_dollars || 0) * 100));
        return profitB - profitA;
    });
    
    if (opportunities.length > 0) {
        displayMarkets(opportunities);
        alert(`Found ${opportunities.length} arbitrage opportunities!`);
    } else {
        alert('No arbitrage opportunities found with current settings.');
    }
}

async function openArbModal(ticker) {
    closeMarketModal();
    selectedMarket = ticker;
    
    // Get current market prices
    const response = await fetch(`${API_BASE}/market/${ticker}`);
    const data = await response.json();
    const market = data.market;
    
    document.getElementById('arb-yes-price').value = Math.ceil(parseFloat(market.yes_ask_dollars || 0) * 100);
    document.getElementById('arb-no-price').value = Math.ceil(parseFloat(market.no_ask_dollars || 0) * 100);
    document.getElementById('arb-quantity').value = 1;
    
    calculateArbProfit();
    
    document.getElementById('arb-modal').classList.remove('hidden');
}

function closeArbModal() {
    document.getElementById('arb-modal').classList.add('hidden');
}

function calculateArbProfit() {
    const yesPrice = parseInt(document.getElementById('arb-yes-price').value) || 0;
    const noPrice = parseInt(document.getElementById('arb-no-price').value) || 0;
    const quantity = parseInt(document.getElementById('arb-quantity').value) || 1;
    
    const totalCost = yesPrice + noPrice;
    const profitPerContract = 100 - totalCost;
    const totalProfit = profitPerContract * quantity;
    
    const preview = document.getElementById('arb-profit-preview');
    
    if (profitPerContract > 0) {
        preview.innerHTML = `
            <div class="arb-profit">
                <div class="arb-profit-label">Total Profit</div>
                <div class="arb-profit-value">${totalProfit.toFixed(0)}¢</div>
                <div class="arb-profit-per">${profitPerContract.toFixed(1)}¢ per contract</div>
            </div>
        `;
    } else {
        preview.innerHTML = `
            <div style="padding: 1rem; background: rgba(239, 68, 68, 0.1); border: 2px solid var(--danger-color); border-radius: 8px; text-align: center;">
                <div style="color: var(--danger-color); font-weight: 700;">No Arbitrage Opportunity</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    Total cost (${totalCost}¢) must be less than 100¢
                </div>
            </div>
        `;
    }
}

async function executeArbitrage() {
    if (!isAuthenticated) {
        alert('Please login first');
        return;
    }
    
    const ticker = selectedMarket;
    const yesPrice = parseInt(document.getElementById('arb-yes-price').value);
    const noPrice = parseInt(document.getElementById('arb-no-price').value);
    const quantity = parseInt(document.getElementById('arb-quantity').value);
    
    if (!ticker || !yesPrice || !noPrice || !quantity) {
        alert('Please fill all fields');
        return;
    }
    
    if (yesPrice + noPrice >= 100) {
        alert('No arbitrage opportunity - total cost must be less than 100 cents');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/arb/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, yes_price: yesPrice, no_price: noPrice, count: quantity })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Arbitrage trade created! Expected profit: ${data.total_profit}¢`);
            closeArbModal();
            loadArbPositions();
            loadBalance();
        } else {
            alert(`Failed to create arbitrage: ${data.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function loadArbPositions() {
    try {
        const response = await fetch(`${API_BASE}/arb/positions`);
        const data = await response.json();
        
        const list = document.getElementById('arb-positions-list');
        
        if (!data.positions || data.positions.length === 0) {
            list.innerHTML = '<p class="text-muted">No active arb trades</p>';
            return;
        }
        
        list.innerHTML = data.positions.map(pos => `
            <div class="position-item">
                <div class="position-ticker">${pos.ticker}</div>
                <div class="position-details">
                    <span>YES: ${pos.yes_price}¢</span>
                    <span>NO: ${pos.no_price}¢</span>
                </div>
                <div class="position-details">
                    <span>Profit: ${pos.total_profit}¢</span>
                    <span>Qty: ${pos.count}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading arb positions:', error);
    }
}

async function monitorArbPositions() {
    if (!isAuthenticated) return;
    
    const stopLoss = parseInt(document.getElementById('stop-loss').value) / 100 || 0.05;
    
    try {
        const response = await fetch(`${API_BASE}/arb/monitor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stop_loss_percentage: stopLoss })
        });
        
        const data = await response.json();
        
        if (data.actions_taken && data.actions_taken.length > 0) {
            alert(`Monitoring complete: ${data.actions_taken.length} actions taken`);
            loadArbPositions();
            loadBalance();
        } else {
            alert('Monitoring complete: All positions healthy');
        }
    } catch (error) {
        alert(`Monitoring error: ${error.message}`);
    }
}

// Balance & Positions
async function loadBalance() {
    try {
        const response = await fetch(`${API_BASE}/balance`);
        const data = await response.json();
        
        document.getElementById('balance-amount').textContent = `$${data.balance.toFixed(2)}`;
        document.getElementById('portfolio-value').textContent = `$${data.portfolio_value.toFixed(2)}`;
    } catch (error) {
        console.error('Error loading balance:', error);
    }
}

async function loadPositions() {
    try {
        const response = await fetch(`${API_BASE}/positions`);
        const data = await response.json();
        
        const list = document.getElementById('positions-list');
        const positions = data.market_positions || [];
        
        if (positions.length === 0) {
            list.innerHTML = '<p class="text-muted">No active positions</p>';
            return;
        }
        
        list.innerHTML = positions.map(pos => `
            <div class="position-item">
                <div class="position-ticker">${pos.ticker}</div>
                <div class="position-details">
                    <span>Pos: ${pos.position}</span>
                    <span>PnL: ${(pos.realized_pnl / 100).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading positions:', error);
    }
}

// Auto-monitor arb positions every 30 seconds if authenticated
setInterval(() => {
    if (isAuthenticated && document.getElementById('arb-positions-list').children.length > 1) {
        monitorArbPositions();
    }
}, 30000);
