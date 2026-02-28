// Kalshi Basketball Trader - New Frontend
const API_BASE = 'http://localhost:5001/api';
let allMarkets = [];
let autoMonitorInterval = null;
let liveScoresInterval = null;
let selectedMarket = null;
let selectedSide = null;
let currentSportFilter = 'all';
let liveGames = {}; // keyed by team abbreviation pairs for quick lookup

// Price helper: handles both new _dollars string fields and legacy integer cents fields
// (Kalshi deprecated integer cent fields in late 2025)
function getPrice(market, field) {
    const dollarsKey = field + '_dollars';
    if (market[dollarsKey] !== undefined && market[dollarsKey] !== null && market[dollarsKey] !== '') {
        return Math.round(parseFloat(market[dollarsKey]) * 100);
    }
    return market[field] || 0;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    autoLogin();
    loadLiveScores();
    // Refresh live scores every 30 seconds
    liveScoresInterval = setInterval(loadLiveScores, 30000);
});

// ─── LIVE SCORES ──────────────────────────────────────────────────────────────

async function loadLiveScores() {
    try {
        // Fetch NBA + NFL in parallel (most common sports on Kalshi)
        const [nbaRes, nflRes] = await Promise.allSettled([
            fetch(`${API_BASE}/scoreboard/nba`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/nfl`).then(r => r.json()),
        ]);

        const games = [];
        if (nbaRes.status === 'fulfilled' && nbaRes.value.events) {
            games.push(...nbaRes.value.events.map(e => parseESPNGame(e, 'NBA')));
        }
        if (nflRes.status === 'fulfilled' && nflRes.value.events) {
            games.push(...nflRes.value.events.map(e => parseESPNGame(e, 'NFL')));
        }

        // Build lookup table for marking Kalshi market cards as live
        liveGames = {};
        games.forEach(g => {
            if (g.state === 'in') {
                liveGames[g.awayAbbr] = g;
                liveGames[g.homeAbbr] = g;
            }
        });

        renderLiveScoresBar(games);
    } catch (e) {
        console.log('Live scores unavailable:', e);
    }
}

function parseESPNGame(event, sport) {
    const comp = (event.competitions || [])[0] || {};
    const competitors = comp.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home') || {};
    const away = competitors.find(c => c.homeAway === 'away') || {};
    const status = event.status || {};
    const statusType = status.type || {};

    return {
        sport,
        name: event.shortName || event.name || '',
        homeAbbr: (home.team || {}).abbreviation || '',
        awayAbbr: (away.team || {}).abbreviation || '',
        homeScore: home.score || '0',
        awayScore: away.score || '0',
        state: statusType.state || 'pre',       // 'pre' | 'in' | 'post'
        clock: status.displayClock || '',
        period: status.period || 0,
        periodLabel: statusType.shortDetail || '',
    };
}

function renderLiveScoresBar(games) {
    const bar = document.getElementById('live-scores-bar');
    const content = document.getElementById('live-scores-content');
    if (!bar || !content) return;

    // Only show live/recent games
    const visible = games.filter(g => g.state === 'in' || g.state === 'post');
    if (visible.length === 0) { bar.style.display = 'none'; return; }

    bar.style.display = 'block';
    content.innerHTML = visible.map(g => {
        const isLive = g.state === 'in';
        const liveTag = isLive ? `<span style="color:#ff3333;font-size:10px;font-weight:700;">● LIVE</span>` : '';
        const clockTag = isLive && g.clock ? `<span class="clock">${g.periodLabel || 'Q'+g.period} ${g.clock}</span>` : `<span class="final">Final</span>`;
        return `<div class="live-chip ${isLive ? 'live' : ''}">
            ${liveTag}
            <span class="teams">${g.awayAbbr} ${g.awayScore} – ${g.homeScore} ${g.homeAbbr}</span>
            ${clockTag}
        </div>`;
    }).join('');
}

// ─── SPORT FILTER ─────────────────────────────────────────────────────────────

function filterBySport(sport) {
    currentSportFilter = sport;

    // Update pill active state
    document.querySelectorAll('.sport-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.sport === sport);
    });

    applyFilters();
}

function applyFilters() {
    const query = (document.getElementById('search-box')?.value || '').toLowerCase();
    let filtered = allMarkets;

    // Sport filter
    if (currentSportFilter !== 'all') {
        filtered = filtered.filter(m => {
            const et = ((m.event_ticker || '') + (m.series_ticker || '') + (m.ticker || '')).toUpperCase();
            switch (currentSportFilter) {
                case 'nba':   return et.includes('NBA');
                case 'nfl':   return et.includes('NFL') || et.includes('NFLG');
                case 'mlb':   return et.includes('MLB') || et.includes('KXMLB');
                case 'nhl':   return et.includes('NHL') || et.includes('KXNHL');
                case 'ncaab': return et.includes('NCAAB') || et.includes('KXNCAA');
                case 'other': return !et.includes('NBA') && !et.includes('NFL') && !et.includes('MLB') && !et.includes('NHL') && !et.includes('NCAA');
                default: return true;
            }
        });
    }

    // Search filter
    if (query) {
        filtered = filtered.filter(m => {
            const title  = (m.title || '').toLowerCase();
            const ticker = (m.ticker || '').toLowerCase();
            const series = (m.series_ticker || '').toLowerCase();
            return title.includes(query) || ticker.includes(query) || series.includes(query);
        });
    }

    displayMarkets(filtered);
}

// ─── LIVE BADGE on game event rows ────────────────────────────────────────────

function getLiveScoreForGame(gameId) {
    // gameId example: "26FEB27DENOKC" — last 6 chars are team codes
    const match = gameId.match(/([A-Z]{3})([A-Z]{3})$/);
    if (!match) return null;
    const [, t1, t2] = match;
    return liveGames[t1] || liveGames[t2] || null;
}

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

            await loadBalance();
            await loadBots();
            await loadPnL();
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
        
        applyFilters(); // respect current sport pill + search when displaying
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
    const liveScore = getLiveScoreForGame(eventData.gameId);
    const isLive = !!liveScore;

    const card = document.createElement('div');
    card.style.cssText = `background: #1a1f2e; border: 1px solid ${isLive ? '#00ff88' : '#2a3447'}; border-radius: 8px; padding: 16px; margin-bottom: 12px;`;

    // Event header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a3447;';

    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'font-size: 15px; font-weight: 600; color: #ffffff;';
    titleSpan.textContent = `🏀 ${eventData.eventTitle}`;
    header.appendChild(titleSpan);

    if (isLive) {
        const scoreBadge = document.createElement('span');
        scoreBadge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#0f1a0f;border:1px solid #00ff88;border-radius:6px;padding:3px 10px;font-size:12px;white-space:nowrap;';
        const score = liveScore;
        const clock = score.clock ? `${score.periodLabel || 'Q'+score.period} ${score.clock}` : 'Final';
        scoreBadge.innerHTML = `<span style="color:#ff3333;font-size:10px;font-weight:700;">● LIVE</span>
            <span style="color:#fff;font-weight:700;">${score.awayAbbr} ${score.awayScore}–${score.homeScore} ${score.homeAbbr}</span>
            <span style="color:#8892a6;font-size:10px;">${clock}</span>`;
        header.appendChild(scoreBadge);
    }

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
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const yesPrice = yesAsk || yesBid || Math.round((yesBid + yesAsk) / 2);
    const yesStyle = getPriceButtonStyle(yesPrice, 'yes');
    
    const yesBtn = document.createElement('button');
    yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${yesStyle}`;
    yesBtn.innerHTML = `<div>${yesPrice}¢</div><div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">YES</div>`;
    yesBtn.onclick = () => openBotModal(market, 'yes', yesAsk);
    yesBtn.onmouseenter = () => yesBtn.style.transform = 'scale(1.05)';
    yesBtn.onmouseleave = () => yesBtn.style.transform = 'scale(1)';
    
    // NO button
    const noBid = getPrice(market, 'no_bid');
    const noAsk = getPrice(market, 'no_ask');
    const noPrice = noAsk || noBid || (100 - yesPrice);
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

        // Kalshi returns { orderbook: { yes: [[p,q],...], no: [[p,q],...] } }
        displayOrderbookLadder(data);
    } catch (error) {
        console.error('Error fetching orderbook:', error);
        document.getElementById('orderbook-ladder').innerHTML = `<p style="color: #ff4444;">Network error</p>`;
    }
}

// Parse a single orderbook level — Kalshi returns [price, qty] arrays
function parseOrderLevel(level) {
    if (Array.isArray(level)) return { price: level[0], qty: level[1] };
    return { price: level.price || level[0], qty: level.quantity || level.qty || level[1] };
}

function displayOrderbookLadder(orderbook) {
    // Handle nested { orderbook: { yes: [...], no: [...] } } wrapper
    const ob = orderbook.orderbook || orderbook;
    const yesOrders = (ob.yes || []).slice().reverse(); // best bid first (highest price)
    const noOrders = (ob.no || []).slice().reverse();

    // Derive implied ask prices: YES ask = 100 - best NO bid; NO ask = 100 - best YES bid
    const bestYesBid = yesOrders.length ? parseOrderLevel(yesOrders[0]).price : null;
    const bestNoBid  = noOrders.length  ? parseOrderLevel(noOrders[0]).price  : null;
    const impliedYesAsk = bestNoBid  != null ? (100 - bestNoBid)  : null;
    const impliedNoAsk  = bestYesBid != null ? (100 - bestYesBid) : null;

    const renderRow = (level, color, bg) => {
        const { price, qty } = parseOrderLevel(level);
        return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; background: ${bg}; border-left: 3px solid ${color}; border-radius: 4px;">
            <span style="color: ${color}; font-weight: 700; font-size: 14px;">${price}¢</span>
            <span style="color: #8892a6; font-size: 12px;">${qty} contracts</span>
        </div>`;
    };

    const ladderHtml = `
        <div style="background: #1a1f2e; border-radius: 8px; padding: 16px;">
            ${impliedYesAsk != null ? `<div style="text-align:center; padding: 6px; background: rgba(0,255,136,0.08); border-radius:6px; margin-bottom:12px; font-size:12px; color:#8892a6;">
                Best YES ask <span style="color:#00ff88;font-weight:700;">${impliedYesAsk}¢</span> &nbsp;|&nbsp; Best NO ask <span style="color:#ff4444;font-weight:700;">${impliedNoAsk != null ? impliedNoAsk+'¢' : '—'}</span>
            </div>` : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                <div>
                    <div style="font-size: 11px; font-weight: 700; color: #00ff88; margin-bottom: 8px; letter-spacing:.05em;">YES BIDS</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${yesOrders.length > 0 ? yesOrders.map(o => renderRow(o, '#00ff88', 'rgba(0,255,136,0.05)')).join('') : '<p style="color:#8892a6;text-align:center;padding:16px;font-size:12px;">No bids</p>'}
                    </div>
                </div>
                <div>
                    <div style="font-size: 11px; font-weight: 700; color: #ff4444; margin-bottom: 8px; letter-spacing:.05em;">NO BIDS</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${noOrders.length > 0 ? noOrders.map(o => renderRow(o, '#ff4444', 'rgba(255,68,68,0.05)')).join('') : '<p style="color:#8892a6;text-align:center;padding:16px;font-size:12px;">No bids</p>'}
                    </div>
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
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const yesLast = getPrice(market, 'last_price') || yesAsk || Math.round((yesBid + yesAsk) / 2);

    const noBid = getPrice(market, 'no_bid');
    const noAsk = getPrice(market, 'no_ask');
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

    const yesPrice = getPrice(market, 'yes_ask') || getPrice(market, 'yes_bid') || 50;
    const noPrice  = getPrice(market, 'no_ask')  || getPrice(market, 'no_bid')  || (100 - yesPrice);
    
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

    const yesPrice = getPrice(market, 'yes_ask') || getPrice(market, 'yes_bid') || 50;
    const noPrice  = getPrice(market, 'no_ask')  || getPrice(market, 'no_bid')  || (100 - yesPrice);
    
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

// Search functionality (delegates to applyFilters to respect sport pill too)
function setupSearch() {
    const searchBox = document.getElementById('search-box');
    if (!searchBox) return;
    searchBox.addEventListener('input', () => applyFilters());
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

        applyFilters();
    } catch (error) {
        console.error('Error loading closed markets:', error);
        grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">Network error loading closed markets</p>';
    }
}

// ─── Dual Arb Bot Logic ───────────────────────────────────────────────────────

let currentArbMarket = null;

/**
 * Calculate optimal YES and NO limit-buy prices that guarantee `width` cents profit.
 *
 * Strategy: post at the current best bid on each side so we sit first in the
 * maker queue. YES bid + NO bid must equal (100 - width).
 *
 *   YES target = yes_bid  (match best bid, be first in queue)
 *   NO  target = (100 - width) - YES target
 *
 * If the resulting NO price < 1¢, push YES down until NO is valid.
 */
function calculateArbPrices(market, width) {
    const yesBid = getPrice(market, 'yes_bid') || 50;
    const noBid  = getPrice(market, 'no_bid')  || 50;
    const yesAsk = getPrice(market, 'yes_ask') || 50;
    const noAsk  = getPrice(market, 'no_ask')  || 50;

    const targetTotal = 100 - width;          // e.g. width=5 → 95¢ total

    // Upgrade #2: Queue priority — post at bid+1 to be first in line.
    // Only go above bid if bid+1 is still below the ask (stays maker, not taker).
    const queueYes = (yesAsk > yesBid + 1) ? yesBid + 1 : yesBid;
    const queueNo  = (noAsk  > noBid  + 1) ? noBid  + 1 : noBid;
    let targetYes = Math.max(queueYes, 1);
    let targetNo  = targetTotal - targetYes;

    // Clamp NO into a valid range
    if (targetNo < 1)  { targetNo = 1;  targetYes = targetTotal - 1; }
    if (targetNo > 98) { targetNo = 98; targetYes = targetTotal - 98; }
    targetYes = Math.max(1, Math.min(targetYes, 98));

    return {
        targetYes, targetNo,
        total:   targetYes + targetNo,
        profit:  100 - (targetYes + targetNo),
        yesBid, noBid, yesAsk, noAsk,
    };
}

/** Open the dual-arb modal for any market (called when clicking YES or NO price button) */
function openBotModal(market, _side, _price) {
    currentArbMarket = market;

    // Market info header
    document.getElementById('bot-market-title').textContent = market.title;
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const noBid  = getPrice(market, 'no_bid');
    const noAsk  = getPrice(market, 'no_ask');
    document.getElementById('bot-market-prices').textContent =
        `YES  Bid ${yesBid}¢ / Ask ${yesAsk}¢     NO  Bid ${noBid}¢ / Ask ${noAsk}¢`;

    // Upgrade #5: Auto-tune width from combined spread (wider spread = less liquid = wider arb needed)
    const spreadSum  = Math.max(0, (yesAsk - yesBid) + (noAsk - noBid));
    const autoWidth  = Math.max(3, Math.min(15, Math.round(spreadSum / 2) || 5));
    document.getElementById('bot-arb-width').value = autoWidth;

    recalcArbPrices();
    document.getElementById('bot-modal').classList.add('show');
}

/** Recalculate YES/NO limit prices whenever the arb-width changes */
function recalcArbPrices() {
    if (!currentArbMarket) return;
    const width = parseInt(document.getElementById('bot-arb-width').value) || 5;
    document.getElementById('width-display').textContent = `${width}¢`;

    const { targetYes, targetNo } = calculateArbPrices(currentArbMarket, width);
    document.getElementById('bot-yes-price').value = targetYes;
    document.getElementById('bot-no-price').value  = targetNo;
    updateProfitPreview();
}

/** Called when user manually edits YES or NO price — sync width display */
function onPriceManualChange() {
    const yes = parseInt(document.getElementById('bot-yes-price').value) || 0;
    const no  = parseInt(document.getElementById('bot-no-price').value)  || 0;
    const profit = 100 - yes - no;
    document.getElementById('width-display').textContent = `${profit}¢`;
    updateProfitPreview();
}

/** Render the live profit/cost preview box */
function updateProfitPreview() {
    const yes    = parseInt(document.getElementById('bot-yes-price').value) || 0;
    const no     = parseInt(document.getElementById('bot-no-price').value)  || 0;
    const qty    = parseInt(document.getElementById('bot-quantity').value)  || 1;
    const total  = yes + no;
    const profit = 100 - total;
    const isArb  = profit > 0;
    const dollarProfit = (profit * qty / 100).toFixed(2);

    document.getElementById('profit-preview').innerHTML = `
        <div style="padding:10px 14px;border-radius:8px;border:2px solid ${isArb ? '#00ff88' : '#ff4444'};background:${isArb ? 'rgba(0,255,136,0.07)' : 'rgba(255,68,68,0.07)'};text-align:center;">
            <div style="font-size:11px;color:#8892a6;margin-bottom:4px;">Total cost: ${total}¢ per contract &nbsp;|&nbsp; Settlement value: 100¢</div>
            <div style="font-size:1.6rem;font-weight:800;color:${isArb ? '#00ff88' : '#ff4444'};">
                ${isArb ? '+' : ''}${profit}¢ / contract
            </div>
            <div style="font-size:12px;margin-top:4px;color:${isArb ? '#00ff88' : '#ff4444'};">
                ${isArb
                    ? `✅ ${qty} contract${qty > 1 ? 's' : ''} → <strong>+$${dollarProfit}</strong> locked profit at settlement`
                    : `❌ Not an arb — total ≥ 100¢ (adjust width or prices)`}
            </div>
            ${isArb ? `<div style="font-size:10px;color:#8892a6;margin-top:6px;">Both limit orders post as market-maker bids — fills from natural volatility</div>` : ''}
        </div>`;
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
        
        // Kalshi returns { orderbook: { yes: [[p,q],...], no: [[p,q],...] } }
        const ob = data.orderbook || data;
        const yesOrders = (ob.yes || []).slice().reverse(); // best bid first
        const noOrders  = (ob.no  || []).slice().reverse();

        const bestYesBid = yesOrders.length ? parseOrderLevel(yesOrders[0]).price : null;
        const bestNoBid  = noOrders.length  ? parseOrderLevel(noOrders[0]).price  : null;
        const impliedYesAsk = bestNoBid  != null ? 100 - bestNoBid  : '—';
        const impliedNoAsk  = bestYesBid != null ? 100 - bestYesBid : '—';

        const renderModalRow = (level, color) => {
            const { price, qty } = parseOrderLevel(level);
            return `<div style="display:flex;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #2a3447;">
                <span style="color:${color};font-weight:600;">${price}¢</span>
                <span style="color:#8892a6;">${qty} contracts</span>
            </div>`;
        };

        let orderbookHtml = `
            <div style="background: #1a1f2e; padding: 20px; border-radius: 12px; max-width: 640px; width: 95vw; color: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h2 style="margin: 0; color: #00ff88; font-size: 16px;">📊 Order Book: ${ticker}</h2>
                    <button onclick="closeOrderbookModal()" style="background: #ff4444; border: none; color: white; padding: 6px 14px; border-radius: 6px; cursor: pointer;">✕ Close</button>
                </div>
                <div style="text-align:center;padding:8px;background:rgba(0,255,136,0.06);border-radius:6px;margin-bottom:14px;font-size:13px;color:#8892a6;">
                    Buy YES: <strong style="color:#00ff88;">${typeof impliedYesAsk === 'number' ? impliedYesAsk+'¢' : impliedYesAsk}</strong>
                    &nbsp;|&nbsp;
                    Buy NO: <strong style="color:#ff4444;">${typeof impliedNoAsk === 'number' ? impliedNoAsk+'¢' : impliedNoAsk}</strong>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <div style="color:#00ff88;font-weight:700;font-size:12px;margin-bottom:8px;letter-spacing:.05em;">YES BIDS</div>
                        <div style="background: #0f1419; padding: 8px; border-radius: 8px; max-height: 320px; overflow-y: auto;">
                            ${yesOrders.length > 0 ? yesOrders.map(o => renderModalRow(o, '#00ff88')).join('') : '<p style="color:#8892a6;text-align:center;padding:12px;">No bids</p>'}
                        </div>
                    </div>
                    <div>
                        <div style="color:#ff4444;font-weight:700;font-size:12px;margin-bottom:8px;letter-spacing:.05em;">NO BIDS</div>
                        <div style="background: #0f1419; padding: 8px; border-radius: 8px; max-height: 320px; overflow-y: auto;">
                            ${noOrders.length > 0 ? noOrders.map(o => renderModalRow(o, '#ff4444')).join('') : '<p style="color:#8892a6;text-align:center;padding:12px;">No bids</p>'}
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

// Place both limit orders and register the bot
async function createBot() {
    if (!currentArbMarket) { alert('No market selected'); return; }

    const yes_price       = parseInt(document.getElementById('bot-yes-price').value);
    const no_price        = parseInt(document.getElementById('bot-no-price').value);
    const quantity        = parseInt(document.getElementById('bot-quantity').value);
    const stop_loss_cents = parseInt(document.getElementById('bot-stop-loss-cents').value);

    if (yes_price + no_price >= 100) {
        alert(`❌ Not an arb — YES(${yes_price}¢) + NO(${no_price}¢) = ${yes_price + no_price}¢ ≥ 100¢\nAdjust prices so total is below 100¢.`);
        return;
    }
    if (!quantity || quantity < 1) { alert('Quantity must be at least 1'); return; }

    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: currentArbMarket.ticker,
                yes_price, no_price, quantity, stop_loss_cents,
            }),
        });
        const data = await resp.json();

        if (data.success) {
            const profit = 100 - yes_price - no_price;
            showNotification(`✅ Orders placed! YES ${yes_price}¢ + NO ${no_price}¢ → ${profit}¢/contract locked at settlement`);
            closeModal();
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

// Load and display active bots
async function loadBots() {
    try {
        const response = await fetch(`${API_BASE}/bot/list`);
        const data = await response.json();
        const bots = data.bots || {};
        const botIds = Object.keys(bots);

        const section = document.getElementById('bots-section');
        if (botIds.length === 0) { section.style.display = 'none'; return; }
        section.style.display = 'block';

        const botsList = document.getElementById('bots-list');
        botsList.innerHTML = '';

        botIds.forEach(botId => {
            const bot = bots[botId];
            const profit = bot.profit_per ?? (100 - (bot.yes_price || 0) - (bot.no_price || 0));
            const qty    = bot.quantity || 1;
            const yFill  = bot.yes_fill_qty || 0;
            const nFill  = bot.no_fill_qty  || 0;

            // Fill progress bars
            const yPct = Math.round((yFill / qty) * 100);
            const nPct = Math.round((nFill / qty) * 100);

            const ageMin      = bot.posted_at ? Math.floor((Date.now() / 1000 - bot.posted_at) / 60) : 0;
            const repostCount = bot.repost_count || 0;
            const statusLabel = (bot.status || '').replace(/_/g, ' ').toUpperCase();
            const statusClass = {
                pending_fills: 'monitoring',
                yes_filled:    'leg1_filled',
                no_filled:     'leg1_filled',
                completed:     'completed',
                stopped:       'stopped',
            }[bot.status] || 'monitoring';

            const item = document.createElement('div');
            item.className = 'bot-item';
            item.style.flexDirection = 'column';
            item.style.gap = '6px';
            item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <strong style="color:#fff;">${bot.ticker}</strong>
                        <span class="bot-status ${statusClass}" style="margin-left:8px;">${statusLabel}</span>
                        <span style="color:#00ff88;font-weight:700;margin-left:10px;">+${profit}¢/contract</span>
                        <span style="color:#8892a6;font-size:11px;margin-left:6px;">($${(profit * qty / 100).toFixed(2)} total)</span>
                        <span style="color:#555;font-size:10px;margin-left:8px;">${ageMin}m${repostCount > 0 ? ` · ${repostCount} reposts` : ''}</span>
                    </div>
                    <button class="btn btn-secondary" style="padding:.4rem .9rem;font-size:12px;"
                            onclick="cancelBot('${botId}')">Cancel</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                    <div>
                        <div style="display:flex;justify-content:space-between;color:#8892a6;margin-bottom:3px;">
                            <span>YES limit @ ${bot.yes_price || '?'}¢</span>
                            <span style="color:#00ff88;">${yFill}/${qty} filled</span>
                        </div>
                        <div style="height:4px;background:#1a1f2e;border-radius:2px;">
                            <div style="height:4px;width:${yPct}%;background:#00ff88;border-radius:2px;transition:width .5s;"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display:flex;justify-content:space-between;color:#8892a6;margin-bottom:3px;">
                            <span>NO limit @ ${bot.no_price || '?'}¢</span>
                            <span style="color:#ff4444;">${nFill}/${qty} filled</span>
                        </div>
                        <div style="height:4px;background:#1a1f2e;border-radius:2px;">
                            <div style="height:4px;width:${nPct}%;background:#ff4444;border-radius:2px;transition:width .5s;"></div>
                        </div>
                    </div>
                </div>`;
            botsList.appendChild(item);
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
        autoMonitorInterval = setInterval(monitorBots, 2000); // Upgrade #1: Check every 2 seconds
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
        
        if (data.success) {
            // Upgrade #1: always refresh fill counts and P&L on every monitor cycle
            loadBots();
            loadPnL();

            if (data.actions && data.actions.length > 0) {
                data.actions.forEach(action => {
                    console.log('Bot action:', action);
                    if (action.action === 'completed') {
                        showNotification(`✅ ARB COMPLETE! +${(action.profit_cents/100).toFixed(2)} profit locked`);
                    } else if (action.action === 'stop_loss_yes') {
                        showNotification(`⚠️ Stop-loss YES on ${action.bot_id} | loss: ${(action.loss_cents/100).toFixed(2)}`);
                    } else if (action.action === 'stop_loss_no') {
                        showNotification(`⚠️ Stop-loss NO on ${action.bot_id} | loss: ${(action.loss_cents/100).toFixed(2)}`);
                    } else if (action.action === 'reposted') {
                        showNotification(`🔄 Reposted stale order: YES ${action.new_yes}¢ / NO ${action.new_no}¢`);
                    } else if (action.action.startsWith('partial_resize')) {
                        showNotification(`📐 Partial fill resize: ${action.bot_id}`);
                    }
                });
            }
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

// ─── Upgrade #3: Multi-Market Arb Scanner ─────────────────────────────────────

async function autoScanMarkets() {
    const minWidth = parseInt(document.getElementById('scan-min-width')?.value || '3');
    showNotification(`🔍 Scanning for arb opportunities ≥ ${minWidth}¢ width...`);
    try {
        const resp = await fetch(`${API_BASE}/bot/scan?min_width=${minWidth}&limit=200`);
        const data = await resp.json();
        if (data.error) { showNotification(`❌ Scan failed: ${data.error}`); return; }
        showScanResults(data.opportunities || [], minWidth);
    } catch (err) {
        showNotification(`❌ Scan error: ${err.message}`);
    }
}

function showScanResults(opportunities, minWidth) {
    const modal   = document.getElementById('scan-modal');
    const results = document.getElementById('scan-results');
    const countEl = document.getElementById('scan-count');
    if (!modal || !results) return;

    if (countEl) countEl.textContent = `${opportunities.length} opportunities found (≥ ${minWidth}¢)`;

    if (opportunities.length === 0) {
        results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">No arb opportunities ≥ ${minWidth}¢ right now.<br>Try lowering the min width.</p>`;
    } else {
        results.innerHTML = opportunities.slice(0, 30).map(opp => {
            const profitColor = opp.width >= 10 ? '#ffaa00' : '#00ff88';
            return `<div style="background:#0a0e1a;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <div style="flex:1;min-width:0;">
                    <div style="color:#fff;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opp.title || opp.ticker}</div>
                    <div style="color:#8892a6;font-size:11px;margin-top:2px;">YES ${opp.yes_bid}¢ + NO ${opp.no_bid}¢ bid &nbsp;|&nbsp; post at YES ${opp.suggested_yes}¢ / NO ${opp.suggested_no}¢</div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                    <span style="color:${profitColor};font-weight:800;font-size:1.3rem;">+${opp.profit_posted}¢</span>
                    <button onclick="quickBot('${opp.ticker}', ${opp.suggested_yes}, ${opp.suggested_no})"
                            style="background:#00ff88;color:#000;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">
                        🤖 Bot
                    </button>
                </div>
            </div>`;
        }).join('');
    }
    modal.classList.add('show');
}

async function quickBot(ticker, yesPrice, noPrice) {
    const quantity       = parseInt(document.getElementById('scan-qty')?.value || '1');
    const stop_loss_cents = 5;
    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, yes_price: yesPrice, no_price: noPrice, quantity, stop_loss_cents }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`✅ Bot placed! ${ticker} YES ${yesPrice}¢ / NO ${noPrice}¢ → +${data.profit_per}¢/contract`);
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            showNotification(`❌ Error: ${data.error}`);
        }
    } catch (err) {
        showNotification(`❌ Network error: ${err.message}`);
    }
}

function closeScanModal() {
    document.getElementById('scan-modal')?.classList.remove('show');
}

// ─── Upgrade #6: P&L Dashboard ────────────────────────────────────────────────

async function loadPnL() {
    try {
        const resp = await fetch(`${API_BASE}/pnl`);
        const pnl  = await resp.json();
        const el   = document.getElementById('pnl-display');
        if (!el) return;

        const net      = pnl.net_dollars ?? 0;
        const netColor = net >= 0 ? '#00ff88' : '#ff4444';
        const gross    = (pnl.gross_profit_cents / 100).toFixed(2);
        const loss     = (pnl.gross_loss_cents / 100).toFixed(2);
        const sessionH = ((Date.now() / 1000 - (pnl.session_start || Date.now() / 1000)) / 3600).toFixed(1);

        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Session P&L</span>
            <span style="color:${netColor};font-weight:800;font-size:1.1rem;">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
            <span style="color:#8892a6;font-size:11px;">↑ $${gross} wins &nbsp; ↓ $${loss} stops</span>
            <span style="color:#8892a6;font-size:11px;">${pnl.completed_bots || 0}W / ${pnl.stopped_bots || 0}L &nbsp; ${sessionH}h</span>
            <button onclick="resetPnL()" style="background:none;border:1px solid #2a3550;color:#8892a6;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:10px;">Reset</button>
        `;
    } catch (e) { /* P&L display is optional */ }
}

async function resetPnL() {
    await fetch(`${API_BASE}/pnl/reset`, { method: 'POST' });
    loadPnL();
}

// Show notification as a non-blocking toast
function showNotification(message) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a1f35;border:1px solid #00ff88;color:#fff;padding:12px 20px;border-radius:10px;z-index:99999;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.5);max-width:340px;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
