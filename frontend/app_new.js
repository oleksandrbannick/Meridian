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
    console.log('🔐 Starting auto-login...');
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
        console.log('Login response:', data);
        
        if (data.success) {
            console.log('✅ Auto-login successful - Balance: $' + data.balance.toFixed(2));
            
            // Setup search first
            setupSearch();
            
            // Then load data
            await loadBalance();
            await loadBots();
            await loadMarkets();
        } else {
            console.error('❌ Auto-login failed:', data.error);
            const grid = document.getElementById('markets-grid');
            grid.innerHTML = `<p style="color: #ff4444; grid-column: 1 / -1;">Login failed: ${data.error}<br>Check console for details.</p>`;
        }
    } catch (error) {
        console.error('❌ Auto-login error:', error);
        const grid = document.getElementById('markets-grid');
        grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">Could not connect to server. Make sure backend is running on port 5001.</p>';
    }
}

// Load markets
async function loadMarkets() {
    const grid = document.getElementById('markets-grid');
    grid.innerHTML = '<p style="color: #00ff88; grid-column: 1 / -1;">Loading markets...</p>';
    
    try {
        // Try open markets first, fall back to closed if none available
        let response = await fetch(`${API_BASE}/markets?status=open&limit=500`);
        let data = await response.json();
        
        if (data.error) {
            grid.innerHTML = `<p style="color: #ff4444; grid-column: 1 / -1;">Error: ${data.error}</p>`;
            return;
        }
        
        // API returns {markets: [...], cursor: "..."}
        allMarkets = data.markets || data;
        console.log(`Loaded ${allMarkets.length} open markets from API (after backend filtering)`);
        
        // If no open markets, automatically load closed markets
        if (allMarkets.length === 0) {
            console.log('No open markets, loading recently closed games...');
            response = await fetch(`${API_BASE}/markets?status=closed&limit=500`);
            data = await response.json();
            allMarkets = data.markets || data;
            console.log(`Loaded ${allMarkets.length} closed markets`);
            
            if (allMarkets.length === 0) {
                grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">No markets available</p>';
                return;
            }
        }
        
        displayMarkets(allMarkets);
    } catch (error) {
        console.error('Error loading markets:', error);
        grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">Network error loading markets. Check console.</p>';
    }
}

// Display markets using trading floor layout (compact event rows)
function displayMarkets(markets) {
    const grid = document.getElementById('markets-grid');
    
    if (!markets ||markets.length === 0) {
        grid.innerHTML = '<p style="color: #8892a6; grid-column: 1 / -1;">No markets to display.</p>';
        return;
    }
    
    console.log(`Organizing ${markets.length} markets into trading floor layout...`);
    
    // Group by event (game) - one compact card per game
    const events = groupByEvent(markets);
    console.log(`Found ${Object.keys(events).length} events`);
    
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = '1fr'; // Single column for compact display
    
    // Display each event with all its markets in one compact row
    Object.values(events).forEach(eventData => {
        displayEventRow(eventData, grid);
    });
}

// Group markets by event (one card per game)
function groupByEvent(markets) {
    const events = {};
    
    markets.forEach(market => {
        const eventTicker = market.event_ticker || 'UNKNOWN';
        const gameId = extractGameId(eventTicker);
        
        if (!events[gameId]) {
            events[gameId] = {
                gameId: gameId,
                eventTitle: formatEventTitle(market),
                teamNames: parseTeamNames(gameId),
                markets: []
            };
        }
        
        events[gameId].markets.push(market);
    });
    
    return events;
}

// Format clean event title (remove ticker noise)
function formatEventTitle(market) {
    // Use title if it's clean
    if (market.title && !market.title.includes('KXNBA') && !market.title.includes('KXNCAA')) {
        // Extract game name from title (before colon if exists)
        if (market.title.includes(':')) {
            return market.title.split(':')[0].trim();
        }
        return market.title;
    }
    
    // Extract from event ticker
    const event = market.event_ticker || '';
    const gameId = extractGameId(event);
    return parseTeamNames(gameId);
}

