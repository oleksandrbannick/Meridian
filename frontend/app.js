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
                case 'ncaab': return (et.includes('NCAAMB') || et.includes('KXMARMAD')) && !et.includes('NCAAWB');
                case 'ncaaw': return et.includes('NCAAWB');
                case 'mls':   return et.includes('MLS') || et.includes('KXMLS');
                case 'soccer': return et.includes('EPL') || et.includes('UCL') || et.includes('MLS');
                case 'tennis': return et.includes('KXATP') || et.includes('KXWTA');
                case 'wbc':   return et.includes('KXWBC');
                case 'intl':  return et.includes('KXVTB') || et.includes('KXBSL') || et.includes('KXABA');
                case 'other': return !et.includes('NBA') && !et.includes('NFL') && !et.includes('MLB') && !et.includes('NHL') && !et.includes('NCAA') && !et.includes('KXMARMAD') && !et.includes('MLS') && !et.includes('EPL') && !et.includes('UCL') && !et.includes('KXATP') && !et.includes('KXWTA') && !et.includes('KXWBC') && !et.includes('KXVTB') && !et.includes('KXBSL') && !et.includes('KXABA');
                default: return true;
            }
        });
    }

    // LIVE sub-filter — works WITHIN whatever sport is selected
    // Uses ESPN live data when available, falls back to Kalshi-native detection
    // (expected_expiration_time) for sports ESPN doesn't cover
    if (currentLiveFilter) {
        filtered = filtered.filter(m => {
            const eventTicker = m.event_ticker || m.ticker || '';
            const gameId = extractGameId(eventTicker);
            const sport = detectSport(eventTicker);
            // 1. ESPN confirms live (most reliable)
            if (getLiveScoreForGame(gameId, sport)) return true;
            // 2. Kalshi-native: expected_expiration_time within reasonable window
            return isKalshiLive(m);
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

function _findGameInLookup(lookup, gameId, sport) {
    if (!gameId) return null;
    const cleaned = gameId.replace(/^\d+[A-Z]{3}\d+/, '');
    if (!cleaned || cleaned.length < 4) return null;
    
    // ONLY check exact sport — no cross-sport fallback (prevents men's cards showing women's scores)
    if (!sport) return null;
    
    // 1. Try combined pair key first — most reliable, avoids 3-letter code collisions
    //    (e.g. tennis: SHE = Shelton AND Sherif, but SHEOPE is unique)
    const pairMatch = lookup[`${sport}:${cleaned}`];
    if (pairMatch) return pairMatch;
    
    // 2. Try all valid split points — only match when BOTH halves
    // correspond to teams in the lookup AND they reference the SAME game
    // Try longest codes first (more specific = better match)
    for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
        const t1 = cleaned.substring(0, i);
        const t2 = cleaned.substring(i);
        const g1 = lookup[`${sport}:${t1}`];
        const g2 = lookup[`${sport}:${t2}`];
        // Both found AND same game (same ESPN ID) — prevents cross-match collisions
        if (g1 && g2 && g1.espnGameId === g2.espnGameId) {
            return g1;
        }
    }
    // 3. Fallback: both halves found (even if different games) — for sports without espnGameId
    for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
        const t1 = cleaned.substring(0, i);
        const t2 = cleaned.substring(i);
        if (lookup[`${sport}:${t1}`] && lookup[`${sport}:${t2}`]) {
            return lookup[`${sport}:${t1}`];
        }
    }
    // 4. Last resort: find either team individually (longest first)
    for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
        const t1 = cleaned.substring(0, i);
        const t2 = cleaned.substring(i);
        const g = lookup[`${sport}:${t1}`] || lookup[`${sport}:${t2}`];
        if (g) return g;
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

// ─── GAME SIGNAL — combines score, period, edge into actionable signals ───────
// Returns a signal object: { type, label, color, glowAnim, description }
//   type: 'anchor' (blowout, anchor fav), 'swing' (close game, volatility play),
//         'caution' (risky), 'pregame' (no game context), 'none' (no edge)

function getGameSignal(gameId, sport, markets) {
    // Get live score data from ESPN
    const gameData = getGameScore(gameId, sport);
    const liveData = getLiveScoreForGame(gameId, sport);

    // Get liquidity data for display (not for signal gating)
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
        return {
            type: 'pregame', label: '', color: '#8892a6',
            glowAnim: '', description: 'Pregame — waiting for tip-off', liq
        };
    }

    // Game is over
    if (gameData.state === 'post') {
        return { type: 'none', label: 'Final', color: '#555', glowAnim: '', description: 'Game over', liq };
    }

    // ── Game is LIVE — analyze the situation ──
    const homeScore = parseInt(gameData.homeScore) || 0;
    const awayScore = parseInt(gameData.awayScore) || 0;
    const scoreDiff = Math.abs(homeScore - awayScore);
    const period = gameData.period || 0;
    const clock = gameData.clock || '';

    // Parse clock to minutes remaining (approximate)
    let clockMins = 0;
    const clockMatch = clock.match(/(\d+):(\d+)/);
    if (clockMatch) clockMins = parseInt(clockMatch[1]) + parseInt(clockMatch[2]) / 60;

    // Determine game phase for basketball
    let gamePhase = 'early'; // early, mid, late, final_stretch
    if (sport === 'NBA') {
        if (period >= 4) gamePhase = clockMins <= 5 ? 'final_stretch' : 'late';
        else if (period === 3) gamePhase = 'mid';
    } else if (sport === 'NCAAB' || sport === 'NCAAW') {
        if (period >= 2) gamePhase = clockMins <= 8 ? 'final_stretch' : 'late';
    } else if (sport === 'NHL') {
        if (period >= 3) gamePhase = clockMins <= 8 ? 'final_stretch' : 'late';
        else if (period === 2) gamePhase = 'mid';
    } else {
        // Soccer, MLB, etc — use period directly
        if (period >= 2) gamePhase = 'late';
    }

    // Favorite price (higher bid = market thinks they're winning)
    const favPrice = Math.max(liq.yesBid, liq.noBid);

    // ── ANCHOR SIGNAL: clear leader, late game — safe to deploy bot ──
    if (scoreDiff >= 10 && (gamePhase === 'late' || gamePhase === 'final_stretch') && favPrice >= 75) {
        return {
            type: 'anchor', label: '🟢 ANCHOR',
            color: '#00ff88', glowAnim: 'arbGlow',
            description: `+${scoreDiff} pts · ${gameData.periodLabel} ${clock} · Fav at ${favPrice}¢ — Blowout late, safe to deploy`,
            liq
        };
    }
    // Moderate lead, late game — decent but not a lock
    if (scoreDiff >= 6 && (gamePhase === 'late' || gamePhase === 'final_stretch') && favPrice >= 65) {
        return {
            type: 'anchor', label: '🟡 LEAN',
            color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `+${scoreDiff} pts · ${gameData.periodLabel} ${clock} · Fav at ${favPrice}¢ — Solid lead late, decent setup`,
            liq
        };
    }
    // Big lead early — dominating but more game left
    if (scoreDiff >= 15 && gamePhase === 'mid' && favPrice >= 70) {
        return {
            type: 'anchor', label: '🟡 EARLY ANCHOR',
            color: '#ffaa33', glowAnim: 'arbGlowGold',
            description: `+${scoreDiff} pts · ${gameData.periodLabel} ${clock} · Fav at ${favPrice}¢ — Big lead but more game left`,
            liq
        };
    }

    // ── SWING: close game, risky — info only ──
    if (scoreDiff <= 5 && (gamePhase === 'mid' || gamePhase === 'late')) {
        return {
            type: 'swing', label: '🔵 CLOSE',
            color: '#60a5fa', glowAnim: 'arbGlowBlue',
            description: `±${scoreDiff} pts · ${gameData.periodLabel} ${clock} — Close game, risky to deploy`,
            liq
        };
    }

    // ── Early game — wait ──
    if (gamePhase === 'early') {
        return {
            type: 'caution', label: '⚪ EARLY',
            color: '#8892a6', glowAnim: '',
            description: `${gameData.periodLabel} ${clock} — Too early to read the game`,
            liq
        };
    }
    // Mid game, moderate lead — no clear signal
    return {
        type: 'caution', label: '',
        color: '#8892a6', glowAnim: '',
        description: `+${scoreDiff} pts · ${gameData.periodLabel} ${clock} — No clear setup`,
        liq
    };
}

function getRecommendedPresets(tier, signalType) {
    // Signal type affects preset choice:
    // anchor = can use tighter presets (safer position)
    // swing = need wider presets (more room for oscillation)
    // caution/pregame = medium as default
    if (signalType === 'anchor') {
        return { tight: [5, 6, 7, 8], medium: [8, 9, 10, 11], wide: [10, 12, 13, 15] }[tier] || [8, 9, 10, 11];
    }
    if (signalType === 'swing') {
        return { tight: [8, 9, 10, 11], medium: [10, 11, 12, 13], wide: [12, 13, 15, 18] }[tier] || [10, 11, 12, 13];
    }
    // Default: medium presets for caution/pregame
    return { tight: [5, 6, 7, 8], medium: [8, 10, 11, 12], wide: [12, 13, 15, 18] }[tier] || [8, 10, 11, 12];
}

function isKalshiLive(market) {
    const expStr = market.expected_expiration_time;
    if (!expStr) return false;
    
    try {
        const expTime = new Date(expStr);
        const now = Date.now();
        const hoursUntilExp = (expTime.getTime() - now) / (1000 * 60 * 60);
        
        // Window: game must be expected to end within 3 hours AND not ended > 30min ago
        // Basketball games last ~2-2.5h, so a game that JUST started has exp ~2.5-3h away
        if (hoursUntilExp < -0.5 || hoursUntilExp > 3.0) return false;
        
        // Check game date — must be today (or yesterday for late-night games)
        const ticker = market.event_ticker || '';
        const dateMatch = ticker.match(/(\d{2})([A-Z]{3})(\d{2})/);
        if (dateMatch) {
            const [, yr, mon, day] = dateMatch;
            const monthMap = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
            const gameDate = new Date(2000 + parseInt(yr), monthMap[mon] || 0, parseInt(day));
            const today = new Date();
            const diffDays = Math.abs(
                (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
                 new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()).getTime())
                / (1000*60*60*24)
            );
            if (diffDays > 1) return false;
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

            // Find YES button for this ticker
            const yesBtn = document.querySelector(`button[data-ticker="${ticker}"][data-side="yes"]`);
            if (yesBtn) {
                const yesPrice = p.yes_ask > 0 ? p.yes_ask : 0;  // ask only
                const yesDisplay = yesPrice > 0 ? `${yesPrice}¢` : '—';
                const oldText = yesBtn.querySelector('div:first-child')?.textContent || '';
                if (oldText !== yesDisplay && yesPrice > 0) {
                    console.log(`  🟢 ${ticker} YES: ${oldText} → ${yesDisplay}`);
                }
                const newStyle = yesPrice > 0 ? getPriceButtonStyle(yesPrice, 'yes') : 'background: #1a1f2e; color: #555;';
                yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${newStyle}`;
                yesBtn.querySelector('div:first-child').textContent = yesDisplay;
                if (mkt) yesBtn.onclick = () => openBotModal(mkt, 'yes', p.yes_ask);
            }

            // Find NO button for this ticker
            const noBtn = document.querySelector(`button[data-ticker="${ticker}"][data-side="no"]`);
            if (noBtn) {
                const noPrice = p.no_ask > 0 ? p.no_ask : 0;  // ask only
                const noDisplay = noPrice > 0 ? `${noPrice}¢` : '—';
                const newStyle = noPrice > 0 ? getPriceButtonStyle(noPrice, 'no') : 'background: #1a1f2e; color: #555;';
                noBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${newStyle}`;
                noBtn.querySelector('div:first-child').textContent = noDisplay;
                if (mkt) noBtn.onclick = () => openBotModal(mkt, 'no', p.no_ask);
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
    
    // Second pass: build titles using ALL markets in each group
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
        'Tennis': '🎾', 'Esports': '🎮',
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

    // Event header (title + sport + date)
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;';

    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'font-size: 15px; font-weight: 600; color: #ffffff;';
    titleSpan.textContent = `${emoji} ${eventData.eventTitle}`;
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
    
    // Display winner markets — each team is its own row with clear team label
    categorized.winners.forEach(m => {
        let winLabel;
        const isTennis = (m.event_ticker || m.ticker || '').toUpperCase().match(/KXATP|KXWTA/);
        if (isTennis) {
            // Extract full player name from title: "Will Mackenzie McDonald win the ..."
            const nameMatch = (m.title || '').match(/^Will\s+(.+?)\s+win\s/i);
            winLabel = nameMatch ? nameMatch[1] : getTeamLabelFromTicker(m.ticker);
        } else {
            const teamLabel = getTeamLabelFromTicker(m.ticker);
            // Avoid 'Win Win' for teams whose name is 'Win' (e.g. Winthrop code WIN)
            if (!teamLabel || teamLabel === 'Winner') {
                winLabel = 'Winner';
            } else if (teamLabel.toLowerCase().endsWith('win')) {
                winLabel = teamLabel;
            } else {
                winLabel = `${teamLabel} Win`;
            }
        }
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
            const spreadSection = createCollapsible('📊 More Spreads', sorted.slice(2), m => extractSubtitle(m.title) || 'Spread', `${eventData.gameId}_spreads`);
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
        // Map type to category — handle variants like 1h_spread, 1h_total, 1h_winner
        let cat;
        if (type === 'winner' || type.endsWith('_winner')) cat = 'winners';
        else if (type === 'spread' || type.endsWith('_spread')) cat = 'spreads';
        else if (type === 'total' || type.endsWith('_total')) cat = 'totals';
        else cat = 'props';
        result[cat].push(market);
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

    // Inline spread/edge indicator for quick scanning
    const liq = getMarketLiquidity(market);
    if (liq.arbEdge >= 1 && liq.arbEdge <= 20 && liq.avgSpread < 99) {
        const edgeDot = document.createElement('span');
        const dotColor = liq.arbEdge <= 8 ? '#00ff88' : (liq.arbEdge <= 12 ? '#60a5fa' : '#ffaa33');
        edgeDot.style.cssText = `display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-left:6px;vertical-align:middle;`;
        edgeDot.title = `Edge: ${liq.arbEdge}¢ · Spread: ${liq.avgSpread}¢ · ${liq.tierLabel}`;
        labelDiv.appendChild(edgeDot);
    }
    
    // YES button — show ASK price only (what it costs to buy YES)
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const yesPrice = yesAsk > 0 ? yesAsk : 0; // ask only, no bid fallback
    const yesStyle = yesPrice > 0 ? getPriceButtonStyle(yesPrice, 'yes') : 'background: #1a1f2e; color: #555;';
    
    const yesBtn = document.createElement('button');
    yesBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${yesStyle}`;

    yesBtn.setAttribute('data-ticker', market.ticker);
    yesBtn.setAttribute('data-side', 'yes');
    yesBtn.innerHTML = yesPrice > 0 ? yesPrice + '¢' : '—';
    yesBtn.onclick = () => openBotModal(market, 'yes', yesAsk);
    yesBtn.onmouseenter = () => yesBtn.style.transform = 'scale(1.05)';
    yesBtn.onmouseleave = () => yesBtn.style.transform = 'scale(1)';
    
    // NO button — show ASK price only (what it costs to buy NO)
    const noBid = getPrice(market, 'no_bid');
    const noAsk = getPrice(market, 'no_ask');
    const noPrice = noAsk > 0 ? noAsk : 0; // ask only, no bid fallback
    const noStyle = noPrice > 0 ? getPriceButtonStyle(noPrice, 'no') : 'background: #1a1f2e; color: #555;';
    
    const noBtn = document.createElement('button');
    noBtn.style.cssText = `padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 700; transition: all 0.2s; ${noStyle}`;
    noBtn.setAttribute('data-ticker', market.ticker);
    noBtn.setAttribute('data-side', 'no');
    noBtn.innerHTML = noPrice > 0 ? noPrice + '¢' : '—';
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

// Get button styling based on price — highlights ANCHOR zone (65-85¢) for volatility capture
// Strong favorites are where the bot places limit orders to catch dips
function getPriceButtonStyle(price, side) {
    const isAnchor = price >= 65 && price <= 85;   // ← BEST for volatility capture
    const isSettled = price > 85;                   // Very strong fav — less vol opportunity
    const isMid = price >= 40 && price < 65;        // Coin-flip / volatile
    const isUnderdog = price >= 20 && price < 40;   // Underdog side
    const isLongShot = price < 20;                   // Deep underdog
    
    if (side === 'yes') {
        if (isAnchor) {
            return 'background: rgba(0, 255, 136, 0.2); color: #00ff88; border: 2px solid #00ff88;';
        } else if (isSettled) {
            return 'background: rgba(0, 255, 136, 0.12); color: #00ff88cc; border: 1px solid #00ff8866;';
        } else if (isMid) {
            return 'background: rgba(0, 255, 136, 0.08); color: #00ff88aa; border: 1px solid #00ff8844;';
        } else if (isUnderdog) {
            return 'background: rgba(0, 255, 136, 0.04); color: #00ff8866; border: 1px solid #00ff8833;';
        } else {
            return 'background: rgba(0, 255, 136, 0.02); color: #00ff8833; border: 1px solid #00ff8822;';
        }
    } else {
        if (isAnchor) {
            return 'background: rgba(255, 68, 68, 0.2); color: #ff4444; border: 2px solid #ff4444;';
        } else if (isSettled) {
            return 'background: rgba(255, 68, 68, 0.12); color: #ff4444cc; border: 1px solid #ff444466;';
        } else if (isMid) {
            return 'background: rgba(255, 68, 68, 0.08); color: #ff4444aa; border: 1px solid #ff444444;';
        } else if (isUnderdog) {
            return 'background: rgba(255, 68, 68, 0.04); color: #ff444466; border: 1px solid #ff444433;';
        } else {
            return 'background: rgba(255, 68, 68, 0.02); color: #ff444433; border: 1px solid #ff444422;';
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
    const straightBtn = document.getElementById('mode-straight');
    const arbBtn = document.getElementById('mode-arb');
    const iconEl = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-mode-title');
    const subtitleEl = document.getElementById('modal-mode-subtitle');

    if (mode === 'straight') {
        straightSection.style.display = 'block';
        arbSection.style.display = 'none';
        straightBtn.style.background = '#00ff8822';
        straightBtn.style.color = '#00ff88';
        straightBtn.style.borderBottom = '2px solid #00ff88';
        arbBtn.style.background = 'transparent';
        arbBtn.style.color = '#8892a6';
        arbBtn.style.borderBottom = '2px solid transparent';
        iconEl.textContent = '💰';
        titleEl.textContent = 'Straight Bet';
        subtitleEl.textContent = 'Limit Order';
    } else {
        straightSection.style.display = 'none';
        arbSection.style.display = 'block';
        arbBtn.style.background = '#00ff8822';
        arbBtn.style.color = '#00ff88';
        arbBtn.style.borderBottom = '2px solid #00ff88';
        straightBtn.style.background = 'transparent';
        straightBtn.style.color = '#8892a6';
        straightBtn.style.borderBottom = '2px solid transparent';
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
        if (sigType === 'anchor') {
            sigText = '🟢 Blowout late — best setup, tight presets OK';
            sigColor = '#00ff88';
        } else if (sigType === 'swing') {
            sigText = '🔵 Close game — risky, for info only';
            sigColor = '#60a5fa';
        } else if (sigType === 'caution') {
            sigText = '⚪ Too early to tell — game just started';
            sigColor = '#8892a6';
        } else if (sigType === 'pregame') {
            sigText = '⏳ Pregame — waiting for tip-off';
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
        // Highlight recommended tier buttons
        document.querySelectorAll('.arb-preset-btn').forEach(btn => {
            const bw = parseInt(btn.dataset.width);
            const isRec = recPresets.includes(bw);
            if (isRec) {
                btn.style.boxShadow = `0 0 8px ${sigColor}44`;
                btn.dataset.recommended = 'true';
            } else {
                btn.style.boxShadow = 'none';
                btn.dataset.recommended = '';
            }
        });
        // Auto-apply middle preset from recommended tier
        const midPreset = recPresets[Math.floor(recPresets.length / 2)];
        applyPreset(midPreset);
    } else if (recEl) {
        recEl.style.display = 'none';
        document.querySelectorAll('.arb-preset-btn').forEach(btn => {
            btn.style.boxShadow = 'none';
            btn.dataset.recommended = '';
        });
    }

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
            if (document.getElementById('arb-mode-btn')?.classList.contains('active')) {
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
    const flipFloor = parseInt(document.getElementById('bot-stop-loss-cents').value) || 40;
    const total  = yes + no;
    const profit = 100 - total;
    const isArb  = profit > 0;
    const dollarProfit = (profit * qty / 100).toFixed(2);
    const dollarCost   = (total * qty / 100).toFixed(2);
    const roi = total > 0 ? ((profit / total) * 100).toFixed(1) : '0.0';

    // Flip threshold risk: worst case is selling at flip floor
    const yesFlipLoss = yes >= flipFloor ? (yes - flipFloor) * qty : 0;
    const noFlipLoss  = no >= flipFloor ? (no - flipFloor) * qty : 0;
    const yesLossDollar = (yesFlipLoss / 100).toFixed(2);
    const noLossDollar  = (noFlipLoss / 100).toFixed(2);
    const yesHasFlip = yes >= flipFloor;
    const noHasFlip  = no >= flipFloor;

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
            <!-- Flip threshold protection + Breakeven % -->
            <div style="padding:8px 16px 10px;border-top:1px solid #00aaff22;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
                    <span style="color:#00aaff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">🛡 Flip Protection (≤${flipFloor}¢)</span>
                    ${(() => {
                        // Breakeven %: how many arbs must complete to offset one flip loss
                        // Flip loss = favEntry - flipFloor.  Profit per fill = width.
                        // BE% = flipLoss / (flipLoss + width)
                        const favEntry = Math.max(yes, no);
                        const flipLoss = favEntry >= flipFloor ? favEntry - flipFloor : 0;
                        if (flipLoss <= 0 || profit <= 0) return `<span style="color:#00ff88;font-size:10px;font-weight:700;">✅ No flip risk</span>`;
                        const bePct = (flipLoss / (flipLoss + profit) * 100).toFixed(1);
                        const fillsToRecover = Math.ceil(flipLoss / profit);
                        const beColor = parseFloat(bePct) >= 75 ? '#ff4444' : parseFloat(bePct) >= 50 ? '#ffaa00' : '#00ff88';
                        return `<span style="color:${beColor};font-size:10px;font-weight:700;" title="${fillsToRecover} completed arbs needed to recover 1 flip loss">BE: ${bePct}% (${fillsToRecover}:1)</span>`;
                    })()}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="background:#00aaff08;border:1px solid #00aaff22;border-radius:6px;padding:6px 10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#00ff88;font-size:10px;font-weight:600;">YES leg</span>
                            ${yesHasFlip ? `<span style="color:#ff4444;font-weight:800;font-size:13px;">−$${yesLossDollar}</span>` : `<span style="color:#8892a6;font-size:10px;">no SL (underdog)</span>`}
                        </div>
                        <div style="color:#555;font-size:9px;margin-top:2px;">${yesHasFlip ? `sells at ${flipFloor}¢ if flipped (entry ${yes}¢)` : `entry ${yes}¢ < ${flipFloor}¢ — rides to settlement`}</div>
                    </div>
                    <div style="background:#00aaff08;border:1px solid #00aaff22;border-radius:6px;padding:6px 10px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff4444;font-size:10px;font-weight:600;">NO leg</span>
                            ${noHasFlip ? `<span style="color:#ff4444;font-weight:800;font-size:13px;">−$${noLossDollar}</span>` : `<span style="color:#8892a6;font-size:10px;">no SL (underdog)</span>`}
                        </div>
                        <div style="color:#555;font-size:9px;margin-top:2px;">${noHasFlip ? `sells at ${flipFloor}¢ if flipped (entry ${no}¢)` : `entry ${no}¢ < ${flipFloor}¢ — rides to settlement`}</div>
                    </div>
                </div>
            </div>
        </div>`;
}

// --- Arb Preset Helpers ---

function applyPreset(width) {
    const widthSlider = document.getElementById('bot-arb-width');
    if (widthSlider) { widthSlider.value = width; }
    document.getElementById('width-display').textContent = `${width}¢`;
    recalcArbPrices();
}

function updateBreakevenDisplay() {
    const yes = parseInt(document.getElementById('bot-yes-price')?.value) || 0;
    const no  = parseInt(document.getElementById('bot-no-price')?.value)  || 0;
    const flipFloor = parseInt(document.getElementById('bot-stop-loss-cents').value) || 40;
    const width = 100 - yes - no;
    const favEntry = Math.max(yes, no);
    const flipLoss = favEntry >= flipFloor ? favEntry - flipFloor : 0;
    const el = document.getElementById('breakeven-display');
    if (!el) return;
    if (flipLoss <= 0 || width <= 0) {
        el.textContent = `Flip floor: ${flipFloor}¢ · No flip risk`;
        el.style.color = '#00ff88';
        return;
    }
    const bePct = (flipLoss / (flipLoss + width) * 100).toFixed(1);
    const ratio = Math.ceil(flipLoss / width);
    el.textContent = `Flip floor: ${flipFloor}¢ · BE: ${bePct}% (${ratio}:1)`;
    el.style.color = parseFloat(bePct) >= 75 ? '#ff4444' : parseFloat(bePct) >= 50 ? '#ffaa00' : '#00aaff';
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
    const flip_threshold  = parseInt(document.getElementById('bot-stop-loss-cents').value) || 40;
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
                yes_price, no_price, quantity, flip_threshold,
                stop_loss_cents: 5,  // kept for backward compat, arb bots use flip_threshold
                repeat_count, arb_width,
            }),
        });
        const data = await resp.json();

        if (data.success) {
            const profit = 100 - yes_price - no_price;
            const rptNote = repeat_count > 0 ? ` | ${repeat_count + 1} runs total` : '';
            const favSide = data.fav_side ? data.fav_side.toUpperCase() : '?';
            showNotification(`🎯 Fav-first: ${favSide} posted → ${profit}¢/contract${rptNote}`);
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

        // Group bots by game
        const gameGroups = {};
        activeBots.forEach(botId => {
            const bot = bots[botId];
            const gk = getGameKey(bot.ticker);
            if (!gameGroups[gk]) gameGroups[gk] = [];
            gameGroups[gk].push(botId);
        });

        // Sort bots within each group: newest first (by created_at desc)
        Object.values(gameGroups).forEach(ids => {
            ids.sort((a, b) => (bots[b].created_at || 0) - (bots[a].created_at || 0));
        });

        // Sort game groups: most-recently-created bot in each group determines group order
        const sortedGameKeys = Object.keys(gameGroups).sort((a, b) => {
            const newestA = Math.max(...gameGroups[a].map(id => bots[id].created_at || 0));
            const newestB = Math.max(...gameGroups[b].map(id => bots[id].created_at || 0));
            return newestB - newestA;
        });

        // Render grouped bots
        sortedGameKeys.forEach(gameKey => {
            // ── Game group header ──
            const groupBots = gameGroups[gameKey];
            const sampleBot = bots[groupBots[0]];
            const groupMatchup = formatBotDisplayName(sampleBot.ticker).split('·')[0].split('—')[0].trim();
            const groupPhase = groupBots.some(id => bots[id].game_phase === 'live') ? '🔴 LIVE' : '⏳ PRE';
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
            const sportIcon = sampleTicker.includes('NBA') ? '🏀' : sampleTicker.includes('NHL') ? '🏒' : sampleTicker.includes('MLB') ? '⚾' : sampleTicker.includes('NFL') ? '🏈' : sampleTicker.includes('TENNIS') || sampleTicker.includes('ATP') || sampleTicker.includes('WTA') ? '🎾' : '📊';
            groupHeader.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:#00aaff;font-weight:700;">${sportIcon} ${groupMatchup}</span>
                    <span style="color:#8892a6;font-size:10px;">${groupPhase}</span>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="color:#8892a6;font-size:10px;">${groupBots.length} bot${groupBots.length > 1 ? 's' : ''}</span>
                    <span style="color:#00ff88;font-size:11px;font-weight:700;">+${(groupProfitTotal / 100).toFixed(2)}</span>
                </div>
            `;
            botsList.appendChild(groupHeader);

            groupBots.forEach(botId => {
            const bot = bots[botId];

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
                const watchDisplayName = formatBotDisplayName(bot.ticker);

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
                            <strong style="color:#fff;font-size:13px;">${watchDisplayName}</strong>
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
            const statusLabel = (bot.status || '').replace(/_/g, ' ').toUpperCase();
            const phase       = bot.game_phase || 'pregame';
            const phaseIcon   = phase === 'live' ? '🔴' : '⏳';
            const phaseLabel  = phase === 'live' ? 'LIVE' : 'PRE';
            const flipThresh  = bot.flip_threshold || 40;
            const statusClass = {
                fav_posted:     'monitoring',
                pending_fills:  'monitoring',
                yes_filled:     'leg1_filled',
                no_filled:      'leg1_filled',
                waiting_repeat: 'monitoring',
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

            // Waiting for repeat spread
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
            if (bot.status === 'fav_posted') {
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
            } else if (bot.status === 'yes_filled') {
                const entryYes = bot.yes_price || 0;
                const yBid = bot.live_yes_bid != null ? bot.live_yes_bid : '?';
                const hasFlipSL = entryYes >= flipThresh;
                if (hasFlipSL) {
                    const distFromFlip = typeof yBid === 'number' ? yBid - flipThresh : '?';
                    const flipped = typeof distFromFlip === 'number' && distFromFlip <= 0;
                    stopLossInfo = `<div style="background:${flipped ? '#ff444411' : '#00aaff11'};border:1px solid ${flipped ? '#ff444433' : '#00aaff33'};border-radius:5px;padding:4px 8px;font-size:10px;color:${flipped ? '#ff6666' : '#00aaff'};margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                        <span>🛡 Flip floor: sells YES if bid ≤ <strong>${flipThresh}¢</strong></span>
                        <span style="color:#8892a6;">Distance: <strong style="color:${typeof distFromFlip === 'number' && distFromFlip <= 5 ? '#ff4444' : '#00ff88'};">${distFromFlip}¢</strong> from flip</span>
                        <span style="color:#8892a6;">Filled ${fillAgeMin}m ago</span>
                    </div>`;
                } else {
                    stopLossInfo = `<div style="background:#00ff8811;border:1px solid #00ff8833;border-radius:5px;padding:4px 8px;font-size:10px;color:#00ff88;margin-top:6px;">
                        <span>✅ Underdog entry (${entryYes}¢ < ${flipThresh}¢) — no SL, rides to settlement</span>
                        <span style="color:#8892a6;margin-left:8px;">Filled ${fillAgeMin}m ago</span>
                    </div>`;
                }
            } else if (bot.status === 'no_filled') {
                const entryNo = bot.no_price || 0;
                const nBid = bot.live_no_bid != null ? bot.live_no_bid : '?';
                const hasFlipSL = entryNo >= flipThresh;
                if (hasFlipSL) {
                    const distFromFlip = typeof nBid === 'number' ? nBid - flipThresh : '?';
                    const flipped = typeof distFromFlip === 'number' && distFromFlip <= 0;
                    stopLossInfo = `<div style="background:${flipped ? '#ff444411' : '#00aaff11'};border:1px solid ${flipped ? '#ff444433' : '#00aaff33'};border-radius:5px;padding:4px 8px;font-size:10px;color:${flipped ? '#ff6666' : '#00aaff'};margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                        <span>🛡 Flip floor: sells NO if bid ≤ <strong>${flipThresh}¢</strong></span>
                        <span style="color:#8892a6;">Distance: <strong style="color:${typeof distFromFlip === 'number' && distFromFlip <= 5 ? '#ff4444' : '#00ff88'};">${distFromFlip}¢</strong> from flip</span>
                        <span style="color:#8892a6;">Filled ${fillAgeMin}m ago</span>
                    </div>`;
                } else {
                    stopLossInfo = `<div style="background:#00ff8811;border:1px solid #00ff8833;border-radius:5px;padding:4px 8px;font-size:10px;color:#00ff88;margin-top:6px;">
                        <span>✅ Underdog entry (${entryNo}¢ < ${flipThresh}¢) — no SL, rides to settlement</span>
                        <span style="color:#8892a6;margin-left:8px;">Filled ${fillAgeMin}m ago</span>
                    </div>`;
                }
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
                    ${(() => {
                        const isFav = bot.status === 'fav_posted';
                        const yesFav = bot.fav_side === 'yes';
                        const noFav  = bot.fav_side === 'no';
                        const yesIsPosted = !isFav || yesFav;
                        const noIsPosted  = !isFav || noFav;
                        const yesQueued = isFav && !yesFav;
                        const noQueued  = isFav && !noFav;
                        const yStarHtml = (yesFav && (isFav || bot.status === 'yes_filled' || bot.status === 'no_filled' || bot.status === 'pending_fills')) ? '<span title="Favorite" style="margin-left:3px;">⭐</span>' : '';
                        const nStarHtml = (noFav && (isFav || bot.status === 'yes_filled' || bot.status === 'no_filled' || bot.status === 'pending_fills')) ? '<span title="Favorite" style="margin-left:3px;">⭐</span>' : '';
                        // YES leg
                        const yBarH = yesQueued ? 2 : 6;
                        const yBarBg = yesQueued ? '#0a0e18' : '#1e2740';
                        const yFillColor = yFill >= qty ? '#00ff88' : (yesQueued ? '#00ff8820' : '#00ff8866');
                        const yLabelColor = yesQueued ? '#555' : '#8892a6';
                        const yPriceColor = yesQueued ? '#00ff8844' : '#00ff88';
                        const yStatusTxt = yesQueued ? 'QUEUED' : (yFill >= qty ? `${yFill}/${qty} ✓ FILLED` : `${yFill}/${qty}`);
                        const yStatusColor = yesQueued ? '#555' : (yFill >= qty ? '#00ff88' : '#8892a6');
                        const yBidLabel = 'Mkt bid';
                        // NO leg
                        const nBarH = noQueued ? 2 : 6;
                        const nBarBg = noQueued ? '#0a0e18' : '#1e2740';
                        const nFillColor = nFill >= qty ? '#ff4444' : (noQueued ? '#ff444420' : '#ff444466');
                        const nLabelColor = noQueued ? '#555' : '#8892a6';
                        const nPriceColor = noQueued ? '#ff444444' : '#ff4444';
                        const nStatusTxt = noQueued ? 'QUEUED' : (nFill >= qty ? `${nFill}/${qty} ✓ FILLED` : `${nFill}/${qty}`);
                        const nStatusColor = noQueued ? '#555' : (nFill >= qty ? '#ff4444' : '#8892a6');
                        const nBidLabel = 'Mkt bid';
                        return `
                    <div style="opacity:${yesQueued ? '0.45' : '1'};transition:opacity .5s;">
                        <div style="display:flex;justify-content:space-between;color:${yLabelColor};margin-bottom:3px;">
                            <span>YES @ <strong style="color:${yPriceColor};">${bot.yes_price || '?'}¢</strong>${yStarHtml}</span>
                            <span style="color:${yStatusColor};font-weight:${yFill >= qty ? '700' : '400'};">${yStatusTxt}</span>
                        </div>
                        <div style="height:${yBarH}px;background:${yBarBg};border-radius:3px;overflow:hidden;transition:height .5s;${yFill >= qty ? 'box-shadow:0 0 8px #00ff8844;' : ''}">
                            <div style="height:100%;width:${yPct}%;background:${yFillColor};border-radius:3px;transition:width .5s,background .5s;"></div>
                        </div>
                        ` + (!yesQueued && bot.live_yes_bid != null ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#555;">
                            <span>${yBidLabel}: <strong style="color:#00ff8899;">${bot.live_yes_bid}¢</strong></span>
                            <span>Mkt ask: <strong style="color:#00ff8899;">${bot.live_yes_ask || '?'}¢</strong></span>
                        </div>` : '') + `
                    </div>
                    <div style="opacity:${noQueued ? '0.45' : '1'};transition:opacity .5s;">
                        <div style="display:flex;justify-content:space-between;color:${nLabelColor};margin-bottom:3px;">
                            <span>NO @ <strong style="color:${nPriceColor};">${bot.no_price || '?'}¢</strong>${nStarHtml}</span>
                            <span style="color:${nStatusColor};font-weight:${nFill >= qty ? '700' : '400'};">${nStatusTxt}</span>
                        </div>
                        <div style="height:${nBarH}px;background:${nBarBg};border-radius:3px;overflow:hidden;transition:height .5s;${nFill >= qty ? 'box-shadow:0 0 8px #ff444444;' : ''}">
                            <div style="height:100%;width:${nPct}%;background:${nFillColor};border-radius:3px;transition:width .5s,background .5s;"></div>
                        </div>
                        ` + (!noQueued && bot.live_no_bid != null ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#555;">
                            <span>${nBidLabel}: <strong style="color:#ff444499;">${bot.live_no_bid}¢</strong></span>
                            <span>Mkt ask: <strong style="color:#ff444499;">${bot.live_no_ask || '?'}¢</strong></span>
                        </div>` : '') + `
                    </div>`;
                    })()}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#555;border-top:1px solid #1e2740;padding-top:6px;margin-top:2px;flex-wrap:wrap;gap:4px;">
                    <span>🎟 ${bot.ticker || '?'}</span>
                    <span>Width: <strong style="color:#00aaff;">${profit}¢</strong></span>
                    <span>🛡 Flip: <strong style="color:#00aaff;">${flipThresh}¢</strong></span>
                    <span>Cost: <strong style="color:#8892a6;">$${((bot.yes_price + bot.no_price) * qty / 100).toFixed(2)}</strong></span>
                    <span>Payout: <strong style="color:#00ff88;">$${(qty).toFixed(2)}</strong></span>
                    <span>${phase === 'live' ? '🔴 Live' : '⏳ Patient'}</span>
                    <span>${!autoMonitorInterval ? '⚠️ OFF' : '🤖 On'}</span>
                </div>
                ${stopLossInfo}
                ${waitRepeatInfo}`;
            botsList.appendChild(item);
            });  // end groupBots.forEach
        });  // end sortedGameKeys.forEach

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
        setBuddyMood('happy');
        buddyMonitorStart = Date.now();
        buddyMonitorCycles = 0;
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
        setBuddyMood('neutral');
        buddyMonitorStart = null;
        buddyMonitorCycles = 0;
    } else {
        autoMonitorInterval = setInterval(monitorBots, 2000);
        if (button) button.textContent = '⏸️ Pause Monitor';
        if (buddy) { buddy.classList.remove('idle'); buddy.classList.add('active'); }
        updateBotBuddyMsg('scanning');
        setBuddyMood('happy');
        buddyMonitorStart = Date.now();
        buddyMonitorCycles = 0;
        monitorBots();
    }
    // Re-render bots so the "Monitor OFF/ON" label updates
    loadBots();
}

