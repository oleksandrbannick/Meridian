// Meridian — Sports Trading Terminal
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : `${window.location.origin}/api`;
let allMarkets = [];
let autoMonitorInterval = null;
let liveScoresInterval = null;
let selectedMarket = null;
let selectedSide = null;
let currentSportFilter = 'all';
let currentLiveFilter = false;  // true = show only live games within sport
let liveGames = {}; // keyed by team abbreviation pairs for quick lookup
let allGameData = {}; // ALL games (pre/in/post) for score display on every card
let openingLines = {}; // ticker -> {yes_price, captured_at} — pre-game closing lines
let boxScoreCache = {}; // {espnGameId: {players: {...}, ts: Date.now()}}
let expandedSections = new Set(); // Track which collapsibles are open across re-renders
let priceRefreshInterval = null; // Interval for live price updates on main screen

// ─── Box Score: live player stats from ESPN ──────────────────────────────────
async function fetchBoxScore(sport, espnGameId) {
    if (!espnGameId) return null;
    const cached = boxScoreCache[espnGameId];
    if (cached && Date.now() - cached.ts < 30000) return cached;  // 30s TTL
    try {
        const resp = await fetch(`${API_BASE}/boxscore/${sport.toLowerCase()}/${espnGameId}`);
        const data = await resp.json();
        if (data.players) {
            boxScoreCache[espnGameId] = { ...data, ts: Date.now() };
            return boxScoreCache[espnGameId];
        }
    } catch (e) {
        console.warn('Box score fetch failed:', e);
    }
    return null;
}

// Get the current stat value for a player from cached box score
// statType: 'pts', 'reb', 'ast', 'stl', 'blk', '3pt', etc.
function getPlayerLiveStat(playerName, statType) {
    if (!playerName) return null;
    const key = playerName.toLowerCase();
    for (const gameId of Object.keys(boxScoreCache)) {
        const box = boxScoreCache[gameId];
        if (!box || !box.players) continue;
        // Exact match
        const p = box.players[key];
        if (p) {
            // Map stat type to ESPN label
            const espnKey = { 'pts': 'pts', 'reb': 'reb', 'ast': 'ast',
                              'stl': 'stl', 'blk': 'blk', '3pt': '3pt',
                              'to': 'to', 'min': 'min' }[statType] || statType;
            return p[espnKey] !== undefined ? p[espnKey] : null;
        }
        // Fuzzy: try last name match (e.g., "Gilgeous-Alexander" in "Shai Gilgeous-Alexander")
        for (const [pkey, pdata] of Object.entries(box.players)) {
            const pLast = pkey.split(' ').slice(-1)[0];
            const searchLast = key.split(' ').slice(-1)[0];
            if (pLast === searchLast && pLast.length > 3) {
                const espnKey = { 'pts': 'pts', 'reb': 'reb', 'ast': 'ast',
                                  'stl': 'stl', 'blk': 'blk', '3pt': '3pt',
                                  'to': 'to', 'min': 'min' }[statType] || statType;
                return pdata[espnKey] !== undefined ? pdata[espnKey] : null;
            }
        }
    }
    return null;
}

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
    requestPushPermission();
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
    if (tab === 'bots') {
        loadBots(); loadPnL();
        // Always show buddy on bots tab
        const buddy = document.getElementById('bot-buddy');
        if (buddy) buddy.style.display = 'flex';
    }
}

// Navigate from Bots tab to Markets tab and scroll to the relevant market card
async function navigateToMarket(eventTickerPrefix) {
    // 1. Reset any active filters so the target card is guaranteed to be in the DOM
    currentSportFilter = 'all';
    currentLiveFilter = false;
    document.querySelectorAll('.sport-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.sport === 'all');
    });

    // 2. Switch tab
    switchTab('markets');

    // Extract game ID segment (e.g. '26MAR09PHICLE') for broad matching across market types
    const prefixParts = eventTickerPrefix.toUpperCase().split('-');
    const gameIdSegment = prefixParts.length >= 2 ? prefixParts[1] : '';

    const findCard = () => {
        const cards = document.querySelectorAll('[data-event-ticker]');
        for (const card of cards) {
            const ticker = (card.getAttribute('data-event-ticker') || '').toUpperCase();
            if (ticker.startsWith(eventTickerPrefix.toUpperCase()) ||
                (gameIdSegment && ticker.includes(gameIdSegment))) {
                return card;
            }
        }
        return null;
    };

    const highlightCard = (card) => {
        card.scrollIntoView({ behavior: 'auto', block: 'center' });
        card.style.transition = 'box-shadow 0.3s';
        card.style.boxShadow = '0 0 20px rgba(0,170,255,0.5), inset 0 0 12px rgba(0,170,255,0.1)';
        setTimeout(() => { card.style.boxShadow = ''; }, 2000);
    };

    // 3. Load markets if needed (also re-applies filters, which now means show all)
    if (allMarkets.length === 0) {
        await loadMarkets();
    } else {
        applyFilters(); // re-render with reset filters
    }

    // 4. Wait for display:block layout to be computed, then scroll
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const card = findCard();
            if (card) {
                highlightCard(card);
            }
        });
    });
}

// ─── LIVE SCORES ──────────────────────────────────────────────────────────────

async function loadLiveScores() {
    try {
        // Fetch ALL sports in parallel (including women's college basketball + tennis)
        const [nbaRes, nflRes, nhlRes, mlbRes, ncaabRes, ncaawRes, mlsRes, eplRes, uclRes, atpRes, wtaRes] = await Promise.allSettled([
            fetch(`${API_BASE}/scoreboard/nba`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/nfl`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/nhl`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/mlb`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/ncaab`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/ncaaw`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/mls`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/epl`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/ucl`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/atp`).then(r => r.json()),
            fetch(`${API_BASE}/scoreboard/wta`).then(r => r.json()),
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
        addGames(ncaawRes, 'NCAAW');
        addGames(mlsRes, 'MLS');
        addGames(eplRes, 'EPL');
        addGames(uclRes, 'UCL');
        // Tennis: both ATP and WTA use sport='Tennis' to match detectSport()
        addGames(atpRes, 'Tennis');
        addGames(wtaRes, 'Tennis');

        // Build lookup tables — keyed by sport:abbreviation to avoid cross-sport collisions
        // (e.g. HOU = Rockets NBA, Texans NFL, Astros MLB)
        liveGames = {};
        allGameData = {};
        games.forEach(g => {
            const sport = g.sport || '';
            // ALL games for score display (pre, in, post)
            if (g.homeAbbr) allGameData[`${sport}:${g.homeAbbr}`] = g;
            if (g.awayAbbr) allGameData[`${sport}:${g.awayAbbr}`] = g;
            // Tennis: also store under combined pair key to avoid 3-letter collisions
            // (e.g. SHE = Shelton AND Sherif — need pair key to disambiguate)
            if (g.homeAbbr && g.awayAbbr) {
                allGameData[`${sport}:${g.homeAbbr}${g.awayAbbr}`] = g;
                allGameData[`${sport}:${g.awayAbbr}${g.homeAbbr}`] = g;
            }
            // Live filter only uses in-progress games
            if (g.state === 'in') {
                liveGames[`${sport}:${g.awayAbbr}`] = g;
                liveGames[`${sport}:${g.homeAbbr}`] = g;
                if (g.homeAbbr && g.awayAbbr) {
                    liveGames[`${sport}:${g.homeAbbr}${g.awayAbbr}`] = g;
                    liveGames[`${sport}:${g.awayAbbr}${g.homeAbbr}`] = g;
                }
            }
        });

        // Pre-fetch box scores for live games (fire-and-forget for cache warming)
        games.filter(g => g.state === 'in' && g.espnGameId).forEach(g => {
            fetchBoxScore(g.sport, g.espnGameId);
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
        if (sport === 'NBA') {
            // NBA: quarters (or OT)
            if (period <= 4) periodLabel = `Q${period}`;
            else periodLabel = period === 5 ? 'OT' : `${period - 4}OT`;
        } else if (sport === 'NCAAB' || sport === 'NCAAW') {
            // College basketball (men's & women's): halves (or OT)
            if (period <= 2) periodLabel = `${period}H`;
            else periodLabel = period === 3 ? 'OT' : `${period - 2}OT`;
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
        } else if (sport === 'Tennis') {
            // Tennis: sets
            periodLabel = `Set ${period}`;
        } else {
            // Soccer / other: use half or ESPN detail
            if (period <= 2) periodLabel = `${period}H`;
            else periodLabel = statusType.shortDetail || `P${period}`;
        }
    }
    if (state === 'post') periodLabel = statusType.shortDetail || 'Final';

    // Start time for pregame display
    let startTime = '';
    if (state === 'pre') {
        const gameDate = event.date || comp.date || '';
        if (gameDate) {
            const d = new Date(gameDate);
            startTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
        }
    }

    // ESPN status detail ("Halftime", "End of 3rd", "Final", "7:30 PM ET", etc.)
    const statusDetail = statusType.shortDetail || statusType.detail || '';

    return {
        sport,
        espnGameId: event.id || '',  // ESPN game ID for boxscore lookups
        name: event.shortName || event.name || '',
        homeName: (home.team || {}).shortDisplayName || (home.team || {}).displayName || '',
        awayName: (away.team || {}).shortDisplayName || (away.team || {}).displayName || '',
        homeAbbr: (home.team || {}).abbreviation || '',
        awayAbbr: (away.team || {}).abbreviation || '',
        homeScore: home.score || '0',
        awayScore: away.score || '0',
        homeLogo: (home.team || {}).logo || '',
        awayLogo: (away.team || {}).logo || '',
        state,
        clock: status.displayClock || '',
        period,
        periodLabel,
        startTime,
        statusDetail,
        // Game date for matching against ticker dates (prevents future games showing as live)
        gameDate: event.date || comp.date || '',
        // Tennis: set-by-set scores (e.g. "7-5 6-4 3-2")
        homeSetScores: home.setScores || '',
        awaySetScores: away.setScores || '',
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
        // Keep current sport filter — live is client-side only, no reload needed
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

    // If we picked a sport (not toggling live), fetch fresh data
    if (sport !== 'live') {
        loadMarkets();
        return;
    }

    // Live toggle is always client-side — just re-filter existing data
    applyFilters();
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
                case 'ncaab': return (et.includes('NCAAMB') || et.includes('KXMARMAD')) && !et.includes('NCAAWB');
                case 'ncaaw': return et.includes('NCAAWB');
                case 'mls':   return et.includes('MLS') || et.includes('KXMLS');
                case 'soccer': return et.includes('EPL') || et.includes('UCL') || et.includes('MLS');
                case 'tennis': return et.includes('KXATP') || et.includes('KXWTA');
                case 'golf':  return et.includes('KXPGA') || et.includes('KXTGL') || et.includes('KXGOLF');
                case 'nbl':   return et.includes('KXNBL');
                case 'wbc':   return et.includes('KXWBC');
                case 'intl':  return et.includes('KXVTB') || et.includes('KXBSL') || et.includes('KXABA') || et.includes('KXNBL');
                case 'other': return !et.includes('NBA') && !et.includes('NFL') && !et.includes('MLB') && !et.includes('NHL') && !et.includes('NCAA') && !et.includes('KXMARMAD') && !et.includes('MLS') && !et.includes('EPL') && !et.includes('UCL') && !et.includes('KXATP') && !et.includes('KXWTA') && !et.includes('KXPGA') && !et.includes('KXTGL') && !et.includes('KXGOLF') && !et.includes('KXNBL') && !et.includes('KXWBC') && !et.includes('KXVTB') && !et.includes('KXBSL') && !et.includes('KXABA');
                default: return true;
            }
        });
    }

    // LIVE sub-filter — works WITHIN whatever sport is selected
    // Filter per-GAME not per-market: if any market in a game is live, include ALL markets
    // for that game. Prevents partial game cards (e.g. spread shows but winner doesn't)
    if (currentLiveFilter) {
        const liveGameIds = new Set();
        filtered.forEach(m => {
            const eventTicker = m.event_ticker || m.ticker || '';
            const gameId = extractGameId(eventTicker);
            const sport = detectSport(eventTicker);
            if (getLiveScoreForGame(gameId, sport) || isKalshiLive(m)) {
                liveGameIds.add(gameId);
            }
        });
        filtered = filtered.filter(m => {
            const eventTicker = m.event_ticker || m.ticker || '';
            return liveGameIds.has(extractGameId(eventTicker));
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

// Extract team code candidates from a Kalshi gameId
// Handles variable-length codes (2-6 chars) used by college sports
// e.g. "26MAR06WEBBHP" → cleaned="WEBBHP" → tries all split points
function _extractTeamCodes(gameId) {
    if (!gameId) return [];
    // Remove date prefix: 26MAR06WEBBHP → WEBBHP
    const cleaned = gameId.replace(/^\d+[A-Z]{3}\d+/, '');
    if (!cleaned || cleaned.length < 4) return [];
    
    // Try all possible split points (each team 2-6 chars)
    const codes = [];
    for (let i = 2; i <= cleaned.length - 2 && i <= 6; i++) {
        codes.push(cleaned.substring(0, i));
        codes.push(cleaned.substring(cleaned.length - i));
    }
    // Also add the whole string in case it's just one team code somehow
    codes.push(cleaned);
    // Deduplicate
    return [...new Set(codes)];
}

// Check if a Kalshi ticker gameId date matches an ESPN game date
// gameId: "26MAR07BOSMIL" → date = Mar 7, 2026
// espnDate: "2026-03-07T00:00:00Z" or similar ISO string
function _gameIdDateMatchesESPN(gameId, espnGame) {
    if (!gameId || !espnGame || !espnGame.gameDate) return true; // no date info = don't filter
    const dateMatch = gameId.match(/^(\d{2})([A-Z]{3})(\d{2})/);
    if (!dateMatch) return true;
    const monthMap = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    const tickerYear = 2000 + parseInt(dateMatch[1]);
    const tickerMonth = monthMap[dateMatch[2]];
    const tickerDay = parseInt(dateMatch[3]);
    if (tickerMonth === undefined) return true;

    const espnDate = new Date(espnGame.gameDate);
    // ESPN dates are UTC — compare using local date (games are local date)
    // Allow ±1 day tolerance for late-night games that cross midnight
    // Directional tolerance: ESPN date may be up to 1 day BEFORE the ticker date
    // (handles late-night UTC games that cross midnight vs local ticker date)
    // but NEVER after the ticker date (a future market cannot show today's live data)
    const espnDateNorm  = new Date(espnDate.getFullYear(), espnDate.getMonth(), espnDate.getDate());
    const tickerDateNorm = new Date(tickerYear, tickerMonth, tickerDay);
    const today = new Date();
    const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysDiff = (espnDateNorm.getTime() - tickerDateNorm.getTime()) / (1000 * 60 * 60 * 24);
    // For future tickers (tomorrow+), require exact date match — no tolerance.
    // The 1-day tolerance exists only for UTC midnight crossing on today's games,
    // not to allow today's live team data to bleed into tomorrow's markets.
    if (tickerDateNorm.getTime() > todayNorm.getTime()) return daysDiff === 0;
    // For today/past tickers: allow ESPN date same day or 1 day before (UTC midnight crossing)
    return daysDiff >= -1 && daysDiff <= 0;
}

function _findGameInLookup(lookup, gameId, sport) {
    if (!gameId) return null;
    const cleaned = gameId.replace(/^\d+[A-Z]{3}\d+/, '');
    if (!cleaned || cleaned.length < 4) return null;
    
    // ONLY check exact sport — no cross-sport fallback (prevents men's cards showing women's scores)
    if (!sport) return null;
    
    // 1. Try combined pair key first — most reliable, avoids 3-letter code collisions
    //    (e.g. tennis: SHE = Shelton AND Sherif, but SHEOPE is unique)
    const pairMatch = lookup[`${sport}:${cleaned}`];
    if (pairMatch && _gameIdDateMatchesESPN(gameId, pairMatch)) return pairMatch;
    
    // 2. Try all valid split points — only match when BOTH halves
    // correspond to teams in the lookup AND they reference the SAME game
    // Try longest codes first (more specific = better match)
    for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
        const t1 = cleaned.substring(0, i);
        const t2 = cleaned.substring(i);
        const g1 = lookup[`${sport}:${t1}`];
        const g2 = lookup[`${sport}:${t2}`];
        // Both found AND same game (same ESPN ID) — prevents cross-match collisions
        if (g1 && g2 && g1.espnGameId === g2.espnGameId && _gameIdDateMatchesESPN(gameId, g1)) {
            return g1;
        }
    }
    // 3. Fallback: both halves found (even if different games) — for sports without espnGameId
    for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
        const t1 = cleaned.substring(0, i);
        const t2 = cleaned.substring(i);
        const g1 = lookup[`${sport}:${t1}`];
        if (g1 && lookup[`${sport}:${t2}`] && _gameIdDateMatchesESPN(gameId, g1)) {
            return g1;
        }
    }
    // 4. Last resort: find either team individually (longest first)
    for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
        const t1 = cleaned.substring(0, i);
        const t2 = cleaned.substring(i);
        const g = lookup[`${sport}:${t1}`] || lookup[`${sport}:${t2}`];
        if (g && _gameIdDateMatchesESPN(gameId, g)) return g;
    }
    
    return null;
}

function getLiveScoreForGame(gameId, sport) {
    return _findGameInLookup(liveGames, gameId, sport);
}

// Get game data for ANY state (pre/in/post) for scoreboard display
function getGameScore(gameId, sport) {
    return _findGameInLookup(allGameData, gameId, sport);
}

// ─── KALSHI-NATIVE LIVE DETECTION ─────────────────────────────────────────────
// Detects if a game is currently live using Kalshi market data alone.
// Used as fallback for sports ESPN doesn't cover (WBC, BSL, VTB, ABA, etc.)
// Also works when ESPN doesn't list small-conference college games.
// ─── LIQUIDITY ASSESSMENT ──────────────────────────────────────────────────

function getMarketLiquidity(market) {
    const yesBid = getPrice(market, 'yes_bid') || 0;
    const yesAsk = getPrice(market, 'yes_ask') || 0;
    const noBid  = getPrice(market, 'no_bid')  || 0;
    const noAsk  = getPrice(market, 'no_ask')  || 0;
    const vol    = market.volume_24h || market.volume || 0;
    const oi     = market.open_interest || 0;

    // Spread on each side
    const yesSpread = (yesAsk > 0 && yesBid > 0) ? (yesAsk - yesBid) : 99;
    const noSpread  = (noAsk > 0 && noBid > 0)   ? (noAsk - noBid)   : 99;
    const avgSpread = Math.min(yesSpread, noSpread);

    // Arb edge: how much under 100 the bids sum to
    const bidSum = yesBid + noBid;
    const arbEdge = bidSum > 0 ? (100 - bidSum) : 99;

    // Liquidity tier (for preset recommendation)
    let tier, tierLabel, tierColor;
    if (avgSpread <= 4 && vol >= 50) {
        tier = 'tight'; tierLabel = 'TIGHT'; tierColor = '#00ff88';
    } else if (avgSpread <= 8 || vol >= 20) {
        tier = 'medium'; tierLabel = 'MEDIUM'; tierColor = '#60a5fa';
    } else {
        tier = 'wide'; tierLabel = 'WIDE'; tierColor = '#ffaa33';
    }

    return { tier, tierLabel, tierColor, avgSpread, arbEdge, vol, oi, yesBid, noBid, yesAsk, noAsk, bidSum };
}

// ─── GAME SIGNAL — arb-focused: score stability + liquidity, NOT phase-gated ──
// Arbs work the entire game.  The badge tells you HOW STABLE the prices are:
//   🟢 LOCK   — blowout, prices won't flip, deploy with confidence
//   🟢 ANCHOR — strong lead, fav is established, safe deploy
//   🟡 LEAN   — moderate lead, somewhat stable, decent setup
//   🔵 CLOSE  — tight game, prices will swing, arb still works but volatile
//   ⚪ EARLY  — game just started, no score context yet (< 3 min played)

function getGameSignal(gameId, sport, markets) {
    const gameData = getGameScore(gameId, sport);

    // Get liquidity data for display
    const winnerMarkets = markets.filter(m => {
        const t = (m.ticker || '').toUpperCase();
        return t.includes('GAME-') && !t.includes('SPREAD') && !t.includes('TOTAL') && !t.includes('1H');
    });
    let bestLiq = null;
    (winnerMarkets.length ? winnerMarkets : markets).forEach(m => {
        const liq = getMarketLiquidity(m);
        if (!bestLiq || liq.arbEdge < bestLiq.arbEdge) bestLiq = liq;
    });

    const liq = bestLiq || { tier: 'medium', tierLabel: 'MEDIUM', tierColor: '#60a5fa', avgSpread: 99, arbEdge: 99, yesBid: 0, noBid: 0, yesAsk: 0, noAsk: 0 };

    // No live game data — pregame
    if (!gameData || !gameData.state || gameData.state === 'pre') {
        return { type: 'pregame', label: '⏳ PREGAME', color: '#8892a6',
            glowAnim: '', description: 'Waiting for game to start', liq };
    }

    // Game is over
    if (gameData.state === 'post') {
        return { type: 'none', label: 'Final', color: '#555', glowAnim: '', description: 'Game over', liq };
    }

    // ── Game is LIVE ──
    const homeScore = parseInt(gameData.homeScore) || 0;
    const awayScore = parseInt(gameData.awayScore) || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const totalPoints = homeScore + awayScore;
    const period = gameData.period || 0;
    const clock = gameData.clock || '';

    // Parse clock to minutes remaining
    let clockMins = 0;
    const clockMatch = clock.match(/(\d+):(\d+)/);
    if (clockMatch) clockMins = parseInt(clockMatch[1]) + parseInt(clockMatch[2]) / 60;

    const isHalftimeSignal = (gameData.statusDetail || '').toLowerCase().includes('half');
    const phaseLabel = `${gameData.periodLabel} ${clock}`.trim();
    const favPrice = Math.max(liq.yesBid, liq.noBid);

    // ════════════════════════════════════════════════════════════════════════
    // NEW SIGNAL LOGIC — optimised for simultaneous dual-arb
    //
    // Goal: BOTH legs filling is what pays.  A close game bouncing back and
    // forth is IDEAL.  A blowout means only the winner leg ever moves to your
    // limit — the dog leg just sits there.  Near end-of-game means no time for
    // prices to swing back.
    //
    //  🔵 COIN FLIP  — tied / < 1 possession, game is back-and-forth → best
    //  🟢 LEAN       — small lead, still volatile, both legs can fill → good
    //  🟡 DRIFTING   — moderate lead, dog leg filling slower → mediocre
    //  🔴 RUNAWAY    — blowout, dog side dead, skip or use very wide width → bad
    //  ⌛ LATE GAME  — not enough time for swings regardless of score → warning
    //  ⚪ EARLY      — no score context yet
    //  ⏳ PREGAME    — not started
    // ════════════════════════════════════════════════════════════════════════

    // ─── NFL / NCAAF ─────────────────────────────────────────────────────────
    if (sport === 'NFL' || sport === 'NCAAF') {
        const lateAndTight = scoreDiff <= 8 && period >= 4 && clockMins <= 5;
        if (lateAndTight) return { type: 'late_game', label: '⌛ LATE GAME', color: '#ff4444', glowAnim: '',
            description: `±${scoreDiff} pts · ${phaseLabel} — Running out of time, both legs may not fill`, liq };
        if (scoreDiff >= 17) return { type: 'runaway',   label: '🔴 RUNAWAY',   color: '#ff6644', glowAnim: '',
            description: `+${scoreDiff} pts · ${phaseLabel} · Fav ${favPrice}¢ — 3-score lead, dog side dead`, liq };
        if (scoreDiff >= 10) return { type: 'drifting',  label: '🟡 DRIFTING',  color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `+${scoreDiff} pts · ${phaseLabel} · Fav ${favPrice}¢ — 2-score lead, dog filling slower`, liq };
        if (scoreDiff >= 4)  return { type: 'lean',      label: '🟢 LEAN',      color: '#4ade80', glowAnim: 'arbGlow',
            description: `+${scoreDiff} pts · ${phaseLabel} · Fav ${favPrice}¢ — Small lead, decent volatility`, liq };
        return { type: 'coin_flip', label: '🔵 COIN FLIP', color: '#60a5fa', glowAnim: 'arbGlowBlue',
            description: `±${scoreDiff} pts · ${phaseLabel} — Field goal game, both legs will bounce`, liq };
    }

    // ─── NHL ──────────────────────────────────────────────────────────────────
    if (sport === 'NHL') {
        if (totalPoints === 0 && period <= 1) return { type: 'early', label: '⚪ EARLY', color: '#8892a6', glowAnim: '',
            description: `${phaseLabel} — No score yet`, liq };
        const lateAndTight = scoreDiff <= 1 && period >= 3 && clockMins <= 5;
        if (lateAndTight) return { type: 'late_game', label: '⌛ LATE GAME', color: '#ff4444', glowAnim: '',
            description: `${scoreDiff === 0 ? 'Tied' : `${scoreDiff}-goal game`} · ${phaseLabel} — Final minutes, skip`, liq };
        if (scoreDiff >= 3) return { type: 'runaway',   label: '🔴 RUNAWAY',   color: '#ff6644', glowAnim: '',
            description: `+${scoreDiff} goals · ${phaseLabel} · Fav ${favPrice}¢ — 3-goal lead, dog side dead`, liq };
        if (scoreDiff >= 2) return { type: 'drifting',  label: '🟡 DRIFTING',  color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `+${scoreDiff} goals · ${phaseLabel} · Fav ${favPrice}¢ — 2-goal lead, dog slower`, liq };
        if (scoreDiff >= 1) return { type: 'lean',      label: '🟢 LEAN',      color: '#4ade80', glowAnim: 'arbGlow',
            description: `+${scoreDiff} goal · ${phaseLabel} · Fav ${favPrice}¢ — 1-goal lead, still volatile`, liq };
        return { type: 'coin_flip', label: '🔵 COIN FLIP', color: '#60a5fa', glowAnim: 'arbGlowBlue',
            description: `Tied · ${phaseLabel} — Both legs will bounce`, liq };
    }

    // ─── Tennis ───────────────────────────────────────────────────────────────
    if (sport === 'Tennis') {
        const homeSets = parseInt(gameData.homeScore) || 0;
        const awaySets = parseInt(gameData.awayScore) || 0;
        const leadSets  = Math.max(homeSets, awaySets);
        const trailSets = Math.min(homeSets, awaySets);
        const setsDiff  = leadSets - trailSets;
        const setsWon   = homeSets + awaySets;
        const label14   = `${leadSets}-${trailSets} sets`;
        if (setsWon === 0) return { type: 'early', label: '⚪ EARLY', color: '#8892a6', glowAnim: '',
            description: `${phaseLabel} — Match just started`, liq };
        // 1-1: deciding set — maximum volatility, best entry
        if (homeSets === 1 && awaySets === 1) return { type: 'coin_flip', label: '🔵 COIN FLIP', color: '#60a5fa', glowAnim: 'arbGlowBlue',
            description: `1-1 sets · ${phaseLabel} — Deciding set, anyone's match, both legs will move`, liq };
        // 1-0: one set ahead
        if (setsDiff === 1 && setsWon === 1) return { type: 'lean', label: '🟢 LEAN', color: '#4ade80', glowAnim: 'arbGlow',
            description: `${label14} · ${phaseLabel} · Fav ${favPrice}¢ — One set ahead, still volatile`, liq };
        // 2-1: one set from match
        if (setsDiff === 1 && setsWon === 3) return { type: 'drifting', label: '🟡 DRIFTING', color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `${label14} · ${phaseLabel} · Fav ${favPrice}¢ — One set from match, dog filling harder`, liq };
        // 2-0: dominant, match nearly over
        if (setsDiff === 2 && trailSets === 0) return { type: 'runaway', label: '🔴 RUNAWAY', color: '#ff6644', glowAnim: '',
            description: `${label14} · ${phaseLabel} · Fav ${favPrice}¢ — Dominant, match nearly over`, liq };
        return { type: 'lean', label: '🟢 LEAN', color: '#4ade80', glowAnim: 'arbGlow',
            description: `${label14} · ${phaseLabel} — Some volatility remaining`, liq };
    }

    // ─── MLB ──────────────────────────────────────────────────────────────────
    if (sport === 'MLB') {
        if (totalPoints === 0 && period <= 2) return { type: 'early', label: '⚪ EARLY', color: '#8892a6', glowAnim: '',
            description: `${phaseLabel} — Early innings`, liq };
        const lateAndTight = period >= 8 && scoreDiff <= 1;
        if (lateAndTight) return { type: 'late_game', label: '⌛ LATE GAME', color: '#ff4444', glowAnim: '',
            description: `${scoreDiff === 0 ? 'Tied' : `${scoreDiff}-run game`} · ${phaseLabel} — Closer territory, skip`, liq };
        if (scoreDiff >= 5) return { type: 'runaway',  label: '🔴 RUNAWAY',   color: '#ff6644', glowAnim: '',
            description: `+${scoreDiff} runs · ${phaseLabel} · Fav ${favPrice}¢ — 5-run lead, dog side dead`, liq };
        if (scoreDiff >= 3) return { type: 'drifting', label: '🟡 DRIFTING',  color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `+${scoreDiff} runs · ${phaseLabel} · Fav ${favPrice}¢ — Multi-run lead, dog slower`, liq };
        if (scoreDiff >= 2) return { type: 'lean',     label: '🟢 LEAN',      color: '#4ade80', glowAnim: 'arbGlow',
            description: `+${scoreDiff} runs · ${phaseLabel} · Fav ${favPrice}¢ — 2-run lead, volatile`, liq };
        return { type: 'coin_flip', label: '🔵 COIN FLIP', color: '#60a5fa', glowAnim: 'arbGlowBlue',
            description: `${scoreDiff === 0 ? 'Tied' : `${scoreDiff}-run game`} · ${phaseLabel} — Both legs will bounce`, liq };
    }

    // ─── Soccer ───────────────────────────────────────────────────────────────
    if (sport === 'MLS' || sport === 'EPL' || sport === 'UCL' ||
        (sport !== 'NBA' && sport !== 'NCAAB' && sport !== 'NCAAW' &&
         sport !== 'NFL' && sport !== 'NCAAF' && sport !== 'NHL' &&
         sport !== 'MLB' && sport !== 'Tennis')) {
        const lateAndTight = period >= 2 && clockMins >= 80 && scoreDiff <= 1;
        if (lateAndTight) return { type: 'late_game', label: '⌛ LATE GAME', color: '#ff4444', glowAnim: '',
            description: `${scoreDiff === 0 ? 'Tied' : `${scoreDiff}-goal game`} · ${phaseLabel} — Stoppage time, skip`, liq };
        if (scoreDiff >= 3) return { type: 'runaway',  label: '🔴 RUNAWAY',   color: '#ff6644', glowAnim: '',
            description: `+${scoreDiff} goals · ${phaseLabel} · Fav ${favPrice}¢ — 3-goal lead, dog side dead`, liq };
        if (scoreDiff >= 2) return { type: 'drifting', label: '🟡 DRIFTING',  color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `+${scoreDiff} goals · ${phaseLabel} · Fav ${favPrice}¢ — 2-goal cushion, dog slower`, liq };
        if (scoreDiff >= 1) return { type: 'lean',     label: '🟢 LEAN',      color: '#4ade80', glowAnim: 'arbGlow',
            description: `+${scoreDiff} goal · ${phaseLabel} · Fav ${favPrice}¢ — 1-goal lead, volatile`, liq };
        return { type: 'coin_flip', label: '🔵 COIN FLIP', color: '#60a5fa', glowAnim: 'arbGlowBlue',
            description: `Tied · ${phaseLabel} — Level game, both legs will bounce`, liq };
    }

    // ─── Basketball: NBA / NCAAB / NCAAW ────────────────────────────────────
    if (totalPoints <= 4) return { type: 'early', label: '⚪ EARLY', color: '#8892a6', glowAnim: '',
        description: `${phaseLabel} — Game just started, no score context`, liq };

    // Spread-aware effective margin
    let effectiveMargin = scoreDiff;
    let marginLabel = `${scoreDiff} pts`;
    const spreadMarkets = markets.filter(m => (m.ticker || '').toUpperCase().includes('SPREAD'));
    if (spreadMarkets.length > 0) {
        for (const sm of spreadMarkets) {
            const lineMatch = (sm.title || '').match(/-([\d.]+)/);
            if (lineMatch) {
                const spreadPts = parseFloat(lineMatch[1]);
                const spreadMargin = Math.abs(scoreDiff - spreadPts);
                if (spreadMargin < effectiveMargin) {
                    effectiveMargin = spreadMargin;
                    marginLabel = `${scoreDiff} pts (±${spreadMargin.toFixed(1)} vs spread)`;
                }
                break;
            }
        }
    }

    // Late-game tight = time warning (no hard block)
    const lateAndTight = effectiveMargin <= 5 && (
        ((sport === 'NBA' || sport === 'NCAAW') && period >= 4 && clockMins <= 4) ||
        (sport === 'NCAAB' && period >= 2 && clockMins <= 5)
    );
    if (lateAndTight) return { type: 'late_game', label: '⌛ LATE GAME', color: '#ff4444', glowAnim: '',
        description: `±${marginLabel} · ${phaseLabel} — Tight + late, running out of time for both legs to fill`, liq };

    // Data: 10-14pt lead = 92% fill rate (rich bids, both sides active)
    //       0-4pt = highest volatility, ask-side pricing kicks in for thin bids
    if (scoreDiff >= 20) return { type: 'runaway',  label: '🔴 RUNAWAY',   color: '#ff6644', glowAnim: '',
        description: `+${marginLabel} · ${phaseLabel} · Fav ${favPrice}¢ — Large lead, dog leg may take time but historically fills`, liq };
    if (effectiveMargin >= 12) return { type: 'drifting', label: '🟡 DRIFTING',  color: '#ffaa33', glowAnim: '',
        description: `+${marginLabel} · ${phaseLabel} · Fav ${favPrice}¢ — ⚠ Dog may fill and keep dropping, fav trends up past your limit`, liq };
    if (effectiveMargin >= 5) return { type: 'lean',      label: '🟢 LEAN',      color: '#4ade80', glowAnim: 'arbGrow',
        description: `+${marginLabel} · ${phaseLabel} · Fav ${favPrice}¢ — Lead exists but game still volatile, decent fill chance`, liq };

    return { type: 'coin_flip', label: '🔵 COIN FLIP', color: '#60a5fa', glowAnim: 'arbGlowBlue',

        description: `±${marginLabel} · ${phaseLabel} — Prices bounce both ways, both legs can fill. Best opportunity`, liq };
}

function getRecommendedPresets(tier, signalType) {
    // coin_flip = close game, prices bouncing both ways → tighter widths catch fills quickly
    // lean = small lead, still volatile → medium widths
    // drifting = bigger lead, dog filling slower → wider widths
    // runaway = blowout, dog side dead → widest (warn user)
    // late_game/early/pregame → medium defaults
    if (signalType === 'coin_flip') {
        return { tight: [5, 6, 7, 8], medium: [7, 8, 9, 10], wide: [8, 10, 11, 12] }[tier] || [7, 8, 9, 10];
    }
    if (signalType === 'lean') {
        return { tight: [6, 7, 8, 9], medium: [8, 9, 10, 11], wide: [10, 11, 12, 13] }[tier] || [8, 9, 10, 11];
    }
    if (signalType === 'drifting') {
        return { tight: [10, 11, 12, 13], medium: [12, 13, 15, 16], wide: [14, 15, 16, 17] }[tier] || [12, 13, 15, 16];
    }
    if (signalType === 'runaway') {
        return { tight: [14, 15, 16, 17], medium: [15, 16, 17, 17], wide: [16, 17, 17, 17] }[tier] || [15, 16, 17, 17];
    }
    // late_game / early / pregame → medium defaults
    return { tight: [6, 7, 8, 9], medium: [8, 10, 11, 12], wide: [12, 13, 15, 15] }[tier] || [8, 10, 11, 12];
}

function isKalshiLive(market) {
    const expStr = market.expected_expiration_time;
    if (!expStr) return false;
    
    try {
        const expTime = new Date(expStr);
        const now = Date.now();
        const hoursUntilExp = (expTime.getTime() - now) / (1000 * 60 * 60);
        
        // Window: game must be expected to end within N hours AND not ended > 30min ago
        // Kalshi sets expected_expiration per-match (not end-of-day), so 4h covers the
        // longest tennis match; 5h for team sports with potential OT.
        const isTennis = /KXATP|KXWTA/i.test(market.ticker || market.event_ticker || '');
        const maxHours = isTennis ? 4.0 : 5.0;
        if (hoursUntilExp < -0.5 || hoursUntilExp > maxHours) return false;
        
        // Check game date — must be today (or yesterday for late-night games).
        // Tomorrow's games (diffDays=1 in the future) are NOT live.
        const ticker = market.event_ticker || '';
        const dateMatch = ticker.match(/(\d{2})([A-Z]{3})(\d{2})/);
        if (dateMatch) {
            const [, yr, mon, day] = dateMatch;
            const monthMap = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
            const gameDate = new Date(2000 + parseInt(yr), monthMap[mon] || 0, parseInt(day));
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const diffDays = (gameDate.getTime() - todayMidnight.getTime()) / (1000*60*60*24);
            // Allow today (0) and yesterday (-1) for late-night games; reject tomorrow (+1) and beyond
            if (diffDays > 0 || diffDays < -1) return false;
        }
        
        // Check if game has already been resolved (result field set)
        if (market.result && market.result !== '') return false;
        
        return true;
    } catch (e) {
        // Ignore parse errors
    }
    return false;
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

            // Show logged-in user name
            if (data.display_name) {
                const loginBtn = document.getElementById('login-status');
                loginBtn.textContent = `✓ ${data.display_name}`;
                loginBtn.title = `Logged in as ${data.display_name}`;
            }

            await loadBalance();
            await loadBots();
            await loadPnL();
            loadOpeningLines(); // fire-and-forget, non-blocking
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

// Load pre-game opening lines (closing line values) from backend
async function loadOpeningLines() {
    try {
        const resp = await fetch(`${API_BASE}/opening-lines`);
        const data = await resp.json();
        openingLines = data || {};
    } catch (e) { /* non-critical */ }
}

// Load markets
async function loadMarkets() {
    const grid = document.getElementById('markets-grid');
    grid.innerHTML = '<p style="color: #00ff88; grid-column: 1 / -1;">Loading sports markets...</p>';
    
    try {
        // Build URL with sport filter for backend
        // Use higher limit — NCAAB alone can have 2000+ markets (spreads, totals, props)
        // 'live' filter is client-side only, fetch all
        const isAllOrLive = !currentSportFilter || currentSportFilter === 'all' || currentSportFilter === 'live';
        const fetchLimit = isAllOrLive ? 5000 : 3000;
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

        // Start live price refresh (5s interval)
        startPriceRefresh();
    } catch (error) {
        console.error('Error loading markets:', error);
        grid.innerHTML = '<p style="color: #ff4444; grid-column: 1 / -1;">Network error loading markets. Check console.</p>';
    }
}

// ─── Live Price Refresh: update visible market prices from orderbook ─────────

let priceRefreshRunning = false;
let _botsAnchored = 0;  // bots with one leg filled, waiting for second
let _botsActive   = 0;  // total active bot count
let _botHealth    = { healthy: 0, holding: 0, dropping: 0, warning: 0, danger: 0, safe: 0 };

function startPriceRefresh() {
    if (priceRefreshInterval) clearInterval(priceRefreshInterval);
    priceRefreshInterval = setInterval(refreshVisiblePrices, 10000);
    // Fire first refresh immediately after DOM renders
    setTimeout(refreshVisiblePrices, 0);
}

async function refreshVisiblePrices() {
    // Guard: skip if previous refresh is still running
    if (priceRefreshRunning) return;
    priceRefreshRunning = true;

    try {
    // Collect all visible price buttons and their tickers
    const allBtns = document.querySelectorAll('button[data-ticker][data-side]');
    const tickerSet = new Set();
    allBtns.forEach(btn => {
        const t = btn.getAttribute('data-ticker');
        if (t) tickerSet.add(t);
    });

    if (tickerSet.size === 0) { priceRefreshRunning = false; return; }

    console.log(`🔄 Price refresh: ${tickerSet.size} tickers found in DOM`);

    // Sort: moneylines / spreads / totals first, then props
    const allTickers = [...tickerSet];
    allTickers.sort((a, b) => {
        const aIsProp = /KXNBA(PTS|REB|AST|3PT|STL|BLK)/.test(a);
        const bIsProp = /KXNBA(PTS|REB|AST|3PT|STL|BLK)/.test(b);
        return aIsProp - bIsProp;
    });
    const batch = allTickers;  // Send ALL visible tickers — backend rate-limits itself

    // Split into chunks of 20 to avoid single huge request timing out
    const CHUNK_SIZE = 20;
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
        const chunk = batch.slice(i, i + CHUNK_SIZE);
    try {
        const resp = await fetch(`${API_BASE}/prices/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: chunk }),
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        if (!data.prices) continue;
        const updatedCount = Object.keys(data.prices).length;
        console.log(`  ✅ Chunk ${Math.floor(i/CHUNK_SIZE)+1}: ${updatedCount}/${chunk.length} prices updated`);

        // Update each button in-place
        for (const [ticker, p] of Object.entries(data.prices)) {
            // Update allMarkets array too (so modal opens with fresh data)
            const mkt = allMarkets.find(m => m.ticker === ticker);
            if (mkt) {
                mkt.yes_bid = p.yes_bid;
                mkt.no_bid  = p.no_bid;
                mkt.yes_ask = p.yes_ask;
                mkt.no_ask  = p.no_ask;
                delete mkt.yes_bid_dollars;
                delete mkt.no_bid_dollars;
                delete mkt.yes_ask_dollars;
                delete mkt.no_ask_dollars;
            }

            // Compute market tier for button brightness
            const lBidSum = (p.yes_bid || 0) + (p.no_bid || 0);
            const lYesSp  = p.yes_ask > 0 && p.yes_bid > 0 ? p.yes_ask - p.yes_bid : 99;
            const lNoSp   = p.no_ask  > 0 && p.no_bid  > 0 ? p.no_ask  - p.no_bid  : 99;
            const lAvgSp  = (lYesSp + lNoSp) / 2;
            const lTier   = lBidSum > 100 ? 'over100' : lAvgSp <= 3 ? 'tight' : 'medium';

            // Find YES button for this ticker
            const yesBtn = document.querySelector(`button[data-ticker="${ticker}"][data-side="yes"]`);
            if (yesBtn) {
                const yesPrice = (p.yes_ask >= 99 && (p.no_bid || 0) <= 1) ? (p.yes_bid || 0) : (p.yes_ask > 0 ? p.yes_ask : 0);
                const yesDisplay = yesPrice > 0 ? `${yesPrice}¢` : '—';
                const newStyle = yesPrice > 0 ? getPriceButtonStyle(yesPrice, 'yes', lTier) : 'background: #1a1f2e; color: #555;';
                yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${newStyle}`;
                yesBtn.innerHTML = yesDisplay;
                if (mkt) yesBtn.onclick = () => openBotModal(mkt, 'yes', p.yes_ask);
            }

            // Find NO button for this ticker
            const noBtn = document.querySelector(`button[data-ticker="${ticker}"][data-side="no"]`);
            if (noBtn) {
                const noPrice = (p.no_ask >= 99 && (p.yes_bid || 0) <= 1) ? (p.no_bid || 0) : (p.no_ask > 0 ? p.no_ask : 0);
                const noDisplay = noPrice > 0 ? `${noPrice}¢` : '—';
                const newStyle = noPrice > 0 ? getPriceButtonStyle(noPrice, 'no', lTier) : 'background: #1a1f2e; color: #555;';
                noBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${newStyle}`;
                noBtn.innerHTML = noDisplay;
                if (mkt) noBtn.onclick = () => handleManualMiddleNoClick(mkt);
            }
        }
    } catch (e) {
        // Silent — prices stay at last known value
        console.warn('Price refresh chunk failed:', e);
    }
    } // end chunk loop
    } finally {
        priceRefreshRunning = false;
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
                eventTitle: null, // set after grouping
                teamNames: parseTeamNames(gameId),
                sport: detectSport(eventTicker),
                markets: []
            };
        }
        
        games[gameId].markets.push(market);
    });
    
    // Second pass: merge orphan GAME-only groups into spread groups when Kalshi
    // listed teams in different order between series (e.g. GAME=MONTIDHO, SPREAD=IDHOMONT).
    // Detection: same date prefix + same letters in teams segment (anagram check).
    const sortedChars = str => str.split('').sort().join('');
    const dateOf = gid => gid.slice(0, 7);                          // "26MAR11"
    const teamsOf = gid => gid.replace(/^\d{2}[A-Z]{3}\d{2}/, ''); // "IDHOMONT"
    const gameIdList = Object.keys(games);
    gameIdList.forEach(orphanId => {
        const g = games[orphanId];
        if (!g) return;
        // Only consider groups where every market is a winner/game type
        const allWinner = g.markets.every(m => {
            const mt = m.market_type || '';
            return mt === 'winner' || mt === '1h_winner' ||
                   (m.ticker || '').toUpperCase().includes('GAME');
        });
        if (!allWinner) return;
        const orphanDate  = dateOf(orphanId);
        const orphanLetters = sortedChars(teamsOf(orphanId));
        const target = gameIdList.find(gid => {
            if (gid === orphanId || !games[gid]) return false;
            return dateOf(gid) === orphanDate &&
                   sortedChars(teamsOf(gid)) === orphanLetters;
        });
        if (target) {
            console.log(`🔗 Merging orphan GAME group ${orphanId} → ${target}`);
            games[target].markets.push(...g.markets);
            delete games[orphanId];
        }
    });

    // Third pass: build titles using ALL markets in each group
    // This ensures winner/spread market titles (which are cleaner) are preferred
    Object.values(games).forEach(g => {
        g.eventTitle = buildGameTitle(g.gameId, g.markets);
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
    if (upper.includes('KXNCAAMB') || upper.includes('KXNCAAB') || upper.includes('KXMARMAD')) return 'NCAAB';
    if (upper.includes('KXNCAAWB')) return 'NCAAW';
    if (upper.includes('KXNCAAF')) return 'NCAAF';
    if (upper.includes('KXMLS')) return 'MLS';
    if (upper.includes('KXEPL')) return 'EPL';
    if (upper.includes('KXUCL')) return 'UCL';
    if (upper.includes('KXATP') || upper.includes('KXWTA')) return 'Tennis';
    if (upper.includes('KXPGA') || upper.includes('KXTGL') || upper.includes('KXGOLF')) return 'Golf';
    if (upper.includes('KXNBL')) return 'NBL';
    if (upper.includes('KXWBC')) return 'WBC';
    if (upper.includes('KXVTB')) return 'VTB';
    if (upper.includes('KXBSL')) return 'BSL';
    if (upper.includes('KXABA')) return 'ABA';
    if (upper.includes('KXLOL') || upper.includes('KXDOTA') || upper.includes('KXCS')) return 'Esports';
    return 'Sports';
}

// Get sport emoji
function getSportEmoji(sport) {
    const emojis = {
        'NBA': '🏀', 'NFL': '🏈', 'NHL': '🏒', 'MLB': '⚾', 
        'MLS': '⚽', 'NCAAB': '🎓', 'NCAAW': '🎓', 'NCAAF': '🎓',
        'EPL': '⚽', 'UCL': '⚽',
        'Tennis': '🎾', 'Golf': '⛳', 'NBL': '🏀', 'Esports': '🎮',
        'WBC': '⚾', 'VTB': '🏀', 'BSL': '🏀', 'ABA': '🏀',
        'Sports': '🏆'
    };
    return emojis[sport] || '🏆';
}

// Build game title from gameId and market data (or array of markets)
// 26FEB28TORWAS -> "Toronto vs Washington"
function buildGameTitle(gameId, marketOrMarkets) {
    // Accept single market or array of markets
    const markets = Array.isArray(marketOrMarkets) ? marketOrMarkets : [marketOrMarkets];
    
    // Try every market's title — winner/spread titles are cleanest
    // Sort so winner/spread markets are tried first
    const sorted = [...markets].sort((a, b) => {
        const typeOrder = { 'winner': 0, 'spread': 1, 'total': 2, '1h_winner': 3 };
        return (typeOrder[a.market_type] ?? 99) - (typeOrder[b.market_type] ?? 99);
    });
    
    for (const market of sorted) {
        const title = market.title || '';
        
        // Tennis: "Will X win the Y vs Z : Round Of N match?" -> "Y vs Z"
        const tennisMatch = title.match(/win the\s+(.+?)\s+vs\.?\s+(.+?)\s*(?::|\?)/i);
        if (tennisMatch) {
            return `${tennisMatch[1].trim()} vs ${tennisMatch[2].trim()}`;
        }
        
        // Titles like "Denver at Utah Winner?" or "South Carolina at Ole Miss Winner?"
        const atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[?:]|\s+(?:Winner|Moneyline|Spread|Total)|\s*$)/i);
        if (atMatch) {
            return `${atMatch[1].trim()} vs ${atMatch[2].trim()}`;
        }
        
        const vsMatch = title.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*[?:]|\s+(?:Winner|Moneyline|Spread|Total)|\s*$)/i);
        if (vsMatch) {
            return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
        }
        
        // Prop titles like "Will X score 20+ pts in Team1 at Team2?" or "... in the Team1 vs Team2 game"
        const inGameMatch = title.match(/in(?:\s+the)?\s+(.+?)\s+(?:at|vs\.?)\s+(.+?)(?:\s+game|\s*\?|$)/i);
        if (inGameMatch) {
            return `${inGameMatch[1].trim()} vs ${inGameMatch[2].trim()}`;
        }
    }
    
    // Parse from gameId: 26FEB28TORWAS -> TOR vs WAS
    return parseTeamNames(gameId);
}

// Parse team names from game ID (e.g., 26FEB28TORWAS -> "Toronto vs Washington")
function parseTeamNames(gameId) {
    if (!gameId || gameId === 'UNKNOWN') return 'Unknown Game';
    
    // Comprehensive team abbreviations (NBA, NHL, MLB, EPL, UCL, MLS, NCAAB, NCAAF)
    const teamMap = {
        // NBA
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
        // MLB
        'NYY': 'Yankees', 'NYM': 'Mets', 'TB': 'Rays', 'BAL': 'Orioles',
        'KC': 'Royals', 'CWS': 'White Sox', 'TEX': 'Rangers', 'SD': 'Padres',
        'SF': 'Giants', 'LAD': 'Dodgers', 'CIN': 'Reds', 'MIL2': 'Brewers',
        // EPL
        'LEE': 'Leeds', 'MCI': 'Man City', 'LFC': 'Liverpool', 'TOT': 'Tottenham',
        'NFO': 'Nottingham', 'FUL': 'Fulham', 'BRE': 'Brentford', 'WOL': 'Wolves',
        'ARS': 'Arsenal', 'EVE': 'Everton', 'NEW': 'Newcastle', 'BUR': 'Burnley',
        'WHU': 'West Ham', 'MUN': 'Man United', 'AVL': 'Aston Villa', 'CHE': 'Chelsea',
        'BHA': 'Brighton', 'CRY': 'Crystal Palace', 'SOU': 'Southampton',
        'IPS': 'Ipswich', 'LEI': 'Leicester', 'BOH': 'Bournemouth',
        // UCL
        'ATM': 'Atletico Madrid', 'RMA': 'Real Madrid', 'BAR': 'Barcelona',
        'PSG': 'PSG', 'CFC': 'Chelsea', 'TIE': 'Draw',
        // NCAAB — Kalshi uses variable-length codes (2-5 chars)
        'AKR': 'Akron', 'ALA': 'Alabama', 'ALBNY': 'Albany', 'AMERN': 'American',
        'APP': 'App State', 'ARIZ': 'Arizona', 'ARK': 'Arkansas', 'ARM': 'Army',
        'AUB': 'Auburn', 'BALL': 'Ball State', 'BAY': 'Baylor', 'BC': 'Boston College',
        'BGSU': 'Bowling Green', 'BING': 'Binghamton', 'BOISE': 'Boise State',
        'BRAD': 'Bradley', 'BRWN': 'Brown', 'BRYNT': 'Bryant', 'BUCK': 'Bucknell',
        'BUFF': 'Buffalo', 'BUTLR': 'Butler', 'BYU': 'BYU', 'CAL': 'Cal',
        'CAMP': 'Campbell', 'CMICH': 'Central Michigan', 'CIN': 'Cincinnati',
        'CLEM': 'Clemson', 'CLM': 'Clemson', 'CLEV': 'Cleveland State',
        'COAST': 'Coastal Carolina', 'COLG': 'Colgate', 'COLO': 'Colorado',
        'CONN': 'UConn', 'CORN': 'Cornell', 'CREIG': 'Creighton',
        'DART': 'Dartmouth', 'DAV': 'Davidson', 'DAYT': 'Dayton', 'DEL': 'Delaware',
        'DEPL': 'DePaul', 'DRAKE': 'Drake', 'DREX': 'Drexel', 'DUKE': 'Duke',
        'DUQ': 'Duquesne', 'ECU': 'East Carolina', 'EMU': 'Eastern Michigan',
        'EVAN': 'Evansville', 'FAIR': 'Fairfield', 'FAU': 'FAU', 'FDU': 'FDU',
        'FLOR': 'Florida', 'FLA': 'Florida', 'FGCU': 'FGCU', 'FSU': 'Florida State',
        'FORD': 'Fordham', 'FRES': 'Fresno State', 'FTO': 'Fordham',
        'GTOWN': 'Georgetown', 'GW': 'George Washington', 'GMU': 'George Mason',
        'GT': 'Georgia Tech', 'GONZ': 'Gonzaga', 'GRAM': 'Grambling',
        'HALL': 'Seton Hall', 'HARV': 'Harvard', 'HAW': 'Hawaii', 'HIGH': 'High Point',
        'HOFST': 'Hofstra', 'HOLY': 'Holy Cross', 'HTOWN': 'Houston',
        'IDAHO': 'Idaho', 'ILL': 'Illinois', 'IONA': 'Iona', 'IOWA': 'Iowa',
        'ISU': 'Iowa State', 'IUPU': 'IUPUI', 'JAX': 'Jacksonville',
        'JMU': 'James Madison', 'KAN': 'Kansas', 'KENT': 'Kent State', 'UK': 'Kentucky',
        'LAS': 'La Salle', 'LAF': 'Lafayette', 'LAM': 'Lamar', 'LEH': 'Lehigh',
        'LIB': 'Liberty', 'LIP': 'Lipscomb', 'LOU': 'Louisville', 'LSU': 'LSU',
        'LOY': 'Loyola Chicago', 'MAINE': 'Maine', 'MANH': 'Manhattan',
        'MARQ': 'Marquette', 'MARSH': 'Marshall', 'MD': 'Maryland', 'MCNS': 'McNeese',
        'MERC': 'Mercer', 'MERR': 'Merrimack', 'MIFL': 'Miami (FL)',
        'MOH': 'Miami (OH)', 'MICH': 'Michigan', 'MSU': 'Michigan State',
        'MTSU': 'Middle Tennessee', 'MISS': 'Ole Miss', 'MSST': 'Mississippi State',
        'MO': 'Missouri', 'MONM': 'Monmouth', 'MONT': 'Montana', 'MURR': 'Murray State',
        'NAVY': 'Navy', 'NEB': 'Nebraska', 'NEV': 'Nevada', 'UNLV': 'UNLV',
        'NH': 'New Hampshire', 'NJIT': 'NJIT', 'NM': 'New Mexico', 'NMSU': 'New Mexico State',
        'NIAG': 'Niagara', 'NIU': 'Northern Illinois', 'NC': 'North Carolina',
        'NCST': 'NC State', 'ND': 'Notre Dame', 'NWST': 'Northwestern State',
        'NW': 'Northwestern', 'OAK': 'Oakland', 'OHIO': 'Ohio', 'OSU': 'Ohio State',
        'OKLA': 'Oklahoma', 'OKST': 'Oklahoma State', 'ODU': 'Old Dominion',
        'OREG': 'Oregon', 'ORST': 'Oregon State', 'PAC': 'Pacific',
        'PENN': 'Penn', 'PSU': 'Penn State', 'PEPP': 'Pepperdine',
        'PROV': 'Providence', 'PURD': 'Purdue', 'QUIN': 'Quinnipiac',
        'RAD': 'Radford', 'RICE': 'Rice', 'RICH': 'Richmond', 'RID': 'Rider',
        'RUTG': 'Rutgers', 'SAM': 'Samford', 'SDSU': 'San Diego State',
        'SCU': 'Santa Clara', 'SETON': 'Seton Hall', 'SHU': 'Sacred Heart',
        'SIENA': 'Siena', 'SIU': 'Southern Illinois', 'SMU': 'SMU',
        'SC': 'South Carolina', 'USF': 'South Florida', 'SMC': 'Saint Mary\'s',
        'SJU': 'St. John\'s', 'STBONA': 'St. Bonaventure', 'SJSU': 'San Jose State',
        'STAN': 'Stanford', 'STONY': 'Stony Brook', 'SYRCU': 'Syracuse', 'SYR': 'Syracuse',
        'TCU': 'TCU', 'TEMP': 'Temple', 'TENN': 'Tennessee', 'TEX': 'Texas',
        'TXAM': 'Texas A&M', 'TTU': 'Texas Tech', 'TLDO': 'Toledo', 'TOL': 'Toledo',
        'TLNE': 'Tulane', 'TLSA': 'Tulsa', 'UAB': 'UAB', 'UCF': 'UCF',
        'UCLA': 'UCLA', 'UCSB': 'UC Santa Barbara', 'UGA': 'Georgia',
        'UMASS': 'UMass', 'UNC': 'North Carolina', 'UNLV': 'UNLV',
        'URI': 'Rhode Island', 'USC': 'USC', 'USU': 'Utah State',
        'UTAH': 'Utah', 'UTEP': 'UTEP', 'UTSA': 'UTSA',
        'VALPO': 'Valparaiso', 'VANDY': 'Vanderbilt', 'VCU': 'VCU',
        'VILL': 'Villanova', 'UVA': 'Virginia', 'VT': 'Virginia Tech',
        'WAKE': 'Wake Forest', 'WASHI': 'Washington', 'WVU': 'West Virginia',
        'WKU': 'Western Kentucky', 'WMICH': 'Western Michigan', 'WICH': 'Wichita State',
        'WISC': 'Wisconsin', 'WIS': 'Wisconsin', 'WOF': 'Wofford', 'WRIGHT': 'Wright State',
        'WYO': 'Wyoming', 'XAV': 'Xavier', 'YALE': 'Yale', 'YSU': 'Youngstown State',
        // Additional NCAAB codes seen on Kalshi
        'BRIGHTN': 'Brighton',
        // Additional short codes seen on Kalshi
        'BELL': 'Bellarmine', 'CARK': 'Central Arkansas',
        'WEBB': 'Gardner-Webb', 'HP': 'High Point',
        'GTWN': 'Georgetown', 'BUT': 'Butler',
        'SCAR': 'South Carolina', 'MAN': 'Manhattan',
        'MRSH': 'Marshall', 'USA': 'South Alabama',
        'KSU': 'Kansas State', 'WASH': 'Washington',
        'LCHI': 'Loyola Chicago', 'FUR': 'Furman', 'CHAT': 'Chattanooga',
        'NOLA': 'New Orleans', 'HCU': 'Houston Christian',
        'NWST': 'Northwestern State', 'NICH': 'Nicholls State',
        'DRKE': 'Drake', 'BELM': 'Belmont',
        'AKR2': 'Akron', 'STON': 'Stony Brook',
        'BELMNT': 'Belmont',
    };
    
    // Remove date prefix: 26FEB28TORWAS -> TORWAS
    const cleaned = gameId.replace(/^\d+[A-Z]{3}\d+/, '');
    
    if (!cleaned || cleaned.length < 2) return gameId;
    
    // Try all possible split points (variable-length team codes: 2-5 chars each)
    // Try longest codes first for best match
    for (let split = Math.min(5, cleaned.length - 2); split >= 2; split--) {
        const team1 = cleaned.substring(0, split);
        const team2 = cleaned.substring(split);
        if (teamMap[team1] && teamMap[team2]) {
            // Check for special entries that already contain "vs"
            const n1 = teamMap[team1];
            const n2 = teamMap[team2];
            return `${n1} vs ${n2}`;
        }
    }
    
    // Try 3+3 split as fallback even if not in map (show raw codes)
    if (cleaned.length >= 6) {
        const team1 = cleaned.substring(0, 3);
        const team2 = cleaned.substring(3);
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

// Build the scoreboard widget for a game card
function buildScoreboard(gameScore) {
    if (!gameScore) return null;
    const { state, awayAbbr, homeAbbr, awayName, homeName, awayScore, homeScore,
            awayLogo, homeLogo, clock, period, periodLabel, startTime, statusDetail,
            sport, homeSetScores, awaySetScores } = gameScore;

    const wrap = document.createElement('div');
    const isTennis = sport === 'Tennis';

    if (state === 'pre') {
        // ── Pregame: show scheduled start time ──
        const timeStr = startTime || statusDetail || '';
        wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;background:#111825;border:1px solid #2a3447;border-radius:8px;padding:10px 16px;margin-bottom:12px;';
        // Tennis: show full last name instead of 3-letter code
        const awayLabel = isTennis ? (awayName || awayAbbr) : awayAbbr;
        const homeLabel = isTennis ? (homeName || homeAbbr) : homeAbbr;
        wrap.innerHTML = `
            <span style="color:#8892a6;font-size:13px;font-weight:600;">${awayLabel}</span>
            <span style="color:#4a5568;font-size:12px;">vs</span>
            <span style="color:#8892a6;font-size:13px;font-weight:600;">${homeLabel}</span>
            <span style="color:#2a3447;margin:0 6px;">│</span>
            <span style="color:#6a7488;font-size:12px;">🕐 ${timeStr || 'Scheduled'}</span>`;
        return wrap;
    }

    if (state === 'post') {
        const awayWon = parseInt(awayScore) > parseInt(homeScore);
        const homeWon = parseInt(homeScore) > parseInt(awayScore);
        wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;background:#111825;border:1px solid #2a3447;border-radius:8px;padding:10px 16px;margin-bottom:12px;';
        if (isTennis) {
            // Tennis final: show player names + set scores
            const awayLabel = awayName || awayAbbr;
            const homeLabel = homeName || homeAbbr;
            const awaySets = awaySetScores || awayScore;
            const homeSets = homeSetScores || homeScore;
            wrap.innerHTML = `
                <span style="color:${awayWon ? '#fff' : '#6a7488'};font-size:13px;font-weight:${awayWon ? '700' : '500'};">${awayLabel}</span>
                <span style="color:${awayWon ? '#60a5fa' : '#6a7488'};font-size:12px;font-weight:600;margin:0 4px;">${awaySets}</span>
                <span style="color:#4a5568;font-size:14px;margin:0 2px;">–</span>
                <span style="color:${homeWon ? '#60a5fa' : '#6a7488'};font-size:12px;font-weight:600;margin:0 4px;">${homeSets}</span>
                <span style="color:${homeWon ? '#fff' : '#6a7488'};font-size:13px;font-weight:${homeWon ? '700' : '500'};">${homeLabel}</span>
                <span style="color:#2a3447;margin:0 6px;">│</span>
                <span style="color:#8892a6;font-size:11px;font-weight:600;">${periodLabel || 'Final'}</span>`;
        } else {
            // ── Final: show final score ──
            wrap.innerHTML = `
                <span style="color:${awayWon ? '#fff' : '#6a7488'};font-size:14px;font-weight:${awayWon ? '700' : '500'};">${awayAbbr}</span>
                <span style="color:${awayWon ? '#fff' : '#6a7488'};font-size:20px;font-weight:700;min-width:30px;text-align:center;">${awayScore}</span>
                <span style="color:#4a5568;font-size:14px;margin:0 2px;">–</span>
                <span style="color:${homeWon ? '#fff' : '#6a7488'};font-size:20px;font-weight:700;min-width:30px;text-align:center;">${homeScore}</span>
                <span style="color:${homeWon ? '#fff' : '#6a7488'};font-size:14px;font-weight:${homeWon ? '700' : '500'};">${homeAbbr}</span>
                <span style="color:#2a3447;margin:0 6px;">│</span>
                <span style="color:#8892a6;font-size:11px;font-weight:600;">${periodLabel || 'Final'}</span>`;
        }
        return wrap;
    }

    // ── LIVE ──
    const awayLeading = parseInt(awayScore) > parseInt(homeScore);
    const homeLeading = parseInt(homeScore) > parseInt(awayScore);
    const isHalftime = (statusDetail || '').toLowerCase().includes('half');
    const clockDisplay = isHalftime ? 'Halftime' : (clock ? `${periodLabel} ${clock}` : periodLabel || 'Live');

    wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#0a1a0a,#0f1f12);border:1px solid #00ff88;border-radius:8px;padding:12px 20px;margin-bottom:12px;position:relative;';

    if (isTennis) {
        // Tennis live scoreboard: player names + set scores + current set indicator
        const awayLabel = awayName || awayAbbr;
        const homeLabel = homeName || homeAbbr;
        const awaySets = awaySetScores || awayScore;
        const homeSets = homeSetScores || homeScore;
        wrap.innerHTML = `
            <span style="color:#ff3333;font-size:8px;font-weight:800;letter-spacing:1px;position:absolute;top:6px;left:12px;display:flex;align-items:center;gap:4px;"><span style="animation:pulse 1.5s infinite;">●</span> LIVE</span>
            <span style="color:${awayLeading ? '#00ff88' : '#fff'};font-size:14px;font-weight:700;">${awayLabel}</span>
            <span style="color:${awayLeading ? '#00ff88' : '#60a5fa'};font-size:13px;font-weight:600;margin:0 2px;">${awaySets}</span>
            <span style="color:#4a5568;font-size:14px;margin:0 2px;">–</span>
            <span style="color:${homeLeading ? '#00ff88' : '#60a5fa'};font-size:13px;font-weight:600;margin:0 2px;">${homeSets}</span>
            <span style="color:${homeLeading ? '#00ff88' : '#fff'};font-size:14px;font-weight:700;">${homeLabel}</span>
            <span style="color:#2a3447;margin:0 6px;">│</span>
            <span style="color:#00ff88;font-size:12px;font-weight:600;">${periodLabel || 'Live'}</span>`;
    } else {
        wrap.innerHTML = `
            <span style="color:#ff3333;font-size:8px;font-weight:800;letter-spacing:1px;position:absolute;top:6px;left:12px;display:flex;align-items:center;gap:4px;"><span style="animation:pulse 1.5s infinite;">●</span> LIVE</span>
            <span style="color:${awayLeading ? '#00ff88' : '#fff'};font-size:15px;font-weight:700;">${awayAbbr}</span>
            <span style="color:${awayLeading ? '#00ff88' : '#fff'};font-size:26px;font-weight:800;min-width:36px;text-align:center;">${awayScore}</span>
            <span style="color:#4a5568;font-size:18px;margin:0 2px;">–</span>
            <span style="color:${homeLeading ? '#00ff88' : '#fff'};font-size:26px;font-weight:800;min-width:36px;text-align:center;">${homeScore}</span>
            <span style="color:${homeLeading ? '#00ff88' : '#fff'};font-size:15px;font-weight:700;">${homeAbbr}</span>
            <span style="color:#2a3447;margin:0 6px;">│</span>
            <span style="color:#00ff88;font-size:12px;font-weight:600;">${clockDisplay}</span>`;
    }
    return wrap;
}

// Display one compact event row (trading floor style)
function displayEventRow(eventData, container) {
    const sport = eventData.sport || detectSport(eventData.eventTicker);
    const liveScore = getLiveScoreForGame(eventData.gameId, sport);
    // A game is "live" if ESPN confirms it OR Kalshi-native detection says so
    const kalshiLive = !liveScore && eventData.markets.some(m => isKalshiLive(m));
    const isLive = !!liveScore || kalshiLive;
    const gameScore = getGameScore(eventData.gameId, sport);
    const emoji = getSportEmoji(sport);

    // Compute game signal — factors in score, period, edge (not just liquidity)
    const signal = getGameSignal(eventData.gameId, sport, eventData.markets);
    const bestLiq = signal.liq;

    const card = document.createElement('div');
    // Glow based on game signal (anchor = green, lean/early = gold, swing = blue)
    let glowStyle = '';
    if (isLive && signal.glowAnim) {
        glowStyle = `animation: ${signal.glowAnim} 2s ease-in-out infinite;`;
    }
    const borderColor = (isLive && signal.type === 'anchor') ? '#00ff88'
        : (isLive && signal.type === 'swing') ? '#60a5fa'
        : isLive ? '#2a6a3a' : '#2a3447';
    card.style.cssText = `background: #1a1f2e; border: 1px solid ${borderColor}; border-radius: 8px; padding: 16px; margin-bottom: 12px; ${glowStyle}`;
    card.setAttribute('data-event-ticker', eventData.eventTicker || '');

    // Event header (title + sport + date)
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;';

    const titleSpan = document.createElement('a');
    const kalshiTitleUrl = `https://kalshi.com/markets/${(eventData.eventTicker || '').split('-')[0]}/${eventData.eventTicker || ''}`;
    titleSpan.href = kalshiTitleUrl;
    titleSpan.target = '_blank';
    titleSpan.style.cssText = 'font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;';
    titleSpan.textContent = `${emoji} ${eventData.eventTitle}`;
    titleSpan.title = 'Open on Kalshi';
    header.appendChild(titleSpan);

    // Sport + date badges
    const badgeWrap = document.createElement('span');
    badgeWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const sportBadge = document.createElement('span');
    sportBadge.style.cssText = 'background: #2a3447; color: #8892a6; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600;';
    sportBadge.textContent = sport;
    badgeWrap.appendChild(sportBadge);

    const gameDate = parseGameDate(eventData.gameId);
    if (gameDate) {
        const dateBadge = document.createElement('span');
        dateBadge.style.cssText = 'color: #6a7488; font-size: 11px;';
        dateBadge.textContent = `📅 ${gameDate}`;
        badgeWrap.appendChild(dateBadge);
    }
    
    // Tennis round badge
    if (sport === 'Tennis' && eventData.markets.length > 0) {
        const roundMatch = (eventData.markets[0].title || '').match(/(Round\s+Of\s+\d+|Quarterfinal|Semifinal|Final)/i);
        if (roundMatch) {
            const roundBadge = document.createElement('span');
            roundBadge.style.cssText = 'background: #1a2a3a; color: #60a5fa; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600;';
            roundBadge.textContent = roundMatch[1].replace('Round Of ', 'R');
            badgeWrap.appendChild(roundBadge);
        }
    }
    // Signal badge — shows anchor/swing/early/pregame context
    if (signal.label) {
        const sigBadge = document.createElement('span');
        sigBadge.style.cssText = `background:${signal.color}22;color:${signal.color};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;`;
        sigBadge.textContent = signal.label;
        if (signal.description) sigBadge.title = signal.description;
        badgeWrap.appendChild(sigBadge);
    }
    header.appendChild(badgeWrap);
    card.appendChild(header);

    // ── Scoreboard widget (live score / pregame time / final score) ──
    if (gameScore) {
        const scoreboard = buildScoreboard(gameScore);
        if (scoreboard) card.appendChild(scoreboard);
    } else if (kalshiLive) {
        // No ESPN data but Kalshi says it's live — show simple LIVE indicator
        const liveBanner = document.createElement('div');
        liveBanner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#0a1a0a,#0f1f12);border:1px solid #00ff88;border-radius:8px;padding:10px 16px;margin-bottom:12px;';
        liveBanner.innerHTML = `<span style="color:#ff3333;font-size:10px;font-weight:800;letter-spacing:1px;display:flex;align-items:center;gap:4px;"><span style="animation:pulse 1.5s infinite;">●</span> LIVE</span><span style="color:#8892a6;font-size:12px;">Score unavailable</span>`;
        card.appendChild(liveBanner);
    }
    
    // Markets grid (compact button layout)
    const marketsGrid = document.createElement('div');
    marketsGrid.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    
    // Categorize markets
    const categorized = categorizeMarkets(eventData.markets);
    
    // Helper: generate winner row label
    function getWinnerLabel(m, prefix) {
        const isTennis = (m.event_ticker || m.ticker || '').toUpperCase().match(/KXATP|KXWTA/);
        let winLabel;
        if (isTennis) {
            const nameMatch = (m.title || '').match(/^Will\s+(.+?)\s+win\s/i);
            winLabel = nameMatch ? nameMatch[1] : getTeamLabelFromTicker(m.ticker);
        } else {
            const teamLabel = getTeamLabelFromTicker(m.ticker);
            if (!teamLabel || teamLabel === 'Winner') {
                winLabel = 'Winner';
            } else if (teamLabel.toLowerCase().endsWith('win')) {
                winLabel = teamLabel;
            } else {
                winLabel = `${teamLabel} Win`;
            }
        }
        return prefix ? `${prefix} ${winLabel}` : winLabel;
    }

    // Filter out Draw/TIE markets for sports where draws are impossible
    const noDrawSports = ['nba', 'ncaab', 'ncaaw', 'ncaaf'];
    const skipDraws = noDrawSports.includes(sport);

    // Display winner markets — each team is its own row with clear team label
    categorized.winners.forEach(m => {
        // Skip Draw/TIE for basketball/football — overtime means no draws
        if (skipDraws) {
            const suffix = (m.ticker || '').split('-').pop().toUpperCase();
            if (suffix === 'TIE' || suffix === 'DRAW') return;
        }
        marketsGrid.appendChild(createMarketRow(m, getWinnerLabel(m, '')));
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
            marketsGrid.appendChild(createMarketRow(m, extractSpreadLabel(m) || 'Spread'));
        });
        if (sorted.length > 2) {
            const spreadSection = createCollapsible('📊 More Spreads', sorted.slice(2), m => extractSpreadLabel(m) || 'Spread', `${eventData.gameId}_spreads`);
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
            const totalSection = createCollapsible('📊 More Totals', otherTotals, m => extractTotalLine(m), `${eventData.gameId}_totals`);
            marketsGrid.appendChild(totalSection);
        }
    }

    // ── First Half markets — show in collapsible sections ──
    // 1H Winners
    if (categorized.firstHalfWinners.length > 0) {
        const fhWinners = skipDraws
            ? categorized.firstHalfWinners.filter(m => {
                const suffix = (m.ticker || '').split('-').pop().toUpperCase();
                return suffix !== 'TIE' && suffix !== 'DRAW';
            })
            : categorized.firstHalfWinners;
        if (fhWinners.length > 0) {
            const sportEmoji = sport === 'nba' || sport === 'ncaab' || sport === 'ncaaw' ? '🏀' : sport === 'nfl' || sport === 'ncaaf' ? '🏈' : sport === 'nhl' ? '🏒' : '⏱️';
            const fhWinSection = createCollapsible(`${sportEmoji} 1st Half Winner`, fhWinners, m => getWinnerLabel(m, '1H'), `${eventData.gameId}_1h_winners`);
            marketsGrid.appendChild(fhWinSection);
        }
    }
    // 1H Spreads
    if (categorized.firstHalfSpreads.length > 0) {
        const fhSpreadSection = createCollapsible('📊 1st Half Spreads', categorized.firstHalfSpreads, m => extractSpreadLabel(m) || '1H Spread', `${eventData.gameId}_1h_spreads`);
        marketsGrid.appendChild(fhSpreadSection);
    }
    // 1H Totals
    if (categorized.firstHalfTotals.length > 0) {
        const fhTotalSection = createCollapsible('📊 1st Half Totals', categorized.firstHalfTotals, m => extractTotalLine(m) || '1H Total', `${eventData.gameId}_1h_totals`);
        marketsGrid.appendChild(fhTotalSection);
    }
    
    // Player props — group by stat type with readable labels
    if (categorized.props.length > 0) {
        const propsSection = createPropsSection(categorized.props, { gameScore, sport, isLive, gameId: eventData.gameId });
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
        firstHalfWinners: [],
        firstHalfSpreads: [],
        firstHalfTotals: [],
        props: []
    };
    
    function getMarketType(market) {
        // Backend enriches each market with market_type
        if (market.market_type) return market.market_type;
        
        // Fallback: detect from ticker/event_ticker prefix
        const ticker = (market.ticker || '').toUpperCase();
        const event = (market.event_ticker || '').toUpperCase();
        const title = (market.title || '').toUpperCase();
        
        // Detect 1H markets from title/ticker fallback
        const is1H = title.includes('FIRST HALF') || title.includes('1H') || ticker.includes('1H');
        
        // Check series-based prefix in ticker (most reliable)
        if (ticker.includes('GAME') || event.includes('GAME') || title.includes('WINNER')) return is1H ? '1h_winner' : 'winner';
        if (ticker.includes('SPREAD') || event.includes('SPREAD') || title.includes('WINS BY')) return is1H ? '1h_spread' : 'spread';
        if (ticker.includes('TOTAL') || event.includes('TOTAL') || title.includes('TOTAL POINTS') || title.includes('TOTAL GOALS')) return is1H ? '1h_total' : 'total';
        
        return 'prop';
    }
    
    markets.forEach(market => {
        const type = getMarketType(market);
        // Map type to category — separate 1H markets from full game
        let cat;
        if (type === '1h_winner') cat = 'firstHalfWinners';
        else if (type === '1h_spread') cat = 'firstHalfSpreads';
        else if (type === '1h_total') cat = 'firstHalfTotals';
        else if (type === 'winner') cat = 'winners';
        else if (type === 'spread') cat = 'spreads';
        else if (type === 'total') cat = 'totals';
        else cat = 'props';
        result[cat].push(market);
    });
    
    console.log(`  Categorized: W=${result.winners.length} S=${result.spreads.length} T=${result.totals.length} 1H-W=${result.firstHalfWinners.length} 1H-S=${result.firstHalfSpreads.length} 1H-T=${result.firstHalfTotals.length} Props=${result.props.length}`);
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

    // If this prop has a live stat, show it as a badge next to the label
    if (market._liveStat) {
        const stat = market._liveStat;
        const statLabel = { pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', '3pt': '3PT' }[stat.type] || stat.type.toUpperCase();
        // Extract the threshold from the title (e.g., "Player: 15+ points" → 15)
        const threshMatch = (market.title || '').match(/(\d+\.?\d*)\+/);
        const threshold = threshMatch ? parseFloat(threshMatch[1]) : null;
        const isOver = threshold !== null && parseFloat(stat.value) >= threshold;
        const isClose = threshold !== null && parseFloat(stat.value) >= threshold - 3 && !isOver;
        const badgeColor = isOver ? '#00ff88' : (isClose ? '#ffaa00' : '#8892a6');
        const badgeBg = isOver ? 'rgba(0,255,136,0.15)' : (isClose ? 'rgba(255,170,0,0.15)' : 'rgba(136,146,166,0.1)');
        labelDiv.innerHTML = `<span>${label || extractSubtitle(market.title) || market.title}</span> <span style="background:${badgeBg};color:${badgeColor};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-left:6px;">${stat.value} ${statLabel}</span>`;
    } else {
        labelDiv.textContent = label || extractSubtitle(market.title) || market.title;
    }

    // ── Opening line / favorite star (GAME markets only) ──
    const isGameMarket = /GAME|MATCH/i.test(market.series_ticker || market.ticker || '');
    if (isGameMarket) {
        const ol = openingLines[market.ticker];
        if (ol && ol.yes_price > 0) {
            const isFav = ol.yes_price > 50;
            const starSpan = document.createElement('span');
            const pct = ol.yes_price;
            if (isFav) {
                starSpan.style.cssText = 'color:#ffd700;font-size:10px;font-weight:700;margin-left:5px;white-space:nowrap;';
                starSpan.textContent = `★ ${pct}%`;
                starSpan.title = `Pre-game favorite — opened at ${pct}¢`;
            } else {
                starSpan.style.cssText = 'color:#8892a6;font-size:10px;font-weight:600;margin-left:5px;white-space:nowrap;';
                starSpan.textContent = `${pct}%`;
                starSpan.title = `Pre-game underdog — opened at ${pct}¢`;
            }
            labelDiv.appendChild(starSpan);
        }
    }

    // Inline spread/edge indicator for quick scanning
    const liq = getMarketLiquidity(market);
    if (liq.arbEdge >= 1 && liq.arbEdge <= 20 && liq.avgSpread < 99) {
        const edgeDot = document.createElement('span');
        const dotColor = liq.arbEdge <= 8 ? '#00ff88' : (liq.arbEdge <= 12 ? '#60a5fa' : '#ffaa33');
        edgeDot.style.cssText = `display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-left:6px;vertical-align:middle;`;
        edgeDot.title = `Edge: ${liq.arbEdge}¢ · Spread: ${liq.avgSpread}¢ · ${liq.tierLabel}`;
        labelDiv.appendChild(edgeDot);
    }
    
    // Read all prices first for cross-referencing
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const noBid = getPrice(market, 'no_bid');
    const noAsk = getPrice(market, 'no_ask');

    // Suppress phantom asks: 100¢ ask when opposite side has no bids = no real liquidity
    // Fall back to same-side bid (what the order book actually shows)
    const yesPrice = (yesAsk >= 99 && noBid <= 1) ? yesBid : (yesAsk > 0 ? yesAsk : 0);
    const noPrice = (noAsk >= 99 && yesBid <= 1) ? noBid : (noAsk > 0 ? noAsk : 0);

    // Market tier for button brightness: bid_sum vs spread quality
    const bidSum = (yesBid || 0) + (noBid || 0);
    const yesSpread = yesAsk > 0 && yesBid > 0 ? yesAsk - yesBid : 99;
    const noSpread  = noAsk  > 0 && noBid  > 0 ? noAsk  - noBid  : 99;
    const avgSpread = (yesSpread + noSpread) / 2;
    const mktTier = bidSum > 100 ? 'over100'
                  : avgSpread <= 3 ? 'tight'
                  : 'medium';

    const yesStyle = yesPrice > 0 ? getPriceButtonStyle(yesPrice, 'yes', mktTier) : 'background: #1a1f2e; color: #555;';
    
    const yesBtn = document.createElement('button');
    yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${yesStyle}`;

    yesBtn.setAttribute('data-ticker', market.ticker);
    yesBtn.setAttribute('data-side', 'yes');
    yesBtn.innerHTML = yesPrice > 0 ? yesPrice + '¢' : '—';
    yesBtn.onclick = () => openBotModal(market, 'yes', yesAsk);
    yesBtn.onmouseenter = () => yesBtn.style.transform = 'scale(1.05)';
    yesBtn.onmouseleave = () => yesBtn.style.transform = 'scale(1)';
    
    // NO button
    const noStyle = noPrice > 0 ? getPriceButtonStyle(noPrice, 'no', mktTier) : 'background: #1a1f2e; color: #555;';
    
    const noBtn = document.createElement('button');
    noBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${noStyle}`;
    noBtn.setAttribute('data-ticker', market.ticker);
    noBtn.setAttribute('data-side', 'no');
    noBtn.innerHTML = noPrice > 0 ? noPrice + '¢' : '—';
    noBtn.onclick = () => handleManualMiddleNoClick(market);
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

// Get button styling based on price — highlights ANCHOR zone (65-85¢) for volatility capture
// Strong favorites are where the bot places limit orders to catch dips
// marketTier: 'tight' | 'medium' | 'over100'
//   tight   = bid/ask spread ≤ 3¢ both sides → full glow, solid border (best fills)
//   medium  = spread > 3¢, bid_sum < 100 → moderate glow (normal / thin arb market)
//   over100 = bid_sum > 100 → muted/dark — paying >100c for 100c payout, not profitable for dual arb
function getPriceButtonStyle(price, side, marketTier) {
    const yesBase = '#00ff88';
    const noBase  = '#ff4444';
    const color   = side === 'yes' ? yesBase : noBase;

    if (marketTier === 'over100') {
        // bid_sum > 100 → can't buy both profitably. Dim these out.
        return `background: rgba(60,60,60,0.08); color: #444; border: 1px solid #2a2a2a;`;
    }

    if (marketTier === 'tight') {
        // Tight spread — best fill probability, full brightness
        return `background: rgba(${side==='yes'?'0,255,136':'255,68,68'},0.22); color: ${color}; border: 2px solid ${color};`;
    }

    // medium / wide / thin — all show same moderate glow
    return `background: rgba(${side==='yes'?'0,255,136':'255,68,68'},0.10); color: ${color}cc; border: 1px solid ${color}66;`;
}

// Extract team label from ticker suffix (e.g., KXNBAGAME-26FEB28HOUMIA-MIA -> "Miami")
function getTeamLabelFromTicker(ticker) {
    if (!ticker) return 'Winner';
    // Ticker format: PREFIX-DATEXXXXXX-SUFFIX
    // e.g., KXNBAGAME-26FEB28HOUMIA-MIA, KXEPLGAME-26MAR01ARSCFC-TIE
    const parts = ticker.split('-');
    const rawSuffix = parts[parts.length - 1] || '';
    if (!rawSuffix) return 'Winner';

    // For spread tickers, strip trailing digits (e.g. ORL3 → ORL, ATL1 → ATL)
    const prefix = (parts[0] || '').toUpperCase();
    const isSpread = prefix.includes('SPREAD');
    const suffix = isSpread ? rawSuffix.replace(/\d+$/, '') : rawSuffix;
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
        // NCAAB common codes
        'WIN': 'Winthrop', 'DRKE': 'Drake', 'BEL': 'Belmont', 'OWIN': 'Winthrop',
    };
    // For tennis: extract player name from title (suffix is just 3-letter abbrev like MCD, ARN)
    if (!teamMap[suffix.toUpperCase()]) {
        // This might be a tennis ticker — try to extract full player name from the title in the modal
        // For now just capitalize the abbreviation nicely
        return suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
    }
    return teamMap[suffix.toUpperCase()];
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

// For spread markets, show both sides: "UTA -3.5 / MIL +3.5"
// Uses ticker team codes (reliable) rather than title abbreviations
function extractSpreadLabel(market) {
    const ticker = market.ticker || '';
    const parts  = ticker.split('-');

    // ── 1. Get spread number from title ("X wins by over N") ──────────────
    const spreadMatch = (market.title || '').match(/wins?\s+by\s+over\s+([\d.]+)/i);
    const line = spreadMatch ? spreadMatch[1] : null;

    // ── 2. Get this market's team code from ticker last segment ────────────
    // e.g. KXNCAAMBSPREAD-26MAR05ALCNPV-NPV35 → last="NPV35" → teamCode="NPV"
    let teamCode = '';
    if (parts.length >= 3) {
        const lastSeg = parts[parts.length - 1];
        const m = lastSeg.match(/^([A-Z]+)/);
        teamCode = m ? m[1] : '';
    }

    // ── 3. Get the other team from the game code ───────────────────────────
    // game segment: "26MAR05ALCNPV" → strip date → "ALCNPV"
    let otherTeam = '';
    if (parts.length >= 2 && teamCode) {
        const gamePair = parts[1].replace(/^\d{2}[A-Z]{3}\d{2}/, '');
        if (gamePair.startsWith(teamCode)) {
            otherTeam = gamePair.slice(teamCode.length);
        } else if (gamePair.endsWith(teamCode)) {
            otherTeam = gamePair.slice(0, -teamCode.length);
        }
        // Fuzzy: try 3-char and 4-char splits
        if ((!otherTeam || otherTeam.length < 2 || otherTeam.length > 6) && gamePair.length >= 4) {
            const pfx = teamCode.slice(0, 2);
            for (const n of [3, 4, 5]) {
                const a = gamePair.slice(0, n), b = gamePair.slice(n);
                if (b.length >= 2 && b.length <= 6 && a.slice(0, 2) === pfx) { otherTeam = b; break; }
                if (a.length >= 2 && a.length <= 6 && b.slice(0, 2) === pfx) { otherTeam = a; break; }
            }
        }
    }

    // ── 4. Build label ─────────────────────────────────────────────────────
    // Show the market's own team as the subject — "TeamCode -X" means this market is
    // "TeamCode wins by over X". Showing it directly avoids two opposite markets
    // producing the same normalized label.
    if (teamCode && line) {
        if (otherTeam.length >= 2 && otherTeam.length <= 6) {
            return `${teamCode} -${line} / ${otherTeam} +${line}`;
        }
        return `${teamCode} -${line}`;
    }

    // Fallback to subtitle-based label
    const subtitle = extractSubtitle(market.title);
    const fallback = subtitle.match(/^([A-Z]+)\s*-?([\d.]+)$/);
    if (fallback) return `${fallback[1]} -${fallback[2]}`;
    return subtitle.length > 30 ? subtitle.slice(0, 27) + '...' : subtitle;
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
function parseSportFromTicker(ticker) {
    if (!ticker) return 'OTHER';
    const t = ticker.toUpperCase();
    if (t.startsWith('NFL') || t.includes('NFL')) return 'NFL';
    if (t.startsWith('NBA') || t.includes('NBA')) return 'NBA';
    if (t.startsWith('MLB') || t.includes('MLB')) return 'MLB';
    if (t.startsWith('NHL') || t.includes('NHL')) return 'NHL';
    if (t.startsWith('NCAAB') || t.includes('CBB')) return 'NCAAB';
    if (t.startsWith('NCAAF') || t.includes('CFB')) return 'NCAAF';
    if (t.startsWith('MMA') || t.includes('UFC')) return 'MMA';
    if (t.startsWith('SOC') || t.includes('SOC')) return 'Soccer';
    return 'OTHER';
}

function formatBotDisplayName(ticker, spreadLine) {
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
    let sideLabel = '';
    if (marketType === 'Spread') {
        // Use stored spread_line if available (e.g. "UTA -3.5")
        if (spreadLine) {
            sideLabel = spreadLine;
        } else {
            // Fallback: strip trailing digits from suffix to get team code
            const teamCode = suffix.replace(/\d+$/, '');
            sideLabel = teamCode || suffix;
        }
    } else if (marketType === 'Moneyline') {
        const sideTeam = getTeamLabelFromTicker(ticker);
        if (sideTeam && sideTeam !== 'Winner') {
            sideLabel = sideTeam + ' Win';
        }
    } else if (suffix) {
        sideLabel = suffix;
    }

    // Compose: "BOS vs MIL · Spread · UTA -3.5"
    const segments = [matchup, marketType, sideLabel].filter(Boolean);
    return segments.join(' · ') || ticker;
}

// Create collapsible player props section
// Generic collapsible section (used for spreads, totals, and props)
function createCollapsible(label, items, labelFn, stableKey) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 8px;';
    
    // Check if this section was previously expanded
    const wasExpanded = stableKey && expandedSections.has(stableKey);
    
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; background: #0f1419; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
        <span style="color: #8892a6; font-size: 12px; font-weight: 600;">${label} (${items.length})</span>
        <span style="color: #8892a6; font-size: 12px;">${wasExpanded ? '▲' : '▼'}</span>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `display: ${wasExpanded ? 'flex' : 'none'}; padding-top: 8px; gap: 6px; flex-direction: column;`;
    
    items.slice(0, 30).forEach(item => {
        const itemLabel = labelFn ? labelFn(item) : extractSubtitle(item.title);
        content.appendChild(createMarketRow(item, itemLabel));
    });
    
    header.onclick = () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        header.querySelector('span:last-child').textContent = isHidden ? '▲' : '▼';
        // Track expanded state for persistence across re-renders
        if (stableKey) {
            if (isHidden) expandedSections.add(stableKey);
            else expandedSections.delete(stableKey);
        }
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
function createPropsSection(props, gameCtx) {
    const STAT_LABELS = {
        'KXNBAPTS': '🏀 Points',  'KXNBAREB': '🏀 Rebounds', 'KXNBAAST': '🏀 Assists',
        'KXNBA3PT': '🏀 3-Pointers', 'KXNBASTL': '🏀 Steals', 'KXNBABLK': '🏀 Blocks',
        'KXNBAMVP': '🏆 MVP',     'KXNHLGOAL': '🏒 Goals',   'KXEPLBTTS': '⚽ BTTS',
        'KXUCLBTTS': '⚽ BTTS',   'KXMLSBTTS': '⚽ BTTS',
    };

    // Map series_ticker to ESPN stat key
    const SERIES_TO_STAT = {
        'KXNBAPTS': 'pts', 'KXNBAREB': 'reb', 'KXNBAAST': 'ast',
        'KXNBASTL': 'stl', 'KXNBABLK': 'blk', 'KXNBA3PT': '3pt',
    };

    const isLive = gameCtx && gameCtx.isLive;
    const gid = (gameCtx && gameCtx.gameId) || '';

    // Enrich props with live stat data for the renderer
    if (isLive) {
        props.forEach(m => {
            const colonIdx = (m.title || '').indexOf(':');
            if (colonIdx < 0) return;
            const playerName = m.title.substring(0, colonIdx).trim();
            const statType = SERIES_TO_STAT[m.series_ticker];
            if (!statType) return;
            const val = getPlayerLiveStat(playerName, statType);
            if (val !== null && val !== undefined) {
                m._liveStat = { value: val, type: statType };
            }
        });
    }

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
        return createCollapsible('📊 Player Props', props, m => extractPropLabel(m), `${gid}_props`);
    }

    // Multiple groups — create outer collapsible with inner sub-groups
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 8px;';
    
    const propsKey = `${gid}_props`;
    const wasPropsExpanded = expandedSections.has(propsKey);

    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px; background: #0f1419; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
    header.innerHTML = `
        <span style="color: #8892a6; font-size: 12px; font-weight: 600;">📊 Player Props (${props.length})</span>
        <span style="color: #8892a6; font-size: 12px;">${wasPropsExpanded ? '▲' : '▼'}</span>
    `;

    const content = document.createElement('div');
    content.style.cssText = `display: ${wasPropsExpanded ? 'flex' : 'none'}; padding-top: 8px; gap: 4px; flex-direction: column;`;

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
        const subCollapsible = createCollapsible(`${groupLabel} (${items.length})`, items, m => extractPropLabel(m), `${gid}_props_${key}`);
        content.appendChild(subCollapsible);
    });

    header.onclick = () => {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        header.querySelector('span:last-child').textContent = isHidden ? '▲' : '▼';
        if (isHidden) expandedSections.add(propsKey);
        else expandedSections.delete(propsKey);
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
let modalRefreshInterval = null;

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
    const yesBid = getPrice(market, 'yes_bid') || 0;
    const noBid  = getPrice(market, 'no_bid')  || 0;
    // Market identity: YES ask + NO bid = 100, YES bid + NO ask = 100.
    // Derive any missing ask using the opposite side's bid when the ask isn't cached.
    const yesAsk = (getPrice(market, 'yes_ask') || 0) || (noBid  > 0 ? 100 - noBid  : 0);
    const noAsk  = (getPrice(market, 'no_ask')  || 0) || (yesBid > 0 ? 100 - yesBid : 0);

    const targetTotal = 100 - width;          // e.g. width=5 → 95¢ total

    // ── Derive missing bids from opposite side ──
    // If one side has no bids, derive a target from the known side + width.
    // E.g. yesBid=2, noBid=0, width=10 → derivedNo = 100 - 2 - 10 = 88.
    // This shows the REAL price needed to complete the arb, not a fake 50¢.
    let effectiveYesBid = yesBid;
    let effectiveNoBid  = noBid;

    if (effectiveYesBid <= 0 && effectiveNoBid <= 0) {
        // Both sides empty — can't compute, use midpoint as placeholder
        effectiveYesBid = Math.floor(targetTotal / 2);
        effectiveNoBid  = targetTotal - effectiveYesBid;
    } else if (effectiveYesBid <= 0) {
        // Only NO bids exist — derive YES from NO + width
        effectiveYesBid = 100 - effectiveNoBid - width;
    } else if (effectiveNoBid <= 0) {
        // Only YES bids exist — derive NO from YES + width
        effectiveNoBid = 100 - effectiveYesBid - width;
    }

    // ── Pricing mode selection ──
    // ASK-SIDE: use whenever bid/ask spread > 1¢ on either side — post between bid and ask,
    //   putting us closer to the front of the queue. For wide widths the price may still fall
    //   below the bid (unavoidable math), but we always start from the ask and shave down.
    // BID-SIDE: only when spreads are 1¢ (no room between bid/ask), just match the bid.
    const bidSum = effectiveYesBid + effectiveNoBid;
    const totalShave = bidSum - targetTotal;

    const yesSpreadAmt = yesAsk > 0 && yesBid > 0 ? yesAsk - yesBid : 0;
    const noSpreadAmt  = noAsk  > 0 && noBid  > 0 ? noAsk  - noBid  : 0;
    const hasRoomBetweenBidAsk = yesAsk > 0 && noAsk > 0 && (yesSpreadAmt > 1 || noSpreadAmt > 1);

    const yesIsFav = effectiveYesBid >= effectiveNoBid;  // higher bid = more likely to win
    let targetYes, targetNo;
    let usingAskSide = false;

    if (hasRoomBetweenBidAsk) {
        // ── ASK-SIDE PRICING ── thin market, anchor to asks and shave down
        // Posts our buy orders between bid and ask — more aggressive, better fill probability.
        // askSum = yesAsk + noAsk ≈ 200 - bidSum, so it's almost always > targetTotal.
        const askSum = yesAsk + noAsk;
        const askShave = Math.max(0, askSum - targetTotal);

        let favAskShave = Math.floor(askShave * 0.4);  // shave less from fav (stays close to ask, fills faster)
        let dogAskShave = askShave - favAskShave;

        // Never post AT or ABOVE the ask (would cross spread and fill immediately at bad price)
        // Cap each side so we stay at least 1¢ below the ask
        const maxYesTarget = Math.max(1, yesAsk - 1);
        const maxNoTarget  = Math.max(1, noAsk  - 1);

        if (yesIsFav) {
            targetYes = Math.min(maxYesTarget, yesAsk - favAskShave);
            targetNo  = Math.min(maxNoTarget,  noAsk  - dogAskShave);
        } else {
            targetYes = Math.min(maxYesTarget, yesAsk - dogAskShave);
            targetNo  = Math.min(maxNoTarget,  noAsk  - favAskShave);
        }

        // Ensure we still achieve the target width — adjust if needed
        const askProfit = 100 - targetYes - targetNo;
        if (askProfit < width) {
            // Trim the fav side to restore width
            if (yesIsFav) targetYes = Math.max(1, 100 - targetNo - width);
            else           targetNo  = Math.max(1, 100 - targetYes - width);
        }

        usingAskSide = true;
    } else {
        // ── BID-SIDE PRICING ── spreads are 1¢ (tight) or no ask data, shave from bids
        let favShave = Math.floor(totalShave * 0.4);   // less shave on favorite — stays near bid, fills faster
        let dogShave = totalShave - favShave;           // more shave on underdog — deeper limit, fav fills first

        // Get the underdog's max shaveable room (can't go below 1¢)
        const dogBid = yesIsFav ? effectiveNoBid : effectiveYesBid;
        const dogMaxShave = Math.max(0, dogBid - 1);

        if (dogShave > dogMaxShave) {
            const overflow = dogShave - dogMaxShave;
            dogShave = dogMaxShave;
            favShave = favShave + overflow;
        }

        if (yesIsFav) {
            targetYes = effectiveYesBid - favShave;
            targetNo  = effectiveNoBid - dogShave;
        } else {
            targetYes = effectiveYesBid - dogShave;
            targetNo  = effectiveNoBid - favShave;
        }

        // NEVER exceed current bid — that overpays
        if (yesBid > 0) targetYes = Math.min(targetYes, yesBid);
        if (noBid > 0)  targetNo  = Math.min(targetNo, noBid);
    }

    // Clamp to valid price range
    targetYes = Math.max(1, Math.min(targetYes, 98));
    targetNo  = Math.max(1, Math.min(targetNo, 98));

    // Enforce target width: if dog hit the 1¢ floor, push fav down to maintain width.
    let dogAtFloor = false;
    const actualProfit = 100 - targetYes - targetNo;
    if (actualProfit < width) {
        dogAtFloor = true;
        if (yesIsFav) {
            targetYes = Math.max(1, 100 - targetNo - width);
        } else {
            targetNo  = Math.max(1, 100 - targetYes - width);
        }
    }

    // Detect when a side's shave was redistributed to the other side
    const yesShaved = effectiveYesBid - targetYes;
    const noShaved  = effectiveNoBid  - targetNo;
    const yesUnshaved = totalShave > 0 && yesShaved <= 0;
    const noUnshaved  = totalShave > 0 && noShaved  <= 0;

    return {
        targetYes, targetNo,
        total:   targetYes + targetNo,
        profit:  100 - (targetYes + targetNo),
        yesBid, noBid, yesAsk, noAsk,
        yesIsFav,
        usingAskSide,   // true when market is thin — priced from ask side
        // Flag when a side has no real liquidity
        yesNoLiquidity: yesBid <= 0,
        noNoLiquidity:  noBid <= 0,
        // Flag when a side couldn't be shaved below its bid (too low to shave)
        yesUnshaved, noUnshaved,
        // Flag when dog hit 1¢ floor and the excess shave rolled onto the fav
        dogAtFloor,
    };
}

// ═══════════════════════════════════════════════════════════════════
// TRADE MODE: Straight Bet vs Dual Arb Bot
// ═══════════════════════════════════════════════════════════════════

let currentTradeMode = 'straight'; // 'straight' or 'arb'
let currentStraightSide = 'yes';   // 'yes' or 'no'

/** Set trade mode and toggle visibility */
function setTradeMode(mode) {
    currentTradeMode = mode;
    const straightSection = document.getElementById('straight-section');
    const arbSection = document.getElementById('arb-section');
    const middleSection = document.getElementById('middle-bot-section');
    const straightBtn = document.getElementById('mode-straight');
    const arbBtn = document.getElementById('mode-arb');
    const middleBtn = document.getElementById('mode-middle');
    const iconEl = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-mode-title');
    const subtitleEl = document.getElementById('modal-mode-subtitle');

    // Hide all, deactivate all
    if (straightSection) straightSection.style.display = 'none';
    if (arbSection) arbSection.style.display = 'none';
    if (middleSection) middleSection.style.display = 'none';
    [straightBtn, arbBtn, middleBtn].forEach(btn => {
        if (btn) { btn.style.background = 'transparent'; btn.style.color = '#8892a6'; btn.style.borderBottom = '2px solid transparent'; }
    });

    if (mode === 'straight') {
        if (straightSection) straightSection.style.display = 'block';
        if (straightBtn) { straightBtn.style.background = '#00ff8822'; straightBtn.style.color = '#00ff88'; straightBtn.style.borderBottom = '2px solid #00ff88'; }
        iconEl.textContent = '💰';
        titleEl.textContent = 'Straight Bet';
        subtitleEl.textContent = 'Limit Order';
    } else if (mode === 'middle') {
        if (middleSection) middleSection.style.display = 'block';
        if (middleBtn) { middleBtn.style.background = '#aa66ff22'; middleBtn.style.color = '#aa66ff'; middleBtn.style.borderBottom = '2px solid #aa66ff'; }
        iconEl.textContent = '↔️';
        titleEl.textContent = 'Middle Bot';
        subtitleEl.textContent = 'Dual-Spread Automation';
        updateMiddleBotCalc();
    } else {
        // arb
        if (arbSection) arbSection.style.display = 'block';
        if (arbBtn) { arbBtn.style.background = '#00ff8822'; arbBtn.style.color = '#00ff88'; arbBtn.style.borderBottom = '2px solid #00ff88'; }
        iconEl.textContent = '⚡';
        titleEl.textContent = 'Dual-Arb Bot';
        subtitleEl.textContent = 'Settlement Arbitrage Engine';
        // Recalculate arb prices when switching to arb mode
        recalcArbPrices();
    }
}

/** Set the selected side for straight bet */
function setStraightSide(side) {
    currentStraightSide = side;
    const yesBtn = document.getElementById('straight-yes-btn');
    const noBtn = document.getElementById('straight-no-btn');
    const priceInput = document.getElementById('straight-price');
    const priceLabel = document.getElementById('straight-price-label');

    if (side === 'yes') {
        yesBtn.style.border = '2px solid #00ff88';
        yesBtn.style.background = '#00ff8822';
        yesBtn.style.color = '#00ff88';
        noBtn.style.border = '2px solid #ff444444';
        noBtn.style.background = 'transparent';
        noBtn.style.color = '#ff444466';
        priceInput.style.color = '#00ff88';
        priceInput.style.borderColor = '#00ff8866';
        priceLabel.style.color = '#00ff88';
        priceLabel.textContent = 'YES LIMIT PRICE';
    } else {
        noBtn.style.border = '2px solid #ff4444';
        noBtn.style.background = '#ff444422';
        noBtn.style.color = '#ff4444';
        yesBtn.style.border = '2px solid #00ff8844';
        yesBtn.style.background = 'transparent';
        yesBtn.style.color = '#00ff8866';
        priceInput.style.color = '#ff4444';
        priceInput.style.borderColor = '#ff444466';
        priceLabel.style.color = '#ff4444';
        priceLabel.textContent = 'NO LIMIT PRICE';
    }

    // Update price to current ask for the selected side
    if (currentArbMarket) {
        const price = side === 'yes'
            ? (getPrice(currentArbMarket, 'yes_ask') || getPrice(currentArbMarket, 'yes_bid'))
            : (getPrice(currentArbMarket, 'no_ask') || getPrice(currentArbMarket, 'no_bid'));
        if (price) priceInput.value = price;
    }

    updateStraightPreview();
}

// ── No-Vig Fair Value Calculator (OddsJam) ────────────────────────────────────
let currentFairYesCents = null;
let currentFairNoCents = null;

function toggleNoVigSection() {
    const section = document.getElementById('novig-section');
    const chevron = document.getElementById('novig-chevron');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        chevron.textContent = '▲';
    } else {
        section.style.display = 'none';
        chevron.textContent = '▼';
    }
}

/** Convert American odds string to implied probability (0–1). Returns null on bad input. */
function americanToImplied(oddsStr) {
    const odds = parseFloat(oddsStr);
    if (isNaN(odds) || odds === 0) return null;
    if (odds > 0) return 100 / (odds + 100);
    return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Convert American odds to cents (0-100). Returns null on bad input. */
function americanToCents(oddsStr) {
    const impl = americanToImplied(oddsStr);
    return impl !== null ? Math.round(impl * 100) : null;
}

/** Render the green/red fair value boxes used by both input modes */
function renderFairValueBoxes(fairYes, fairNo, centerText) {
    return `
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:8px;">
            <div style="background:#00ff8811;border:1px solid #00ff8833;border-radius:6px;padding:6px 8px;text-align:center;">
                <div style="color:#555;font-size:9px;text-transform:uppercase;margin-bottom:2px;">Fair YES</div>
                <div style="color:#00ff88;font-weight:800;font-size:16px;">${fairYes}¢</div>
            </div>
            <div style="color:#555;font-size:10px;text-align:center;">${centerText}</div>
            <div style="background:#ff444411;border:1px solid #ff444433;border-radius:6px;padding:6px 8px;text-align:center;">
                <div style="color:#555;font-size:9px;text-transform:uppercase;margin-bottom:2px;">Fair NO</div>
                <div style="color:#ff4444;font-weight:800;font-size:16px;">${fairNo}¢</div>
            </div>
        </div>`;
}

/** Handle direct no-vig input — accepts American odds (-130, +150) or cents (1-99) */
function updateDirectNoVig() {
    const raw = (document.getElementById('novig-direct').value || '').trim();
    const hintEl = document.getElementById('novig-direct-hint');

    if (!raw) {
        currentFairYesCents = null;
        currentFairNoCents  = null;
        if (hintEl) hintEl.innerHTML = '';
        updateEdgeDisplay();
        return;
    }

    // Detect format: starts with + or - → American odds, otherwise try cents
    const isAmerican = raw.startsWith('+') || raw.startsWith('-');

    if (isAmerican) {
        const cents = americanToCents(raw);
        if (cents === null || cents < 1 || cents > 99) {
            if (hintEl) hintEl.innerHTML = '<span style="color:#ff4444;">Invalid American odds</span>';
            return;
        }
        currentFairYesCents = cents;
        currentFairNoCents  = 100 - cents;
        if (hintEl) hintEl.innerHTML = renderFairValueBoxes(cents, 100 - cents, `${raw}<br>converted`);
    } else {
        const val = parseInt(raw);
        if (isNaN(val) || val < 1 || val > 99) {
            if (hintEl) hintEl.innerHTML = '<span style="color:#ff4444;">Enter 1-99 for cents or ±odds for American</span>';
            return;
        }
        currentFairYesCents = val;
        currentFairNoCents  = 100 - val;
        if (hintEl) hintEl.innerHTML = renderFairValueBoxes(val, 100 - val, `${val}¢<br>entered`);
    }

    // Clear the two-sided inputs since direct takes priority
    const overEl = document.getElementById('novig-over');
    const underEl = document.getElementById('novig-under');
    if (overEl) overEl.value = '';
    if (underEl) underEl.value = '';
    const resultEl = document.getElementById('novig-result');
    if (resultEl) resultEl.innerHTML = '<span style="color:#555;">Direct input used above ↑</span>';

    updateEdgeDisplay();
}

/** Recalculate no-vig fair values from the OddsJam odds inputs */
function updateNoVigDisplay() {
    // Clear direct input since two-sided takes priority when used
    const directEl = document.getElementById('novig-direct');
    const directHintEl = document.getElementById('novig-direct-hint');
    if (directEl && directEl.value.trim()) {
        directEl.value = '';
        if (directHintEl) directHintEl.textContent = '';
    }

    const overStr  = (document.getElementById('novig-over').value  || '').trim();
    const underStr = (document.getElementById('novig-under').value || '').trim();
    const resultEl = document.getElementById('novig-result');

    if (!overStr || !underStr) {
        currentFairYesCents = null;
        currentFairNoCents  = null;
        if (resultEl) resultEl.innerHTML = '<span style="color:#555;">Enter both odds to calculate fair value</span>';
        updateEdgeDisplay();
        return;
    }

    const overImpl  = americanToImplied(overStr);
    const underImpl = americanToImplied(underStr);

    if (overImpl === null || underImpl === null) {
        currentFairYesCents = null;
        currentFairNoCents  = null;
        if (resultEl) resultEl.innerHTML = '<span style="color:#ff4444;">Invalid odds format (e.g. -110 or +150)</span>';
        updateEdgeDisplay();
        return;
    }

    const totalImpl = overImpl + underImpl;
    const fairYes   = overImpl  / totalImpl;
    const fairNo    = underImpl / totalImpl;
    currentFairYesCents = Math.round(fairYes * 100);
    currentFairNoCents  = Math.round(fairNo  * 100);
    const juice = ((totalImpl - 1) * 100).toFixed(1);

    if (resultEl) {
        resultEl.innerHTML = renderFairValueBoxes(currentFairYesCents, currentFairNoCents, `${juice}% vig<br>removed`);
    }

    updateEdgeDisplay();
}

/** Show edge comparison in the straight-edge-display div */
function updateEdgeDisplay() {
    const edgeEl = document.getElementById('straight-edge-display');
    if (!edgeEl) return;

    const side  = currentStraightSide;
    const price = parseInt(document.getElementById('straight-price').value) || 0;
    const fairCents = side === 'yes' ? currentFairYesCents : currentFairNoCents;

    if (fairCents === null || price < 1 || price > 99) {
        edgeEl.innerHTML = '';
        return;
    }

    const edge      = fairCents - price;  // positive = buying below fair = value
    const edgeColor = edge > 0 ? '#00ff88' : edge < 0 ? '#ff4444' : '#ffaa00';
    const edgeIcon  = edge > 0 ? '✅' : edge < 0 ? '❌' : '➖';
    const edgeLabel = edge > 0 ? 'VALUE BET' : edge < 0 ? 'OVERPAY' : 'FAIR PRICE';
    const sideLabel = side.toUpperCase();
    const edgePct   = price > 0 ? (edge / price * 100).toFixed(1) : '0.0';

    edgeEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:${edgeColor}11;border:1px solid ${edgeColor}44;border-radius:8px;">
            <span style="font-size:18px;">${edgeIcon}</span>
            <div style="text-align:left;">
                <div style="color:${edgeColor};font-weight:800;font-size:15px;">${edge > 0 ? '+' : ''}${edge}¢ ${edgeLabel}</div>
                <div style="color:#8892a6;font-size:10px;">Fair ${sideLabel}: ${fairCents}¢ · Your price: ${price}¢ · Edge: ${edge > 0 ? '+' : ''}${edgePct}%</div>
            </div>
        </div>`;
}

/** Update straight bet preview (payout calculator) */
function updateStraightPreview() {
    const price = parseInt(document.getElementById('straight-price').value) || 0;
    const qty = parseInt(document.getElementById('straight-qty').value) || 1;
    const side = currentStraightSide;

    if (price < 1 || price > 99) {
        document.getElementById('straight-preview').innerHTML = '';
        return;
    }

    const cost = (price * qty / 100).toFixed(2);
    const payout = (qty).toFixed(2);          // $1 per contract if wins
    const profit = ((100 - price) * qty / 100).toFixed(2);
    const roi = ((100 - price) / price * 100).toFixed(1);
    const impliedProb = price;  // price in cents = implied probability %
    const sideColor = side === 'yes' ? '#00ff88' : '#ff4444';
    const sideLabel = side === 'yes' ? 'YES' : 'NO';

    // Get current market bid for the hint
    let hintText = '';
    if (currentArbMarket) {
        const bid = side === 'yes' ? getPrice(currentArbMarket, 'yes_bid') : getPrice(currentArbMarket, 'no_bid');
        const ask = side === 'yes' ? getPrice(currentArbMarket, 'yes_ask') : getPrice(currentArbMarket, 'no_ask');
        if (ask > 0 && price >= ask) {
            hintText = `<span style="color:#00ff88;">⚡ At or above ask (${ask}¢) — fills immediately</span>`;
        } else if (price > bid && bid > 0) {
            if (ask > 0) {
                hintText = `<span style="color:#8892a6;">Between bid (${bid}¢) and ask (${ask}¢)</span>`;
            } else {
                hintText = `<span style="color:#00ff88;">⚡ Above best bid (${bid}¢) — likely fills</span>`;
            }
        } else if (price === bid && bid > 0) {
            hintText = `<span style="color:#ffaa00;">⏳ At bid (${bid}¢) — joins queue behind ${bid}¢ orders</span>`;
        } else if (price < bid && bid > 0) {
            hintText = `<span style="color:#ff4444;">⏳ Below bid (${bid}¢) — unlikely to fill</span>`;
        } else {
            hintText = `<span style="color:#8892a6;">Bid: ${bid}¢ · Ask: ${ask > 0 ? ask + '¢' : '—'}</span>`;
        }
    }

    document.getElementById('straight-preview').innerHTML = `
        <div style="border:1px solid ${sideColor}33;border-radius:10px;background:${side === 'yes' ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.04)'};overflow:hidden;">
            <div style="padding:12px 16px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;border-bottom:1px solid ${sideColor}22;">
                <span style="color:${sideColor};font-weight:700;">${sideLabel} ${price}¢</span>
                <span style="color:#555;">×</span>
                <span style="color:#fff;font-weight:700;">${qty}</span>
                <span style="color:#555;">→</span>
                <span style="color:#fff;">cost <strong>$${cost}</strong></span>
                <span style="color:#555;">→</span>
                <span style="color:${sideColor};font-weight:800;">wins +$${profit}</span>
            </div>
            <div style="padding:10px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;">
                <div>
                    <div style="color:#555;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Cost</div>
                    <div style="color:#fff;font-weight:700;font-size:14px;">$${cost}</div>
                </div>
                <div>
                    <div style="color:#555;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">If Wins</div>
                    <div style="color:${sideColor};font-weight:800;font-size:14px;">+$${profit}</div>
                </div>
                <div>
                    <div style="color:#555;font-size:9px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">ROI / Prob</div>
                    <div style="color:${sideColor};font-weight:700;font-size:14px;">+${roi}% / ${impliedProb}%</div>
                </div>
            </div>
            ${hintText ? `<div style="padding:6px 16px 10px;text-align:center;font-size:11px;">${hintText}</div>` : ''}
        </div>`;

    // Update hint below price input
    const hintEl = document.getElementById('straight-price-hint');
    if (hintEl && currentArbMarket) {
        const bid = side === 'yes' ? getPrice(currentArbMarket, 'yes_bid') : getPrice(currentArbMarket, 'no_bid');
        hintEl.textContent = `current bid: ${bid}¢`;
    }

    // Update edge display if fair values are set
    updateEdgeDisplay();
}

/** Place a straight limit order */
async function placeStraightBet() {
    if (!currentArbMarket) { alert('No market selected'); return; }

    const side = currentStraightSide;
    const price = parseInt(document.getElementById('straight-price').value);
    const qty = parseInt(document.getElementById('straight-qty').value) || 1;
    const addWatch = document.getElementById('straight-add-watch').checked;
    const sl = parseInt(document.getElementById('straight-sl').value) || 5;
    const tp = parseInt(document.getElementById('straight-tp').value) || 0;

    if (!price || price < 1 || price > 99) { alert('Price must be 1-99¢'); return; }

    const cost = (price * qty / 100).toFixed(2);
    const profit = ((100 - price) * qty / 100).toFixed(2);
    const watchNote = addWatch ? `\n🛑 Auto stop-loss: -${sl}¢${tp > 0 ? ` · Take-profit: +${tp}¢` : ''}` : '';

    if (!confirm(`💰 Place Limit Order\n\n${side.toUpperCase()} on: ${currentArbMarket.ticker}\nPrice: ${price}¢ × ${qty} contracts\nCost: $${cost}\nPays: $${(qty).toFixed(2)} if ${side} wins (+$${profit})${watchNote}\n\nConfirm?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/order/place`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: currentArbMarket.ticker,
                side,
                price,
                quantity: qty,
                add_watch: addWatch,
                stop_loss_cents: sl,
                take_profit_cents: tp,
                fair_value_cents: side === 'yes' ? currentFairYesCents : currentFairNoCents,
            }),
        });
        const data = await resp.json();

        if (data.success) {
            showNotification(`✅ ${side.toUpperCase()} limit order placed: ${qty}× at ${price}¢ — cost $${cost}`);
            closeModal();
            loadBots();
            if (addWatch && !autoMonitorInterval) toggleAutoMonitor();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

/** Open the trade modal — defaults to straight bet mode with clicked side pre-selected */
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
    // Opening line badge for modal title
    const isGameMkt = /GAME|MATCH/i.test(market.series_ticker || market.ticker || '');
    const ol = isGameMkt ? (openingLines[market.ticker] || null) : null;
    const olBadge = ol ? (() => {
        const isFav = ol.yes_price > 50;
        const color = isFav ? '#ffd700' : '#8892a6';
        const label = isFav ? `★ Pre-game fav ${ol.yes_price}%` : `Pre-game dog ${ol.yes_price}%`;
        return `<span style="background:${color}22;color:${color};border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;" title="Opening line captured before game started">${label}</span>`;
    })() : '';

    titleEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>${emoji}</span>
        <span>${displayTitle}</span>
        <span style="background:#1e2740;color:#8892a6;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;">${sport}</span>
        ${olBadge}
    </div>`;

    // ── Market prices (visual cards, not raw text) ──
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const noBid  = getPrice(market, 'no_bid');
    const noAsk  = getPrice(market, 'no_ask');
    const yesSpread = (yesAsk > 0 && yesBid > 0) ? (yesAsk - yesBid) : 0;
    const noSpread  = (noAsk > 0 && noBid > 0) ? (noAsk - noBid) : 0;

    // Format price display — show "—" for no bids/asks
    const fmtPrice = (v) => v > 0 ? `${v}¢` : '—';

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
                <span style="color:#555;font-size:9px;">${yesSpread > 0 ? `spread ${yesSpread}¢` : ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span style="color:#8892a6;">Bid <strong style="color:#00ff88;">${fmtPrice(yesBid)}</strong></span>
                <span style="color:#8892a6;">Ask <strong style="color:#00ff88;">${fmtPrice(yesAsk)}</strong></span>
            </div>
        </div>
        <div style="background:#060a14;border:1px solid #ff444433;border-radius:6px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="color:#ff4444;font-weight:700;font-size:11px;">${noTeamLabel}</span>
                <span style="color:#555;font-size:9px;">${noSpread > 0 ? `spread ${noSpread}¢` : ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span style="color:#8892a6;">Bid <strong style="color:#ff4444;">${fmtPrice(noBid)}</strong></span>
                <span style="color:#8892a6;">Ask <strong style="color:#ff4444;">${fmtPrice(noAsk)}</strong></span>
            </div>
        </div>
    `;

    // ── Set default mode to straight bet ──
    setTradeMode('straight');
    setStraightSide(_side || 'yes');

    // Pre-fill straight price with ask (what it costs to buy now)
    const defaultPrice = (_side === 'no')
        ? (noAsk || noBid || (100 - yesAsk))
        : (yesAsk || yesBid || 50);
    document.getElementById('straight-price').value = defaultPrice;
    document.getElementById('straight-qty').value = 1;
    // Clear no-vig calculator
    currentFairYesCents = null;
    currentFairNoCents  = null;
    const novigOverEl = document.getElementById('novig-over');
    const novigUnderEl = document.getElementById('novig-under');
    if (novigOverEl) novigOverEl.value = '';
    if (novigUnderEl) novigUnderEl.value = '';
    const novigDirectEl = document.getElementById('novig-direct');
    if (novigDirectEl) novigDirectEl.value = '';
    const novigDirectHintEl = document.getElementById('novig-direct-hint');
    if (novigDirectHintEl) novigDirectHintEl.textContent = '';
    const novigResultEl = document.getElementById('novig-result');
    if (novigResultEl) novigResultEl.innerHTML = '<span style="color:#555;">Enter both odds to calculate fair value</span>';
    const novigSectionEl = document.getElementById('novig-section');
    if (novigSectionEl) novigSectionEl.style.display = 'none';
    const novigChevronEl = document.getElementById('novig-chevron');
    if (novigChevronEl) novigChevronEl.textContent = '▼';
    updateStraightPreview();

    // Also prepare arb side for if they switch
    const spreadSum  = Math.max(0, (yesAsk - yesBid) + (noAsk - noBid));
    const autoWidth  = Math.max(3, Math.min(15, Math.round(spreadSum / 2) || 5));
    document.getElementById('bot-arb-width').value = autoWidth;
    document.getElementById('strategy-details').style.display = 'none';
    document.getElementById('strategy-chevron').textContent = '▼';

    // Show watch options toggle logic
    const watchCheck = document.getElementById('straight-add-watch');
    const watchOpts = document.getElementById('straight-watch-opts');
    watchCheck.checked = false;
    watchOpts.style.display = 'none';
    watchCheck.onchange = () => {
        watchOpts.style.display = watchCheck.checked ? 'grid' : 'none';
    };

    // ── Preset recommendation based on game signal ──
    const liq = getMarketLiquidity(market);
    const gameId = extractGameId(market.event_ticker || market.ticker || '');
    const signal = getGameSignal(gameId, sport, [market]);
    const sigType = signal.type; // anchor, swing, caution, pregame, none
    const recEl = document.getElementById('preset-recommendation');
    if (recEl && liq.arbEdge <= 20 && liq.arbEdge >= 1) {
        const recPresets = getRecommendedPresets(liq.tier, sigType);
        const recLabel = recPresets.join('¢, ') + '¢';
        // Signal-aware recommendation text
        let sigText = '', sigColor = liq.tierColor;
        if (sigType === 'coin_flip') {
            sigText = '🔵 COIN FLIP — close game, both legs will bounce → best entry';
            sigColor = '#60a5fa';
        } else if (sigType === 'lean') {
            sigText = '🟢 LEAN — small lead, still volatile, decent entry';
            sigColor = '#4ade80';
        } else if (sigType === 'drifting') {
            sigText = '🟡 DRIFTING — lead building, dog fills getting harder';
            sigColor = '#ffaa33';
        } else if (sigType === 'runaway') {
            sigText = '🔴 RUNAWAY — blowout, dog side dead, use very wide or skip';
            sigColor = '#ff6644';
        } else if (sigType === 'late_game') {
            sigText = '⌛ LATE GAME — running out of time for both legs to fill';
            sigColor = '#ff4444';
        } else if (sigType === 'early') {
            sigText = '⚪ EARLY — game just started, no score context yet';
            sigColor = '#8892a6';
        } else if (sigType === 'pregame') {
            sigText = '⏳ PREGAME — waiting for tip-off';
            sigColor = '#8892a6';
        } else {
            sigText = `💡 ${liq.tierLabel}`;
        }
        recEl.style.display = 'block';
        recEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;">`
            + `<span style="color:${sigColor};font-weight:700;">${sigText}</span>`
            + `<span style="color:#8892a6;font-size:10px;">edge ${liq.arbEdge}¢ · spread ${liq.avgSpread}¢</span>`
            + `</div>`
            + (signal.description ? `<div style="color:#6a7488;font-size:10px;margin-top:2px;">${signal.description}</div>` : '');
        // Highlight recommended tier buttons + add ★ to recommended
        const midPreset = recPresets[Math.floor(recPresets.length / 2)];
        document.querySelectorAll('.arb-preset-btn').forEach(btn => {
            const bw = parseInt(btn.dataset.width);
            const isRec = recPresets.includes(bw);
            const label = btn.querySelector('div');
            if (isRec) {
                btn.style.boxShadow = `0 0 8px ${sigColor}44`;
                btn.dataset.recommended = 'true';
                if (label) {
                    label.textContent = bw === midPreset ? `${bw}¢ ★` : `${bw}¢`;
                    label.style.color = bw === midPreset ? '#ffaa33' : sigColor;
                }
            } else {
                btn.style.boxShadow = 'none';
                btn.dataset.recommended = '';
                if (label) {
                    label.textContent = `${bw}¢`;
                    label.style.color = '#00ff88';
                }
            }
        });
        applyPreset(midPreset);
    } else if (recEl) {
        recEl.style.display = 'none';
        // Clear all recommendation markers and reset labels
        document.querySelectorAll('.arb-preset-btn').forEach(btn => {
            btn.style.boxShadow = 'none';
            btn.dataset.recommended = '';
            const label = btn.querySelector('div');
            if (label) {
                label.textContent = `${btn.dataset.width}¢`;
                label.style.color = '#00ff88';
            }
        });
    }

    // Underdog warning removed — no longer relevant for dual arb strategy
    const warnEl = document.getElementById('modal-underdog-warning');
    if (warnEl) warnEl.style.display = 'none';

    // Ensure single-market layout: show market card, reset middle data
    const marketCard = document.getElementById('bot-market-card');
    if (marketCard) marketCard.style.display = '';
    _currentMiddleData = null;

    document.getElementById('bot-modal').classList.add('show');

    // ── Auto-refresh market prices every 3s using ORDERBOOK (real-time) ──
    if (modalRefreshInterval) clearInterval(modalRefreshInterval);
    modalRefreshInterval = setInterval(async () => {
        if (!currentArbMarket || !document.getElementById('bot-modal').classList.contains('show')) {
            clearInterval(modalRefreshInterval);
            modalRefreshInterval = null;
            return;
        }
        try {
            const resp = await fetch(`${API_BASE}/orderbook/${currentArbMarket.ticker}`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.error) return;
            const ob = data.orderbook || data;
            const yesLevels = (ob.yes || []).slice().reverse();
            const noLevels  = (ob.no  || []).slice().reverse();
            const bestYesBid = yesLevels.length ? parseOrderLevel(yesLevels[0]).price : 0;
            const bestNoBid  = noLevels.length  ? parseOrderLevel(noLevels[0]).price  : 0;
            // Derive ask from opposite side: YES ask = 100 - best NO bid
            const bestYesAsk = bestNoBid  > 0 ? (100 - bestNoBid)  : 0;
            const bestNoAsk  = bestYesBid > 0 ? (100 - bestYesBid) : 0;
            // Update currentArbMarket with real-time orderbook prices
            currentArbMarket.yes_bid = bestYesBid;
            currentArbMarket.no_bid  = bestNoBid;
            currentArbMarket.yes_ask = bestYesAsk;
            currentArbMarket.no_ask  = bestNoAsk;
            // Clear dollar fields so getPrice() uses the integer fields
            delete currentArbMarket.yes_bid_dollars;
            delete currentArbMarket.no_bid_dollars;
            delete currentArbMarket.yes_ask_dollars;
            delete currentArbMarket.no_ask_dollars;
            // Update price cards
            refreshModalPriceCards();
            // Recalc arb prices if in arb mode
            if (currentTradeMode === 'arb') {
                recalcArbPrices();
            }
        } catch (e) { /* silent — modal still usable with stale data */ }
    }, 3000);
}

/** Refresh the price display cards in the open modal with currentArbMarket data */
function refreshModalPriceCards() {
    if (!currentArbMarket) return;
    const market = currentArbMarket;
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const noBid  = getPrice(market, 'no_bid');
    const noAsk  = getPrice(market, 'no_ask');
    const yesSpread = (yesAsk > 0 && yesBid > 0) ? (yesAsk - yesBid) : 0;
    const noSpread  = (noAsk > 0 && noBid > 0) ? (noAsk - noBid) : 0;

    const fmtPrice = (v) => v > 0 ? `${v}¢` : '—';

    const teamFromTicker = getTeamLabelFromTicker(market.ticker);
    // Smart labels for refresh modal price cards
    const mtype = market.market_type || '';
    const isWinnerRow = teamFromTicker && teamFromTicker !== 'Winner';
    const isTotalRow = mtype === 'total';
    const threshMatch = (market.title || '').match(/(\d+)\+/);
    let yesTeamLabel, noTeamLabel;
    if (isWinnerRow) {
        yesTeamLabel = `YES — ${teamFromTicker} wins`;
        noTeamLabel = `NO — ${teamFromTicker} loses`;
    } else if (threshMatch) {
        yesTeamLabel = `YES — ${threshMatch[1]}+ ✓`;
        noTeamLabel = `NO — Under ${threshMatch[1]}`;
    } else if (isTotalRow) {
        yesTeamLabel = `YES — Over`;
        noTeamLabel = `NO — Under`;
    } else {
        yesTeamLabel = 'YES';
        noTeamLabel = 'NO';
    }

    document.getElementById('bot-market-prices').innerHTML = `
        <div style="background:#060a14;border:1px solid #00ff8833;border-radius:6px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="color:#00ff88;font-weight:700;font-size:11px;">${yesTeamLabel}</span>
                <span style="color:#555;font-size:9px;">${yesSpread > 0 ? `spread ${yesSpread}¢` : ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span style="color:#8892a6;">Bid <strong style="color:#00ff88;">${fmtPrice(yesBid)}</strong></span>
                <span style="color:#8892a6;">Ask <strong style="color:#00ff88;">${fmtPrice(yesAsk)}</strong></span>
            </div>
        </div>
        <div style="background:#060a14;border:1px solid #ff444433;border-radius:6px;padding:8px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="color:#ff4444;font-weight:700;font-size:11px;">${noTeamLabel}</span>
                <span style="color:#555;font-size:9px;">${noSpread > 0 ? `spread ${noSpread}¢` : ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
                <span style="color:#8892a6;">Bid <strong style="color:#ff4444;">${fmtPrice(noBid)}</strong></span>
                <span style="color:#8892a6;">Ask <strong style="color:#ff4444;">${fmtPrice(noAsk)}</strong></span>
            </div>
        </div>
    `;
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
    const width = parseInt(document.getElementById('bot-arb-width').value) || 10;
    document.getElementById('width-display').textContent = `${width}¢`;

    const arb = calculateArbPrices(currentArbMarket, width);
    document.getElementById('bot-yes-price').value = arb.targetYes;
    document.getElementById('bot-no-price').value  = arb.targetNo;

    // Queue position hints
    const yesHint = document.getElementById('yes-queue-hint');
    const noHint  = document.getElementById('no-queue-hint');
    const yesIsFav = arb.yesIsFav;
    if (yesHint) {
        if (arb.yesNoLiquidity) {
            if (arb.dogAtFloor && !yesIsFav) {
                yesHint.textContent = 'at floor — extra → fav';
                yesHint.style.color = '#ffaa00';
            } else {
                yesHint.textContent = 'no bids — derived from width';
                yesHint.style.color = '#ff4444';
            }
        } else if (arb.usingAskSide) {
            const diffFromAsk = arb.yesAsk - arb.targetYes;
            const diffFromBid = arb.targetYes - arb.yesBid;
            const role = yesIsFav ? '★ fav' : 'underdog';
            if (arb.targetYes > arb.yesBid) {
                yesHint.textContent = `between spread (ask−${diffFromAsk}) · ${role}`;
            } else if (arb.targetYes === arb.yesBid) {
                yesHint.textContent = `= bid — wide width, no room · ${role}`;
            } else {
                yesHint.textContent = `below bid by ${-diffFromBid}¢ — width too wide · ${role}`;
            }
            yesHint.style.color = arb.targetYes > arb.yesBid ? (yesIsFav ? '#00ff88' : '#8892a6') : '#ffaa00';
        } else if (arb.dogAtFloor && yesIsFav) {
            const diff = arb.yesBid - arb.targetYes;
            yesHint.textContent = `bid−${diff} (★ fav, dog at floor)`;
            yesHint.style.color = '#ffaa00';
        } else {
            const diff = arb.yesBid - arb.targetYes;
            const role = yesIsFav ? '★ fav' : 'underdog';
            if (diff < 0) {
                yesHint.textContent = `${Math.abs(diff)}¢ above bid — width too narrow · ${role}`;
                yesHint.style.color = '#00aaff';
            } else {
                yesHint.textContent = diff === 0 ? `= bid (${role})` : `bid−${diff} (${role})`;
                yesHint.style.color = yesIsFav ? '#00ff88' : '#8892a6';
            }
        }
    }
    if (noHint) {
        if (arb.noNoLiquidity) {
            if (arb.dogAtFloor && yesIsFav) {
                noHint.textContent = 'at floor — extra → fav';
                noHint.style.color = '#ffaa00';
            } else {
                noHint.textContent = 'no bids — derived from width';
                noHint.style.color = '#ff4444';
            }
        } else if (arb.usingAskSide) {
            const diffFromAsk = arb.noAsk - arb.targetNo;
            const diffFromBid = arb.targetNo - arb.noBid;
            const role = !yesIsFav ? '★ fav' : 'underdog';
            if (arb.targetNo > arb.noBid) {
                noHint.textContent = `between spread (ask−${diffFromAsk}) · ${role}`;
            } else if (arb.targetNo === arb.noBid) {
                noHint.textContent = `= bid — wide width, no room · ${role}`;
            } else {
                noHint.textContent = `below bid by ${-diffFromBid}¢ — width too wide · ${role}`;
            }
            noHint.style.color = arb.targetNo > arb.noBid ? (!yesIsFav ? '#00ff88' : '#8892a6') : '#ffaa00';
        } else if (arb.dogAtFloor && !yesIsFav) {
            const diff = arb.noBid - arb.targetNo;
            noHint.textContent = `bid−${diff} (★ fav, dog at floor)`;
            noHint.style.color = '#ffaa00';
        } else if (arb.noUnshaved) {
            noHint.textContent = '= bid (width → fav)';
            noHint.style.color = '#00aaff';
        } else {
            const diff = arb.noBid - arb.targetNo;
            const role = !yesIsFav ? '★ fav' : 'underdog';
            if (diff < 0) {
                noHint.textContent = `${Math.abs(diff)}¢ above bid — width too narrow · ${role}`;
                noHint.style.color = '#00aaff';
            } else {
                noHint.textContent = diff === 0 ? `= bid (${role})` : `bid−${diff} (${role})`;
                noHint.style.color = !yesIsFav ? '#00ff88' : '#8892a6';
            }
        }
    }
    if (!arb.usingAskSide && yesHint && arb.yesUnshaved && !arb.dogAtFloor) {
        yesHint.textContent = '= bid (width → fav)';
        yesHint.style.color = '#00aaff';
    }

    updateProfitPreview();
    updateBreakevenDisplay();
    highlightActivePreset();
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
    const total  = yes + no;
    const profit = 100 - total;
    const isArb  = profit > 0;
    const dollarProfit = (profit * qty / 100).toFixed(2);
    const dollarCost   = (total * qty / 100).toFixed(2);
    const roi = total > 0 ? ((profit / total) * 100).toFixed(1) : '0.0';

    const borderColor = isArb ? '#00ff88' : '#ff4444';
    const bgColor     = isArb ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.04)';
    const accentColor = isArb ? '#00ff88' : '#ff4444';

    // Falling knife warning: if entries are too low to have wiggle room
    const favEntry = Math.max(yes, no);


    // Exit timer info
    const exitInfo = isArb
        ? `<div style="padding:6px 16px 10px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;color:#8892a6;border-top:1px solid #00aaff11;">
               <span style="color:#00aaff;">⏱</span>
               <span>Simultaneous orders — if one leg fills solo: fav fills → 20 min exit · dog fills → 10 min exit</span>
           </div>`
        : '';

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
            ${isArb && qty > 1 ? `<div style="padding:2px 16px 8px;text-align:center;font-size:11px;color:#8892a6;">${qty} contracts × ${profit}¢ = <strong style="color:#00ff88;">+$${dollarProfit}</strong> locked at settlement</div>` : ''}
            ${exitInfo}
        </div>`;
}

// --- Arb Preset Helpers ---

function setFlipFloor(val) {
    document.getElementById('bot-stop-loss-cents').value = val;
    const btn55 = document.getElementById('flip-floor-btn-55');
    const btn60 = document.getElementById('flip-floor-btn-60');
    if (!btn55 || !btn60) return;
    if (val === 55) {
        btn55.style.background = '#00aaff22'; btn55.style.borderColor = '#00aaff88'; btn55.style.color = '#00aaff';
        btn55.textContent = '55¢ ★';
        btn60.style.background = '#0a0e1a';   btn60.style.borderColor = '#1e2740';   btn60.style.color = '#8892a6';
        btn60.textContent = '60¢';
    } else {
        btn60.style.background = '#00aaff22'; btn60.style.borderColor = '#00aaff88'; btn60.style.color = '#00aaff';
        btn60.textContent = '60¢ ★';
        btn55.style.background = '#0a0e1a';   btn55.style.borderColor = '#1e2740';   btn55.style.color = '#8892a6';
        btn55.textContent = '55¢';
    }
    updateProfitPreview();
    updateBreakevenDisplay();
}

function applyPreset(width) {
    const widthSlider = document.getElementById('bot-arb-width');
    if (widthSlider) { widthSlider.value = width; }
    document.getElementById('width-display').textContent = `${width}¢`;
    recalcArbPrices();
}

function updateBreakevenDisplay() {
    const yes = parseInt(document.getElementById('bot-yes-price')?.value) || 0;
    const no  = parseInt(document.getElementById('bot-no-price')?.value)  || 0;
    const width = 100 - yes - no;
    const el = document.getElementById('breakeven-display');
    if (!el) return;
    if (width <= 0) {
        el.textContent = `No arb — total ≥ 100¢`;
        el.style.color = '#ff4444';
        return;
    }
    // Simultaneous system: exit on timeout (cancel pending + sell filled at market)
    // Max theoretical loss if we exit YES at market: worst case sell at ~0
    // More useful: just show the arb width and qty
    const qty = parseInt(document.getElementById('bot-quantity')?.value) || 1;
    const profit = width * qty;
    el.textContent = `Profit if both fill: +${profit}¢ ($${(profit/100).toFixed(2)}) · 20m/10m exit timer`;
    el.style.color = width >= 10 ? '#00ff88' : width >= 5 ? '#ffaa00' : '#00aaff';
}

function highlightActivePreset() {
    const width = parseInt(document.getElementById('bot-arb-width').value) || 10;
    document.querySelectorAll('.arb-preset-btn').forEach(btn => {
        const bw = parseInt(btn.dataset.width);
        const isRec = btn.dataset.recommended === 'true';
        if (bw === width) {
            btn.style.borderColor = '#00ff88';
            btn.style.background = 'rgba(0,255,136,0.12)';
            btn.style.color = '#00ff88';
        } else if (isRec) {
            // Recommended but not active — subtle highlight
            btn.style.borderColor = '#00ff8844';
            btn.style.background = 'rgba(0,255,136,0.05)';
            btn.style.color = '#8892a6';
        } else {
            btn.style.borderColor = '#333';
            btn.style.background = 'rgba(255,255,255,0.03)';
            btn.style.color = '#8892a6';
        }
    });
}

// Close modal
function closeModal() {
    if (modalRefreshInterval) {
        clearInterval(modalRefreshInterval);
        modalRefreshInterval = null;
    }
    document.getElementById('bot-modal').classList.remove('show');
    // Restore market card for next time single-market modal is used
    const marketCard = document.getElementById('bot-market-card');
    if (marketCard) marketCard.style.display = '';
    _currentMiddleData = null;
    // Reset all-widths toggle
    const cb = document.getElementById('all-widths-toggle');
    if (cb && cb.checked) {
        cb.checked = false;
        document.getElementById('all-widths-panel').style.display = 'none';
        document.getElementById('all-widths-slider').style.background = '#1e2740';
        document.getElementById('all-widths-knob').style.transform = 'translateX(0)';
        document.getElementById('all-widths-knob').style.background = '#555';
        const deployBtn = document.getElementById('deploy-btn');
        if (deployBtn) { deployBtn.textContent = '⚡ Deploy Arb Bot'; deployBtn.style.background = 'linear-gradient(135deg,#00ff88 0%,#00cc6a 100%)'; deployBtn.style.color = '#000'; }
    }
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
const ALL_PRESET_WIDTHS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const MIN_FAV_ENTRY_FOR_BOT = 65;

function toggleAllWidths() {
    const cb = document.getElementById('all-widths-toggle');
    const panel = document.getElementById('all-widths-panel');
    const slider = document.getElementById('all-widths-slider');
    const knob = document.getElementById('all-widths-knob');
    const deployBtn = document.getElementById('deploy-btn');
    // Toggle (clicking the row also fires this — prevent double-toggle from the checkbox's own change)
    const nowOn = !cb.checked;
    cb.checked = nowOn;
    panel.style.display = nowOn ? 'block' : 'none';
    slider.style.background = nowOn ? '#818cf8' : '#1e2740';
    knob.style.background = nowOn ? '#fff' : '#555';
    knob.style.transform = nowOn ? 'translateX(16px)' : 'translateX(0)';
    if (deployBtn) {
        deployBtn.textContent = nowOn ? '⚡ Deploy All Widths' : '⚡ Deploy Arb Bot';
        deployBtn.style.background = nowOn
            ? 'linear-gradient(135deg,#818cf8 0%,#6366f1 100%)'
            : 'linear-gradient(135deg,#00ff88 0%,#00cc6a 100%)';
        deployBtn.style.color = nowOn ? '#fff' : '#000';
    }
    if (nowOn) updateAllWidthsPreview();
}

function updateAllWidthsPreview() {
    const preview = document.getElementById('all-widths-preview');
    if (!preview || !currentArbMarket) return;
    const qty = parseInt(document.getElementById('bot-quantity')?.value) || 1;

    let rows = '';
    let totalCost = 0;
    let totalProfit = 0;
    let validCount = 0;

    ALL_PRESET_WIDTHS.forEach(w => {
        const arb = calculateArbPrices(currentArbMarket, w);
        const yesPrice = arb.targetYes;
        const noPrice  = arb.targetNo;
        const profit = 100 - yesPrice - noPrice;
        const blocked = profit <= 0;
        const cost = blocked ? 0 : (yesPrice + noPrice) * qty;
        const profitTotal = blocked ? 0 : profit * qty;
        if (!blocked) { totalCost += cost; totalProfit += profitTotal; validCount++; }

        const statusColor = blocked ? '#ff4444' : '#00ff88';
        const statusText  = blocked ? '⛔ no arb' : `✓ Y${yesPrice}¢ N${noPrice}¢`;
        const rowBg = blocked ? 'rgba(255,68,68,0.04)' : 'rgba(0,255,136,0.03)';
        rows += `<div style="display:grid;grid-template-columns:28px 1fr 38px 34px 60px 50px;gap:3px;align-items:center;padding:4px 6px;background:${rowBg};border-radius:4px;margin-bottom:2px;">
            <span style="color:#8892a6;font-weight:700;font-size:10px;">${w}¢</span>
            <span style="color:${statusColor};font-size:10px;">${statusText}</span>
            <span style="color:#8892a6;font-size:10px;text-align:center;">${blocked ? '—' : yesPrice + '¢'}</span>
            <span style="color:#8892a6;font-size:10px;text-align:center;">${blocked ? '—' : noPrice + '¢'}</span>
            <span style="color:${blocked ? '#555' : '#00ff88'};font-size:10px;text-align:right;font-weight:700;">${blocked ? '—' : '+$' + (profitTotal / 100).toFixed(2)}</span>
            <span style="color:${blocked ? '#555' : '#aab'};font-size:10px;text-align:right;">${blocked ? '—' : '$' + (cost / 100).toFixed(2)}</span>
        </div>`;
    });

    const totalDollars  = (totalCost / 100).toFixed(2);
    const profitDollars = (totalProfit / 100).toFixed(2);
    preview.innerHTML = `
        <div style="display:grid;grid-template-columns:28px 1fr 38px 34px 60px 50px;gap:3px;padding:2px 6px;margin-bottom:4px;">
            <span style="color:#555;font-size:9px;">W</span>
            <span style="color:#555;font-size:9px;">STATUS</span>
            <span style="color:#555;font-size:9px;text-align:center;">YES</span>
            <span style="color:#555;font-size:9px;text-align:center;">NO</span>
            <span style="color:#00ff88;font-size:9px;text-align:right;">PROFIT</span>
            <span style="color:#555;font-size:9px;text-align:right;">COST</span>
        </div>
        ${rows}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid #2a2a4a;flex-wrap:wrap;gap:6px;">
            <span style="color:#8892a6;font-size:11px;">${validCount} of ${ALL_PRESET_WIDTHS.length} valid · ${qty}× each</span>
            <span style="color:#00ff88;font-size:12px;font-weight:800;">+$${profitDollars} if all fill</span>
            <span style="color:#aab;font-size:11px;">Entry: $${totalDollars}</span>
        </div>`;
}

async function createBot() {
    if (!currentArbMarket) { alert('No market selected'); return; }

    // If "place all widths" is on, delegate to the multi-bot handler
    if (document.getElementById('all-widths-toggle')?.checked) {
        return placeAllWidthsBots();
    }

    // ── Fetch fresh prices from ORDERBOOK right before submitting ──
    try {
        const obResp = await fetch(`${API_BASE}/orderbook/${currentArbMarket.ticker}`);
        if (obResp.ok) {
            const obData = await obResp.json();
            if (!obData.error) {
                const ob = obData.orderbook || obData;
                const yesLevels = (ob.yes || []).slice().reverse();
                const noLevels  = (ob.no  || []).slice().reverse();
                const bestYesBid = yesLevels.length ? parseOrderLevel(yesLevels[0]).price : 0;
                const bestNoBid  = noLevels.length  ? parseOrderLevel(noLevels[0]).price  : 0;
                currentArbMarket.yes_bid = bestYesBid;
                currentArbMarket.no_bid  = bestNoBid;
                currentArbMarket.yes_ask = bestNoBid > 0 ? (100 - bestNoBid) : 0;
                currentArbMarket.no_ask  = bestYesBid > 0 ? (100 - bestYesBid) : 0;
                delete currentArbMarket.yes_bid_dollars;
                delete currentArbMarket.no_bid_dollars;
                delete currentArbMarket.yes_ask_dollars;
                delete currentArbMarket.no_ask_dollars;
                refreshModalPriceCards();
                recalcArbPrices();
            }
        }
    } catch (_) { /* proceed with what we have */ }

    const yes_price       = parseInt(document.getElementById('bot-yes-price').value);
    const no_price        = parseInt(document.getElementById('bot-no-price').value);
    const quantity        = parseInt(document.getElementById('bot-quantity').value);
    const repeat_count    = parseInt(document.getElementById('bot-repeat-count').value) || 0;
    const arb_width       = parseInt(document.getElementById('bot-arb-width').value) || (100 - yes_price - no_price);

    if (yes_price + no_price >= 100) {
        alert(`❌ Not an arb — YES(${yes_price}¢) + NO(${no_price}¢) = ${yes_price + no_price}¢ ≥ 100¢\nAdjust prices so total is below 100¢.`);
        return;
    }
    if (!quantity || quantity < 1) { alert('Quantity must be at least 1'); return; }

    // ── Guardrail: block phantom arbs with no real bids on one side ──
    const realYesBid = currentArbMarket?.yes_bid || 0;
    const realNoBid  = currentArbMarket?.no_bid  || 0;
    if (realYesBid <= 0 || realNoBid <= 0) {
        const missingSide = realYesBid <= 0 ? 'YES' : 'NO';
        alert(`⚠️ No real ${missingSide} bids in the orderbook.\n\nThe ${missingSide} price is derived (calculated), not from a real order. Nobody is there to fill it. This arb is phantom.`)
        return;
    }

    const favPrice = Math.max(yes_price, no_price);
    const profitPer = 100 - yes_price - no_price;
    const totalCost = (yes_price + no_price) * quantity;
    const repeatMsg = repeat_count > 0 ? `\n↻ Repeat: ${repeat_count}× after first fill (${repeat_count + 1} runs total)` : '';
    if (!confirm(`⚡ Deploy Dual-Arb Bot — ${quantity} contract(s)\n\nMarket: ${currentArbMarket.ticker}\nYES limit buy: ${yes_price}¢\nNO limit buy: ${no_price}¢\nTotal cost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nProfit if both fill: +${profitPer}¢/contract\nPhase: auto-detect\n8-min timeout if one leg fills${repeatMsg}\n\nConfirm order?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: currentArbMarket.ticker,
                yes_price, no_price, quantity,
                repeat_count, arb_width,
            }),
        });
        const data = await resp.json();

        if (data.success) {
            const profit = 100 - yes_price - no_price;
            const cycles = repeat_count > 0 ? repeat_count + 1 : 1;
            const cycleNote = cycles > 1 ? ` × ${cycles} cycles` : '';
            showNotification(`✅ ARB deployed: ${quantity} contracts | ${profit}¢ width${cycleNote}`);
            closeModal();
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else if (data.tight_game_blocked) {
            // Tight game guardrail — offer force override
            const forceIt = confirm(`${data.error}\n\n⚠️ Click OK to FORCE deploy anyway (not recommended).`);
            if (forceIt) {
                // Retry with force_tight flag
                const retryResp = await fetch(`${API_BASE}/bot/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticker: currentArbMarket.ticker,
                        yes_price, no_price, quantity,
                        repeat_count, arb_width,
                        force_tight: true,
                    }),
                });
                const retryData = await retryResp.json();
                if (retryData.success) {
                    const profit = 100 - yes_price - no_price;
                    const cycles = repeat_count > 0 ? repeat_count + 1 : 1;
                    const cycleNote = cycles > 1 ? ` × ${cycles} cycles` : '';
                    showNotification(`⚠️ Force deployed (tight game): ${quantity} contracts | ${profit}¢ width${cycleNote}`);
                    closeModal();
                    loadBots();
                    if (!autoMonitorInterval) toggleAutoMonitor();
                } else {
                    alert('Error: ' + retryData.error);
                }
            }
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
}

// Load and display active bots
// Build a compact inline score badge from a gameScores entry
function buildScoreBadgeHtml(gs, size = 'normal') {
    if (!gs || gs.home_score === undefined) return '';
    const away = gs.away_score ?? 0;
    const home = gs.home_score ?? 0;
    const detail = gs.status_detail || '';
    const isLive = detail && !detail.toLowerCase().includes('final');

    if (size === 'compact') {
        // Tiny pill for individual bot rows
        const dotHtml = isLive ? `<span style="animation:pulse 1.5s infinite;display:inline-block;">●</span> ` : '';
        const color   = isLive ? '#ff6666' : '#8892a6';
        const bg      = isLive ? '#ff333311' : '#1e274022';
        const border  = isLive ? '#ff333344' : '#2a355044';
        return `<span style="background:${bg};border:1px solid ${border};color:${color};padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;">${dotHtml}${away}-${home}${detail ? ` · ${detail}` : ''}</span>`;
    } else {
        // Normal size for group header
        const dotHtml = isLive ? `<span style="animation:pulse 1.5s infinite;display:inline-block;color:#ff4444;">●</span>` : '';
        const color   = isLive ? '#ff6666' : '#8892a6';
        return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:${color};">${dotHtml}<span>${away}-${home}</span>${detail ? `<span style="font-size:9px;color:#8892a6;font-weight:400;">${detail}</span>` : ''}</span>`;
    }
}

async function placeAllWidthsBots() {
    if (!currentArbMarket) return;
    const qty         = parseInt(document.getElementById('bot-quantity')?.value) || 1;
    const repeatCount = parseInt(document.getElementById('bot-repeat-count')?.value) || 0;
    const gamePhase   = document.querySelector('input[name="game-phase"]:checked')?.value || 'live';

    // ── Pre-scan: build detailed confirmation ──────────────────────────────────
    const validWidths = [];
    const skipReasons = [];
    let totalCostCents = 0;

    for (const w of ALL_PRESET_WIDTHS) {
        const arb      = calculateArbPrices(currentArbMarket, w);
        const yesPrice = arb.targetYes;
        const noPrice  = arb.targetNo;
        const profit   = 100 - yesPrice - noPrice;
        if (profit <= 0) {
            skipReasons.push(`  ⛔  ${w}¢ width — no profit`);
        } else {
            validWidths.push({ w, arb, yesPrice, noPrice, profit });
            totalCostCents += (yesPrice + noPrice) * qty;
        }
    }

    if (validWidths.length === 0) {
        alert(`⚡ Deploy ALL Widths — ${currentArbMarket.ticker}\n\nNo valid widths to deploy (all skipped).\n\n${skipReasons.join('\n')}`);
        return;
    }

    // Build order table string
    const pad = (s, n) => String(s).padStart(n);
    let orderLines = [`⚡ Deploy ALL Widths — ${currentArbMarket.ticker}`, ''];
    orderLines.push('  WIDTH   YES    NO    PROFIT   COST');
    orderLines.push('  ─────────────────────────────────');
    for (const { w, arb, yesPrice, noPrice, profit } of validWidths) {
        const costDollars = ((yesPrice + noPrice) * qty / 100).toFixed(2);
        orderLines.push(`  ${pad(w+'¢',5)}   ${pad(arb.targetYes+'¢',4)}   ${pad(arb.targetNo+'¢',4)}   +${pad(profit+'¢',3)}   $${costDollars}`);
    }
    if (skipReasons.length > 0) {
        orderLines.push('');
        orderLines.push(...skipReasons);
    }
    orderLines.push('');
    orderLines.push(`  ${validWidths.length} widths × ${qty} contract${qty !== 1 ? 's' : ''} each`);
    orderLines.push(`  Total entry cost: $${(totalCostCents / 100).toFixed(2)}`);
    orderLines.push('');
    orderLines.push('Place these orders?');

    if (!confirm(orderLines.join('\n'))) return;

    // ── Parallel placement ──────────────────────────────────────────────────────
    const deployBtn = document.getElementById('deploy-btn');
    if (deployBtn) { deployBtn.disabled = true; deployBtn.textContent = '⏳ Placing...'; }

    const results = { placed: 0, skipped: skipReasons.length, errors: 0 };

    const placements = validWidths.map(({ w, arb }) =>
        fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: currentArbMarket.ticker,
                yes_price: arb.targetYes,
                no_price:  arb.targetNo,
                quantity: qty,
                arb_width: w,
                repeat_count: repeatCount,
                game_phase: gamePhase,
            }),
        })
        .then(r => r.json())
        .then(data => { if (data.bot_id || data.success !== false) results.placed++; else results.errors++; })
        .catch(() => { results.errors++; })
    );
    await Promise.all(placements);

    if (deployBtn) { deployBtn.disabled = false; deployBtn.textContent = '⚡ Deploy All Widths'; }

    // ── Close modal + reload first, then show notification ────────────────────
    closeModal();
    await loadBots();
    showNotification(`⚡ All widths: ${results.placed} placed · ${results.skipped} skipped · ${results.errors} errors`);
}

let botsTabMode = 'arb';  // 'arb' | 'middle'
function _renderMiddleBotCard(bot, botId, container, gameScores) {
    const nowSec = Date.now() / 1000;
    const ageMin = bot.created_at ? Math.floor((nowSec - bot.created_at) / 60) : 0;
    const status = bot.status || 'waiting';
    const borderCol = { waiting:'#aa66ff', one_filled:'#ffaa00', both_filled:'#00ff88', stopped:'#ff4444', completed:'#00ff88', one_leg_timeout:'#ff8800' }[status] || '#aa66ff';
    const statusLabel = { waiting:'⏳ WAITING', one_filled:'✅ ONE LEG IN', both_filled:'🔒 BOTH FILLED', stopped:'🛑 STOPPED', completed:'✓ COMPLETE', one_leg_timeout:'⌛ SETTLING' }[status] || status;
    const targetA = bot.target_price_a || bot.target_price || 0;
    // Don't fall back to target_price for leg B — it stores leg A's price (legacy), which caused both to show same value
    const targetB = bot.target_price_b || 0;
    const qty    = bot.qty || 1;
    const floor  = (100 - targetA - targetB) * qty;   // guaranteed profit (both NOs win but margin outside middle)
    const midP   = (200 - targetA - targetB) * qty;   // middle profit (both legs settle, margin inside middle)
    const cost   = (targetA + targetB) * qty;
    const legAFillQty = bot.leg_a_fill_qty || (bot.leg_a_filled ? qty : 0);
    const legBFillQty = bot.leg_b_fill_qty || (bot.leg_b_filled ? qty : 0);
    const legAFill = bot.leg_a_filled ? `${bot.leg_a_fill_price || targetA}¢` : null;
    const legBFill = bot.leg_b_filled ? `${bot.leg_b_fill_price || targetB}¢` : null;
    const floorPrice = bot.stop_loss_cents || 0;

    // ── Live middle range indicator (all statuses show live score) ──
    let legAInRange = false, legBInRange = false, hasLiveScore = false;
    let liveScoreDiff = null, liveScoreHtml = '';
    if (gameScores) {
        const ticker = bot.ticker_a || bot.ticker || '';
        const parts = ticker.split('-');
        const gameKey = parts.length >= 2 ? parts[1] : parts[0];
        const gs = gameScores[gameKey] || gameScores[ticker] || null;
        if (gs && (gs.home_score != null || gs.away_score != null)) {
            hasLiveScore = true;
            const h = gs.home_score || 0, aw = gs.away_score || 0;
            liveScoreDiff = Math.abs(h - aw);

            // Directional: determine which team is home/away from ticker_a
            // Kalshi ticker format: SERIES-{DATE}{AWAY}{HOME}-{TEAMCODE}{SPREAD}
            // e.g. KXNBASPREAD-26MAR10MEMPHI-MEM35 → away=MEM, home=PHI
            let legAInRangeDir = null, legBInRangeDir = null;
            const tParts = (bot.ticker_a || '').split('-');
            if (tParts.length >= 3) {
                const tACode = (tParts[2].match(/^([A-Z]+)/) || [])[1] || '';
                const tGameSeg = tParts[1].replace(/^\d{2}[A-Z]{3}\d{2}/, ''); // e.g. "MEMPHI"
                if (tACode && tGameSeg.includes(tACode)) {
                    const teamAIsAway = tGameSeg.startsWith(tACode);
                    const teamA_score = teamAIsAway ? aw : h;
                    const teamB_score = teamAIsAway ? h : aw;
                    const teamA_lead = teamA_score - teamB_score; // + = teamA winning
                    // Leg A: NO "teamA wins by spread_a" → NO wins when teamA doesn't cover
                    legAInRangeDir = teamA_lead < (bot.spread_a || 99);
                    // Leg B: NO "teamB wins by spread_b" → NO wins when teamB doesn't cover
                    legBInRangeDir = teamA_lead > -(bot.spread_b || 99);
                }
            }
            legAInRange = legAInRangeDir !== null ? legAInRangeDir : liveScoreDiff < (bot.spread_a || 99);
            legBInRange = legBInRangeDir !== null ? legBInRangeDir : liveScoreDiff < (bot.spread_b || 99);

            const bothIn = legAInRange && legBInRange;
            const scoreColor = bothIn ? '#00ff88' : (legAInRange || legBInRange) ? '#ffaa33' : '#ff5555';
            const rangeLabel = bothIn ? '🎯 IN MIDDLE'
                : legAInRange ? `✅ Leg A winning`
                : legBInRange ? `✅ Leg B winning`
                : '⛔ both losing';
            const periodStr = gs.period ? (gs.clock ? `${gs.clock} ` : '') + (gs.period >= 2 ? '2H' : '1H') : '';
            liveScoreHtml = `<span style="background:#ffffff0a;border-radius:4px;padding:2px 7px;font-size:10px;color:${scoreColor};font-weight:700;">${h}–${aw}${periodStr ? ' · ' + periodStr : ''} · ${rangeLabel}</span>`;
        }
    }

    // Leg card styles based on range (show range glow whenever live score is available)
    function legStyle(inRange, filled) {
        if (!hasLiveScore) return filled
            ? 'background:#060a14;border:1px solid #aa66ff33;border-radius:6px;padding:8px;'
            : 'background:#060a14;border:1px solid #aa66ff33;border-radius:6px;padding:8px;opacity:0.7;';
        if (inRange) return 'background:#00ff8808;border:1px solid #00ff8866;border-radius:6px;padding:8px;box-shadow:0 0 8px #00ff8822;';
        return 'background:#060a14;border:1px solid #aa66ff22;border-radius:6px;padding:8px;' + (filled ? '' : 'opacity:0.7;');
    }

    let legStatusHtml = '';
    if (status === 'one_filled') {
        const fTeam = bot.filled_leg === 'a' ? (bot.team_a_name||'Leg A') : (bot.team_b_name||'Leg B');
        const wTeam = bot.filled_leg === 'a' ? (bot.team_b_name||'Leg B') : (bot.team_a_name||'Leg A');
        const fPrice = bot.filled_leg === 'a' ? legAFill : legBFill;
        legStatusHtml = `<div style="background:#ffaa0011;border:1px solid #ffaa0033;border-radius:5px;padding:6px 10px;font-size:11px;">
            <span style="color:#ffaa00;font-weight:700;">✅ ${fTeam} filled @ ${fPrice}</span>
            <span style="color:#555;margin-left:10px;">⏳ Waiting: ${wTeam}</span>
            ${floorPrice > 0 ? `<span style="color:#ff6666;margin-left:10px;">Floor: ${floorPrice}¢</span>` : '<span style="color:#555;margin-left:10px;">No floor (hold to settle)</span>'}
        </div>`;
    } else if (status === 'both_filled') {
        const bothInRange = legAInRange && legBInRange;
        const rangeHtml = hasLiveScore
            ? (bothInRange
                ? `<span style="color:#00ff88;font-weight:700;margin-left:10px;">🎯 IN THE MIDDLE</span>`
                : `<span style="color:#555;margin-left:10px;">outside middle range</span>`)
            : '';
        legStatusHtml = `<div style="background:${bothInRange && hasLiveScore ? '#00ff8818' : '#00ff8811'};border:1px solid ${bothInRange && hasLiveScore ? '#00ff8855' : '#00ff8833'};border-radius:5px;padding:6px 10px;font-size:11px;">
            <span style="color:#00ff88;font-weight:700;">🔒 Both legs in — holding to settlement</span>
            <span style="color:#8892a6;margin-left:10px;">A: ${legAFill||'?'} · B: ${legBFill||'?'}</span>
            ${rangeHtml}
        </div>`;
    }

    const el = document.createElement('div');
    el.className = 'bot-item';
    el.style.cssText = `flex-direction:column;gap:8px;border-left:3px solid ${borderCol};`;
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="color:#aa66ff;font-size:11px;font-weight:700;">↔️ MIDDLE</span>
                <span style="color:#fff;font-weight:700;font-size:13px;">${bot.team_a_name||'A'} vs ${bot.team_b_name||'B'}</span>
                <span style="background:${borderCol}22;color:${borderCol};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${statusLabel}</span>
                ${liveScoreHtml}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:#555;font-size:10px;">${ageMin}m</span>
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="cancelBot('${botId}')">✕</button>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="${legStyle(legAInRange, bot.leg_a_filled)}">
                <div style="color:#aa66ff;font-size:9px;font-weight:700;margin-bottom:4px;">LEG A${hasLiveScore ? (legAInRange?' ✓ WINNING':' ✗ NOT YET') : ''}</div>
                <div style="color:#fff;font-size:11px;font-weight:600;">${bot.team_b_name||'Opp'} +${bot.spread_a||'?'}</div>
                <div style="color:#555;font-size:9px;margin-bottom:4px;">NO: ${bot.team_a_name||'?'} wins by ${bot.spread_a||'?'} · ${bot.ticker_a||'?'}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
                    <span style="color:#8892a6;">${bot.no_a_bid ? `Bid: <strong style="color:#8892a6;">${bot.no_a_bid}¢</strong> ` : ''}Limit: <strong style="color:#aa66ff;">${targetA || '?'}¢</strong></span>
                    <span style="color:${bot.leg_a_filled?'#00ff88':(legAFillQty>0?'#ffaa00':'#8892a6')};font-weight:700;">${bot.leg_a_filled?`${legAFillQty}/${qty} ✓ FILLED`:(legAFillQty>0?`${legAFillQty}/${qty} filling…`:'PENDING')}</span>
                </div>
            </div>
            <div style="${legStyle(legBInRange, bot.leg_b_filled)}">
                <div style="color:#aa66ff;font-size:9px;font-weight:700;margin-bottom:4px;">LEG B${hasLiveScore ? (legBInRange?' ✓ WINNING':' ✗ NOT YET') : ''}</div>
                <div style="color:#fff;font-size:11px;font-weight:600;">${bot.team_a_name||'Opp'} +${bot.spread_b||'?'}</div>
                <div style="color:#555;font-size:9px;margin-bottom:4px;">NO: ${bot.team_b_name||'?'} wins by ${bot.spread_b||'?'} · ${bot.ticker_b||'?'}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
                    <span style="color:#8892a6;">${bot.no_b_bid ? `Bid: <strong style="color:#8892a6;">${bot.no_b_bid}¢</strong> ` : ''}Limit: <strong style="color:#aa66ff;">${targetB || '?'}¢</strong></span>
                    <span style="color:${bot.leg_b_filled?'#00ff88':(legBFillQty>0?'#ffaa00':'#8892a6')};font-weight:700;">${bot.leg_b_filled?`${legBFillQty}/${qty} ✓ FILLED`:(legBFillQty>0?`${legBFillQty}/${qty} filling…`:'PENDING')}</span>
                </div>
            </div>
        </div>
        <div style="display:flex;gap:16px;font-size:10px;color:#555;padding-top:4px;border-top:1px solid #1e2740;flex-wrap:wrap;">
            ${targetA && targetB ? `<span>One leg wins: <strong style="color:${floor>=0?'#00ff88':'#ff4444'};">${floor>=0?'+':''}${floor}¢</strong></span>
            <span>Middle hits: <strong style="color:#aa66ff;">+${midP}¢</strong></span>
            <span style="color:#8892a6;">Cost: <strong style="color:#fff;">${cost}¢</strong></span>` : '<span style="color:#555;font-style:italic;">price data unavailable</span>'}
            <span>×${qty}</span>
            ${floorPrice > 0 ? `<span style="color:#ff6666;">Stop-loss: ${floorPrice}¢ drop</span>` : ''}
        </div>
        ${legStatusHtml}
    `;
    container.appendChild(el);
}

function setBotsTab(mode) {
    botsTabMode = mode;
    const arbBtn    = document.getElementById('bots-tab-arb');
    const midBtn    = document.getElementById('bots-tab-middle');
    const arbList   = document.getElementById('bots-list');
    const midList   = document.getElementById('middle-bots-list');
    const arbDaily  = document.getElementById('bots-arb-daily');
    const midDaily  = document.getElementById('bots-middle-daily');
    if (arbBtn) { arbBtn.style.background = mode === 'arb' ? '#253555' : '#1a2540'; arbBtn.style.color = mode === 'arb' ? '#00ff88' : '#8892a6'; }
    if (midBtn) { midBtn.style.background = mode === 'middle' ? '#253555' : '#1a2540'; midBtn.style.color = mode === 'middle' ? '#aa66ff' : '#8892a6'; }
    if (arbList)  arbList.style.display  = mode === 'arb' ? '' : 'none';
    if (midList)  midList.style.display  = mode === 'middle' ? '' : 'none';
    if (arbDaily) arbDaily.style.display = mode === 'arb' ? 'flex' : 'none';
    if (midDaily) midDaily.style.display = mode === 'middle' ? 'flex' : 'none';
    // Re-render the main P&L header for the active tab
    _renderPnlDisplay(mode);
}

function _renderPnlDisplay(mode) {
    const pnl = window._lastPnlData;
    const el  = document.getElementById('pnl-display');
    if (!el) return;
    if (!pnl) return;  // not loaded yet

    if (mode === 'middle') {
        const net   = (pnl.mid_net_cents || 0) / 100;
        const color = net >= 0 ? '#aa66ff' : '#ff4444';
        const wins  = pnl.mid_wins   || 0;
        const losses = pnl.mid_losses || 0;
        const gross = ((pnl.mid_profit_cents || 0) / 100).toFixed(2);
        const loss  = ((pnl.mid_loss_cents   || 0) / 100).toFixed(2);
        const dayLabel = pnl.day_key || new Date().toISOString().split('T')[0];
        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Middles Today <span style="color:#444;font-size:9px;">${dayLabel}</span></span>
            <span style="color:${color};font-weight:800;font-size:1.2rem;text-shadow:0 0 12px ${color}44;">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
            <span style="font-size:11px;">
                <span style="color:#aa66ff;">↑ $${gross}</span>
                <span style="color:#555;margin:0 3px;">·</span>
                <span style="color:#ff5555;">↓ $${loss}</span>
                <span style="color:#555;margin:0 6px;">|</span>
                <span style="color:#aa66ff;font-weight:700;">${wins}W</span><span style="color:#444;"> / </span><span style="color:#ff5555;font-weight:700;">${losses}L</span>
            </span>
        `;
    } else {
        const net      = (pnl.arb_net_cents || 0) / 100;
        const netColor = net >= 0 ? '#00ff88' : '#ff4444';
        const gross    = ((pnl.arb_profit_cents || 0) / 100).toFixed(2);
        const loss     = ((pnl.arb_loss_cents   || 0) / 100).toFixed(2);
        const wins     = pnl.arb_wins   || 0;
        const losses   = pnl.arb_losses || 0;
        const dayLabel = pnl.day_key || new Date().toISOString().split('T')[0];
        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Today <span style="color:#444;font-size:9px;">${dayLabel}</span></span>
            <span style="color:${netColor};font-weight:800;font-size:1.2rem;text-shadow:0 0 12px ${netColor}44;">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
            <span style="font-size:11px;">
                <span style="color:#00cc66;">↑ $${gross}</span>
                <span style="color:#555;margin:0 3px;">·</span>
                <span style="color:#ff5555;">↓ $${loss}</span>
                <span style="color:#555;margin:0 6px;">|</span>
                <span style="color:#00cc66;font-weight:700;">${wins}W</span><span style="color:#444;"> / </span><span style="color:#ff5555;font-weight:700;">${losses}L</span>
            </span>
            <span id="anchored-badge" style="font-size:11px;">${_buildAnchoredBadgeHTML()}</span>
        `;
    }
}

async function loadBots() {
    try {
        const response = await fetch(`${API_BASE}/bot/list`);
        const data = await response.json();
        const bots = data.bots || {};
        window._lastBotsData = bots;  // used by emergencyExitGame
        const gameScores = data.game_scores || {};
        const botIds = Object.keys(bots);

        const section = document.getElementById('bots-section');
        section.style.display = 'block';

        const botsList   = document.getElementById('bots-list');
        const middleList = document.getElementById('middle-bots-list');

        // Split into arb and middle bots
        const activeBots = botIds.filter(id => {
            const s = bots[id].status;
            return s !== 'completed' && s !== 'stopped';
        });
        const arbBotIds    = activeBots.filter(id => bots[id].type !== 'middle');
        const middleBotIds = activeBots.filter(id => bots[id].type === 'middle');

        // Update middle bots tab badge
        const midBtn = document.getElementById('bots-tab-middle');
        if (midBtn) midBtn.textContent = `↔️ MIDDLE BOTS${middleBotIds.length > 0 ? ' (' + middleBotIds.length + ')' : ''}`;

        // Render middle bots list
        if (middleList) {
            if (middleBotIds.length === 0) {
                middleList.innerHTML = '<div class="empty-state"><div class="icon">↔️</div><div class="title">No active middle bots</div><div class="desc">Open a middle bot from the Middles scanner</div></div>';
            } else {
                middleList.innerHTML = '';
                for (const botId of middleBotIds) {
                    const bot = bots[botId];
                    _renderMiddleBotCard(bot, botId, middleList, gameScores);
                }
            }
        }

        if (arbBotIds.length === 0) {
            botsList.innerHTML = `<div class="empty-state"><div class="icon">🤖</div><div class="title">No active bots</div><div class="desc">Deploy a bot from the Markets tab or use the Arb Scanner</div></div>`;
            updateBotBuddy(0, 0);
            updateBotsBadge(middleBotIds.length);
            return;
        }
        botsList.innerHTML = '';

        let activeBotCount = 0;
        let filledLegs = 0;
        let anchoredCount = 0;  // one leg filled, waiting for second
        let anchoredHealthBuckets = { waiting: 0, healthy: 0, holding: 0, dropping: 0, warning: 0, danger: 0, safe: 0 };

        // ══════════════════════════════════════════════════════════════
        // GROUP BY GAME, NEWEST FIRST
        // ══════════════════════════════════════════════════════════════
        function getGameKey(ticker) {
            if (!ticker) return 'unknown';
            const parts = ticker.split('-');
            // Game key = date+teams portion only (e.g. "26MAR05BKNMIA")
            // This merges KXNBAGAME-26MAR05BKNMIA-MIA and KXNBAPTS-26MAR05BKNMIA-BKNNCLOWNEY21-15
            // into the same group since they're the same game
            if (parts.length >= 2) return parts[1];
            return parts[0];
        }

        // Group bots by game — ARB BOTS ONLY (middle bots are in their own tab)
        const gameGroups = {};
        arbBotIds.forEach(botId => {
            const bot = bots[botId];
            const effectiveTicker = bot.ticker || '';
            const gk = getGameKey(effectiveTicker);
            if (!gameGroups[gk]) gameGroups[gk] = [];
            gameGroups[gk].push(botId);
        });

        // Sort bots within each group: newest first (by created_at desc)
        Object.values(gameGroups).forEach(ids => {
            ids.sort((a, b) => (bots[b].created_at || 0) - (bots[a].created_at || 0));
        });

        // Sort game groups: FIRST bot placed in the group determines group order
        // (stable — adding more bots to a game doesn't reshuffle it)
        const sortedGameKeys = Object.keys(gameGroups).sort((a, b) => {
            const firstA = Math.min(...gameGroups[a].map(id => bots[id].created_at || 0));
            const firstB = Math.min(...gameGroups[b].map(id => bots[id].created_at || 0));
            return firstB - firstA;  // newest game first, but stable within a game
        });

        // Render grouped bots
        sortedGameKeys.forEach(gameKey => {
            // ── Game group header ──
            const groupBots = gameGroups[gameKey];
            const sampleBot = bots[groupBots[0]];
            const groupMatchup = formatBotDisplayName(sampleBot.ticker).split('·')[0].split('—')[0].trim();
            const groupIsLive = groupBots.some(id => bots[id].game_phase === 'live');
            const groupPhase = groupIsLive ? '🔴 LIVE' : '⏳ PRE';
            const groupProfitTotal = groupBots.reduce((sum, id) => {
                const b = bots[id];
                if (b.type === 'watch') {
                    // Watch bots: potential = (100 - entry) * qty
                    return sum + ((100 - (b.entry_price || 50)) * (b.quantity || 1));
                }
                return sum + ((b.profit_per ?? (100 - (b.yes_price || 0) - (b.no_price || 0))) * (b.quantity || 1));
            }, 0);

            const groupHeader = document.createElement('div');
            groupHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-top:16px;margin-bottom:4px;background:#0d1117;border-left:3px solid #00aaff;border-radius:4px;font-size:12px;';
            const sampleTicker = (sampleBot.ticker || '').toUpperCase();
            const sportIcon = sampleTicker.includes('NBA') ? '🏀' : sampleTicker.includes('NHL') ? '🏒' : sampleTicker.includes('MLB') ? '⚾' : sampleTicker.includes('NFL') ? '🏈' : sampleTicker.includes('TENNIS') || sampleTicker.includes('ATP') || sampleTicker.includes('WTA') ? '🎾' : sampleTicker.includes('NCAA') ? '🏀' : '📊';
            const kalshiUrl = `https://kalshi.com/markets/${sampleTicker.split('-')[0]}/${sampleTicker}`;
            // Live score from backend
            const gs = gameScores[gameKey] || {};
            const groupScoreBadge = buildScoreBadgeHtml(gs, 'normal');
            // Signal badge (anchor/danger/warning/healthy etc.)
            const groupSport = detectSport(sampleTicker);
            const groupSignal = getGameSignal(gameKey, groupSport, []);
            const groupSignalBadge = groupSignal.label ? `<span style="background:${groupSignal.color}22;color:${groupSignal.color};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;" title="${groupSignal.description || ''}">${groupSignal.label}</span>` : '';
            const escapedGameKey = gameKey.replace(/'/g, "\\'");
            groupHeader.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <a href="#" onclick="navigateToMarket('${sampleTicker.split('-').slice(0,-1).join('-')}');return false;" style="color:#00aaff;font-weight:700;text-decoration:none;" title="View in Markets tab">${sportIcon} ${groupMatchup}</a>
                    <span style="color:${groupIsLive ? '#ff6666' : '#556'};font-size:10px;font-weight:700;">${groupPhase}</span>
                    ${groupScoreBadge}
                    ${groupSignalBadge}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:#8892a6;font-size:10px;">${groupBots.length} bot${groupBots.length > 1 ? 's' : ''}</span>
                    <span style="color:#00ff88;font-size:11px;font-weight:700;">+${(groupProfitTotal / 100).toFixed(2)}</span>
                    <button onclick="emergencyExitGame('${escapedGameKey}')" title="Cancel & sell ALL bots for this game" style="background:#ff333322;color:#ff6666;border:1px solid #ff333355;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">🚨 Exit All</button>
                </div>
            `;
            botsList.appendChild(groupHeader);

            groupBots.forEach(botId => {
            const bot = bots[botId];

            // Middle bots are rendered in their own list — skip here
            if (bot.type === 'middle') return;

            // ── Watch Bots (position watchers) ───────────────────────
            if (bot.type === 'watch') {
                activeBotCount++;
                const side = bot.side || 'yes';
                const entry = bot.entry_price || 50;
                const sl = bot.stop_loss_cents || 5;
                const tp = bot.take_profit_cents || 0;
                const liveBid = bot.live_bid || '?';
                const watchQty = bot.quantity || 1;
                const fillQty = bot.fill_qty || 0;
                const orderFilled = bot.order_filled || false;
                const nowSec = Date.now() / 1000;
                const ageMin = bot.created_at ? Math.floor((nowSec - bot.created_at) / 60) : 0;
                const watchDisplayName = formatBotDisplayName(bot.ticker, bot.spread_line);
                const watchScoreBadge = buildScoreBadgeHtml(gameScores[gameKey] || {}, 'compact');

                // Unrealized P&L for watch
                const curBidNum = typeof liveBid === 'number' ? liveBid : 0;
                const unrealizedPnl = orderFilled && curBidNum > 0 ? (curBidNum - entry) * watchQty : 0;
                const unrealColor = unrealizedPnl >= 0 ? '#00ff88' : '#ff4444';

                // Fill status
                let fillStatusHtml = '';
                if (!orderFilled) {
                    fillStatusHtml = fillQty > 0 
                        ? `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">FILLING ${fillQty}/${watchQty}</span>` 
                        : `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">PENDING</span>`;
                }

                const item = document.createElement('div');
                item.className = 'bot-item';
                item.style.cssText = 'flex-direction:column;gap:8px;border-left:3px solid #9966ff;';
                item.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="color:#9966ff;font-size:11px;font-weight:700;">👁 WATCH</span>
                            <a href="#" onclick="navigateToMarket('${(bot.ticker||'').toUpperCase().split('-').slice(0,2).join('-')}');return false;" style="color:#fff;font-weight:700;font-size:13px;text-decoration:none;" title="View in Markets tab">${watchDisplayName}</a>
                            ${watchScoreBadge}
                            <span class="bot-status watching">${orderFilled ? 'WATCHING' : 'PENDING'}</span>
                            <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${side==='yes'?'#00ff8822':'#ff444422'};color:${side==='yes'?'#00ff88':'#ff4444'};">${side.toUpperCase()}</span>
                            ${fillStatusHtml}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${orderFilled && unrealizedPnl !== 0 ? `<span style="color:${unrealColor};font-size:11px;font-weight:700;">${unrealizedPnl > 0 ? '+' : ''}${unrealizedPnl}¢</span>` : ''}
                            <span style="color:#555;font-size:10px;">${ageMin}m</span>
                            <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="cancelBot('${botId}')">✕</button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;font-size:11px;color:#8892a6;">
                        <div>Entry: <strong style="color:#fff;">${entry}¢</strong></div>
                        <div>Qty: <strong style="color:#fff;">×${watchQty}</strong></div>
                        <div>Live bid: <strong style="color:${typeof liveBid === 'number' && liveBid < entry - sl ? '#ff4444' : '#00ff88'};">${liveBid}¢</strong></div>
                        <div>SL: <strong style="color:#ff6666;">${entry - sl}¢</strong>${tp > 0 ? ` · TP: <strong style="color:#00ff88;">${entry + tp}¢</strong>` : ''}</div>
                    </div>
                    ${bot.fair_value_cents ? (() => {
                        const fv = bot.fair_value_cents;
                        const edgeVal = fv - entry;
                        const edgeClr = edgeVal > 0 ? '#00ff88' : edgeVal < 0 ? '#ff4444' : '#ffaa00';
                        const edgeIcn = edgeVal > 0 ? '✅' : edgeVal < 0 ? '❌' : '➖';
                        return '<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:4px 8px;background:' + edgeClr + '11;border:1px solid ' + edgeClr + '33;border-radius:4px;font-size:10px;">' +
                            '<span style="color:#ffaa00;font-weight:700;">📊 Fair: ' + fv + '¢</span>' +
                            '<span style="color:' + edgeClr + ';font-weight:700;">Edge: ' + (edgeVal > 0 ? '+' : '') + edgeVal + '¢ ' + edgeIcn + '</span>' +
                            '</div>';
                    })() : ''}
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#555;border-top:1px solid #1e2740;padding-top:4px;">
                        <span>🎟 ${bot.ticker || '?'}</span>
                        <span>Cost: $${(entry * watchQty / 100).toFixed(2)}</span>
                        <span>Pays: $${(watchQty).toFixed(2)} if wins</span>
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
            const statusLabel = {
                both_posted:      '⚡ BOTH LIVE',
                fav_posted:       '⏳ WAITING',     // legacy: one order posted
                pending_fills:    '⏳ FILLING',
                yes_filled:       '✓ YES FILLED',
                no_filled:        '✓ NO FILLED',
                waiting_repeat:   '🔄 REPEATING',
                flipping:         '⚡ EXITING',
                drift_cancelled:  '🚫 DRIFT GUARD',
            }[bot.status] || (bot.status || '').replace(/_/g, ' ').toUpperCase();
            const phase       = bot.game_phase || 'pregame';
            const phaseIcon   = phase === 'live' ? '🔴' : '⏳';
            const phaseLabel  = phase === 'live' ? 'LIVE' : 'PRE';
            const statusClass = {
                both_posted:    'monitoring',
                fav_posted:     'monitoring',   // keep for legacy
                pending_fills:  'monitoring',
                yes_filled:     'leg1_filled',
                no_filled:      'leg1_filled',
                waiting_repeat: 'monitoring',
            }[bot.status] || 'monitoring';

            activeBotCount++;
            if (yFill >= qty) filledLegs++;
            if (nFill >= qty) filledLegs++;
            // Anchored = status explicitly transitioned to yes_filled or no_filled
            // (avoids double-counting fav_posted bots whose fill qty updated before status transition)
            if (bot.status === 'yes_filled' || bot.status === 'no_filled') anchoredCount++;

            const displayName = formatBotDisplayName(bot.ticker, bot.spread_line);
            const botScoreBadge = buildScoreBadgeHtml(gameScores[gameKey] || {}, 'compact');

            // Cycle info for repeat bots
            const repeatCount = bot.repeat_count || 0;
            const repeatsDone = bot.repeats_done || 0;
            let cycleInfo = '';
            if (repeatCount > 0) {
                const totalRuns = repeatCount + 1;
                if (bot.status === 'waiting_repeat') {
                    // Show completed run, not next run
                    cycleInfo = `<span style="background:#6366f122;color:#818cf8;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">✓ ${repeatsDone}/${totalRuns} done</span>`;
                } else {
                    const currentCycle = repeatsDone + 1;
                    cycleInfo = `<span style="background:#6366f122;color:#818cf8;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">Run ${currentCycle}/${totalRuns}</span>`;
                }
            }

            // Timeout / next-action info for LIVE bots
            const botGs = gameScores[gameKey] || {};
            const isHalftime = (botGs.status_detail || '').toLowerCase().includes('half');
            let timeoutInfo = '';
            if (phase === 'live') {
                const repostAt  = 3;
                if (yFill === 0 && nFill === 0) {
                    const minsLeft = Math.max(0, repostAt - ageMin);
                    timeoutInfo = minsLeft > 0
                        ? `<span style="color:#ffaa00;font-size:10px;">⏱ Repost in ${minsLeft}m</span>`
                        : `<span style="color:#ff6666;font-size:10px;">⏱ Repost due</span>`;
                } else if ((yFill > 0 && nFill === 0) || (nFill > 0 && yFill === 0)) {
                    if (isHalftime) {
                        timeoutInfo = `<span style="color:#818cf8;font-size:10px;">⏸ HALFTIME — timer paused</span>`;
                    } else {
                        const filledAt = bot.first_fill_at || 0;
                        const waitedMin = filledAt > 0 ? (Date.now()/1000 - filledAt) / 60 : 0;
                        const toutMin = bot.timeout_min || 8;
                        const minsLeft = Math.max(0, toutMin - waitedMin);
                        const tColor = minsLeft <= 3 ? '#ff4444' : minsLeft <= 7 ? '#ff8800' : '#00aaff';
                        timeoutInfo = `<span style="color:${tColor};font-size:10px;">⏳ Exit in ${minsLeft.toFixed(0)}m</span>`;
                    }
                }
            } else if (phase === 'pregame') {
                timeoutInfo = `<span style="color:#555;font-size:10px;">∞ Patient</span>`;
            }

            // Waiting for repeat spread
            let driftInfo = '';
            if (bot.status === 'drift_cancelled') {
                const driftY = bot.drift_yes_bid != null ? bot.drift_yes_bid : '?';
                const driftN = bot.drift_no_bid  != null ? bot.drift_no_bid  : '?';
                driftInfo = `<div style="background:#ff6b3511;border:1px solid #ff6b3533;border-radius:5px;padding:4px 8px;font-size:10px;color:#ff6b35;margin-top:6px;">
                    🚫 Market drifted to ${driftY}¢ / ${driftN}¢ — repeat runs cancelled. Disappears in 5 min.
                </div>`;
            }

            let waitRepeatInfo = '';
            if (bot.status === 'waiting_repeat') {
                const waitSince = bot.waiting_repeat_since || 0;
                const waitMin = waitSince > 0 ? Math.round((Date.now() / 1000 - waitSince) / 60) : 0;
                const targetW = bot.arb_width || bot.profit_per || '?';
                waitRepeatInfo = `<div style="background:#6366f111;border:1px solid #6366f133;border-radius:5px;padding:4px 8px;font-size:10px;color:#818cf8;margin-top:6px;">
                    🔄 Waiting for ${targetW}¢ spread to reopen (${waitMin}m) — auto-places when available
                </div>`;
                timeoutInfo = `<span style="color:#818cf8;font-size:10px;">🔄 Waiting repeat</span>`;
            }

            // Stop-loss info + first leg indicator + fav-first status
            let stopLossInfo = '';
            const firstLeg = bot.first_leg || '';
            const firstFillAt = bot.first_fill_at || 0;
            const fillAgeMin = firstFillAt > 0 ? Math.floor((Date.now()/1000 - firstFillAt) / 60) : 0;
            if (bot.status === 'both_posted') {
                const yBid = bot.live_yes_bid != null ? bot.live_yes_bid : '?';
                const nBid = bot.live_no_bid  != null ? bot.live_no_bid  : '?';
                stopLossInfo = `<div style="background:#00aaff11;border:1px solid #00aaff33;border-radius:5px;padding:4px 8px;font-size:10px;color:#00aaff;margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span><span style="color:#00aaff;">⚡ BOTH POSTED</span> — YES ${bot.yes_price}¢ + NO ${bot.no_price}¢ live simultaneously</span>
                    <span style="color:#8892a6;">Bids: YES <strong style="color:#00ff88;">${yBid}¢</strong> · NO <strong style="color:#ff4444;">${nBid}¢</strong></span>
                    <span style="color:#555;">${ageMin}m · ${bot.timeout_min || 8}-min exit if one fills</span>
                </div>`;
            } else if (bot.status === 'fav_posted') {
                const favSide = (bot.fav_side || '?').toUpperCase();
                const dogSide = (bot.dog_side || '?').toUpperCase();
                const favPrice = bot.fav_price || '?';
                const dogPrice = bot.dog_price || '?';
                // Current market bid for the fav side
                const favBid = favSide === 'YES' ? bot.live_yes_bid : bot.live_no_bid;
                const hasBid = favBid != null && favBid > 0;
                const dist = hasBid && typeof favPrice === 'number' ? favPrice - favBid : null;
                const distText = dist != null ? (dist > 0 ? dist + '¢ above bid' : dist === 0 ? 'AT bid' : Math.abs(dist) + '¢ below bid') : '';
                const distColor = dist != null ? (dist <= 0 ? '#00ff88' : dist <= 2 ? '#ffaa00' : '#ff6666') : '#8892a6';
                stopLossInfo = `<div style="background:#00ff8811;border:1px solid #00ff8833;border-radius:5px;padding:4px 8px;font-size:10px;color:#00ff88;margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>⭐ <strong>${favSide}</strong> at ${favPrice}¢ posted — waiting for fill</span>
                    ${hasBid ? '<span style="color:#8892a6;">Bid: <strong style="color:' + distColor + ';">' + favBid + '¢</strong> (' + distText + ')</span>' : ''}
                    <span style="color:#555;">${dogSide} at ${dogPrice}¢ queued after fill</span>
                    <span style="color:#8892a6;">${ageMin}m ago</span>
                </div>`;
            } else if (bot.status === 'yes_filled' || bot.status === 'no_filled') {
                const filledSide = bot.status === 'yes_filled' ? 'YES' : 'NO';
                const pendingSide = bot.status === 'yes_filled' ? 'NO' : 'YES';
                const entryFilled = bot.status === 'yes_filled' ? (bot.yes_price || 0) : (bot.no_price || 0);
                const liveBidFilled = bot.status === 'yes_filled' ? bot.live_yes_bid : bot.live_no_bid;
                const toutMin = bot.timeout_min || 8;
                const minsLeft = Math.max(0, toutMin - fillAgeMin);
                const isFavFilled = entryFilled >= (bot.status === 'yes_filled' ? (bot.no_price || 0) : (bot.yes_price || 0));
                const urgColor = isHalftime ? '#818cf8' : minsLeft <= 3 ? '#ff4444' : minsLeft <= 7 ? '#ff8800' : '#00aaff';
                const bidDisplay = liveBidFilled != null ? `${liveBidFilled}¢` : '?';
                const livePendingBid = bot.status === 'yes_filled' ? bot.live_no_bid : bot.live_yes_bid;
                const gameOver = livePendingBid != null && livePendingBid < 5;
                const exitLine = gameOver
                    ? `<span style="color:#818cf8;font-weight:700;">⏳ Awaiting settlement — game ended, position held</span>`
                    : isHalftime
                    ? `<span style="color:#818cf8;font-weight:700;">⏸ HALFTIME — timer paused, resets at 2nd half</span>`
                    : `<span style="color:${urgColor};font-weight:700;">⏳ Exit ${pendingSide} in ${minsLeft}m if no fill</span>`;
                stopLossInfo = `<div style="background:${gameOver ? '#818cf811' : urgColor+'11'};border:1px solid ${gameOver ? '#818cf833' : urgColor+'33'};border-radius:5px;padding:4px 8px;font-size:10px;color:${gameOver ? '#818cf8' : urgColor};margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>✓ <strong>${filledSide}</strong> filled ${fillAgeMin}m ago${isFavFilled ? ' (fav)' : ' (dog)'} @ ${entryFilled}¢</span>
                    <span style="color:#8892a6;">Bid now: <strong style="color:#fff;">${bidDisplay}</strong></span>
                    ${exitLine}
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

            // ── Bot Health Color ──────────────────────────────────
            // Compute health based on real-time state, not static yellow
            let healthColor = '#00aaff';  // default: blue (neutral/waiting)
            let healthAnim = '';
            let healthLabel = '';
            let anchoredHealthKey = '';

            if (bot.status === 'drift_cancelled') {
                healthColor = '#ff6b35';
                healthLabel = '🚫 DRIFTED';
            } else if (bot.status === 'waiting_repeat') {
                // Waiting for spread to reopen — takes priority over old fill data
                healthColor = '#818cf8';
                healthLabel = '🔄 WAITING';
            } else if (bothFilled) {
                // Both legs filled = arb locked in, guaranteed profit
                healthColor = '#00ff88';
                healthLabel = '✅ LOCKED';
            } else if (bot.status === 'both_posted') {
                // Both orders live simultaneously — waiting for fills
                healthColor = '#00aaff';
                healthLabel = '⚡ BOTH LIVE';
                anchoredHealthKey = 'waiting';
            } else if (bot.status === 'fav_posted') {
                // Fav order posted but not filled yet — always "waiting to fill"
                healthColor = '#00aaff';
                healthLabel = '⏳ WAITING TO FILL';
                anchoredHealthKey = 'waiting';
            } else if (bot.status === 'yes_filled' || bot.status === 'no_filled') {
                // One leg filled — color proportional to time remaining
                // Green (plenty) → Blue (half) → Orange (getting close) → Red (urgent)
                const toutMin = bot.timeout_min || 8;
                const minsLeftHealth = Math.max(0, toutMin - fillAgeMin);
                const pctLeft = toutMin > 0 ? minsLeftHealth / toutMin : 0;
                if (pctLeft <= 0.20) {
                    // ≤20% time left — urgent, pulsing red
                    healthColor = '#ff4444';
                    healthAnim = 'animation: dangerPulse 0.8s ease-in-out infinite;';
                    healthLabel = `🔴 ${Math.ceil(minsLeftHealth)}m LEFT`;
                    anchoredHealthKey = 'danger';
                } else if (pctLeft <= 0.45) {
                    // 20-45% left — warning orange
                    healthColor = '#ff8800';
                    healthAnim = 'animation: warningPulse 1.5s ease-in-out infinite;';
                    healthLabel = `🟠 ${Math.ceil(minsLeftHealth)}m LEFT`;
                    anchoredHealthKey = 'warning';
                } else if (pctLeft <= 0.70) {
                    // 45-70% left — calm blue
                    healthColor = '#00aaff';
                    healthLabel = `🔵 ${Math.ceil(minsLeftHealth)}m`;
                    anchoredHealthKey = 'holding';
                } else {
                    // >70% left — green, plenty of time
                    healthColor = '#00ff88';
                    healthLabel = `🟢 ${Math.ceil(minsLeftHealth)}m`;
                    anchoredHealthKey = 'healthy';
                }
            } else if (bot.status === 'pending_fills') {
                healthColor = '#00aaff'; healthLabel = '⏳ FILLING';
            }
            // Safety net: if bot is anchored (one leg filled) but no key was assigned, count as holding
            if (!anchoredHealthKey && (yFill >= qty) !== (nFill >= qty)) {
                anchoredHealthKey = 'holding';
            }
            if (anchoredHealthKey) anchoredHealthBuckets[anchoredHealthKey]++;

            const item = document.createElement('div');
            item.className = 'bot-item';
            item.style.cssText = `flex-direction:column;gap:8px;border-left:3px solid ${healthColor};${healthAnim}`;
            const botEventPrefix = (bot.ticker || '').toUpperCase().split('-').slice(0, 2).join('-');
            item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <a href="#" onclick="navigateToMarket('${botEventPrefix}');return false;" style="color:#fff;font-weight:700;font-size:13px;text-decoration:none;" title="View in Markets tab">${displayName}</a>
                        ${botScoreBadge}
                        <span class="bot-status ${statusClass}">${statusLabel}</span>
                        ${healthLabel ? `<span style="font-size:10px;font-weight:700;color:${healthColor};">${healthLabel}</span>` : ''}
                        ${cycleInfo}
                        <button onclick="toggleBotPhase('${botId}','${phase === 'live' ? 'pregame' : 'live'}')"
                                style="background:${phase === 'live' ? '#ff333322' : '#1e2740'};border:1px solid ${phase === 'live' ? '#ff333366' : '#2a3550'};color:${phase === 'live' ? '#ff6666' : '#8892a6'};padding:1px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;"
                                title="Auto-detected from ESPN. Click to override.">${phaseIcon} ${phaseLabel}</button>
                        <span style="color:#00ff88;font-weight:800;font-size:13px;" title="${bot.arb_width && profit > bot.arb_width ? `Original target: ${bot.arb_width}¢ — repost caught wider spread` : ''}">+${profit}¢${bot.arb_width && profit > bot.arb_width ? `<span style="color:#ffaa00;font-size:9px;margin-left:3px;" title="Wider than target — market widened on repost">↑</span>` : ''}</span>
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
                    ${(() => {
                        // Legacy fav_posted bots: YES may be queued
                        const isFavPosted = bot.status === 'fav_posted';
                        const yesFav = bot.fav_side === 'yes';
                        const yesQueued = isFavPosted && !yesFav;
                        const noQueued  = isFavPosted && yesFav;

                        // YES leg
                        const yFillColor = yFill >= qty ? '#00ff88' : (yesQueued ? '#00ff8820' : '#00ff8866');
                        const yLabelColor = yesQueued ? '#555' : '#8892a6';
                        const yPriceColor = yesQueued ? '#00ff8844' : '#00ff88';
                        const yStatusTxt = yesQueued ? 'QUEUED' : (yFill >= qty ? `${yFill}/${qty} ✓` : `${yFill}/${qty}`);
                        const yStatusColor = yesQueued ? '#555' : (yFill >= qty ? '#00ff88' : '#8892a6');
                        // NO leg
                        const nFillColor = nFill >= qty ? '#ff4444' : (noQueued ? '#ff444420' : '#ff444466');
                        const nLabelColor = noQueued ? '#555' : '#8892a6';
                        const nPriceColor = noQueued ? '#ff444444' : '#ff4444';
                        const nStatusTxt = noQueued ? 'QUEUED' : (nFill >= qty ? `${nFill}/${qty} ✓` : `${nFill}/${qty}`);
                        const nStatusColor = noQueued ? '#555' : (nFill >= qty ? '#ff4444' : '#8892a6');

                        return `
                    <div style="opacity:${yesQueued ? '0.4' : '1'};transition:opacity .5s;">
                        <div style="display:flex;justify-content:space-between;color:${yLabelColor};margin-bottom:3px;">
                            <span>YES @ <strong style="color:${yPriceColor};">${bot.yes_price || '?'}¢</strong></span>
                            <span style="color:${yStatusColor};font-weight:${yFill >= qty ? '700' : '400'};">${yStatusTxt}</span>
                        </div>
                        <div style="height:6px;background:#1e2740;border-radius:3px;overflow:hidden;${yFill >= qty ? 'box-shadow:0 0 8px #00ff8844;' : ''}">
                            <div style="height:100%;width:${yPct}%;background:${yFillColor};border-radius:3px;transition:width .5s,background .5s;"></div>
                        </div>
                        ${!yesQueued && bot.live_yes_bid != null ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#555;">
                            <span>Bid: <strong style="color:#00ff8899;">${bot.live_yes_bid}¢</strong></span>
                            <span>Ask: <strong style="color:#00ff8899;">${bot.live_yes_ask || '?'}¢</strong></span>
                        </div>` : ''}
                    </div>
                    <div style="opacity:${noQueued ? '0.4' : '1'};transition:opacity .5s;">
                        <div style="display:flex;justify-content:space-between;color:${nLabelColor};margin-bottom:3px;">
                            <span>NO @ <strong style="color:${nPriceColor};">${bot.no_price || '?'}¢</strong></span>
                            <span style="color:${nStatusColor};font-weight:${nFill >= qty ? '700' : '400'};">${nStatusTxt}</span>
                        </div>
                        <div style="height:6px;background:#1e2740;border-radius:3px;overflow:hidden;${nFill >= qty ? 'box-shadow:0 0 8px #ff444444;' : ''}">
                            <div style="height:100%;width:${nPct}%;background:${nFillColor};border-radius:3px;transition:width .5s,background .5s;"></div>
                        </div>
                        ${!noQueued && bot.live_no_bid != null ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#555;">
                            <span>Bid: <strong style="color:#ff444499;">${bot.live_no_bid}¢</strong></span>
                            <span>Ask: <strong style="color:#ff444499;">${bot.live_no_ask || '?'}¢</strong></span>
                        </div>` : ''}
                    </div>`;
                    })()}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#555;border-top:1px solid #1e2740;padding-top:6px;margin-top:2px;flex-wrap:wrap;gap:4px;">
                    <a href="#" onclick="navigateToMarket('${(bot.ticker||'').split('-').slice(0,-1).join('-')}');return false;" style="color:#555;text-decoration:none;" title="View in Markets tab">🎟 ${bot.ticker || '?'}</a>
                    <span>Width: <strong style="color:#00aaff;">${profit}¢</strong></span>
                    <span>Cost: <strong style="color:#8892a6;">$${((100 - profit) * qty / 100).toFixed(2)}</strong></span>
                    <span>Payout: <strong style="color:#00ff88;">$${(qty).toFixed(2)}</strong></span>
                    <span title="If one leg fills but other doesn't within timeout, exit at market">⏱ ${bot.timeout_min || 8}m exit</span>
                    <span>${phase === 'live' ? '🔴 Live' : '⏳ Patient'}</span>
                </div>
                ${stopLossInfo}
                ${waitRepeatInfo}
                ${driftInfo}`;
            botsList.appendChild(item);
            });  // end groupBots.forEach
        });  // end sortedGameKeys.forEach

        _botsAnchored = anchoredCount;
        _botsActive   = activeBotCount;
        _botHealth    = anchoredHealthBuckets;
        const badge = document.getElementById('anchored-badge');
        if (badge) badge.innerHTML = _buildAnchoredBadgeHTML();
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
    // Kill any stale interval first, then always start fresh
    if (autoMonitorInterval) clearInterval(autoMonitorInterval);
    console.log('🔄 Starting auto-monitor (always-on)');
    autoMonitorInterval = setInterval(monitorBots, 2000);
    const button = document.getElementById('auto-monitor-text');
    const buddy  = document.getElementById('bot-buddy');
    if (button) button.textContent = '🤖 Monitoring';
    if (buddy) { buddy.classList.remove('idle'); buddy.classList.add('active'); }
    setBuddyMood('happy');
    buddyMonitorStart = Date.now();
    buddyMonitorCycles = 0;
    monitorBots();
}

// Cancel bot
async function cancelBot(botId) {
    if (!confirm('Cancel this bot? Filled positions will be sold at market.')) return;
    
    // Disable all cancel buttons to prevent double-clicks
    const allCancelBtns = document.querySelectorAll(`button[onclick*="cancelBot"]`);
    const clickedBtn = [...allCancelBtns].find(b => b.onclick?.toString().includes(botId) || b.getAttribute('onclick')?.includes(botId));
    if (clickedBtn) {
        clickedBtn.disabled = true;
        clickedBtn.textContent = '⏳';
        clickedBtn.style.opacity = '0.5';
    }
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000); // 35s timeout
        
        const response = await fetch(`${API_BASE}/bot/cancel/${botId}`, {
            method: 'DELETE',
            signal: controller.signal,
        });
        clearTimeout(timeout);
        
        const data = await response.json();
        if (data.success) {
            // Show feedback about what happened
            const parts = [];
            if (data.sold_positions?.length) {
                // Show sell prices for each position
                const sellPrices = data.sell_prices || {};
                const sellDetails = data.sold_positions.map(sp => {
                    const side = sp.startsWith('YES') ? 'yes' : sp.startsWith('NO') ? 'no' : '';
                    const price = sellPrices[side];
                    return price ? `${sp} @ ${price}¢` : sp;
                });
                parts.push(`Sold: ${sellDetails.join(', ')}`);
            }
            if (data.cancelled_orders?.length) parts.push(`Cancelled: ${data.cancelled_orders.join(', ')}`);
            if (data.warnings?.length) {
                alert(`⚠️ Bot cancelled with warnings:\n${data.warnings.join('\n')}\n\n${parts.join(' | ')}`);
            } else if (data.sold_positions?.length) {
                // Show a brief toast/alert with sell info
                alert(`✅ Bot cancelled\n${parts.join('\n')}`);
            }
            loadBots();
        } else {
            alert(`Failed to cancel bot: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            alert('Cancel request timed out — the server may still be processing. Check your positions on Kalshi.');
        } else {
            alert('Error cancelling bot: ' + error.message);
        }
    } finally {
        // Re-enable buttons
        if (clickedBtn) {
            clickedBtn.disabled = false;
            clickedBtn.textContent = '✕';
            clickedBtn.style.opacity = '1';
        }
        loadBots();
    }
}

// Emergency exit — cancel/sell ALL bots for a game group
async function emergencyExitGame(gameKey) {
    const bots = window._lastBotsData || {};
    const botIds = Object.keys(bots).filter(id => {
        const bot = bots[id];
        const ticker = bot.type === 'middle' ? (bot.ticker_a || bot.ticker || '') : (bot.ticker || '');
        const parts = ticker.split('-');
        const gk = parts.length >= 2 ? parts[1] : parts[0];
        return gk === gameKey && !['stopped','completed'].includes(bot.status);
    });
    if (!botIds.length) { showNotification('No active bots found for this game.'); return; }
    if (!confirm(`🚨 EMERGENCY EXIT\n\nThis will cancel and market-sell ALL ${botIds.length} active bot(s) for this game.\n\nFilled positions will be sold at market price — this cannot be undone.\n\nContinue?`)) return;

    showNotification(`🚨 Exiting ${botIds.length} bot(s)...`);
    let ok = 0, fail = 0;
    for (const botId of botIds) {
        try {
            const resp = await fetch(`${API_BASE}/bot/cancel/${botId}`, { method: 'DELETE' });
            const data = await resp.json();
            if (data.success) ok++; else fail++;
        } catch { fail++; }
    }
    showNotification(`🚨 Emergency exit: ${ok} cancelled · ${fail} failed`);
    if (fail > 0) alert(`⚠️ ${fail} bot(s) failed to cancel. Check your positions on Kalshi.`);
    await loadBots();
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

// Toggle auto-monitor — always stays on, this just restarts if somehow stopped
function toggleAutoMonitor() {
    if (!autoMonitorInterval) {
        autoResumeMonitor();
    }
}

// Bot buddy messages — rotates through fun status messages with personality
const botBuddyMessages = {
    idle: [
        `<strong>Idle</strong> — Hit Auto-Monitor and I'll never sleep on you`,
        `<strong>Sleeping...</strong> Wake me up and I'll watch your bots 24/7`,
        `<strong>Standing by</strong> — Bots aren't being watched right now`,
        `<strong>Nothing to do...</strong> I get bored easily 🥱`,
        `<strong>Waiting</strong> — I'm fast once you turn me on, I promise`,
        `<strong>Ready when you are</strong> — just hit the monitor button`,
    ],
    scanning: [
        `<strong>On it.</strong> Checking fills every 2 seconds, nothing slips past me`,
        `<strong>Locked in</strong> — order books under surveillance 🔍`,
        `<strong>Patrolling</strong> — repost logic + flip protection running`,
        `<strong>Steady.</strong> Watching spreads, queuing reposts, checking for flips`,
        `<strong>Eyes open.</strong> I'll catch the fill before you even look up`,
        `<strong>Working.</strong> Bid/ask on every anchor, every 2 seconds`,
        `<strong>All clear</strong> — just keeping the orders fresh`,
        `<strong>Watching.</strong> Market's moving but I'm right here`,
    ],
    both_posted: [
        `<strong>⚡ Both sides live.</strong> YES and NO orders in the book simultaneously — waiting for fills`,
        `<strong>Dual orders active</strong> — both legs posted, whichever fills first I'll hold for the other`,
        `<strong>Simultaneous mode</strong> — YES and NO both resting in the orderbook right now`,
        `<strong>Both live.</strong> Watching for fills — 8-min timeout kicks in if only one leg fills`,
    ],
    fav_posted: [
        `<strong>🎯 Fav posted.</strong> Liquid side is in the book, dog side queued for after fill`,
        `<strong>Sequencing active</strong> — higher-bid side posted first, waiting for bite`,
        `<strong>Fav-first running</strong> — watching for fill, then I'll post the underdog`,
        `<strong>Waiting on the fill</strong> — fav order's live, the arb clock is ticking`,
    ],
    fav_filled: [
        `<strong>Fav filled!</strong> Posting the dog side now — almost there 🔒`,
        `<strong>Phase 2.</strong> Liquid side got eaten — underdog going in right now`,
        `<strong>One leg in.</strong> Fav filled, posting the other side. Don't touch it`,
        `<strong>Halfway there.</strong> Dog order going up — sit tight`,
    ],
    filled: [
        `<strong>Leg filled.</strong> Holding until the other side fills or the game settles`,
        `<strong>One side in.</strong> No panic — arb isn't complete until both legs fill`,
        `<strong>In position.</strong> Waiting on the other leg. Flip protection is active`,
        `<strong>Anchored.</strong> One leg in, watching the flip floor`,
    ],
    completed: [
        `<strong>LET'S GO!</strong> Both legs filled — profit locked at settlement 🎉`,
        `<strong>That's a W.</strong> Clean arb, clean profit. Love to see it 💰`,
        `<strong>Locked in!</strong> Dual fill confirmed — collecting at settlement`,
        `<strong>We ate.</strong> Both sides filled, profit secured. Easy money 😎`,
        `<strong>Arb complete!</strong> Settlement will close this out green. Nice trade`,
    ],
    celebrating: [
        `<strong>LET'S GO!</strong> Profit locked — love when a plan comes together 🎉`,
        `<strong>We won!</strong> Another one in the books 💰`,
        `<strong>Nailed it.</strong> Clean fill, clean profit. You're welcome 😎`,
        `<strong>Bag secured.</strong> That's what the strategy is for`,
    ],
    flip_triggered: [
        `<strong>Flip fired.</strong> Bid dropped below the floor — sold to cut exposure 🛡️`,
        `<strong>Flip protection triggered.</strong> The fav isn't favored anymore — exited`,
        `<strong>Floor hit.</strong> Thesis broke, I got out before it got worse`,
        `<strong>Sold on flip.</strong> That's what the floor is there for — capital protected`,
    ],
    stop_loss: [
        `<strong>Stop-loss fired.</strong> Straight bet hit the limit — exiting to protect capital`,
        `<strong>SL triggered.</strong> Price crossed the line — sold. That's the plan`,
        `<strong>Out.</strong> Position stopped. Risk managed, move on`,
    ],
    take_profit: [
        `<strong>Cha-ching!</strong> Take-profit hit — locking those gains 🎯`,
        `<strong>Target reached.</strong> Sold for profit. Discipline pays`,
        `<strong>TP triggered.</strong> That's why we set targets — got out at the top`,
    ],
    watching: [
        `<strong>Eyes on it</strong> — monitoring your position vs SL/TP`,
        `<strong>Position active</strong> — price vs levels, I'm watching`,
    ],
    near_flip: [
        `<strong>⚠️ Getting close...</strong> A position is creeping toward the flip floor`,
        `<strong>Heads up.</strong> Bid drifting toward the threshold — not there yet`,
        `<strong>Watch this one.</strong> Approaching the floor, flip protection on standby`,
    ],
    holding: [
        `<strong>Holding steady</strong> — bid is above the floor, no reason to sell yet`,
        `<strong>Riding it out</strong> — this is normal volatility. Not every dip is a flip`,
        `<strong>Diamond hands (the smart kind)</strong> — only a real flip triggers the exit`,
        `<strong>Sitting tight.</strong> It's moving around but we're still well above the floor`,
        `<strong>No action needed.</strong> Bid's healthy, flip protection hasn't fired`,
    ],
    profitable: [
        `<strong>Looking good!</strong> Session is in the green — keep it going 📈`,
        `<strong>Making money!</strong> Strategy is working today 💪`,
        `<strong>Green session.</strong> Let's keep it that way`,
    ],
    losing: [
        `<strong>Rough patch.</strong> Session is red, but that's trading. Stick to the plan`,
        `<strong>Down but not out.</strong> Risk is managed, we'll bounce back`,
        `<strong>Temporary.</strong> Red days happen. Stay disciplined`,
    ],
};

// ── Bot Buddy State ──────────────────────────────────────────────────
let lastBuddyMsgIdx = -1;
let buddyMonitorStart = null;
let buddyMonitorCycles = 0;
let buddyEventCount = 0;
let buddyLastEvent = '';
let buddyCurrentMood = 'neutral';
let buddyPetCount = 0;
let buddyStatsExpanded = false;
let buddyCelebrationTimeout = null;
let buddySessionPnl = 0;
let buddyReactionLockedUntil = 0;  // timestamp — P&L/fleet mood won't override until this passes
let lastBuddyMsgTime = 0;          // for background message cooldown
let lastBuddyMsgState = '';

// force=true skips the cooldown (use for event-driven updates)
function updateBotBuddyMsg(state, force = false) {
    const el = document.getElementById('bot-buddy-msg');
    if (!el) return;
    const now = Date.now();
    // Background state messages (scanning, holding, etc.) only refresh every 18s to stop flickering
    if (!force && state === lastBuddyMsgState && now - lastBuddyMsgTime < 18000) return;
    lastBuddyMsgState = state;
    lastBuddyMsgTime = now;

    const pool = botBuddyMessages[state] || botBuddyMessages.idle;
    let idx = Math.floor(Math.random() * pool.length);
    if (idx === lastBuddyMsgIdx && pool.length > 1) idx = (idx + 1) % pool.length;
    lastBuddyMsgIdx = idx;
    const dotColor = state === 'idle' ? '#555' :
                     state === 'stop_loss' || state === 'near_sl' || state === 'losing' ? '#ffaa33' :
                     state === 'celebrating' || state === 'take_profit' ? '#ffdd00' : '#00ff88';
    const dotAnim = state === 'idle' ? 'animation:none;' : '';
    el.innerHTML = `<span class="bot-buddy-status-dot" style="background:${dotColor};${dotAnim}"></span>${pool[idx]}`;
}

// ── Completion Sound ──────────────────────────────────────────────────
function playArbCompleteSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Three-note ascending chime: C5 → E5 → G5, then a high sparkle
        const notes = [
            { freq: 523.25, start: 0.00, dur: 0.18, gain: 0.38 },  // C5
            { freq: 659.25, start: 0.12, dur: 0.18, gain: 0.36 },  // E5
            { freq: 783.99, start: 0.24, dur: 0.28, gain: 0.34 },  // G5
            { freq: 1046.5, start: 0.40, dur: 0.22, gain: 0.22 },  // C6 sparkle
        ];
        notes.forEach(({ freq, start, dur, gain }) => {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.connect(env);
            env.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            env.gain.setValueAtTime(0, ctx.currentTime + start);
            env.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
            env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur + 0.05);
        });
        // Short cash-register tick at the start
        const bufSize = ctx.sampleRate * 0.04;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
        const noise = ctx.createBufferSource();
        const noiseEnv = ctx.createGain();
        noiseEnv.gain.setValueAtTime(0.12, ctx.currentTime);
        noise.buffer = buf;
        noise.connect(noiseEnv);
        noiseEnv.connect(ctx.destination);
        noise.start(ctx.currentTime);
    } catch (e) { /* audio not supported */ }
}

// ── Push Notifications ────────────────────────────────────────────────
let _pushPermission = Notification?.permission || 'default';

function requestPushPermission() {
    if (!('Notification' in window)) return;
    if (_pushPermission === 'granted') return;
    Notification.requestPermission().then(p => { _pushPermission = p; });
}

function sendPushNotification(title, body) {
    if (!('Notification' in window) || _pushPermission !== 'granted') return;
    try {
        const n = new Notification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'meridian-arb',
            renotify: true,
        });
        setTimeout(() => n.close(), 8000);
    } catch (e) { /* blocked or not supported */ }
}

// ── Confetti (fires on arb complete only) ────────────────────────────
function triggerConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;

    // Flash overlay
    const flash = document.createElement('div');
    flash.className = 'fill-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1000);

    const colors = ['#00ff88','#00aaff','#ffdd00','#ff88bb','#ffffff','#aaffcc','#88ddff','#ffaa44'];
    const shapes = ['50%', '0%', '50% 0 50% 0', '30%'];
    const count  = 110;
    const fallH  = (window.innerHeight || 700) + 60;

    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const w     = 7 + Math.random() * 9;
        const h     = w * (0.4 + Math.random() * 0.8);
        const left  = Math.random() * window.innerWidth;
        const delay = Math.random() * 1600;   // ms
        const dur   = 2600 + Math.random() * 2000; // ms
        const rotEnd = 360 + Math.floor(Math.random() * 720);

        p.style.cssText = `left:${left}px;top:-${h + 10}px;width:${w}px;height:${h}px;background:${color};border-radius:${shape};`;
        container.appendChild(p);

        // Use Web Animations API — works reliably on Android Chrome + iOS Safari
        setTimeout(() => {
            p.animate([
                { transform: `translateY(0px) rotate(0deg)`, opacity: 1 },
                { transform: `translateY(${fallH * 0.7}px) rotate(${rotEnd * 0.6}deg)`, opacity: 1, offset: 0.8 },
                { transform: `translateY(${fallH}px) rotate(${rotEnd}deg)`, opacity: 0 },
            ], { duration: dur, easing: 'linear', fill: 'forwards' });
        }, delay);
    }

    setTimeout(() => { container.innerHTML = ''; }, 5800);
}

// Set buddy mood (changes face expression and colors)
function setBuddyMood(mood) {
    const buddy = document.getElementById('bot-buddy');
    if (!buddy) return;
    buddy.classList.remove('mood-happy', 'mood-neutral', 'mood-worried', 'mood-celebrating', 'mood-focused', 'mood-alert');
    buddy.classList.add(`mood-${mood}`);
    buddyCurrentMood = mood;
}

// Set mood from fleet health state (only runs when reaction lock has expired)
function setBuddyMoodFromFleet() {
    if (Date.now() < buddyReactionLockedUntil) return;
    const h = _botHealth;
    if (!h) return;
    if (h.danger   > 0) { setBuddyMood('alert');   return; }
    if (h.warning  > 0) { setBuddyMood('worried');  return; }
    if (h.dropping > 0) { setBuddyMood('worried');  return; }
    if (h.holding  > 0) { setBuddyMood('focused');  return; }  // blue = medium time left
    if (h.healthy  > 0) { setBuddyMood('happy');    return; }  // green = plenty of time
    if (buddySessionPnl >= 0) { setBuddyMood('happy');   return; }
    setBuddyMood('neutral');
}

// React to monitor events (called from monitorBots when actions come in)
function buddyReactToEvent(action) {
    buddyEventCount++;
    buddyLastEvent = action.action;

    const lockThen = (ms) => {
        clearTimeout(buddyCelebrationTimeout);
        buddyReactionLockedUntil = Date.now() + ms;
        buddyCelebrationTimeout = setTimeout(() => {
            buddyReactionLockedUntil = 0;
            setBuddyMoodFromFleet();
        }, ms);
    };

    if (action.action === 'completed') {
        setBuddyMood('celebrating');
        updateBotBuddyMsg('celebrating', true);
        triggerConfetti();
        lockThen(12000);
    } else if (action.action === 'flip_yes' || action.action === 'flip_no') {
        setBuddyMood('worried');
        updateBotBuddyMsg('flip_triggered', true);
        lockThen(8000);
    } else if (action.action === 'stop_loss_yes' || action.action === 'stop_loss_no' || action.action === 'stop_loss_watch') {
        setBuddyMood('alert');
        updateBotBuddyMsg('stop_loss', true);
        lockThen(8000);
    } else if (action.action === 'take_profit_watch') {
        setBuddyMood('celebrating');
        updateBotBuddyMsg('take_profit', true);
        lockThen(8000);
    } else if (action.action === 'fav_filled_dog_posted') {
        setBuddyMood('happy');
        updateBotBuddyMsg('fav_filled', true);
        lockThen(10000);
    } else if (action.action === 'fav_reposted') {
        updateBotBuddyMsg('fav_posted', true);
    } else if (action.action === 'fav_stale_cancelled') {
        updateBotBuddyMsg('scanning', true);
    } else if (action.action === 'holding_yes' || action.action === 'holding_no' ||
               action.action === 'holding_yes_one_filled' || action.action === 'holding_no_one_filled') {
        // No lock — fleet health (setBuddyMoodFromFleet) drives color so buddy
        // can transition blue → orange → red as the timeout window shrinks
        if (Date.now() >= buddyReactionLockedUntil) {
            updateBotBuddyMsg('holding', true);
        }
    } else if (action.action === 'timeout_exit_yes' || action.action === 'timeout_exit_no') {
        const tPnl = action.pnl_cents || 0;
        if (tPnl > 0) {
            setBuddyMood('happy');
            updateBotBuddyMsg('scanning', true);
        } else {
            setBuddyMood('neutral');
            updateBotBuddyMsg('stopped', true);
        }
        lockThen(6000);
    } else if (action.action === 'straight_bet_filled') {
        setBuddyMood('happy');
        updateBotBuddyMsg('filled', true);
        lockThen(8000);
    } else if (action.action === 'reposted') {
        updateBotBuddyMsg('scanning');
    }

    updateBuddyStats();
}

// Update buddy based on P&L data
function buddyUpdateFromPnl(pnlData) {
    if (!pnlData) return;
    buddySessionPnl = pnlData.net_dollars ?? 0;

    // Update the stats panel
    const pnlEl = document.getElementById('buddy-pnl');
    if (pnlEl) {
        const color = buddySessionPnl >= 0 ? '#00ff88' : '#ff4444';
        pnlEl.style.color = color;
        pnlEl.textContent = `${buddySessionPnl >= 0 ? '+' : ''}$${buddySessionPnl.toFixed(2)}`;
    }

    // Only update mood if no event reaction is active
    if (Date.now() >= buddyReactionLockedUntil) {
        setBuddyMoodFromFleet();
    }
}

// Track monitor cycles
function buddyTrackCycle() {
    buddyMonitorCycles++;
    if (!buddyMonitorStart) buddyMonitorStart = Date.now();
    updateBuddyStats();
}

// Update stats panel
function updateBuddyStats() {
    const uptimeEl = document.getElementById('buddy-uptime');
    const cyclesEl = document.getElementById('buddy-cycles');
    const eventsEl = document.getElementById('buddy-events');
    
    if (uptimeEl && buddyMonitorStart) {
        const mins = Math.floor((Date.now() - buddyMonitorStart) / 60000);
        if (mins < 60) {
            uptimeEl.textContent = `${mins}m`;
        } else {
            uptimeEl.textContent = `${Math.floor(mins/60)}h ${mins%60}m`;
        }
    }
    if (cyclesEl) cyclesEl.textContent = buddyMonitorCycles.toLocaleString();
    if (eventsEl) eventsEl.textContent = buddyEventCount.toString();
}

// Toggle stats panel (click on buddy body, not avatar)
function toggleBuddyStats(e) {
    // Don't toggle if clicking the avatar (that's for petting)
    if (e.target.closest('.bot-buddy-avatar')) return;
    
    const stats = document.getElementById('buddy-stats');
    const buddy = document.getElementById('bot-buddy');
    if (!stats || !buddy) return;
    
    buddyStatsExpanded = !buddyStatsExpanded;
    stats.classList.toggle('show', buddyStatsExpanded);
    buddy.classList.toggle('expanded', buddyStatsExpanded);
    updateBuddyStats();
}

// Pet the buddy! (click on avatar)
function petBuddy(e) {
    e.stopPropagation();
    buddyPetCount++;
    
    const avatar = e.target.closest('.bot-buddy-avatar');
    if (!avatar) return;
    
    // Add pet animation
    avatar.classList.add('petted');
    setTimeout(() => avatar.classList.remove('petted'), 500);
    
    // Spawn hearts
    const hearts = document.getElementById('buddy-hearts');
    if (hearts) {
        hearts.innerHTML = '<span class="bot-buddy-heart">💚</span><span class="bot-buddy-heart">💚</span><span class="bot-buddy-heart">💚</span>';
        setTimeout(() => hearts.innerHTML = '', 1200);
    }
    
    // Fun messages based on pet count
    const el = document.getElementById('bot-buddy-msg');
    if (el) {
        const petMessages = [
            `<strong>Hey!</strong> That tickles! 😊 Back to work...`,
            `<strong>Hehe!</strong> ${buddyPetCount} pets received. I feel appreciated 💚`,
            `<strong>Stop!</strong> I'm trying to monitor here! 😄`,
            `<strong>Again?</strong> ${buddyPetCount} times now! You must really like me`,
            `<strong>Okay okay!</strong> I'll work extra hard for you today 💪`,
            `<strong>*purrs in binary*</strong> 01101000 01101001`,
        ];
        if (buddyPetCount >= 10) {
            el.innerHTML = `<span class="bot-buddy-status-dot" style="background:#00ff88;"></span><strong>Best friends!</strong> ${buddyPetCount} pets — we're bonded for life now 💚`;
        } else {
            const msg = petMessages[Math.min(buddyPetCount - 1, petMessages.length - 1)];
            el.innerHTML = `<span class="bot-buddy-status-dot" style="background:#00ff88;"></span>${msg}`;
        }
        // Restore normal message after a few seconds
        setTimeout(() => {
            if (autoMonitorInterval) {
                updateBotBuddyMsg('scanning');
            } else {
                updateBotBuddyMsg('idle');
            }
        }, 3000);
    }
}

function updateBotBuddy(activeCount, filledLegs) {
    const buddy = document.getElementById('bot-buddy');
    if (!buddy) return;
    if (activeCount > 0 || document.getElementById('bots-section')?.style.display === 'block') {
        buddy.style.display = 'flex';
    }
    if (!autoMonitorInterval) {
        autoResumeMonitor();
    }
    // Update mood from fleet health (gated behind reaction lock inside)
    setBuddyMoodFromFleet();
    // Background message — only refreshes every 18s (cooldown in updateBotBuddyMsg)
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
            buddyTrackCycle();
            loadBots();
            loadPnL();

            if (data.actions && data.actions.length > 0) {
                data.actions.forEach(action => {
                    console.log('Bot action:', action);
                    buddyReactToEvent(action);
                    if (action.action === 'completed') {
                        const profitStr = `+$${(action.profit_cents/100).toFixed(2)}`;
                        playArbCompleteSound();
                        sendPushNotification('💰 ARB COMPLETE!', `${profitStr} profit locked — Meridian`);
                        showNotification(`✅ ARB COMPLETE! ${profitStr} profit locked`);
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
                    } else if (action.action === 'straight_bet_filled') {
                        showNotification(`💰 LIMIT ORDER FILLED! ${action.side.toUpperCase()} ${action.quantity}× at ${action.price}¢ on ${action.ticker}`);
                    } else if (action.action === 'straight_bet_cancelled') {
                        showNotification(`❌ Limit order cancelled: ${action.side.toUpperCase()} on ${action.ticker}`);
                    } else if (action.action === 'stop_loss_watch') {
                        showNotification(`⚠️ Watch SL triggered: ${action.bot_id} | loss: ${(action.loss_cents/100).toFixed(2)}`);
                    } else if (action.action === 'take_profit_watch') {
                        showNotification(`🎯 Watch TP hit: ${action.bot_id} | profit: +${(action.profit_cents/100).toFixed(2)}`);
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

let _scanModalSport    = 'all';
let _middlesModalSport = 'all';
let _scanMode          = 'instarb';  // 'instarb' | 'anchor'
let _anchorSignalFilter = 'all';     // 'all' | 'lock' | 'anchor' | 'lean'
let _middlesScanResults = [];        // cached last scan so card callbacks can look up full data

function setScanSport(sport) {
    _scanModalSport = sport;
    document.querySelectorAll('.scan-sport-pill').forEach(el => el.classList.toggle('active', el.dataset.sport === sport));
}

function setMiddlesSport(sport) {
    _middlesModalSport = sport;
    document.querySelectorAll('.mid-sport-pill').forEach(el => el.classList.toggle('active', el.dataset.sport === sport));
}

function setScanMode(mode) {
    _scanMode = mode;
    document.querySelectorAll('.scan-mode-pill').forEach(el => el.classList.toggle('active', el.dataset.mode === mode));
    const instarbCtrl = document.getElementById('scan-instarb-controls');
    const anchorCtrl  = document.getElementById('scan-anchor-controls');
    if (instarbCtrl) instarbCtrl.style.display = mode === 'instarb' ? 'flex' : 'none';
    if (anchorCtrl)  anchorCtrl.style.display  = mode === 'anchor'  ? 'flex' : 'none';
    const results = document.getElementById('scan-results');
    if (results) results.innerHTML = '<p style="color:#8892a6;text-align:center;padding:24px;">Set your filters above and click Scan.</p>';
    const countEl = document.getElementById('scan-count');
    if (countEl) countEl.textContent = '';
}

function setAnchorSignal(sig) {
    _anchorSignalFilter = sig;
    document.querySelectorAll('.anchor-signal-pill').forEach(el => el.classList.toggle('active', el.dataset.signal === sig));
}

function runScan() {
    if (_scanMode === 'anchor') anchorScan();
    else autoScanMarkets();
}

function openScanModal() {
    const modal = document.getElementById('scan-modal');
    if (modal) modal.classList.add('show');
    const results = document.getElementById('scan-results');
    if (results && !results.innerHTML) {
        results.innerHTML = '<p style="color:#8892a6;text-align:center;padding:24px;">Set your filters above and click Scan.</p>';
    }
}

async function autoScanMarkets() {
    const minWidth = parseInt(document.getElementById('scan-min-width')?.value || '3');
    const sportParam = (_scanModalSport && _scanModalSport !== 'all') ? `&sport=${_scanModalSport}` : '';
    // Open modal first
    const modal = document.getElementById('scan-modal');
    if (modal) modal.classList.add('show');
    const countEl = document.getElementById('scan-count');
    if (countEl) countEl.textContent = _scanModalSport === 'all' ? 'Scanning all sports (15-20s)…' : 'Scanning…';
    const results = document.getElementById('scan-results');
    if (results) results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">⏳ ${_scanModalSport === 'all' ? 'Scanning all sports — this takes ~15 seconds…' : 'Scanning NCAAB markets…'}</p>`;
    const controller = new AbortController();
    const scanTimeout = setTimeout(() => controller.abort(), 45000);
    try {
        const resp = await fetch(`${API_BASE}/bot/scan?min_width=${minWidth}${sportParam}`, { signal: controller.signal });
        clearTimeout(scanTimeout);
        const data = await resp.json();
        if (data.error) { showNotification(`❌ Scan failed: ${data.error}`); return; }
        showScanResults(data.opportunities || [], minWidth, data.total_scanned || 0);
    } catch (err) {
        clearTimeout(scanTimeout);
        if (err.name === 'AbortError') {
            if (results) results.innerHTML = `<p style="color:#ff6666;text-align:center;padding:24px;">⏱ Scan timed out — too many markets.<br><span style="font-size:12px;">Select a specific sport (NBA, NCAAB, etc.) instead of All.</span></p>`;
            if (countEl) countEl.textContent = 'Timed out';
        } else {
            showNotification(`❌ Scan error: ${err.message}`);
        }
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
                        Raw gap: ${opp.width}¢ &nbsp;·&nbsp; Liq: ${Math.round((opp.liquidity || 0) * 100)}%
                    </div>
                    <div style="color:#6a7488;font-size:10px;margin-top:2px;">
                        Post at YES ${opp.suggested_yes}¢ + NO ${opp.suggested_no}¢ (bid+1, front of queue) → +${opp.profit_posted}¢/contract
                        &nbsp;·&nbsp; Catch: ${opp.catch_score || 0}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;">
                    <div style="text-align:right;">
                        <div style="color:${profitColor};font-weight:800;font-size:1.3rem;">+${opp.profit_posted}¢</div>
                        <div style="color:#6a7488;font-size:10px;">after queue jump</div>
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

// ─── Anchor Hunt Scanner ─────────────────────────────────────────────────────
// Client-side scanner that uses already-loaded allMarkets + live score data
// to find games with LOCK / ANCHOR / LEAN signals and suggest Bot placements.
async function anchorScan() {
    const results = document.getElementById('scan-results');
    const countEl = document.getElementById('scan-count');
    if (!results) return;

    // Auto-load markets and/or live scores if not yet populated
    if (!allMarkets.length || Object.keys(allGameData).length === 0) {
        if (countEl) countEl.textContent = 'Loading data…';
        results.innerHTML = '<p style="color:#8892a6;text-align:center;padding:24px;">⏳ Loading markets + live scores…</p>';
        if (!allMarkets.length) await loadMarkets();
        await loadLiveScores();
    }

    if (countEl) countEl.textContent = 'Scanning signals…';

    // Only game-winner markets for recognized sports — NCAAB/NHL/MLB etc. don't use "GAME-" in
    // their ticker prefix (e.g. KXNCAAB-, KXMARMAD-, KXNHL-) so we can't filter on that string.
    // Instead: recognized sport + no qualifier suffix (SPREAD/TOTAL/1H/2H).
    const ANCHORSCAN_SPORTS = new Set(['NBA','NFL','NHL','MLB','NCAAB','NCAAW','NCAAF','MLS','EPL','UCL','Tennis','WBC','VTB','BSL','ABA','Esports']);
    const winnerMkts = allMarkets.filter(m => {
        const t = (m.ticker || '').toUpperCase();
        if (t.includes('SPREAD') || t.includes('TOTAL') || t.includes('1H') || t.includes('2H')) return false;
        const et = m.event_ticker || m.ticker || '';
        return ANCHORSCAN_SPORTS.has(detectSport(et));
    });

    // Group by gameId, applying sport filter
    const gameMap = new Map();
    for (const m of winnerMkts) {
        const et    = m.event_ticker || m.ticker || '';
        const sport = detectSport(et);

        // Sport pill filter
        if (_scanModalSport !== 'all') {
            const su = sport.toUpperCase();
            const fu = _scanModalSport.toUpperCase();
            const ok = (fu === 'NBA'    && su === 'NBA')
                    || (fu === 'NHL'    && su === 'NHL')
                    || (fu === 'MLB'    && su === 'MLB')
                    || (fu === 'NCAAB'  && su === 'NCAAB')
                    || (fu === 'NFL'    && (su === 'NFL' || su === 'NCAAF'))
                    || (fu === 'SOCCER' && (su === 'MLS' || su === 'EPL' || su === 'UCL'));
            if (!ok) continue;
        }

        const gameId = extractGameId(et);
        if (!gameMap.has(gameId)) gameMap.set(gameId, { sport, markets: [], title: m.title || et });
        gameMap.get(gameId).markets.push(m);
    }

    // Compute signal for each game group, then filter — one card per GAME
    const gameRows = [];
    for (const [gameId, { sport, markets, title }] of gameMap) {
        const signal = getGameSignal(gameId, sport, markets);
        if (!signal || signal.type === 'none' || signal.type === 'pregame' || signal.type === 'caution') continue;

        // Signal filter
        if (_anchorSignalFilter !== 'all') {
            const lbl = signal.label.toUpperCase();
            const match = (_anchorSignalFilter === 'lock'   && lbl.includes('LOCK'))
                       || (_anchorSignalFilter === 'anchor' && lbl.includes('ANCHOR'))
                       || (_anchorSignalFilter === 'lean'   && lbl.includes('LEAN'));
            if (!match) continue;
        }

        // Navigation: use event_ticker from first market
        const navTicker = markets[0]?.event_ticker || markets[0]?.ticker || '';
        gameRows.push({ signal, gameId, sport, markets, title, navTicker });
    }

    // Sort: LOCK → ANCHOR → LEAN → DANGER/CLOSE
    const sigRank = { anchor: 0, lean: 1, swing: 2, danger: 3 };
    gameRows.sort((a, b) => {
        const aIsLock = a.signal.label.includes('LOCK');
        const bIsLock = b.signal.label.includes('LOCK');
        const ar = aIsLock ? -1 : (sigRank[a.signal.type] ?? 9);
        const br = bIsLock ? -1 : (sigRank[b.signal.type] ?? 9);
        return ar - br;
    });

    if (countEl) countEl.textContent = `${gameRows.length} game${gameRows.length !== 1 ? 's' : ''}`;

    if (gameRows.length === 0) {
        results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">`
            + `No ${_anchorSignalFilter !== 'all' ? _anchorSignalFilter.toUpperCase() + ' ' : ''}signal matches found.<br>`
            + `<span style="font-size:12px;">Try a different signal filter, or wait for games to go live.</span></p>`;
        return;
    }

    results.innerHTML = gameRows.map(({ signal, title, navTicker, sport, markets }) => {
        const mktInfo = markets.length > 1 ? `${markets.length} markets` : (markets[0]?.title || navTicker);
        return `<div
            onclick="anchorScanNavigate('${navTicker}')"
            style="cursor:pointer;background:#0a0e1a;border-radius:8px;padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-left:3px solid ${signal.color};transition:background 0.12s;"
            onmouseenter="this.style.background='#0e1420'"
            onmouseleave="this.style.background='#0a0e1a'">
            <div style="flex:1;min-width:0;">
                <div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:4px;">${title}</div>
                <div style="color:#8892a6;font-size:11px;">${signal.description}</div>
                <div style="color:#444;font-size:10px;margin-top:4px;">${sport} · ${mktInfo}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
                <span style="background:${signal.color}22;color:${signal.color};padding:3px 12px;border-radius:6px;font-size:11px;font-weight:800;">${signal.label}</span>
                <span style="color:#555;font-size:11px;">Tap to view →</span>
            </div>
        </div>`;
    }).join('');
}

function anchorScanNavigate(eventTicker) {
    // Close the scan modal and navigate to the game in the Markets tab
    document.getElementById('scan-modal')?.classList.remove('show');
    navigateToMarket(eventTicker);
}

async function quickBot(ticker, yesPrice, noPrice) {
    // Qty: prefer scan modal qty input; fall back to global controls bar
    const quantity        = parseInt(document.getElementById('scan-qty')?.value) || parseInt(document.getElementById('bot-quantity')?.value) || 1;
    const totalCost       = (yesPrice + noPrice) * quantity;
    const profitPer       = 100 - yesPrice - noPrice;

    if (!confirm(`⚡ Place Dual-Arb Bot — ${quantity} contract(s)\n\nTicker: ${ticker}\nYES limit buy: ${yesPrice}¢\nNO limit buy: ${noPrice}¢\nTotal cost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nProfit if both fill: +${profitPer}¢/contract\n8-min timeout if one leg fills\n\nConfirm?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, yes_price: yesPrice, no_price: noPrice, quantity }),
        });
        const data = await resp.json();
        if (data.success) {
            const profitPer = 100 - yesPrice - noPrice;
            showNotification(`✅ ARB deployed: ${quantity} contracts | ${profitPer}¢ width | YES ${yesPrice}¢ → NO ${noPrice}¢ queued`);
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else if (data.tight_game_blocked) {
            const forceIt = confirm(`${data.error}\n\n⚠️ Click OK to FORCE deploy anyway (not recommended).`);
            if (forceIt) {
                const retryResp = await fetch(`${API_BASE}/bot/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticker, yes_price: yesPrice, no_price: noPrice, quantity, force_tight: true }),
                });
                const retryData = await retryResp.json();
                if (retryData.success) {
                    const profitPer = 100 - yesPrice - noPrice;
                    showNotification(`⚠️ Force deployed (tight game): ${quantity} contracts | ${profitPer}¢ width | YES ${yesPrice}¢ → NO ${noPrice}¢`);
                    loadBots();
                    if (!autoMonitorInterval) toggleAutoMonitor();
                } else {
                    showNotification(`❌ Error: ${retryData.error}`);
                }
            }
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
function openMiddlesModal() {
    document.getElementById('middles-modal')?.classList.add('show');
}

async function scanMiddles() {
    const statusEl = document.getElementById('middles-status');
    const countEl  = document.getElementById('middles-count');
    const btnEl    = document.getElementById('middles-scan-btn');
    const results  = document.getElementById('middles-results');

    // Open modal if not already open
    document.getElementById('middles-modal')?.classList.add('show');

    // Loading state
    if (statusEl) statusEl.innerHTML = '<span style="color:#ffaa00;">⏳ Scanning spread markets...</span>';
    if (countEl)  countEl.textContent = '';
    if (btnEl)    { btnEl.disabled = true; btnEl.textContent = '⏳ Scanning...'; }
    if (results)  results.innerHTML = '<p style="color:#8892a6;text-align:center;padding:32px;font-size:13px;">Fetching spread markets across all sports — this takes a few seconds...</p>';

    const t0 = Date.now();
    const sportParam = (_middlesModalSport && _middlesModalSport !== 'all') ? `?sport=${_middlesModalSport}` : '';
    try {
        const resp = await fetch(`${API_BASE}/scan/middles${sportParam}`);
        const data = await resp.json();
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        if (data.error) {
            if (statusEl) statusEl.innerHTML = `<span style="color:#ff4444;">❌ ${data.error}</span>`;
            if (results)  results.innerHTML = `<p style="color:#ff4444;text-align:center;padding:24px;">${data.error}</p>`;
        } else {
            const n = (data.middles || []).length;
            if (statusEl) statusEl.innerHTML = `<span style="color:#00ff88;">✓ Scan complete</span> <span style="color:#555;">· ${elapsed}s · ${data.total_spreads || 0} spread markets · ${data.games_with_spreads || 0} games</span>`;
            if (countEl)  countEl.textContent = `${n} middle${n !== 1 ? 's' : ''} found`;
            showMiddlesResults(data);
        }
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#ff4444;">❌ Network error: ${err.message}</span>`;
        if (results)  results.innerHTML = `<p style="color:#ff4444;text-align:center;padding:24px;">Scan failed: ${err.message}</p>`;
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = '🔍 Scan'; }
    }
}

function showMiddlesResults(data) {
    const modal   = document.getElementById('middles-modal');
    const results = document.getElementById('middles-results');
    const countEl = document.getElementById('middles-count');
    if (!modal || !results) return;

    const middles = data.middles || [];
    _middlesScanResults = middles;  // cache for card callbacks
    if (middles.length === 0) {
        results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">
            No middle opportunities found across ${data.games_with_spreads || 0} games with spread markets.<br>
            <span style="font-size:12px;">Middles require spread lines for opposing teams in the same game.</span>
        </p>`;
    } else {
        // Sort: guaranteed arbs first, then by spread sum smallest first (tightest middle = easiest to catch)
        const sorted = [...middles].sort((a, b) => {
            if ((a.guaranteed_profit > 0) !== (b.guaranteed_profit > 0))
                return b.guaranteed_profit > 0 ? 1 : -1;
            return (a.spread_a + a.spread_b) - (b.spread_a + b.spread_b);
        });
        _middlesScanResults = sorted;  // update cache to sorted order

        // Group by game_id
        const gameGroups = new Map();
        sorted.forEach((m, idx) => {
            const gId = m.game_id || `${m.team_a}_${m.team_b}`;
            if (!gameGroups.has(gId)) gameGroups.set(gId, []);
            gameGroups.get(gId).push({ m, idx });
        });

        function buildMiddleCard(m, idx) {
            const isGuaranteed = m.guaranteed_profit > 0;
            const borderColor = isGuaranteed ? '#00ff88' : '#aa66ff44';
            const guarLabel = isGuaranteed
                ? `<span style="background:#00ff8822;color:#00ff88;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">✓ GUARANTEED ARB</span>`
                : `<span style="background:#aa66ff22;color:#aa66ff;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">${m.spread_a}&${m.spread_b} middle</span>`;
            const speedColors = { prime: '#00ff88', fast: '#ffaa00', moderate: '#ff9944', slow: '#556' };
            const speedColor = speedColors[m.catch_speed] || '#556';
            const shaveA = m.no_a_bid - m.suggested_a;
            const shaveB = m.no_b_bid - m.suggested_b;
            const sugProfit = 100 - m.suggested_a - m.suggested_b;
            const sugBothWin = 200 - m.suggested_a - m.suggested_b;
            return `<div style="background:#0a0e1a;border-radius:8px;padding:12px 14px;margin-bottom:8px;border-left:3px solid ${borderColor};">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:10px;">
                    ${guarLabel}
                    <span style="background:${speedColor}22;color:${speedColor};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;">${(m.catch_speed||'slow').toUpperCase()}</span>
                </div>
                <!-- Pricing table -->
                <div style="background:#060a14;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:11px;">
                    <div style="display:grid;grid-template-columns:1fr 70px 80px;gap:4px;padding-bottom:4px;border-bottom:1px solid #1a2030;margin-bottom:4px;">
                        <div style="color:#556;font-size:10px;font-weight:600;">LEG</div>
                        <div style="color:#556;font-size:10px;font-weight:600;text-align:center;">MARKET BID</div>
                        <div style="color:#ffaa00;font-size:10px;font-weight:600;text-align:center;">YOUR LIMIT</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 70px 80px;gap:4px;align-items:center;padding:4px 0;border-bottom:1px solid #0d1220;">
                        <div>
                            <span style="color:#fff;font-weight:700;font-size:11px;">${m.team_b||'Opp'} +${m.spread_a||'?'}</span>
                            <div style="color:#555;font-size:9px;">NO: ${m.title_a.replace(' Points?','').replace(' points?','')}</div>
                        </div>
                        <div style="text-align:center;color:#8892a6;font-weight:600;">${m.no_a_bid}¢</div>
                        <div style="text-align:center;">
                            <input id="mid-pa-${idx}" type="number" min="1" max="99" value="${m.suggested_a}"
                                oninput="updateMiddleProfit(${idx},${m.no_a_bid},${m.no_b_bid})"
                                style="width:46px;padding:2px 4px;background:#1a2540;border:1px solid #2a3550;border-radius:4px;color:#fff;font-size:12px;font-weight:700;text-align:center;">
                            ${shaveA > 0 ? `<span style="color:#ff9944;font-size:9px;">-${shaveA}¢</span>` : ''}
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 70px 80px;gap:4px;align-items:center;padding:4px 0;">
                        <div>
                            <span style="color:#fff;font-weight:700;font-size:11px;">${m.team_a||'Opp'} +${m.spread_b||'?'}</span>
                            <div style="color:#555;font-size:9px;">NO: ${m.title_b.replace(' Points?','').replace(' points?','')}</div>
                        </div>
                        <div style="text-align:center;color:#8892a6;font-weight:600;">${m.no_b_bid}¢</div>
                        <div style="text-align:center;">
                            <input id="mid-pb-${idx}" type="number" min="1" max="99" value="${m.suggested_b}"
                                oninput="updateMiddleProfit(${idx},${m.no_a_bid},${m.no_b_bid})"
                                style="width:46px;padding:2px 4px;background:#1a2540;border:1px solid #2a3550;border-radius:4px;color:#fff;font-size:12px;font-weight:700;text-align:center;">
                            ${shaveB > 0 ? `<span style="color:#ff9944;font-size:9px;">-${shaveB}¢</span>` : ''}
                        </div>
                    </div>
                </div>
                <!-- Profit summary -->
                <div id="mid-summary-${idx}" style="background:#060a14;border-radius:6px;padding:7px 10px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;text-align:center;">
                    <div>
                        <div style="color:#556;font-size:9px;font-weight:600;margin-bottom:2px;">TOTAL COST</div>
                        <div style="color:#fff;font-weight:700;" id="mid-cost-${idx}">${m.suggested_a + m.suggested_b}¢</div>
                    </div>
                    <div>
                        <div style="color:#556;font-size:9px;font-weight:600;margin-bottom:2px;">ONE LEG WINS</div>
                        <div style="color:${sugProfit >= 0 ? '#00ff88' : '#ff4444'};font-weight:800;" id="mid-profit-${idx}">${sugProfit >= 0 ? '+' : ''}${sugProfit}¢</div>
                    </div>
                    <div>
                        <div style="color:#556;font-size:9px;font-weight:600;margin-bottom:2px;">BOTH WIN (${m.spread_a}&${m.spread_b} middle)</div>
                        <div style="color:#aa66ff;font-weight:800;" id="mid-both-${idx}">+${sugBothWin}¢</div>
                    </div>
                </div>
                <!-- Action row -->
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <span style="color:#8892a6;font-size:11px;">Qty:</span>
                    <input id="mid-qty-${idx}" type="number" min="1" value="1"
                        style="width:44px;padding:4px 6px;background:#0a0e1a;border:1px solid #2a3550;border-radius:5px;color:#fff;font-size:12px;font-weight:600;text-align:center;">
                    <button onclick="deployMiddleBotFromCard(${idx})"
                            style="background:${isGuaranteed ? '#00ff88' : '#aa66ff'};color:${isGuaranteed ? '#000' : '#fff'};border:none;padding:5px 16px;border-radius:5px;cursor:pointer;font-weight:700;font-size:11px;">
                        📐 Deploy
                    </button>
                </div>
            </div>`;
        }

        let html = '';
        for (const [gameId, entries] of gameGroups) {
            const first = entries[0].m;
            const hasLive = entries.some(e => e.m.is_live);
            const hasGuar = entries.some(e => e.m.guaranteed_profit > 0);
            const mDate = first.game_date ? ` · ${first.game_date}` : '';
            const teamNames = `${first.team_a_name || first.team_a} vs ${first.team_b_name || first.team_b}`;
            html += `<div style="margin-bottom:18px;">
                <div style="display:flex;align-items:center;gap:6px;padding:6px 0;margin-bottom:6px;border-bottom:1px solid #1e2740;">
                    <span style="color:#fff;font-weight:800;font-size:13px;">${teamNames}</span>
                    ${hasLive ? '<span style="background:#ff333333;color:#ff3333;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">🔴 LIVE</span>' : ''}
                    ${hasGuar ? '<span style="background:#00ff8822;color:#00ff88;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">✓ ARB</span>' : ''}
                    <span style="color:#444;font-size:10px;">${mDate}</span>
                    <span style="color:#444;font-size:10px;margin-left:auto;">${entries.length} middle${entries.length > 1 ? 's' : ''}</span>
                </div>
                ${entries.map(({ m, idx }) => buildMiddleCard(m, idx)).join('')}
            </div>`;
        }
        results.innerHTML = html;
    }
    // modal is already shown by scanMiddles(); don't re-open here
}

function updateMiddleProfit(idx, bidA, bidB) {
    const pa = parseInt(document.getElementById(`mid-pa-${idx}`)?.value) || bidA;
    const pb = parseInt(document.getElementById(`mid-pb-${idx}`)?.value) || bidB;
    const cost = pa + pb;
    const profit = 100 - cost;
    const both = 200 - cost;
    const costEl = document.getElementById(`mid-cost-${idx}`);
    const profitEl = document.getElementById(`mid-profit-${idx}`);
    const bothEl = document.getElementById(`mid-both-${idx}`);
    if (costEl) costEl.textContent = `${cost}¢`;
    if (profitEl) {
        profitEl.textContent = `${profit >= 0 ? '+' : ''}${profit}¢`;
        profitEl.style.color = profit >= 0 ? '#00ff88' : '#ff4444';
    }
    if (bothEl) bothEl.textContent = `+${both}¢`;
}

async function deployMiddleBotFromCard(idx) {
    const m   = _middlesScanResults[idx];
    if (!m) { showNotification('❌ Scan result not found — re-scan and try again.'); return; }

    const pa  = parseInt(document.getElementById(`mid-pa-${idx}`)?.value) || 0;
    const pb  = parseInt(document.getElementById(`mid-pb-${idx}`)?.value) || 0;
    const qty = parseInt(document.getElementById(`mid-qty-${idx}`)?.value) || 1;

    if (!pa || !pb) { showNotification('❌ Invalid prices'); return; }

    const cost        = (pa + pb) * qty;
    const guaranteed  = (100 - pa - pb) * qty;
    const middleProf  = (200 - pa - pb) * qty;
    const midWidth    = m.middle_width % 1 === 0 ? m.middle_width : m.middle_width?.toFixed(1);

    if (!confirm(`📐 Deploy Middle Bot — ${qty} contract(s)\n\nLeg A: NO ${m.ticker_a} @ ${pa}¢\nLeg B: NO ${m.ticker_b} @ ${pb}¢\nMiddle window: ±${midWidth} pts\n\nTotal cost: $${(cost / 100).toFixed(2)}\nOne side wins: ${guaranteed >= 0 ? '+' : ''}${guaranteed}¢\nBoth win (middle hits): +${middleProf}¢\nStop-loss: OFF\n\nConfirm?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/middle/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker_a:       m.ticker_a,
                ticker_b:       m.ticker_b,
                target_price_a: pa,
                target_price_b: pb,
                target_price:   Math.round((pa + pb) / 2),
                qty,
                stop_loss_cents: 0,
                team_a_name:    m.team_a || '',
                team_b_name:    m.team_b || '',
                spread_a:       m.spread_a || 0,
                spread_b:       m.spread_b || 0,
                no_a_bid:       m.no_a_bid || 0,
                no_b_bid:       m.no_b_bid || 0,
                game_id:        m.game_id || '',
            }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`📐 Middle Bot deployed! A @ ${pa}¢ + B @ ${pb}¢ — floor ${guaranteed >= 0 ? '+' : ''}${guaranteed}¢`);
            closeMiddlesModal();
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            showNotification(`❌ Middle bot error: ${data.error || 'Unknown error'}`);
        }
    } catch (err) {
        showNotification(`❌ Network error: ${err.message}`);
    }
}

function closeMiddlesModal() {
    document.getElementById('middles-modal')?.classList.remove('show');
}

// ─── Middle Bot Modal ─────────────────────────────────────────────────────────

// Current middle bot data (set when opened from scanner or directly)
let _currentMiddleData = null;

// ── Manual Middle Builder ─────────────────────────────────────────────────────
// Stores the first leg while the user picks the second leg.
let _pendingMiddleLeg1 = null;

/** Extract numeric spread value from a market title like "Phoenix wins by over 3.5 Points?" */
function extractSpreadFromMarket(market) {
    const title = market.title || '';
    const m = title.match(/wins?\s+by\s+over\s+([\d.]+)/i);
    if (m) return parseFloat(m[1]);
    return null;
}

/** Returns true if this is a spread market (used for manual middle building) */
function isSpreadMarket(market) {
    return (market.market_type === 'spread') ||
           (market.ticker || '').toUpperCase().includes('SPREAD');
}

/** Show (or hide) the floating bottom banner for Leg 1 pending selection */
function _showPendingLegBanner(leg) {
    let banner = document.getElementById('pending-middle-leg-banner');
    if (!leg) { if (banner) banner.remove(); return; }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'pending-middle-leg-banner';
        banner.style.cssText = [
            'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
            'background:#1a1228', 'border:2px solid #aa66ff', 'border-radius:10px',
            'padding:12px 18px', 'z-index:99998', 'display:flex', 'align-items:center',
            'gap:12px', 'box-shadow:0 4px 24px rgba(170,102,255,0.4)',
            'min-width:320px', 'max-width:540px',
        ].join(';');
        document.body.appendChild(banner);
    }
    banner.innerHTML = `
        <span style="font-size:18px;">↔️</span>
        <div style="flex:1;min-width:0;">
            <div style="color:#aa66ff;font-weight:700;font-size:10px;letter-spacing:.06em;margin-bottom:3px;">LEG 1 LOCKED — SAME GAME ONLY</div>
            <div style="color:#fff;font-size:13px;font-weight:700;">NO ${leg.teamLabel} +${leg.spread} &nbsp;@&nbsp; ${leg.noBid}¢</div>
            <div style="color:#8892a6;font-size:10px;margin-top:2px;">Now click <strong style="color:#ff4444;">NO</strong> on another spread in the <em>same game</em></div>
        </div>
        <button onclick="cancelPendingMiddleLeg()"
            style="background:#ff444422;color:#ff4444;border:1px solid #ff444444;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0;">✕ Cancel</button>`;
}

/** Cancel the pending Leg 1 selection */
function cancelPendingMiddleLeg() {
    _pendingMiddleLeg1 = null;
    _showPendingLegBanner(null);
}

/**
 * Intercept NO clicks on spread markets.
 * — First click  → stores as Leg 1, shows floating banner.
 * — Second click (same game, different ticker) → builds middle, opens bot modal.
 * — Non-spread markets → falls through to normal openBotModal.
 */
function handleManualMiddleNoClick(market) {
    // Non-spread markets go straight to regular bot
    if (!isSpreadMarket(market)) {
        openBotModal(market, 'no', getPrice(market, 'no_ask'));
        return;
    }
    const spread = extractSpreadFromMarket(market);
    if (spread === null) {
        openBotModal(market, 'no', getPrice(market, 'no_ask'));
        return;
    }

    const noBid    = getPrice(market, 'no_bid')  || 0;
    const noAsk    = getPrice(market, 'no_ask')  || 0;
    const gameId   = market.event_ticker || market.ticker || '';
    const teamLabel = getTeamLabelFromTicker(market.ticker) || market.ticker;

    // No pending leg yet → set Leg 1
    if (_pendingMiddleLeg1 === null) {
        _pendingMiddleLeg1 = { market, ticker: market.ticker, spread, noBid, noAsk, teamLabel, gameId };
        _showPendingLegBanner(_pendingMiddleLeg1);
        return;
    }

    // Same ticker tapped again → cancel and open regular bot
    if (_pendingMiddleLeg1.ticker === market.ticker) {
        cancelPendingMiddleLeg();
        openBotModal(market, 'no', noAsk);
        return;
    }

    // Same game → build the middle
    if (_pendingMiddleLeg1.gameId === gameId) {
        const leg1 = _pendingMiddleLeg1;
        cancelPendingMiddleLeg();
        const sug_a = Math.min(Math.floor(96 / 2), leg1.noBid);
        const sug_b = Math.min(96 - sug_a, noBid);
        openMiddleBotModal({
            ticker_a:         leg1.ticker,
            ticker_b:         market.ticker,
            team_a:           leg1.teamLabel,
            team_b:           teamLabel,
            title_a:          leg1.market.title || leg1.ticker,
            title_b:          market.title      || market.ticker,
            spread_a:         leg1.spread,
            spread_b:         spread,
            no_a_bid:         leg1.noBid,
            no_b_bid:         noBid,
            suggested_a:      sug_a,
            suggested_b:      sug_b,
            middle_width:     leg1.spread + spread,
            guaranteed_profit: 100 - leg1.noBid - noBid,
            game_id:          gameId,
            is_manual:        true,
        });
        return;
    }

    // Different game → ask to replace Leg 1
    if (confirm(`⚠️ Different game!\n\nLeg 1: ${_pendingMiddleLeg1.gameId}\nThis: ${gameId}\n\nReplace Leg 1 with this market?`)) {
        _pendingMiddleLeg1 = null;
        handleManualMiddleNoClick(market);
    }
}
// ─────────────────────────────────────────────────────────────────────────────

/** Bridge from scanner card — closes middles modal then opens bot modal with data */
function openMiddleBotFromScanner(middle) {
    closeMiddlesModal();
    // Reset market card display
    const marketCard = document.getElementById('bot-market-card');
    if (marketCard) marketCard.style.display = 'none';
    openMiddleBotModal(middle);
}

/**
 * Open the bot modal pre-filled with middle bot data from the scanner.
 * Switches to the 'middle' tab and populates both legs.
 */
function openMiddleBotModal(middle) {
    _currentMiddleData = middle;
    // If a single-market modal is open, reuse it but switch to middle tab
    setTradeMode('middle');

    // Populate leg cards — show reflected traditional spread (NO team A by X = team B +X)
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const teamA = middle.team_a || middle.title_a || middle.ticker_a || 'Team A';
    const teamB = middle.team_b || middle.title_b || middle.ticker_b || 'Team B';
    // Reflected view: NO teamA wins by spread_a → teamB +spread_a
    setEl('middle-leg-a-team', `${teamB} +${middle.spread_a || '?'}`);
    setEl('middle-leg-b-team', `${teamA} +${middle.spread_b || '?'}`);
    setEl('middle-leg-a-market', `NO: ${teamA} wins by ${middle.spread_a || '?'}`);
    setEl('middle-leg-b-market', `NO: ${teamB} wins by ${middle.spread_b || '?'}`);
    setEl('middle-leg-a-ticker', middle.ticker_a || '');
    setEl('middle-leg-b-ticker', middle.ticker_b || '');
    setEl('middle-leg-a-bid', middle.no_a_bid != null ? `${middle.no_a_bid}¢` : '—');
    setEl('middle-leg-b-bid', middle.no_b_bid != null ? `${middle.no_b_bid}¢` : '—');

    // Auto-recommend: default to 0¢ arb (straight middle), equal shave from each bid
    // This populates middle-price-a and middle-price-b
    updateMiddleArbPreset(0);

    // Show bid hints
    const hintA = document.getElementById('middle-price-a-hint');
    const hintB = document.getElementById('middle-price-b-hint');
    if (hintA) hintA.textContent = middle.no_a_bid != null ? `bid: ${middle.no_a_bid}¢` : 'bid: —';
    if (hintB) hintB.textContent = middle.no_b_bid != null ? `bid: ${middle.no_b_bid}¢` : 'bid: —';

    // Show middle window indicator
    const winfoEl = document.getElementById('middle-window-info');
    if (winfoEl) {
        if (middle.middle_width != null) {
            const guar = middle.guaranteed_profit != null
                ? middle.guaranteed_profit
                : 100 - (middle.no_a_bid || 0) - (middle.no_b_bid || 0);
            const spreadDesc = (middle.spread_a != null && middle.spread_b != null)
                ? `${middle.spread_a} & ${middle.spread_b} spread middle`
                : `${middle.middle_width}pt window`;
            winfoEl.innerHTML =
                `<span style="color:#aa66ff;font-weight:700;font-size:13px;">↔ ${spreadDesc}</span>` +
                `&nbsp;&nbsp;<span style="color:${guar >= 0 ? '#00ff88' : '#ff4444'};font-size:11px;">market floor ${guar >= 0 ? '+' : ''}${guar}¢ at current bids</span>`;
            winfoEl.style.display = 'block';
        } else {
            winfoEl.style.display = 'none';
        }
    }

    updateMiddleBotCalc();

    // Open the modal (hide the single-market card since we're showing leg cards instead)
    const marketCard = document.getElementById('bot-market-card');
    if (marketCard) marketCard.style.display = 'none';
    document.getElementById('bot-modal').classList.add('show');
}

/** Auto-fill leg prices based on arb width preset using equal-shave from current bids */
function updateMiddleArbPreset(width) {
    const w  = parseInt(width) || 0;
    const md = _currentMiddleData;
    const elA = document.getElementById('middle-price-a');
    const elB = document.getElementById('middle-price-b');
    const descEl = document.getElementById('middle-arb-desc');

    if (md && md.no_a_bid != null && md.no_b_bid != null) {
        // Equal-shave formula:
        //   target_sum   = 100 - w  (floor = 0 for straight, +w¢ for arb)
        //   total_shave  = (bid_a + bid_b) - target_sum
        //   shave_each   = total_shave / 2  (split evenly between legs)
        //   price_x      = bid_x - shave_each
        const targetSum  = 100 - w;
        const totalShave = (md.no_a_bid + md.no_b_bid) - targetSum;
        const shaveEach  = totalShave / 2;
        // Never recommend above market bid — cap each price to its bid (shave can't be negative per leg)
        const pA = Math.max(1, Math.min(md.no_a_bid, Math.min(90, Math.round(md.no_a_bid - shaveEach))));
        const pB = Math.max(1, Math.min(md.no_b_bid, Math.min(90, Math.round(md.no_b_bid - shaveEach))));
        if (elA) elA.value = pA;
        if (elB) elB.value = pB;
        const shaveADisp = (md.no_a_bid - pA);
        const shaveBDisp = (md.no_b_bid - pB);
        const signA = shaveADisp >= 0 ? '-' : '+';
        const signB = shaveBDisp >= 0 ? '-' : '+';
        if (descEl) {
            const floorPer = 100 - pA - pB;
            const floorColor = floorPer > 0 ? '#00ff88' : floorPer === 0 ? '#ffaa44' : '#ff4444';
            descEl.innerHTML = `Shave: A ${signA}${Math.abs(shaveADisp)}¢ · B ${signB}${Math.abs(shaveBDisp)}¢ from bid &nbsp;·&nbsp; `
                + `<span style="color:${floorColor};font-weight:700;">floor = ${floorPer >= 0 ? '+' : ''}${floorPer}¢</span> per contract`;
        }
    } else {
        // No bid data — symmetric at 50 - w/2
        const p = Math.max(1, Math.min(90, Math.round((100 - w) / 2)));
        if (elA) elA.value = p;
        if (elB) elB.value = p;
        if (descEl) descEl.textContent = 'Load a middle from the scanner to auto-fill from live bids.';
    }

    // Highlight active preset pill
    document.querySelectorAll('.middle-arb-pill').forEach(el => {
        el.classList.toggle('active', el.dataset.width === String(w));
    });
    // Clear the custom input if we're on a preset
    const customEl = document.getElementById('middle-arb-custom');
    if (customEl && [0,2,4,6,8].includes(w)) customEl.value = '';

    updateMiddleBotCalc();
}

/** Called when user manually edits a price — clears preset pill highlights */
function clearMiddleArbPills() {
    document.querySelectorAll('.middle-arb-pill').forEach(el => el.classList.remove('active'));
}

/** Update the middle bot modal P&L calc preview */
function updateMiddleBotCalc() {
    const pA  = parseInt(document.getElementById('middle-price-a')?.value  || '49');
    const pB  = parseInt(document.getElementById('middle-price-b')?.value  || '49');
    const qty = parseInt(document.getElementById('middle-qty')?.value       || '1');
    const sl  = parseInt(document.getElementById('middle-stop-loss')?.value || '0');

    const guaranteed   = (100 - pA - pB) * qty;
    const middleProfit = (200 - pA - pB) * qty;
    const cost         = (pA + pB) * qty;
    const slExitA      = pA - sl;
    const slExitB      = pB - sl;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const guarText = isNaN(guaranteed)   ? '—' : `${guaranteed >= 0 ? '+' : ''}${guaranteed}¢`;
    const midText  = isNaN(middleProfit) ? '—' : `+${middleProfit}¢`;
    const costText = isNaN(cost)         ? '—' : `$${(cost / 100).toFixed(2)}`;
    const slText   = sl === 0 ? 'OFF' : (isNaN(slExitA) ? '—' : `A: ${slExitA}¢ / B: ${slExitB}¢`);

    setEl('middle-calc-guaranteed', guarText);
    setEl('middle-calc-middle', midText);
    setEl('middle-calc-cost', costText);
    setEl('middle-calc-sl', slText);

    // Color guaranteed based on sign
    const guarEl = document.getElementById('middle-calc-guaranteed');
    if (guarEl) guarEl.style.color = guaranteed >= 0 ? '#00ff88' : '#ff4444';

    // Update bid hint
    const md = _currentMiddleData;
    if (md && md.no_a_bid != null && md.no_b_bid != null) {
        const hintA = document.getElementById('middle-price-a-hint');
        const hintB = document.getElementById('middle-price-b-hint');
        if (hintA) {
            const shA = md.no_a_bid - pA;
            hintA.innerHTML = `bid: ${md.no_a_bid}¢ <span style="color:${shA>=0?'#ffaa44':'#ff4444'}">(${shA>=0?'-':'+'}${Math.abs(shA)}¢)</span>`;
        }
        if (hintB) {
            const shB = md.no_b_bid - pB;
            hintB.innerHTML = `bid: ${md.no_b_bid}¢ <span style="color:${shB>=0?'#ffaa44':'#ff4444'}">(${shB>=0?'-':'+'}${Math.abs(shB)}¢)</span>`;
        }
    }
}

/** Launch the middle bot — posts to /api/middle/bot/create */
async function launchMiddleBot() {
    const pA  = parseInt(document.getElementById('middle-price-a')?.value  || '49');
    const pB  = parseInt(document.getElementById('middle-price-b')?.value  || '49');
    const qty = parseInt(document.getElementById('middle-qty')?.value       || '1');
    const sl  = parseInt(document.getElementById('middle-stop-loss')?.value || '0');
    const md  = _currentMiddleData || {};

    const ticker_a = md.ticker_a || '';
    const ticker_b = md.ticker_b || '';

    if (!ticker_a || !ticker_b) {
        alert('No middle opportunity selected. Open this from the Middles Scanner.');
        return;
    }
    if (pA < 1 || pA > 90 || pB < 1 || pB > 90) { alert('Prices must be 1–90¢'); return; }
    if (qty < 1) { alert('Quantity must be at least 1'); return; }

    const guaranteed   = (100 - pA - pB) * qty;
    const middleProfit = (200 - pA - pB) * qty;
    const cost         = (pA + pB) * qty;

    const legsEqual = pA === pB;
    const priceStr  = legsEqual ? `both @ ${pA}¢` : `A @ ${pA}¢ / B @ ${pB}¢`;
    const confirmMsg = `↔️ Launch Middle Bot\n\nLeg A: NO ${ticker_a} @ ${pA}¢ × ${qty}\nLeg B: NO ${ticker_b} @ ${pB}¢ × ${qty}\n\nTotal cost: $${(cost / 100).toFixed(2)}\nGuaranteed floor: ${guaranteed >= 0 ? '+' : ''}${guaranteed}¢\nMiddle profit (both win): +${middleProfit}¢\nStop-loss: ${sl > 0 ? sl + '¢ drop from fill price' : 'OFF (hold to settle)'}\n\nConfirm?`;
    if (!confirm(confirmMsg)) return;

    try {
        const payload = {
            ticker_a,
            ticker_b,
            target_price_a:  pA,
            target_price_b:  pB,
            target_price:    Math.round((pA + pB) / 2),  // legacy fallback
            qty,
            stop_loss_cents: sl,
            team_a_name:     md.team_a || md.title_a || '',
            team_b_name:     md.team_b || md.title_b || '',
            spread_a:        md.spread_a || 0,
            spread_b:        md.spread_b || 0,
            no_a_bid:        md.no_a_bid || 0,
            no_b_bid:        md.no_b_bid || 0,
            game_id:         md.game_id || '',
        };
        const resp = await fetch(`${API_BASE}/middle/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`↔️ Middle Bot launched! A @ ${pA}¢ + B @ ${pB}¢ — floor ${guaranteed >= 0 ? '+' : ''}${guaranteed}¢`);
            closeModal();
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            alert(`Middle bot error: ${data.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert(`Network error: ${err.message}`);
    }
}

// ─── Upgrade #6: P&L Dashboard ────────────────────────────────────────────────

function _buildAnchoredBadgeHTML() {
    if (_botsActive === 0) return '';
    const h = _botHealth;
    // Left group: bot counts
    const leftParts = [];
    // Show "X/Y filling" when there are one-leg-filled bots
    if (_botsAnchored > 0) {
        leftParts.push(`<span style="color:#00aaff;font-weight:700;">⚡ ${_botsAnchored}/${_botsActive} filling</span>`);
    } else if (h.waiting > 0) {
        leftParts.push(`<span style="color:#8892a6;font-weight:700;">⏳ ${h.waiting} waiting</span>`);
    }
    const dot = `<span style="color:#555;margin:0 3px;">·</span>`;
    const leftStr = leftParts.join(dot);
    // Right group: health statuses (only relevant to anchored bots)
    const healthParts = [];
    if (h.healthy  > 0) healthParts.push(`<span style="color:#00ff88;font-weight:700;">💚 ${h.healthy}</span>`);
    if (h.safe     > 0) healthParts.push(`<span style="color:#00ff88;font-weight:700;">🛡 ${h.safe}</span>`);
    if (h.holding  > 0) healthParts.push(`<span style="color:#00aaff;font-weight:700;">🔵 ${h.holding}</span>`);
    if (h.dropping > 0) healthParts.push(`<span style="color:#ffaa00;font-weight:700;">🟡 ${h.dropping}</span>`);
    if (h.warning  > 0) healthParts.push(`<span style="color:#ff8800;font-weight:700;">🟠 ${h.warning}</span>`);
    if (h.danger   > 0) healthParts.push(`<span style="color:#ff4444;font-weight:700;">🔴 ${h.danger}</span>`);
    const rightStr = healthParts.join(' ');
    const sep = leftStr && rightStr ? `<span style="color:#555;margin:0 6px;">—</span>` : '';
    return leftStr + sep + rightStr;
}

async function loadPnL() {
    try {
        const resp = await fetch(`${API_BASE}/pnl`);
        const pnl  = await resp.json();
        window._lastPnlData = pnl;  // cache for _renderPnlDisplay / setBotsTab
        _renderPnlDisplay(botsTabMode);
        // Feed P&L data to bot buddy
        buddyUpdateFromPnl(pnl);
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

// ─── Trade History & Analytics ─────────────────────────────────────────────────
function toggleTradeHistory() {
    switchTab('history');
}

async function loadHistoryStats() {
    const panel = document.getElementById('history-stats-panel');
    const widthPanel = document.getElementById('width-breakdown-panel');
    if (!panel) return;
    try {
        const dateParam = selectedHistoryDay ? `?date=${selectedHistoryDay}` : '';
        const [statsResp, pnlResp] = await Promise.all([
            fetch(`${API_BASE}/bot/history/stats${dateParam}`),
            fetch(`${API_BASE}/pnl`),
        ]);
        const s = await statsResp.json();
        const pnl = await pnlResp.json();

        if (s.arb_total === 0 && s.watch_total === 0) {
            panel.innerHTML = '<p style="color:#555;text-align:center;font-size:12px;">No trades yet — analytics will appear after your first trade.</p>';
            if (widthPanel) widthPanel.innerHTML = '';
            return;
        }

        const fillRate = s.arb_fill_rate || 0;
        const fillColor = fillRate >= 50 ? '#00ff88' : fillRate >= 25 ? '#ffaa00' : '#ff4444';
        const netColor = s.arb_net_cents >= 0 ? '#00ff88' : '#ff4444';
        const netDollars = (s.arb_net_cents / 100).toFixed(2);

        // Format duration
        const fmtDur = (secs) => {
            if (secs === null || secs === undefined) return '—';
            if (secs < 60) return `${secs}s`;
            if (secs < 3600) return `${Math.floor(secs/60)}m ${secs%60}s`;
            return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
        };

        // ── Result breakdown counts ──
        const rb = s.result_breakdown || {};
        const completedN   = rb.completed || 0;
        const timeoutN     = (rb.timeout_exit_yes || 0) + (rb.timeout_exit_no || 0);
        const flipN        = (rb.flip_yes || 0) + (rb.flip_no || 0);  // legacy
        const oldSlN       = (rb.stop_loss_yes || 0) + (rb.stop_loss_no || 0);  // legacy
        const settledWinN  = (rb.settled_win_yes || 0) + (rb.settled_win_no || 0);
        const settledLossN = (rb.settled_loss_yes || 0) + (rb.settled_loss_no || 0);
        const forceExitN   = (rb.force_exit_yes || 0) + (rb.force_exit_no || 0);
        const totalResults = completedN + timeoutN + flipN + oldSlN + settledWinN + settledLossN + forceExitN;

        // Main stats grid
        panel.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Fill Rate</div>
                    <div style="color:${fillColor};font-size:24px;font-weight:800;">${fillRate}%</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">${s.arb_wins}W / ${s.arb_losses}L of ${s.arb_total}</div>
                </div>
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${selectedHistoryDay ? `📅 ${selectedHistoryDay}` : 'Lifetime P&L'}</div>
                    <div style="color:${netColor};font-size:24px;font-weight:800;">${s.arb_net_cents >= 0 ? '+' : ''}$${netDollars}</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">Win: +${s.arb_avg_profit}¢ / Loss: -${s.arb_avg_loss}¢</div>
                </div>
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Fill Time</div>
                    <div style="color:#fff;font-size:24px;font-weight:800;">${fmtDur(s.avg_fill_duration_s)}</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">Win: ${fmtDur(s.avg_win_duration_s)} / Loss: ${fmtDur(s.avg_loss_duration_s)}</div>
                </div>
                ${(() => {
                    const dNet = (pnl.arb_net_cents || 0);
                    const dColor = dNet >= 0 ? '#00ff88' : '#ff4444';
                    const dDollars = (dNet / 100).toFixed(2);
                    const dW = pnl.arb_wins || 0;
                    const dL = pnl.arb_losses || 0;
                    return `<div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Daily P&L <span style="font-size:8px;color:#555;">${pnl.day_key || ''}</span></div>
                        <div style="color:${dColor};font-size:24px;font-weight:800;">${dNet >= 0 ? '+' : ''}$${dDollars}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${dW}W / ${dL}L today (arb bots)</div>
                    </div>`;
                })()}
            </div>

            <!-- Result breakdown + Completed + Flip analysis -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:16px;">
                <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;font-weight:600;">📊 How Trades End</div>
                    ${totalResults > 0 ? `
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        ${completedN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#00ff88;font-size:11px;">✅ Completed (both filled)</span>
                            <span style="color:#00ff88;font-weight:700;font-size:12px;">${completedN} <span style="color:#555;font-weight:400;">(${Math.round(completedN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${timeoutN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff8800;font-size:11px;">⏱ Timeout exit</span>
                            <span style="color:#ff8800;font-weight:700;font-size:12px;">${timeoutN} <span style="color:#555;font-weight:400;">(${Math.round(timeoutN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${flipN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff6666;font-size:11px;">🔄 Flip triggered (legacy)</span>
                            <span style="color:#ff6666;font-weight:700;font-size:12px;">${flipN} <span style="color:#555;font-weight:400;">(${Math.round(flipN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${oldSlN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff4444;font-size:11px;">⛔ Old stop-loss (legacy)</span>
                            <span style="color:#ff4444;font-weight:700;font-size:12px;">${oldSlN} <span style="color:#555;font-weight:400;">(${Math.round(oldSlN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${settledWinN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#00ddff;font-size:11px;">🏆 Settled win (1 leg)</span>
                            <span style="color:#00ddff;font-weight:700;font-size:12px;">${settledWinN} <span style="color:#555;font-weight:400;">(${Math.round(settledWinN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${settledLossN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ffaa00;font-size:11px;">🏁 Settled loss (1 leg)</span>
                            <span style="color:#ffaa00;font-weight:700;font-size:12px;">${settledLossN} <span style="color:#555;font-weight:400;">(${Math.round(settledLossN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${forceExitN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff4444;font-size:11px;">🔴 Force exit (sell failed)</span>
                            <span style="color:#ff4444;font-weight:700;font-size:12px;">${forceExitN}</span>
                        </div>` : ''}
                    </div>` : '<div style="color:#555;font-size:11px;">No data yet</div>'}
                </div>
                <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;font-weight:600;">� Completed Arbs</div>
                    ${(() => {
                        const cs = s.completed_stats || {};
                        if (!cs.total) return '<div style="color:#555;font-size:11px;">No completed arbs yet</div>';
                        return `
                        <div style="display:flex;flex-direction:column;gap:6px;">
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Total profit</span>
                                <span style="color:#00ff88;font-weight:700;font-size:12px;">+${cs.total_profit_cents}¢ ($${(cs.total_profit_cents/100).toFixed(2)})</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Avg profit/trade</span>
                                <span style="color:#00ff88;font-weight:700;font-size:12px;">+${cs.avg_profit_cents}¢</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Avg per contract</span>
                                <span style="color:#00ddff;font-weight:700;font-size:12px;">${cs.avg_per_contract}¢</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Best / Worst trade</span>
                                <span style="color:#fff;font-weight:700;font-size:12px;">+${cs.max_profit_cents}¢ / +${cs.min_profit_cents}¢</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Contracts filled</span>
                                <span style="color:#fff;font-weight:700;font-size:12px;">${cs.total_contracts} (avg ${cs.avg_quantity})</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Best width</span>
                                <span style="color:#00ff88;font-weight:700;font-size:12px;">W=${cs.best_width} (+${cs.best_width_profit}¢)</span>
                            </div>
                        </div>`;
                    })()}
                </div>
                <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;font-weight:600;">⏱ Timeout Exits</div>
                    ${timeoutN > 0 ? (() => {
                        const tx = s.timeout_stats || {};
                        const txProfit = tx.total_profit_cents || 0;
                        const txLoss   = tx.total_loss_cents   || 0;
                        const txNet    = tx.net_cents != null ? tx.net_cents : (txProfit - txLoss);
                        const txNetColor = txNet >= 0 ? '#00ff88' : '#ff4444';
                        const txYes = tx.yes_n ?? (rb.timeout_exit_yes || 0);
                        const txNo  = tx.no_n  ?? (rb.timeout_exit_no  || 0);
                        return `<div style="display:flex;flex-direction:column;gap:5px;">
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Total exits</span>
                                <span style="color:#ff8800;font-weight:700;font-size:12px;">${timeoutN}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">YES exits / NO exits</span>
                                <span style="color:#fff;font-weight:700;font-size:12px;">${txYes} / ${txNo}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Net P&L on exits</span>
                                <span style="color:${txNetColor};font-weight:700;font-size:12px;">${txNet >= 0 ? '+' : ''}${txNet}¢</span>
                            </div>
                            <div style="margin-top:4px;padding-top:4px;border-top:1px solid #1e2740;color:#555;font-size:9px;">
                                Exit = cancel pending leg + sell filled leg at market. May be profit or loss depending on where market moved.
                            </div>
                        </div>`;
                    })() : '<div style="color:#00ff88;font-size:11px;">✅ No timeout exits — all bots completed cleanly</div>'}
                    ${flipN > 0 ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e2740;color:#555;font-size:9px;">
                        📜 Legacy: ${flipN} flip exits from old fav-first system. These used the entry-15¢ stop-loss mechanism.
                    </div>` : ''}
                </div>
            </div>

            <!-- Phase / Quarter / Margin breakdown row -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:16px;">
                ${_renderMiniBreakdown('By Phase', s.phase_stats, {'pregame': 'Pregame', 'live': 'Live'})}
                ${_renderMiniBreakdown('By Quarter', s.quarter_stats, null)}
                ${_renderMiniBreakdown('By Score Margin', s.margin_stats, [['close_0_5','0-5 pts'],['mid_6_15','6-15 pts'],['blowout_16plus','16+ pts']])}
                ${_renderMiniBreakdown('First Leg', s.first_leg_stats, {'yes': 'YES first', 'no': 'NO first'})}
            </div>
        `;

        // ── Width Performance Table (with breakeven %) ──
        if (widthPanel && s.width_breakdown && s.width_breakdown.length > 0) {
            const rows = s.width_breakdown.map(w => {
                const actBe = w.breakeven_pct;
                const fr    = w.fill_rate;
                const edge  = w.edge;
                // Both fill rate and BE% colored by edge: positive = green, close = yellow, negative = red
                const frColor = edge >= 5 ? '#00ff88' : edge >= -5 ? '#ffaa00' : '#ff4444';
                const beColor = edge >= 5 ? '#00ff88' : edge >= -5 ? '#ffaa00' : '#ff4444';
                const nColor = w.net_cents >= 0 ? '#00ff88' : '#ff4444';
                const edgeColor = w.edge >= 0 ? '#00ff88' : '#ff4444';
                const edgeIcon = w.edge >= 5 ? '🟢' : w.edge >= 0 ? '🟡' : '🔴';
                const settledInfo = w.settled_losses > 0 ? `<span style="color:#ffaa00;font-size:9px;"> (${w.settled_losses} settled)</span>` : '';
                const ftSecs = w.avg_fill_duration_s;
                const ftColor = ftSecs === null ? '#555' : ftSecs < 300 ? '#00ff88' : ftSecs < 900 ? '#ffaa00' : '#ff4444';
                return `<tr style="border-bottom:1px solid #1e274033;">
                    <td style="padding:6px 10px;color:#fff;font-weight:700;">${w.width}¢</td>
                    <td style="padding:6px 10px;color:${frColor};font-weight:700;">${w.fill_rate}%</td>
                    <td style="padding:6px 10px;color:${beColor};font-weight:600;">${w.breakeven_pct}%</td>
                    <td style="padding:6px 10px;color:${edgeColor};font-weight:700;">${edgeIcon} ${w.edge >= 0 ? '+' : ''}${w.edge}%</td>
                    <td style="padding:6px 10px;"><span style="color:#00ff88;font-weight:700;">${w.wins}W</span> / <span style="color:#ff4444;font-weight:700;">${w.losses}L</span>${settledInfo}</td>
                    <td style="padding:6px 10px;color:${nColor};font-weight:700;">${w.net_cents >= 0 ? '+' : ''}${w.net_cents}¢</td>
                    <td style="padding:6px 10px;font-size:10px;"><span style="color:#00ff88;">+${w.avg_profit_cents}¢</span> / <span style="color:#ff6666;">-${w.avg_loss_cents}¢</span></td>
                    <td style="padding:6px 10px;color:${ftColor};font-weight:600;">${ftSecs !== null ? fmtDur(ftSecs) : '—'}</td>
                </tr>`;
            }).join('');
            widthPanel.innerHTML = `
                <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;font-weight:600;">🎯 Width Performance — Fill Rate vs Breakeven</div>
                    <div style="color:#555;font-size:10px;margin-bottom:10px;">BE% = avg loss ÷ (avg loss + avg profit). Fill rate must beat BE% to profit. Edge = Fill Rate − BE%.</div>
                    <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:500px;">
                        <tr style="border-bottom:1px solid #1e2740;">
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Width</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Fill Rate</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">BE%</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Edge</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Record</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Net</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Avg W/L</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Fill Time</th>
                        </tr>
                        ${rows}
                    </table>
                    </div>
                </div>
            `;
        } else if (widthPanel) {
            widthPanel.innerHTML = '';
        }

        // ── Sport breakdown panel ──
        const sportPanel = document.getElementById('sport-breakdown-panel');
        if (sportPanel) {
            const sportPnl = pnl.sport_pnl || {};
            const entries = Object.entries(sportPnl).sort((a, b) => b[1] - a[1]);
            if (entries.length > 0) {
                const cells = entries.map(([sport, val]) => {
                    const col = val >= 0 ? '#00ff88' : '#ff4444';
                    return `<div style="background:#0f1419;border-radius:8px;padding:12px 16px;border:1px solid #1e2740;text-align:center;min-width:90px;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${sport}</div>
                        <div style="color:${col};font-size:18px;font-weight:800;">${val >= 0 ? '+' : ''}$${val.toFixed(2)}</div>
                    </div>`;
                }).join('');
                sportPanel.innerHTML = `
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:8px;">By Sport (Today)</div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">${cells}</div>`;
            } else {
                sportPanel.innerHTML = '';
            }
        }

    } catch (err) {
        panel.innerHTML = `<p style="color:#ff4444;font-size:11px;">Stats unavailable: ${err.message}</p>`;
    }
}

function _renderMiniBreakdown(title, stats, labelMap) {
    if (!stats || Object.keys(stats).length === 0) return '';
    // labelMap can be an object {key: label} or an array [[key, label], ...] for guaranteed ordering
    const orderedEntries = Array.isArray(labelMap)
        ? labelMap.map(([k, label]) => [k, stats[k]]).filter(([_, v]) => v && v.wins + v.losses > 0)
        : Object.entries(stats).filter(([_, v]) => v.wins + v.losses > 0);
    const items = orderedEntries
        .map(([k, v]) => {
            const total = v.wins + v.losses;
            const rate = total > 0 ? Math.round(v.wins / total * 100) : 0;
            const label = Array.isArray(labelMap) ? (labelMap.find(([key]) => key === k)?.[1] || k) : (labelMap ? (labelMap[k] || k) : k);
            const color = rate >= 50 ? '#00ff88' : rate >= 25 ? '#ffaa00' : '#ff4444';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;">
                <span style="color:#8892a6;font-size:11px;">${label}</span>
                <span style="color:${color};font-size:11px;font-weight:700;">${rate}% <span style="color:#555;font-weight:400;">(${v.wins}W/${v.losses}L)</span></span>
            </div>`;
        }).join('');
    if (!items) return '';
    return `<div style="background:#0f1419;border-radius:8px;padding:12px;border:1px solid #1e2740;">
        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;font-weight:600;">${title}</div>
        ${items}
    </div>`;
}

// ─── P&L Calendar (OddsJam-style) ──────────────────────────────────────────────
let calendarViewDate = new Date(); // tracks which month is displayed
let selectedHistoryDay = null;     // YYYY-MM-DD string, null = full history
let historyViewMode = 'arb';  // 'arb' | 'bets' | 'instarb' | 'middle'

const HIST_MODES = {
    arb:     { btn: 'histmode-arb',     sec: 'hist-arb-section',     color: '#00ff88' },
    bets:    { btn: 'histmode-bets',    sec: 'hist-bets-section',    color: '#ffaa00' },
    instarb: { btn: 'histmode-instarb', sec: 'hist-instarb-section', color: '#00ff88' },
    middle:  { btn: 'histmode-middle',  sec: 'hist-middle-section',  color: '#aa66ff' },
};

function setHistoryMode(mode) {
    historyViewMode = mode;
    for (const [m, cfg] of Object.entries(HIST_MODES)) {
        const btn = document.getElementById(cfg.btn);
        const sec = document.getElementById(cfg.sec);
        const active = (m === mode);
        if (btn) { btn.style.background = active ? '#253555' : '#1a2540'; btn.style.color = active ? cfg.color : '#8892a6'; }
        if (sec) sec.style.display = active ? '' : 'none';
    }
    if (mode === 'arb')     { loadHistoryStats(); loadPnLCalendar(); loadTradeHistoryList(); }
    if (mode === 'bets')    { loadBetsHistory(); }
    if (mode === 'instarb') { loadInstaArbHistory(); }
    if (mode === 'middle')  { loadMiddleHistory(); }
}

async function loadPnLCalendar() {
    const panel = document.getElementById('pnl-calendar-panel');
    if (!panel) return;
    try {
        const resp = await fetch(`${API_BASE}/pnl/calendar`);
        const data = await resp.json();
        const days = data.days || [];
        renderPnLCalendar(panel, days);
    } catch (e) {
        panel.innerHTML = '';
    }
}

function renderPnLCalendar(panel, days) {
    // Build lookup: date string → day data
    const dayMap = {};
    let lifetimeNet = 0;
    for (const d of days) {
        dayMap[d.date] = d;
        lifetimeNet += d.net_cents || 0;
    }

    const now = calendarViewDate;
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    // First day of month and total days
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Month P&L
    let monthNet = 0;
    let monthWins = 0;
    let monthLosses = 0;
    let monthTrades = 0;
    for (let d = 1; d <= totalDays; d++) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (dayMap[key]) {
            monthNet += dayMap[key].net_cents || 0;
            monthWins += dayMap[key].wins || 0;
            monthLosses += dayMap[key].losses || 0;
            monthTrades += dayMap[key].trades || 0;
        }
    }
    const monthColor = monthNet >= 0 ? '#00ff88' : '#ff4444';
    const ltColor = lifetimeNet >= 0 ? '#00ff88' : '#ff4444';

    // Day cells
    let cellsHtml = '';
    // Weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const wd of weekdays) {
        cellsHtml += `<div style="text-align:center;color:#555;font-size:9px;font-weight:600;padding:4px 0;text-transform:uppercase;">${wd}</div>`;
    }
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        cellsHtml += `<div></div>`;
    }
    // Day cells
    for (let d = 1; d <= totalDays; d++) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = dayMap[key];
        const isToday = key === todayStr;
        const isFuture = new Date(key) > today;

        let bg = '#0a0e1a';
        let border = '#1e2740';
        let content = `<span style="color:#333;font-size:10px;">${d}</span>`;

        if (dayData) {
            const nc = dayData.net_cents;
            if (nc > 0) {
                // Green intensity based on profit
                const intensity = Math.min(1, Math.abs(nc) / 500);
                bg = `rgba(0, 255, 136, ${0.08 + intensity * 0.2})`;
                border = `rgba(0, 255, 136, ${0.3 + intensity * 0.3})`;
            } else if (nc < 0) {
                const intensity = Math.min(1, Math.abs(nc) / 500);
                bg = `rgba(255, 68, 68, ${0.08 + intensity * 0.2})`;
                border = `rgba(255, 68, 68, ${0.3 + intensity * 0.3})`;
            } else {
                bg = '#111827';
                border = '#2a3550';
            }
            const color = nc >= 0 ? '#00ff88' : '#ff4444';
            const dollars = (nc / 100).toFixed(2);
            content = `
                <span style="color:#8892a6;font-size:9px;">${d}</span>
                <span style="color:${color};font-size:11px;font-weight:800;">${nc >= 0 ? '+' : ''}$${dollars}</span>
                <span style="color:#555;font-size:8px;">${dayData.wins}W/${dayData.losses}L</span>
            `;
        } else if (isFuture) {
            bg = 'transparent';
            border = '#111';
            content = `<span style="color:#222;font-size:10px;">${d}</span>`;
        }

        const isSelected = key === selectedHistoryDay;
        const todayRing = isSelected
            ? 'box-shadow:0 0 0 2px #ffaa00;'
            : isToday ? 'box-shadow:0 0 0 2px #00aaff;' : '';
        const clickable = (dayData || isToday) && !isFuture;
        const cursor = clickable ? 'cursor:pointer;' : '';
        cellsHtml += `<div onclick="${clickable ? `selectHistoryDay('${key}')` : ''}" style="background:${bg};border:1px solid ${border};border-radius:6px;padding:4px 2px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;${todayRing}${cursor}" title="${key}">${content}</div>`;
    }

    const filterBanner = selectedHistoryDay
        ? `<div style="display:flex;align-items:center;justify-content:space-between;background:#ffaa0022;border:1px solid #ffaa0066;border-radius:6px;padding:6px 10px;margin-bottom:10px;font-size:11px;">
               <span style="color:#ffaa00;font-weight:700;">📅 Filtered: ${selectedHistoryDay}</span>
               <button onclick="selectHistoryDay(null)" style="background:none;border:none;color:#ffaa00;cursor:pointer;font-size:12px;font-weight:700;padding:0 4px;">✕ Clear</button>
           </div>`
        : '';

    panel.innerHTML = `
        <div style="background:#0d1120;border:1px solid #1e2740;border-radius:12px;padding:16px;">
            ${filterBanner}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <button onclick="calendarPrevMonth()" style="background:none;border:1px solid #2a3550;color:#8892a6;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;">‹</button>
                <div style="text-align:center;">
                    <div style="color:#fff;font-weight:700;font-size:14px;">📅 ${monthName}</div>
                    <div style="display:flex;gap:16px;justify-content:center;margin-top:4px;">
                        <span style="color:${monthColor};font-size:12px;font-weight:700;">${monthNet >= 0 ? '+' : ''}$${(monthNet / 100).toFixed(2)}</span>
                        <span style="color:#555;font-size:11px;">${monthTrades} trades</span>
                        <span style="color:#555;font-size:11px;">${monthWins}W/${monthLosses}L</span>
                    </div>
                </div>
                <button onclick="calendarNextMonth()" style="background:none;border:1px solid #2a3550;color:#8892a6;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;">›</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">
                ${cellsHtml}
            </div>
        </div>
    `;
}

function selectHistoryDay(dateStr) {
    // Toggle: clicking same day deselects, clicking null clears
    selectedHistoryDay = (dateStr && dateStr !== selectedHistoryDay) ? dateStr : null;
    loadPnLCalendar();
    loadHistoryStats();
    loadTradeHistoryList();
}

function calendarPrevMonth() {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    loadPnLCalendar();
}

function calendarNextMonth() {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    loadPnLCalendar();
}

async function loadTradeHistoryList() {
    const el = document.getElementById('trade-history-list');
    if (!el) return;
    try {
        const dateParam = selectedHistoryDay ? `&date=${selectedHistoryDay}` : '';
        const resp = await fetch(`${API_BASE}/bot/history?limit=200${dateParam}`);
        const data = await resp.json();
        let trades = (data.trades || []).filter(t => t.type !== 'watch' && t.type !== 'middle');
        trades = trades.slice(0, 50);

        // Clear button at top
        let clearBtn = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <button onclick="clearTradeHistory()" style="background:#2a1a1a;border:1px solid #ff4444;color:#ff4444;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">Clear History</button>
        </div>`;
        
        if (trades.length === 0) {
            el.innerHTML = clearBtn + '<p style="color:#555;text-align:center;">No completed or stopped trades yet.</p>';
            return;
        }
        
        const rows = trades.map(t => {
            // Date & time
            const dt = new Date(t.timestamp * 1000);
            const date = dt.toLocaleDateString([], {month:'short', day:'numeric'});
            const time = dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            // Placed-at time
            const placedDt = t.placed_at ? new Date(t.placed_at * 1000) : null;
            const placedTime = placedDt ? placedDt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            
            // Result styling
            const isWin = t.result === 'completed' || t.result === 'take_profit_watch'
                         || t.result === 'settled_win_yes' || t.result === 'settled_win_no'
                         || t.result === 'manual_exit_completed';
            const isSL = t.result?.includes('stop_loss') || t.result?.includes('flip_');
            const isSettledWin = t.result === 'settled_win_yes' || t.result === 'settled_win_no';
            const isSettledLoss = t.result === 'settled_loss_yes' || t.result === 'settled_loss_no';
            const isManualExit = t.result?.startsWith('manual_exit');
            const isTimeoutExit = t.result === 'timeout_exit_yes' || t.result === 'timeout_exit_no';
            // Timeout exits can be profitable — use profit_cents - loss_cents for net P&L
            // Manual single-leg exits store raw profit_cents (may be negative); other non-wins use loss_cents
            const pnl = isWin ? (t.profit_cents || 0)
                      : isTimeoutExit ? ((t.profit_cents || 0) - (t.loss_cents || 0))
                      : (isManualExit && !t.loss_cents) ? (t.profit_cents || 0)
                      : -(t.loss_cents || 0);
            const isSettled = isSettledWin || isSettledLoss;
            const pnlColor = isSettledWin ? '#00e5ff' : (isSettledLoss ? '#ff8800' : (pnl >= 0 ? '#00ff88' : '#ff4444'));
            const icon = isSettledWin ? '🏆' : (isSettledLoss ? '🏁' : (isWin ? '✅' : (isTimeoutExit ? '⏱' : (isManualExit ? '🔧' : '⛔'))));
            const isFlip = t.result?.includes('flip_');
            const resultLabel = isSettledWin ? 'SETTLED WIN' : (isSettledLoss ? 'SETTLED LOSS' : (isTimeoutExit ? 'TIMEOUT EXIT' : (isManualExit ? 'MANUAL EXIT' : (isWin ? 'FILLED' : (isFlip ? 'FLIPPED' : (isSL ? 'STOP LOSS' : 'STOPPED'))))));
            const borderColor = isSettledWin ? '#00e5ff33' : (isSettledLoss ? '#ff880033' : (isWin ? '#00ff8822' : '#ff444422'));
            const settleBadge = isSettled ? `<span style="background:${isSettledWin ? '#00e5ff22' : '#ff880022'};color:${isSettledWin ? '#00e5ff' : '#ff8800'};padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">⚖️ SETTLEMENT</span>` : '';
            
            // Display name
            const teamName = formatBotDisplayName(t.ticker || '', t.spread_line || '');
            
            // Verified badge
            const verified = t.verified_prices || t.verified_cleared ? '<span style="color:#00ff88;font-size:9px;margin-left:4px;">✓ verified</span>' : '';
            
            // Trade type
            const tradeType = t.type === 'watch' ? 'WATCH' : 'ARB';
            const typeColor = t.type === 'watch' ? '#ffaa00' : '#00aaff';

            // ─── New analytics fields ───
            const width = t.arb_width || 0;
            const firstLeg = t.first_leg || '';
            const fillDur = t.fill_duration_s;
            const phase = t.game_phase || '';
            const slSetting = t.stop_loss_cents || 0;
            const gc = t.game_context || {};

            // Format fill duration
            let durStr = '';
            if (fillDur !== null && fillDur !== undefined) {
                if (fillDur < 60) durStr = `${fillDur}s`;
                else if (fillDur < 3600) durStr = `${Math.floor(fillDur/60)}m${fillDur%60}s`;
                else durStr = `${Math.floor(fillDur/3600)}h${Math.floor((fillDur%3600)/60)}m`;
            }

            // Game context badge
            let gameCtxHtml = '';
            if (gc.period) {
                const qLabel = gc.period <= 4 ? `Q${gc.period}` : 'OT';
                gameCtxHtml += `<span style="background:#1e274022;color:#8892a6;padding:1px 5px;border-radius:3px;font-size:9px;">${qLabel}${gc.clock ? ' ' + gc.clock : ''}</span>`;
            }
            if (gc.score_diff !== undefined && gc.score_diff >= 0) {
                const diffColor = gc.score_diff <= 5 ? '#00ff88' : gc.score_diff <= 15 ? '#ffaa00' : '#ff4444';
                gameCtxHtml += `<span style="background:#1e274022;color:${diffColor};padding:1px 5px;border-radius:3px;font-size:9px;" title="Score differential at close">Diff: ±${gc.score_diff}</span>`;
            }

            // Cycle info for repeat bots in history
            const histRepeatsDone = t.repeats_done || 0;
            const histRepeatCount = t.repeat_count || 0;
            const histTotalRuns = histRepeatCount + 1;
            let histCycleHtml = '';
            if (histTotalRuns > 1) {
                histCycleHtml = `<span style="background:#6366f122;color:#818cf8;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">Run ${Math.min(histRepeatsDone + 1, histTotalRuns)}/${histTotalRuns}</span>`;
            }

            // Kalshi market link
            const tickerParts = (t.ticker || '').split('-');
            const kalshiMarketUrl = t.ticker ? `https://kalshi.com/markets/${tickerParts[0]}/${t.ticker}` : '';

            // Analytics detail row (arb + watch trades)
            let analyticsRow = '';
            if (t.type === 'watch') {
                const wParts = [];
                if (t.side) wParts.push(`<span style="color:#8892a6;">Side: <strong style="color:${t.side==='yes'?'#00ff88':'#ff4444'};">${t.side.toUpperCase()}</strong></span>`);
                if (slSetting) wParts.push(`<span style="color:#8892a6;">SL: <strong style="color:#ff4444;">${slSetting}¢</strong></span>`);
                if (t.take_profit_cents) wParts.push(`<span style="color:#8892a6;">TP: <strong style="color:#00ff88;">${t.take_profit_cents}¢</strong></span>`);
                if (phase) wParts.push(`<span style="background:${phase === 'live' ? '#00ff8822' : '#8892a622'};color:${phase === 'live' ? '#00ff88' : '#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${phase.toUpperCase()}</span>`);
                if (wParts.length > 0) analyticsRow = `<div style="display:flex;gap:12px;font-size:10px;margin-top:4px;flex-wrap:wrap;">${wParts.join('')}</div>`;
            } else if (width || firstLeg || durStr || phase) {
                const parts = [];
                if (width) parts.push(`<span style="color:#8892a6;">Width: <strong style="color:#00aaff;">${width}¢</strong></span>`);
                if (firstLeg) parts.push(`<span style="color:#8892a6;">1st: <strong style="color:#fff;">${firstLeg.toUpperCase()}</strong></span>`);
                if (durStr) parts.push(`<span style="color:#8892a6;">Fill: <strong style="color:#fff;">${durStr}</strong></span>`);
                if (t.result === 'timeout_exit_yes' || t.result === 'timeout_exit_no') {
                    const leg = t.result === 'timeout_exit_yes' ? 'YES' : 'NO';
                    const tMin = t.timeout_min || (leg === 'YES' ? (t.yes_price >= t.no_price ? 20 : 10) : (t.no_price >= t.yes_price ? 20 : 10));
                    const tLabel = tMin === 20 ? `${tMin}m (fav filled)` : `${tMin}m (dog filled)`;
                    parts.push(`<span style="color:#8892a6;">Exit: <strong style="color:#ffaa00;">⏱ ${tLabel} (${leg})</strong></span>`);
                } else if (slSetting) parts.push(`<span style="color:#8892a6;">SL: <strong style="color:#ff4444;">${slSetting}¢</strong></span>`);
                if (phase) parts.push(`<span style="background:${phase === 'live' ? '#00ff8822' : '#8892a622'};color:${phase === 'live' ? '#00ff88' : '#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${phase.toUpperCase()}</span>`);
                analyticsRow = `<div style="display:flex;gap:12px;font-size:10px;margin-top:4px;flex-wrap:wrap;">${parts.join('')}</div>`;
            }
            
            return `
                <div style="background:#0f1419;border:1px solid ${borderColor};border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                            <span style="font-size:14px;">${icon}</span>
                            <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                            <span style="background:${typeColor}22;color:${typeColor};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${tradeType}</span>
                            ${settleBadge}
                            ${gameCtxHtml}
                            ${histCycleHtml}
                            ${verified}
                        </div>
                        <div style="color:#555;font-size:10px;margin-bottom:4px;">${kalshiMarketUrl ? `<a href="${kalshiMarketUrl}" target="_blank" style="color:#555;text-decoration:none;" title="Open on Kalshi">${t.ticker || ''}</a>` : (t.ticker || '')}</div>
                        <div style="display:flex;gap:12px;font-size:11px;">
                            <span style="color:#8892a6;">Placed: <strong style="color:#aaa;">${placedTime || '—'}</strong></span>
                            <span style="color:#8892a6;">Closed: <strong style="color:#aaa;">${time}</strong></span>
                            <span style="color:#8892a6;">${date}</span>
                        </div>
                        <div style="display:flex;gap:12px;font-size:11px;margin-top:4px;flex-wrap:wrap;">
                            ${t.type === 'watch' && t.entry_price ? `<span style="color:${(t.side||'yes')==='yes'?'#00ff88':'#ff4444'};">${(t.side||'YES').toUpperCase()} Entry ${t.entry_price}¢</span>` : ''}
                            ${t.type !== 'watch' && t.yes_price ? `<span style="color:#00ff88;">YES ${t.yes_price}¢</span>` : ''}
                            ${t.type !== 'watch' && t.no_price ? `<span style="color:#ff4444;">NO ${t.no_price}¢</span>` : ''}
                            ${t.exit_bid ? `<span style="color:#ffaa00;">Exit ${t.exit_bid}¢</span>` : ''}
                            <span style="color:#8892a6;">×${t.quantity || 1}</span>
                            ${t.type !== 'watch' ? `<span style="color:#555;">Cost $${(((t.yes_price||0) + (t.no_price||0)) * (t.quantity||1) / 100).toFixed(2)}</span>` : `<span style="color:#555;">Cost $${((t.entry_price||0) * (t.quantity||1) / 100).toFixed(2)}</span>`}
                        </div>
                        ${analyticsRow}
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

async function loadTradeHistory() {
    if (historyViewMode === 'bets')    { loadBetsHistory();     return; }
    if (historyViewMode === 'instarb') { loadInstaArbHistory(); return; }
    if (historyViewMode === 'middle')  { loadMiddleHistory();   return; }
    loadHistoryStats();
    loadPnLCalendar();
    loadTradeHistoryList();
}

// ── Straight Bets history ───────────────────────────────────────────────────
async function loadBetsHistory() {
    const statsEl = document.getElementById('bets-stats-panel');
    const sportEl = document.getElementById('bets-sport-panel');
    const listEl  = document.getElementById('bets-history-list');
    if (!listEl) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/history?limit=500`);
        const data = await resp.json();
        const trades = (data.trades || []).filter(t => t.type === 'watch');

        // ── Stats ──
        const WIN_R = ['take_profit_watch', 'settled_win_yes', 'settled_win_no'];
        const LOSS_R = ['stop_loss_watch', 'settled_loss_yes', 'settled_loss_no'];
        const wins   = trades.filter(t => WIN_R.includes(t.result));
        const losses = trades.filter(t => LOSS_R.includes(t.result));
        const pending = trades.filter(t => !WIN_R.includes(t.result) && !LOSS_R.includes(t.result));
        const net = trades.reduce((s,t) => s + (t.profit_cents||0) - (t.loss_cents||0), 0);
        const netCol = net >= 0 ? '#00ff88' : '#ff4444';
        const total = wins.length + losses.length;
        const winRate = total > 0 ? (wins.length / total * 100).toFixed(1) : '—';
        const winRateCol = total === 0 ? '#555' : parseFloat(winRate) >= 50 ? '#00ff88' : '#ff4444';
        const avgProfit = wins.length > 0 ? Math.round(wins.reduce((s,t) => s+(t.profit_cents||0),0) / wins.length) : 0;
        const avgLoss   = losses.length > 0 ? Math.round(losses.reduce((s,t) => s+(t.loss_cents||0),0) / losses.length) : 0;

        // Streak
        let streak = 0, streakType = '';
        const settled = trades.filter(t => WIN_R.includes(t.result) || LOSS_R.includes(t.result))
                               .sort((a,b) => b.timestamp - a.timestamp);
        if (settled.length > 0) {
            const first = WIN_R.includes(settled[0].result) ? 'W' : 'L';
            streak = 1;
            for (let i = 1; i < settled.length; i++) {
                const r = WIN_R.includes(settled[i].result) ? 'W' : 'L';
                if (r === first) streak++; else break;
            }
            streakType = first;
        }
        const streakCol = streakType === 'W' ? '#00ff88' : streakType === 'L' ? '#ff4444' : '#555';

        if (statsEl) {
            statsEl.innerHTML = trades.length === 0
                ? '<p style="color:#555;text-align:center;font-size:12px;">No straight bets recorded yet.</p>'
                : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:8px;">
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Net P&amp;L</div>
                        <div style="color:${netCol};font-size:24px;font-weight:800;">${net>=0?'+':''}$${(net/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${trades.length} bets total</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Record</div>
                        <div style="font-size:22px;font-weight:800;"><span style="color:#00ff88;">${wins.length}W</span> <span style="color:#555;font-size:16px;">/</span> <span style="color:#ff4444;">${losses.length}L</span></div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${pending.length} pending</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Win Rate</div>
                        <div style="color:${winRateCol};font-size:24px;font-weight:800;">${winRate}${winRate !== '—' ? '%' : ''}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${total} settled</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Win / Loss</div>
                        <div style="font-size:15px;font-weight:800;margin-top:4px;"><span style="color:#00ff88;">+${avgProfit}¢</span> <span style="color:#555;">/</span> <span style="color:#ff4444;">-${avgLoss}¢</span></div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${avgProfit > 0 && avgLoss > 0 ? 'BE: ' + (avgLoss/(avgLoss+avgProfit)*100).toFixed(1) + '%' : ''}</div>
                    </div>
                    ${streak > 0 ? `<div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Current Streak</div>
                        <div style="color:${streakCol};font-size:24px;font-weight:800;">${streak}${streakType}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">in a row</div>
                    </div>` : ''}
                </div>`;
        }

        // ── Sport breakdown ──
        if (sportEl) {
            const sportMap = {};
            for (const t of trades) {
                const sp = (t.sport || parseSportFromTicker(t.ticker||'')).toUpperCase() || 'OTHER';
                if (!sportMap[sp]) sportMap[sp] = {wins:0, losses:0, net:0};
                const isW = WIN_R.includes(t.result);
                const isL = LOSS_R.includes(t.result);
                if (isW) sportMap[sp].wins++;
                if (isL) sportMap[sp].losses++;
                sportMap[sp].net += (t.profit_cents||0) - (t.loss_cents||0);
            }
            const sportEntries = Object.entries(sportMap).sort((a,b) => Math.abs(b[1].net) - Math.abs(a[1].net));
            if (sportEntries.length > 0) {
                sportEl.innerHTML = `<div style="margin-bottom:8px;color:#8892a6;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">By Sport</div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">${sportEntries.map(([sp, s]) => {
                        const c = s.net >= 0 ? '#00ff88' : '#ff4444';
                        return `<div style="background:#0f1419;border-radius:8px;padding:10px 14px;border:1px solid #1e2740;min-width:90px;text-align:center;">
                            <div style="color:#8892a6;font-size:10px;font-weight:700;text-transform:uppercase;">${sp}</div>
                            <div style="color:${c};font-size:16px;font-weight:800;margin-top:4px;">${s.net>=0?'+':''}$${(s.net/100).toFixed(2)}</div>
                            <div style="color:#555;font-size:10px;">${s.wins}W-${s.losses}L</div>
                        </div>`;
                    }).join('')}</div>`;
            } else {
                sportEl.innerHTML = '';
            }
        }

        if (trades.length === 0) {
            listEl.innerHTML = '<p style="color:#555;text-align:center;padding:24px;">No straight bets recorded yet. Place a bet with the Watch checkbox enabled to track it here.</p>';
            return;
        }

        listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">${trades.slice(0,100).map(t => {
            const dt = new Date(t.timestamp * 1000);
            const dateStr = dt.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const isWin  = WIN_R.includes(t.result);
            const isLoss = LOSS_R.includes(t.result);
            const isPend = !isWin && !isLoss;
            const pnl = (t.profit_cents||0) - (t.loss_cents||0);
            const pnlCol = isPend ? '#8892a6' : pnl >= 0 ? '#00ff88' : '#ff4444';
            const icon = isPend ? '⏳' : isWin ? '✅' : '⛔';
            const resLabel = isPend ? 'PENDING' : isWin ? 'WIN' : 'LOSS';
            const borderCol = isPend ? '#2a355044' : pnl >= 0 ? '#00ff8822' : '#ff444422';
            const teamName = formatBotDisplayName(t.ticker||'', t.spread_line||'');
            const sideCol = (t.side||'yes') === 'yes' ? '#00ff88' : '#ff4444';
            const phaseBadge = t.game_phase ? `<span style="background:${t.game_phase==='live'?'#00ff8822':'#8892a622'};color:${t.game_phase==='live'?'#00ff88':'#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${t.game_phase.toUpperCase()}</span>` : '';
            return `<div style="background:#0f1419;border:1px solid ${borderCol};border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="font-size:13px;">${icon}</span>
                        <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                        ${phaseBadge}
                    </div>
                    <div style="color:#555;font-size:10px;margin-bottom:4px;">${t.ticker||''}</div>
                    <div style="display:flex;gap:10px;font-size:11px;flex-wrap:wrap;">
                        <span style="color:${sideCol};font-weight:700;">${(t.side||'YES').toUpperCase()} @ ${t.entry_price||'?'}¢</span>
                        <span style="color:#8892a6;">×${t.quantity||1}</span>
                        ${t.stop_loss_cents ? `<span style="color:#ff4444;font-size:10px;">SL: ${t.stop_loss_cents}¢</span>` : ''}
                        ${t.take_profit_cents ? `<span style="color:#00ff88;font-size:10px;">TP: ${t.take_profit_cents}¢</span>` : ''}
                    </div>
                    <div style="color:#555;font-size:10px;margin-top:4px;">${dateStr}</div>
                </div>
                <div style="text-align:right;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:3px;">
                    <div style="color:${pnlCol};font-weight:800;font-size:16px;">${isPend ? '—' : (pnl>=0?'+':'') + pnl + '¢'}</div>
                    <div style="color:${pnlCol};font-size:10px;font-weight:600;">${resLabel}</div>
                </div>
            </div>`;
        }).join('')}</div>`;
    } catch (e) {
        if (listEl) listEl.innerHTML = `<p style="color:#ff4444;">Failed: ${e.message}</p>`;
    }
}

// ── Insta Arb history ───────────────────────────────────────────────────────
async function loadInstaArbHistory() {
    const statsEl = document.getElementById('instarb-stats-panel');
    const listEl  = document.getElementById('instarb-history-list');
    if (!listEl) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/history?limit=500`);
        const data = await resp.json();
        const trades = (data.trades || []).filter(t => t.type === 'insta_arb');

        const totalProfit = trades.reduce((s,t) => s + (t.profit_cents||0), 0);
        const avgWidth = trades.length > 0 ? (trades.reduce((s,t) => s+(t.arb_width||0),0) / trades.length).toFixed(1) : 0;
        const netCol = totalProfit >= 0 ? '#00ff88' : '#ff4444';

        if (statsEl) {
            statsEl.innerHTML = trades.length === 0
                ? '<p style="color:#555;text-align:center;font-size:12px;">No insta arbs recorded yet. Use "+ Log Insta Arb" to record one.</p>'
                : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Total Profit</div>
                        <div style="color:${netCol};font-size:24px;font-weight:800;">${totalProfit>=0?'+':''}$${(totalProfit/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${trades.length} arbs</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Width</div>
                        <div style="color:#00aaff;font-size:24px;font-weight:800;">${avgWidth}¢</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">per arb</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Per Arb</div>
                        <div style="color:#00ff88;font-size:24px;font-weight:800;">${trades.length > 0 ? '+' + Math.round(totalProfit/trades.length) + '¢' : '—'}</div>
                    </div>
                </div>`;
        }

        if (trades.length === 0) {
            listEl.innerHTML = '<p style="color:#555;text-align:center;padding:24px;">No insta arbs yet.</p>';
            return;
        }
        listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">${trades.slice(0,100).map(t => {
            const dt = new Date(t.timestamp * 1000);
            const dateStr = dt.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const profit = t.profit_cents || 0;
            const profitCol = profit >= 0 ? '#00ff88' : '#ff4444';
            const title = t.market_title || formatBotDisplayName(t.ticker||t.yes_ticker||'', '');
            return `<div style="background:#0f1419;border:1px solid #00ff8822;border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                <div>
                    <div style="color:#fff;font-weight:700;font-size:13px;margin-bottom:4px;">${title}</div>
                    <div style="display:flex;gap:10px;font-size:11px;flex-wrap:wrap;margin-bottom:4px;">
                        <span style="color:#00ff88;">YES ${t.yes_price||'?'}¢</span>
                        <span style="color:#ff4444;">NO ${t.no_price||'?'}¢</span>
                        <span style="color:#00aaff;font-weight:700;">Width: ${t.arb_width||'?'}¢</span>
                        <span style="color:#8892a6;">×${t.quantity||1}</span>
                    </div>
                    <div style="color:#555;font-size:10px;">${dateStr}</div>
                </div>
                <div style="text-align:right;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;gap:3px;">
                    <div style="color:${profitCol};font-weight:800;font-size:16px;">+${profit}¢</div>
                    <div style="color:${profitCol};font-size:10px;">$${(profit/100).toFixed(2)}</div>
                </div>
            </div>`;
        }).join('')}</div>`;
    } catch (e) {
        if (listEl) listEl.innerHTML = `<p style="color:#ff4444;">Failed: ${e.message}</p>`;
    }
}

// ── Middles history ─────────────────────────────────────────────────────────
async function loadMiddleHistory() {
    const statsEl = document.getElementById('middle-stats-panel');
    const listEl  = document.getElementById('middle-history-list');
    if (!listEl) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/history?limit=500`);
        const data = await resp.json();
        const trades = (data.trades || []).filter(t => t.type === 'middle');

        const settled = trades.filter(t => !!t.result);  // has a result = settled/completed
        const midHits = settled.filter(t => t.middle_hit === true);
        const arbWins = settled.filter(t => t.result === 'arb_win');
        const losses  = settled.filter(t => t.result === 'loss' || t.result === 'stopped_sl');
        const pending = trades.filter(t => !t.result);  // no result = still active/pending
        const net = trades.reduce((s,t) => s + (t.profit_cents||0) - (t.loss_cents||0), 0);
        const netCol = net >= 0 ? '#00ff88' : '#ff4444';
        const hitRate = settled.length > 0 ? (midHits.length / settled.length * 100).toFixed(0) : 0;
        // arb_width: use stored field or compute from fill prices (100 - legA - legB = guaranteed floor per contract)
        const avgWidth = settled.length > 0
            ? (settled.reduce((s,t) => {
                const w = t.arb_width != null ? t.arb_width
                    : (t.leg_a_fill_price && t.leg_b_fill_price) ? (100 - t.leg_a_fill_price - t.leg_b_fill_price) : 0;
                return s + w;
            }, 0) / settled.length).toFixed(1)
            : 0;

        if (statsEl) {
            statsEl.innerHTML = trades.length === 0
                ? '<p style="color:#555;text-align:center;font-size:12px;">No middles recorded yet. Launch a middle bot from the Middles scanner to start tracking.</p>'
                : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Net P&amp;L</div>
                        <div style="color:${netCol};font-size:24px;font-weight:800;">${net>=0?'+':''}$${(net/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${trades.length} middles</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Middle Hit Rate</div>
                        <div style="color:#aa66ff;font-size:24px;font-weight:800;">${settled.length > 0 ? hitRate + '%' : '—'}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${midHits.length} hits / ${settled.length} settled</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Results</div>
                        <div style="font-size:13px;font-weight:800;margin-top:2px;">
                            <span style="color:#aa66ff;">🎯 ${midHits.length}</span>
                            <span style="color:#00ff88;margin-left:6px;">✅ ${arbWins.length}</span>
                            <span style="color:#ff4444;margin-left:6px;">⛔ ${losses.length}</span>
                        </div>
                        <div style="color:#555;font-size:10px;margin-top:4px;">Hit / Arb / Loss</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Window</div>
                        <div style="color:#00aaff;font-size:24px;font-weight:800;">${avgWidth}¢</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">arb width captured</div>
                    </div>
                    ${pending.length > 0 ? `<div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Pending</div>
                        <div style="color:#ffaa00;font-size:24px;font-weight:800;">${pending.length}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">awaiting settlement</div>
                    </div>` : ''}
                </div>`;
        }

        if (trades.length === 0) {
            listEl.innerHTML = '<p style="color:#555;text-align:center;padding:24px;">No middles logged yet.</p>';
            return;
        }

        listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">${trades.slice(0,50).map(t => {
            const dt = new Date(t.timestamp * 1000);
            const dateStr = dt.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const isPend  = t.status === 'pending';
            const isHit   = t.middle_hit === true;
            const isArbW  = t.result === 'arb_win';
            const isLoss  = t.result === 'loss';
            const net = (t.profit_cents||0) - (t.loss_cents||0);
            const netCol = isPend ? '#ffaa00' : net >= 0 ? '#00ff88' : '#ff4444';
            const statusIcon  = isPend ? '⏳' : isHit ? '🎯' : isArbW ? '✅' : '⛔';
            const statusLabel = isPend ? 'PENDING' : isHit ? 'MIDDLE HIT' : isArbW ? 'ARB WIN' : 'LOSS';
            const borderCol   = isPend ? '#ffaa0033' : net >= 0 ? '#00ff8822' : '#ff444422';
            // Support both manual log format (leg1/leg2) and bot-automated format (ticker_a/b, team_a/b_name)
            const isBot = !t.leg1 && (t.ticker_a || t.team_a_name);
            const l1 = isBot ? {
                title: t.team_a_name ? `NO ${t.team_b_name||''}${t.spread_a > 0 ? ` +${t.spread_a}` : ''}` : (t.ticker_a || ''),
                ticker: t.ticker_a || '',
                side: 'no',
                price: t.leg_a_fill_price || t.target_price || '?',
                qty: t.qty,
                result: t.leg_a_result || null,
            } : (t.leg1 || {});
            const l2 = isBot ? {
                title: t.team_b_name ? `NO ${t.team_a_name||''}${t.spread_b > 0 ? ` +${t.spread_b}` : ''}` : (t.ticker_b || ''),
                ticker: t.ticker_b || '',
                side: 'no',
                price: t.leg_b_fill_price || t.target_price || '?',
                qty: t.qty,
                result: t.leg_b_result || null,
            } : (t.leg2 || {});
            const l1Res = l1.result;
            const l2Res = l2.result;
            const l1Col = l1Res === 'win' ? '#00ff88' : l1Res === 'loss' ? '#ff4444' : '#8892a6';
            const l2Col = l2Res === 'win' ? '#00ff88' : l2Res === 'loss' ? '#ff4444' : '#8892a6';
            // Header label: team names if bot trade, else generic
            const matchupLabel = isBot && t.team_a_name && t.team_b_name
                ? `${t.team_a_name} vs ${t.team_b_name}`
                : 'Middle Opportunity';
            const arbW = t.arb_width || 0;
            const arbInfo = arbW >= 0
                ? `<span style="color:#aa66ff;font-weight:700;">Window: +${arbW}¢</span>`
                : `<span style="color:#ffaa00;font-weight:700;">Cost: ${arbW}¢</span>`;
            const settleBtn = '';
            return `<div style="background:#0f1419;border:1px solid ${borderCol};border-radius:10px;padding:14px;">
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:15px;">${statusIcon}</span>
                        <span style="color:#aa66ff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;">${matchupLabel}</span>
                        <span style="color:#555;font-size:10px;">${dateStr}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="color:${netCol};font-weight:800;font-size:15px;">${isPend ? '—' : (net>=0?'+':'') + net + '¢'}</div>
                        <div style="color:${netCol};font-size:10px;font-weight:600;">${statusLabel}</div>
                    </div>
                </div>
                <!-- Side by side legs -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div style="background:#0a0e1a;border:1px solid ${l1Col}44;border-radius:8px;padding:10px;">
                        <div style="color:#00ff88;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:6px;">LEG A</div>
                        <div style="color:#fff;font-size:12px;font-weight:600;margin-bottom:4px;line-height:1.3;">${l1.title || l1.ticker || '—'}</div>
                        <div style="display:flex;gap:6px;align-items:center;font-size:11px;">
                            <span style="color:${(l1.side||'no')==='yes'?'#00ff88':'#ff4444'};font-weight:700;">${(l1.side||'no').toUpperCase()}</span>
                            <span style="color:#fff;font-weight:700;">@ ${l1.price||'?'}¢</span>
                            <span style="color:#8892a6;">×${l1.qty||'?'}</span>
                        </div>
                        ${l1Res ? `<div style="margin-top:6px;color:${l1Col};font-size:10px;font-weight:700;text-transform:uppercase;">${l1Res === 'win' ? '✅ WON' : '⛔ LOST'}</div>` : ''}
                    </div>
                    <div style="background:#0a0e1a;border:1px solid ${l2Col}44;border-radius:8px;padding:10px;">
                        <div style="color:#ff6688;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:6px;">LEG B</div>
                        <div style="color:#fff;font-size:12px;font-weight:600;margin-bottom:4px;line-height:1.3;">${l2.title || l2.ticker || '—'}</div>
                        <div style="display:flex;gap:6px;align-items:center;font-size:11px;">
                            <span style="color:${(l2.side||'no')==='yes'?'#00ff88':'#ff4444'};font-weight:700;">${(l2.side||'no').toUpperCase()}</span>
                            <span style="color:#fff;font-weight:700;">@ ${l2.price||'?'}¢</span>
                            <span style="color:#8892a6;">×${l2.qty||'?'}</span>
                        </div>
                        ${l2Res ? `<div style="margin-top:6px;color:${l2Col};font-size:10px;font-weight:700;text-transform:uppercase;">${l2Res === 'win' ? '✅ WON' : '⛔ LOST'}</div>` : ''}
                    </div>
                </div>
                <!-- Opportunity details -->
                <div style="display:flex;gap:14px;font-size:11px;flex-wrap:wrap;padding-top:8px;border-top:1px solid #1e2740;">
                    ${arbInfo}
                    ${t.max_profit ? `<span style="color:#00ff88;">Max: +${t.max_profit}¢</span>` : ''}
                    ${t.combined_cost > 0 ? `<span style="color:#ffaa00;">Pays to play: ${t.combined_cost}¢</span>` : t.combined_cost < 0 ? `<span style="color:#00ff88;">Free arb: +${Math.abs(t.combined_cost)}¢ guaranteed</span>` : ''}
                    ${t.notes ? `<span style="color:#555;">${t.notes}</span>` : ''}
                </div>
                ${settleBtn}
            </div>`;
        }).join('')}</div>`;
    } catch (e) {
        if (listEl) listEl.innerHTML = `<p style="color:#ff4444;">Failed: ${e.message}</p>`;
    }
}

// ── Middle log modal ─────────────────────────────────────────────────────────
const _midSides = {1: 'yes', 2: 'yes'};

function openMiddleLogModal() {
    _midSides[1] = 'yes'; _midSides[2] = 'yes';
    const m = document.getElementById('middle-log-modal');
    if (m) { m.style.display = 'flex'; updateMiddleCalc(); }
}
function closeMiddleLogModal() {
    const m = document.getElementById('middle-log-modal');
    if (m) m.style.display = 'none';
}
function setMiddleSide(leg, side) {
    _midSides[leg] = side;
    const yes = document.getElementById(`mid-leg${leg}-yes`);
    const no  = document.getElementById(`mid-leg${leg}-no`);
    if (yes) { yes.style.background = side === 'yes' ? '#1a3520' : '#1a1a1a'; yes.style.borderColor = side === 'yes' ? '#00ff88' : '#333'; yes.style.color = side === 'yes' ? '#00ff88' : '#8892a6'; yes.style.borderWidth = side === 'yes' ? '2px' : '1px'; }
    if (no)  { no.style.background  = side === 'no'  ? '#3a1a1a' : '#1a1a1a'; no.style.borderColor  = side === 'no'  ? '#ff4444' : '#333'; no.style.color  = side === 'no'  ? '#ff4444' : '#8892a6'; no.style.borderWidth  = side === 'no'  ? '2px' : '1px'; }
    updateMiddleCalc();
}
function updateMiddleCalc() {
    const p1  = parseFloat(document.getElementById('mid-leg1-price')?.value) || 0;
    const p2  = parseFloat(document.getElementById('mid-leg2-price')?.value) || 0;
    const qty = parseInt(document.getElementById('mid-qty')?.value) || 1;
    const panel = document.getElementById('middle-calc-panel');
    if (!panel) return;
    if (!p1 || !p2) { panel.innerHTML = '<div style="color:#555;font-size:12px;text-align:center;">Enter both prices to see analysis</div>'; return; }
    const arbW   = +(100 - p1 - p2).toFixed(2);
    const cost   = +((p1 + p2 - 100) * qty).toFixed(2);
    const maxP   = +((100 - p1 + 100 - p2) * qty).toFixed(2);
    const arbWCol = arbW >= 0 ? '#00ff88' : '#ffaa00';
    const costLabel = cost > 0 ? `<span style="color:#ffaa00;">You pay: <strong>${cost}¢</strong> if neither wins</span>` : `<span style="color:#00ff88;">Free arb: <strong>+${Math.abs(cost)}¢ guaranteed</strong> regardless</span>`;
    panel.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
        <div><div style="color:#8892a6;font-size:10px;text-transform:uppercase;">Window</div><div style="color:${arbWCol};font-size:20px;font-weight:800;">${arbW >= 0 ? '+' : ''}${arbW}¢</div></div>
        <div><div style="color:#8892a6;font-size:10px;text-transform:uppercase;">Middle Profit</div><div style="color:#aa66ff;font-size:20px;font-weight:800;">+${maxP}¢</div><div style="color:#555;font-size:10px;">$${(maxP/100).toFixed(2)}</div></div>
        <div><div style="color:#8892a6;font-size:10px;text-transform:uppercase;">Combined</div><div style="color:#fff;font-size:14px;font-weight:700;">${p1}¢ + ${p2}¢ = ${p1+p2}¢</div></div>
    </div>
    <div style="margin-top:10px;text-align:center;font-size:12px;">${costLabel}</div>`;
}
async function saveMiddleLog() {
    const leg1 = { title: document.getElementById('mid-leg1-title')?.value.trim(), ticker: document.getElementById('mid-leg1-ticker')?.value.trim(), side: _midSides[1], price: parseFloat(document.getElementById('mid-leg1-price')?.value)||0, qty: parseInt(document.getElementById('mid-qty')?.value)||1 };
    const leg2 = { title: document.getElementById('mid-leg2-title')?.value.trim(), ticker: document.getElementById('mid-leg2-ticker')?.value.trim(), side: _midSides[2], price: parseFloat(document.getElementById('mid-leg2-price')?.value)||0, qty: parseInt(document.getElementById('mid-qty')?.value)||1 };
    if (!leg1.price || !leg2.price) { showNotification('Enter prices for both legs', 'error'); return; }
    const notes = document.getElementById('mid-notes')?.value.trim();
    try {
        const r = await fetch(`${API_BASE}/middle/log`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({leg1, leg2, qty: leg1.qty, notes}) });
        const d = await r.json();
        if (d.ok) { closeMiddleLogModal(); showNotification('Middle logged!'); loadMiddleHistory(); }
        else showNotification(d.error || 'Failed', 'error');
    } catch (e) { showNotification('Error: ' + e.message, 'error'); }
}

// Settle middle by ID
let _settlingMiddleId = null;
function openMiddleSettle(id) {
    _settlingMiddleId = id;
    const r = prompt(`Settle middle ${id.slice(0,8)}...\nEnter result: WW (both win), WL (leg1 win), LW (leg2 win), LL (both loss)`);
    if (!r) return;
    const map = { WW:['win','win'], WL:['win','loss'], LW:['loss','win'], LL:['loss','loss'] };
    const [r1,r2] = map[r.toUpperCase()] || [];
    if (!r1) { showNotification('Enter WW, WL, LW, or LL', 'error'); return; }
    fetch(`${API_BASE}/middle/${id}/settle`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({leg1_result: r1, leg2_result: r2}) })
        .then(x => x.json()).then(d => { if (d.ok) { showNotification('Middle settled!'); loadMiddleHistory(); } else showNotification(d.error||'Failed','error'); });
}

// ── Insta Arb log modal ──────────────────────────────────────────────────────
function openInstaArbLogModal() {
    const m = document.getElementById('instarb-log-modal');
    if (m) { m.style.display = 'flex'; updateInstaArbCalc(); }
}
function closeInstaArbLogModal() {
    const m = document.getElementById('instarb-log-modal');
    if (m) m.style.display = 'none';
}
function updateInstaArbCalc() {
    const yp  = parseFloat(document.getElementById('ia-yes-price')?.value)||0;
    const np  = parseFloat(document.getElementById('ia-no-price')?.value)||0;
    const qty = parseInt(document.getElementById('ia-qty')?.value)||1;
    const panel = document.getElementById('instarb-calc-panel');
    if (!panel) return;
    if (!yp || !np) { panel.innerHTML = '<div style="color:#555;font-size:12px;text-align:center;">Enter prices</div>'; return; }
    const w = +(100 - yp - np).toFixed(2);
    const p = +(w * qty).toFixed(2);
    const wCol = w > 0 ? '#00ff88' : '#ff4444';
    panel.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;">
        <div><div style="color:#8892a6;font-size:10px;text-transform:uppercase;">Arb Width</div><div style="color:${wCol};font-size:20px;font-weight:800;">${w}¢</div></div>
        <div><div style="color:#8892a6;font-size:10px;text-transform:uppercase;">Profit</div><div style="color:#00ff88;font-size:20px;font-weight:800;">${p > 0 ? '+' : ''}${p}¢</div><div style="color:#555;font-size:10px;">$${(p/100).toFixed(2)}</div></div>
        <div><div style="color:#8892a6;font-size:10px;text-transform:uppercase;">Combined</div><div style="color:#fff;font-size:14px;font-weight:700;">${yp}+${np}=${yp+np}¢</div></div>
    </div>`;
}
async function saveInstaArbLog() {
    const yes_price = parseFloat(document.getElementById('ia-yes-price')?.value)||0;
    const no_price  = parseFloat(document.getElementById('ia-no-price')?.value)||0;
    const qty       = parseInt(document.getElementById('ia-qty')?.value)||1;
    const yes_ticker = document.getElementById('ia-yes-ticker')?.value.trim();
    const no_ticker  = document.getElementById('ia-no-ticker')?.value.trim();
    const market_title = document.getElementById('ia-market-title')?.value.trim();
    if (!yes_price || !no_price) { showNotification('Enter both prices', 'error'); return; }
    if (100 - yes_price - no_price <= 0) { showNotification('No arb — prices must sum to < 100', 'error'); return; }
    try {
        const r = await fetch(`${API_BASE}/instarb/log`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({yes_price, no_price, qty, yes_ticker, no_ticker, market_title}) });
        const d = await r.json();
        if (d.ok) { closeInstaArbLogModal(); showNotification('Insta arb logged!'); loadInstaArbHistory(); }
        else showNotification(d.error||'Failed', 'error');
    } catch (e) { showNotification('Error: ' + e.message, 'error'); }
}

async function clearTradeHistory() {
    const answer = prompt('Type DELETE to confirm clearing all trade history. This cannot be undone.');
    if (answer !== 'DELETE') { showNotification('Cancelled — type DELETE exactly to confirm'); return; }
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
            const avgEntry = pos.avg_price || 0;
            const unrealized = bid - avgEntry;  // per-contract unrealized P&L
            const unrealizedTotal = unrealized * pos.quantity;
            const unrealizedColor = unrealized >= 0 ? '#00ff88' : '#ff4444';
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
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px 12px;font-size:12px;color:#8892a6;">
                    <div>Qty: <strong style="color:#fff;">${pos.quantity}</strong></div>
                    <div>Entry: <strong style="color:#fff;">${avgEntry}¢</strong></div>
                    <div>Bid: <strong style="color:${sideColor};">${bid}¢</strong></div>
                    <div>P&L: <strong style="color:${unrealizedColor};">${unrealized >= 0 ? '+' : ''}${unrealized}¢/ea</strong></div>
                    <div>Total: <strong style="color:${unrealizedColor};">${unrealizedTotal >= 0 ? '+' : ''}${unrealizedTotal}¢</strong></div>
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
    const total = yes + no;
    const width = 100 - total;

    const warnings = [];
    if (total >= 100) {
        warnings.push({ level: 'error', msg: `YES(${yes}¢) + NO(${no}¢) = ${total}¢ — this is NOT profitable. Total must be below 100¢.` });
    }
    if (total >= 97 && total < 100) {
        warnings.push({ level: 'warn', msg: `Only ${width}¢ profit per contract — very thin margin. Consider wider spread.` });
    }
    if (yes > 90 || no > 90) {
        warnings.push({ level: 'warn', msg: `Buying at ${Math.max(yes,no)}¢ is very expensive — limited upside, large dollar exposure.` });
    }
    if (yes < 5 || no < 5) {
        warnings.push({ level: 'warn', msg: `Buying at ${Math.min(yes,no)}¢ is very unlikely to fill — the market may not have liquidity there.` });
    }
    if (currentArbMarket) {
        const yesBid = getPrice(currentArbMarket, 'yes_bid');
        const noBid  = getPrice(currentArbMarket, 'no_bid');
        if (yesBid > 0 && noBid > 0) {
            const dogBid = Math.min(yesBid, noBid);
            const dogSide = yesBid <= noBid ? 'YES' : 'NO';
            if (dogBid <= 1) {
                warnings.push({ level: 'info', msg: `${dogSide} has near-zero bids (${dogBid}¢) — underdog fill may take a long time or miss entirely.` });
            }
        }
    }

    const el = document.getElementById('bot-risk-warnings');
    if (!el) return;
    if (warnings.length === 0) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = warnings.map(w => {
        const color = w.level === 'error' ? '#ff4444' : w.level === 'info' ? '#00aaff' : '#ffaa00';
        const bg = w.level === 'error' ? '#ff444415' : w.level === 'info' ? '#00aaff15' : '#ffaa0015';
        const border = w.level === 'error' ? '#ff444444' : w.level === 'info' ? '#00aaff44' : '#ffaa0044';
        const icon = w.level === 'info' ? 'ℹ️' : '⚠️';
        return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:${color};display:flex;align-items:center;gap:8px;"><span style="font-size:14px;">${icon}</span>${w.msg}</div>`;
    }).join('');
}