// Display one compact event row (trading floor style)
function displayEventRow(eventData, container) {
    const card = document.createElement('div');
    card.style.cssText = 'background: #1a1f2e; border: 1px solid #2a3447; border-radius: 8px; padding: 16px; margin-bottom: 12px;';
    
    // Event header
    const header = document.createElement('div');
    header.style.cssText = 'font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a3447;';
    header.textContent = `🏀 ${eventData.eventTitle}`;
    card.appendChild(header);
    
    // Markets grid (compact button layout)
    const marketsGrid = document.createElement('div');
    marketsGrid.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    // Categorize markets
    const categorized = categorizeMarkets(eventData.markets);
    
    // Display main markets (Winner, Spread, Total) first
    if (categorized.winner) {
        marketsGrid.appendChild(createMarketRow(categorized.winner, 'Winner'));
    }
    if (categorized.spread) {
        marketsGrid.appendChild(createMarketRow(categorized.spread, 'Spread'));
    }
    if (categorized.total) {
        marketsGrid.appendChild(createMarketRow(categorized.total, 'Total'));
    }
    
    // Player props in collapsible section
    if (categorized.props.length > 0) {
        const propsSection = createPropsCollapsible(categorized.props);
        marketsGrid.appendChild(propsSection);
    }
    
    card.appendChild(marketsGrid);
    container.appendChild(card);
}

// Categorize markets by type
function categorizeMarkets(markets) {
    const result = {
        winner: null,
        spread: null,
        total: null,
        props: []
    };
    
    markets.forEach(market => {
        const event = market.event_ticker || '';
        const series = market.series_ticker || '';
        
        if (event.includes('GAME') && !result.winner) {
            result.winner = market;
        } else if (event.includes('SPREAD') || series.includes('SPREAD')) {
            if (!result.spread) result.spread = market;
        } else if (event.includes('TOTAL') || series.includes('TOTAL')) {
            if (!result.total) result.total = market;
        } else {
            result.props.push(market);
        }
    });
    
    return result;
}

// Create single market row (compact button-grid style)
function createMarketRow(market, label) {
    const row = document.createElement('div');
    row.style.cssText = 'display: grid; grid-template-columns: 120px 1fr 1fr auto; gap: 10px; align-items: center; padding: 8px; background: #0f1419; border-radius: 6px;';
    
    // Market label
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = 'font-size: 13px; font-weight: 600; color: #8892a6;';
    labelDiv.textContent = label;
    
    // Extract clean subtitle from market title
    const subtitle = extractSubtitle(market.title);
    if (subtitle && label !== 'Winner') {
        labelDiv.textContent = subtitle;
    }
    
    // YES button (compact price button with value-based styling)
    const yesBid = market.yes_bid || 0;
    const yesAsk = market.yes_ask || 0;
    const yesPrice = yesAsk || Math.round((yesBid + yesAsk) / 2);
    const yesStyle = getPriceButtonStyle(yesPrice, 'yes');
    
    const yesBtn = document.createElement('button');
    yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${yesStyle}`;
    yesBtn.innerHTML = `<div>${yesPrice}¢</div><div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">YES</div>`;
    yesBtn.onclick = () => openBotModal(market, 'yes', yesAsk);
    yesBtn.onmouseenter = () => yesBtn.style.transform = 'scale(1.05)';
    yesBtn.onmouseleave = () => yesBtn.style.transform = 'scale(1)';
    
    // NO button
    const noBid = market.no_bid || 0;
    const noAsk = market.no_ask || 0;
    const noPrice = noAsk || (100 - yesPrice);
    const noStyle = getPriceButtonStyle(noPrice, 'no');
    
    const noBtn = document.createElement('button');
    noBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${noStyle}`;
    noBtn.innerHTML = `<div>${noPrice}¢</div><div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">NO</div>`;
    noBtn.onclick = () => openBotModal(market, 'no', noAsk);
    noBtn.onmouseenter = () => noBtn.style.transform = 'scale(1.05)';
    noBtn.onmouseleave = () => noBtn.style.transform = 'scale(1)';
    
    // Orderbook button
    const orderbookBtn = document.createElement('button');
    orderbookBtn.style.cssText = 'padding: 8px 12px; background: #2a3447; color: #8892a6; border: 1px solid #3a4457; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s;';
    orderbookBtn.textContent = '📊';
    orderbookBtn.onclick = () => openOrderbookSidebar(market);
    orderbookBtn.onmouseenter = () => {
        orderbookBtn.style.background = '#3a4557';
        orderbookBtn.style.color = '#00ff88';
    };
    orderbookBtn.onmouseleave = () => {
        orderbookBtn.style.background = '#2a3447';
        orderbookBtn.style.color = '#8892a6';
    };
    
    row.appendChild(labelDiv);
    row.appendChild(yesBtn);
    row.appendChild(noBtn);
    row.appendChild(orderbookBtn);
    
    return row;
}