// Bot buddy messages — rotates through fun status messages with personality
const botBuddyMessages = {
    idle: [
        `<strong>Idle</strong> — Enable Auto-Monitor to put me to work!`,
        `<strong>Sleeping...</strong> Hit the monitor button and I'll watch your bots 24/7`,
        `<strong>Standing by</strong> — Your bots aren't being watched right now`,
        `<strong>Bored...</strong> Give me something to monitor! 🥱`,
        `<strong>Waiting</strong> — I promise I'll be fast once you turn me on`,
    ],
    scanning: [
        `<strong>Working!</strong> Checking fills every 2 seconds...`,
        `<strong>On it!</strong> Watching order books, detecting fills...`,
        `<strong>Monitoring</strong> — Reposting stale orders & watching for flips`,
        `<strong>Scanning...</strong> Keeping an eye on your positions`,
        `<strong>Active!</strong> Reposts, resizes & flip protection running`,
        `<strong>Locked in</strong> — Nothing gets past me 🔍`,
        `<strong>Patrolling</strong> — Order books under surveillance`,
    ],
    fav_posted: [
        `<strong>🎯 Favorite posted!</strong> Waiting for the liquid side to fill first`,
        `<strong>Smart sequencing!</strong> Fav side is in the book — underdog queued after fill`,
        `<strong>Fav-first active</strong> — Higher-bid side posted, watching for fill...`,
    ],
    fav_filled: [
        `<strong>Fav filled!</strong> Now posting the underdog side — arb almost locked 🔒`,
        `<strong>Phase 2!</strong> Favorite got eaten — underdog order going in now`,
        `<strong>Nice fill!</strong> Liquid side done, posting the other leg 🎯`,
    ],
    filled: [
        `<strong>Nice!</strong> A leg just filled — holding until the other side fills or the game settles`,
        `<strong>Progress!</strong> One side is in — no SL panic, just waiting for the arb to complete`,
        `<strong>Order filled!</strong> Riding it out. Only selling if the favorite flips below the flip floor`,
    ],
    completed: [
        `<strong>Locked in!</strong> Both sides filled — profit secured at settlement 🎉`,
    ],
    celebrating: [
        `<strong>LET'S GO!</strong> Profit locked — I love when a plan comes together 🎉`,
        `<strong>MONEY!</strong> Another win in the books 💰`,
        `<strong>Nailed it!</strong> Clean fill, clean profit. You're welcome 😎`,
    ],
    flip_triggered: [
        `<strong>Favorite flipped.</strong> Bid dropped below the flip floor — sold to cut losses 🛡️`,
        `<strong>Flip detected.</strong> The favorite is no longer favored — exited the position`,
        `<strong>Flip protection fired.</strong> Thesis broken, sold before it got worse`,
    ],
    stop_loss: [
        `<strong>Watch SL fired.</strong> Straight bet dropped past the stop — exiting to protect capital`,
        `<strong>Position stopped.</strong> This is why we set SLs on directional bets 🛡️`,
        `<strong>SL triggered.</strong> Prop/straight bet hit the limit — sold`,
    ],
    take_profit: [
        `<strong>Cha-ching!</strong> Take profit hit — securing those gains 🎯`,
        `<strong>Target reached!</strong> Sold for profit. Discipline pays off`,
    ],
    watching: [
        `<strong>Eyes on it</strong> — Watching your positions like a hawk 🦅`,
        `<strong>Position active</strong> — Monitoring price vs your SL/TP levels`,
    ],
    near_flip: [
        `<strong>⚠️ Getting close...</strong> A position is approaching the flip floor`,
        `<strong>Heads up!</strong> Bid is drifting toward the flip threshold`,
    ],
    holding: [
        `<strong>Holding steady</strong> — Bid is above the flip floor, no reason to sell`,
        `<strong>Riding it out</strong> — Normal volatility, just oscillation. No panic`,
        `<strong>Diamond hands (the smart kind)</strong> — Only a real flip triggers a sell`,
    ],
    profitable: [
        `<strong>Looking good!</strong> Session is in the green — keep it rolling 📈`,
        `<strong>Making money!</strong> Your strategy is working today 💪`,
    ],
    losing: [
        `<strong>Rough patch.</strong> Session is red, but that's trading. Stick to the plan`,
        `<strong>Down but not out.</strong> Risk is managed, we'll bounce back`,
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

function updateBotBuddyMsg(state) {
    const el = document.getElementById('bot-buddy-msg');
    if (!el) return;
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

// Set buddy mood (changes face expression and colors)
function setBuddyMood(mood) {
    const buddy = document.getElementById('bot-buddy');
    if (!buddy) return;
    // Remove all mood classes
    buddy.classList.remove('mood-happy', 'mood-neutral', 'mood-worried', 'mood-celebrating');
    buddy.classList.add(`mood-${mood}`);
    buddyCurrentMood = mood;
}

// React to monitor events (called from monitorBots when actions come in)
function buddyReactToEvent(action) {
    buddyEventCount++;
    buddyLastEvent = action.action;
    
    if (action.action === 'completed') {
        setBuddyMood('celebrating');
        updateBotBuddyMsg('celebrating');
        // Celebrate for 8 seconds, then return to normal
        clearTimeout(buddyCelebrationTimeout);
        buddyCelebrationTimeout = setTimeout(() => {
            setBuddyMood(buddySessionPnl >= 0 ? 'happy' : 'neutral');
        }, 8000);
    } else if (action.action === 'flip_yes' || action.action === 'flip_no') {
        setBuddyMood('worried');
        updateBotBuddyMsg('flip_triggered');
        clearTimeout(buddyCelebrationTimeout);
        buddyCelebrationTimeout = setTimeout(() => {
            setBuddyMood(buddySessionPnl >= 0 ? 'happy' : 'neutral');
        }, 6000);
    } else if (action.action === 'stop_loss_watch') {
        setBuddyMood('worried');
        updateBotBuddyMsg('stop_loss');
        clearTimeout(buddyCelebrationTimeout);
        buddyCelebrationTimeout = setTimeout(() => {
            setBuddyMood(buddySessionPnl >= 0 ? 'happy' : 'neutral');
        }, 6000);
    } else if (action.action === 'take_profit_watch') {
        setBuddyMood('celebrating');
        updateBotBuddyMsg('take_profit');
        clearTimeout(buddyCelebrationTimeout);
        buddyCelebrationTimeout = setTimeout(() => {
            setBuddyMood(buddySessionPnl >= 0 ? 'happy' : 'neutral');
        }, 6000);
    } else if (action.action === 'fav_filled_dog_posted') {
        setBuddyMood('happy');
        updateBotBuddyMsg('fav_filled');
    } else if (action.action === 'fav_reposted') {
        updateBotBuddyMsg('fav_posted');
    } else if (action.action === 'fav_stale_cancelled') {
        updateBotBuddyMsg('scanning');
    } else if (action.action === 'holding_yes' || action.action === 'holding_no') {
        updateBotBuddyMsg('holding');
    } else if (action.action === 'straight_bet_filled') {
        setBuddyMood('happy');
        updateBotBuddyMsg('filled');
    } else if (action.action === 'reposted') {
        // brief message, no mood change
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
    
    // Update mood based on P&L (unless celebrating/reacting)
    if (buddyCurrentMood !== 'celebrating') {
        if (buddySessionPnl > 1) {
            setBuddyMood('happy');
        } else if (buddySessionPnl < -2) {
            setBuddyMood('worried');
        } else {
            setBuddyMood('neutral');
        }
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
    // Show buddy whenever there are any bots (active or not)
    if (activeCount > 0 || document.getElementById('bots-section')?.style.display === 'block') {
        buddy.style.display = 'flex';
    }
    if (!autoMonitorInterval) {
        updateBotBuddyMsg('idle');
        setBuddyMood('neutral');
        return;
    }
    if (filledLegs > 0) {
        updateBotBuddyMsg('filled');
    } else if (activeCount > 0) {
        // Only update message if not in a reaction state
        if (buddyCurrentMood !== 'celebrating' && buddyCurrentMood !== 'worried') {
            updateBotBuddyMsg('scanning');
        }
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
            // Queue jump info
            const qjProfit = opp.qj_profit || 0;
            const qjColor = qjProfit >= 3 ? '#00ccff' : qjProfit >= 1 ? '#8892a6' : '#ff4444';
            const qjLine = qjProfit >= 1
                ? `<div style="color:${qjColor};font-size:10px;margin-top:1px;">
                    ⚡ Queue Jump: YES ${opp.qj_yes}¢ + NO ${opp.qj_no}¢ → +${qjProfit}¢  <span style="color:#6a7488;">(bid+1, fills first)</span>
                   </div>`
                : '';
            const qjButton = qjProfit >= 1
                ? `<button onclick="quickBot('${opp.ticker}', ${opp.qj_yes}, ${opp.qj_no})"
                        style="background:#00ccff;color:#000;border:none;padding:4px 10px;border-radius:5px;cursor:pointer;font-weight:700;font-size:10px;margin-top:4px;">
                    ⚡ +${qjProfit}¢
                   </button>`
                : '';
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
                    ${qjLine}
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;">
                    <div style="text-align:right;">
                        <div style="color:${profitColor};font-weight:800;font-size:1.3rem;">+${opp.profit_posted}¢</div>
                        <div style="color:#6a7488;font-size:10px;">gap ${opp.width}¢</div>
                    </div>
                    <button onclick="quickBot('${opp.ticker}', ${opp.suggested_yes}, ${opp.suggested_no})"
                            style="background:#00ff88;color:#000;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">
                        🤖 Bot
                    </button>
                    ${qjButton}
                </div>
            </div>`;
        }).join('');
    }
    modal.classList.add('show');
}

async function quickBot(ticker, yesPrice, noPrice) {
    // Read qty from scan modal first, fall back to controls bar
    const quantity        = parseInt(document.getElementById('scan-modal-qty')?.value || document.getElementById('scan-qty')?.value || '1');
    const flip_threshold  = 40;
    const totalCost       = (yesPrice + noPrice) * quantity;
    const profitPer       = 100 - yesPrice - noPrice;

    if (!confirm(`⚡ Place Dual-Arb Bot — ${quantity} contract(s)\n\nTicker: ${ticker}\nYES limit buy: ${yesPrice}¢\nNO limit buy: ${noPrice}¢\nTotal cost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nProfit if both fill: +${profitPer}¢/contract\nFlip floor: ${flip_threshold}¢\n\nConfirm?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, yes_price: yesPrice, no_price: noPrice, quantity, stop_loss_cents: 5, flip_threshold }),
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
        const resp = await fetch(`${API_BASE}/bot/history/stats`);
        const s = await resp.json();

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

        // Main stats grid
        panel.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;">
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Fill Rate</div>
                    <div style="color:${fillColor};font-size:24px;font-weight:800;">${fillRate}%</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">${s.arb_wins}W / ${s.arb_losses}L of ${s.arb_total}</div>
                </div>
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Net P&L</div>
                    <div style="color:${netColor};font-size:24px;font-weight:800;">${s.arb_net_cents >= 0 ? '+' : ''}$${netDollars}</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">Avg: +${s.arb_avg_profit}¢ win / -${s.arb_avg_loss}¢ loss</div>
                </div>
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Fill Time</div>
                    <div style="color:#fff;font-size:24px;font-weight:800;">${fmtDur(s.avg_fill_duration_s)}</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">Win: ${fmtDur(s.avg_win_duration_s)} / Loss: ${fmtDur(s.avg_loss_duration_s)}</div>
                </div>
                ${s.watch_total > 0 ? `
                <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Watch Trades</div>
                    <div style="color:#ffaa00;font-size:24px;font-weight:800;">${s.watch_wins}W / ${s.watch_losses}L</div>
                    <div style="color:#555;font-size:10px;margin-top:2px;">of ${s.watch_total} total</div>
                </div>` : ''}
            </div>

            <!-- Phase / Quarter / Margin breakdown row -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:16px;">
                ${_renderMiniBreakdown('By Phase', s.phase_stats, {'pregame': 'Pregame', 'live': 'Live'})}
                ${_renderMiniBreakdown('By Quarter', s.quarter_stats, null)}
                ${_renderMiniBreakdown('By Score Margin', s.margin_stats, {'close_0_5': '0-5 pts', 'mid_6_15': '6-15 pts', 'blowout_16plus': '16+ pts'})}
                ${_renderMiniBreakdown('First Leg', s.first_leg_stats, {'yes': 'YES first', 'no': 'NO first'})}
            </div>
        `;

        // Width breakdown table
        if (widthPanel && s.width_breakdown && s.width_breakdown.length > 0) {
            const rows = s.width_breakdown.map(w => {
                const frColor = w.fill_rate >= 50 ? '#00ff88' : w.fill_rate >= 25 ? '#ffaa00' : '#ff4444';
                const nColor = w.net_cents >= 0 ? '#00ff88' : '#ff4444';
                return `<tr>
                    <td style="padding:6px 10px;color:#fff;font-weight:700;">${w.width}¢</td>
                    <td style="padding:6px 10px;color:${frColor};font-weight:700;">${w.fill_rate}%</td>
                    <td style="padding:6px 10px;color:#8892a6;">${w.wins}W / ${w.losses}L</td>
                    <td style="padding:6px 10px;color:${nColor};font-weight:700;">${w.net_cents >= 0 ? '+' : ''}${w.net_cents}¢</td>
                    <td style="padding:6px 10px;color:#8892a6;">${w.avg_fill_duration_s !== null ? fmtDur(w.avg_fill_duration_s) : '—'}</td>
                </tr>`;
            }).join('');
            widthPanel.innerHTML = `
                <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;font-weight:600;">📊 Fill Rate by Width Setting</div>
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <tr style="border-bottom:1px solid #1e2740;">
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Width</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Fill Rate</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Record</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Net</th>
                            <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Avg Fill</th>
                        </tr>
                        ${rows}
                    </table>
                </div>
            `;

            // Combo breakdown (Width + SL vs Breakeven)
            if (s.combo_breakdown && s.combo_breakdown.length > 0) {
                const comboRows = s.combo_breakdown.map(c => {
                    const frColor = c.fill_rate >= c.breakeven_pct ? '#00ff88' : c.fill_rate >= c.breakeven_pct * 0.8 ? '#ffaa00' : '#ff4444';
                    const edgeColor = c.edge >= 0 ? '#00ff88' : '#ff4444';
                    const nColor = c.net_cents >= 0 ? '#00ff88' : '#ff4444';
                    const edgeIcon = c.edge >= 5 ? '🟢' : c.edge >= 0 ? '🟡' : '🔴';
                    return `<tr style="border-bottom:1px solid #1e274033;">
                        <td style="padding:6px 10px;color:#fff;font-weight:700;">${c.width}¢ / ${c.sl}¢</td>
                        <td style="padding:6px 10px;color:${frColor};font-weight:700;">${c.fill_rate}%</td>
                        <td style="padding:6px 10px;color:#ffaa33;font-weight:600;">${c.breakeven_pct}%</td>
                        <td style="padding:6px 10px;color:${edgeColor};font-weight:700;">${edgeIcon} ${c.edge >= 0 ? '+' : ''}${c.edge}%</td>
                        <td style="padding:6px 10px;color:#8892a6;">${c.wins}W / ${c.losses}L</td>
                        <td style="padding:6px 10px;color:${nColor};font-weight:700;">${c.net_cents >= 0 ? '+' : ''}${c.net_cents}¢</td>
                    </tr>`;
                }).join('');
                widthPanel.innerHTML += `
                    <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;margin-top:12px;">
                        <div style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;font-weight:600;">🎯 Fill Rate vs Breakeven by Width / Flip Floor</div>
                        <div style="color:#555;font-size:10px;margin-bottom:10px;">Your actual fill rate compared to the required breakeven % for each width/flip combo</div>
                        <table style="width:100%;border-collapse:collapse;font-size:12px;">
                            <tr style="border-bottom:1px solid #1e2740;">
                                <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Width / Flip</th>
                                <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Fill Rate</th>
                                <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Breakeven</th>
                                <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Edge</th>
                                <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Record</th>
                                <th style="padding:6px 10px;text-align:left;color:#555;font-weight:600;">Net</th>
                            </tr>
                            ${comboRows}
                        </table>
                    </div>
                `;
            }
        } else if (widthPanel) {
            widthPanel.innerHTML = '';
        }
    } catch (err) {
        panel.innerHTML = `<p style="color:#ff4444;font-size:11px;">Stats unavailable: ${err.message}</p>`;
    }
}

function _renderMiniBreakdown(title, stats, labelMap) {
    if (!stats || Object.keys(stats).length === 0) return '';
    const items = Object.entries(stats)
        .filter(([_, v]) => v.wins + v.losses > 0)
        .map(([k, v]) => {
            const total = v.wins + v.losses;
            const rate = total > 0 ? Math.round(v.wins / total * 100) : 0;
            const label = labelMap ? (labelMap[k] || k) : k;
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

async function loadTradeHistory() {
    const el = document.getElementById('trade-history-list');
    if (!el) return;

    // Load stats panel in parallel
    loadHistoryStats();

    try {
        const resp = await fetch(`${API_BASE}/bot/history?limit=50`);
        const data = await resp.json();
        const trades = data.trades || [];
        
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
            const isWin = t.result === 'completed' || t.result === 'take_profit_watch';
            const isSL = t.result?.includes('stop_loss') || t.result?.includes('flip_');
            const pnl = isWin ? (t.profit_cents || 0) : -(t.loss_cents || 0);
            const pnlColor = pnl >= 0 ? '#00ff88' : '#ff4444';
            const icon = isWin ? '✅' : '⛔';
            const isFlip = t.result?.includes('flip_');
            const resultLabel = isWin ? 'FILLED' : (isFlip ? 'FLIPPED' : (isSL ? 'STOP LOSS' : 'STOPPED'));
            
            // Display name
            const teamName = formatBotDisplayName(t.ticker || '');
            
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
                gameCtxHtml += `<span style="background:#1e274022;color:${diffColor};padding:1px 5px;border-radius:3px;font-size:9px;">±${gc.score_diff}</span>`;
            }

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
                if (t.flip_threshold) parts.push(`<span style="color:#8892a6;">Flip: <strong style="color:#00aaff;">${t.flip_threshold}¢</strong></span>`);
                else if (slSetting) parts.push(`<span style="color:#8892a6;">SL: <strong style="color:#ff4444;">${slSetting}¢</strong></span>`);
                if (phase) parts.push(`<span style="background:${phase === 'live' ? '#00ff8822' : '#8892a622'};color:${phase === 'live' ? '#00ff88' : '#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${phase.toUpperCase()}</span>`);
                analyticsRow = `<div style="display:flex;gap:12px;font-size:10px;margin-top:4px;flex-wrap:wrap;">${parts.join('')}</div>`;
            }
            
            return `
                <div style="background:#0f1419;border:1px solid ${isWin ? '#00ff8822' : '#ff444422'};border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                            <span style="font-size:14px;">${icon}</span>
                            <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                            <span style="background:${typeColor}22;color:${typeColor};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${tradeType}</span>
                            ${gameCtxHtml}
                            ${verified}
                        </div>
                        <div style="color:#555;font-size:10px;margin-bottom:4px;">${t.ticker || ''}</div>
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
    const flipFloor = parseInt(document.getElementById('bot-stop-loss-cents')?.value) || 40;
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
    if (flipFloor < 25) {
        warnings.push({ level: 'warn', msg: `Flip floor of ${flipFloor}¢ is very low — only sells if favorite is nearly eliminated.` });
    }
    if (flipFloor > 45) {
        warnings.push({ level: 'warn', msg: `Flip floor of ${flipFloor}¢ is above midpoint — you'll sell during close games, not just flips.` });
    }
    // Breakeven warning for flip threshold
    const favEntry = Math.max(yes, no);
    const width = 100 - total;
    if (favEntry >= flipFloor && width > 0) {
        const flipLoss = favEntry - flipFloor;
        const bePct = (flipLoss / (flipLoss + width) * 100).toFixed(1);
        const ratio = Math.ceil(flipLoss / width);
        if (parseFloat(bePct) >= 80) {
            warnings.push({ level: 'error', msg: `Breakeven ${bePct}% — you need ${ratio} completions per flip. Very risky with this width.` });
        } else if (parseFloat(bePct) >= 65) {
            warnings.push({ level: 'warn', msg: `Breakeven ${bePct}% — ${ratio} completions needed per flip loss. Widening helps.` });
        }
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
