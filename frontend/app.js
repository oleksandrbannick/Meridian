// Meridian — Sports Trading Terminal
const API_BASE = 'http://localhost:5001/api';
let allMarkets = [];
let autoMonitorInterval = null;
let liveScoresInterval = null;
let selectedMarket = null;
let selectedSide = null;
let currentSportFilter = 'all';
let currentLiveFilter = false;  // true = show only live games within sport
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
    liveScoresInterval = setInterval(loadLiveScores, 30000);
});

// ─── TAB NAVIGATION ──────────────────────────────────────────────────────────

function switchTab(tab) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    // Show/hide tab pages
    document.querySelectorAll('.tab-page').forEach(p => {
        p.classList.toggle('active', p.id === 'tab-' + tab);
    });
    // Load tab-specific data
    if (tab === 'positions') loadPositions();
    if (tab === 'history') loadTradeHistory();
    if (tab === 'bots') { loadBots(); loadPnL(); }
}

// ─── LIVE SCORES ──────────────────────────────────────────────────────────────

async function loadLiveScores() {
    try {
        // Fetch ALL sports in parallel
        const [nbaRes, nflRes, nhlRes, mlbRes, ncaabRes] = await Promise.allSettled([
            fetch(`${API_BASE}/scoreboard/nba`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/nfl`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/nhl`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/mlb`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/ncaab`).then(r => r.json()),
        ]);

        const games = [];
        const addGames = (res, sport) => {
            if (res.status === 'fulfilled' && res.value.events) {
                games.push(...res.value.events.map(e => parseESPNGame(e, sport)));
            }
        };
        addGames(nbaRes, 'NBA');
        addGames(nflRes, 'NFL');
        addGames(nhlRes, 'NHL');
        addGames(mlbRes, 'MLB');
        addGames(ncaabRes, 'NCAAB');

        // Build lookup table for marking Kalshi market cards as live
        liveGames = {};
        games.forEach(g => {
            if (g.state === 'in') {
                liveGames[g.awayAbbr] = g;
                liveGames[g.homeAbbr] = g;
            }
        });

        // Re-render market cards so live badges update
        if (allMarkets.length > 0) applyFilters();
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
    const period = status.period || 0;

    // Format period label correctly per sport
    let periodLabel = '';
    const state = statusType.state || 'pre';
    if (state === 'in' || state === 'post') {
        if (sport === 'NBA' || sport === 'NCAAB') {
            // Basketball: quarters (or OT)
            if (period <= 4) periodLabel = `Q${period}`;
            else periodLabel = period === 5 ? 'OT' : `${period - 4}OT`;
        } else if (sport === 'NHL') {
            // Hockey: periods (or OT)
            if (period <= 3) periodLabel = `P${period}`;
            else if (period === 4) periodLabel = 'OT';
            else periodLabel = `${period - 3}OT`;
        } else if (sport === 'NFL') {
            // Football: quarters (or OT)
            if (period <= 4) periodLabel = `Q${period}`;
            else periodLabel = 'OT';
        } else if (sport === 'MLB') {
            // Baseball: use ESPN's detail (Top/Bot of inning)
            periodLabel = statusType.shortDetail || `Inn ${period}`;
        } else {
            // Soccer / other: use half or ESPN detail
            if (period <= 2) periodLabel = `${period}H`;
            else periodLabel = statusType.shortDetail || `P${period}`;
        }
    }
    if (state === 'post') periodLabel = statusType.shortDetail || 'Final';

    return {
        sport,
        name: event.shortName || event.name || '',
        homeAbbr: (home.team || {}).abbreviation || '',
        awayAbbr: (away.team || {}).abbreviation || '',
        homeScore: home.score || '0',
        awayScore: away.score || '0',
        state,
        clock: status.displayClock || '',
        period,
        periodLabel,
    };
}

// Live scores bar removed — live data shown inline on game cards via liveGames lookup

// ─── SPORT FILTER ─────────────────────────────────────────────────────────────

function toggleFeatureGuide() {
    const guide = document.getElementById('feature-guide');
    if (guide) guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
}

function filterBySport(sport) {
    // Toggle live sub-filter
    if (sport === 'live') {
        currentLiveFilter = !currentLiveFilter;
    } else {
        currentSportFilter = sport;
    }

    // Update pill active states
    document.querySelectorAll('.sport-pill').forEach(p => {
        if (p.dataset.sport === 'live') {
            p.classList.toggle('active', currentLiveFilter);
        } else {
            p.classList.toggle('active', p.dataset.sport === currentSportFilter);
        }
    });

    // If we picked a sport (not toggling live) and have no markets, fetch
    if (sport !== 'live') {
        loadMarkets();
        return;
    }

    // Live toggle is client-side only
    if (allMarkets.length === 0) {
        loadMarkets().then(() => applyFilters());
    } else {
        applyFilters();
    }
}

function applyFilters() {
    const query = (document.getElementById('search-box')?.value || '').toLowerCase();
    let filtered = allMarkets;

    // Sport filter first (client-side since we now fetch all)
    if (currentSportFilter !== 'all') {
        filtered = filtered.filter(m => {
            const et = ((m.event_ticker || '') + (m.series_ticker || '') + (m.ticker || '')).toUpperCase();
            switch (currentSportFilter) {
                case 'nba':   return et.includes('NBA');
                case 'nfl':   return et.includes('NFL') || et.includes('NFLG');
                case 'mlb':   return et.includes('MLB') || et.includes('KXMLB');
                case 'nhl':   return et.includes('NHL') || et.includes('KXNHL');
                case 'ncaab': return et.includes('NCAAB') || et.includes('KXNCAA');
                case 'mls':   return et.includes('MLS') || et.includes('KXMLS');
                case 'soccer': return et.includes('EPL') || et.includes('UCL') || et.includes('MLS');
                case 'other': return !et.includes('NBA') && !et.includes('NFL') && !et.includes('MLB') && !et.includes('NHL') && !et.includes('NCAA') && !et.includes('MLS') && !et.includes('EPL') && !et.includes('UCL');
                default: return true;
            }
        });
    }

    // LIVE sub-filter — works WITHIN whatever sport is selected
    if (currentLiveFilter) {
        filtered = filtered.filter(m => {
            const eventTicker = m.event_ticker || m.ticker || '';
            const gameId = extractGameId(eventTicker);
            return !!getLiveScoreForGame(gameId);
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

    try {
        // Credentials are stored server-side in config.json — never in frontend code
        const response = await fetch(`${API_BASE}/auto-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (data.success) {
            console.log('✅ Auto-login successful - Balance: $' + data.balance.toFixed(2));

            await loadBalance();
            await loadBots();
            await loadPnL();
            await loadMarkets();

            // Auto-resume monitoring if bots exist
            await autoResumeMonitor();
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
    grid.innerHTML = '<p style="color: #00ff88; grid-column: 1 / -1;">Loading sports markets...</p>';
    
    try {
        // Build URL with sport filter for backend
        // Use higher limit for 'all' since it aggregates many series
        // 'live' filter is client-side only, fetch all
        const isAllOrLive = !currentSportFilter || currentSportFilter === 'all' || currentSportFilter === 'live';
        const fetchLimit = isAllOrLive ? 2000 : 500;
        let url = `${API_BASE}/markets?status=open&limit=${fetchLimit}`;
        if (currentSportFilter && currentSportFilter !== 'all' && currentSportFilter !== 'live') {
            url += `&sport=${currentSportFilter}`;
        }
        
        // Backend queries Kalshi by sports series (KXNBAGAME, KXNBASPREAD, etc.)
        let response = await fetch(url);
        let data = await response.json();
        
        if (data.error) {
            grid.innerHTML = `<p style="color: #ff4444; grid-column: 1 / -1;">Error: ${data.error}</p>`;
            return;
        }
        
        allMarkets = data.markets || data;
        console.log(`📊 Sports markets loaded: ${allMarkets.length} open (filter: ${currentSportFilter})`);
        
        // Log breakdown by series
        if (allMarkets.length > 0) {
            const seriesBreakdown = {};
            allMarkets.forEach(m => {
                const series = m.series_ticker || m.ticker?.split('-')[0] || 'UNKNOWN';
                seriesBreakdown[series] = (seriesBreakdown[series] || 0) + 1;
            });
            console.log('📈 Series Breakdown:', seriesBreakdown);
        }
        
        // If no open sports markets, show message
        if (allMarkets.length === 0) {
            grid.innerHTML = '<p style="color: #8892a6; grid-column: 1 / -1;">No sports markets available right now. Check back during game time!</p>';
            return;
        }
        
        applyFilters();
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

// Group markets by GAME - extracts game ID from event_ticker
// e.g. KXNBAGAME-26FEB28TORWAS, KXNBASPREAD-26FEB28TORWAS, KXNBATOTAL-26FEB28TORWAS
// all share the game ID "26FEB28TORWAS" = Toronto vs Washington on Feb 28
function groupByEvent(markets) {
    const games = {};
    
    console.log(`🔧 Grouping ${markets.length} markets by game...`);
    
    markets.forEach(market => {
        const eventTicker = market.event_ticker || market.ticker || 'UNKNOWN';
        const gameId = extractGameId(eventTicker);
        
        if (!games[gameId]) {
            games[gameId] = {
                gameId: gameId,
                eventTicker: eventTicker,
                seriesTicker: market.series_ticker || eventTicker.split('-')[0] || '',
                eventTitle: buildGameTitle(gameId, market),
                teamNames: parseTeamNames(gameId),
                sport: detectSport(eventTicker),
                markets: []
            };
        }
        
        games[gameId].markets.push(market);
    });
    
    console.log(`✅ Grouped into ${Object.keys(games).length} games`);
    
    // Log game details
    Object.values(games).forEach(g => {
        console.log(`  🏀 ${g.eventTitle}: ${g.markets.length} markets (${g.sport})`);
    });
    
    return games;
}

// Extract clean game ID from event_ticker
// KXNBAGAME-26FEB28TORWAS -> 26FEB28TORWAS
// KXNBASPREAD-26FEB28TORWAS-TOR28 -> 26FEB28TORWAS
// KXEPLGOAL-26FEB28LEEMCI -> 26FEB28LEEMCI
function extractGameId(eventTicker) {
    if (!eventTicker) return 'UNKNOWN';
    
    // Remove the series prefix (KXNBAGAME-, KXNBASPREAD-, etc.)
    const parts = eventTicker.split('-');
    if (parts.length >= 2) {
        // The game ID is the second part (date + teams)
        return parts[1]; // e.g., "26FEB28TORWAS"
    }
    return eventTicker;
}

// Detect sport from event_ticker
function detectSport(eventTicker) {
    const upper = (eventTicker || '').toUpperCase();
    if (upper.includes('KXNBA')) return 'NBA';
    if (upper.includes('KXNFL')) return 'NFL';
    if (upper.includes('KXNHL')) return 'NHL';
    if (upper.includes('KXMLB')) return 'MLB';
    if (upper.includes('KXNCAAB')) return 'NCAAB';
    if (upper.includes('KXNCAAF')) return 'NCAAF';
    if (upper.includes('KXMLS')) return 'MLS';
    if (upper.includes('KXEPL')) return 'EPL';
    if (upper.includes('KXUCL')) return 'UCL';
    if (upper.includes('KXLOL') || upper.includes('KXDOTA') || upper.includes('KXCS')) return 'Esports';
    return 'Sports';
}

// Get sport emoji
function getSportEmoji(sport) {
    const emojis = {
        'NBA': '🏀', 'NFL': '🏈', 'NHL': '🏒', 'MLB': '⚾', 
        'MLS': '⚽', 'NCAAB': '🎓', 'NCAAF': '🎓', 'EPL': '⚽', 'UCL': '⚽',
        'Esports': '🎮', 'Sports': '🏆'
    };
    return emojis[sport] || '🏆';
}

// Build game title from gameId and market data
// 26FEB28TORWAS -> "Toronto vs Washington"
function buildGameTitle(gameId, market) {
    // Try to extract from market title first (most reliable)
    const title = market.title || '';
    
    // Titles like "Denver at Utah Winner?" or "Toronto at Washington: Spread"
    const atMatch = title.match(/^(.+?)\s+at\s+(.+?)[\s:?]/i);
    if (atMatch) {
        return `${atMatch[1].trim()} vs ${atMatch[2].trim()}`;
    }
    
    const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+?)[\s:?]/i);
    if (vsMatch) {
        return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
    }
    
    // Parse from gameId: 26FEB28TORWAS -> TOR vs WAS
    return parseTeamNames(gameId);
}

// Parse team names from game ID (e.g., 26FEB28TORWAS -> "Toronto vs Washington")
function parseTeamNames(gameId) {
    if (!gameId || gameId === 'UNKNOWN') return 'Unknown Game';
    
    // NBA team abbreviations to full names
    const teamMap = {
        'ATL': 'Atlanta', 'BOS': 'Boston', 'BKN': 'Brooklyn', 'CHA': 'Charlotte',
        'CHI': 'Chicago', 'CLE': 'Cleveland', 'DAL': 'Dallas', 'DEN': 'Denver',
        'DET': 'Detroit', 'GSW': 'Golden State', 'HOU': 'Houston', 'IND': 'Indiana',
        'LAC': 'LA Clippers', 'LAL': 'LA Lakers', 'MEM': 'Memphis', 'MIA': 'Miami',
        'MIL': 'Milwaukee', 'MIN': 'Minnesota', 'NOP': 'New Orleans', 'NYK': 'New York',
        'OKC': 'OKC Thunder', 'ORL': 'Orlando', 'PHI': 'Philadelphia', 'PHX': 'Phoenix',
        'POR': 'Portland', 'SAC': 'Sacramento', 'SAS': 'San Antonio', 'TOR': 'Toronto',
        'UTA': 'Utah', 'WAS': 'Washington',
        // NHL
        'CAR': 'Carolina', 'SEA': 'Seattle', 'COL': 'Colorado', 
        'VGK': 'Vegas', 'WPG': 'Winnipeg', 'WSH': 'Washington',
        'VAN': 'Vancouver', 'FLA': 'Florida', 'NYR': 'NY Rangers',
        'NYI': 'NY Islanders', 'TBL': 'Tampa Bay', 'NJD': 'New Jersey',
        'PIT': 'Pittsburgh', 'CBJ': 'Columbus', 'NSH': 'Nashville',
        'STL': 'St. Louis', 'EDM': 'Edmonton', 'CGY': 'Calgary',
        'OTT': 'Ottawa', 'MTL': 'Montreal', 'BUF': 'Buffalo',
        'ARI': 'Arizona', 'ANA': 'Anaheim', 'SJS': 'San Jose',
        // EPL
        'LEE': 'Leeds', 'MCI': 'Man City', 'LFC': 'Liverpool', 'TOT': 'Tottenham',
        'NFO': 'Nottingham', 'FUL': 'Fulham', 'BRE': 'Brentford', 'WOL': 'Wolves',
        'ARS': 'Arsenal', 'EVE': 'Everton', 'NEW': 'Newcastle', 'BUR': 'Burnley',
        'WHU': 'West Ham', 'MUN': 'Man United', 'AVL': 'Aston Villa', 'CHE': 'Chelsea',
        'BHA': 'Brighton', 'CRY': 'Crystal Palace', 'SOU': 'Southampton',
        'IPS': 'Ipswich', 'LEI': 'Leicester', 'BOH': 'Bournemouth',
        // UCL
        'ATM': 'Atletico Madrid', 'RMA': 'Real Madrid', 'BAR': 'Barcelona',
        'PSG': 'PSG', 'CFC': 'Chelsea',
        'TIE': 'Draw'
    };
    
    // Remove date prefix: 26FEB28TORWAS -> TORWAS
    const cleaned = gameId.replace(/^\d+[A-Z]{3}\d+/, '');
    
    if (cleaned.length >= 6) {
        // Try 3+3 split first
        const team1 = cleaned.substring(0, 3);
        const team2 = cleaned.substring(3, 6);
        const name1 = teamMap[team1] || team1;
        const name2 = teamMap[team2] || team2;
        if (name1 !== team1 || name2 !== team2) {
            return `${name1} vs ${name2}`;
        }
    }
    
    return gameId;
}

// Parse game date from gameId like "26MAR04ATLMIL" → "Mar 4"
function parseGameDate(gameId) {
    if (!gameId) return '';
    const match = gameId.match(/^(\d{2})([A-Z]{3})(\d{2})/);
    if (!match) return '';
    const monthMap = {JAN:'Jan',FEB:'Feb',MAR:'Mar',APR:'Apr',MAY:'May',JUN:'Jun',
                      JUL:'Jul',AUG:'Aug',SEP:'Sep',OCT:'Oct',NOV:'Nov',DEC:'Dec'};
    const month = monthMap[match[2]] || match[2];
    const day = parseInt(match[3]);
    return `${month} ${day}`;
}

// Display one compact event row (trading floor style)
function displayEventRow(eventData, container) {
    const liveScore = getLiveScoreForGame(eventData.gameId);
    const isLive = !!liveScore;
    const sport = eventData.sport || detectSport(eventData.eventTicker);
    const emoji = getSportEmoji(sport);

    const card = document.createElement('div');
    card.style.cssText = `background: #1a1f2e; border: 1px solid ${isLive ? '#00ff88' : '#2a3447'}; border-radius: 8px; padding: 16px; margin-bottom: 12px;`;

    // Event header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #2a3447;';

    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'font-size: 15px; font-weight: 600; color: #ffffff;';
    titleSpan.textContent = `${emoji} ${eventData.eventTitle}`;
    header.appendChild(titleSpan);

    // Sport badge
    const sportBadge = document.createElement('span');
    sportBadge.style.cssText = 'background: #2a3447; color: #8892a6; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600; margin-left: 8px;';
    sportBadge.textContent = sport;
    titleSpan.appendChild(sportBadge);

    // Date badge
    const gameDate = parseGameDate(eventData.gameId);
    if (gameDate) {
        const dateBadge = document.createElement('span');
        dateBadge.style.cssText = 'color: #6a7488; font-size: 11px; margin-left: 8px;';
        dateBadge.textContent = `📅 ${gameDate}`;
        titleSpan.appendChild(dateBadge);
    }
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
    
    // Display winner markets — each team is its own row with clear team label
    categorized.winners.forEach(m => {
        const teamLabel = getTeamLabelFromTicker(m.ticker);
        const winLabel = teamLabel && teamLabel !== 'Winner' ? `${teamLabel} Win` : 'Winner';
        marketsGrid.appendChild(createMarketRow(m, winLabel));
    });
    
    // Display spreads — show primary spread (closest to pick-em), rest in own collapsible
    if (categorized.spreads.length > 0) {
        // Sort by spread number (smallest first = closest to pick-em)
        const sorted = [...categorized.spreads].sort((a, b) => {
            const numA = parseInt((a.ticker || '').match(/(\d+)$/)?.[1] || '999');
            const numB = parseInt((b.ticker || '').match(/(\d+)$/)?.[1] || '999');
            return numA - numB;
        });
        // Show first 2 spreads (one per team at tightest line)
        sorted.slice(0, 2).forEach(m => {
            marketsGrid.appendChild(createMarketRow(m, extractSubtitle(m.title) || 'Spread'));
        });
        if (sorted.length > 2) {
            const spreadSection = createCollapsible('📊 More Spreads', sorted.slice(2), m => extractSubtitle(m.title) || 'Spread');
            marketsGrid.appendChild(spreadSection);
        }
    }
    
    // Display totals — show the middle total with line number, rest in own collapsible
    if (categorized.totals.length > 0) {
        // Sort by line number
        const sortedTotals = [...categorized.totals].sort((a, b) => {
            const numA = parseInt((a.ticker || '').match(/(\d+)$/)?.[1] || '999');
            const numB = parseInt((b.ticker || '').match(/(\d+)$/)?.[1] || '999');
            return numA - numB;
        });
        const midIdx = Math.floor(sortedTotals.length / 2);
        marketsGrid.appendChild(createMarketRow(sortedTotals[midIdx], extractTotalLine(sortedTotals[midIdx])));
        const otherTotals = sortedTotals.filter((_, i) => i !== midIdx);
        if (otherTotals.length > 0) {
            const totalSection = createCollapsible('📊 More Totals', otherTotals, m => extractTotalLine(m));
            marketsGrid.appendChild(totalSection);
        }
    }
    
    // Player props — group by stat type with readable labels
    if (categorized.props.length > 0) {
        const propsSection = createPropsSection(categorized.props);
        marketsGrid.appendChild(propsSection);
    }
    
    card.appendChild(marketsGrid);
    container.appendChild(card);
}

// Categorize markets by type
// Primary: use backend-provided market_type field (100% reliable)
// Fallback: parse from ticker prefix (KXNBAGAME → winner, KXNBASPREAD → spread, etc.)
function categorizeMarkets(markets) {
    const result = {
        winners: [],
        spreads: [],
        totals: [],
        props: []
    };
    
    function getMarketType(market) {
        // Backend enriches each market with market_type
        if (market.market_type) return market.market_type;
        
        // Fallback: detect from ticker/event_ticker prefix
        const ticker = (market.ticker || '').toUpperCase();
        const event = (market.event_ticker || '').toUpperCase();
        const title = (market.title || '').toUpperCase();
        
        // Check series-based prefix in ticker (most reliable)
        if (ticker.includes('GAME') || event.includes('GAME') || title.includes('WINNER')) return 'winner';
        if (ticker.includes('SPREAD') || event.includes('SPREAD') || title.includes('WINS BY')) return 'spread';
        if (ticker.includes('TOTAL') || event.includes('TOTAL') || title.includes('TOTAL POINTS') || title.includes('TOTAL GOALS')) return 'total';
        
        return 'prop';
    }
    
    markets.forEach(market => {
        const type = getMarketType(market);
        result[type === 'winner' ? 'winners' : type === 'spread' ? 'spreads' : type === 'total' ? 'totals' : 'props'].push(market);
    });
    
    console.log(`  Categorized: W=${result.winners.length} S=${result.spreads.length} T=${result.totals.length} Props=${result.props.length}`);
    return result;
}

// Create single market row (compact button-grid style)
function createMarketRow(market, label) {
    const row = document.createElement('div');
    const isProp = market.market_type === 'prop';
    const cols = isProp ? '1fr 80px 80px auto' : '120px 1fr 1fr auto';
    row.style.cssText = `display: grid; grid-template-columns: ${cols}; gap: 10px; align-items: center; padding: 8px; background: #0f1419; border-radius: 6px;`;
    
    // Market label — trust the caller's label (they compute the right one)
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = 'font-size: 13px; font-weight: 600; color: #8892a6;';
    labelDiv.textContent = label || extractSubtitle(market.title) || market.title;
    
    // YES button (compact price button with value-based styling)
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const yesPrice = yesAsk || yesBid || Math.round((yesBid + yesAsk) / 2);
    const yesStyle = getPriceButtonStyle(yesPrice, 'yes');
    
    const yesBtn = document.createElement('button');
    yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${yesStyle}`;
    
    // Smart button labels based on market type
    const mtype = market.market_type || '';
    const isWinnerRow = label && (label.endsWith(' Win') || label === 'Winner');
    const isTotalRow = mtype === 'total' || (label && label.startsWith('O/U'));
    const isSpreadRow = mtype === 'spread' || (label && /^[A-Z]{2,4}\s-/.test(label));
    
    let yesLabel, noLabel;
    if (isWinnerRow) {
        const teamFromTicker = getTeamLabelFromTicker(market.ticker);
        yesLabel = `✓ Wins`;
        noLabel = `✗ Loses`;
    } else if (isTotalRow) {
        yesLabel = `✓ Over`;
        noLabel = `✗ Under`;
    } else if (isSpreadRow) {
        yesLabel = `✓ Covers`;
        noLabel = `✗ Misses`;
    } else {
        yesLabel = 'YES';
        noLabel = 'NO';
    }

    yesBtn.innerHTML = `<div>${yesPrice}¢</div><div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${yesLabel}</div>`;
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
    noBtn.innerHTML = `<div>${noPrice}¢</div><div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">${noLabel}</div>`;
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

// Extract team label from ticker suffix (e.g., KXNBAGAME-26FEB28HOUMIA-MIA -> "Miami")
function getTeamLabelFromTicker(ticker) {
    if (!ticker) return 'Winner';
    // Ticker format: PREFIX-DATEXXXXXX-SUFFIX
    // e.g., KXNBAGAME-26FEB28HOUMIA-MIA, KXEPLGAME-26MAR01ARSCFC-TIE
    const parts = ticker.split('-');
    const suffix = parts[parts.length - 1] || '';
    if (!suffix) return 'Winner';
    
    // Use the same team map as parseTeamNames
    const teamMap = {
        'ATL': 'Atlanta', 'BOS': 'Boston', 'BKN': 'Brooklyn', 'CHA': 'Charlotte',
        'CHI': 'Chicago', 'CLE': 'Cleveland', 'DAL': 'Dallas', 'DEN': 'Denver',
        'DET': 'Detroit', 'GSW': 'Golden St', 'HOU': 'Houston', 'IND': 'Indiana',
        'LAC': 'LA Clippers', 'LAL': 'LA Lakers', 'MEM': 'Memphis', 'MIA': 'Miami',
        'MIL': 'Milwaukee', 'MIN': 'Minnesota', 'NOP': 'New Orleans', 'NYK': 'New York',
        'OKC': 'OKC', 'ORL': 'Orlando', 'PHI': 'Philadelphia', 'PHX': 'Phoenix',
        'POR': 'Portland', 'SAC': 'Sacramento', 'SAS': 'San Antonio', 'TOR': 'Toronto',
        'UTA': 'Utah', 'WAS': 'Washington',
        // NHL
        'CAR': 'Carolina', 'SEA': 'Seattle', 'COL': 'Colorado',
        'VGK': 'Vegas', 'WPG': 'Winnipeg', 'WSH': 'Washington',
        'VAN': 'Vancouver', 'FLA': 'Florida', 'NYR': 'NY Rangers',
        'NYI': 'NY Islanders', 'TBL': 'Tampa Bay', 'NJD': 'New Jersey',
        'PIT': 'Pittsburgh', 'CBJ': 'Columbus', 'NSH': 'Nashville',
        'STL': 'St. Louis', 'EDM': 'Edmonton', 'CGY': 'Calgary',
        'OTT': 'Ottawa', 'MTL': 'Montreal', 'BUF': 'Buffalo',
        'ARI': 'Arizona', 'ANA': 'Anaheim', 'SJS': 'San Jose',
        // EPL
        'LEE': 'Leeds', 'MCI': 'Man City', 'LFC': 'Liverpool', 'TOT': 'Tottenham',
        'NFO': 'Nottingham', 'FUL': 'Fulham', 'BRE': 'Brentford', 'WOL': 'Wolves',
        'ARS': 'Arsenal', 'EVE': 'Everton', 'NEW': 'Newcastle', 'BUR': 'Burnley',
        'WHU': 'West Ham', 'MUN': 'Man Utd', 'AVL': 'Aston Villa', 'CHE': 'Chelsea',
        'BHA': 'Brighton', 'CRY': 'Crystal Palace', 'SOU': 'Southampton',
        'IPS': 'Ipswich', 'LEI': 'Leicester', 'BOH': 'Bournemouth', 'BOU': 'Bournemouth',
        'BRI': 'Brighton', 'SUN': 'Sunderland',
        'TIE': 'Draw',
    };
    return teamMap[suffix.toUpperCase()] || suffix;
}

// Extract team sides from market title for winner markets
// Returns { yes: 'Miami Heat', no: 'Los Angeles Lakers' } or null
function extractTeamSides(title) {
    if (!title) return null;
    // "Denver at Utah: Winner?" or "Denver Nuggets at Utah Jazz Winner?"
    const atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[:?]|\s+Winner|\s+Moneyline|$)/i);
    if (atMatch) {
        return { yes: atMatch[1].trim(), no: atMatch[2].trim() };
    }
    // "Denver vs Utah: Winner?" or "Denver vs. Utah Winner?"
    const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[:?]|\s+Winner|\s+Moneyline|$)/i);
    if (vsMatch) {
        return { yes: vsMatch[1].trim(), no: vsMatch[2].trim() };
    }
    // "Will Denver Nuggets beat Utah Jazz?"
    const willMatch = title.match(/^Will\s+(.+?)\s+(?:beat|defeat|win against)\s+(.+?)\??$/i);
    if (willMatch) {
        return { yes: willMatch[1].trim(), no: willMatch[2].trim() };
    }
    return null;
}

// Shorten a team name for button labels (e.g., "Los Angeles Lakers" -> "Lakers")
function shortenTeam(name) {
    if (!name) return '';
    // If it's already short (abbrev like MIA, LAL), keep it
    if (name.length <= 5) return name;
    // Multi-word: use last word ("Los Angeles Lakers" -> "Lakers")
    const words = name.split(/\s+/);
    if (words.length > 1) {
        // Special cases where last word isn't best
        const last = words[words.length - 1];
        // "Man City" -> "Man City", "NY Rangers" -> "Rangers"
        if (words.length === 2 && words[0].length <= 3) return name;
        return last;
    }
    return name;
}

// Extract subtitle from market title (e.g., "DEN -3.5" from full title)
function extractSubtitle(title) {
    if (!title) return '';
    
    // For spread: "Milwaukee wins by over 17.5 Points?" -> "MIL -17.5"
    const spreadMatch = title.match(/^(\w[\w\s.]+?)\s+wins?\s+by\s+over\s+([\d.]+)/i);
    if (spreadMatch) {
        const teamWord = spreadMatch[1].trim();
        const num = spreadMatch[2];
        // Use first 3-4 chars as abbreviation
        const abbr = teamWord.length <= 4 ? teamWord.toUpperCase() : teamWord.substring(0, 3).toUpperCase();
        return `${abbr} -${num}`;
    }
    
    // For total: "Portland at Memphis: Total Points" -> "Total Points" (line added elsewhere)
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

// Extract the line number from a total market
// Ticker KXNBATOTAL-26MAR04PORMEM-252 → "O/U 252.5"
// Fallback to yes_sub_title: "Over 252.5 points scored" → "O/U 252.5"
function extractTotalLine(market) {
    // Try ticker last segment first (most reliable)
    const ticker = market.ticker || '';
    const parts = ticker.split('-');
    if (parts.length >= 3) {
        const lastSeg = parts[parts.length - 1];
        const numMatch = lastSeg.match(/^[A-Z]*(\d+)$/);
        if (numMatch) {
            return `O/U ${numMatch[1]}.5`;
        }
    }
    // Fallback to yes_sub_title
    const sub = market.yes_sub_title || '';
    const subMatch = sub.match(/over\s+([\d.]+)/i);
    if (subMatch) {
        return `O/U ${subMatch[1]}`;
    }
    return 'Total Points';
}

// ── Sportsbook-style display name from a Kalshi ticker ──────────────────────
// KXNBAGAME-26MAR02BOSMIL-BOS   → "BOS vs MIL · Moneyline · Boston"
// KXNBASPREAD-26MAR02BOSMIL-BOS35 → "BOS vs MIL · Spread · BOS -3.5"
// KXNBATOTAL-26MAR02BOSMIL-O2255  → "BOS vs MIL · Total · O 225.5"
function formatBotDisplayName(ticker) {
    if (!ticker) return 'Unknown';
    const parts = ticker.split('-');
    if (parts.length < 2) return ticker;

    const prefix  = (parts[0] || '').toUpperCase();   // KXNBAGAME
    const gameId  = parts[1] || '';                    // 26MAR02BOSMIL
    const suffix  = parts.length >= 3 ? parts[parts.length - 1] : '';

    // Detect market type from prefix
    let marketType = 'Moneyline';
    if (prefix.includes('SPREAD')) marketType = 'Spread';
    else if (prefix.includes('TOTAL')) marketType = 'Total';
    else if (prefix.includes('GAME') || prefix.includes('WIN') || prefix.includes('MONEYLINE')) marketType = 'Moneyline';

    // Parse teams from gameId: 26MAR02BOSMIL → BOS vs MIL
    const cleaned = gameId.replace(/^\d+[A-Z]{3}\d+/, '');  // strip date prefix
    let matchup = '';
    if (cleaned.length >= 6) {
        const t1 = cleaned.substring(0, 3);
        const t2 = cleaned.substring(3, 6);
        const teamMap = {
            'ATL': 'ATL', 'BOS': 'BOS', 'BKN': 'BKN', 'CHA': 'CHA',
            'CHI': 'CHI', 'CLE': 'CLE', 'DAL': 'DAL', 'DEN': 'DEN',
            'DET': 'DET', 'GSW': 'GSW', 'HOU': 'HOU', 'IND': 'IND',
            'LAC': 'LAC', 'LAL': 'LAL', 'MEM': 'MEM', 'MIA': 'MIA',
            'MIL': 'MIL', 'MIN': 'MIN', 'NOP': 'NOP', 'NYK': 'NYK',
            'OKC': 'OKC', 'ORL': 'ORL', 'PHI': 'PHI', 'PHX': 'PHX',
            'POR': 'POR', 'SAC': 'SAC', 'SAS': 'SAS', 'TOR': 'TOR',
            'UTA': 'UTA', 'WAS': 'WAS',
            'CAR': 'CAR', 'SEA': 'SEA', 'COL': 'COL', 'VGK': 'VGK',
            'WPG': 'WPG', 'WSH': 'WSH', 'VAN': 'VAN', 'FLA': 'FLA',
            'NYR': 'NYR', 'NYI': 'NYI', 'TBL': 'TBL', 'NJD': 'NJD',
            'PIT': 'PIT', 'CBJ': 'CBJ', 'NSH': 'NSH', 'STL': 'STL',
            'EDM': 'EDM', 'CGY': 'CGY', 'OTT': 'OTT', 'MTL': 'MTL',
            'BUF': 'BUF', 'ARI': 'ARI', 'ANA': 'ANA', 'SJS': 'SJS',
        };
        const n1 = teamMap[t1] || t1;
        const n2 = teamMap[t2] || t2;
        matchup = `${n1} vs ${n2}`;
    }

    // Side label from suffix (team or spread/total detail)
    const sideTeam = getTeamLabelFromTicker(ticker);
    let sideLabel = '';
    if (marketType === 'Moneyline' && sideTeam && sideTeam !== 'Winner') {
        sideLabel = sideTeam + ' Win';
    } else if (suffix) {
        sideLabel = suffix;
    }

    // Compose: "BOS vs MIL · Moneyline · Boston Win"
    const segments = [matchup, marketType, sideLabel].filter(Boolean);
    return segments.join(' · ') || ticker;
}

// Create collapsible player props section
// Generic collapsible section (used for spreads, totals, and props)
function createCollapsible(label, items, labelFn) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 8px;';
    
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; background: #0f1419; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
        <span style="color: #8892a6; font-size: 12px; font-weight: 600;">${label} (${items.length})</span>
        <span style="color: #8892a6; font-size: 12px;">▼</span>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'display: none; padding-top: 8px; gap: 6px; flex-direction: column;';
    
    items.slice(0, 30).forEach(item => {
        const itemLabel = labelFn ? labelFn(item) : extractSubtitle(item.title);
        content.appendChild(createMarketRow(item, itemLabel));
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

// Legacy alias
function createPropsCollapsible(props) {
    return createPropsSection(props);
}

// Create grouped player props section — groups by stat type (points, rebounds, etc.)
function createPropsSection(props) {
    const STAT_LABELS = {
        'KXNBAPTS': '🏀 Points',  'KXNBAREB': '🏀 Rebounds', 'KXNBAAST': '🏀 Assists',
        'KXNBA3PT': '🏀 3-Pointers', 'KXNBASTL': '🏀 Steals', 'KXNBABLK': '🏀 Blocks',
        'KXNBAMVP': '🏆 MVP',     'KXNHLGOAL': '🏒 Goals',   'KXEPLBTTS': '⚽ BTTS',
        'KXUCLBTTS': '⚽ BTTS',   'KXMLSBTTS': '⚽ BTTS',
    };

    // Group by series_ticker (stat type)
    const groups = {};
    props.forEach(m => {
        const key = m.series_ticker || 'other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(m);
    });

    // If only one group or few total props, use simple collapsible
    const groupKeys = Object.keys(groups);
    if (groupKeys.length <= 1 || props.length <= 6) {
        return createCollapsible('📊 Player Props', props, m => extractPropLabel(m));
    }

    // Multiple groups — create outer collapsible with inner sub-groups
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 8px;';

    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; background: #0f1419; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
        <span style="color: #8892a6; font-size: 12px; font-weight: 600;">📊 Player Props (${props.length})</span>
        <span style="color: #8892a6; font-size: 12px;">▼</span>
    `;

    const content = document.createElement('div');
    content.style.cssText = 'display: none; padding-top: 8px; gap: 4px; flex-direction: column;';

    // Sort groups: points first, then alphabetical
    const groupOrder = ['KXNBAPTS', 'KXNBAREB', 'KXNBAAST', 'KXNBA3PT', 'KXNBASTL', 'KXNBABLK'];
    const sortedKeys = groupKeys.sort((a, b) => {
        const ai = groupOrder.indexOf(a);
        const bi = groupOrder.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.localeCompare(b);
    });

    sortedKeys.forEach(key => {
        const items = groups[key];
        const groupLabel = STAT_LABELS[key] || key.replace('KXNBA', '').replace('KX', '');
        const subCollapsible = createCollapsible(`${groupLabel} (${items.length})`, items, m => extractPropLabel(m));
        content.appendChild(subCollapsible);
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

// Extract a readable label for a player prop market
// Title format: "Shai Gilgeous-Alexander: 40+ points" -> use as-is, it's great
function extractPropLabel(market) {
    const title = market.title || '';
    // Prop titles are already clean: "Player Name: N+ stat"
    if (title.includes(':')) {
        return title;  // Already "Player: 40+ points" — perfect
    }
    return extractSubtitle(title) || title;
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

    // ── Favorite anchoring logic ──
    // The higher-priced side is the "favorite" (more liquid, fills faster).
    // Shave LESS from favorite, MORE from underdog.
    // NEVER post above the current bid — that overpays.
    //
    // Split ratio: favorite gets ~40% of the shave, underdog gets ~60%.
    // E.g. if bids sum to 90¢ and targetTotal = 95¢, we need to shave 5¢ total
    // from the bids. If yesBid=55 (fav) and noBid=35 (dog):
    //   favorite shave = 2¢ → targetYes = 55 - 2 = 53
    //   underdog shave = 3¢ → targetNo  = 35 - 3 = 32
    //   total = 53 + 32 = 85¢ → profit = 15¢ (bids were already below 100)
    //
    // But we also cap at the bid — NEVER go above it.

    const bidSum = yesBid + noBid;
    const totalShave = bidSum - targetTotal;  // how much to shave off bids combined

    let targetYes, targetNo;

    if (totalShave <= 0) {
        // Bids already sum below our target — just use the bids directly
        // (profit is already > requested width)
        targetYes = yesBid;
        targetNo  = noBid;
    } else {
        // Determine which side is favorite (higher bid = more likely winner)
        const yesIsFav = yesBid >= noBid;
        const favShave = Math.floor(totalShave * 0.4);   // less shave on favorite
        const dogShave = totalShave - favShave;           // more shave on underdog

        if (yesIsFav) {
            targetYes = yesBid - favShave;
            targetNo  = noBid - dogShave;
        } else {
            targetYes = yesBid - dogShave;
            targetNo  = noBid - favShave;
        }
    }

    // NEVER exceed the current bid — that's overpaying
    targetYes = Math.min(targetYes, yesBid);
    targetNo  = Math.min(targetNo, noBid);

    // Clamp to valid price range
    targetYes = Math.max(1, Math.min(targetYes, 98));
    targetNo  = Math.max(1, Math.min(targetNo, 98));

    return {
        targetYes, targetNo,
        total:   targetYes + targetNo,
        profit:  100 - (targetYes + targetNo),
        yesBid, noBid, yesAsk, noAsk,
        yesIsFav: yesBid >= noBid,
    };
}

/** Open the dual-arb modal for any market (called when clicking YES or NO price button) */
function openBotModal(market, _side, _price) {
    currentArbMarket = market;

    // ── Market title — show team name from ticker ──
    const titleEl = document.getElementById('bot-market-title');
    const title = market.title || market.ticker;
    const teamFromTicker = getTeamLabelFromTicker(market.ticker);
    const displayTitle = teamFromTicker && teamFromTicker !== 'Winner' 
        ? `${teamFromTicker} — ${title}` 
        : title;
    const sport = detectSport(market.event_ticker || market.ticker || '');
    const emoji = getSportEmoji(sport);
    titleEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>${emoji}</span>
        <span>${displayTitle}</span>
        <span style="background:#1e2740;color:#8892a6;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;">${sport}</span>
    </div>`;

    // ── Market prices (visual cards, not raw text) ──
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const noBid  = getPrice(market, 'no_bid');
    const noAsk  = getPrice(market, 'no_ask');
    const yesSpread = yesAsk - yesBid;
    const noSpread  = noAsk - noBid;

    // Use team name from ticker for clear labeling
    const yesTeamLabel = teamFromTicker && teamFromTicker !== 'Winner'
        ? `YES — ${teamFromTicker} wins`
        : 'YES';
    const noTeamLabel = teamFromTicker && teamFromTicker !== 'Winner'
        ? `NO — ${teamFromTicker} loses`
        : 'NO';

    document.getElementById('bot-market-prices').innerHTML = `
        <div style="background:#060a14;border:1px solid #00ff8833;border-radius:6px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="color:#00ff88;font-weight:700;font-size:11px;">${yesTeamLabel}</span>
                <span style="color:#555;font-size:9px;">spread ${yesSpread}¢</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span style="color:#8892a6;">Bid <strong style="color:#00ff88;">${yesBid}¢</strong></span>
                <span style="color:#8892a6;">Ask <strong style="color:#00ff88;">${yesAsk}¢</strong></span>
            </div>
        </div>
        <div style="background:#060a14;border:1px solid #ff444433;border-radius:6px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="color:#ff4444;font-weight:700;font-size:11px;">${noTeamLabel}</span>
                <span style="color:#555;font-size:9px;">spread ${noSpread}¢</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span style="color:#8892a6;">Bid <strong style="color:#ff4444;">${noBid}¢</strong></span>
                <span style="color:#8892a6;">Ask <strong style="color:#ff4444;">${noAsk}¢</strong></span>
            </div>
        </div>
    `;

    // ── Auto-tune width from combined spread ──
    const spreadSum  = Math.max(0, (yesAsk - yesBid) + (noAsk - noBid));
    const autoWidth  = Math.max(3, Math.min(15, Math.round(spreadSum / 2) || 5));
    document.getElementById('bot-arb-width').value = autoWidth;

    // Collapse strategy info by default
    document.getElementById('strategy-details').style.display = 'none';
    document.getElementById('strategy-chevron').textContent = '▼';

    recalcArbPrices();
    document.getElementById('bot-modal').classList.add('show');
}

/** Toggle strategy description visibility */
function toggleStrategyInfo() {
    const details = document.getElementById('strategy-details');
    const chevron = document.getElementById('strategy-chevron');
    const isHidden = details.style.display === 'none';
    details.style.display = isHidden ? 'block' : 'none';
    chevron.textContent = isHidden ? '▲' : '▼';
}

/** Recalculate YES/NO limit prices whenever the arb-width changes */
function recalcArbPrices() {
    if (!currentArbMarket) return;
    const width = parseInt(document.getElementById('bot-arb-width').value) || 5;
    document.getElementById('width-display').textContent = `${width}¢`;

    const arb = calculateArbPrices(currentArbMarket, width);
    document.getElementById('bot-yes-price').value = arb.targetYes;
    document.getElementById('bot-no-price').value  = arb.targetNo;

    // Queue position hints
    const yesHint = document.getElementById('yes-queue-hint');
    const noHint  = document.getElementById('no-queue-hint');
    const yesIsFav = arb.yesIsFav;
    if (yesHint) {
        const diff = arb.yesBid - arb.targetYes;
        const role = yesIsFav ? '★ fav' : 'underdog';
        yesHint.textContent = diff === 0 ? `= bid (${role})` : `bid−${diff} (${role})`;
        yesHint.style.color = yesIsFav ? '#00ff88' : '#8892a6';
    }
    if (noHint) {
        const diff = arb.noBid - arb.targetNo;
        const role = !yesIsFav ? '★ fav' : 'underdog';
        noHint.textContent = diff === 0 ? `= bid (${role})` : `bid−${diff} (${role})`;
        noHint.style.color = !yesIsFav ? '#00ff88' : '#8892a6';
    }

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

/** Render the premium profit/cost preview */
function updateProfitPreview() {
    const yes    = parseInt(document.getElementById('bot-yes-price').value) || 0;
    const no     = parseInt(document.getElementById('bot-no-price').value)  || 0;
    const qty    = parseInt(document.getElementById('bot-quantity').value)  || 1;
    const sl     = parseInt(document.getElementById('bot-stop-loss-cents').value) || 5;
    const total  = yes + no;
    const profit = 100 - total;
    const isArb  = profit > 0;
    const dollarProfit = (profit * qty / 100).toFixed(2);
    const dollarCost   = (total * qty / 100).toFixed(2);
    const roi = total > 0 ? ((profit / total) * 100).toFixed(1) : '0.0';

    // Stop-loss breakdown per leg
    const yesExitPrice = Math.max(0, yes - sl);
    const noExitPrice  = Math.max(0, no - sl);
    const yesLossCents = sl * qty;           // loss if YES leg triggers SL
    const noLossCents  = sl * qty;           // loss if NO leg triggers SL
    const yesLossDollar = (yesLossCents / 100).toFixed(2);
    const noLossDollar  = (noLossCents / 100).toFixed(2);

    const borderColor = isArb ? '#00ff88' : '#ff4444';
    const bgColor     = isArb ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.04)';
    const accentColor = isArb ? '#00ff88' : '#ff4444';

    document.getElementById('profit-preview').innerHTML = `
        <div style="border:1px solid ${borderColor}33;border-radius:10px;background:${bgColor};overflow:hidden;">
            <!-- Settlement equation -->
            <div style="padding:12px 16px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;border-bottom:1px solid ${borderColor}22;">
                <span style="color:#00ff88;font-weight:700;">${yes}¢</span>
                <span style="color:#555;">+</span>
                <span style="color:#ff4444;font-weight:700;">${no}¢</span>
                <span style="color:#555;">=</span>
                <span style="color:#fff;font-weight:700;">${total}¢</span>
                <span style="color:#555;margin:0 4px;">→</span>
                <span style="color:#555;">settles at</span>
                <span style="color:#fff;font-weight:700;">100¢</span>
                <span style="color:#555;margin:0 4px;">→</span>
                <span style="color:${accentColor};font-weight:800;font-size:15px;">${isArb ? '+' : ''}${profit}¢</span>
            </div>
            <!-- Stats row -->
            <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
                <div>
                    <div style="color:#555;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Cost</div>
                    <div style="color:#fff;font-weight:700;font-size:14px;">$${dollarCost}</div>
                </div>
                <div>
                    <div style="color:#555;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Profit</div>
                    <div style="color:${accentColor};font-weight:800;font-size:14px;">${isArb ? '+$' : '-$'}${Math.abs(dollarProfit)}</div>
                </div>
                <div>
                    <div style="color:#555;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">ROI</div>
                    <div style="color:${accentColor};font-weight:700;font-size:14px;">${isArb ? '+' : ''}${roi}%</div>
                </div>
            </div>
            ${!isArb ? `<div style="padding:6px 16px 10px;text-align:center;font-size:11px;color:#ff4444;">⚠ Not profitable — reduce prices or increase width</div>` : ''}
            ${isArb && qty > 1 ? `<div style="padding:2px 16px 10px;text-align:center;font-size:11px;color:#8892a6;">${qty} contracts × ${profit}¢ = <strong style="color:#00ff88;">+$${dollarProfit}</strong> locked at settlement</div>` : ''}
            <!-- Stop-loss risk breakdown -->
            <div style="padding:8px 16px 10px;border-top:1px solid #ff444422;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                    <span style="color:#ff6666;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">🛑 Stop-Loss Risk (−${sl}¢)</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="background:#ff444408;border:1px solid #ff444422;border-radius:6px;padding:6px 10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#00ff88;font-size:10px;font-weight:600;">YES leg</span>
                            <span style="color:#ff4444;font-weight:800;font-size:13px;">−$${yesLossDollar}</span>
                        </div>
                        <div style="color:#555;font-size:9px;margin-top:2px;">sells at ${yesExitPrice}¢ (entry ${yes}¢) × ${qty}</div>
                    </div>
                    <div style="background:#ff444408;border:1px solid #ff444422;border-radius:6px;padding:6px 10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff4444;font-size:10px;font-weight:600;">NO leg</span>
                            <span style="color:#ff4444;font-weight:800;font-size:13px;">−$${noLossDollar}</span>
                        </div>
                        <div style="color:#555;font-size:9px;margin-top:2px;">sells at ${noExitPrice}¢ (entry ${no}¢) × ${qty}</div>
                    </div>
                </div>
            </div>
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
    const repeat_count    = parseInt(document.getElementById('bot-repeat-count').value) || 0;
    const arb_width       = parseInt(document.getElementById('bot-arb-width').value) || (100 - yes_price - no_price);

    if (yes_price + no_price >= 100) {
        alert(`❌ Not an arb — YES(${yes_price}¢) + NO(${no_price}¢) = ${yes_price + no_price}¢ ≥ 100¢\nAdjust prices so total is below 100¢.`);
        return;
    }
    if (!quantity || quantity < 1) { alert('Quantity must be at least 1'); return; }

    const totalCost = (yes_price + no_price) * quantity;
    const profitPer = 100 - yes_price - no_price;
    const repeatMsg = repeat_count > 0 ? `\n↻ Repeat: ${repeat_count}× after first fill (${repeat_count + 1} runs total)` : '';
    if (!confirm(`⚡ Deploy Dual-Arb Bot — ${quantity} contract(s)\n\nMarket: ${currentArbMarket.ticker}\nYES limit buy: ${yes_price}¢\nNO limit buy: ${no_price}¢\nTotal cost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nProfit if both fill: +${profitPer}¢/contract\nPhase: auto-detect${repeatMsg}\n\nConfirm order?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: currentArbMarket.ticker,
                yes_price, no_price, quantity, stop_loss_cents,
                repeat_count, arb_width,
            }),
        });
        const data = await resp.json();

        if (data.success) {
            const profit = 100 - yes_price - no_price;
            const rptNote = repeat_count > 0 ? ` | ${repeat_count + 1} runs total` : '';
            showNotification(`✅ Orders placed! YES ${yes_price}¢ + NO ${no_price}¢ → ${profit}¢/contract${rptNote}`);
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
        if (botIds.length === 0) {
            section.style.display = 'block';
            document.getElementById('bots-list').innerHTML = `<div class="empty-state"><div class="icon">🤖</div><div class="title">No active bots</div><div class="desc">Deploy a bot from the Markets tab or use the Arb Scanner</div></div>`;
            updateBotBuddy(0, 0);
            updateBotsBadge(0);
            return;
        }
        section.style.display = 'block';

        const botsList = document.getElementById('bots-list');
        botsList.innerHTML = '';

        // Filter to only active bots (finished ones only appear in History tab)
        const activeBots = botIds.filter(id => {
            const s = bots[id].status;
            return s !== 'completed' && s !== 'stopped';
        });

        let activeBotCount = 0;
        let filledLegs = 0;

        // ══════════════════════════════════════════════════════════════
        // ACTIVE BOTS
        // ══════════════════════════════════════════════════════════════
        activeBots.forEach(botId => {
            const bot = bots[botId];

            // ── Watch Bots (position watchers) ───────────────────────
            if (bot.type === 'watch') {
                activeBotCount++;
                const side = bot.side || 'yes';
                const entry = bot.entry_price || 50;
                const sl = bot.stop_loss_cents || 5;
                const tp = bot.take_profit_cents || 0;
                const liveBid = bot.live_bid || '?';
                const nowSec = Date.now() / 1000;
                const ageMin = bot.created_at ? Math.floor((nowSec - bot.created_at) / 60) : 0;

                const item = document.createElement('div');
                item.className = 'bot-item';
                item.style.cssText = 'flex-direction:column;gap:8px;border-left:3px solid #9966ff;';
                item.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="color:#9966ff;font-size:11px;font-weight:700;">👁 WATCH</span>
                            <strong style="color:#fff;font-size:13px;">${bot.ticker}</strong>
                            <span class="bot-status watching">WATCHING</span>
                            <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${side==='yes'?'#00ff8822':'#ff444422'};color:${side==='yes'?'#00ff88':'#ff4444'};">${side.toUpperCase()}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="color:#555;font-size:10px;">${ageMin}m</span>
                            <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="cancelBot('${botId}')">✕</button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:11px;color:#8892a6;">
                        <div>Entry: <strong style="color:#fff;">${entry}¢</strong></div>
                        <div>Live bid: <strong style="color:${typeof liveBid === 'number' && liveBid < entry - sl ? '#ff4444' : '#00ff88'};">${liveBid}¢</strong></div>
                        <div>SL: <strong style="color:#ff6666;">${entry - sl}¢</strong>${tp > 0 ? ` · TP: <strong style="color:#00ff88;">${entry + tp}¢</strong>` : ''}</div>
                    </div>
                `;
                botsList.appendChild(item);
                return;
            }

            // ── Dual-Arb Bots (active) ──────────────────────────────
            const profit = bot.profit_per ?? (100 - (bot.yes_price || 0) - (bot.no_price || 0));
            const qty    = bot.quantity || 1;
            const yFill  = bot.yes_fill_qty || 0;
            const nFill  = bot.no_fill_qty  || 0;

            const yPct = Math.round((yFill / qty) * 100);
            const nPct = Math.round((nFill / qty) * 100);
            const bothFilled = yFill >= qty && nFill >= qty;

            const nowSec      = Date.now() / 1000;
            const ageMin      = bot.posted_at ? Math.floor((nowSec - bot.posted_at) / 60) : 0;
            const createdMin  = bot.created_at ? Math.floor((nowSec - bot.created_at) / 60) : ageMin;
            const repostCount = bot.repost_count || 0;
            const statusLabel = (bot.status || '').replace(/_/g, ' ').toUpperCase();
            const phase       = bot.game_phase || 'pregame';
            const phaseIcon   = phase === 'live' ? '🔴' : '⏳';
            const phaseLabel  = phase === 'live' ? 'LIVE' : 'PRE';
            const stopLoss    = bot.stop_loss_cents || 5;
            const statusClass = {
                pending_fills: 'monitoring',
                yes_filled:    'leg1_filled',
                no_filled:     'leg1_filled',
            }[bot.status] || 'monitoring';

            activeBotCount++;
            if (yFill >= qty) filledLegs++;
            if (nFill >= qty) filledLegs++;

            const displayName = formatBotDisplayName(bot.ticker);

            // Cycle info for repeat bots
            const repeatCount = bot.repeat_count || 0;
            const repeatsDone = bot.repeats_done || 0;
            let cycleInfo = '';
            if (repeatCount > 0) {
                const totalRuns = repeatCount + 1;
                const currentCycle = repeatsDone + 1;
                cycleInfo = `<span style="background:#6366f122;color:#818cf8;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">Run ${currentCycle}/${totalRuns}</span>`;
            }

            // Timeout / next-action info for LIVE bots
            let timeoutInfo = '';
            if (phase === 'live') {
                const repostAt  = 5;
                const resizeAt  = 10;
                if (yFill === 0 && nFill === 0) {
                    const minsLeft = Math.max(0, repostAt - ageMin);
                    timeoutInfo = minsLeft > 0
                        ? `<span style="color:#ffaa00;font-size:10px;">⏱ Repost in ${minsLeft}m</span>`
                        : `<span style="color:#ff6666;font-size:10px;">⏱ Repost due</span>`;
                } else if ((yFill > 0 && nFill === 0) || (nFill > 0 && yFill === 0)) {
                    const minsLeft = Math.max(0, resizeAt - ageMin);
                    timeoutInfo = minsLeft > 0
                        ? `<span style="color:#ffaa00;font-size:10px;">⏱ Resize in ${minsLeft}m</span>`
                        : `<span style="color:#ff6666;font-size:10px;">⏱ Resize due</span>`;
                }
            } else if (phase === 'pregame') {
                timeoutInfo = `<span style="color:#555;font-size:10px;">∞ Patient</span>`;
            }

            // Stop-loss info
            let stopLossInfo = '';
            if (bot.status === 'yes_filled') {
                const triggerAt = (bot.yes_price || 0) - stopLoss;
                stopLossInfo = `<div style="background:#ff444411;border:1px solid #ff444433;border-radius:5px;padding:4px 8px;font-size:10px;color:#ff6666;margin-top:6px;">
                    🛑 Stop-loss: sells YES if bid drops to <strong>${triggerAt}¢</strong> (−${stopLoss}¢ from entry)
                </div>`;
            } else if (bot.status === 'no_filled') {
                const triggerAt = (bot.no_price || 0) - stopLoss;
                stopLossInfo = `<div style="background:#ff444411;border:1px solid #ff444433;border-radius:5px;padding:4px 8px;font-size:10px;color:#ff6666;margin-top:6px;">
                    🛑 Stop-loss: sells NO if bid drops to <strong>${triggerAt}¢</strong> (−${stopLoss}¢ from entry)
                </div>`;
            }

            // Net P&L so far (from previous completed cycles)
            let netPnlInfo = '';
            const netPnl = bot.net_pnl_cents || 0;
            if (netPnl !== 0 && repeatCount > 0) {
                const sign = netPnl > 0 ? '+' : '';
                const color = netPnl > 0 ? '#00ff88' : '#ff4444';
                netPnlInfo = `<span style="color:${color};font-size:10px;font-weight:700;">${sign}${netPnl}¢ earned</span>`;
            }

            const item = document.createElement('div');
            item.className = 'bot-item';
            item.style.cssText = 'flex-direction:column;gap:8px;border-left:3px solid #ffaa00;';
            item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <strong style="color:#fff;font-size:13px;">${displayName}</strong>
                        <span class="bot-status ${statusClass}">${statusLabel}</span>
                        ${cycleInfo}
                        <button onclick="toggleBotPhase('${botId}','${phase === 'live' ? 'pregame' : 'live'}')"
                                style="background:${phase === 'live' ? '#ff333322' : '#1e2740'};border:1px solid ${phase === 'live' ? '#ff333366' : '#2a3550'};color:${phase === 'live' ? '#ff6666' : '#8892a6'};padding:1px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;"
                                title="Auto-detected from ESPN. Click to override.">${phaseIcon} ${phaseLabel}</button>
                        <span style="color:#00ff88;font-weight:800;font-size:13px;">+${profit}¢</span>
                        <span style="color:#8892a6;font-size:11px;">×${qty} = $${(profit * qty / 100).toFixed(2)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${netPnlInfo}
                        ${timeoutInfo}
                        <span style="color:#555;font-size:10px;" title="Total time alive">${createdMin}m${repostCount > 0 ? ` · ${repostCount}↻` : ''}</span>
                        <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;"
                                onclick="cancelBot('${botId}')">✕</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11px;">
                    <div>
                        <div style="display:flex;justify-content:space-between;color:#8892a6;margin-bottom:3px;">
                            <span>YES @ <strong style="color:#00ff88;">${bot.yes_price || '?'}¢</strong></span>
                            <span style="color:${yFill >= qty ? '#00ff88' : '#8892a6'};">${yFill}/${qty} ${yFill >= qty ? '✓' : ''}</span>
                        </div>
                        <div style="height:3px;background:#1e2740;border-radius:2px;">
                            <div style="height:3px;width:${yPct}%;background:${yFill >= qty ? '#00ff88' : '#00ff8866'};border-radius:2px;transition:width .5s;"></div>
                        </div>
                        ${bot.live_yes_bid != null ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#555;">
                            <span>Bid: <strong style="color:#00ff8899;">${bot.live_yes_bid}¢</strong></span>
                            <span>Ask: <strong style="color:#00ff8899;">${bot.live_yes_ask || '?'}¢</strong></span>
                        </div>` : ''}
                    </div>
                    <div>
                        <div style="display:flex;justify-content:space-between;color:#8892a6;margin-bottom:3px;">
                            <span>NO @ <strong style="color:#ff4444;">${bot.no_price || '?'}¢</strong></span>
                            <span style="color:${nFill >= qty ? '#ff4444' : '#8892a6'};">${nFill}/${qty} ${nFill >= qty ? '✓' : ''}</span>
                        </div>
                        <div style="height:3px;background:#1e2740;border-radius:2px;">
                            <div style="height:3px;width:${nPct}%;background:${nFill >= qty ? '#ff4444' : '#ff444466'};border-radius:2px;transition:width .5s;"></div>
                        </div>
                        ${bot.live_no_bid != null ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#555;">
                            <span>Bid: <strong style="color:#ff444499;">${bot.live_no_bid}¢</strong></span>
                            <span>Ask: <strong style="color:#ff444499;">${bot.live_no_ask || '?'}¢</strong></span>
                        </div>` : ''}
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#555;border-top:1px solid #1e2740;padding-top:6px;margin-top:2px;">
                    <span>🎟 ${bot.ticker || '?'}</span>
                    <span>Stop-loss: <strong style="color:#ff6666;">−${stopLoss}¢</strong></span>
                    <span>${phase === 'live' ? '🔴 Active mgmt' : '⏳ Patient mode'}</span>
                    <span>${!autoMonitorInterval ? '⚠️ Monitor OFF' : '🤖 Monitoring'}</span>
                </div>
                ${stopLossInfo}`;
            botsList.appendChild(item);
        });

        updateBotBuddy(activeBotCount, filledLegs);
        updateBotsBadge(activeBotCount);
    } catch (error) {
        console.error('Error loading bots:', error);
    }
}

// Update nav badge with active bot count
function updateBotsBadge(count) {
    const badge = document.getElementById('bots-badge');
    if (!badge) return;
    if (count > 0) {
        badge.style.display = 'inline';
        badge.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

// Always start monitoring after login — bots should never go unmonitored
async function autoResumeMonitor() {
    if (!autoMonitorInterval) {
        console.log('🔄 Starting auto-monitor (always-on)');
        autoMonitorInterval = setInterval(monitorBots, 2000);
        const button = document.getElementById('auto-monitor-text');
        const buddy  = document.getElementById('bot-buddy');
        if (button) button.textContent = '⏸️ Pause Monitor';
        if (buddy) { buddy.classList.remove('idle'); buddy.classList.add('active'); }
        monitorBots();
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

// Clear all finished (completed + stopped) bots from the list
async function clearFinishedBots() {
    if (!confirm('Remove all finished bots from the list?')) return;
    try {
        const response = await fetch(`${API_BASE}/bot/list`);
        const data = await response.json();
        const bots = data.bots || {};
        const finishedIds = Object.keys(bots).filter(id =>
            bots[id].status === 'completed' || bots[id].status === 'stopped'
        );
        for (const id of finishedIds) {
            await fetch(`${API_BASE}/bot/cancel/${id}`, { method: 'DELETE' });
        }
        loadBots();
    } catch (error) {
        console.error('Error clearing finished bots:', error);
    }
}

// Toggle auto-monitor (pause/resume — but monitor auto-restarts on bot creation)
function toggleAutoMonitor() {
    const button = document.getElementById('auto-monitor-text');
    const buddy  = document.getElementById('bot-buddy');
    
    if (autoMonitorInterval) {
        clearInterval(autoMonitorInterval);
        autoMonitorInterval = null;
        if (button) button.textContent = '▶️ Resume Monitor';
        if (buddy) { buddy.classList.add('idle'); buddy.classList.remove('active'); }
        updateBotBuddyMsg('idle');
    } else {
        autoMonitorInterval = setInterval(monitorBots, 2000);
        if (button) button.textContent = '⏸️ Pause Monitor';
        if (buddy) { buddy.classList.remove('idle'); buddy.classList.add('active'); }
        updateBotBuddyMsg('scanning');
        monitorBots();
    }
    // Re-render bots so the "Monitor OFF/ON" label updates
    loadBots();
}

// Bot buddy messages — rotates through fun status messages
const botBuddyMessages = {
    idle: [
        `<strong>Idle</strong> — Enable Auto-Monitor to put me to work!`,
        `<strong>Sleeping...</strong> Hit the monitor button and I'll watch your bots 24/7`,
        `<strong>Standing by</strong> — Your bots aren't being watched right now`,
    ],
    scanning: [
        `<strong>Working!</strong> Checking fills every 2 seconds...`,
        `<strong>On it!</strong> Watching order books, detecting fills...`,
        `<strong>Monitoring</strong> — I'll repost stale orders & trigger stop-losses`,
        `<strong>Scanning...</strong> Keeping an eye on your positions`,
        `<strong>Active!</strong> I'll handle reposts, resizes & stop-losses`,
    ],
    filled: [
        `<strong>Nice!</strong> A leg just filled — watching the other side closely`,
        `<strong>Progress!</strong> One side is in, guarding against adverse moves`,
    ],
    completed: [
        `<strong>Locked in!</strong> Both sides filled — profit secured at settlement 🎉`,
    ],
};
let lastBuddyMsgIdx = -1;

function updateBotBuddyMsg(state) {
    const el = document.getElementById('bot-buddy-msg');
    if (!el) return;
    const pool = botBuddyMessages[state] || botBuddyMessages.idle;
    let idx = Math.floor(Math.random() * pool.length);
    if (idx === lastBuddyMsgIdx && pool.length > 1) idx = (idx + 1) % pool.length;
    lastBuddyMsgIdx = idx;
    const dotColor = state === 'idle' ? '#555' : (state === 'completed' ? '#00ff88' : '#00ff88');
    el.innerHTML = `<span class="bot-buddy-status-dot" style="background:${dotColor};${state === 'idle' ? 'animation:none;' : ''}"></span>${pool[idx]}`;
}

function updateBotBuddy(activeCount, filledLegs) {
    const buddy = document.getElementById('bot-buddy');
    if (!buddy) return;
    // Show buddy whenever there are any bots (active or not)
    if (activeCount > 0 || document.getElementById('bots-section')?.style.display === 'block') {
        buddy.style.display = 'flex';
    }
    if (!autoMonitorInterval) {
        updateBotBuddyMsg('idle');
        return;
    }
    if (filledLegs > 0) {
        updateBotBuddyMsg('filled');
    } else if (activeCount > 0) {
        updateBotBuddyMsg('scanning');
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
                    } else if (action.action === 'repeat_spawned') {
                        showNotification(`🔄 REPEAT #${action.repeat_num}/${action.repeat_total}: YES ${action.yes_price}¢ + NO ${action.no_price}¢ → ${action.profit_per}¢ profit`);
                    } else if (action.action === 'auto_phase_live') {
                        showNotification(`🏟 Game went LIVE — bot ${action.bot_id} auto-switched to LIVE mode`);
                    } else if (action.action === 'stop_loss_yes') {
                        showNotification(`⚠️ Stop-loss YES on ${action.bot_id} | loss: ${(action.loss_cents/100).toFixed(2)}${action.verified ? ' ✓' : ''}`);
                    } else if (action.action === 'stop_loss_no') {
                        showNotification(`⚠️ Stop-loss NO on ${action.bot_id} | loss: ${(action.loss_cents/100).toFixed(2)}${action.verified ? ' ✓' : ''}`);
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
    const sportParam = (currentSportFilter && currentSportFilter !== 'all' && currentSportFilter !== 'live')
        ? `&sport=${currentSportFilter}` : '';
    showNotification(`🔍 Scanning all sports markets for ≥ ${minWidth}¢ spread...`);
    try {
        const resp = await fetch(`${API_BASE}/bot/scan?min_width=${minWidth}${sportParam}`);
        const data = await resp.json();
        if (data.error) { showNotification(`❌ Scan failed: ${data.error}`); return; }
        showScanResults(data.opportunities || [], minWidth, data.total_scanned || 0);
    } catch (err) {
        showNotification(`❌ Scan error: ${err.message}`);
    }
}

function showScanResults(opportunities, minWidth, totalScanned) {
    const modal   = document.getElementById('scan-modal');
    const results = document.getElementById('scan-results');
    const countEl = document.getElementById('scan-count');
    if (!modal || !results) return;

    if (countEl) countEl.textContent = `${opportunities.length} found / ${totalScanned} scanned (≥ ${minWidth}¢)`;

    if (opportunities.length === 0) {
        results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">
            No limit-order arb opportunities ≥ ${minWidth}¢ spread found across ${totalScanned} markets.<br>
            <span style="font-size:12px;">Try lowering the min width, or check back when more games are active.</span>
        </p>`;
    } else {
        results.innerHTML = opportunities.slice(0, 50).map(opp => {
            const profitColor = opp.width >= 10 ? '#ffaa00' : opp.width >= 5 ? '#00ff88' : '#8892a6';
            const liveTag = opp.is_live
                ? `<span style="background:#ff333333;color:#ff3333;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;margin-left:6px;">🔴 LIVE</span>`
                : '';
            // Game date/time tag
            const dateStr = opp.game_date || '';
            const timeStr = opp.game_time || '';
            const dateTimeLabel = dateStr ? `<span style="color:#6a7488;font-size:10px;margin-left:6px;">📅 ${dateStr}${timeStr ? ' · ' + timeStr : ''}</span>` : '';
            // Catch speed badge
            const speedColors = { prime: '#00ff88', fast: '#ffaa00', moderate: '#ff9944', slow: '#555' };
            const speedColor = speedColors[opp.catch_speed] || '#555';
            const speedLabel = (opp.catch_speed || 'slow').toUpperCase();
            return `<div style="background:#0a0e1a;border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-left:3px solid ${profitColor};">
                <div style="flex:1;min-width:0;">
                    <div style="color:#fff;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${opp.title || opp.ticker}${liveTag}${dateTimeLabel}
                        <span style="background:${speedColor}22;color:${speedColor};padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;margin-left:6px;">${speedLabel}</span>
                    </div>
                    <div style="color:#8892a6;font-size:11px;margin-top:3px;">
                        Bids: YES ${opp.yes_bid}¢ / NO ${opp.no_bid}¢ &nbsp;·&nbsp; 
                        Spreads: YES ${opp.yes_spread}¢ / NO ${opp.no_spread}¢ &nbsp;·&nbsp;
                        Liq: ${Math.round((opp.liquidity || 0) * 100)}%
                    </div>
                    <div style="color:#6a7488;font-size:10px;margin-top:2px;">
                        Post at YES ${opp.suggested_yes}¢ + NO ${opp.suggested_no}¢ → lock +${opp.profit_posted}¢/contract
                        &nbsp;·&nbsp; Catch: ${opp.catch_score || 0}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                    <div style="text-align:right;">
                        <div style="color:${profitColor};font-weight:800;font-size:1.3rem;">+${opp.profit_posted}¢</div>
                        <div style="color:#6a7488;font-size:10px;">gap ${opp.width}¢</div>
                    </div>
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
    // Read qty from scan modal first, fall back to controls bar
    const quantity        = parseInt(document.getElementById('scan-modal-qty')?.value || document.getElementById('scan-qty')?.value || '1');
    const stop_loss_cents = 5;
    const totalCost       = (yesPrice + noPrice) * quantity;
    const profitPer       = 100 - yesPrice - noPrice;

    if (!confirm(`⚡ Place Dual-Arb Bot — ${quantity} contract(s)\n\nTicker: ${ticker}\nYES limit buy: ${yesPrice}¢\nNO limit buy: ${noPrice}¢\nTotal cost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nProfit if both fill: +${profitPer}¢/contract\n\nConfirm?`)) return;

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

// ─── Toggle bot phase (pregame ↔ live) ────────────────────────────────────────
async function toggleBotPhase(botId, newPhase) {
    try {
        const resp = await fetch(`${API_BASE}/bot/set_phase/${botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phase: newPhase }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`${newPhase === 'live' ? '🔴' : '⏳'} Bot switched to ${newPhase.toUpperCase()}`);
            loadBots();
        } else {
            showNotification(`❌ ${data.error}`);
        }
    } catch (err) {
        showNotification(`❌ ${err.message}`);
    }
}

// ─── Middle Spread Scanner ────────────────────────────────────────────────────
async function scanMiddles() {
    showNotification('📐 Scanning for middle spread opportunities...');
    try {
        const resp = await fetch(`${API_BASE}/scan/middles`);
        const data = await resp.json();
        if (data.error) { showNotification(`❌ ${data.error}`); return; }
        showMiddlesResults(data);
    } catch (err) {
        showNotification(`❌ Middles scan error: ${err.message}`);
    }
}

function showMiddlesResults(data) {
    const modal   = document.getElementById('middles-modal');
    const results = document.getElementById('middles-results');
    const countEl = document.getElementById('middles-count');
    if (!modal || !results) return;

    const middles = data.middles || [];
    if (countEl) countEl.textContent = `${middles.length} middles / ${data.total_spreads || 0} spreads`;

    if (middles.length === 0) {
        results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">
            No middle opportunities found across ${data.games_with_spreads || 0} games with spread markets.<br>
            <span style="font-size:12px;">Middles require spread lines for opposing teams in the same game.</span>
        </p>`;
    } else {
        results.innerHTML = middles.slice(0, 60).map(m => {
            const isGuaranteed = m.guaranteed_profit > 0;
            const borderColor = isGuaranteed ? '#00ff88' : '#ffaa00';
            const guarLabel = isGuaranteed
                ? `<span style="background:#00ff8822;color:#00ff88;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">✓ GUARANTEED ARB</span>`
                : `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">MIDDLE BET</span>`;
            const liveTag = m.is_live
                ? `<span style="background:#ff333333;color:#ff3333;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;margin-left:6px;">🔴 LIVE</span>`
                : '';
            // Game date/time
            const mDateStr = m.game_date || '';
            const mTimeStr = m.game_time || '';
            const mDateTimeLabel = mDateStr ? `<span style="color:#6a7488;font-size:10px;margin-left:6px;">📅 ${mDateStr}${mTimeStr ? ' · ' + mTimeStr : ''}</span>` : '';
            const speedColors = { prime: '#00ff88', fast: '#ffaa00', moderate: '#ff9944', slow: '#555' };
            const speedColor = speedColors[m.catch_speed] || '#555';
            const speedLabel = (m.catch_speed || 'slow').toUpperCase();
            const midWidth = m.middle_width % 1 === 0 ? m.middle_width : m.middle_width.toFixed(1);
            return `<div style="background:#0a0e1a;border-radius:8px;padding:12px 14px;margin-bottom:10px;border-left:3px solid ${borderColor};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div>
                        <span style="color:#fff;font-weight:700;font-size:14px;">${m.team_a} vs ${m.team_b}</span>
                        ${guarLabel}${liveTag}${mDateTimeLabel}
                        <span style="background:${speedColor}22;color:${speedColor};padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;margin-left:4px;">${speedLabel}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:${isGuaranteed ? '#00ff88' : '#ffaa00'};font-weight:800;font-size:16px;">${isGuaranteed ? '+' : ''}${m.guaranteed_profit}¢</div>
                        <div style="color:#6a7488;font-size:10px;">guaranteed</div>
                    </div>
                </div>
                <div style="font-size:11px;color:#8892a6;margin-bottom:8px;line-height:1.6;">
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                        <span style="color:#ff4444;font-weight:700;font-size:10px;min-width:20px;">NO</span>
                        <span>${m.title_a} @ <strong style="color:#fff;">${m.no_a_bid}¢</strong> <span style="color:#6a7488;font-size:10px;">(spread ${m.no_spread_a || 0}¢)</span></span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                        <span style="color:#ff4444;font-weight:700;font-size:10px;min-width:20px;">NO</span>
                        <span>${m.title_b} @ <strong style="color:#fff;">${m.no_b_bid}¢</strong> <span style="color:#6a7488;font-size:10px;">(spread ${m.no_spread_b || 0}¢)</span></span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-top:6px;padding:6px 8px;background:#0f1419;border-radius:6px;">
                        <div>Mkt cost: <strong style="color:#fff;">${m.cost}¢</strong></div>
                        <div>Middle: <strong style="color:#fff;">${midWidth} pts</strong></div>
                        <div>Both win: <strong style="color:#00ff88;">+${m.middle_profit}¢</strong></div>
                        <div>Catch: <strong style="color:${speedColor};">${m.catch_score}</strong> · Liq ${Math.round((m.liquidity || 0) * 100)}%</div>
                    </div>
                    <div style="margin-top:6px;color:#6a7488;font-size:10px;">
                        ↳ Post at NO ${m.suggested_a}¢ + NO ${m.suggested_b}¢ = ${m.suggested_a + m.suggested_b}¢ → <strong style="color:#00ff88;">+${m.suggested_profit || (100 - m.suggested_a - m.suggested_b)}¢ guaranteed</strong>
                    </div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="placeMiddle('${m.ticker_a}','${m.ticker_b}',${m.suggested_a},${m.suggested_b})"
                            style="background:${isGuaranteed ? '#00ff88' : '#ffaa00'};color:#000;border:none;padding:5px 14px;border-radius:5px;cursor:pointer;font-weight:700;font-size:11px;">
                        📐 Place Middle
                    </button>
                </div>
            </div>`;
        }).join('');
    }
    modal.classList.add('show');
}

async function placeMiddle(tickerA, tickerB, priceA, priceB) {
    const qty = parseInt(document.getElementById('middles-modal-qty')?.value || '1');
    const cost = (priceA + priceB) * qty;
    const guaranteed = (100 - priceA - priceB) * qty;
    const middle = (200 - priceA - priceB) * qty;

    if (!confirm(`📐 Place Middle — ${qty} contract(s)\n\nLeg 1: NO ${tickerA} at ${priceA}¢\nLeg 2: NO ${tickerB} at ${priceB}¢\n\nTotal cost: ${cost}¢ ($${(cost / 100).toFixed(2)})\nGuaranteed: ${guaranteed >= 0 ? '+' : ''}${guaranteed}¢\nIf middle hits: +${middle}¢\n\nConfirm?`)) return;

    try {
        const order1 = await fetch(`${API_BASE}/order/single`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: tickerA, side: 'no', price: priceA, quantity: qty }),
        }).then(r => r.json());
        const order2 = await fetch(`${API_BASE}/order/single`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: tickerB, side: 'no', price: priceB, quantity: qty }),
        }).then(r => r.json());

        if (order1.success && order2.success) {
            showNotification(`📐 Middle placed! NO on both spreads deployed.`);
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            showNotification(`❌ Middle error: ${order1.error || order2.error}`);
        }
    } catch (err) {
        showNotification(`❌ Network error: ${err.message}`);
    }
}

function closeMiddlesModal() {
    document.getElementById('middles-modal')?.classList.remove('show');
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
        const dayLabel = pnl.day_key || new Date().toISOString().split('T')[0];

        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Daily P&L <span style="color:#555;font-size:9px;">${dayLabel}</span></span>
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

// ─── Trade History ────────────────────────────────────────────────────────────
function toggleTradeHistory() {
    switchTab('history');
}

async function loadTradeHistory() {
    const el = document.getElementById('trade-history-list');
    if (!el) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/history?limit=50`);
        const data = await resp.json();
        const trades = data.trades || [];
        
        // Clear button at top
        let clearBtn = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <button onclick="clearTradeHistory()" style="background:#2a1a1a;border:1px solid #ff4444;color:#ff4444;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">Clear History</button>
        </div>`;
        
        if (trades.length === 0) {
            el.innerHTML = clearBtn + '<p style="color:#555;text-align:center;">No completed or stopped trades yet. Start fresh!</p>';
            return;
        }
        
        const rows = trades.map(t => {
            // Date & time
            const dt = new Date(t.timestamp * 1000);
            const date = dt.toLocaleDateString([], {month:'short', day:'numeric'});
            const time = dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            // Placed-at time (when bot was created)
            const placedDt = t.placed_at ? new Date(t.placed_at * 1000) : null;
            const placedTime = placedDt ? placedDt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            
            // Result styling
            const isWin = t.result === 'completed' || t.result === 'take_profit_watch';
            const isSL = t.result?.includes('stop_loss');
            const pnl = isWin ? (t.profit_cents || 0) : -(t.loss_cents || 0);
            const pnlColor = pnl >= 0 ? '#00ff88' : '#ff4444';
            const icon = isWin ? '✅' : '⛔';
            const resultLabel = isWin ? 'FILLED' : (isSL ? 'STOP LOSS' : 'STOPPED');
            
            // Sportsbook-style display name
            const teamName = formatBotDisplayName(t.ticker || '');
            
            // Verified badge
            const verified = t.verified_prices || t.verified_cleared ? '<span style="color:#00ff88;font-size:9px;margin-left:4px;">✓ verified</span>' : '';
            
            // Watch vs Arb type
            const tradeType = t.type === 'watch' ? 'WATCH' : 'ARB';
            const typeColor = t.type === 'watch' ? '#ffaa00' : '#00aaff';
            
            return `
                <div style="background:#0f1419;border:1px solid ${isWin ? '#00ff8822' : '#ff444422'};border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                            <span style="font-size:14px;">${icon}</span>
                            <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                            <span style="background:${typeColor}22;color:${typeColor};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${tradeType}</span>
                            ${verified}
                        </div>
                        <div style="color:#555;font-size:10px;margin-bottom:4px;">${t.ticker || ''}</div>
                        <div style="display:flex;gap:12px;font-size:11px;">
                            <span style="color:#8892a6;">Placed: <strong style="color:#aaa;">${placedTime || '—'}</strong></span>
                            <span style="color:#8892a6;">Closed: <strong style="color:#aaa;">${time}</strong></span>
                            <span style="color:#8892a6;">${date}</span>
                        </div>
                        <div style="display:flex;gap:12px;font-size:11px;margin-top:4px;">
                            ${t.yes_price ? `<span style="color:#00ff88;">YES ${t.yes_price}¢</span>` : ''}
                            ${t.no_price ? `<span style="color:#ff4444;">NO ${t.no_price}¢</span>` : ''}
                            <span style="color:#8892a6;">×${t.quantity || 1}</span>
                        </div>
                    </div>
                    <div style="text-align:right;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
                        <div style="color:${pnlColor};font-weight:800;font-size:16px;">${pnl >= 0 ? '+' : ''}${pnl}¢</div>
                        <div style="color:${pnlColor};font-size:10px;font-weight:600;">${resultLabel}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        el.innerHTML = clearBtn + `<div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>`;
    } catch (err) {
        el.innerHTML = `<p style="color:#ff4444;">Failed to load history: ${err.message}</p>`;
    }
}

async function clearTradeHistory() {
    if (!confirm('Clear all trade history and reset P&L? This cannot be undone.')) return;
    try {
        await fetch(`${API_BASE}/bot/history/clear`, { method: 'POST' });
        loadTradeHistory();
        loadPnL();
        showNotification('History cleared, P&L reset');
    } catch (err) {
        showNotification('Failed to clear history: ' + err.message);
    }
}

// ─── POSITIONS TAB: Show Kalshi positions + Watch feature ─────────────────────

let watchTarget = null; // position being set up for watching

async function loadPositions() {
    const el = document.getElementById('positions-list');
    if (!el) return;
    el.innerHTML = '<p style="color:#8892a6;text-align:center;padding:24px;">Loading positions from Kalshi...</p>';

    try {
        const resp = await fetch(`${API_BASE}/positions/active`);
        const data = await resp.json();
        if (data.error) {
            el.innerHTML = `<p style="color:#ff4444;text-align:center;padding:24px;">Error: ${data.error}</p>`;
            return;
        }

        const positions = data.positions || [];
        if (positions.length === 0) {
            el.innerHTML = `<div class="empty-state"><div class="icon">💼</div><div class="title">No open positions</div><div class="desc">You don't have any active positions on Kalshi right now.<br>Place trades from the Markets tab or directly on kalshi.com</div></div>`;
            return;
        }

        el.innerHTML = positions.map(pos => {
            const sideColor = pos.side === 'yes' ? '#00ff88' : '#ff4444';
            const bid = pos.side === 'yes' ? pos.yes_bid : pos.no_bid;
            const ask = pos.side === 'yes' ? pos.yes_ask : pos.no_ask;
            const exposure = (pos.market_exposure / 100).toFixed(2);
            const realizedPnl = (pos.realized_pnl / 100).toFixed(2);
            const pnlColor = pos.realized_pnl >= 0 ? '#00ff88' : '#ff4444';
            const isWatched = !!pos.watched_by;

            return `<div class="position-card" style="${isWatched ? 'border-color:#9966ff66;' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                        <span class="side-badge ${pos.side}">${pos.side.toUpperCase()}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="color:#fff;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pos.title}</div>
                            <div style="color:#555;font-size:10px;margin-top:2px;">${pos.ticker}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                        ${isWatched
                            ? `<span style="color:#9966ff;font-size:11px;font-weight:600;">👁 Watched</span>`
                            : `<button onclick="openWatchModal('${pos.ticker}','${pos.side}',${pos.quantity},${bid})"
                                     class="btn" style="background:#9966ff22;color:#9966ff;border:1px solid #9966ff44;padding:5px 12px;font-size:11px;font-weight:600;">
                                👁 Watch
                              </button>`
                        }
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:12px;color:#8892a6;">
                    <div>Qty: <strong style="color:#fff;">${pos.quantity}</strong></div>
                    <div>Bid: <strong style="color:${sideColor};">${bid}¢</strong></div>
                    <div>Exposure: <strong style="color:#fff;">$${exposure}</strong></div>
                    <div>Realized: <strong style="color:${pnlColor};">$${realizedPnl}</strong></div>
                </div>
                ${pos.resting_orders ? `<div style="margin-top:6px;font-size:10px;color:#555;">${pos.resting_orders} resting order(s)</div>` : ''}
            </div>`;
        }).join('');
    } catch (err) {
        el.innerHTML = `<p style="color:#ff4444;text-align:center;">Failed to load positions: ${err.message}</p>`;
    }
}

function openWatchModal(ticker, side, quantity, currentBid) {
    watchTarget = { ticker, side, quantity, currentBid };
    document.getElementById('watch-market-info').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="color:#fff;font-weight:600;font-size:14px;">${ticker}</div>
                <div style="color:#8892a6;font-size:11px;margin-top:2px;">
                    <span class="side-badge ${side}" style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${side==='yes'?'#00ff8822':'#ff444422'};color:${side==='yes'?'#00ff88':'#ff4444'};">${side.toUpperCase()}</span>
                    × ${quantity} contracts
                </div>
            </div>
            <div style="text-align:right;">
                <div style="color:#8892a6;font-size:10px;">Current bid</div>
                <div style="color:${side==='yes'?'#00ff88':'#ff4444'};font-weight:800;font-size:20px;">${currentBid}¢</div>
            </div>
        </div>
    `;
    document.getElementById('watch-entry-price').value = currentBid;
    document.getElementById('watch-quantity').value = quantity;
    document.getElementById('watch-stop-loss').value = 5;
    document.getElementById('watch-take-profit').value = 0;
    document.getElementById('watch-modal').classList.add('show');
}

function closeWatchModal() {
    document.getElementById('watch-modal').classList.remove('show');
    watchTarget = null;
}

async function confirmWatchPosition() {
    if (!watchTarget) return;

    const entryPrice = parseInt(document.getElementById('watch-entry-price').value);
    const quantity = parseInt(document.getElementById('watch-quantity').value);
    const stopLoss = parseInt(document.getElementById('watch-stop-loss').value);
    const takeProfit = parseInt(document.getElementById('watch-take-profit').value);

    // Risk warnings
    const warnings = [];
    if (stopLoss < 3) warnings.push('Stop-loss < 3¢ is very tight — you may get stopped out by normal volatility.');
    if (stopLoss > 20) warnings.push('Stop-loss > 20¢ means you could lose significant capital before exiting.');
    if (takeProfit > 0 && takeProfit < 3) warnings.push('Take-profit < 3¢ is very tight — may trigger prematurely.');

    const warnEl = document.getElementById('watch-risk-warning');
    if (warnings.length > 0) {
        warnEl.innerHTML = warnings.map(w => `<div class="risk-warning"><span class="icon">⚠️</span>${w}</div>`).join('');
    } else {
        warnEl.innerHTML = '';
    }

    const slPrice = entryPrice - stopLoss;
    const tpDesc = takeProfit > 0 ? `, take-profit at ${entryPrice + takeProfit}¢` : '';
    if (!confirm(`👁 Watch ${watchTarget.side.toUpperCase()} position on ${watchTarget.ticker}\n\n` +
                 `Entry: ${entryPrice}¢ × ${quantity} contracts\n` +
                 `Stop-loss: sells if bid drops to ${slPrice}¢${tpDesc}\n\n` +
                 `The bot will market-sell your position if triggered.\nConfirm?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/watch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: watchTarget.ticker,
                side: watchTarget.side,
                entry_price: entryPrice,
                quantity: quantity,
                stop_loss_cents: stopLoss,
                take_profit_cents: takeProfit,
            }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`👁 ${data.message}`);
            closeWatchModal();
            loadPositions();
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            showNotification(`❌ ${data.error}`);
        }
    } catch (err) {
        showNotification(`❌ Network error: ${err.message}`);
    }
}

// ─── RISK WARNINGS ────────────────────────────────────────────────────────────

function generateBotRiskWarnings() {
    const yes = parseInt(document.getElementById('bot-yes-price')?.value) || 0;
    const no = parseInt(document.getElementById('bot-no-price')?.value) || 0;
    const qty = parseInt(document.getElementById('bot-quantity')?.value) || 1;
    const sl = parseInt(document.getElementById('bot-stop-loss-cents')?.value) || 5;
    const total = yes + no;

    const warnings = [];
    if (total >= 100) {
        warnings.push({ level: 'error', msg: `YES(${yes}¢) + NO(${no}¢) = ${total}¢ — this is NOT profitable. Total must be below 100¢.` });
    }
    if (total >= 97 && total < 100) {
        warnings.push({ level: 'warn', msg: `Only ${100-total}¢ profit per contract — very thin margin. Consider wider spread.` });
    }
    if (yes > 90 || no > 90) {
        warnings.push({ level: 'warn', msg: `Buying at ${Math.max(yes,no)}¢ is very expensive — limited upside, high risk if it drops.` });
    }
    if (yes < 5 || no < 5) {
        warnings.push({ level: 'warn', msg: `Buying at ${Math.min(yes,no)}¢ is very unlikely to fill — the market may not have liquidity there.` });
    }
    if (sl < 3) {
        warnings.push({ level: 'warn', msg: `Stop-loss of ${sl}¢ is very tight. Normal price fluctuations could trigger it.` });
    }
    if (sl > 15) {
        warnings.push({ level: 'warn', msg: `Stop-loss of ${sl}¢ means you could lose up to $${(sl * qty / 100).toFixed(2)} before exiting.` });
    }

    const el = document.getElementById('bot-risk-warnings');
    if (!el) return;
    if (warnings.length === 0) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = warnings.map(w => {
        const color = w.level === 'error' ? '#ff4444' : '#ffaa00';
        const bg = w.level === 'error' ? '#ff444415' : '#ffaa0015';
        const border = w.level === 'error' ? '#ff444444' : '#ffaa0044';
        return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:${color};display:flex;align-items:center;gap:8px;"><span style="font-size:14px;">⚠️</span>${w.msg}</div>`;
    }).join('');
}