// Get button styling based on price (dim extremes, highlight mid-range)
function getPriceButtonStyle(price, side) {
    const isActive = price >= 35 && price <= 65;
    
    if (side === 'yes') {
        if (isActive) {
            return 'background: rgba(0, 255, 136, 0.2); color: #00ff88; border: 2px solid #00ff88;';
        } else if (price > 80) {
            return 'background: rgba(0, 255, 136, 0.05); color: #00ff8855; border: 1px solid #00ff8833;';
        } else if (price < 20) {
            return 'background: rgba(0, 255, 136, 0.03); color: #00ff8833; border: 1px solid #00ff8822;';
        } else {
            return 'background: rgba(0, 255, 136, 0.1); color: #00ff88; border: 1px solid #00ff8866;';
        }
    } else {
        if (isActive) {
            return 'background: rgba(255, 68, 68, 0.2); color: #ff4444; border: 2px solid #ff4444;';
        } else if (price > 80) {
            return 'background: rgba(255, 68, 68, 0.05); color: #ff444455; border: 1px solid #ff444433;';
        } else if (price < 20) {
            return 'background: rgba(255, 68, 68, 0.03); color: #ff444433; border: 1px solid #ff444422;';
        } else {
            return 'background: rgba(255, 68, 68, 0.1); color: #ff4444; border: 1px solid #ff444466;';
        }
    }
}

// Extract subtitle from market title (e.g., "DEN -3.5" from full title)
function extractSubtitle(title) {
    if (!title) return '';
    
    // For spread: "DEN vs OKC: DEN -3.5" -> "DEN -3.5"
    if (title.includes(':')) {
        const parts = title.split(':');
        return parts[1]?.trim() || parts[0];
    }
    
    // For total: "DEN vs OKC: Over 225.5" -> "O 225.5"
    if (title.includes('Over')) {
        return title.replace('Over', 'O').split(':')[1]?.trim() || title;
    }
    
    return title.length > 40 ? title.substring(0, 37) + '...' : title;
}

// Create collapsible player props section
function createPropsCollapsible(props) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 8px;';
    
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; background: #0f1419; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
        <span style="color: #8892a6; font-size: 12px; font-weight: 600;">📊 Player Props (${props.length})</span>
        <span style="color: #8892a6; font-size: 12px;">▼</span>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'display: none; padding-top: 8px; gap: 6px; flex-direction: column;';
    
    props.slice(0, 20).forEach(prop => {
        content.appendChild(createMarketRow(prop, extractSubtitle(prop.title)));
    });
    
    header.onclick = () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        header.querySelector('span:last-child').textContent = isHidden ? '▲' : '▼';
    };
    
    section.appendChild(header);
    section.appendChild(content);
    return section;
}

// Open orderbook in right sidebar (split-pane layout)
function openOrderbookSidebar(market) {
    // Close existing sidebar if open
    const existing = document.getElementById('orderbook-sidebar');
    if (existing) existing.remove();
    
    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'orderbook-sidebar';
    sidebar.style.cssText = 'position: fixed; top: 0; right: 0; width: 400px; height: 100vh; background: #0a0e1a; border-left: 2px solid #2a3447; z-index: 10000; overflow-y: auto; animation: slideIn 0.3s ease-out;';
    
    sidebar.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        </style>
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #00ff88; font-size: 18px;">Order Book</h2>
                <button onclick="closeOrderbookSidebar()" style="background: #ff4444; border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">✕</button>
            </div>
            <div style="background: #1a1f2e; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 14px; color: #ffffff; margin-bottom: 8px; font-weight: 600;">${market.title}</div>
                <div style="font-size: 11px; color: #8892a6;">${market.ticker}</div>
            </div>
            <div id="orderbook-ladder" style="color: #8892a6; text-align: center;">Loading orderbook...</div>
        </div>
    `;
    
    document.body.appendChild(sidebar);
    
    // Fetch and display orderbook
    fetchOrderbookForSidebar(market.ticker);
}

function closeOrderbookSidebar() {
    const sidebar = document.getElementById('orderbook-sidebar');
    if (sidebar) {
        sidebar.style.animation = 'slideIn 0.3s ease-in reverse';
        setTimeout(() => sidebar.remove(), 300);
    }
}

async function fetchOrderbookForSidebar(ticker) {
    try {
        const response = await fetch(`${API_BASE}/orderbook/${ticker}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('orderbook-ladder').innerHTML = `<p style="color: #ff4444;">Error: ${data.error}</p>`;
            return;
        }
        
        const orderbook = data.orderbook || data;
        displayOrderbookLadder(orderbook);
    } catch (error) {
        console.error('Error fetching orderbook:', error);
        document.getElementById('orderbook-ladder').innerHTML = `<p style="color: #ff4444;">Network error</p>`;
    }
}

function displayOrderbookLadder(orderbook) {
    const yesOrders = orderbook.yes || [];
    const noOrders = orderbook.no || [];
    
    const ladderHtml = `
        <div style="background: #1a1f2e; border-radius: 8px; padding: 16px;">
            <!-- YES Side -->
            <div style="margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: 600; color: #00ff88; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #2a3447;">YES</div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${yesOrders.length > 0 ? yesOrders.map(order => `
                        <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(0, 255, 136, 0.05); border-left: 3px solid #00ff88; border-radius: 4px;">
                            <span style="color: #00ff88; font-weight: 600;">${order.price}¢</span>
                            <span style="color: #8892a6;">${order.quantity} lots</span>
                        </div>
                    `).join('') : '<p style="color: #8892a6; text-align: center; padding: 20px; font-size: 12px;">No orders</p>'}
                </div>
            </div>
            
            <!-- NO Side -->
            <div>
                <div style="font-size: 12px; font-weight: 600; color: #ff4444; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #2a3447;">NO</div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${noOrders.length > 0 ? noOrders.map(order => `
                        <div style="display: flex; justify-content: space-between; padding: 8px; background: rgba(255, 68, 68, 0.05); border-left: 3px solid #ff4444; border-radius: 4px;">
                            <span style="color: #ff4444; font-weight: 600;">${order.price}¢</span>
                            <span style="color: #8892a6;">${order.quantity} lots</span>
                        </div>
                    `).join('') : '<p style="color: #8892a6; text-align: center; padding: 20px; font-size: 12px;">No orders</p>'}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('orderbook-ladder').innerHTML = ladderHtml;
}

// Organize markets by Series (Hierarchical Exchange Model - OLD)
function organizeBySeries(markets) {
    const series = {};
    
    markets.forEach(market => {
        const seriesTicker = market.series_ticker || 'OTHER';
        const eventTicker = market.event_ticker || 'UNKNOWN';
        
        // Extract base series (e.g., NBAGAME from KXNBAGAME-26FEB27DENOKC)
        let seriesKey = 'OTHER';
        if (eventTicker.includes('NBAGAME')) seriesKey = 'NBA_GAMES';
        else if (eventTicker.includes('NBAPTS')) seriesKey = 'NBA_POINTS';
        else if (eventTicker.includes('NBAREB')) seriesKey = 'NBA_REBOUNDS';
        else if (eventTicker.includes('NBAAST')) seriesKey = 'NBA_ASSISTS';
        else if (eventTicker.includes('NBA3PT')) seriesKey = 'NBA_3PT';
        else if (eventTicker.includes('NBASPREAD')) seriesKey = 'NBA_SPREAD';
        else if (eventTicker.includes('NBATOTAL')) seriesKey = 'NBA_TOTAL';
        else if (eventTicker.includes('NBA')) seriesKey = 'NBA_OTHER';
        
        if (!series[seriesKey]) {
            series[seriesKey] = {};
        }
        
        // Extract game/event identifier
        const gameId = extractGameId(eventTicker);
        
        if (!series[seriesKey][gameId]) {
            series[seriesKey][gameId] = {
                gameId: gameId,
                teamNames: parseTeamNames(gameId),
                markets: []
            };
        }
        
        series[seriesKey][gameId].markets.push(market);
    });
    
    return series;
}

// Extract game identifier from event ticker
function extractGameId(eventTicker) {
    if (eventTicker.includes('-')) {
        const parts = eventTicker.split('-');
        return parts[1] || eventTicker;
    }
    return eventTicker;
}

// Display a series section
function displaySeries(seriesName, events, container) {
    // Sort series by priority
    const seriesOrder = ['NBA_GAMES', 'NBA_SPREAD', 'NBA_TOTAL', 'NBA_POINTS', 'NBA_REBOUNDS', 'NBA_ASSISTS', 'NBA_3PT', 'NBA_OTHER'];
    const priority = seriesOrder.indexOf(seriesName);
    if (priority === -1 && seriesName !== 'OTHER') return; // Skip unknown series
    
    const seriesLabels = {
        'NBA_GAMES': '🏀 Game Winners',
        'NBA_SPREAD': '📊 Spreads',
        'NBA_TOTAL': '🎯 Totals',
        'NBA_POINTS': '📈 Points Props',
        'NBA_REBOUNDS': '🏐 Rebounds Props',
        'NBA_ASSISTS': '🤝 Assists Props',
        'NBA_3PT': '🎯 3-Pointer Props',
        'NBA_OTHER': '📋 Other Props'
    };
    
    const label = seriesLabels[seriesName] || seriesName;
    const eventsList = Object.values(events);
    
    if (eventsList.length === 0) return;
    
    const seriesSection = document.createElement('div');
    seriesSection.style.cssText = 'grid-column: 1 / -1; margin-bottom: 30px;';
    
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #0f1419; border-radius: 8px; cursor: pointer; margin-bottom: 12px;';
    header.innerHTML = `
        <span style="color: #00ff88; font-weight: 600; font-size: 16px;">${label}</span>
        <span style="color: #8892a6;">${eventsList.length} events • ▼</span>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'display: block;';
    
    // Display each event in this series
    eventsList.forEach(eventData => {
        displayEventCard(eventData, content);
    });
    
    header.addEventListener('click', () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        header.querySelector('span:last-child').innerHTML = `${eventsList.length} events • ${isHidden ? '▲' : '▼'}`;
    });
    
    seriesSection.appendChild(header);
    seriesSection.appendChild(content);
    container.appendChild(seriesSection);
}

// Display an event card (e.g., a specific game with its markets)
function displayEventCard(eventData, container) {
    const card = document.createElement('div');
    card.style.cssText = 'background: #1a1f2e; border: 1px solid #2a3447; border-radius: 12px; padding: 20px; margin-bottom: 16px;';
    
    card.innerHTML = `
        <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 12px;">
            🏀 ${eventData.teamNames}
        </div>
    `;
    
    // Display each market as a contract card
    const marketsContainer = document.createElement('div');
    marketsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 12px;';
    
    eventData.markets.forEach(market => {
        marketsContainer.appendChild(createMarketCard(market));
    });
    
    card.appendChild(marketsContainer);
    container.appendChild(card);
}

// Create a Market Card (Binary Financial Contract)
// Shows YES and NO contracts with bid/ask/last pricing
function createMarketCard(market) {
    const card = document.createElement('div');
    card.style.cssText = 'background: #0f1419; border: 1px solid #2a3447; border-radius: 8px; padding: 16px;';
    
    // Contract pricing (normalized to 0-100 probability scale)
    const yesBid = market.yes_bid || 0;
    const yesAsk = market.yes_ask || 0;
    const yesLast = market.last_price || Math.round((yesBid + yesAsk) / 2);
    
    const noBid = market.no_bid || 0;
    const noAsk = market.no_ask || 0;
    const noLast = 100 - yesLast;
    
    // Volume and liquidity metrics
    const volume = market.volume || 0;
    const openInterest = market.open_interest || 0;
    const liquidity = market.liquidity || 0;
    
    card.innerHTML = `
        <div style="margin-bottom: 12px;">
            <div style="font-size: 14px; color: #ffffff; font-weight: 500; margin-bottom: 4px;">${market.title}</div>
            <div style="font-size: 11px; color: #8892a6;">${market.ticker}</div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <!-- YES Contract -->
            <div class="price-box yes" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="yes" data-price="${yesAsk}" style="background: rgba(0, 255, 136, 0.1); border: 1px solid #00ff88; border-radius: 6px; padding: 12px; cursor: pointer;">
                <div style="font-size: 11px; color: #00ff88; font-weight: 600; margin-bottom: 6px;">YES</div>
                <div style="font-size: 24px; color: #00ff88; font-weight: 700; margin-bottom: 4px;">${yesLast}¢</div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #8892a6;">
                    <span>Bid: ${yesBid}¢</span>
                    <span>Ask: ${yesAsk}¢</span>
                </div>
            </div>
            
            <!-- NO Contract -->
            <div class="price-box no" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="no" data-price="${noAsk}" style="background: rgba(255, 68, 68, 0.1); border: 1px solid #ff4444; border-radius: 6px; padding: 12px; cursor: pointer;">
                <div style="font-size: 11px; color: #ff4444; font-weight: 600; margin-bottom: 6px;">NO</div>
                <div style="font-size: 24px; color: #ff4444; font-weight: 700; margin-bottom: 4px;">${noLast}¢</div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #8892a6;">
                    <span>Bid: ${noBid}¢</span>
                    <span>Ask: ${noAsk}¢</span>
                </div>
            </div>
        </div>
        
        <!-- Market Metrics -->
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #8892a6; margin-bottom: 10px;">
            <span>📊 Vol: ${volume}</span>
            <span>💰 OI: ${openInterest}</span>
            <span>💧 Liq: ${liquidity}</span>
        </div>
        
        <button onclick="viewOrderbook('${market.ticker}')" style="width: 100%; padding: 8px; background: #2a3447; color: #00ff88; border: 1px solid #3a4457; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
            📊 View Order Book
        </button>
    `;
    
    // Add click handlers for trading
    setTimeout(() => {
        const yesBox = card.querySelector('.price-box.yes');
        const noBox = card.querySelector('.price-box.no');
        if (yesBox) yesBox.addEventListener('click', (e) => {
            e.stopPropagation();
            openBotModal(market, 'yes', yesAsk);
        });
        if (noBox) noBox.addEventListener('click', (e) => {
            e.stopPropagation();
            openBotModal(market, 'no', noAsk);
        });
    }, 0);
    
    return card;
}

// Parse team names from game ID (e.g., "26FEB27DENOKC" -> "DEN vs OKC")
function parseTeamNames(gameId) {
    // Game ID format: YYMMMDDTEAM1TEAM2 (e.g., 26FEB27DENOKC)
    // Extract last part (team codes)
    const match = gameId.match(/[A-Z]{6,}$/);
    if (match) {
        const teams = match[0];
        // Split into 3-letter team codes
        const team1 = teams.substring(0, 3);
        const team2 = teams.substring(3, 6);
        return `${team1} vs ${team2}`;
    }
    return gameId;
}

// Display a single game card with expandable props
function displayGameCard(gameData, container) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.style.cssText = 'background: #1a1f2e; border: 1px solid #2a3447; border-radius: 12px; padding: 20px; margin-bottom: 20px; grid-column: 1 / -1;';
    
    // Main game market
    if (gameData.gameMarket) {
        const market = gameData.gameMarket;
        const yesPrice = market.yes_ask || market.yes_bid || 50;
        const noPrice = market.no_ask || market.no_bid || (100 - yesPrice);
        
        card.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 8px;">
                    🏀 ${gameData.teamNames}
                </div>
                <div style="font-size: 13px; color: #8892a6; margin-bottom: 8px;">${market.title || gameData.id}</div>
                <div style="display: flex; gap: 12px; margin-bottom: 12px;">
                    <div class="price-box yes" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="yes" data-price="${yesPrice}" style="flex: 1; cursor: pointer; position: relative;">
                        <div class="label">YES</div>
                        <div class="price">${yesPrice}¢</div>
                        <div style="font-size: 10px; color: #8892a6; margin-top: 4px;">Bid: ${market.yes_bid || 0}¢ | Ask: ${market.yes_ask || 0}¢</div>
                    </div>
                    <div class="price-box no" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="no" data-price="${noPrice}" style="flex: 1; cursor: pointer; position: relative;">
                        <div class="label">NO</div>
                        <div class="price">${noPrice}¢</div>
                        <div style="font-size: 10px; color: #8892a6; margin-top: 4px;">Bid: ${market.no_bid || 0}¢ | Ask: ${market.no_ask || 0}¢</div>
                    </div>
                </div>
                <button onclick="viewOrderbook('${market.ticker}')" style="width: 100%; padding: 8px; background: #2a3447; color: #00ff88; border: 1px solid #3a4457; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">📊 View Orderbook</button>
            </div>
        `;
        
        // Add click handlers for main game
        setTimeout(() => {
            const yesBox = card.querySelector('.price-box.yes');
            const noBox = card.querySelector('.price-box.no');
            if (yesBox) yesBox.addEventListener('click', () => openBotModal(market, 'yes', yesPrice));
            if (noBox) noBox.addEventListener('click', () => openBotModal(market, 'no', noPrice));
        }, 0);
    } else {
        // No main game market, just show team names
        card.innerHTML = `
            <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 15px;">
                🏀 ${gameData.teamNames}
            </div>
        `;
    }
    
    // Add spread and total markets if they exist
    const mainMarketsContainer = document.createElement('div');
    mainMarketsContainer.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;';
    
    if (gameData.spreadMarket) {
        mainMarketsContainer.appendChild(createMainMarketBox(gameData.spreadMarket, '📊 Spread'));
    }
    
    if (gameData.totalMarket) {
        mainMarketsContainer.appendChild(createMainMarketBox(gameData.totalMarket, '🎯 Total'));
    }
    
    if (gameData.spreadMarket || gameData.totalMarket) {
        card.appendChild(mainMarketsContainer);
    }
    
    // Add player props sections
    const propsContainer = document.createElement('div');
    propsContainer.style.cssText = 'border-top: 1px solid #2a3447; padding-top: 15px;';
    
    const propCategories = [
        { key: 'points', label: '📈 Points', icon: 'PTS' },
        { key: 'rebounds', label: '🏐 Rebounds', icon: 'REB' },
        { key: 'assists', label: '🤝 Assists', icon: 'AST' },
        { key: 'threes', label: '🎯 3-Pointers', icon: '3PT' },
        { key: 'other', label: '📊 Other Props', icon: '' }
    ];
    
    propCategories.forEach(category => {
        const props = gameData.playerProps[category.key];
        if (props && props.length > 0) {
            const section = createPropsSection(category.label, props, gameData.id);
            propsContainer.appendChild(section);
        }
    });
    
    card.appendChild(propsContainer);
    container.appendChild(card);
}

// Create a collapsible props section
function createPropsSection(title, markets, gameId) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 12px;';
    
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #0f1419; border-radius: 8px; cursor: pointer; margin-bottom: 8px;';
    header.innerHTML = `
        <span style="color: #00ff88; font-weight: 600;">${title} (${markets.length})</span>
        <span style="color: #8892a6;">▼</span>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; padding: 0 12px;';
    content.style.display = 'none'; // Start collapsed
    
    markets.forEach(market => {
        const propCard = createPropCard(market);
        content.appendChild(propCard);
    });
    
    header.addEventListener('click', () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'grid' : 'none';
        header.querySelector('span:last-child').textContent = isHidden ? '▲' : '▼';
    });
    
    section.appendChild(header);
    section.appendChild(content);
    return section;
}

// Create a small prop card
function createPropCard(market) {
    const card = document.createElement('div');
    card.style.cssText = 'background: #1a1f2e; border: 1px solid #2a3447; border-radius: 8px; padding: 12px;';
    
    const yesPrice = market.yes_ask || market.yes_bid || 50;
    const noPrice = market.no_ask || market.no_bid || (100 - yesPrice);
    
    card.innerHTML = `
        <div style="font-size: 13px; color: #8892a6; margin-bottom: 8px;">${market.title}</div>
        <div style="display: flex; gap: 8px; margin-bottom: 6px;">
            <div class="price-box yes" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="yes" data-price="${yesPrice}" style="flex: 1; cursor: pointer; padding: 8px;">
                <div class="label" style="font-size: 11px;">YES</div>
                <div class="price" style="font-size: 16px;">${yesPrice}¢</div>
                <div style="font-size: 9px; color: #8892a6; margin-top: 2px;">Bid:${market.yes_bid || 0} Ask:${market.yes_ask || 0}</div>
            </div>
            <div class="price-box no" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="no" data-price="${noPrice}" style="flex: 1; cursor: pointer; padding: 8px;">
                <div class="label" style="font-size: 11px;">NO</div>
                <div class="price" style="font-size: 16px;">${noPrice}¢</div>
                <div style="font-size: 9px; color: #8892a6; margin-top: 2px;">Bid:${market.no_bid || 0} Ask:${market.no_ask || 0}</div>
            </div>
        </div>
        <button onclick="viewOrderbook('${market.ticker}')" style="width: 100%; padding: 4px; background: #2a3447; color: #00ff88; border: 1px solid #3a4457; border-radius: 4px; cursor: pointer; font-size: 10px;">📊</button>
    `;
    
    // Add click handlers
    setTimeout(() => {
        const yesBox = card.querySelector('.price-box.yes');
        const noBox = card.querySelector('.price-box.no');
        if (yesBox) yesBox.addEventListener('click', () => openBotModal(market, 'yes', yesPrice));
        if (noBox) noBox.addEventListener('click', () => openBotModal(market, 'no', noPrice));
    }, 0);
    
    return card;
}

// Create a main market box (spread/total)
function createMainMarketBox(market, label) {
    const box = document.createElement('div');
    box.style.cssText = 'background: #0f1419; border: 1px solid #2a3447; border-radius: 8px; padding: 12px;';
    
    const yesPrice = market.yes_ask || market.yes_bid || 50;
    const noPrice = market.no_ask || market.no_bid || (100 - yesPrice);
    
    box.innerHTML = `
        <div style="font-size: 12px; color: #00ff88; font-weight: 600; margin-bottom: 8px;">${label}</div>
        <div style="font-size: 13px; color: #8892a6; margin-bottom: 8px;">${market.title}</div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div class="price-box yes" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="yes" data-price="${yesPrice}" style="flex: 1; cursor: pointer; padding: 8px;">
                <div class="label" style="font-size: 11px;">YES</div>
                <div class="price" style="font-size: 16px;">${yesPrice}¢</div>
                <div style="font-size: 9px; color: #8892a6; margin-top: 2px;">B:${market.yes_bid || 0} A:${market.yes_ask || 0}</div>
            </div>
            <div class="price-box no" data-market='${JSON.stringify(market).replace(/"/g, '&quot;')}' data-side="no" data-price="${noPrice}" style="flex: 1; cursor: pointer; padding: 8px;">
                <div class="label" style="font-size: 11px;">NO</div>
                <div class="price" style="font-size: 16px;">${noPrice}¢</div>
                <div style="font-size: 9px; color: #8892a6; margin-top: 2px;">B:${market.no_bid || 0} A:${market.no_ask || 0}</div>
            </div>
        </div>
        <button onclick="viewOrderbook('${market.ticker}')" style="width: 100%; padding: 6px; background: #2a3447; color: #00ff88; border: 1px solid #3a4457; border-radius: 4px; cursor: pointer; font-size: 11px;">📊 Orderbook</button>
    `;
    
    // Add click handlers
    setTimeout(() => {
        const yesBox = box.querySelector('.price-box.yes');
        const noBox = box.querySelector('.price-box.no');
        if (yesBox) yesBox.addEventListener('click', () => openBotModal(market, 'yes', yesPrice));
        if (noBox) noBox.addEventListener('click', () => openBotModal(market, 'no', noPrice));
    }, 0);
    
    return box;
}

// Search functionality
function setupSearch() {
    const searchBox = document.getElementById('search-box');
    searchBox.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        if (query === '') {
            loadMarkets(); // Reload to get all markets
            return;
        }
        
        const filtered = allMarkets.filter(m => {
            const title = (m.title || '').toLowerCase();
            const ticker = (m.ticker || '').toLowerCase();
            const series = (m.series_ticker || '').toLowerCase();
            
            return title.includes(query) || ticker.includes(query) || series.includes(query);
        });
        
        console.log(`Search for "${query}" found ${filtered.length} markets`);
        displayMarkets(filtered);
    });
}

// Load recently closed games
async function loadRecentGames() {
    const grid = document.getElementById('markets-grid');
    grid.innerHTML = '<p style="color: #00ff88; grid-column: 1 / -1;">Loading recently closed games...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/markets?status=closed&limit=500`);
        const data = await response.json();
        
        if (data.error) {
            grid.innerHTML = `<p style="color: #ff4444; grid-column: 1 / -1;">Error: ${data.error}</p>`;
            return;
        }
        
        allMarkets = data.markets || data;
        console.log(`Loaded ${allMarkets.length} closed markets`);
        
        if (allMarkets.length === 0) {
            grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">No closed markets found</p>';
            return;
        }
        
        displayMarkets(allMarkets);
    } catch (error) {
        console.error('Error loading closed markets:', error);
        grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">Network error loading closed markets</p>';
    }
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

// View orderbook for a market
async function viewOrderbook(ticker) {
    try {
        const response = await fetch(`${API_BASE}/orderbook/${ticker}`);
        const data = await response.json();
        
        if (data.error) {
            alert('Error fetching orderbook: ' + data.error);
            return;
        }
        
        // Display orderbook in modal
        const orderbook = data.orderbook || data;
        const yesOrders = orderbook.yes || [];
        const noOrders = orderbook.no || [];
        
        let orderbookHtml = `
            <div style="background: #1a1f2e; padding: 20px; border-radius: 12px; max-width: 600px; color: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #00ff88;">📊 Orderbook: ${ticker}</h2>
                    <button onclick="closeOrderbookModal()" style="background: #ff4444; border: none; color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Close</button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h3 style="color: #00ff88; margin-bottom: 10px;">YES Orders</h3>
                        <div style="background: #0f1419; padding: 10px; border-radius: 8px;">
                            ${yesOrders.length > 0 ? yesOrders.map(order => `
                                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2a3447;">
                                    <span style="color: #00ff88;">${order.price}¢</span>
                                    <span style="color: #8892a6;">${order.quantity} contracts</span>
                                </div>
                            `).join('') : '<p style="color: #8892a6;">No orders</p>'}
                        </div>
                    </div>
                    
                    <div>
                        <h3 style="color: #ff4444; margin-bottom: 10px;">NO Orders</h3>
                        <div style="background: #0f1419; padding: 10px; border-radius: 8px;">
                            ${noOrders.length > 0 ? noOrders.map(order => `
                                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2a3447;">
                                    <span style="color: #ff4444;">${order.price}¢</span>
                                    <span style="color: #8892a6;">${order.quantity} contracts</span>
                                </div>
                            `).join('') : '<p style="color: #8892a6;">No orders</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'orderbook-modal';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;';
        overlay.innerHTML = orderbookHtml;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeOrderbookModal();
        };
        
        document.body.appendChild(overlay);
    } catch (error) {
        console.error('Error fetching orderbook:', error);
        alert('Error fetching orderbook: ' + error.message);
    }
}

function closeOrderbookModal() {
    const modal = document.getElementById('orderbook-modal');
    if (modal) modal.remove();
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
        
        if (!data.error && data.balance !== undefined) {
            document.getElementById('balance-display').style.display = 'flex';
            // API returns dollars, not cents - use directly
            document.getElementById('balance-amount').textContent = `$${data.balance.toFixed(2)}`;
            document.getElementById('portfolio-value').textContent = `$${(data.portfolio_value || 0).toFixed(2)}`;
            console.log('Balance loaded:', data);
        } else {
            console.log('Balance not loaded:', data.error);
        }
    } catch (error) {
        console.log('Balance fetch error:', error);
    }
}

// Show notification
function showNotification(message) {
    // Simple alert for now - could be replaced with toast notifications
    alert(message);
}
