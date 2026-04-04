// Meridian — Sports Trading Terminal
/** Return local YYYY-MM-DD string (avoids UTC date-shift bug) */
function _localDateStr(d) { const dt = d || new Date(); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5001/api' : `${window.location.origin}/api`;

// Bot type colors, labels, and icons
const BOT_COLORS = { phantom: '#ff9900', apex: '#00d4ff', meridian: '#cc66ff', scout: '#00ff88' };
const BOT_LABELS = { phantom: '👻', apex: '△', meridian: '♛', scout: '◎' };
const BOT_NAMES = { phantom: 'Phantom', apex: 'Apex', meridian: 'Meridian', scout: 'Scout' };

// Detailed SVG icons — used in bot cards, tab buttons, Meet the Bots (larger sizes 18px+)
function botIconSvg(type, size) {
    const s = size || 14;
    const c = BOT_COLORS[type] || '#888';
    const cf = c + '33';
    if (type === 'apex') {
        return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none">` +
            `<line x1="8" y1="0" x2="8" y2="3" stroke="${c}" stroke-width="1.2"/>` +
            `<circle cx="8" cy="0.8" r="1" fill="${c}"/>` +
            `<path d="M4 3L8 1.5L12 3L13 6L13 13L3 13L3 6Z" fill="${cf}" stroke="${c}" stroke-width="1"/>` +
            `<rect x="5" y="6" width="2" height="3" rx="0.5" fill="${c}"/>` +
            `<rect x="9" y="6" width="2" height="3" rx="0.5" fill="${c}"/>` +
            `<line x1="6" y1="11" x2="10" y2="11" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>` +
            `</svg>`;
    }
    if (type === 'phantom') {
        return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none">` +
            `<path d="M3 7C3 3.7 5.2 2 7 2C8.8 2 11 3.7 11 7L11 12L10 11L9 12.5L7 11L5 12.5L4 11L3 12Z" fill="${cf}" stroke="${c}" stroke-width="1"/>` +
            `<circle cx="5.5" cy="6" r="1.3" fill="#111" stroke="${c}" stroke-width="0.5"/>` +
            `<circle cx="8.5" cy="6" r="1.3" fill="#111" stroke="${c}" stroke-width="0.5"/>` +
            `<circle cx="5.2" cy="5.7" r="0.4" fill="${c}"/>` +
            `<circle cx="8.2" cy="5.7" r="0.4" fill="${c}"/>` +
            `<ellipse cx="7" cy="9" rx="0.8" ry="0.6" fill="#111"/>` +
            `<path d="M12.5 9L12 7.5L13 7.5Z" fill="${c}"/>` +
            `<path d="M14.5 9L14 7.5L15 7.5Z" fill="${c}"/>` +
            `<ellipse cx="13.5" cy="10.5" rx="2" ry="1.8" fill="${cf}" stroke="${c}" stroke-width="0.7"/>` +
            `<circle cx="12.8" cy="10" r="0.4" fill="${c}"/>` +
            `<circle cx="14.2" cy="10" r="0.4" fill="${c}"/>` +
            `<path d="M13 13L15 12.5" stroke="${c}" stroke-width="0.7" stroke-linecap="round"/>` +
            `</svg>`;
    }
    if (type === 'meridian') {
        return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none">` +
            `<path d="M4 4L5.5 2L8 3.5L10.5 2L12 4Z" fill="${c}" stroke="${c}" stroke-width="0.5"/>` +
            `<rect x="3" y="4.5" width="10" height="9" rx="4.5" fill="${cf}" stroke="${c}" stroke-width="1"/>` +
            `<circle cx="6" cy="8.5" r="1" fill="${c}"/>` +
            `<circle cx="10" cy="8.5" r="1" fill="${c}"/>` +
            `<line x1="4.8" y1="7.8" x2="5.3" y2="7" stroke="${c}" stroke-width="0.5" stroke-linecap="round"/>` +
            `<line x1="7" y1="7.8" x2="6.5" y2="7" stroke="${c}" stroke-width="0.5" stroke-linecap="round"/>` +
            `<line x1="8.8" y1="7.8" x2="9.3" y2="7" stroke="${c}" stroke-width="0.5" stroke-linecap="round"/>` +
            `<line x1="11" y1="7.8" x2="10.5" y2="7" stroke="${c}" stroke-width="0.5" stroke-linecap="round"/>` +
            `<path d="M6.5 11 Q8 12 9.5 11" stroke="${c}" stroke-width="0.6" fill="none" stroke-linecap="round"/>` +
            `<line x1="3" y1="9" x2="1.5" y2="8" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>` +
            `<line x1="13" y1="9" x2="14.5" y2="8" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>` +
            `</svg>`;
    }
    if (type === 'scout') {
        return `<svg width="${s}" height="${s}" viewBox="0 0 16 16" fill="none">` +
            `<line x1="8" y1="1" x2="8" y2="4" stroke="${c}" stroke-width="1"/>` +
            `<circle cx="8" cy="1" r="1.2" fill="${c}"/>` +
            `<rect x="3.5" y="4" width="9" height="9.5" rx="3" fill="${cf}" stroke="${c}" stroke-width="1"/>` +
            `<circle cx="6" cy="8" r="1.2" fill="${c}"/>` +
            `<circle cx="10" cy="8" r="1.2" fill="${c}"/>` +
            `<path d="M6.5 11 Q8 12.5 9.5 11" stroke="${c}" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
            `<line x1="3.5" y1="9" x2="2" y2="8" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>` +
            `<line x1="12.5" y1="9" x2="14" y2="8" stroke="${c}" stroke-width="0.8" stroke-linecap="round"/>` +
            `</svg>`;
    }
    return '';
}
function botIconImg(type, size, opacity) {
    const svg = botIconSvg(type, size);
    if (!svg) return '';
    const o = opacity != null && opacity !== 1 ? `opacity:${opacity};` : '';
    return `<span style="display:inline-flex;align-items:center;vertical-align:middle;${o}">${svg}</span>`;
}

// Scroll to a market card in the marketplace and highlight it
function scrollToMarket(ticker) {
    // Switch to Markets tab first
    const marketsTab = document.querySelector('[data-tab="markets"]') || document.getElementById('tab-markets');
    if (marketsTab) marketsTab.click();
    setTimeout(() => {
        const btns = document.querySelectorAll(`button[data-ticker="${ticker}"]`);
        if (btns.length > 0) {
            const card = btns[0].closest('[style*="border-radius"]') || btns[0].parentElement?.parentElement?.parentElement;
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const origShadow = card.style.boxShadow;
                card.style.boxShadow = '0 0 20px rgba(0,255,136,0.5)';
                card.style.transition = 'box-shadow 0.3s';
                setTimeout(() => { card.style.boxShadow = origShadow || ''; }, 2500);
            }
        }
    }, 200);
}

/** Kalshi maker fee in cents: ceil(0.0175 × count × P × (1-P) × 100) */
function kalshiFeeCents(yesPrice, noPrice, count) {
    const p = yesPrice / 100;
    return Math.ceil(0.0175 * count * p * (1 - p) * 100);
}
let allMarkets = [];
let autoMonitorInterval = null;
let _tabRefreshInterval = null; // Auto-refresh for history/positions tabs
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

// ─── Team Logo Utility ───────────────────────────────────────────────────────
// ESPN CDN logos for major sports. Returns <img> HTML or colored letter badge fallback.
const _ESPN_LOGO_SPORTS = {
    // NBA team abbrevs that match ESPN's CDN path
    'nba': new Set(['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW','HOU','IND',
        'LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK','OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS']),
    'nfl': new Set(['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB',
        'HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS']),
    'nhl': new Set(['ANA','ARI','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET','EDM',
        'FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK','WPG','WSH']),
    'mlb': new Set(['ARI','ATL','BAL','BOS','CHC','CHW','CIN','CLE','COL','DET','HOU','KC',
        'LAA','LAD','MIA','MIL','MIN','NYM','NYY','OAK','PHI','PIT','SD','SEA','SF','STL','TB','TEX','TOR','WAS']),
};
// ESPN CDN paths per sport
const _ESPN_LOGO_PATH = {
    'nba': 'nba/500',
    'nfl': 'nfl/500',
    'nhl': 'nhl/500',
    'mlb': 'mlb/500',
};
// Map Kalshi codes to ESPN codes where they differ
const _LOGO_CODE_MAP = {
    'GSW': 'gs', 'NOP': 'no', 'SAS': 'sa', 'NYK': 'ny', 'OKC': 'okc',
    'PHX': 'phx', 'LAL': 'lal', 'LAC': 'lac', 'TBL': 'tb', 'VGK': 'vgs',
    'NJD': 'nj', 'NYR': 'nyr', 'NYI': 'nyi', 'SJS': 'sj', 'CGY': 'cgy',
    'LAR': 'lar', 'NYG': 'nyg', 'NYJ': 'nyj', 'CHW': 'chw', 'LAA': 'laa',
    'LAD': 'lad', 'NYM': 'nym', 'NYY': 'nyy',
};

function getTeamLogoHtml(code, size = 20, sportHint = '') {
    if (!code) return '';
    const upper = code.toUpperCase();
    const hint = sportHint.toLowerCase();
    // NCAA/college teams don't have ESPN CDN logos — skip straight to letter badge
    const isCollege = hint.includes('ncaa') || hint.includes('college') || hint === 'ncaab' || hint === 'ncaaw' || hint === 'ncaaf';
    let sport = '';
    if (!isCollege) {
        // Use sport hint if provided, otherwise guess from code membership
        if (hint && _ESPN_LOGO_SPORTS[hint] && _ESPN_LOGO_SPORTS[hint].has(upper)) {
            sport = hint;
        } else {
            for (const [s, codes] of Object.entries(_ESPN_LOGO_SPORTS)) {
                if (codes.has(upper)) { sport = s; break; }
            }
        }
    }
    if (sport) {
        const espnCode = _LOGO_CODE_MAP[upper] || upper.toLowerCase();
        const path = _ESPN_LOGO_PATH[sport];
        return `<img src="https://a.espncdn.com/i/teamlogos/${path}/${espnCode}.png"
                     alt="${upper}" width="${size}" height="${size}"
                     style="vertical-align:middle;border-radius:${size > 16 ? 4 : 2}px;"
                     onerror="this.style.display='none'">`;
    }
    // Fallback: colored letter badge for NCAA and others
    const colors = ['#818cf8','#00ff88','#ff6633','#ffaa00','#ff4488','#33aaff','#aa66ff','#ff8844'];
    const colorIdx = upper.charCodeAt(0) % colors.length;
    const bg = colors[colorIdx];
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${size > 16 ? 4 : 2}px;background:${bg}22;color:${bg};font-size:${Math.max(8,size-8)}px;font-weight:800;vertical-align:middle;">${upper.slice(0,2)}</span>`;
}

function getTeamCodeFromTicker(ticker) {
    if (!ticker) return '';
    const parts = ticker.split('-');
    if (parts.length < 3) return '';
    const suffix = parts[parts.length - 1];
    // Strip trailing digits (spread tiers like OKC24 → OKC)
    return (suffix.match(/^([A-Z]+)/i) || ['', ''])[1].toUpperCase();
}

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
    // Populate tab icons with SVGs
    document.querySelectorAll('.tab-icon[data-bot]').forEach(el => {
        el.innerHTML = botIconSvg(el.dataset.bot, 14);
    });
    // Populate marketplace legend icons at 28px
    document.querySelectorAll('.legend-icon[data-bot]').forEach(el => {
        el.innerHTML = botIconSvg(el.dataset.bot, 28);
    });
    // Check for orphaned positions after a short delay (let server finish startup)
    setTimeout(checkOrphanedPositions, 5000);
});

async function checkOrphanedPositions() {
    try {
        // Only show once per session — don't block screen on every refresh
        if (sessionStorage.getItem('orphan_alert_dismissed')) return;
        const resp = await fetch(`${API_BASE}/orphaned-positions`);
        const data = await resp.json();
        if (data.orphaned && data.orphaned.length > 0) {
            const listEl = document.getElementById('orphan-alert-list');
            listEl.innerHTML = data.orphaned.map(p =>
                `<div style="padding:8px 12px;background:#ff444411;border:1px solid #ff444433;border-radius:8px;margin-bottom:6px;">
                    <div style="color:#fff;font-weight:600;font-size:13px;">${p.ticker}</div>
                    <div style="color:#8892a6;font-size:11px;margin-top:2px;">
                        ${p.side.toUpperCase()} — <strong style="color:#ff4444;">${p.orphaned_qty} orphaned</strong> of ${p.total_qty} contracts
                        ${p.exposure > 0 ? ` — $${p.exposure.toFixed(2)} exposure` : ''}
                    </div>
                </div>`
            ).join('');
            document.getElementById('orphan-alert-modal').classList.add('show');
        }
    } catch (e) { /* server may not be ready yet */ }
}

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
    // Load tab-specific data + auto-refresh for active tab
    if (_tabRefreshInterval) { clearInterval(_tabRefreshInterval); _tabRefreshInterval = null; }
    if (_latencyInterval) { clearInterval(_latencyInterval); _latencyInterval = null; }
    if (tab === 'positions') {
        loadPositions();
        _tabRefreshInterval = setInterval(loadPositions, 5000);
    }
    if (tab === 'history') {
        loadTradeHistory();
        _tabRefreshInterval = setInterval(loadTradeHistory, 5000);
    }
    if (tab === 'bots') {
        loadBots(); loadPnL(); loadLatency();
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

    // 3. Always force a fresh market load so DOM is up-to-date
    await loadMarkets();

    // 4. Wait for DOM to render, then find and scroll to card
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
            // Live games take priority — don't let a finished game overwrite a live one
            const keys = [];
            if (g.homeAbbr) keys.push(`${sport}:${g.homeAbbr}`);
            if (g.awayAbbr) keys.push(`${sport}:${g.awayAbbr}`);
            if (g.homeAbbr && g.awayAbbr) {
                keys.push(`${sport}:${g.homeAbbr}${g.awayAbbr}`);
                keys.push(`${sport}:${g.awayAbbr}${g.homeAbbr}`);
            }
            for (const key of keys) {
                const existing = allGameData[key];
                // Don't overwrite a live game with a finished one
                if (existing && existing.state === 'in' && g.state !== 'in') continue;
                allGameData[key] = g;
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

    // Re-load markets then apply filters — ensures fresh data when sport + live change together
    if (allMarkets.length > 0) {
        applyFilters();
    } else {
        loadMarkets();
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
                case 'golf':  return et.includes('KXPGA') || et.includes('KXTGL') || et.includes('KXGOLF') || et.includes('KXLIV');
                case 'nbl':   return et.includes('KXNBL');
                case 'wbc':   return et.includes('KXWBC');
                case 'intl':  return et.includes('KXVTB') || et.includes('KXBSL') || et.includes('KXABA') || et.includes('KXNBL') || et.includes('KXKBL') || et.includes('KXCBA') || et.includes('KXEUROLEAGUE') || et.includes('KXBBL') || et.includes('KXGBL') || et.includes('KXACB') || et.includes('KXJBLEAGUE') || et.includes('KXLNBELITE');
                case 'other': return !et.includes('NBA') && !et.includes('NFL') && !et.includes('MLB') && !et.includes('NHL') && !et.includes('NCAA') && !et.includes('KXMARMAD') && !et.includes('MLS') && !et.includes('EPL') && !et.includes('UCL') && !et.includes('KXATP') && !et.includes('KXWTA') && !et.includes('KXPGA') && !et.includes('KXTGL') && !et.includes('KXGOLF') && !et.includes('KXLIV') && !et.includes('KXNBL') && !et.includes('KXWBC') && !et.includes('KXVTB') && !et.includes('KXBSL') && !et.includes('KXABA') && !et.includes('KXKBL') && !et.includes('KXCBA') && !et.includes('KXEUROLEAGUE') && !et.includes('KXBBL') && !et.includes('KXGBL') && !et.includes('KXACB') && !et.includes('KXJBLEAGUE') && !et.includes('KXLNBELITE');
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

    window._lastFilteredMarkets = filtered;
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
    // For today/past tickers: allow ESPN date same day, 1 day before, or 1 day ahead (UTC midnight crossing)
    // But if the game is finished (post) and the date doesn't match exactly, reject it —
    // yesterday's final score must NOT bleed into today's card for the same team
    if (daysDiff !== 0 && espnGame.state === 'post') return false;
    // Allow ±1 day for live/pregame games (handles late-night UTC → local date crossing)
    return daysDiff >= -1 && daysDiff <= 1;
}

function _findGameInLookup(lookup, gameId, sport, strict) {
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
    // Skip in strict mode — single-team matching causes false positives during
    // heavy game days (e.g. March Madness) where short abbreviation substrings
    // from future games collide with currently-live teams.
    if (!strict) {
        for (let i = Math.min(6, cleaned.length - 2); i >= 2; i--) {
            const t1 = cleaned.substring(0, i);
            const t2 = cleaned.substring(i);
            const g = lookup[`${sport}:${t1}`] || lookup[`${sport}:${t2}`];
            if (g && _gameIdDateMatchesESPN(gameId, g)) return g;
        }
    }
    
    return null;
}

function getLiveScoreForGame(gameId, sport) {
    return _findGameInLookup(liveGames, gameId, sport, true);
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

    // Liquidity imbalance (tight spread = thick liquidity, wide = thin)
    const thinSide = yesSpread > noSpread ? 'yes' : 'no';
    const thickSide = thinSide === 'yes' ? 'no' : 'yes';
    const spreadImbalance = Math.abs(yesSpread - noSpread);

    // Dog/fav identification (dog = cheaper side, fav = expensive side)
    const dogSide = yesBid < noBid ? 'yes' : 'no';
    const favSide = dogSide === 'yes' ? 'no' : 'yes';
    const dogSpread = dogSide === 'yes' ? yesSpread : noSpread;
    const favSpreadVal = favSide === 'yes' ? yesSpread : noSpread;
    // Note: on binary tickers, dogSpread === favSpread always (same order book)
    // Phantom quality: fav depth/spread (instant hedge) + volume + dog price range + hedge room
    // Score 0-100: higher = better phantom opportunity
    // When orderbook depth cached, use FAV-SIDE depth (that's where hedge needs to fill)
    const spread = Math.min(yesSpread, noSpread);  // they're equal, but min for safety
    const dogPrice = Math.min(yesBid, noBid);
    const favBid = Math.max(yesBid, noBid);
    const hedgeRoom = 98 - dogPrice - (100 - favBid);
    const _phObCache = (window._obDepthCache || {})[market.ticker];
    const _phHasDepth = _phObCache && (Date.now() - _phObCache.ts) < 300000;
    // Fav side = thick (hedge absorbs), Dog side = thin (whale dumps fill you)
    // Always use raw YES/NO depth + current dogSide — cached dogDepth/favDepth may be stale if sides flipped
    const _favDepth = _phHasDepth ? (dogSide === 'yes' ? _phObCache.noDepth3 : _phObCache.yesDepth3) : 0;
    const _dogDepth = _phHasDepth ? (dogSide === 'yes' ? _phObCache.yesDepth3 : _phObCache.noDepth3) : 0;
    // When depth cached: use contracts-per-level (much better than total depth)
    const _favPL = _phHasDepth ? (_phObCache.favPerLevel || Math.round(_favDepth / Math.max(1, 10))) : 0;
    // Fav liquidity (55 pts) — contracts-per-level when available, spread proxy otherwise
    const _phFavPts = _phHasDepth
        ? (_favPL >= 50 ? 55 : _favPL >= 30 ? 45 : _favPL >= 20 ? 35 : _favPL >= 10 ? 22 : _favPL >= 5 ? 10 : 0)
        : (spread <= 1 ? 55 : spread <= 2 ? 45 : spread <= 3 ? 30 : spread <= 5 ? 12 : 0);
    // Dog thinness (25 pts) — thin dog = sweeps reach your order
    const _phDogPts = _phHasDepth
        ? (_dogDepth <= 50 ? 25 : _dogDepth <= 200 ? 18 : _dogDepth <= 500 ? 10 : _dogDepth <= 2000 ? 5 : 0)
        : 0;
    // Gap penalty when depth cached
    const _phGapPenalty = _phHasDepth
        ? ((_phObCache.favGaps || 0) >= 3 ? -10 : (_phObCache.favGaps || 0) >= 2 ? -5 : 0)
        : 0;
    const phantomQuality = Math.round(Math.max(0, Math.min(100,
        // Fav depth/contracts-per-level (55 pts) — can hedge fill?
        _phFavPts +
        // Dog thinness (25 pts) — will sweeps reach you?
        _phDogPts +
        // Volume (20 pts) — more sweeps = more fill opportunities
        (vol >= 200 ? 20 : vol >= 100 ? 15 : vol >= 50 ? 10 : vol >= 20 ? 5 : 0) +
        // Fav gaps penalty
        _phGapPenalty
    )));

    // Apex quality: depth/spread (both legs fill) + balanced prices + live game + volume
    // Score 0-100: higher = better apex opportunity
    // When orderbook depth is cached (user clicked orderbook), use real depth instead of spread proxy
    const balance = Math.max(yesBid, noBid) > 0 ? Math.min(yesBid, noBid) / Math.max(yesBid, noBid) : 0;
    const _obCache = (window._obDepthCache || {})[market.ticker];
    const _hasDepth = _obCache && (Date.now() - _obCache.ts) < 300000; // 5 min cache
    const _spreadOrDepthPts = _hasDepth
        ? _obCache.depthPts  // Real depth score (0-35)
        : (spread <= 1 ? 35 : spread <= 2 ? 30 : spread <= 3 ? 20 : spread <= 5 ? 8 : 0);  // Spread proxy
    const apexQuality = Math.round(Math.max(0, Math.min(100,
        // Depth/spread (35 pts) — real depth when orderbook opened, spread proxy otherwise
        _spreadOrDepthPts +
        // Balance (30 pts) — coin-flip = price oscillates through both orders
        (balance >= 0.9 ? 30 : balance >= 0.7 ? 22 : balance >= 0.5 ? 12 : 0) +
        // Live game (20 pts) — volatility drives fills
        (isKalshiLive(market) ? 20 : 5) +
        // Volume (15 pts) — active market = more sweeps through your levels
        (vol >= 200 ? 15 : vol >= 100 ? 12 : vol >= 50 ? 8 : vol >= 20 ? 4 : 0)
    )));

    return { tier, tierLabel, tierColor, avgSpread, arbEdge, vol, oi, yesBid, noBid, yesAsk, noAsk, bidSum, yesSpread, noSpread, thinSide, thickSide, spreadImbalance, dogSide, favSide, dogSpread, favSpread: favSpreadVal, phantomQuality, apexQuality, balance };
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

    // No live game data — check if market activity suggests live
    if (!gameData || !gameData.state || gameData.state === 'pre') {
        // If both sides have bids and spread is reasonable, game is likely live even without score data
        if (liq.yesBid > 5 && liq.noBid > 5 && liq.bidSum >= 70) {
            return { type: 'early', label: '⚪ LIVE (no score)', color: '#8892a6',
                glowAnim: '', description: 'Market active but no score data', liq };
        }
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

function getRecommendedPresets(tier, signalType, market) {
    // Signal-based width range (fallback when no market data)
    let signalRange;
    if (signalType === 'coin_flip') signalRange = [5, 6, 7, 8];
    else if (signalType === 'lean') signalRange = [6, 7, 8, 9];
    else if (signalType === 'drifting') signalRange = [8, 9, 10, 11];
    else if (signalType === 'runaway') signalRange = [10, 11, 12, 13];
    else signalRange = [7, 8, 9, 10];

    if (!market) return signalRange;

    const yesBid = getPrice(market, 'yes_bid') || 0;
    const noBid = getPrice(market, 'no_bid') || 0;
    if (yesBid <= 0 || noBid <= 0) return signalRange;

    // Override signal range for gapped markets — wider widths needed
    const _yA = getPrice(market, 'yes_ask') || 0;
    const _nA = getPrice(market, 'no_ask') || 0;
    const _quickSpread = Math.max(_yA - yesBid, _nA - noBid);
    if (_quickSpread > 10) signalRange = [10, 11, 12, 13, 14, 15];
    else if (_quickSpread > 5) signalRange = [8, 9, 10, 11, 12];

    // Score ALL widths by fillability (how close orders post to current bids)
    // Spread-aware: skip narrow widths (<8¢) when spread is gapped (>10¢)
    const yesAsk = getPrice(market, 'yes_ask') || 0;
    const noAsk = getPrice(market, 'no_ask') || 0;
    const maxSpread = Math.max(yesAsk - yesBid, noAsk - noBid);
    const scored = [];
    for (const w of ALL_PRESET_WIDTHS) {
        // In gapped markets, skip narrow widths — they get adversely selected
        if (maxSpread > 10 && w < 8) continue;
        if (maxSpread > 5 && w < 6) continue;  // moderate gap: skip very narrow
        const arb = calculateArbPrices(market, w);
        const yesGap = yesBid - arb.targetYes;  // how far below YES bid
        const noGap = noBid - arb.targetNo;      // how far below NO bid
        const worstGap = Math.max(yesGap, noGap);
        if (arb.targetYes <= 1 || arb.targetNo <= 1) continue;
        // Scale gap tolerance with spread — wider spreads need wider widths that post deeper
        const gapLimit = Math.max(8, maxSpread + 2);
        if (worstGap > gapLimit) continue;
        scored.push({ width: w, worstGap, inSignal: signalRange.includes(w) });
    }

    if (scored.length === 0) return signalRange;

    // Sort by fillability first, signal-range as tiebreaker
    scored.sort((a, b) => {
        if (a.worstGap !== b.worstGap) return a.worstGap - b.worstGap;
        if (a.inSignal !== b.inSignal) return a.inSignal ? -1 : 1;
        return a.width - b.width;  // tighter widths first when equal
    });

    // Take up to 6 most fillable widths
    const best = scored.slice(0, 6).map(s => s.width).sort((a, b) => a - b);
    return best.length >= 3 ? best : signalRange;
}

function isKalshiLive(market) {
    // Check if game has already been resolved (result field set)
    if (market.result && market.result !== '') return false;

    const ticker = market.event_ticker || market.ticker || '';

    // ── Tennis: Use Kalshi milestone_status (authoritative) ──
    const isTennis = /KXATP|KXWTA/i.test(ticker);
    if (isTennis) {
        // milestone_status is injected by backend from milestones cache
        // Tennis has batch expirations so expiration-based detection doesn't work
        if (market.milestone_status) return market.milestone_status === 'live';
        return false;
    }

    const expStr = market.expected_expiration_time;
    if (!expStr) return false;

    try {
        const expTime = new Date(expStr);
        const now = Date.now();
        const hoursUntilExp = (expTime.getTime() - now) / (1000 * 60 * 60);

        // Golf / multi-day events: tournaments span 3-4 days.
        const isGolf = /KXPGA|KXTGL|KXLIV|KXGOLF/i.test(ticker);
        if (isGolf) {
            const openStr = market.open_time;
            const isOpen = openStr ? new Date(openStr).getTime() <= now : true;
            return isOpen && hoursUntilExp > -0.5 && hoursUntilExp < 120;
        }

        // Other sports: expiration time window
        const isActive = market.status === 'active' && (!market.result || market.result === '');
        const maxHours = 5.0;
        if (hoursUntilExp > maxHours) return false;
        if (hoursUntilExp < -0.5 && !isActive) return false;

        // Check game date — must be today (or yesterday for late-night games).
        const dateMatch = ticker.match(/(\d{2})([A-Z]{3})(\d{2})/);
        if (dateMatch) {
            const [, yr, mon, day] = dateMatch;
            const monthMap = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
            const gameDate = new Date(2000 + parseInt(yr), monthMap[mon] || 0, parseInt(day));
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const diffDays = (gameDate.getTime() - todayMidnight.getTime()) / (1000*60*60*24);
            if (diffDays > 1 || diffDays < -1) return false;
        }

        // Cross-check ESPN: Kalshi sometimes sets batch expiration times
        // (e.g. 8pm UTC for ALL day's games) that fall within the 5-hour
        // window well before actual tip-off. ESPN is authoritative for
        // game state when available.
        const gameId = extractGameId(ticker);
        const sport = detectSport(ticker);
        const espnData = getGameScore(gameId, sport);
        if (espnData) {
            // ESPN has data — trust it: only live if game is in progress
            return espnData.state === 'in';
        }
        // No ESPN data for this game. For sports ESPN covers (NBA, NCAAB,
        // NFL, NHL, MLB, MLS, NCAAW), absence means ESPN doesn't list
        // this game — don't guess from expiration alone.
        const espnSports = new Set(['NBA','NCAAB','NCAAW','NFL','NHL','MLB','MLS','EPL','UCL']);
        if (espnSports.has(sport)) return false;

        // For sports ESPN doesn't cover (intl leagues, etc.), the
        // expiration heuristic is the only signal — trust it.
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
            startBalancePoll();  // live balance updates every 15s via WS cache
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
let _marketsAbort = null;  // cancel previous in-flight load when a new one starts
async function loadMarkets() {
    // Cancel any previous in-flight load so stale responses don't overwrite
    if (_marketsAbort) { try { _marketsAbort.abort(); } catch(_) {} }
    _marketsAbort = new AbortController();
    const myAbort = _marketsAbort;

    const grid = document.getElementById('markets-grid');
    grid.innerHTML = '<p style="color: #00ff88; grid-column: 1 / -1;">Loading sports markets...</p>';

    try {
        // Build URL with sport filter for backend
        // Use higher limit — NCAAB alone can have 2000+ markets (spreads, totals, props)
        // 'live' filter is client-side only, fetch all
        const isAllOrLive = !currentSportFilter || currentSportFilter === 'all' || currentSportFilter === 'live';
        const fetchLimit = isAllOrLive ? 2000 : 3000;
        let url = `${API_BASE}/markets?status=open&limit=${fetchLimit}`;
        if (currentSportFilter && currentSportFilter !== 'all' && currentSportFilter !== 'live') {
            url += `&sport=${currentSportFilter}`;
        }

        // Backend queries Kalshi by sports series (KXNBAGAME, KXNBASPREAD, etc.)
        // Retry up to 2 times with 30s timeout per attempt
        let response, data;
        for (let _attempt = 0; _attempt < 3; _attempt++) {
            try {
                // Fresh AbortController per attempt so a prior timeout doesn't poison retries
                const attemptAbort = new AbortController();
                const timeoutId = setTimeout(() => attemptAbort.abort(), 30000);
                // Also abort if superseded by a newer loadMarkets() call
                if (myAbort !== _marketsAbort) return;
                response = await fetch(url, { signal: attemptAbort.signal });
                clearTimeout(timeoutId);
                data = await response.json();
                if (!data.error) break;
            } catch (_retryErr) {
                if (myAbort !== _marketsAbort) {
                    // Superseded by a newer loadMarkets() call — silently exit
                    return;
                }
                if (_attempt < 2) {
                    grid.innerHTML = `<p style="color: #ffaa00; grid-column: 1 / -1;">Retrying markets load... (attempt ${_attempt + 2}/3)</p>`;
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                throw _retryErr;
            }
        }

        // If superseded by a newer call while we were fetching, discard this result
        if (myAbort !== _marketsAbort) return;

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
        // Don't show error if this load was superseded by a newer one
        if (error.name === 'AbortError' && myAbort !== _marketsAbort) return;
        console.error('Error loading markets:', error);
        grid.innerHTML = `<p style="color: #ff4444; grid-column: 1 / -1;">Error loading markets: ${error.message || error}<br><small>Stack: ${error.stack || 'n/a'}</small></p>`;
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
            const lTier   = lAvgSp <= 3 ? 'tight' : lAvgSp <= 8 ? 'medium' : 'wide';

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
    
    // Pre-build ticker → active bot type map + P&L map (O(n) once, not per row)
    const botMap = {};  // ticker → {phantom: N, apex: N, meridian: N, scout: N}
    const phantomDetails = {};  // ticker → [{side, cross}] for phantom pills
    const pnlMap = {};  // ticker → total net P&L in cents (all bots, including completed)
    if (window._lastBotsData) {
        const deadSt = new Set(['completed','stopped','cancelled','drift_cancelled']);
        const catLabel = { anchor_dog: 'phantom', anchor_ladder: 'phantom', ladder_arb: 'apex' };
        for (const bid in window._lastBotsData) {
            const b = window._lastBotsData[bid];
            // P&L aggregation: include ALL bots (active + completed) for this session
            const t = b.ticker || '';
            if (t) {
                const pnl = (b.net_pnl_cents || 0);
                pnlMap[t] = (pnlMap[t] || 0) + pnl;
            }
            if (deadSt.has(b.status)) continue;
            if (!t) continue;
            let label = catLabel[b.bot_category] || (b.type === 'middle' ? 'meridian' : (b.type === 'watch' ? 'scout' : null));
            if (!label) continue;
            if (!botMap[t]) botMap[t] = {};
            botMap[t][label] = (botMap[t][label] || 0) + 1;
            // Track phantom details for side+cross display
            if (label === 'phantom') {
                if (!phantomDetails[t]) phantomDetails[t] = [];
                phantomDetails[t].push({ side: b.dog_side || '?', cross: !!b.cross_market });
                // Cross-market: also tag the hedge ticker
                if (b.cross_market && b.hedge_ticker && b.hedge_ticker !== t) {
                    const ht = b.hedge_ticker;
                    if (!botMap[ht]) botMap[ht] = {};
                    botMap[ht].phantom = (botMap[ht].phantom || 0) + 1;
                    if (!phantomDetails[ht]) phantomDetails[ht] = [];
                    phantomDetails[ht].push({ side: b.dog_side || '?', cross: true, isHedgeSide: true });
                }
            }
            // Middle bots have two tickers
            if (b.type === 'middle') {
                for (const leg of ['ticker_a', 'ticker_b']) {
                    const lt = b[leg] || '';
                    if (lt && lt !== t) {
                        if (!botMap[lt]) botMap[lt] = {};
                        botMap[lt].meridian = (botMap[lt].meridian || 0) + 1;
                    }
                }
            }
        }
    }
    window._botTypeMap = botMap;
    window._phantomDetailMap = phantomDetails;
    window._botPnlMap = pnlMap;

    // Middle scanner auto-fetch removed — was firing 12 Kalshi reads on every render,
    // starving bot operations. Use Meridian tab to scan manually.
    if (!window._middleRecoMap) window._middleRecoMap = {};

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
        const prefix = parts[0].toUpperCase();
        const segment = parts[1];
        
        // Golf: group by tournament code, not H2H matchup
        // KXLIVH2H-LIGS26JNIEAANC  → tournament = LIGS26
        // KXLIVTOP10-LIGS26        → tournament = LIGS26
        // KXPGAH2H-THPC26ASCORHEN  → tournament = THPC26
        // KXPGATOP10-THPC26        → tournament = THPC26
        const isGolf = /KXPGA|KXTGL|KXLIV|KXGOLF/.test(prefix);
        if (isGolf) {
            // Tournament code is letters+year digits at the start of segment
            // e.g. LIGS26, THPC26, TGLM26 — typically 4-6 chars + 2-digit year
            const tourneyMatch = segment.match(/^([A-Z]+\d{2})/i);
            if (tourneyMatch) return tourneyMatch[1];
        }
        
        // The game ID is the second part (date + teams)
        return segment; // e.g., "26FEB28TORWAS"
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
    if (upper.includes('KXPGA') || upper.includes('KXTGL') || upper.includes('KXGOLF') || upper.includes('KXLIV')) return 'Golf';
    if (upper.includes('KXNBL')) return 'NBL';
    if (upper.includes('KXWBC')) return 'WBC';
    if (upper.includes('KXVTB')) return 'VTB';
    if (upper.includes('KXBSL')) return 'BSL';
    if (upper.includes('KXABA')) return 'ABA';
    if (upper.includes('KXKBL')) return 'KBL';
    if (upper.includes('KXCBA')) return 'CBA';
    if (upper.includes('KXEUROLEAGUE')) return 'EuroLeague';
    if (upper.includes('KXBBL')) return 'BBL';
    if (upper.includes('KXGBL')) return 'GBL';
    if (upper.includes('KXACB')) return 'ACB';
    if (upper.includes('KXJBLEAGUE')) return 'JBLeague';
    if (upper.includes('KXLNBELITE')) return 'LNBElite';
    if (upper.includes('KXUFC')) return 'UFC';
    if (upper.includes('KXBUNDESLIGA')) return 'Bundesliga';
    if (upper.includes('KXLALIGA')) return 'LaLiga';
    if (upper.includes('KXLIGAMX')) return 'LigaMX';
    if (upper.includes('KXLIGUE1')) return 'Ligue1';
    if (upper.includes('KXSERIEA')) return 'SerieA';
    if (upper.includes('KXF1')) return 'F1';
    if (upper.includes('KXIPL')) return 'Cricket';
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
        'KBL': '🏀', 'CBA': '🏀', 'EuroLeague': '🏀', 'BBL': '🏀',
        'GBL': '🏀', 'ACB': '🏀', 'JBLeague': '🏀', 'LNBElite': '🏀',
        'UFC': '🥊', 'Bundesliga': '⚽', 'LaLiga': '⚽', 'LigaMX': '⚽',
        'Ligue1': '⚽', 'SerieA': '⚽', 'F1': '🏎️', 'Cricket': '🏏',
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
        
        // Golf H2H: "Will X beat Y in the 2026 THE PLAYERS Championship?" -> "X vs Y"
        const beatMatch = title.match(/^Will\s+(.+?)\s+beat\s+(.+?)\s+in\s+/i);
        if (beatMatch) {
            return `${beatMatch[1].trim()} vs ${beatMatch[2].trim()}`;
        }
        
        // Golf winner: "Will X win the LIV Golf Singapore?" -> "LIV Golf Singapore"
        const winTournament = title.match(/win\s+the\s+(.+?)(?:\s*\?|$)/i);
        
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
        
        // Golf Tournament: "THE PLAYERS Championship: Will X finish top 10?" -> "THE PLAYERS Championship"
        const tourneyPrefix = title.match(/^(.+?):\s+Will\s+/i);
        if (tourneyPrefix) {
            return tourneyPrefix[1].trim();
        }
        
        // Golf: "Will X win the LIV Golf Singapore?" → "LIV Golf Singapore"
        if (winTournament && !tennisMatch) {
            const name = winTournament[1].trim().replace(/\?$/, '').trim();
            // Only use if it looks like a tournament name (more than just a player name)
            if (name.split(' ').length >= 2) {
                return name;
            }
        }
        
        // Golf lead: "Will X lead at the end of round N in the Y?" → "Y"
        const roundLead = title.match(/in\s+the\s+(.+?)(?:\s*\?|$)/i);
        if (roundLead && title.toLowerCase().includes('lead')) {
            return roundLead[1].trim().replace(/\?$/, '');
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
    
    if (!cleaned || cleaned.length < 2) {
        // Golf tournament codes like LIGS26, THPC26 — return readable placeholder
        // buildGameTitle will replace this with the real tournament name from market titles
        const tourneyMatch = gameId.match(/^([A-Z]+)\d{2}$/i);
        if (tourneyMatch) return 'Golf Tournament';
        return gameId;
    }
    
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
    
    // Golf tournament codes (e.g. LIGS26, THPC26) won't match any team split
    // Return placeholder — buildGameTitle will extract the real name from market titles
    const tourneyCode = gameId.match(/^([A-Z]+\d{2})$/i);
    if (tourneyCode) return 'Golf Tournament';
    
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
        const awayLg = !isTennis ? getTeamLogoHtml(awayAbbr, 20, sport) : '';
        const homeLg = !isTennis ? getTeamLogoHtml(homeAbbr, 20, sport) : '';
        wrap.innerHTML = `
            ${awayLg} <span style="color:#8892a6;font-size:13px;font-weight:600;">${awayLabel}</span>
            <span style="color:#4a5568;font-size:12px;">vs</span>
            ${homeLg} <span style="color:#8892a6;font-size:13px;font-weight:600;">${homeLabel}</span>
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
                ${getTeamLogoHtml(awayAbbr, 22, sport)} <span style="color:${awayWon ? '#fff' : '#6a7488'};font-size:14px;font-weight:${awayWon ? '700' : '500'};">${awayAbbr}</span>
                <span style="color:${awayWon ? '#fff' : '#6a7488'};font-size:20px;font-weight:700;min-width:30px;text-align:center;">${awayScore}</span>
                <span style="color:#4a5568;font-size:14px;margin:0 2px;">–</span>
                <span style="color:${homeWon ? '#fff' : '#6a7488'};font-size:20px;font-weight:700;min-width:30px;text-align:center;">${homeScore}</span>
                ${getTeamLogoHtml(homeAbbr, 22, sport)} <span style="color:${homeWon ? '#fff' : '#6a7488'};font-size:14px;font-weight:${homeWon ? '700' : '500'};">${homeAbbr}</span>
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
            ${getTeamLogoHtml(awayAbbr, 26, sport)} <span style="color:${awayLeading ? '#00ff88' : '#fff'};font-size:15px;font-weight:700;">${awayAbbr}</span>
            <span style="color:${awayLeading ? '#00ff88' : '#fff'};font-size:26px;font-weight:800;min-width:36px;text-align:center;">${awayScore}</span>
            <span style="color:#4a5568;font-size:18px;margin:0 2px;">–</span>
            <span style="color:${homeLeading ? '#00ff88' : '#fff'};font-size:26px;font-weight:800;min-width:36px;text-align:center;">${homeScore}</span>
            ${getTeamLogoHtml(homeAbbr, 26, sport)} <span style="color:${homeLeading ? '#00ff88' : '#fff'};font-size:15px;font-weight:700;">${homeAbbr}</span>
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

    // Game-level P&L badge — sum across all bots on this game's markets
    const gamePnlMap = window._botPnlMap || {};
    let gamePnl = 0;
    for (const m of eventData.markets) {
        gamePnl += gamePnlMap[m.ticker] || 0;
    }
    if (gamePnl !== 0) {
        const pnlBadge = document.createElement('span');
        const pnlColor = gamePnl > 0 ? '#00ff88' : '#ff4444';
        const pnlSign = gamePnl > 0 ? '+' : '';
        pnlBadge.style.cssText = `background:${pnlColor}18;color:${pnlColor};border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;`;
        pnlBadge.textContent = `${pnlSign}${gamePnl}¢`;
        pnlBadge.title = `Net P&L across all bots on this game: ${pnlSign}$${(gamePnl/100).toFixed(2)}`;
        badgeWrap.appendChild(pnlBadge);
    }

    const gameDate = parseGameDate(eventData.gameId);
    if (gameDate) {
        const dateBadge = document.createElement('span');
        dateBadge.style.cssText = 'color: #6a7488; font-size: 11px;';
        dateBadge.textContent = `📅 ${gameDate}`;
        badgeWrap.appendChild(dateBadge);
    }
    
    // Tennis round badge + estimated start time
    if (sport === 'Tennis' && eventData.markets.length > 0) {
        const roundMatch = (eventData.markets[0].title || '').match(/(Round\s+Of\s+\d+|Quarterfinal|Semifinal|Final)/i);
        if (roundMatch) {
            const roundBadge = document.createElement('span');
            roundBadge.style.cssText = 'background: #1a2a3a; color: #60a5fa; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600;';
            roundBadge.textContent = roundMatch[1].replace('Round Of ', 'R');
            badgeWrap.appendChild(roundBadge);
        }
        // Show estimated start time from expected_expiration - 2.5h
        const expStr = eventData.markets[0].expected_expiration_time;
        if (expStr) {
            const expTime = new Date(expStr);
            const estStart = new Date(expTime.getTime() - (2.5 * 60 * 60 * 1000));
            const nowMs = Date.now();
            const timeBadge = document.createElement('span');
            if (nowMs < estStart.getTime()) {
                // Match hasn't started — show estimated start time
                const hrs = estStart.getHours();
                const mins = estStart.getMinutes();
                const ampm = hrs >= 12 ? 'PM' : 'AM';
                const h12 = hrs % 12 || 12;
                const timeStr = `${h12}:${String(mins).padStart(2,'0')} ${ampm}`;
                timeBadge.style.cssText = 'background:#1a1a2e;color:#8892a6;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:600;';
                timeBadge.textContent = `⏰ ~${timeStr}`;
                timeBadge.title = 'Estimated start time (from Kalshi expiration)';
            } else {
                // Match has likely started — show LIVE if no ESPN score
                if (!liveScore && kalshiLive) {
                    timeBadge.style.cssText = 'background:#ff333322;color:#ff4444;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;';
                    timeBadge.innerHTML = '<span style="animation:pulse 1.5s infinite;">●</span> LIVE';
                }
            }
            if (timeBadge.textContent || timeBadge.innerHTML) badgeWrap.appendChild(timeBadge);
        }
    }
    // Signal badge removed — ghost recommendation icons replace signal labels
    header.appendChild(badgeWrap);
    card.appendChild(header);

    // ── Scoreboard widget (live score / pregame time / final score) ──
    if (gameScore && !(gameScore.state === 'pre' && kalshiLive)) {
        // Show scoreboard unless ESPN says pregame but Kalshi market is already live
        const scoreboard = buildScoreboard(gameScore);
        if (scoreboard) card.appendChild(scoreboard);
    } else if (kalshiLive) {
        // No ESPN data (or ESPN still says pregame) but Kalshi says it's live
        const liveBanner = document.createElement('div');
        liveBanner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#0a1a0a,#0f1f12);border:1px solid #00ff88;border-radius:8px;padding:10px 16px;margin-bottom:12px;';
        liveBanner.innerHTML = `<span style="color:#ff3333;font-size:10px;font-weight:800;letter-spacing:1px;display:flex;align-items:center;gap:4px;"><span style="animation:pulse 1.5s infinite;">●</span> LIVE</span><span style="color:#8892a6;font-size:12px;">Score unavailable</span>`;
        card.appendChild(liveBanner);
    } else if (gameScore) {
        // Pregame scoreboard (no Kalshi activity)
        const scoreboard = buildScoreboard(gameScore);
        if (scoreboard) card.appendChild(scoreboard);
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
    const cols = isProp ? '1fr 80px 80px auto' : 'minmax(120px, 2fr) 1fr 1fr auto';
    row.style.cssText = `display: grid; grid-template-columns: ${cols}; gap: 8px; align-items: center; padding: 8px; background: #0f1419; border-radius: 6px;`;
    
    // Market label — trust the caller's label (they compute the right one)
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = 'font-size: 13px; font-weight: 600; color: #8892a6; overflow: visible; min-width: 0;';

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

    const liq = getMarketLiquidity(market);

    // ── Active bot type icons + recommendations on own line ──
    const botTypes = (window._botTypeMap || {})[market.ticker] || {};
    const phDetails = (window._phantomDetailMap || {})[market.ticker] || [];
    const activeBotTypes = Object.keys(botTypes);
    // Shared icon row: active bots + recommendations share one flex-wrap line
    const iconRow = document.createElement('div');
    iconRow.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:4px;';
    let hasIcons = false;
    if (activeBotTypes.length > 0) {
        hasIcons = true;
        const botOrder = ['apex','phantom','meridian','scout'];
        for (const bt of botOrder.filter(b => activeBotTypes.includes(b))) {
            if (bt === 'phantom' && phDetails.length > 0) {
                const sameMkt = phDetails.filter(p => !p.cross);
                const crossMkt = phDetails.filter(p => p.cross);
                if (sameMkt.length > 0) {
                    const c = BOT_COLORS['phantom'] || '#ffaa00';
                    const pill = document.createElement('span');
                    pill.style.cssText = `display:inline-flex;align-items:center;gap:2px;padding:2px 6px;background:${c}22;border:1px solid ${c}55;border-radius:4px;font-size:9px;font-weight:700;color:${c};`;
                    pill.innerHTML = `${botIconImg('phantom', 14)} <span style="font-size:8px;">=</span>`;
                    pill.title = 'Phantom active (same market)';
                    iconRow.appendChild(pill);
                }
                for (const ph of crossMkt) {
                    const sideChar = ph.side === 'yes' ? 'Y' : ph.side === 'no' ? 'N' : '?';
                    const sideCol = ph.side === 'yes' ? '#00ff88' : '#ff4444';
                    const pill = document.createElement('span');
                    pill.style.cssText = `display:inline-flex;align-items:center;gap:3px;padding:2px 6px;background:#00ddff15;border:1px solid #00ddff55;border-radius:4px;font-size:9px;font-weight:800;`;
                    pill.innerHTML = `${botIconImg('phantom', 14)}<span style="color:#00ddff;">✕</span><span style="color:${sideCol};font-weight:900;">${sideChar}</span>`;
                    pill.title = `Cross-market Phantom ${ph.side.toUpperCase()}${ph.isHedgeSide ? ' [hedge side]' : ''}`;
                    iconRow.appendChild(pill);
                }
            } else {
                const c = BOT_COLORS[bt] || '#818cf8';
                const n = botTypes[bt];
                const pill = document.createElement('span');
                pill.style.cssText = `display:inline-flex;align-items:center;gap:2px;padding:2px 6px;background:${c}22;border:1px solid ${c}55;border-radius:4px;font-size:9px;font-weight:700;color:${c};`;
                pill.innerHTML = `${botIconImg(bt, 14)}${n > 1 ? n : ''}`;
                pill.title = `${n} active ${bt} bot${n > 1 ? 's' : ''}`;
                iconRow.appendChild(pill);
            }
        }
    }

    // ── Bot recommendation icons (dimmed) ──
    const recoTypes = [];
    // Apex: quality score 0-100 — spread tightness + balance + live + volume
    if (liq.yesBid > 0 && liq.noBid > 0 && !botTypes.apex) {
        const bidSum = liq.yesBid + liq.noBid;
        const priceLean = Math.abs(liq.yesBid - liq.noBid);
        const isLiveGame = isKalshiLive(market);
        const ySpr = liq.yesSpread;
        const nSpr = liq.noSpread;
        const aq = liq.apexQuality;
        const spreadVal = Math.min(ySpr, nSpr);
        const isWideSpread = ySpr > 5 && nSpr > 5;
        const leanLabel = priceLean <= 10 ? 'coin-flip' : priceLean <= 25 ? 'lean game' : 'strong lean';
        const balPct = Math.round((liq.balance || 0) * 100);
        // Show recommendation for any live market with reasonable lean — gapped spreads get WIDE label + wider width recs
        if (aq >= 15 && priceLean <= 40 && bidSum >= 80) {
            const qualLabel = aq >= 60 ? '🟢' : aq >= 35 ? '🟡' : '🔴';
            const _aqLabelColor = aq >= 60 ? '#00ff88' : aq >= 35 ? '#ffaa00' : '#ff4444';
            const _spreadColor = spreadVal > 10 ? '#ff4444' : spreadVal > 5 ? '#ffaa00' : '#00ff88';
            const _widthHint = isWideSpread ? (spreadVal > 10 ? ' 10¢+' : ' 8¢+') : '';
            recoTypes.push({
                type: 'apex',
                label: `${qualLabel}${aq} <span style="color:${_spreadColor};font-size:7px;">${spreadVal}¢${_widthHint}</span>`,
                labelColor: _aqLabelColor,
                tip: `Apex: ${leanLabel} ${liq.yesBid}/${liq.noBid}¢ · spread ${spreadVal}¢${isWideSpread ? ` (use ${spreadVal > 10 ? '10' : '8'}¢+ widths)` : ''} · balance ${balPct}% · vol ${liq.vol} · ${qualLabel} ${aq}/100`,
            });
        }
    }
    // Phantom: clear fav/dog split, dog cheap enough for multi-rung ladder,
    // arb math works, lowest rung won't hit 1¢ floor, AND spread tight enough for instant hedge
    if (!botTypes.phantom) {
        const dogPrice = Math.min(liq.yesBid, liq.noBid);
        const favBid = Math.max(liq.yesBid, liq.noBid);
        const hedgeRoom = 98 - dogPrice - (100 - favBid);
        const lowestRung = dogPrice - 4;
        const spread = liq.avgSpread;  // YES spread = NO spread on binary tickers
        const dogSideLabel = liq.dogSide.toUpperCase();
        const pq = liq.phantomQuality;
        if (dogPrice >= 7 && dogPrice <= 35 && lowestRung >= 3 && favBid >= 55 && hedgeRoom >= 2 && spread <= 5) {
            const liqLabel = spread <= 2 ? 'thick' : spread <= 3 ? 'good' : 'ok';
            const qualLabel = pq >= 60 ? '🟢' : pq >= 35 ? '🟡' : '🔴';
            const _phLabel = `${qualLabel}${pq}`;
            const _phLabelColor = pq >= 60 ? '#00ff88' : pq >= 35 ? '#ffaa00' : '#ff4444';
            recoTypes.push({ type: 'phantom', label: _phLabel, labelColor: _phLabelColor, tip: `Phantom: ${dogSideLabel} dog at ${dogPrice}¢, ~${hedgeRoom}¢ room · spread ${spread}¢ (${liqLabel}) · ${qualLabel} ${pq}/100` });
        } else if (dogPrice >= 7 && dogPrice <= 35 && favBid >= 55 && hedgeRoom >= 2 && spread > 5 && spread <= 8) {
            recoTypes.push({ type: 'phantom', label: '⚠️', labelColor: '#ff8800', tip: `Phantom: ${dogSideLabel} dog at ${dogPrice}¢ — ⚠️ spread ${spread}¢ (thin, hedge may not catch)` });
        }
    }
    const middleReco = (window._middleRecoMap || {})[market.ticker];
    if (middleReco && !botTypes.meridian) {
        recoTypes.push({ type: 'meridian', tip: `Meridian: ${middleReco.tip}` });
    }
    if (recoTypes.length > 0) {
        hasIcons = true;
        for (const r of recoTypes) {
            const c = BOT_COLORS[r.type] || '#888';
            const pill = document.createElement('span');
            pill.style.cssText = `display:inline-flex;align-items:center;gap:2px;padding:2px 6px;border:1px dashed ${c}88;border-radius:4px;opacity:0.75;`;
            pill.innerHTML = botIconImg(r.type, 14, 0.75);
            if (r.label) {
                pill.innerHTML += `<span class="ghost-label" style="font-size:8px;color:${r.labelColor || c};font-weight:700;">${r.label}</span>`;
            }
            pill.title = r.tip;
            if (r.type === 'phantom') pill.setAttribute('data-ghost-ticker', market.ticker);
            iconRow.appendChild(pill);
        }
    }
    if (hasIcons) labelDiv.appendChild(iconRow);
    
    // Read all prices first for cross-referencing
    const yesBid = getPrice(market, 'yes_bid');
    const yesAsk = getPrice(market, 'yes_ask');
    const noBid = getPrice(market, 'no_bid');
    const noAsk = getPrice(market, 'no_ask');

    // Suppress phantom asks: 100¢ ask when opposite side has no bids = no real liquidity
    // Fall back to same-side bid (what the order book actually shows)
    const yesPrice = (yesAsk >= 99 && noBid <= 1) ? yesBid : (yesAsk > 0 ? yesAsk : 0);
    const noPrice = (noAsk >= 99 && yesBid <= 1) ? noBid : (noAsk > 0 ? noAsk : 0);

    // Market tier for button brightness: spread quality is what matters, not bid sum.
    // bid_sum > 100 is normal (99% of markets) — don't dim them.
    const bidSum = (yesBid || 0) + (noBid || 0);
    const yesSpread = yesAsk > 0 && yesBid > 0 ? yesAsk - yesBid : 99;
    const noSpread  = noAsk  > 0 && noBid  > 0 ? noAsk  - noBid  : 99;
    const avgSpread = (yesSpread + noSpread) / 2;
    const mktTier = avgSpread <= 3 ? 'tight'
                  : avgSpread <= 8 ? 'medium'
                  : 'wide';

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
// marketTier: 'tight' | 'medium' | 'wide'
//   tight  = bid/ask spread ≤ 3¢ → full glow, solid border (best fills)
//   medium = spread 4-8¢ → moderate glow (normal market)
//   wide   = spread > 8¢ → slightly muted (thin liquidity)
function getPriceButtonStyle(price, side, marketTier) {
    const yesBase = '#00ff88';
    const noBase  = '#ff4444';
    const color   = side === 'yes' ? yesBase : noBase;

    if (marketTier === 'wide') {
        // Wide spread — thin liquidity, slightly muted but still visible
        return `background: rgba(${side==='yes'?'0,255,136':'255,68,68'},0.08); color: ${color}99; border: 1px solid ${color}44;`;
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
        const response = await fetch(`${API_BASE}/orderbook/${ticker}?_=${Date.now()}`);
        const data = await response.json();

        if (data.error) {
            document.getElementById('orderbook-ladder').innerHTML = `<p style="color: #ff4444;">Error: ${data.error}</p>`;
            return;
        }

        // Kalshi returns { orderbook: { yes: [[p,q],...], no: [[p,q],...] } }
        data.ticker = ticker;
        displayOrderbookLadder(data);
    } catch (error) {
        console.error('Error fetching orderbook:', error);
        document.getElementById('orderbook-ladder').innerHTML = `<p style="color: #ff4444;">${error.message || 'Network error'}</p>`;
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

    // ── Compute depth scores and update quality badges ──
    // Same 10¢ window for both sides so numbers are directly comparable
    const DEPTH_WINDOW = 10;

    // Contracts-per-level + gap analysis for each side
    function _analyzeSide(orders, bestBid) {
        let totalQty = 0, levels = 0, gaps = 0;
        const filledCents = new Set();
        if (!bestBid) return { totalQty: 0, levels: 0, gaps: 0, perLevel: 0, top3Qty: 0, wallByDepth: {} };
        let top3Qty = 0, top3Count = 0;
        // Wall analysis: contracts between bid and bid-N for each depth level
        const wallByDepth = {};
        for (const o of orders) {
            const { price, qty } = parseOrderLevel(o);
            if (price < bestBid - DEPTH_WINDOW) continue;
            totalQty += qty;
            levels++;
            filledCents.add(price);
            if (top3Count < 3) { top3Qty += qty; top3Count++; }
        }
        // Build wall: how many contracts sit between bid and bid-depth (exclusive of bid-depth)
        for (let d = 3; d <= 8; d++) {
            let wall = 0;
            for (const o of orders) {
                const { price, qty } = parseOrderLevel(o);
                if (price > bestBid - d && price <= bestBid) wall += qty;
            }
            wallByDepth[d] = wall;
        }
        // Count gaps: missing cents between bestBid and bestBid - DEPTH_WINDOW
        for (let c = bestBid; c >= bestBid - DEPTH_WINDOW && c >= 1; c--) {
            if (!filledCents.has(c)) gaps++;
        }
        const perLevel = levels > 0 ? Math.round(totalQty / levels) : 0;
        return { totalQty, levels, gaps, perLevel, top3Qty, wallByDepth };
    }

    const yesAnalysis = _analyzeSide(yesOrders, bestYesBid);
    const noAnalysis = _analyzeSide(noOrders, bestNoBid);
    const yesDepth = yesAnalysis.totalQty;
    const noDepth = noAnalysis.totalQty;
    const minDepth = Math.min(yesDepth, noDepth);

    // Identify dog/fav sides for phantom context
    const dogSideOb = bestYesBid < bestNoBid ? 'yes' : 'no';
    const favSideOb = dogSideOb === 'yes' ? 'no' : 'yes';
    const dogDepth = dogSideOb === 'yes' ? yesDepth : noDepth;
    const favDepth = dogSideOb === 'yes' ? noDepth : yesDepth;
    const dogAnalysis = dogSideOb === 'yes' ? yesAnalysis : noAnalysis;
    const favAnalysis = dogSideOb === 'yes' ? noAnalysis : yesAnalysis;

    // Show depth from PHANTOM perspective: DOG on left, FAV on right
    const dogSideLabel = dogSideOb.toUpperCase();
    const favSideLabel = favSideOb.toUpperCase();
    const dogBidPrice = dogSideOb === 'yes' ? bestYesBid : bestNoBid;
    const favBidPrice = favSideOb === 'yes' ? bestYesBid : bestNoBid;
    const dogCol = dogSideOb === 'yes' ? '#00ff88' : '#ff4444';
    const favCol = favSideOb === 'yes' ? '#00ff88' : '#ff4444';

    // Hedge room display (informational only — not used in score)
    const hedgeRoom = (dogBidPrice && favBidPrice) ? 100 - dogBidPrice - favBidPrice : 0;

    // ── CATCH SCORE (0-100) — can the hedge fill? will sweeps reach you? ──
    // Fav contracts/level (55pts) — THE key factor, determines if hedge fills
    const _favPL = favAnalysis.perLevel;
    const favPLpts = _favPL >= 50 ? 55 : _favPL >= 30 ? 45 : _favPL >= 20 ? 35 : _favPL >= 10 ? 22 : _favPL >= 5 ? 10 : 0;
    // Dog thinness (25pts) — thin dog = sweeps reach your order easily
    const dogThinPts = dogDepth < 50 ? 25 : dogDepth < 200 ? 18 : dogDepth < 500 ? 10 : dogDepth < 2000 ? 5 : 0;
    // Fav gaps penalty — gaps mean sweeps crash through, need wider depth floor
    const gapPenalty = favAnalysis.gaps >= 3 ? -15 : favAnalysis.gaps >= 2 ? -10 : favAnalysis.gaps >= 1 ? -5 : 0;
    // Fav dominance bonus (10pts) — fav much thicker than dog = hedge absorbs, dog sweeps easier
    const favDomPts = favDepth > dogDepth * 3 ? 10 : favDepth > dogDepth * 2 ? 5 : 0;
    // Fav top-3 liquidity (10pts) — enough contracts at top bids to absorb your hedge
    const favTop3Pts = favAnalysis.top3Qty >= 100 ? 10 : favAnalysis.top3Qty >= 30 ? 5 : 0;
    // Max safe qty: fav top-3 bids can absorb your hedge
    const maxSafeQty = Math.max(1, Math.floor(favAnalysis.top3Qty / 2));

    const catchScore = Math.min(100, Math.max(0, Math.round(favPLpts + dogThinPts + gapPenalty + favDomPts + favTop3Pts)));
    const catchLabel = catchScore >= 70 ? 'HIGH CATCH' : catchScore >= 40 ? 'OK CATCH' : 'LOW CATCH';
    const catchCol = catchScore >= 70 ? '#00ff88' : catchScore >= 40 ? '#ffaa00' : '#ff4444';

    // Quality notes
    const dogNote = dogDepth < 50 ? 'thin — easy fill' : dogDepth < 200 ? 'moderate' : dogDepth < 500 ? 'busy' : 'crowded';
    const favNote = _favPL >= 20 ? 'thick — easy catch' : _favPL >= 10 ? 'ok — hedge should catch' : _favPL >= 5 ? 'light — hedge may lag' : 'thin — hedge may miss';

    // Store for ghost score updates + depth rec + bot creation
    const depthPts = minDepth >= 500 ? 35 : minDepth >= 200 ? 30 : minDepth >= 100 ? 22 : minDepth >= 50 ? 14 : minDepth >= 20 ? 8 : 0;
    const ticker = ob._ticker || '';
    if (ticker || (orderbook.ticker)) {
        const tk = ticker || orderbook.ticker;
        window._obDepthCache = window._obDepthCache || {};
        window._obDepthCache[tk] = {
            yesDepth3: yesDepth, noDepth3: noDepth, minDepth, depthPts,
            dogDepth, favDepth, dogBid: dogBidPrice, favBid: favBidPrice,
            dogPerLevel: dogAnalysis.perLevel, favPerLevel: favAnalysis.perLevel,
            dogGaps: dogAnalysis.gaps, favGaps: favAnalysis.gaps,
            favTop3: favAnalysis.top3Qty, maxSafeQty,
            dogWall: dogAnalysis.wallByDepth,
            hedgeRoom, catchScore,
            ts: Date.now()
        };
        _updateGhostPill(tk, catchScore);
    }

    // Score breakdown tooltip
    const _scoreBreakdown = `Fav ${_favPL}/lvl: ${favPLpts}pts · Dog: ${dogThinPts}pts · Gaps: ${gapPenalty}pts · FavDom: ${favDomPts}pts · Top3: ${favTop3Pts}pts`;

    const depthHtml = `<div style="background:#0f1419;border:1px solid #1e2740;border-radius:8px;padding:10px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="color:#8892a6;font-size:11px;font-weight:600;">DEPTH WITHIN ${DEPTH_WINDOW}¢</span>
            <span style="color:${catchCol};font-weight:800;font-size:12px;" title="${_scoreBreakdown}">${botIconImg('phantom', 14)} ${catchLabel} ${catchScore}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="text-align:center;background:${dogCol}08;border:1px solid ${dogCol}22;border-radius:6px;padding:6px;">
                <div style="color:${dogCol};font-size:9px;font-weight:700;margin-bottom:2px;">DOG · ${dogSideLabel} @ ${dogBidPrice}¢</div>
                <div style="color:${dogCol};font-weight:800;font-size:18px;">${dogDepth.toLocaleString()}</div>
                <div style="color:${dogCol};font-size:8px;font-weight:600;">${dogAnalysis.perLevel}/lvl · ${dogAnalysis.gaps} gaps</div>
                <div style="color:${dogCol};font-size:8px;">${dogNote}</div>
            </div>
            <div style="text-align:center;background:${favCol}08;border:1px solid ${favCol}22;border-radius:6px;padding:6px;">
                <div style="color:${favCol};font-size:9px;font-weight:700;margin-bottom:2px;">FAV · ${favSideLabel} @ ${favBidPrice}¢</div>
                <div style="color:${favCol};font-weight:800;font-size:18px;">${favDepth.toLocaleString()}</div>
                <div style="color:${favCol};font-size:8px;font-weight:600;">${favAnalysis.perLevel}/lvl · ${favAnalysis.gaps} gaps</div>
                <div style="color:${favCol};font-size:8px;">${favNote}</div>
            </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid #1e274033;">
            <span style="color:#8892a6;font-size:9px;">Room: <span style="color:${hedgeRoom >= 3 ? '#00ff88' : '#ff4444'};font-weight:700;">${hedgeRoom}¢</span></span>
            <span style="color:#8892a6;font-size:9px;">Max qty: <span style="color:#ffaa00;font-weight:700;">${maxSafeQty}</span> <span style="color:#555;">(fav top3: ${favAnalysis.top3Qty})</span></span>
        </div>
    </div>`;
    const ladderEl = document.getElementById('orderbook-ladder');
    if (ladderEl) ladderEl.insertAdjacentHTML('afterbegin', depthHtml);
}

// Update ghost recommendation pill on market card after depth is computed
function _updateGhostPill(ticker, catchScore) {
    const pill = document.querySelector(`[data-ghost-ticker="${ticker}"]`);
    if (!pill) return;
    const col = catchScore >= 70 ? '#00ff88' : catchScore >= 40 ? '#ffaa00' : '#ff4444';
    const qualLabel = catchScore >= 70 ? '🟢' : catchScore >= 40 ? '🟡' : '🔴';
    const labelEl = pill.querySelector('.ghost-label');
    if (labelEl) {
        labelEl.textContent = `${qualLabel}${catchScore}`;
        labelEl.style.color = col;
    }
    // Update tooltip with depth info
    const cache = (window._obDepthCache || {})[ticker];
    if (cache) {
        pill.title = `Phantom: catch ${catchScore}/100 · fav depth ${cache.favDepth.toLocaleString()} · dog depth ${cache.dogDepth.toLocaleString()} (from orderbook)`;
    }
    // Flash the pill to show it updated
    pill.style.opacity = '1';
    pill.style.borderStyle = 'solid';
    setTimeout(() => { pill.style.opacity = '0.75'; pill.style.borderStyle = 'dashed'; }, 2000);
}


// Search functionality (delegates to applyFilters to respect sport pill too)
function setupSearch() {
    const searchBox = document.getElementById('search-box');
    if (!searchBox) return;
    searchBox.addEventListener('input', () => applyFilters());
}

// Load recently closed games
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

        let favAskShave = Math.floor(askShave * 0.6);  // shave more from fav (liquid side absorbs it)
        let dogAskShave = askShave - favAskShave;        // shave less from dog (keep it close to bid, fills easier)

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
        let favShave = Math.floor(totalShave * 0.6);   // more shave on favorite — liquid side absorbs it
        let dogShave = totalShave - favShave;           // less shave on underdog — keep it close to bid for fills

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
    const anchorSection = document.getElementById('anchor-section');
    const straightBtn = document.getElementById('mode-straight');
    const arbBtn = document.getElementById('mode-arb');
    const middleBtn = document.getElementById('mode-middle');
    const anchorBtn = document.getElementById('mode-anchor');
    const iconEl = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-mode-title');
    const subtitleEl = document.getElementById('modal-mode-subtitle');

    // Hide all, deactivate all
    if (straightSection) straightSection.style.display = 'none';
    if (arbSection) arbSection.style.display = 'none';
    if (middleSection) middleSection.style.display = 'none';
    if (anchorSection) anchorSection.style.display = 'none';
    [straightBtn, arbBtn, middleBtn, anchorBtn].forEach(btn => {
        if (btn) { btn.style.background = 'transparent'; btn.style.color = '#8892a6'; btn.style.borderBottom = '2px solid transparent'; }
    });

    if (mode === 'straight') {
        if (straightSection) straightSection.style.display = 'block';
        if (straightBtn) { straightBtn.style.background = '#00ff8822'; straightBtn.style.color = '#00ff88'; straightBtn.style.borderBottom = '2px solid #00ff88'; }
        iconEl.textContent = '◎';
        titleEl.textContent = 'Scout';
        subtitleEl.textContent = 'Limit Order';
    } else if (mode === 'middle') {
        if (middleSection) middleSection.style.display = 'block';
        if (middleBtn) { middleBtn.style.background = '#aa66ff22'; middleBtn.style.color = '#aa66ff'; middleBtn.style.borderBottom = '2px solid #aa66ff'; }
        iconEl.textContent = '◈';
        titleEl.textContent = 'Meridian Bot';
        subtitleEl.textContent = 'Dual-Spread Automation';
        updateMiddleBotCalc();
    } else if (mode === 'anchor') {
        if (anchorSection) anchorSection.style.display = 'block';
        if (anchorBtn) { anchorBtn.style.background = '#ffaa0022'; anchorBtn.style.color = '#ffaa00'; anchorBtn.style.borderBottom = '2px solid #ffaa00'; }
        iconEl.textContent = '🎯';
        titleEl.textContent = 'Phantom Bot';
        subtitleEl.textContent = 'Volatility Capture · Maker Only';
        // Restore last-used phantom settings from localStorage (or default to 0)
        let _savedPhantom = null;
        try { _savedPhantom = JSON.parse(localStorage.getItem('phantom_settings')); } catch (e) {}
        const depthEl = document.getElementById('anchor-depth');
        if (depthEl) depthEl.value = _savedPhantom?.depth ?? 0;
        // Restore repeat count + smart mode
        const repeatEl = document.getElementById('anchor-repeat-count');
        if (repeatEl && _savedPhantom?.repeatCount != null) repeatEl.value = _savedPhantom.repeatCount;
        const smartEl = document.getElementById('anchor-smart-mode');
        if (smartEl && _savedPhantom?.smartMode != null) smartEl.checked = _savedPhantom.smartMode;
        // Reset cross-market toggle (market-specific, don't persist)
        _anchorCrossMarketTicker = null;
        _anchorCrossMarketSide = 'yes';
        const crossToggle = document.getElementById('anchor-cross-market');
        if (crossToggle && crossToggle.checked) {
            crossToggle.checked = false;
            crossToggle.dispatchEvent(new Event('change'));
        }
        // Fresh start: clear old rungs so auto-add fires, clear stuck focus flag
        _anchorRungs = [];
        window._anchorInputFocused = false;
        initAnchorDogPrices();
        renderAnchorRungs(true);  // Force initial render (non-force can skip on mobile)
        // Apply saved base qty to first rung after render
        if (_savedPhantom?.baseQty > 1 && _anchorRungs.length > 0) {
            _anchorRungs[0].qty = _savedPhantom.baseQty;
            renderAnchorRungs(true);
        }
    } else {
        // arb
        if (arbSection) arbSection.style.display = 'block';
        if (arbBtn) { arbBtn.style.background = '#00ff8822'; arbBtn.style.color = '#00ff88'; arbBtn.style.borderBottom = '2px solid #00ff88'; }
        iconEl.textContent = '⚡';
        titleEl.textContent = 'Apex Bot';
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

// ── Anchor-Dog / Ladder Helpers ──────────────────────────────────────────────
let _anchorDogBid = 0;   // cached dog bid from orderbook
let _anchorDogAsk = 0;   // cached dog ask
let _anchorDogSide = '';  // 'yes' or 'no' (auto-detected)
let _anchorFavBid = 0;
let _anchorFavSide = '';
let _anchorIsBrokenSpread = false;
let _anchorRungs = [];    // [{price, qty, offset}] — single rung only
let _anchorAutoPrice = true;  // auto-adjust rung price to market
let _anchorCrossMarketTicker = null;  // opposing team's ticker when cross-market is on
let _anchorCrossMarketSide = 'yes';   // which side to buy on both tickers in cross-market mode
let _anchorCrossMarketSwapped = false; // true when opposing ticker is cheaper (becomes the anchor)

function _isMoneylineMarket(ticker) {
    // Moneyline markets have "GAME" in the series_ticker or ticker (not SPREAD, TOTAL, etc.)
    if (!ticker) return false;
    const series = currentArbMarket?.series_ticker || '';
    if (series && /GAME|MATCH/i.test(series)) return true;
    return /GAME/i.test(ticker);
}

function _findOpposingMoneylineTicker(ticker) {
    // Moneyline tickers: KXNBAGAME-26MAR23PHXLAL-PHX → gameBase = KXNBAGAME-26MAR23PHXLAL
    // Find another ticker with same gameBase but different team suffix
    if (!ticker) return null;
    const parts = ticker.split('-');
    if (parts.length < 3) return null;
    const gameBase = parts.slice(0, -1).join('-'); // e.g., "KXNBAGAME-26MAR23PHXLAL"

    // Search allMarkets for a sibling with same game base
    if (typeof allMarkets !== 'undefined' && allMarkets.length > 0) {
        for (const m of allMarkets) {
            if (m.ticker && m.ticker !== ticker && m.ticker.startsWith(gameBase + '-')) {
                return m.ticker;
            }
        }
    }
    // Fallback: check event_ticker grouping
    if (currentArbMarket?.event_ticker) {
        const eventTicker = currentArbMarket.event_ticker;
        for (const m of allMarkets) {
            if (m.ticker && m.ticker !== ticker && m.event_ticker === eventTicker) {
                return m.ticker;
            }
        }
    }
    return null;
}

function setCrossMarketSide(side) {
    _anchorCrossMarketSide = side;
    const yesBtn = document.getElementById('cross-side-yes');
    const noBtn = document.getElementById('cross-side-no');
    if (side === 'yes') {
        if (yesBtn) { yesBtn.style.background = '#00ff8822'; yesBtn.style.border = '2px solid #00ff88'; yesBtn.style.color = '#00ff88'; }
        if (noBtn)  { noBtn.style.background = 'transparent'; noBtn.style.border = '2px solid #ff444444'; noBtn.style.color = '#ff444466'; }
    } else {
        if (noBtn)  { noBtn.style.background = '#ff444422'; noBtn.style.border = '2px solid #ff4444'; noBtn.style.color = '#ff4444'; }
        if (yesBtn) { yesBtn.style.background = 'transparent'; yesBtn.style.border = '2px solid #00ff8844'; yesBtn.style.color = '#00ff8866'; }
    }
    // Recalculate preview with new side
    initAnchorDogPrices();
}

// Wire up cross-market toggle handler (deferred until DOM ready)
(function _initCrossMarketToggle() {
    const el = document.getElementById('anchor-cross-market');
    if (!el) { setTimeout(_initCrossMarketToggle, 500); return; }
    if (el._crossHandlerBound) return;
    el._crossHandlerBound = true;
    el.addEventListener('change', function() {
        const isOn = this.checked;
        const slider = document.getElementById('anchor-cross-slider');
        const knob = document.getElementById('anchor-cross-knob');
        const label = document.getElementById('anchor-cross-label');
        const detail = document.getElementById('anchor-cross-detail');
        // Toggle visual state
        if (slider) slider.style.background = isOn ? '#64ffda' : '#333';
        if (knob) knob.style.transform = isOn ? 'translateX(22px)' : 'translateX(0)';
        if (label) { label.textContent = isOn ? 'Cross Market' : 'Same Market'; label.style.color = isOn ? '#64ffda' : '#5a6484'; }
        if (detail) detail.style.display = isOn ? '' : 'none';
        if (isOn) {
            const opposingTicker = _findOpposingMoneylineTicker(currentArbMarket?.ticker);
            if (opposingTicker) {
                document.getElementById('cross-ticker-a').textContent = currentArbMarket.ticker.split('-').pop();
                document.getElementById('cross-ticker-b').textContent = opposingTicker.split('-').pop();
                _anchorCrossMarketTicker = opposingTicker;
            } else {
                document.getElementById('cross-ticker-a').textContent = currentArbMarket?.ticker?.split('-').pop() || '?';
                document.getElementById('cross-ticker-b').textContent = 'not found';
                _anchorCrossMarketTicker = null;
            }
        } else {
            _anchorCrossMarketTicker = null;
        }
        initAnchorDogPrices();
    });
})();

function initAnchorDogPrices() {
    if (!currentArbMarket) return;

    // Show/hide cross-market toggle based on moneyline detection
    const crossRow = document.getElementById('anchor-cross-market-row');
    if (crossRow) {
        crossRow.style.display = _isMoneylineMarket(currentArbMarket.ticker) ? '' : 'none';
    }

    const isCrossMode = !!_anchorCrossMarketTicker && document.getElementById('anchor-cross-market')?.checked;

    const yesBid = getPrice(currentArbMarket, 'yes_bid') || 0;
    const noBid  = getPrice(currentArbMarket, 'no_bid') || 0;
    const yesAsk = getPrice(currentArbMarket, 'yes_ask') || 0;
    const noAsk  = getPrice(currentArbMarket, 'no_ask') || 0;

    // Cross-market: look up opposing ticker prices
    let _oppMkt = null;
    let _oppBid = 0, _oppAsk = 0;
    if (isCrossMode && _anchorCrossMarketTicker) {
        _oppMkt = allMarkets.find(m => m.ticker === _anchorCrossMarketTicker);
        if (_oppMkt) {
            _oppBid = _anchorCrossMarketSide === 'yes'
                ? (getPrice(_oppMkt, 'yes_bid') || 0) : (getPrice(_oppMkt, 'no_bid') || 0);
            _oppAsk = _anchorCrossMarketSide === 'yes'
                ? (getPrice(_oppMkt, 'yes_ask') || 0) : (getPrice(_oppMkt, 'no_ask') || 0);
        }
    }

    if (isCrossMode) {
        // Cross-market: both sides use the same chosen side (YES or NO)
        _anchorDogSide = _anchorCrossMarketSide;
        _anchorFavSide = _anchorCrossMarketSide;
        // Dog = whichever ticker is CHEAPER on the chosen side (the anchor)
        const thisBid = _anchorCrossMarketSide === 'yes' ? yesBid : noBid;
        if (_oppBid > 0 && _oppBid < thisBid) {
            // Opposing ticker is cheaper — swap: opposing becomes anchor, this becomes hedge
            _anchorCrossMarketSwapped = true;
            _anchorDogBid = _oppBid;
            _anchorFavBid = thisBid;
        } else {
            _anchorCrossMarketSwapped = false;
            _anchorDogBid = thisBid;
            _anchorFavBid = _oppBid;
        }
    } else {
        _anchorCrossMarketSwapped = false;
        _anchorDogSide = noBid <= yesBid ? 'no' : 'yes';
        _anchorFavSide = _anchorDogSide === 'yes' ? 'no' : 'yes';
        _anchorDogBid = _anchorDogSide === 'yes' ? yesBid : noBid;
        _anchorFavBid = _anchorFavSide === 'yes' ? yesBid : noBid;
    }
    const dogAsk = isCrossMode
        ? (_anchorCrossMarketSwapped ? (_oppAsk || _oppBid + 1) : (_anchorDogSide === 'yes' ? yesAsk : noAsk))
        : (_anchorDogSide === 'yes' ? yesAsk : noAsk);
    const favAsk = isCrossMode
        ? (_anchorCrossMarketSwapped ? (_anchorDogSide === 'yes' ? yesAsk : noAsk) : (_oppAsk || _oppBid + 1))
        : (_anchorFavSide === 'yes' ? yesAsk : noAsk);

    // Store raw prices for preview calculations
    _anchorDogAsk = dogAsk;
    const spread = dogAsk > 0 ? (dogAsk - _anchorDogBid) : 1;
    _anchorIsBrokenSpread = spread > 1;
    const anchorBase = _anchorIsBrokenSpread ? dogAsk : _anchorDogBid;

    // Calculate smart price using depth floor slider directly
    const depthSlider = document.getElementById('anchor-depth');
    const anchorDepth = parseInt(depthSlider?.value) || 5;
    const smartPrice = Math.max(1, anchorBase - anchorDepth);

    // Populate display
    const dogSideEl = document.getElementById('anchor-auto-dog-side');
    const dogBidEl  = document.getElementById('anchor-auto-dog-bid');
    const favSideEl = document.getElementById('anchor-auto-fav-side');
    const favBidEl  = document.getElementById('anchor-auto-fav-bid');
    const sidesDisplay = document.getElementById('anchor-sides-display');

    if (isCrossMode) {
        // Cross-market: show both tickers with bid/ask, dog properly identified
        const rawTeamA = currentArbMarket.ticker.split('-').pop() || '?';
        const rawTeamB = (_anchorCrossMarketTicker || '').split('-').pop() || '?';
        // If swapped, opposing ticker is the anchor (dog)
        const anchorTeam = _anchorCrossMarketSwapped ? rawTeamB : rawTeamA;
        const hedgeTeam = _anchorCrossMarketSwapped ? rawTeamA : rawTeamB;
        const sideLabel = _anchorCrossMarketSide.toUpperCase();
        const dogSpread = dogAsk > 0 && _anchorDogBid > 0 ? (dogAsk - _anchorDogBid) : 0;
        const favSpread = favAsk > 0 && _anchorFavBid > 0 ? (favAsk - _anchorFavBid) : 0;
        const combined = _anchorDogBid + _anchorFavBid;
        const arbGap = combined > 0 ? (100 - combined) : 0;
        const arbColor = arbGap > 0 ? '#64ffda' : arbGap === 0 ? '#ffaa00' : '#ff4444';
        if (sidesDisplay) {
            sidesDisplay.innerHTML = `
                <div style="background:#060a14;border:1px solid #64ffda44;border-radius:8px;padding:8px 10px;text-align:center;">
                    <div style="color:#64ffda;font-weight:700;font-size:9px;letter-spacing:.05em;margin-bottom:4px;">ANCHOR · ${anchorTeam}</div>
                    <div style="color:#64ffda;font-weight:800;font-size:18px;">${sideLabel}</div>
                    <div style="display:flex;justify-content:center;gap:8px;margin-top:4px;">
                        <div style="font-size:10px;"><span style="color:#5a6484;">bid</span> <span style="color:#ccd6f6;font-weight:600;">${_anchorDogBid}¢</span></div>
                        <div style="font-size:10px;"><span style="color:#5a6484;">ask</span> <span style="color:#ccd6f6;font-weight:600;">${dogAsk || '—'}¢</span></div>
                    </div>
                    <div style="color:#5a6484;font-size:9px;margin-top:2px;">spread: ${dogSpread}¢</div>
                    <div style="color:#ffaa00;font-size:10px;margin-top:3px;font-weight:600;">anchor @ ${smartPrice}¢ <span style="color:#5a6484;font-weight:400;">(−${anchorDepth})</span></div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                    <div style="color:#64ffda;font-size:14px;font-weight:700;">+</div>
                    <div style="font-size:10px;color:${arbColor};font-weight:600;">${combined}¢</div>
                    <div style="font-size:9px;color:${arbColor};">${arbGap > 0 ? '+' + arbGap + '¢ arb' : arbGap === 0 ? 'breakeven' : arbGap + '¢'}</div>
                </div>
                <div style="background:#060a14;border:1px solid #f7816644;border-radius:8px;padding:8px 10px;text-align:center;">
                    <div style="color:#f78166;font-weight:700;font-size:9px;letter-spacing:.05em;margin-bottom:4px;">HEDGE · ${hedgeTeam}</div>
                    <div style="color:#f78166;font-weight:800;font-size:18px;">${sideLabel}</div>
                    <div style="display:flex;justify-content:center;gap:8px;margin-top:4px;">
                        <div style="font-size:10px;"><span style="color:#5a6484;">bid</span> <span style="color:#ccd6f6;font-weight:600;">${_anchorFavBid}¢</span></div>
                        <div style="font-size:10px;"><span style="color:#5a6484;">ask</span> <span style="color:#ccd6f6;font-weight:600;">${favAsk || '—'}¢</span></div>
                    </div>
                    <div style="color:#5a6484;font-size:9px;margin-top:2px;">spread: ${favSpread}¢</div>
                </div>`;
        }
        // Update cross-detail combined cost display
        const combinedEl = document.getElementById('cross-combined-cost');
        if (combinedEl && _anchorDogBid > 0 && _anchorFavBid > 0) {
            const combined = _anchorDogBid + _anchorFavBid;
            const arbGap = 100 - combined;
            combinedEl.innerHTML = `Combined: ${combined}¢ <span style="color:${arbGap > 0 ? '#00ff88' : '#ff4444'};">(${arbGap > 0 ? '+' : ''}${arbGap}¢ arb)</span>`;
        }
    } else {
        // Normal same-market mode: restore standard display
        if (sidesDisplay) {
            sidesDisplay.innerHTML = `
                <div style="background:#060a14;border:1px solid #ffaa0044;border-radius:8px;padding:8px;text-align:center;">
                    <div style="color:#ffaa00;font-weight:700;font-size:9px;letter-spacing:.05em;margin-bottom:2px;">PHANTOM (ANCHOR)</div>
                    <div id="anchor-auto-dog-side" style="color:#ffaa00;font-weight:800;font-size:18px;">${_anchorDogSide.toUpperCase()}</div>
                    <div id="anchor-auto-dog-bid" style="color:#555;font-size:10px;margin-top:1px;">bid: ${_anchorDogBid}¢${dogAsk ? ` · ask: ${dogAsk}¢` : ''}${_anchorIsBrokenSpread ? ' <span style="color:#ff8800;">(broken)</span>' : ''} <span style="color:#ffaa00;">− ${anchorDepth}¢ depth = ${smartPrice}¢</span></div>
                </div>
                <div style="color:#555;font-size:14px;">→</div>
                <div style="background:#060a14;border:1px solid #00aaff44;border-radius:8px;padding:8px;text-align:center;">
                    <div style="color:#00aaff;font-weight:700;font-size:9px;letter-spacing:.05em;margin-bottom:2px;">FAV (HEDGE)</div>
                    <div id="anchor-auto-fav-side" style="color:#00aaff;font-weight:800;font-size:18px;">${_anchorFavSide.toUpperCase()}</div>
                    <div id="anchor-auto-fav-bid" style="color:#555;font-size:10px;margin-top:1px;">bid: ${_anchorFavBid}¢</div>
                </div>`;
        }
        // Update fav bid detail
        const _fav_shave_preview = 0;  // all depth on dog, fav posts at bid
        const _fav_start = _fav_shave_preview > 0 ? Math.max(1, _anchorFavBid - _fav_shave_preview) : _anchorFavBid;
        const favBidElNew = document.getElementById('anchor-auto-fav-bid');
        if (favBidElNew) favBidElNew.innerHTML = `bid: ${_anchorFavBid}¢` + (_fav_shave_preview > 0 ? ` <span style="color:#00aaff;">− ${_fav_shave_preview}¢ shave = ${_fav_start}¢</span>` : ` <span style="color:#00ff88;">→ posts at bid</span>`);
    }
    // Sync depth display
    const depthDisplaySync = document.getElementById('anchor-depth-display');
    if (depthDisplaySync) depthDisplaySync.textContent = `${anchorDepth}¢`;
    // Auto-add a default rung with smart pricing
    if (_anchorRungs.length === 0 && anchorBase > 5) {
        _anchorRungs.push({ price: smartPrice, qty: 1, offset: anchorDepth });
        // Force render immediately — the non-force render below can skip on mobile
        renderAnchorRungs(true);
    }
    // Auto-adjust rung price to track market
    if (_anchorAutoPrice && _anchorRungs.length > 0 && anchorBase > 0) {
        const rung = _anchorRungs[0];
        rung.offset = anchorDepth;
        rung.price = Math.max(1, anchorBase - anchorDepth);
    }
    renderAnchorRungs();
    updateAnchorPreview();
}


function updateRungPrice(idx, val) {
    const v = parseInt(val);
    if (v >= 1 && v <= 50) {
        _anchorRungs[idx].price = v;
        // Recalculate offset from current anchor base
        const anchorBase = _anchorIsBrokenSpread ? _anchorDogAsk : _anchorDogBid;
        _anchorRungs[idx].offset = anchorBase - v;
    }
    updateAnchorPreview();
}

function updateRungQty(idx, val) {
    const v = parseInt(val);
    if (v >= 1 && v <= 99) {
        _anchorRungs[idx].qty = v;
    }
    updateAnchorPreview();
}

function toggleAnchorAutoPrice() {
    _anchorAutoPrice = !_anchorAutoPrice;
    if (_anchorAutoPrice) initAnchorDogPrices();  // recalc immediately
    renderAnchorRungs();
}

function renderAnchorRungs(force) {
    const container = document.getElementById('anchor-rungs-container');
    if (!container) return;
    // Don't overwrite inputs while user is typing
    if (!force) {
        if (container.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
        if (window._anchorInputFocused) return;
    }

    if (_anchorRungs.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#555;font-size:11px;padding:12px;border:1px dashed #1e2740;border-radius:6px;">Waiting for market data…</div>';
        return;
    }

    const rung = _anchorRungs[0];
    const anchorBase = _anchorIsBrokenSpread ? _anchorDogAsk : _anchorDogBid;
    const baseLabel = _anchorIsBrokenSpread ? 'ask' : 'bid';
    const offset = rung.offset || 5;
    container.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:#060a14;border:1px solid #ffaa0033;border-radius:6px;padding:8px 10px;">
        <div style="flex:1;display:flex;align-items:center;gap:6px;">
            <div style="display:flex;align-items:center;gap:3px;">
                <span style="color:#8892a6;font-size:9px;">PRICE</span>
                <input type="number" min="1" max="50" value="${rung.price}" onchange="updateRungPrice(0, this.value)"
                    onfocus="window._anchorInputFocused=true" onblur="window._anchorInputFocused=false"
                    style="width:48px;padding:4px 6px;background:#0a0e1a;border:1px solid ${_anchorAutoPrice ? '#00ff8844' : '#1e2740'};border-radius:4px;color:#ffaa00;font-size:13px;font-weight:800;text-align:center;${_anchorAutoPrice ? 'opacity:0.8;' : ''}">
                <span style="color:#ffaa0066;font-size:10px;">¢</span>
            </div>
            <div style="display:flex;align-items:center;gap:3px;">
                <span style="color:#8892a6;font-size:9px;">QTY</span>
                <input type="number" min="1" max="99" value="${rung.qty}" onchange="updateRungQty(0, this.value)"
                    onfocus="window._anchorInputFocused=true" onblur="window._anchorInputFocused=false"
                    style="width:40px;padding:4px 6px;background:#0a0e1a;border:1px solid #1e2740;border-radius:4px;color:#fff;font-size:13px;font-weight:700;text-align:center;">
            </div>
            <span style="color:#555;font-size:9px;">${baseLabel} ${anchorBase}¢ <span style="color:#ffaa00;">−${offset}¢</span></span>
        </div>
    </div>`;
}

function updateAnchorPreview() {
    // Read depth floor directly from slider
    const anchorDepth = parseInt(document.getElementById('anchor-depth')?.value) || 5;
    const depthDisplay = document.getElementById('anchor-depth-display');
    if (depthDisplay) depthDisplay.textContent = `${anchorDepth}¢`;
    const shaveInfo = document.getElementById('anchor-shave-info');
    if (shaveInfo) {
        // Depth recommendation from orderbook cache
        let depthRec = '';
        const _obTicker = currentArbMarket?.ticker;
        const _obCache = _obTicker ? (window._obDepthCache || {})[_obTicker] : null;
        if (_obCache && _obCache.dogDepth > 0) {
            const dd = _obCache.dogDepth;
            const fd = _obCache.favDepth;
            const dogBid = _obCache.dogBid || 0;
            const favBid = _obCache.favBid || 0;
            const fpl = _obCache.favPerLevel || 0;  // contracts per level on fav side
            const fGaps = _obCache.favGaps || 0;
            const maxQty = _obCache.maxSafeQty || 1;
            // Depth rec based on contracts-per-level (not total depth)
            // Thick book per-level = stable, tight depth OK. Thin per-level = volatile, wider depth.
            let recDepth = 5;  // default
            let reasons = [];
            const dogWall = _obCache.dogWall || {};
            // Primary: fav contracts/level (how fast hedge fills)
            if (fpl >= 50) { recDepth = 3; reasons.push(`fav ${fpl}/lvl thick`); }
            else if (fpl >= 20) { recDepth = 4; reasons.push(`fav ${fpl}/lvl solid`); }
            else if (fpl >= 10) { recDepth = 5; reasons.push(`fav ${fpl}/lvl moderate`); }
            else if (fpl >= 5) { recDepth = 7; reasons.push(`fav ${fpl}/lvl light`); }
            else { recDepth = 8; reasons.push(`fav ${fpl}/lvl thin`); }
            // Dog wall check: need enough contracts protecting you at the chosen depth
            // If the wall at recDepth is too thin (<30 contracts), widen until wall is adequate
            const minWall = 30;  // need at least 30 contracts between you and the bid
            while (recDepth < 8 && (dogWall[recDepth] || 0) < minWall) {
                recDepth++;
            }
            if ((dogWall[recDepth] || 0) < minWall) {
                reasons.push(`dog wall thin (${dogWall[recDepth]||0})`);
            } else {
                reasons.push(`wall: ${dogWall[recDepth]||0}`);
            }
            // Gaps on fav side = sweeps crash through, need wider depth
            if (fGaps >= 3) { recDepth = Math.max(recDepth, recDepth + 2); reasons.push(`${fGaps} fav gaps`); }
            else if (fGaps >= 2) { recDepth = Math.max(recDepth, recDepth + 1); reasons.push(`${fGaps} fav gaps`); }
            // Market balance: dog bid high = close match = volatile
            if (dogBid >= 35 && fpl < 50) { recDepth = Math.max(recDepth, 8); reasons.push('close match'); }
            else if (dogBid >= 35) { recDepth = Math.max(recDepth, 5); reasons.push('close match'); }
            // Wide spread = more walk needed
            const totalBids = dogBid + favBid;
            if (totalBids > 0 && totalBids < 90) { recDepth = Math.max(recDepth, 7); reasons.push('wide spread'); }
            const recNote = reasons.join(' · ');
            const recMatch = anchorDepth >= recDepth && anchorDepth <= recDepth + 2;
            const recCol = recMatch ? '#00ff88' : '#ffaa00';
            const thinWarn = fpl < 5 ? ` <span style="color:#ff4444;font-weight:700;">⚠ thin book!</span>` : '';
            depthRec = `<div style="margin-top:3px;padding:3px 6px;background:${recCol}11;border:1px solid ${recCol}33;border-radius:4px;font-size:10px;">` +
                `<span style="color:${recCol};font-weight:700;">📊 Rec: ${recDepth}¢+</span> ` +
                `<span style="color:#8892a6;">${recNote}</span>${thinWarn}` +
                `<div style="margin-top:2px;color:#8892a6;font-size:9px;">` +
                `dog ${dd.toLocaleString()} (${_obCache.dogPerLevel||0}/lvl) @ ${dogBid}¢ · fav ${fd.toLocaleString()} (${fpl}/lvl) @ ${favBid}¢` +
                `</div>` +
                `<div style="margin-top:2px;color:#ffaa00;font-size:9px;font-weight:600;">Max safe qty: ${maxQty} <span style="color:#555;font-weight:400;">(fav top 3 bids: ${_obCache.favTop3||0})</span></div>` +
                `</div>`;
        }
        shaveInfo.innerHTML = `<span style="color:#ffaa00;">Anchor: ${anchorDepth}¢ below ${_anchorIsBrokenSpread ? 'ask' : 'bid'}</span> · <span style="color:#00aaff;">Hedge: posts at bid instantly</span>${depthRec}`;
    }

    const previewEl = document.getElementById('anchor-preview-content');
    if (!previewEl) return;

    if (_anchorRungs.length === 0 || _anchorDogBid < 1) {
        previewEl.innerHTML = '<div style="text-align:center;color:#555;font-size:11px;padding:8px;">Add rungs above to see preview</div>';
        return;
    }

    const isCrossMode = !!_anchorCrossMarketTicker && document.getElementById('anchor-cross-market')?.checked;
    const totalQty = _anchorRungs.reduce((s, r) => s + r.qty, 0);
    const avgPrice = Math.round(_anchorRungs.reduce((s, r) => s + r.price * r.qty, 0) / totalQty);
    const totalCost = _anchorRungs.reduce((s, r) => s + r.price * r.qty, 0);
    let html;

    if (isCrossMode) {
        // Cross-market preview: show anchor + hedge on different tickers
        const teamA = currentArbMarket.ticker.split('-').pop() || '?';
        const teamB = _anchorCrossMarketTicker.split('-').pop() || '?';
        const sideLabel = _anchorCrossMarketSide.toUpperCase();
        const hedgeBid = _anchorFavBid;
        const combined = avgPrice + hedgeBid;
        const arbGap = 100 - combined;
        const isInvalid = arbGap < 1;

        html = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Anchor · ${teamA}</div>
                <div style="color:#64ffda;font-weight:800;font-size:16px;">${sideLabel} @ ${avgPrice}¢</div>
                <div style="color:#555;font-size:9px;">${totalQty} contracts</div>
            </div>
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Hedge · ${teamB}</div>
                <div style="color:#f78166;font-weight:800;font-size:16px;">${sideLabel} @ ${hedgeBid}¢</div>
                <div style="color:#555;font-size:9px;">at bid</div>
            </div>
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Combined</div>
                <div style="color:${isInvalid ? '#ff4444' : '#00ff88'};font-weight:800;font-size:16px;">${combined}¢</div>
                <div style="color:${arbGap > 0 ? '#00ff88' : '#ff4444'};font-size:9px;">${arbGap > 0 ? `${arbGap}¢ arb` : 'no arb'}</div>
            </div>
        </div>`;
        html += `<div style="margin-top:6px;color:#555;font-size:9px;text-align:center;">
            Cross-market · ${teamA} ${sideLabel} + ${teamB} ${sideLabel} · Instant hedge on fill
        </div>`;
    } else {
        // Normal same-market preview
        const favCeiling = 100 - avgPrice - targetWidth;
        const favInitial = fav_shave > 0 ? Math.max(1, _anchorFavBid - fav_shave) : _anchorFavBid;
        const isInvalid = favCeiling < 1;
        const walkRoom = favCeiling - favInitial;

        html = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Dog anchor</div>
                <div style="color:#ffaa00;font-weight:800;font-size:16px;">${avgPrice}¢</div>
                <div style="color:#555;font-size:9px;">${totalQty}×${_anchorDogSide.toUpperCase()}</div>
            </div>
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Fav start</div>
                <div style="color:#00aaff;font-weight:800;font-size:16px;">${isInvalid ? '—' : `${Math.min(favInitial, favCeiling)}¢`}</div>
                <div style="color:#555;font-size:9px;">${fav_shave > 0 ? `bid-${fav_shave}¢` : 'at bid'}</div>
            </div>
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Fav ceiling</div>
                <div style="color:${isInvalid ? '#ff4444' : '#00aaff'};font-weight:800;font-size:16px;">${isInvalid ? '—' : `≤${favCeiling}¢`}</div>
                <div style="color:#555;font-size:9px;">${walkRoom > 0 ? `${walkRoom}¢ walk room` : 'no room'}</div>
            </div>
            <div style="text-align:center;padding:6px;background:#0a0e1a;border-radius:6px;">
                <div style="color:#8892a6;font-size:9px;margin-bottom:2px;">Min profit</div>
                <div style="color:${isInvalid ? '#ff4444' : '#00ff88'};font-weight:800;font-size:16px;">${isInvalid ? '—' : `+${targetWidth * totalQty}¢`}</div>
                <div style="color:#555;font-size:9px;">$${(totalCost / 100).toFixed(2)} cost</div>
            </div>
        </div>`;

        // Spread + pricing mode info
        const spreadC = _anchorDogAsk > 0 ? (_anchorDogAsk - _anchorDogBid) : 0;
        const spreadLabel = spreadC > 1
            ? `<span style="color:#ff8800;">Wide spread ${spreadC}¢ — priced off ask</span>`
            : (spreadC > 0 ? `<span style="color:#00ff88;">Tight spread ${spreadC}¢</span>` : '');
        html += `<div style="margin-top:6px;color:#555;font-size:9px;text-align:center;">
            ${spreadLabel ? spreadLabel + ' · ' : ''}Instant hedge at bid on fill
        </div>`;
    }
    previewEl.innerHTML = html;

    // Width reco removed — phantom always hedges at fav bid

    // Update deploy button text
    const btn = document.getElementById('anchor-deploy-btn');
    if (btn) {
        const crossTag = isCrossMode ? ' (Cross)' : '';
        btn.textContent = `👻 Deploy Phantom Bot${crossTag}`;
        btn.style.background = isCrossMode
            ? 'linear-gradient(135deg,#64ffda 0%,#00bfa5 100%)'
            : 'linear-gradient(135deg,#ffaa00 0%,#ff8800 100%)';
        btn.style.color = '#000';
    }
}

function toggleAnchorSmartMode(checked) {
    const runsSection = document.getElementById('anchor-runs-section');
    const runsInput = document.getElementById('anchor-repeat-count');
    if (checked) {
        runsSection.style.opacity = '0.3';
        runsSection.style.pointerEvents = 'none';
        runsInput.value = 0;
    } else {
        runsSection.style.opacity = '1';
        runsSection.style.pointerEvents = 'auto';
    }
}

function toggleApexSmartMode(checked) {
    const runsInput = document.getElementById('bot-repeat-count');
    if (checked) {
        runsInput.style.opacity = '0.3';
        runsInput.disabled = true;
        runsInput.value = 0;
    } else {
        runsInput.style.opacity = '1';
        runsInput.disabled = false;
    }
}

async function deployAnchorBot() {
    if (!currentArbMarket) { alert('No market selected'); return; }
    if (_anchorRungs.length === 0) { alert('No order configured'); return; }
    if (_anchorDogBid < 1) { alert('No dog bid detected — select a market first'); return; }

    const anchorDepth  = parseInt(document.getElementById('anchor-depth')?.value) || 5;
    const repeatCount  = parseInt(document.getElementById('anchor-repeat-count')?.value) || 0;
    const smartMode    = !!document.getElementById('anchor-smart-mode')?.checked;

    // Validate rungs
    for (const r of _anchorRungs) {
        if (r.price < 1 || r.price > 50) {
            alert(`Rung price ${r.price}¢ out of range (1-50¢)`);
            return;
        }
    }

    const totalQty = _anchorRungs.reduce((s, r) => s + r.qty, 0);
    const avgPrice = Math.round(_anchorRungs.reduce((s, r) => s + r.price * r.qty, 0) / totalQty);
    const favCeiling = 98 - avgPrice;
    if (favCeiling < 1) { alert('Fav ceiling too low — avg dog price too high for 98¢ ceiling.'); return; }

    const isCrossMode = !!_anchorCrossMarketTicker && document.getElementById('anchor-cross-market')?.checked;
    const crossLine = isCrossMode ? `\nCross-market: hedge on ${_anchorCrossMarketTicker}` : '';

    const repeatLine = smartMode ? '\nMode: Smart (repeat on wins, stop after 2 losses)' : repeatCount > 0 ? `\nRepeat: ${repeatCount}× (${repeatCount + 1} total runs)` : '\nRepeat: single shot';
    if (!confirm(`👻 Deploy Phantom Bot${isCrossMode ? ' (Cross-Market)' : ''} — ${totalQty} contract${totalQty > 1 ? 's' : ''}\n\nMarket: ${currentArbMarket.ticker}\n  ${_anchorDogSide.toUpperCase()} @ ${_anchorRungs[0].price}¢ × ${_anchorRungs[0].qty}\nDepth floor: ${anchorDepth}¢\nMax hedge: ≤${favCeiling}¢${crossLine}${repeatLine}\nInstant hedge on fill\nMaker-only (post_only=true)\n\nConfirm?`)) return;

    try {
        const body = {
            ticker: currentArbMarket.ticker,
            dog_price: _anchorRungs[0].price,
            target_width: 5,
            quantity: _anchorRungs[0].qty,
            dog_side: _anchorDogSide,
            repeat_count: smartMode ? 0 : repeatCount,
            smart_mode: smartMode,
            anchor_depth: anchorDepth,
        };

        // Add cross-market fields if active
        if (isCrossMode && _anchorCrossMarketTicker) {
            body.cross_market = true;
            if (_anchorCrossMarketSwapped) {
                // Opposing ticker is cheaper — it becomes the anchor, this market becomes hedge
                body.ticker = _anchorCrossMarketTicker;
                body.hedge_ticker = currentArbMarket.ticker;
            } else {
                body.hedge_ticker = _anchorCrossMarketTicker;
            }
        }

        const resp = await fetch(`${API_BASE}/bot/anchor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (data.success) {
            const favWarn = data.fav_warning ? `\n⚠ ${data.fav_warning}` : '';
            const favDepthNote = data.fav_depth != null ? ` · fav depth ${data.fav_depth}` : '';
            showNotification(`👻 Phantom deployed: ${_anchorDogSide.toUpperCase()} @ ${_anchorRungs[0].price}¢ · depth ${anchorDepth}¢${favDepthNote}${isCrossMode ? ' (cross-market)' : ''}${favWarn}`);
            // Persist phantom settings for next deploy
            try {
                localStorage.setItem('phantom_settings', JSON.stringify({
                    depth: anchorDepth,
                    baseQty: _anchorRungs[0]?.qty || 1,
                    repeatCount: repeatCount,
                    smartMode: smartMode,
                }));
            } catch (e) {}
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
    const sl = parseInt(document.getElementById('straight-sl').value) || 0;
    const tp = parseInt(document.getElementById('straight-tp').value) || 0;

    if (!price || price < 1 || price > 99) { alert('Price must be 1-99¢'); return; }

    const cost = (price * qty / 100).toFixed(2);
    const profit = ((100 - price) * qty / 100).toFixed(2);
    const watchNote = sl > 0 ? `\n🛑 Auto stop-loss: -${sl}¢${tp > 0 ? ` · Take-profit: +${tp}¢` : ''}` : (tp > 0 ? `\n📈 Take-profit: +${tp}¢` : '');

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
                add_watch: true,
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
            if (!autoMonitorInterval) toggleAutoMonitor();
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

    // ── Preset recommendation based on game signal ──
    const liq = getMarketLiquidity(market);
    const gameId = extractGameId(market.event_ticker || market.ticker || '');
    const signal = getGameSignal(gameId, sport, [market]);
    const sigType = signal.type; // anchor, swing, caution, pregame, none
    const recEl = document.getElementById('preset-recommendation');
    // Apex 2.0: show game signal info only (no auto-selected widths)
    if (recEl && liq.yesBid > 0 && liq.noBid > 0) {
        let sigText = '', sigColor = '#8892a6';
        if (sigType === 'coin_flip') { sigText = '🔵 COIN FLIP — close game, both legs bounce'; sigColor = '#60a5fa'; }
        else if (sigType === 'lean') { sigText = '🟢 LEAN — small lead, still volatile'; sigColor = '#4ade80'; }
        else if (sigType === 'drifting') { sigText = '🟡 DRIFTING — lead building, dog fills harder'; sigColor = '#ffaa33'; }
        else if (sigType === 'runaway') { sigText = '🔴 RUNAWAY — blowout, very wide or skip'; sigColor = '#ff6644'; }
        else if (sigType === 'late_game') { sigText = '⌛ LATE — running out of time'; sigColor = '#ff4444'; }
        else if (sigType === 'early') { sigText = '⚪ EARLY — no score context yet'; sigColor = '#8892a6'; }
        else if (sigType === 'pregame') { sigText = '⏳ PREGAME'; sigColor = '#8892a6'; }
        else { sigText = `💡 ${liq.tierLabel}`; }
        const _tmpRec = getRecommendedPresets(liq.tier, sigType, market);
        const _recRange = _tmpRec.length ? `${_tmpRec[0]}-${_tmpRec[_tmpRec.length-1]}¢` : '';
        recEl.style.display = 'block';
        recEl.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;">`
            + `<span style="color:${sigColor};font-weight:700;">${sigText}</span>`
            + `<span style="color:#8892a6;font-size:10px;">${liq.yesBid}+${liq.noBid}=${liq.bidSum} · spread ${liq.avgSpread}c${_recRange ? ' · rec ' + _recRange : ''}</span>`
            + `</div>`;
    } else if (recEl) {
        recEl.style.display = 'none';
    }
    // Auto-recommend widths based on spread + signal — pre-select best ones
    const recWidths = getRecommendedPresets(liq.tier, sigType, market);
    window._recPresets = recWidths;
    _selectedWidths.clear();
    // Pre-select top 3 recommended widths (user can toggle)
    recWidths.slice(0, 3).forEach(w => _selectedWidths.add(w));
    _syncPresetStyles();
    recalcArbPrices();
    _updateDeployButton();

    // Underdog warning removed — no longer relevant for dual arb strategy
    const warnEl = document.getElementById('modal-underdog-warning');
    if (warnEl) warnEl.style.display = 'none';

    // Ensure single-market layout: show market card, reset middle data
    const marketCard = document.getElementById('bot-market-card');
    if (marketCard) marketCard.style.display = '';
    _currentMiddleData = null;

    document.getElementById('bot-modal').classList.add('show');
    initWidthSelector();

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
            // Recalc prices based on current mode
            if (currentTradeMode === 'arb') {
                recalcArbPrices();
            } else if (currentTradeMode === 'anchor') {
                initAnchorDogPrices();
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
    const previewEl = document.getElementById('profit-preview');
    if (!previewEl) return;
    // When multiple widths selected, show per-width breakdown instead
    if (_selectedWidths.size > 1) {
        updateAllWidthsPreview();
        return;
    }
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


    // Exit info
    const exitInfo = isArb
        ? `<div style="padding:6px 16px 10px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;color:#8892a6;border-top:1px solid #00aaff11;">
               <span style="color:#00aaff;">⏱</span>
               <span>On fill → <span style="color:#00ff88;">15s profit</span> → <span style="color:#ffaa00;">15s scratch</span> → <span style="color:#ff4444;">panic at bid</span></span>
           </div>`
        : '';

    previewEl.innerHTML = `
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

function applyPreset(width) {
    toggleWidth(width);
    // Update slider/display to last-clicked width for single-deploy
    const widthSlider = document.getElementById('bot-arb-width');
    if (widthSlider) { widthSlider.value = width; }
    document.getElementById('width-display').textContent = `${width}¢`;
    recalcArbPrices();
    _syncPresetStyles();
}

function _syncPresetStyles() {
    const rec = window._recPresets || [];
    document.querySelectorAll('.arb-preset-btn').forEach(btn => {
        const w = parseInt(btn.dataset.width);
        const label = btn.querySelector('div');
        const isSelected = _selectedWidths.has(w);
        const isRec = rec.includes(w);
        if (isSelected) {
            btn.style.border = '2px solid #ffd700';
            btn.style.background = '#ffd70022';
            btn.style.boxShadow = '0 0 8px #ffd70044';
            if (label) { label.textContent = `${w}¢`; label.style.color = '#ffd700'; }
        } else if (isRec) {
            btn.style.border = '2px solid #00ff8866';
            btn.style.background = '#00ff8811';
            btn.style.boxShadow = 'none';
            if (label) { label.textContent = `${w}¢`; label.style.color = '#00ff88'; }
        } else {
            btn.style.border = '2px solid #1e274066';
            btn.style.background = '#0a0e1a';
            btn.style.boxShadow = 'none';
            if (label) { label.textContent = `${w}¢`; label.style.color = '#556'; }
        }
    });
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
    el.textContent = `Profit if both fill: +${profit}¢ ($${(profit/100).toFixed(2)}) · auto exit via amend`;
    el.style.color = width >= 10 ? '#00ff88' : width >= 5 ? '#ffaa00' : '#00aaff';
}

function highlightActivePreset() {
    _syncPresetStyles();
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
    // Reset width selector
    clearSelectedWidths();
    // Re-enable deploy button (gets disabled during placement)
    const deployBtn = document.getElementById('deploy-btn');
    if (deployBtn) { deployBtn.disabled = false; deployBtn.textContent = '△ Deploy Apex Bot'; }
}

// View orderbook for a market
async function viewOrderbook(ticker) {
    try {
        const response = await fetch(`${API_BASE}/orderbook/${ticker}?_=${Date.now()}`);
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

        // ── Liquidity Analysis ──
        const calcDepth = (orders, bestBid) => {
            let total = 0, near = 0;
            for (const o of orders) {
                const { price, qty } = parseOrderLevel(o);
                total += qty;
                if (bestBid != null && Math.abs(price - bestBid) <= 5) near += qty;
            }
            return { total, near };
        };
        const yesDepth = calcDepth(yesOrders, bestYesBid);
        const noDepth = calcDepth(noOrders, bestNoBid);
        const yesSpread = (bestNoBid != null && bestYesBid != null) ? (100 - bestNoBid) - bestYesBid : 0;
        const noSpread = (bestYesBid != null && bestNoBid != null) ? (100 - bestYesBid) - bestNoBid : 0;
        const maxSpr = Math.max(yesSpread, noSpread);
        const liqColor = (yesDepth.near + noDepth.near) >= 20 ? '#00ff88' : (yesDepth.near + noDepth.near) >= 5 ? '#ffaa00' : '#ff4444';
        const spreadColor = maxSpr > 10 ? '#ff4444' : maxSpr > 5 ? '#ffaa00' : '#00ff88';
        const liqHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:11px;">
            <div style="background:#0f1419;padding:8px;border-radius:6px;text-align:center;">
                <div style="color:#8892a6;font-size:9px;">YES DEPTH (5¢)</div>
                <div style="color:${liqColor};font-weight:700;">${yesDepth.near} contracts</div>
                <div style="color:#555;font-size:8px;">${yesDepth.total} total</div>
            </div>
            <div style="background:#0f1419;padding:8px;border-radius:6px;text-align:center;">
                <div style="color:#8892a6;font-size:9px;">NO DEPTH (5¢)</div>
                <div style="color:${liqColor};font-weight:700;">${noDepth.near} contracts</div>
                <div style="color:#555;font-size:8px;">${noDepth.total} total</div>
            </div>
        </div>
        <div style="text-align:center;padding:4px;margin-bottom:10px;font-size:10px;">
            Spread: <strong style="color:${spreadColor};">${maxSpr}¢</strong>
            ${maxSpr > 10 ? '<span style="color:#ff4444;font-weight:700;"> ⚠ WIDE — use 8¢+ widths</span>' : ''}
        </div>`;

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
                ${liqHtml}
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
const ALL_PRESET_WIDTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const MIN_FAV_ENTRY_FOR_BOT = 65;

// Apex 2.0 stop-loss thresholds per width (mirrors backend _apex_stop_loss_threshold)
function _apexStopLossThreshold(width, anchorPrice) {
    // Delta-adjusted: 2× near midrange (≥35¢), 1.5× near extremes
    const mult = (anchorPrice && anchorPrice >= 35) ? 2.0 : 1.5;
    return Math.max(4, Math.round(width * mult));
}

// ── Multi-width selector state ──
let _selectedWidths = new Set();

function initWidthSelector() {
    // Width selector is now the preset buttons themselves — just sync styles
    _syncPresetStyles();
}

function toggleWidth(w) {
    if (_selectedWidths.has(w)) {
        _selectedWidths.delete(w);
    } else {
        _selectedWidths.add(w);
    }
    _syncPresetStyles();
    _updateDeployButton();
    updateAllWidthsPreview();
}

function selectAllWidths() {
    ALL_PRESET_WIDTHS.forEach(w => _selectedWidths.add(w));
    _syncPresetStyles();
    _updateDeployButton();
    updateAllWidthsPreview();
}

function clearSelectedWidths() {
    _selectedWidths.clear();
    _syncPresetStyles();
    _updateDeployButton();
    updateAllWidthsPreview();
}

function _updateWidthBtnStyles() {
    // Deprecated — use _syncPresetStyles instead
    _syncPresetStyles();
}

function _updateDeployButton() {
    const deployBtn = document.getElementById('deploy-btn');
    if (!deployBtn) return;
    const count = _selectedWidths.size;
    if (count > 1) {
        deployBtn.textContent = `△ Deploy ${count} Widths`;
        deployBtn.style.background = 'linear-gradient(135deg,#818cf8 0%,#6366f1 100%)';
        deployBtn.style.color = '#fff';
    } else if (count === 1) {
        const w = [..._selectedWidths][0];
        deployBtn.textContent = `△ Deploy ${w}¢ Width`;
        deployBtn.style.background = 'linear-gradient(135deg,#00ff88 0%,#00cc6a 100%)';
        deployBtn.style.color = '#000';
    } else {
        deployBtn.textContent = '△ Deploy Apex Bot';
        deployBtn.style.background = 'linear-gradient(135deg,#00ff88 0%,#00cc6a 100%)';
        deployBtn.style.color = '#000';
    }
}

function updateAllWidthsPreview() {
    const preview = document.getElementById('profit-preview');
    if (!preview || !currentArbMarket) return;
    const selectedArr = [..._selectedWidths].sort((a, b) => a - b);
    if (selectedArr.length === 0) {
        preview.innerHTML = '';
        return;
    }
    const baseQty = parseInt(document.getElementById('bot-quantity')?.value) || 1;
    let rows = '';
    let totalCost = 0;
    let totalProfit = 0;
    let validCount = 0;
    let totalContracts = 0;

    selectedArr.forEach(w => {
        const arb = calculateArbPrices(currentArbMarket, w);
        const yesPrice = arb.targetYes;
        const noPrice  = arb.targetNo;
        const profit = 100 - yesPrice - noPrice;
        const blocked = profit <= 0;
        const rungQty = baseQty;
        const cost = blocked ? 0 : (yesPrice + noPrice) * rungQty;
        const profitTotal = blocked ? 0 : profit * rungQty;
        if (!blocked) { totalCost += cost; totalProfit += profitTotal; validCount++; totalContracts += rungQty; }

        const statusColor = blocked ? '#ff4444' : '#00ff88';
        const statusText  = blocked ? '⛔ no arb' : `✓ Y${yesPrice}¢ N${noPrice}¢`;
        const rowBg = blocked ? 'rgba(255,68,68,0.04)' : 'rgba(0,255,136,0.03)';
        const qtyLabel = blocked ? '—' : `${rungQty}×`;
        const qtyColor = '#8892a6';
        const slThreshold = _apexStopLossThreshold(w);
        const slColor = slThreshold <= 8 ? '#00ff8888' : slThreshold <= 12 ? '#ffaa0088' : slThreshold <= 20 ? '#ff880088' : '#ff444488';
        rows += `<div style="display:grid;grid-template-columns:28px 30px 30px 1fr 38px 34px 55px 46px;gap:3px;align-items:center;padding:4px 6px;background:${rowBg};border-radius:4px;margin-bottom:2px;">
            <span style="color:#8892a6;font-weight:700;font-size:10px;">${w}¢</span>
            <span style="color:${qtyColor};font-size:10px;font-weight:700;text-align:center;">${qtyLabel}</span>
            <span style="color:${blocked ? '#333' : slColor};font-size:9px;text-align:center;">${blocked ? '—' : slThreshold + '¢'}</span>
            <span style="color:${statusColor};font-size:10px;">${statusText}</span>
            <span style="color:#8892a6;font-size:10px;text-align:center;">${blocked ? '—' : yesPrice + '¢'}</span>
            <span style="color:#8892a6;font-size:10px;text-align:center;">${blocked ? '—' : noPrice + '¢'}</span>
            <span style="color:${blocked ? '#555' : '#00ff88'};font-size:10px;text-align:right;font-weight:700;">${blocked ? '—' : '+$' + (profitTotal / 100).toFixed(2)}</span>
            <span style="color:${blocked ? '#555' : '#aab'};font-size:10px;text-align:right;">${blocked ? '—' : '$' + (cost / 100).toFixed(2)}</span>
        </div>`;
    });

    const totalDollars  = (totalCost / 100).toFixed(2);
    const profitDollars = (totalProfit / 100).toFixed(2);
    const qtyDesc = `${baseQty}× each`;
    preview.innerHTML = `
        <div style="display:grid;grid-template-columns:28px 30px 30px 1fr 38px 34px 55px 46px;gap:3px;padding:2px 6px;margin-bottom:4px;">
            <span style="color:#555;font-size:9px;">W</span>
            <span style="color:#555;font-size:9px;text-align:center;">QTY</span>
            <span style="color:#ff444488;font-size:9px;text-align:center;">SL</span>
            <span style="color:#555;font-size:9px;">STATUS</span>
            <span style="color:#555;font-size:9px;text-align:center;">YES</span>
            <span style="color:#555;font-size:9px;text-align:center;">NO</span>
            <span style="color:#00ff88;font-size:9px;text-align:right;">PROFIT</span>
            <span style="color:#555;font-size:9px;text-align:right;">COST</span>
        </div>
        ${rows}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid #2a2a4a;flex-wrap:wrap;gap:6px;">
            <span style="color:#8892a6;font-size:11px;">${validCount} of ${selectedArr.length} valid · ${qtyDesc}</span>
            <span style="color:#00ff88;font-size:12px;font-weight:800;">+$${profitDollars} max profit</span>
            <span style="color:#aab;font-size:11px;">Entry: $${totalDollars}</span>
        </div>`;
}

async function createBot() {
    if (!currentArbMarket) { alert('No market selected'); return; }

    // All width selections go through Apex (ladder-arb) endpoint
    if (_selectedWidths.size >= 1) {
        return placeSelectedWidthsBots();
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
    const smart_mode      = !!document.getElementById('apex-smart-mode')?.checked;
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
    const repeatMsg = smart_mode ? '\n↻ Smart Mode (repeat on wins, stop after 2 losses)' : repeat_count > 0 ? `\n↻ Repeat: ${repeat_count}× after first fill (${repeat_count + 1} runs total)` : '';
    const slInfo = `Stop-loss: ${_apexStopLossThreshold(arb_width)}¢ (delta-adjusted)`;
    if (!confirm(`△ Deploy Apex 2.0 — ${quantity} contract(s)\n\nMarket: ${currentArbMarket.ticker}\nYES limit buy: ${yes_price}¢\nNO limit buy: ${no_price}¢\nTotal cost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nProfit if both fill: +${profitPer}¢/contract\n${slInfo}${repeatMsg}\n\nConfirm order?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/ladder-arb`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: currentArbMarket.ticker,
                widths: [arb_width],
                quantity,
                repeat_count: smart_mode ? 0 : repeat_count,
                smart_mode,
            }),
        });
        const data = await resp.json();

        if (data.bot_id) {
            showNotification(`△ Apex deployed: 1 rung · ${quantity} contracts`);
            closeModal();
            loadBots();
            if (!autoMonitorInterval) toggleAutoMonitor();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
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

async function placeSelectedWidthsBots() {
    if (!currentArbMarket) return;
    const selectedArr = [..._selectedWidths].sort((a, b) => a - b);
    if (selectedArr.length === 0) return;
    const qty         = parseInt(document.getElementById('bot-quantity')?.value) || 1;
    const repeatCount = parseInt(document.getElementById('bot-repeat-count')?.value) || 0;
    const smartMode   = !!document.getElementById('apex-smart-mode')?.checked;
    const gamePhase   = document.querySelector('input[name="game-phase"]:checked')?.value || 'live';

    // ── Fetch fresh orderbook prices before computing widths ───────────────────
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
            }
        }
    } catch (_) { /* proceed with cached prices */ }

    // ── Phantom-arb guardrail: block if one side has no real bids ──────────────
    const realYesBid = currentArbMarket?.yes_bid || 0;
    const realNoBid  = currentArbMarket?.no_bid  || 0;
    if (realYesBid <= 0 || realNoBid <= 0) {
        const missingSide = realYesBid <= 0 ? 'YES' : 'NO';
        alert(`⚠️ No real ${missingSide} bids in the orderbook.\n\nThe ${missingSide} price is derived (calculated), not from a real order. Nobody is there to fill it. This arb is phantom.`);
        return;
    }

    // ── Pre-scan: build detailed confirmation ──────────────────────────────────
    const validWidths = [];
    const skipReasons = [];
    let totalCostCents = 0;

    for (const w of selectedArr) {
        const arb      = calculateArbPrices(currentArbMarket, w);
        const yesPrice = arb.targetYes;
        const noPrice  = arb.targetNo;
        const profit   = 100 - yesPrice - noPrice;
        if (profit <= 0) {
            skipReasons.push(`  ⛔  ${w}¢ width — no profit`);
        } else {
            validWidths.push({ w, arb, yesPrice, noPrice, profit, rungQty: qty });
            totalCostCents += (yesPrice + noPrice) * qty;
        }
    }

    if (validWidths.length === 0) {
        alert(`△ Deploy ${selectedArr.length} Widths — ${currentArbMarket.ticker}\n\nNo valid widths to deploy (all skipped).\n\n${skipReasons.join('\n')}`);
        return;
    }

    // Build order table string
    const pad = (s, n) => String(s).padStart(n);
    let orderLines = [`△ Apex: Deploy ${validWidths.length} Widths — ${currentArbMarket.ticker}`, ''];
    orderLines.push('  WIDTH   QTY   YES    NO    PROFIT   COST');
    orderLines.push('  ────────────────────────────────────────');
    for (const { w, arb, yesPrice, noPrice, profit, rungQty } of validWidths) {
        const costDollars = ((yesPrice + noPrice) * rungQty / 100).toFixed(2);
        orderLines.push(`  ${pad(w+'¢',5)}   ${pad(rungQty+'×',4)}  ${pad(arb.targetYes+'¢',4)}   ${pad(arb.targetNo+'¢',4)}   +${pad(profit+'¢',3)}   $${costDollars}`);
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

    // ── Placement: unified ladder-arb for multi-width, legacy for single ─────
    const deployBtn = document.getElementById('deploy-btn');
    if (deployBtn) { deployBtn.disabled = true; deployBtn.textContent = '⏳ Placing...'; }

    let notifMsg;

    console.log(`[DEPLOY] validWidths=${validWidths.length}, routing to ladder-arb (Apex)`);

    // Close modal IMMEDIATELY — don't wait for Kalshi API round trips
    const deployTicker = currentArbMarket.ticker;
    closeModal();
    if (!autoMonitorInterval) toggleAutoMonitor();
    showNotification(`△ Deploying Apex: ${validWidths.length} widths on ${deployTicker}...`);

    // Fire API call in background — notification updates when done
    fetch(`${API_BASE}/bot/ladder-arb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ticker: deployTicker,
            widths: validWidths.map(v => v.w),
            quantity: qty,
            repeat_count: smartMode ? 0 : repeatCount,
            smart_mode: smartMode,
            game_phase: gamePhase,
        }),
    }).then(r => r.json()).then(data => {
        if (data.bot_id) {
            showNotification(`△ Apex 2.0 deployed: ${data.rungs} rungs × ${qty}`);
        } else if (data.warning && data.spread) {
            // Spread-aware entry guard — offer override
            if (confirm(`⚠️ Spread is ${data.spread}¢ — narrow widths (${(data.narrow_widths||[]).join(', ')}¢) may get adversely selected.\n\nDeploy anyway?`)) {
                // Retry with force_narrow flag
                fetch(`${API_BASE}/bot/ladder-arb`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticker: deployTicker, widths: validWidths.map(v => v.w),
                        quantity: qty, repeat_count: smartMode ? 0 : repeatCount,
                        smart_mode: smartMode, game_phase: gamePhase, force_narrow: true,
                    }),
                }).then(r2 => r2.json()).then(d2 => {
                    if (d2.bot_id) showNotification(`△ Apex 2.0 deployed (override): ${d2.rungs} rungs × ${qty}`);
                    else showNotification(`❌ Apex failed: ${d2.error || 'Unknown error'}`);
                    loadBots();
                });
            }
        } else {
            showNotification(`❌ Apex failed: ${data.error || 'Unknown error'}`);
        }
        loadBots();
    }).catch(() => {
        showNotification(`❌ Apex failed: Network error`);
    });
}

let botsTabMode = 'arb';  // 'arb' | 'middle'
function _renderDogBotCard(bot, botId, container, gameScores) {
    const nowSec = Date.now() / 1000;
    const ageMin = bot.created_at ? Math.floor((nowSec - bot.created_at) / 60) : 0;
    const status = bot.status || 'dog_anchor_posted';
    const isLadder = bot.bot_category === 'anchor_ladder';
    const rungs = bot.rungs || [];

    // ── COMPLETED/STOPPED SUMMARY CARD (early return) ──
    if (status === 'completed' || status === 'stopped' || status === 'awaiting_settlement') {
        // Skip completion card for bots that are mid-repeat (transient completed state)
        const _midRepeat = status === 'completed' && bot._just_completed && (
            (bot.smart_mode && !bot._smart_stopped) ||
            (bot.repeat_count > 0 && (bot.repeats_done || 0) <= bot.repeat_count)
        );
        if (!_midRepeat) {
        const _ltPnl = bot.lifetime_pnl ?? bot.net_pnl_cents ?? 0;
        const _runs = Math.max(1, bot.repeats_done || 0);
        const _isCross = bot.cross_market && bot.hedge_ticker && bot.hedge_ticker !== bot.ticker;
        const _qtyPer = bot.rungs ? bot.rungs.reduce((s, r) => s + (r.qty || 1), 0) : (bot.quantity || 1);
        const _crossQty = bot._cross_settled_qty ?? 0;
        let _crossQtyDog = bot._cross_settled_qty_dog ?? _crossQty;
        let _crossQtyFav = bot._cross_settled_qty_fav ?? _crossQty;
        const _isAwaiting = status === 'awaiting_settlement' || (_isCross && (_crossQtyDog > 0 || _crossQtyFav > 0));
        // Subtract smart exit sold qty from the correct side
        if (bot._smart_exit_sold && bot._smart_exit_sold.qty > 0) {
            if (bot._smart_exit_sold.ticker === bot.ticker) _crossQtyDog = Math.max(0, _crossQtyDog - bot._smart_exit_sold.qty);
            else _crossQtyFav = Math.max(0, _crossQtyFav - bot._smart_exit_sold.qty);
        }
        const _isSmart = bot._smart_stopped;
        const _isSettled = _isSmart && bot._smart_stop_reason === 'final';
        const _col = _isAwaiting ? '#818cf8' : _isSettled ? '#ffaa00' : _isSmart ? '#00e5ff' : '#00ff88';
        const _label = _isAwaiting ? '⏳ AWAITING SETTLEMENT' : _isSettled ? '🏁 MARKET SETTLED' : _isSmart ? '⏹ SMART STOP' : '✅ COMPLETE';
        const teamName = formatBotDisplayName(bot.ticker || '', bot.spread_line || '');
        const dogSide = bot.dog_side || 'no';
        const favSide = bot.fav_side || (dogSide === 'yes' ? 'no' : 'yes');
        let liveScoreHtml = '';
        if (gameScores) {
            const parts = (bot.ticker || '').split('-');
            const gk = parts.length >= 2 ? parts[1] : parts[0];
            const gs = gameScores[gk] || null;
            if (gs) liveScoreHtml = buildScoreBadgeHtml(gs, 'compact');
        }
        const _trigger = bot._smart_exit_trigger;
        const _triggerActive = _trigger && _trigger.price > 0 && !bot._smart_exit_sold;
        const item = document.createElement('div');
        item.style.cssText = `background:#0f1419;border:1px solid ${_col}33;border-left:3px solid ${_col};border-radius:12px;padding:14px;margin-bottom:10px;`;
        item.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span style="color:#ffaa00;font-weight:800;font-size:10px;letter-spacing:.08em;">PHANTOM</span>
                    <span style="color:#fff;font-weight:700;font-size:14px;">${teamName}</span>
                    <span style="background:${_col}22;color:${_col};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${_label}</span>
                    ${liveScoreHtml}
                    ${_isCross ? '<span style="background:#00ddff22;color:#00ddff;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:800;">CROSS</span>' : ''}
                    ${bot.smart_mode ? `<span style="background:#00e5ff22;color:#00e5ff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">Smart · ${_runs} runs</span>` : _runs > 1 ? `<span style="background:#6366f122;color:#818cf8;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">${_runs} runs</span>` : ''}
                    ${(() => { const _r = bot.raw_hedge_ms ?? bot._last_raw_hedge_ms; const _l = bot.hedge_latency_ms ?? bot._last_hedge_latency_ms; return (_r != null ? `<span style="color:${_r < 5 ? '#00ffcc' : _r < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;font-size:10px;">⚡${_r.toFixed(1)}ms</span>` : '') + (_l != null ? `<span style="color:#666;font-size:10px;"> rt ${Math.round(_l)}ms</span>` : ''); })()}
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    ${bot.smart_mode ? `<button onclick="restartSmart('${botId}')" style="background:#00e5ff22;color:#00e5ff;border:1px solid #00e5ff44;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">Restart</button>` : ''}
                    ${!bot.smart_mode ? `<button onclick="addRuns('${botId}')" style="background:#6366f122;color:#818cf8;border:1px solid #6366f144;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">+Runs</button>` : ''}
                    ${_isCross && _isAwaiting && !bot._smart_exit_sold ? `<button onclick="smartExitMenu('${botId}')" style="background:#64ffda22;color:#64ffda;border:1px solid #64ffda44;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">Smart Exit</button>` : ''}
                    <button onclick="cancelBot('${botId}')" style="background:#ff444422;color:#ff4444;border:1px solid #ff444444;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="background:#060a14;border:1px solid ${_col}33;border-radius:8px;padding:14px;">
                ${_isCross ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
                    <div style="padding:8px;background:${_col}11;border-radius:6px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#ffaa00;font-size:9px;font-weight:700;">DOG · ${dogSide.toUpperCase()}</span>
                            <span style="color:#fff;font-size:14px;font-weight:800;">${_crossQtyDog}x</span>
                        </div>
                        <div style="background:#1a2540;border-radius:3px;height:6px;overflow:hidden;">
                            <div style="background:#ffaa00;height:100%;width:100%;border-radius:3px;"></div>
                        </div>
                        <div style="color:#555;font-size:9px;margin-top:3px;">${(bot.ticker || '').split('-').pop()} · filled</div>
                    </div>
                    <div style="padding:8px;background:${_col}11;border-radius:6px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="color:#00aaff;font-size:9px;font-weight:700;">FAV · ${favSide.toUpperCase()}</span>
                            <span style="color:#fff;font-size:14px;font-weight:800;">${_crossQtyFav}x</span>
                        </div>
                        <div style="background:#1a2540;border-radius:3px;height:6px;overflow:hidden;">
                            <div style="background:#00aaff;height:100%;width:100%;border-radius:3px;"></div>
                        </div>
                        <div style="color:#555;font-size:9px;margin-top:3px;">${(bot.hedge_ticker || '').split('-').pop()} · filled</div>
                    </div>
                </div>` : ''}
                ${(bot._run_history || []).length > 0 ? `
                <div style="margin-bottom:8px;">
                    ${(bot._run_history || []).map((r, i) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;${i > 0 ? 'border-top:1px solid #1a254033;' : ''}font-size:10px;">
                            <span style="color:#555;font-weight:600;">#${r.run || i + 1}</span>
                            <span style="color:#8892a6;">${r.dog_price || '?'}¢ ${r.result === 'sellback' ? '<span style="color:#ff4444;">→</span> ' + (r.fav_price || '?') + '¢ <span style="color:#ff4444;font-size:8px;">SB</span>' : '/ ' + (r.fav_price || '?') + '¢'}</span>
                            <span style="color:#8892a6;">x${r.qty || 1}</span>
                            ${r.raw_hedge_ms != null ? `<span style="color:${r.raw_hedge_ms <= 5 ? '#00ff88' : r.raw_hedge_ms <= 15 ? '#ffaa00' : '#ff4444'};font-size:9px;">⚡${r.raw_hedge_ms.toFixed(1)}</span>` : ''}
                            <span style="color:${r.pnl >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">${r.pnl >= 0 ? '+' : ''}${r.pnl}¢</span>
                        </div>
                    `).join('')}
                </div>` : _runs > 1 ? `
                <div style="text-align:center;padding:4px;margin-bottom:8px;color:#556;font-size:10px;">${_runs} runs completed · ${_crossQty} contracts per side</div>` : ''}
                <div style="display:flex;gap:16px;font-size:11px;color:#8892a6;justify-content:center;flex-wrap:wrap;">
                    <span>Runs: <strong style="color:#fff;">${_runs}</strong></span>
                    ${(_crossQtyDog > 0 || _crossQtyFav > 0) ? `<span>Holding: <strong style="color:#fff;">${_crossQtyDog === _crossQtyFav ? _crossQtyDog + 'x each' : _crossQtyDog + 'x / ' + _crossQtyFav + 'x'}</strong></span>` : ''}
                    <span>P&L: <strong style="color:${_ltPnl >= 0 ? '#00ff88' : '#ff4444'};font-size:13px;">${_ltPnl >= 0 ? '+' : ''}${_ltPnl}¢</strong></span>
                    ${bot.smart_mode ? `<span>Smart: <strong style="color:#00e5ff;">${bot._smart_wins || 0}W / ${bot._smart_losses || 0}L</strong></span>` : ''}
                </div>
                ${(bot.live_yes_bid != null || bot.live_no_bid != null) ? `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:10px;">
                    <div style="background:#060a14;border:1px solid #00ff8822;border-radius:6px;padding:6px 8px;text-align:center;">
                        <div style="color:#555;font-size:8px;margin-bottom:2px;">${(bot.ticker || '').split('-').pop()} · YES/NO</div>
                        <span style="color:#00ff88;font-weight:700;">${bot.live_yes_bid ?? '?'}¢</span>
                        <span style="color:#555;"> / </span>
                        <span style="color:#ff4444;font-weight:700;">${bot.live_no_bid ?? '?'}¢</span>
                    </div>
                    <div style="background:#060a14;border:1px solid #f7816622;border-radius:6px;padding:6px 8px;text-align:center;">
                        <div style="color:#555;font-size:8px;margin-bottom:2px;">${(bot.hedge_ticker || '').split('-').pop()} · YES/NO</div>
                        <span style="color:#00ff88;font-weight:700;">${bot.live_hedge_yes_bid ?? '?'}¢</span>
                        <span style="color:#555;"> / </span>
                        <span style="color:#ff4444;font-weight:700;">${bot.live_hedge_no_bid ?? '?'}¢</span>
                    </div>
                </div>` : ''}
                ${_triggerActive ? `<div style="text-align:center;margin-top:8px;padding:8px 12px;background:#64ffda22;border:2px solid #64ffda66;border-radius:8px;font-size:12px;color:#64ffda;font-weight:700;">
                    <div style="margin-bottom:4px;">SMART EXIT ARMED</div>
                    <div style="font-size:10px;font-weight:400;color:#8892a6;">Sell <strong style="color:#ff4444;">${(_trigger.ticker || bot.ticker || '').split('-').pop()}</strong> when bid drops to <strong style="color:#ffaa00;">${_trigger.price}¢</strong></div>
                    <div style="font-size:9px;font-weight:400;color:#555;margin-top:2px;">Hold <strong style="color:#00ff88;">${(_trigger.winner_ticker || bot.hedge_ticker || '').split('-').pop()}</strong> for settlement</div>
                    <button onclick="event.stopPropagation();setSmartExitTrigger('${botId}', 0)" style="margin-top:6px;background:#ff444422;color:#ff4444;border:1px solid #ff444444;border-radius:4px;padding:2px 10px;font-size:9px;cursor:pointer;">Cancel Trigger</button>
                </div>` : ''}
                ${bot._smart_exit_sold ? `<div style="text-align:center;margin-top:8px;padding:8px 12px;background:#00ff8822;border:2px solid #00ff8866;border-radius:8px;font-size:12px;color:#00ff88;font-weight:700;">
                    <div style="margin-bottom:4px;">SMART EXIT COMPLETE</div>
                    <div style="font-size:10px;font-weight:400;color:#8892a6;">Sold <strong style="color:#ff4444;">${(bot._smart_exit_sold.ticker || '').split('-').pop()}</strong> @ ${bot._smart_exit_sold.price || '?'}¢ · holding <strong style="color:#00ff88;">${(bot._smart_exit_sold.winner_ticker || '').split('-').pop()}</strong> for settlement</div>
                </div>` : ''}
                ${bot._smart_stop_pending ? `<div style="text-align:center;margin-top:6px;padding:3px 8px;background:#ff880011;border:1px solid #ff880033;border-radius:6px;font-size:10px;color:#ff8800;">Stopping after current cycle</div>` : ''}
            </div>
            <div style="text-align:right;font-size:9px;color:#444;margin-top:4px;">${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${ageMin}m</div>
        `;
        container.appendChild(item);
        return;
    }}
    const dogSide = bot.dog_side || 'no';
    const favSide = bot.fav_side || (dogSide === 'yes' ? 'no' : 'yes');
    const qty = bot.quantity || 1;
    const dogPrice = bot.dog_price || 0;
    const favPrice = bot.fav_price || 0;
    const targetWidth = bot.target_width || 0;
    // Use actual fill price for fav calculation when dog has filled
    const effectiveDogPrice = (bot.avg_fill_price > 0) ? bot.avg_fill_price : dogPrice;
    const favCeiling = 100 - effectiveDogPrice - targetWidth;

    const _isSmartStopped = bot._smart_stopped;
    const _isAwaitingSettlement = status === 'awaiting_settlement' || (status === 'completed' && bot.cross_market && !bot._positions_cleared);
    const _isCompletedSummary = (status === 'completed' || status === 'stopped') || _isAwaitingSettlement;
    const statusMap = {
        'dog_anchor_posted': '⏳ DOG POSTED', 'ladder_posted': '🪜 LADDER POSTED',
        'dog_filled': '👻 FILLED — HEDGING', 'ladder_filled_no_fav': '👻 FILLED — HEDGING',
        'fav_hedge_posted': '⭐ HEDGE POSTED', 'waiting_repeat': bot._just_completed ? '✅ COMPLETED' : '🔄 REPEATING',
        'completed': _isAwaitingSettlement ? '⏳ SETTLED' : _isSmartStopped ? '⏹ SMART STOP' : '✅ COMPLETE',
        'stopped': _isSmartStopped ? '⏹ SMART STOP' : '🛑 STOPPED',
        'awaiting_settlement': '⏳ SETTLED',
    };
    const borderMap = {
        'dog_anchor_posted': '#ffaa00', 'ladder_posted': '#ffaa00',
        'dog_filled': '#ff8800', 'ladder_filled_no_fav': '#ff8800',
        'fav_hedge_posted': '#00aaff', 'waiting_repeat': bot._just_completed ? '#00ff88' : '#aa66ff',
        'completed': _isAwaitingSettlement ? '#818cf8' : _isSmartStopped ? '#00e5ff' : '#00ff88',
        'stopped': _isSmartStopped ? '#00e5ff' : '#ff4444',
        'awaiting_settlement': '#818cf8',
    };
    const borderCol = borderMap[status] || '#ffaa00';
    const statusLabel = statusMap[status] || status;
    const teamName = formatBotDisplayName(bot.ticker || '', bot.spread_line || '');
    const isCrossMarket = bot.cross_market && bot.hedge_ticker && bot.hedge_ticker !== bot.ticker;
    const hedgeTeamCode = isCrossMarket ? (bot.hedge_ticker || '').split('-').pop() : '';

    // Live bid/ask from WS
    const liveYesBid = bot.live_yes_bid || 0;
    const liveYesAsk = bot.live_yes_ask || 0;
    const liveNoBid = bot.live_no_bid || 0;
    const liveNoAsk = bot.live_no_ask || 0;
    const dogBid = dogSide === 'yes' ? liveYesBid : liveNoBid;
    const dogAsk = dogSide === 'yes' ? liveYesAsk : liveNoAsk;
    // Cross-market: fav prices come from hedge ticker's WS cache
    let favBid, favAsk;
    if (isCrossMarket) {
        favBid = bot.live_hedge_yes_bid || bot.live_hedge_no_bid || 0;
        favAsk = bot.live_hedge_yes_ask || bot.live_hedge_no_ask || 0;
        // Use the correct side from hedge ticker
        if (favSide === 'yes') {
            favBid = bot.live_hedge_yes_bid || 0;
            favAsk = bot.live_hedge_yes_ask || 0;
        } else {
            favBid = bot.live_hedge_no_bid || 0;
            favAsk = bot.live_hedge_no_ask || 0;
        }
    } else {
        favBid = favSide === 'yes' ? liveYesBid : liveNoBid;
        favAsk = favSide === 'yes' ? liveYesAsk : liveNoAsk;
    }

    // Live game score
    let liveScoreHtml = '';
    if (gameScores) {
        const ticker = bot.ticker || '';
        const parts = ticker.split('-');
        const gameKey = parts.length >= 2 ? parts[1] : parts[0];
        const gs = gameScores[gameKey] || gameScores[ticker] || null;
        if (gs) {
            liveScoreHtml = buildScoreBadgeHtml(gs, 'compact');
        }
    }

    // Fill info
    const dogFillQty = bot.total_dog_fill_qty || bot.dog_fill_qty || 0;
    const dogFilled = isLadder ? dogFillQty >= (bot.total_dog_qty || qty) : dogFillQty >= qty;
    const favFillQty = bot.fav_fill_qty || 0;
    const hedgeQty = bot.hedge_qty || bot._partial_hedge_qty || (isLadder ? (bot.total_dog_fill_qty || qty) : (dogFillQty > 0 ? dogFillQty : qty));
    const favFilled = favFillQty >= hedgeQty;
    const avgDogPrice = isLadder && bot.avg_fill_price > 0 ? bot.avg_fill_price : dogPrice;
    const repeatCount = bot.repeat_count || 0;
    const repeatsDone = bot.repeats_done || 0;
    const dogFilledAt = bot.dog_filled_at || bot.first_fill_at || 0;
    const fillAgeS = dogFilledAt > 0 ? Math.floor(nowSec - dogFilledAt) : 0;
    const fillAgeStr = fillAgeS >= 60 ? `${Math.floor(fillAgeS / 60)}m ${fillAgeS % 60}s` : `${fillAgeS}s`;
    const walkCount = bot.fav_walk_count || 0;

    // Dog fill bar
    const dogFillPct = qty > 0 ? Math.round((dogFillQty / qty) * 100) : 0;
    const dogFillCol = dogFilled ? '#00ff88' : dogFillQty > 0 ? '#ffaa00' : '#333';

    // Fav fill bar
    const favFillPct = hedgeQty > 0 ? Math.round((favFillQty / hedgeQty) * 100) : 0;
    const favFillCol = favFilled ? '#00ff88' : favFillQty > 0 ? '#ffaa00' : '#333';

    // Fav status text
    const favShave = bot.fav_shave || 0;
    let favStatusText = '';
    // Fav posts at fav_bid - fav_shave, capped at 100 - dog - width
    const maxFavPrice = favCeiling;  // = 100 - dogPrice - targetWidth (cap)
    const wouldPostAt = favShave > 0 && favBid > 0
        ? Math.min(Math.max(1, favBid - favShave), maxFavPrice)
        : favBid > 0 ? Math.min(favBid, maxFavPrice) : maxFavPrice;
    if (favPrice > 0 && walkCount > 0) {
        const combined = avgDogPrice + favPrice;
        favStatusText = `⭐ Hedge @${favPrice}¢ · combined ${combined}¢ · +${100 - combined}¢/contract`;
    } else if (favPrice > 0) {
        const combined = avgDogPrice + favPrice;
        favStatusText = `Posted @${favPrice}¢ · combined ${combined}¢`;
    } else if (dogFilled) {
        favStatusText = `Posting @${wouldPostAt}¢${favShave > 0 ? ` (bid-${favShave})` : ''} · snap bid`;
    } else {
        const estProfit = 100 - effectiveDogPrice - wouldPostAt;
        favStatusText = `On fill → post @${wouldPostAt}¢${favShave > 0 ? ` (bid-${favShave})` : ''} · +${estProfit}¢/contract`;
    }

    // Ladder rungs detail
    let rungsHTML = '';
    if (isLadder && rungs.length > 0) {
        rungsHTML = rungs.map((r, i) => {
            const filled = r.fill_qty >= r.qty;
            const cancelled = r.cancelled === true;
            const hasPartialFills = r.fill_qty > 0 && !filled;
            const fillPct = r.qty > 0 ? Math.round((r.fill_qty / r.qty) * 100) : 0;
            const fillCol = filled ? '#00ff88' : r.fill_qty > 0 ? '#ffaa00' : cancelled ? '#ff4444' : '#333';
            // Only strikethrough if cancelled with ZERO fills — partial fills should show normally
            const priceStyle = (cancelled && !hasPartialFills) ? 'text-decoration:line-through;color:#555;' : 'color:#fff;font-weight:700;';
            const statusDisplay = (cancelled && !hasPartialFills)
                ? `<span style="color:#ff4444;font-weight:700;">✕</span>`
                : `<span style="color:${fillCol};font-weight:700;">${r.fill_qty}/${r.qty}${cancelled && hasPartialFills ? ' ⚡' : ''}</span>`;
            return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;">
                <span style="color:#555;">#${i+1}</span>
                <span style="${priceStyle}">${r.price}¢</span>
                <span style="color:#8892a6;">×${r.qty}</span>
                <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                    <div style="width:${(cancelled && !hasPartialFills) ? 100 : fillPct}%;height:100%;background:${(cancelled && !hasPartialFills) ? '#ff444444' : fillCol};border-radius:2px;"></div>
                </div>
                ${statusDisplay}
            </div>`;
        }).join('');
    }

    const item = document.createElement('div');
    item.style.cssText = `background:#0f1419;border:1px solid ${borderCol}33;border-left:3px solid ${borderCol};border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;`;
    item.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('a')) showBotDetail(botId); };
    try {
    item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <svg width="22" height="22" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 4px #ffaa0066);"><path d="M12 2C8 2 5 5 5 9c0 2 .8 3.5 2 4.5V16c0 1 .5 2 1.5 2.5L10 22h4l1.5-3.5C16.5 18 17 17 17 16v-2.5c1.2-1 2-2.5 2-4.5 0-4-3-7-7-7z" fill="#ffaa0022" stroke="#ffaa00" stroke-width="1.5"/><circle cx="9.5" cy="9" r="1.5" fill="#ffaa00" opacity=".8"/><circle cx="14.5" cy="9" r="1.5" fill="#ffaa00" opacity=".8"/><path d="M9 13c1.5 1.5 4.5 1.5 6 0" stroke="#ffaa00" stroke-width="1" fill="none" stroke-linecap="round" opacity=".6"/></svg>
                <span style="color:#ffaa00;font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;">PHANTOM</span>
                <span style="color:#fff;font-weight:700;font-size:14px;">${teamName}</span>
                <span style="background:${borderCol}22;color:${borderCol};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${statusLabel}</span>
                ${liveScoreHtml}
                ${bot.cross_market ? '<span style="background:#00ddff22;color:#00ddff;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:800;">✕ CROSS</span>' : ''}
                ${dogFilled && favPrice > 0 ? '<span style="background:#33445522;color:#8892a6;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">● snap bid</span>' : ''}
                ${dogFilled ? `<span style="color:#8892a6;font-size:10px;">${fillAgeStr}</span>` : ''}
                ${bot.smart_mode ? `<span style="background:#00e5ff22;color:${bot._smart_stop_pending ? '#ff8800' : '#00e5ff'};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">${bot._smart_stopped ? `⏹ Smart ${bot.repeats_done || 0} runs (${bot._smart_stop_reason === 'manual' ? 'stopped' : `${bot._smart_losses || bot.consecutive_losses || 0}L`})` : bot._smart_stop_pending ? `Stopping after this run · ${bot.repeats_done || 0} runs` : `Smart · ${bot.repeats_done || 0} runs · ${bot.consecutive_losses || 0}L`}</span>` : repeatCount > 0 ? `<span style="background:#6366f122;color:#818cf8;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">Run ${repeatsDone + 1}/${repeatCount + 1}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                ${bot.smart_mode && !bot._smart_stopped && !bot._smart_stop_pending ? `<button onclick="stopSmart('${botId}')" style="background:#ff880022;color:#ff8800;border:1px solid #ff880044;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">Stop</button>` : ''}
                ${!bot.smart_mode ? `<button onclick="addRuns('${botId}')" style="background:#6366f122;color:#818cf8;border:1px solid #6366f144;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">+Runs</button>` : ''}
                ${bot.smart_mode && bot._smart_stopped ? `<button onclick="restartSmart('${botId}')" style="background:#00e5ff22;color:#00e5ff;border:1px solid #00e5ff44;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">Restart</button>` : ''}
                <button onclick="cancelBot('${botId}')" style="background:#ff444422;color:#ff4444;border:1px solid #ff444444;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">✕</button>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <!-- ANCHOR SIDE -->
            <div style="background:#060a14;border:1px solid #ffaa0033;border-radius:8px;padding:10px;">
                <div style="color:#ffaa00;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:6px;">👻 ANCHOR · ${dogSide.toUpperCase()}${dogFilled ? ' · FILLED ✓' : ''}</div>
                <div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:4px;">${isLadder && dogFillQty > 0 && bot.avg_fill_price > 0 ? `Avg ${avgDogPrice}¢` : isLadder && rungs.length > 0 ? `${rungs[rungs.length-1].price}¢–${rungs[0].price}¢` : `${dogPrice}¢`}</div>
                ${isLadder && dogFillQty === 0 ? '<div style="color:#ffaa00;font-size:10px;">Waiting for fill</div>' : ''}
                <div style="color:#555;font-size:10px;margin-bottom:6px;">bid <strong style="color:#ffaa00;">${dogBid || '?'}¢</strong> · ask <strong style="color:#ffaa00;">${dogAsk || '?'}¢</strong></div>
                ${isLadder ? rungsHTML : `
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="flex:1;height:6px;background:#1a2540;border-radius:3px;overflow:hidden;">
                            <div style="width:${dogFillPct}%;height:100%;background:${dogFillCol};border-radius:3px;"></div>
                        </div>
                        <span style="color:${dogFillCol};font-size:10px;font-weight:700;">${Math.min(dogFillQty, qty)}/${qty}</span>
                    </div>
                `}
            </div>
            <!-- FAV SIDE -->
            <div style="background:#060a14;border:1px solid ${favPrice > 0 ? '#00aaff33' : '#1e2740'};border-radius:8px;padding:10px;${!dogFilled && !favPrice ? 'opacity:0.6;' : ''}">
                <div style="color:#00aaff;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:6px;">⭐ ${isCrossMarket ? hedgeTeamCode + ' · ' : ''}FAV · ${favSide.toUpperCase()}${favFilled ? ' · FILLED ✓' : ''}</div>
                <div style="color:#fff;font-weight:700;font-size:14px;margin-bottom:4px;">${favPrice > 0 ? `${favPrice}¢` : `${wouldPostAt}¢`}</div>
                <div style="color:#555;font-size:10px;margin-bottom:6px;">bid <strong style="color:#00aaff;">${favBid || '?'}¢</strong> · ask <strong style="color:#00aaff;">${favAsk || '?'}¢</strong></div>
                <div style="color:#8892a6;font-size:10px;margin-bottom:4px;">${favStatusText}</div>
                ${favPrice > 0 ? `
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="flex:1;height:6px;background:#1a2540;border-radius:3px;overflow:hidden;">
                            <div style="width:${favFillPct}%;height:100%;background:${favFillCol};border-radius:3px;"></div>
                        </div>
                        <span style="color:${favFillCol};font-size:10px;font-weight:700;">${favFillQty}/${hedgeQty}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        ${(() => {
            // Running P&L for dog bot
            if (favFilled && dogFilled) {
                const profitPer = bot.profit_per || (100 - avgDogPrice - favPrice);
                const totalQty = isLadder ? (bot.total_dog_fill_qty || hedgeQty) : qty;
                const estFee = typeof kalshiFeeCents === 'function' ? kalshiFeeCents(dogSide === 'yes' ? avgDogPrice : favPrice, dogSide === 'yes' ? favPrice : avgDogPrice, totalQty) : 0;
                const netProfit = profitPer * totalQty - estFee;
                const pnlCol = netProfit > 0 ? '#00ff88' : netProfit < 0 ? '#ff4444' : '#ffaa00';
                return `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 10px;background:#060a14;border:1px solid ${pnlCol}33;border-radius:6px;font-size:11px;">
                    <span style="color:${pnlCol};font-weight:800;">P&L: ${netProfit >= 0 ? '+' : ''}${netProfit}¢ ($${(netProfit/100).toFixed(2)})</span>
                    <span style="color:#555;font-size:9px;">${profitPer}¢/ea × ${totalQty} - ${estFee}¢ fees</span>
                </div>`;
            } else if (dogFilled && favPrice > 0) {
                const estProfitPer = 100 - avgDogPrice - favPrice;
                const totalQty = isLadder ? (bot.total_dog_fill_qty || hedgeQty) : qty;
                const estFee = typeof kalshiFeeCents === 'function' ? kalshiFeeCents(dogSide === 'yes' ? avgDogPrice : favPrice, dogSide === 'yes' ? favPrice : avgDogPrice, totalQty) : 0;
                const estNet = estProfitPer * totalQty - estFee;
                const pnlCol = estNet > 0 ? '#00ff88' : estNet < 0 ? '#ff4444' : '#ffaa00';
                return `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 10px;background:#060a14;border:1px solid ${pnlCol}33;border-radius:6px;font-size:11px;">
                    <span style="color:${pnlCol};font-weight:800;">Est: ${estNet >= 0 ? '+' : ''}${estNet}¢</span>
                    <span style="color:#555;font-size:9px;">if fav fills @${favPrice}¢</span>
                </div>`;
            } else if (dogFilled && favBid > 0) {
                const estFavPrice = Math.min(favBid, favCeiling);
                const estProfitPer = 100 - avgDogPrice - estFavPrice;
                const totalQty = isLadder ? (bot.total_dog_fill_qty || qty) : qty;
                const estFee = typeof kalshiFeeCents === 'function' ? kalshiFeeCents(dogSide === 'yes' ? avgDogPrice : estFavPrice, dogSide === 'yes' ? estFavPrice : avgDogPrice, totalQty) : 0;
                const estNet = estProfitPer * totalQty - estFee;
                const pnlCol = estNet > 0 ? '#00ff88' : estNet < 0 ? '#ff4444' : '#ffaa00';
                return `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 10px;background:#060a14;border:1px solid ${pnlCol}33;border-radius:6px;font-size:11px;">
                    <span style="color:${pnlCol};font-weight:800;">Est: ${estNet >= 0 ? '+' : ''}${estNet}¢</span>
                    <span style="color:#555;font-size:9px;">at bid ${estFavPrice}¢</span>
                </div>`;
            }
            if (bot._just_completed && bot._last_pnl != null) {
                const lp = bot._last_pnl;
                const lpCol = lp > 0 ? '#00ff88' : lp < 0 ? '#ff4444' : '#ffaa00';
                const ltPnl = bot.lifetime_pnl ?? bot.net_pnl_cents ?? 0;
                const ltCol = ltPnl > 0 ? '#00ff88' : ltPnl < 0 ? '#ff4444' : '#ffaa00';
                return `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 10px;background:#060a14;border:1px solid ${lpCol}44;border-radius:6px;font-size:12px;">
                    <span style="color:${lpCol};font-weight:800;">✅ ${lp >= 0 ? '+' : ''}${lp}¢</span>
                    <span style="color:${ltCol};font-weight:700;font-size:11px;">Total: ${ltPnl >= 0 ? '+' : ''}${ltPnl}¢ ($${(ltPnl/100).toFixed(2)})</span>
                </div>`;
            }
            // Show lifetime P&L if bot has completed at least 1 run
            const _lt = bot.lifetime_pnl ?? bot.net_pnl_cents;
            if (_lt != null && _lt !== 0) {
                const _ltc = _lt > 0 ? '#00ff88' : _lt < 0 ? '#ff4444' : '#ffaa00';
                return `<div style="margin-top:6px;padding:4px 10px;font-size:11px;">
                    <span style="color:${_ltc};font-weight:700;">Total: ${_lt >= 0 ? '+' : ''}${_lt}¢ ($${(_lt/100).toFixed(2)})</span>
                </div>`;
            }
            return '';
        })()}
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #1e2740;font-size:10px;${_isCompletedSummary ? 'display:none;' : ''}">
            <span style="color:#ffaa00;">Depth: ${bot.anchor_depth || targetWidth}¢</span>${bot._fav_depth != null ? `<span style="color:${bot._fav_depth < 50 ? '#ff4444' : bot._fav_depth < 200 ? '#ffaa00' : '#00ff88'};font-size:9px;">fav:${bot._fav_depth}</span>` : ''}
            <span style="color:#8892a6;">×${qty}</span>
            ${isLadder && bot.avg_fill_price > 0 ? `<span style="color:#ffaa00;">Avg: ${bot.avg_fill_price}¢</span>` : ''}
            ${bot.smart_mode ? `<span style="color:#00e5ff;font-weight:700;">${bot._smart_stopped ? `⏹ Smart ${bot.repeats_done || 0} runs (${bot._smart_losses || bot.consecutive_losses || 0}L)` : `Smart · ${bot.repeats_done || 0} runs · ${bot.consecutive_losses || 0}L`}</span>` : bot.repeat_count > 0 ? `<span style="color:#aa66ff;">🔄 ${(bot.repeats_done || 0) + 1}/${bot.repeat_count + 1}</span>` : ''}
            <span style="color:#555;">Hedge tgt: ≤${favCeiling}¢ → snap bid</span>
            ${(() => { const raw = bot.raw_hedge_ms ?? bot._last_raw_hedge_ms; const lat = bot.hedge_latency_ms ?? bot._last_hedge_latency_ms; return (raw != null && raw > 0 ? `<span style="color:${raw < 5 ? '#00ffcc' : raw < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;">⚡raw ${raw.toFixed(1)}ms</span>` : '') + (lat != null ? `<span style="color:${lat < 300 ? '#00ff88' : lat < 800 ? '#ffaa00' : '#ff4444'};font-weight:700;"> ⚡rt ${Math.round(lat)}ms</span>` : ''); })()}
            ${(() => {
                if (status === 'dog_anchor_posted' || status === 'ladder_posted') {
                    const repostCt = bot.dog_repost_count || 0;
                    const dogSide = bot.dog_side || 'no';
                    const wsBid = bot[`live_${dogSide}_bid`] || 0;
                    const bidAtPost = bot._bid_at_post || 0;
                    const gap = wsBid > 0 && bidAtPost > 0 ? Math.abs(wsBid - bidAtPost) : 0;
                    const gapThresh = bot._gap_threshold || 3;
                    const cond = bot._market_condition || 'calm';
                    const cooldown = bot._gap_cooldown || 15;
                    const lastRepost = bot._last_repost_at || 0;
                    const sinceRepost = lastRepost > 0 ? Date.now()/1000 - lastRepost : 999;
                    const cdLeft = Math.max(0, Math.ceil(cooldown - sinceRepost));

                    // Market condition colors
                    const condCol = cond === 'volatile' ? '#ff4444' : cond === 'normal' ? '#ffaa00' : '#00aaff';
                    const condLabel = cond === 'volatile' ? '🔴 VOLATILE' : cond === 'normal' ? '🟡 NORMAL' : '🔵 CALM';

                    // Gap fill ratio for visual
                    const gapPct = Math.min(100, Math.round((gap / gapThresh) * 100));
                    const gapCol = gapPct >= 100 ? '#ff4444' : gapPct >= 60 ? '#ffaa00' : '#555';

                    // Cooldown or ready
                    const cdText = cdLeft > 0 && sinceRepost < cooldown ? `⏱ ${cdLeft}s` : '';

                    // Fallback timer
                    const repostMin = 3;
                    const postedAt = bot.posted_at || bot.created_at || 0;
                    const sinceMin = postedAt > 0 ? (Date.now()/1000 - postedAt) / 60 : 0;
                    const minsLeft = Math.max(0, repostMin - sinceMin).toFixed(1);

                    return `<span style="color:${condCol};font-size:10px;font-weight:600;">${condLabel}</span> `
                         + `<span style="color:${gapCol};">Gap: ${gap}¢/${gapThresh}¢</span> `
                         + (cdText ? `<span style="color:#aa66ff;">${cdText}</span> ` : '')
                         + `<span style="color:#555;font-size:9px;">${parseFloat(minsLeft) <= 0 ? '⏱ 3m✓' : `⏱ ${minsLeft}m`}</span>`
                         + (repostCt > 0 ? ` <span style="color:#888;font-size:9px;">(×${repostCt})</span>` : '');
                }
                if (status === 'fav_hedge_posted') {
                    const hedgeTimeout = bot.hedge_timeout_s || 120;
                    const favPostedAt = bot.fav_posted_at || bot.dog_filled_at || 0;
                    const waitSec = favPostedAt > 0 ? Date.now()/1000 - favPostedAt : 0;
                    const secsLeft = Math.max(0, hedgeTimeout - waitSec);
                    const combined = avgDogPrice + favPrice;
                    const liveCombined = avgDogPrice + Math.max(favPrice, favBid);
                    const atBid = favPrice >= favBid && favBid > 0;
                    const atCeiling = liveCombined > 100;
                    const ceilingStart = bot._over_ceiling_since || 0;
                    const ceilingElapsed = ceilingStart > 0 ? Date.now()/1000 - ceilingStart : 0;
                    const ceilingSecsLeft = Math.max(0, 15 - ceilingElapsed);
                    const statusIcon = atCeiling ? '🔴' : atBid ? '🎯' : '⚡';
                    const statusText = atBid ? (atCeiling ? 'AT CEILING' : 'AT BID') : 'SNAPPING TO BID';
                    const statusCol = atCeiling ? '#ff4444' : atBid ? '#00ff88' : '#00aaff';
                    const timerVal = atCeiling && ceilingStart > 0 ? ceilingSecsLeft : secsLeft;
                    const timerLabel = atCeiling && ceilingStart > 0 ? `⏱ ${Math.round(ceilingSecsLeft)}s` : `${Math.round(secsLeft)}s`;
                    const timerCol = atCeiling ? '#ff4444' : secsLeft <= 30 ? '#ff4444' : secsLeft <= 60 ? '#ff8800' : '#fff';
                    return `</span></div>
                    <div style="background:${statusCol}11;border:1px solid ${statusCol}33;border-radius:5px;padding:6px 8px;font-size:10px;color:${statusCol};margin-top:6px;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
                            <span style="font-weight:700;">${statusIcon} <strong>${statusText}</strong> — ${favSide.toUpperCase()} hedge</span>
                            <span style="color:#00ff88;font-weight:700;font-size:12px;">${favPrice}¢</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;color:#8892a6;font-size:9px;">
                            <span>dog ${avgDogPrice}¢ + fav ${favPrice}¢ = <strong style="color:${combined <= 96 ? '#00ff88' : combined <= 98 ? '#ffaa00' : '#ff4444'};">${combined}¢</strong>${(bot.fav_walk_count || 0) > 0 ? ` · step #${bot.fav_walk_count}` : ''}</span>
                            <span style="color:${timerCol};font-weight:700;font-family:monospace;font-size:12px;">${timerLabel}</span>
                        </div>
                    </div><div style="display:none;">`;
                }
                return '';
            })()}
        </div>
        ${(() => {
            // Run history breakdown (for completed/awaiting/multi-run bots)
            const _rh = bot._run_history || [];
            const _isCross = bot.cross_market && bot.hedge_ticker && bot.hedge_ticker !== bot.ticker;
            const _runs = (bot.repeats_done || 0) + 1;
            const _ltPnl = (bot.lifetime_pnl || 0) + (bot.net_pnl_cents || 0);
            const _qtyPer = bot.rungs ? bot.rungs.reduce((s, r) => s + (r.qty || 1), 0) : (bot.quantity || 1);
            const _crossQtyDog = bot._cross_settled_qty_dog || bot._cross_settled_qty || 0;
            const _crossQtyFav = bot._cross_settled_qty_fav || bot._cross_settled_qty || 0;
            let html = '';
            if (_rh.length > 0) {
                html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid #1e2740;">';
                html += _rh.map((r, i) => '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;' + (i > 0 ? 'border-top:1px solid #1a254033;' : '') + 'font-size:10px;">'
                    + '<span style="color:#555;font-weight:600;">#' + (r.run || i + 1) + '</span>'
                    + '<span style="color:#8892a6;">' + (r.dog_price || '?') + '¢ ' + (r.result === 'sellback' ? '<span style="color:#ff4444;">→</span> ' + (r.fav_price || '?') + '¢ <span style="color:#ff4444;font-size:8px;">SB</span>' : '/ ' + (r.fav_price || '?') + '¢') + '</span>'
                    + '<span style="color:#8892a6;">x' + (r.qty || 1) + '</span>'
                    + (r.raw_hedge_ms != null ? '<span style="color:' + (r.raw_hedge_ms <= 5 ? '#00ff88' : r.raw_hedge_ms <= 15 ? '#ffaa00' : '#ff4444') + ';font-size:9px;">⚡' + r.raw_hedge_ms.toFixed(1) + '</span>' : '')
                    + '<span style="color:' + (r.pnl >= 0 ? '#00ff88' : '#ff4444') + ';font-weight:700;">' + (r.pnl >= 0 ? '+' : '') + r.pnl + '¢</span>'
                    + '</div>').join('');
                html += '</div>';
            }
            if ((status === 'awaiting_settlement' || status === 'completed' || status === 'stopped') && _isCross && _crossQtyDog > 0) {
                html += '<div style="display:flex;gap:16px;font-size:11px;color:#8892a6;justify-content:center;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px solid #1e2740;">'
                    + '<span>Runs: <strong style="color:#fff;">' + _runs + '</strong></span>'
                    + '<span>Holding: <strong style="color:#fff;">' + (_crossQtyDog === _crossQtyFav ? _crossQtyDog + 'x each' : _crossQtyDog + 'x / ' + _crossQtyFav + 'x') + '</strong></span>'
                    + '<span>P&L: <strong style="color:' + (_ltPnl >= 0 ? '#00ff88' : '#ff4444') + ';font-size:13px;">' + (_ltPnl >= 0 ? '+' : '') + _ltPnl + '¢</strong></span>'
                    + (bot.smart_mode ? '<span>Smart: <strong style="color:#00e5ff;">' + (bot._smart_wins || 0) + 'W / ' + (bot._smart_losses || 0) + 'L</strong></span>' : '')
                    + '</div>';
            }
            return html;
        })()}
        <div style="text-align:right;font-size:9px;color:#444;margin-top:4px;">${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${ageMin}m</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="color:#2a3550;font-size:8px;font-family:monospace;">${botId.slice(-12)}</span>
            <button onclick="event.stopPropagation();navigator.clipboard.writeText('${botId}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:8px;padding:0;color:#2a3550;" title="Copy bot ID">📋</button>
        </div>
    `;
    } catch(e) {
        console.error('Phantom card innerHTML error:', botId, e);
        item.innerHTML = `<div style="padding:14px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="color:#ffaa00;font-weight:800;font-size:10px;">PHANTOM</span>
                <span style="color:#fff;font-weight:700;">${teamName || botId.slice(-12)}</span>
                <span style="background:${borderCol}22;color:${borderCol};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${statusLabel || status}</span>
            </div>
            <div style="color:#ff8800;font-size:11px;">Card render error — bot is still active</div>
            <div style="color:#555;font-size:9px;margin-top:4px;">${botId}</div>
        </div>`;
    }
    container.appendChild(item);
}


function _renderLadderArbCard(bot, botId, container, gameScores, gameKey) {
    const nowSec = Date.now() / 1000;
    const ageMin = bot.created_at ? Math.floor((nowSec - bot.created_at) / 60) : 0;
    const status = bot.status || 'ladder_arb_posted';
    const rungs = bot.rungs || [];
    const qtyPer = bot.quantity || 1;
    const phase = bot.game_phase || 'pregame';

    const statusMap = {
        'ladder_arb_posted': '⚡ BOTH LIVE',
        'ladder_arb_active': '🔥 ACTIVE',
        'waiting_repeat': '🔄 REPEATING',
        'drift_cancelled': '🚫 DRIFT',
        'completed': '✅ DONE',
        'stopped': '🛑 STOPPED',
        'awaiting_settlement': '⏳ SETTLE',
    };
    // Smart mode info
    const isSmart = bot.smart_mode;
    const smartWins = bot._smart_wins || 0;
    const smartLosses = bot._smart_losses || 0;
    const borderMap = {
        'ladder_arb_posted': '#00aaff',
        'ladder_arb_active': '#ffaa00',
        'waiting_repeat': '#aa66ff',
        'drift_cancelled': '#ff8800',
        'completed': '#00ff88',
        'stopped': '#ff4444',
        'awaiting_settlement': '#00e5ff',
    };
    const borderCol = borderMap[status] || '#00aaff';
    const statusLabel = statusMap[status] || status;
    const teamName = formatBotDisplayName(bot.ticker || '', bot.spread_line || '');

    // Live score
    let liveScoreHtml = '';
    if (gameScores && gameKey) {
        const gs = gameScores[gameKey] || {};
        if (gs.home_score != null || gs.away_score != null) {
            liveScoreHtml = buildScoreBadgeHtml(gs, 'compact');
        }
    }

    // Repeat info
    const repeatCount = bot.repeat_count || 0;
    const repeatsDone = bot.repeats_done || 0;
    const cumulativePnl = (bot.lifetime_pnl || 0) + (bot.net_pnl_cents || bot.cumulative_pnl || 0);
    let cycleInfo = '';
    if (repeatCount > 0) {
        cycleInfo = `<span style="background:#6366f122;color:#818cf8;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">Run ${repeatsDone + 1}/${repeatCount + 1}</span>`;
    }

    // Live bid/ask for market context
    const yBid = bot.live_yes_bid != null ? bot.live_yes_bid : null;
    const nBid = bot.live_no_bid != null ? bot.live_no_bid : null;

    // ── Per-rung rendering — each rung is its own independent scalp ──
    let rungTotalPnl = 0;
    let activeCount = 0, doneCount = 0, postedCount = 0;

    const rungsHTML = rungs.map((r, i) => {
        const rQty = r.quantity || qtyPer;
        const rs = r.status || 'posted';
        const width = r.width;

        // ── COMPLETED: show actual fill prices with fill bars ──
        if (rs === 'completed' || r._profit_recorded) {
            doneCount++;
            // Use actual prices: anchor side = original, hedge side = hedge_price (may differ after snap)
            const ancSide = r.anchor_side;
            const hedgeP = r.hedge_price || 0;
            let yP, nP;
            if (ancSide === 'yes') {
                yP = r.yes_price || 0;  // anchor = original
                nP = hedgeP || r.no_price || 0;  // hedge = actual fill price
            } else if (ancSide === 'no') {
                yP = hedgeP || r.yes_price || 0;
                nP = r.no_price || 0;
            } else {
                yP = r.yes_price || 0;
                nP = r.no_price || 0;
            }
            const combined = yP + nP;
            const wasSnapped = r.time_stage === 'snapped';
            // Use backend net P&L (includes fees) if available, else raw spread * qty
            const prof = r._net_pnl != null ? r._net_pnl : (combined > 0 ? (100 - combined) * rQty : 0);
            rungTotalPnl += prof;
            const pCol = prof > 0 ? '#00ff88' : prof < 0 ? '#ff4444' : '#555';
            return `<div style="display:grid;grid-template-columns:40px 1fr 1fr 55px;gap:4px;align-items:center;font-size:10px;padding:4px 0;border-bottom:1px solid #1e274015;opacity:0.5;">
                <span style="color:#ffaa00;font-weight:700;">${width}¢</span>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:#00ff88;font-size:9px;width:28px;">Y${yP}</span>
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:100%;height:100%;background:#00ff88;border-radius:2px;"></div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:#ff4444;font-size:9px;width:28px;">N${nP}</span>
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:100%;height:100%;background:#ff4444;border-radius:2px;"></div>
                    </div>
                </div>
                <span style="color:${pCol};font-weight:700;font-size:10px;text-align:right;">${wasSnapped ? '⚡' : '🎯'}${prof > 0 ? '+' : ''}${prof}¢</span>
            </div>`;
        }

        // ── ALL OTHER STATES: show both sides with fill progress ──
        postedCount++;
        const yFill = r.yes_fill_qty || 0;
        const nFill = r.no_fill_qty || 0;
        const yFull = yFill >= rQty;
        const nFull = nFill >= rQty;
        const isAnchored = !!r.anchor_side;
        const rStage = r.time_stage || 'posted';
        const hedgePrice = r.hedge_price || 0;
        const anchorSide = r.anchor_side;
        const hedgeSide = anchorSide === 'yes' ? 'no' : 'yes';
        const hedgeBid = hedgeSide === 'yes' ? yBid : nBid;

        // ── ANCHORED RUNG: one side filled, hedge order live ──
        if (isAnchored) {
            activeCount++;
            const anchorPrice = r[anchorSide + '_price'] || 0;
            const elapsed = r.anchor_fill_at ? Math.round((Date.now()/1000) - r.anchor_fill_at) : 0;
            const midDist = r._midpoint_dist || 0;
            const snapTimer = r._snap_timer || 60;
            const driftStarted = r._drift_started_at;
            const driftElapsed = driftStarted ? Math.round((Date.now()/1000) - driftStarted) : 0;
            const driftCountdown = driftStarted ? Math.max(0, snapTimer - driftElapsed) : 0;
            const combined = anchorPrice + hedgePrice;
            const profEst = combined > 0 ? (100 - combined) : 0;
            const profColor = profEst >= 3 ? '#00ff88' : profEst >= 1 ? '#ffaa00' : '#ff4444';

            // Stage display: breathing / drifting with timer / snapped / burst / stop-loss / walking
            let stageHTML;
            const snapReason = r._snap_reason || '';
            const isBurst = snapReason.startsWith('burst_');
            const isStopLossPP = snapReason.startsWith('stop_loss_pp');
            const walkPrice = r._walk_price;
            if (rStage === 'pending_profit') {
                if (isStopLossPP) {
                    stageHTML = `<span style="background:#ff000033;color:#ff4444;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;animation:botPulse 0.5s infinite;">🛑 STOP-LOSS</span>`;
                } else if (isBurst) {
                    stageHTML = `<span style="background:#ff000033;color:#ff4444;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;animation:botPulse 0.5s infinite;">⚡ BURST</span>`;
                } else if (midDist <= 5) {
                    stageHTML = `<span style="background:#00ff8822;color:#00ff88;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">🟢 ${midDist}¢</span>`;
                } else if (driftStarted) {
                    stageHTML = `<span style="background:#ff444422;color:#ff4444;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">🔴 ${midDist}¢ ${driftCountdown}s</span>`;
                } else {
                    stageHTML = `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">🟡 ${midDist}¢</span>`;
                }
            } else if (rStage === 'snapped') {
                if (isBurst) {
                    stageHTML = `<span style="background:#ff000033;color:#ff4444;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">⚡ BURST</span>`;
                } else if (isStopLossPP) {
                    stageHTML = `<span style="background:#ff000033;color:#ff4444;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">🛑 STOP-LOSS</span>`;
                } else if (walkPrice) {
                    stageHTML = `<span style="background:#aa66ff22;color:#aa66ff;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">📈 WALK @${walkPrice}¢</span>`;
                } else {
                    stageHTML = `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">⚡ AT BID</span>`;
                }
            } else {
                stageHTML = `<span style="color:#555;font-size:9px;">${rStage}</span>`;
            }

            const snapBtn = (rStage === 'pending_profit') ? `<button onclick="event.stopPropagation();snapRung('${botId}',${i})" style="background:#ffaa0011;color:#ffaa00;border:1px solid #ffaa0033;border-radius:4px;padding:2px 8px;font-size:9px;cursor:pointer;font-weight:600;">Snap Now</button>` : '';

            // Fill bar layout: YES left, NO right — anchor shows full bar, hedge shows progress
            const yesIsAnchor = anchorSide === 'yes';
            const yesPrice = yesIsAnchor ? anchorPrice : hedgePrice;
            const noPrice = yesIsAnchor ? hedgePrice : anchorPrice;
            const hfq = r.hedge_fill_qty || 0;
            const yesFillPct = yesIsAnchor ? 100 : (rQty > 0 ? Math.round((hfq/rQty)*100) : 0);
            const noFillPct = !yesIsAnchor ? 100 : (rQty > 0 ? Math.round((hfq/rQty)*100) : 0);
            const yesFilled = yesIsAnchor;
            const noFilled = !yesIsAnchor;
            const hedgeDistLabel = hedgeBid != null && hedgePrice ? (hedgePrice >= hedgeBid ? '<span style="color:#00ff88;font-size:7px;"> AT BID</span>' : `<span style="color:#ff8800;font-size:7px;"> ${hedgeBid - hedgePrice}↓</span>`) : '';

            return `<div style="display:grid;grid-template-columns:40px 1fr 1fr 50px;gap:4px;align-items:center;font-size:10px;padding:5px 2px;border-bottom:1px solid #1e274022;">
                <div><span style="color:#ffaa00;font-weight:700;">${width}¢</span></div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:#00ff88;font-size:9px;width:28px;">Y${yesPrice}</span>${!yesFilled ? hedgeDistLabel : ''}
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${yesFillPct}%;height:100%;background:${yesFilled ? '#00ff88' : '#335'};border-radius:2px;"></div>
                    </div>
                    <span style="color:${yesFilled ? '#00ff88' : '#555'};font-size:8px;">${yesFilled ? '✓' : hfq + '/' + rQty}</span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:#ff4444;font-size:9px;width:28px;">N${noPrice}</span>${!noFilled ? hedgeDistLabel : ''}
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${noFillPct}%;height:100%;background:${noFilled ? '#ff4444' : '#335'};border-radius:2px;"></div>
                    </div>
                    <span style="color:${noFilled ? '#ff4444' : '#555'};font-size:8px;">${noFilled ? '✓' : hfq + '/' + rQty}</span>
                </div>
                <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:1px;">
                    ${(() => {
                        // Show live profit gap using hedge BID (what snap would fill at)
                        const liveCombined = anchorPrice + (hedgeBid || hedgePrice);
                        const liveProf = liveCombined > 0 ? (100 - liveCombined) : 0;
                        const liveCol = liveProf >= 3 ? '#00ff88' : liveProf >= 0 ? '#ffaa00' : '#ff4444';
                        const timerStr = driftStarted ? ` ${driftCountdown}s` : '';
                        return `<span style="color:${liveCol};font-size:8px;font-weight:700;">${liveProf >= 0 ? '🟢' : '🔴'}${liveProf}¢${timerStr}</span>`;
                    })()}
                    ${snapBtn ? snapBtn : `<span style="color:${profColor};font-size:9px;font-weight:700;">${profEst > 0 ? '+' : ''}${profEst}¢</span>`}
                </div>
            </div>`;
        }

        // ── POSTED (not yet anchored): show both sides with bid distance ──
        const yDist = (yBid != null && r.yes_price) ? (yBid - r.yes_price) : null;
        const nDist = (nBid != null && r.no_price) ? (nBid - r.no_price) : null;
        const yDistLabel = yFull ? '' : (yDist != null ? `<span style="color:${yDist <= 1 ? '#ffaa00' : yDist <= 3 ? '#8892a6' : '#555'};font-size:7px;"> ${yDist > 0 ? '+' : ''}${yDist}</span>` : '');
        const nDistLabel = nFull ? '' : (nDist != null ? `<span style="color:${nDist <= 1 ? '#ffaa00' : nDist <= 3 ? '#8892a6' : '#555'};font-size:7px;"> ${nDist > 0 ? '+' : ''}${nDist}</span>` : '');
        return `<div style="display:grid;grid-template-columns:52px 1fr 1fr 30px;gap:4px;align-items:center;font-size:10px;padding:4px 0;border-bottom:1px solid #1e274015;">
            <span style="color:#ffaa00;font-weight:700;">${width}¢</span>
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="color:#00ff88;font-size:9px;width:26px;">Y${r.yes_price}</span>${yDistLabel}
                <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                    <div style="width:${rQty > 0 ? Math.round((yFill/rQty)*100) : 0}%;height:100%;background:${yFull ? '#00ff88' : '#335'};border-radius:2px;"></div>
                </div>
                <span style="color:${yFull ? '#00ff88' : '#555'};font-size:8px;">${yFull ? '✓' : yFill + '/' + rQty}</span>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="color:#ff4444;font-size:9px;width:26px;">N${r.no_price}</span>${nDistLabel}
                <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                    <div style="width:${rQty > 0 ? Math.round((nFill/rQty)*100) : 0}%;height:100%;background:${nFull ? '#ff4444' : '#335'};border-radius:2px;"></div>
                </div>
                <span style="color:${nFull ? '#ff4444' : '#555'};font-size:8px;">${nFull ? '✓' : nFill + '/' + rQty}</span>
            </div>
            <span style="color:#333;font-size:9px;text-align:right;">—</span>
        </div>`;
    }).join('');

    // ── Status summary bar ──
    let statusInfo = '';
    if (status === 'ladder_arb_active') {
        const _mktLine = (yBid != null && nBid != null) ? `<span style="color:#8892a6;font-size:9px;">mkt: Y${yBid}/N${nBid}</span>` : '';
        statusInfo = `<div style="display:flex;align-items:center;gap:10px;font-size:10px;padding:6px 8px;background:#0a0e1a;border-radius:5px;margin-top:6px;">
            ${activeCount > 0 ? `<span style="color:#ffaa00;font-weight:700;">🔥 ${activeCount} active</span>` : ''}
            ${doneCount > 0 ? `<span style="color:#00ff88;">✅ ${doneCount} done</span>` : ''}
            ${postedCount > 0 ? `<span style="color:#555;">⏳ ${postedCount} waiting</span>` : ''}
            ${_mktLine}
            ${rungTotalPnl !== 0 ? `<span style="color:${rungTotalPnl >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;margin-left:auto;">Total: ${rungTotalPnl >= 0 ? '+' : ''}${rungTotalPnl}¢</span>` : ''}
        </div>`;
    } else if (status === 'ladder_arb_posted') {
        const _yBid = bot.live_yes_bid != null ? bot.live_yes_bid : '?';
        const _yAsk = bot.live_yes_ask != null ? bot.live_yes_ask : '?';
        const _nBid = bot.live_no_bid != null ? bot.live_no_bid : '?';
        const _nAsk = bot.live_no_ask != null ? bot.live_no_ask : '?';
        statusInfo = `<div style="display:flex;align-items:center;gap:10px;font-size:10px;padding:6px 8px;background:#00aaff08;border:1px solid #00aaff22;border-radius:5px;margin-top:6px;">
            <span style="color:#00aaff;">⚡ ${rungs.length} rungs live</span>
            <span style="color:#8892a6;">Y <strong style="color:#00ff88;">${_yBid}/${_yAsk}¢</strong> · N <strong style="color:#ff4444;">${_nBid}/${_nAsk}¢</strong></span>
        </div>`;
    } else if (status === 'waiting_repeat') {
        statusInfo = `<div style="padding:6px 8px;background:#aa66ff08;border:1px solid #aa66ff22;border-radius:5px;margin-top:6px;font-size:10px;color:#aa66ff;">
            🔄 Cycle ${repeatsDone + 1}/${repeatCount + 1} done${rungTotalPnl !== 0 ? ` · <strong>${rungTotalPnl >= 0 ? '+' : ''}${rungTotalPnl}¢</strong>` : ''} — reposting ~10s
        </div>`;
    } else if (status === 'completed' || status === 'stopped') {
        statusInfo = rungTotalPnl !== 0 ? `<div style="padding:6px 8px;background:#0a0e1a;border-radius:5px;margin-top:6px;font-size:10px;">
            <span style="color:${rungTotalPnl >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">Total P&L: ${rungTotalPnl >= 0 ? '+' : ''}${rungTotalPnl}¢</span>
        </div>` : '';
    } else if (status === 'awaiting_settlement') {
        statusInfo = `<div style="padding:6px 8px;background:#00e5ff08;border:1px solid #00e5ff22;border-radius:5px;margin-top:6px;font-size:10px;color:#00e5ff;">
            ⏳ Awaiting settlement — position held
        </div>`;
    }

    // ── Run history (past cycles) ──
    const _runHist = bot._run_history || [];
    let runHistoryHtml = '';
    if (_runHist.length > 0) {
        runHistoryHtml = `<div style="background:#060a14;border:1px solid #1e274033;border-radius:8px;padding:6px 10px;margin-top:6px;">
            ${_runHist.map((r, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;${i > 0 ? 'border-top:1px solid #1a254033;' : ''}font-size:10px;">
                <span style="color:#555;font-weight:600;">#${r.run || i + 1}</span>
                <span style="color:#8892a6;">${r.rungs_completed || '?'}/${r.total_rungs || '?'} rungs</span>
                <span style="color:#8892a6;">x${r.qty || 1}</span>
                <span style="color:${r.pnl >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">${r.pnl >= 0 ? '+' : ''}${r.pnl}¢</span>
            </div>`).join('')}
        </div>`;
    }

    const item = document.createElement('div');
    item.style.cssText = `background:#0f1419;border:1px solid ${borderCol}33;border-left:3px solid ${borderCol};border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;`;
    item.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('a')) showBotDetail(botId); };
    item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <svg width="22" height="22" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 4px #00aaff66);"><polygon points="12,2 22,20 2,20" fill="none" stroke="#00aaff" stroke-width="2" stroke-linejoin="round"/><polygon points="12,8 17,17 7,17" fill="#00aaff33" stroke="#00aaff" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.5" fill="#00aaff"/></svg>
                <span style="color:#00aaff;font-weight:800;font-size:10px;letter-spacing:.08em;">APEX</span>
                <span style="color:#fff;font-weight:700;font-size:14px;">${teamName}</span>
                <span style="background:${borderCol}22;color:${borderCol};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${statusLabel}</span>
                <span style="background:#ffaa0022;color:#ffaa00;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">🪜 ${rungs.length}</span>
                ${cumulativePnl !== 0 ? `<span style="background:${cumulativePnl >= 0 ? '#00ff88' : '#ff4444'}22;color:${cumulativePnl >= 0 ? '#00ff88' : '#ff4444'};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">${cumulativePnl >= 0 ? '+' : ''}${cumulativePnl}¢</span>` : ''}
                ${liveScoreHtml}
                ${cycleInfo}
                ${isSmart ? `<span style="background:#00e5ff22;color:#00e5ff;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">Smart ${smartWins}W/${smartLosses}L${bot.consecutive_losses ? ` · ${bot.consecutive_losses}L streak` : ''}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                ${isSmart && status !== 'completed' && status !== 'stopped' ? `<button onclick="event.stopPropagation();smartStopApex('${botId}')" style="background:#00e5ff22;color:#00e5ff;border:1px solid #00e5ff44;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">⏹ Stop</button>` : ''}
                ${isSmart && (status === 'completed' || status === 'stopped') ? `<button onclick="event.stopPropagation();restartSmart('${botId}')" style="background:#00e5ff22;color:#00e5ff;border:1px solid #00e5ff44;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">🔄 Restart</button>` : ''}
                ${!isSmart && repeatCount > 0 && status !== 'completed' ? `<button onclick="event.stopPropagation();addRuns('${botId}')" style="background:#6366f122;color:#818cf8;border:1px solid #6366f144;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-weight:700;">+Runs</button>` : ''}
                <button onclick="cancelBot('${botId}')" style="background:#ff444422;color:#ff4444;border:1px solid #ff444444;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">✕</button>
            </div>
        </div>
        ${(yBid != null || nBid != null) ? `<div style="display:flex;justify-content:space-around;padding:4px 8px;background:#060a14;border:1px solid #1e274033;border-radius:6px 6px 0 0;font-size:10px;">
            <span style="color:#8892a6;">MARKET</span>
            <span>YES <strong style="color:#00ff88;">${yBid ?? '?'}¢</strong><span style="color:#555;"> / ${bot.live_yes_ask ?? '?'}¢</span></span>
            <span>NO <strong style="color:#ff4444;">${nBid ?? '?'}¢</strong><span style="color:#555;"> / ${bot.live_no_ask ?? '?'}¢</span></span>
        </div>` : ''}
        <div style="background:#060a14;border:1px solid #1e274033;${(yBid != null || nBid != null) ? 'border-top:none;border-radius:0 0 8px 8px;' : 'border-radius:8px;'}padding:8px 10px;">
            ${rungsHTML}
        </div>
        ${statusInfo}
        ${runHistoryHtml}
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px solid #1e2740;font-size:10px;">
            <span style="color:#ffaa00;">Widths: ${rungs.map(r => r.width + '¢').join(', ')}</span>
            <span style="color:#8892a6;">×${qtyPer}</span>
            <span style="color:#555;">${phase === 'live' ? '🔴 LIVE' : '⏳ PRE'}</span>
            ${bot.repost_count ? `<span style="color:#ff8800;font-weight:700;background:#ff880015;padding:1px 6px;border-radius:4px;">↻ #${bot.repost_count}</span>` : ''}
        </div>
        <div style="text-align:right;font-size:9px;color:#444;margin-top:4px;">${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${ageMin}m</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="color:#2a3550;font-size:8px;font-family:monospace;">${botId.slice(-12)}</span>
            <button onclick="event.stopPropagation();navigator.clipboard.writeText('${botId}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:8px;padding:0;color:#2a3550;" title="Copy bot ID">📋</button>
        </div>
    `;
    container.appendChild(item);
}


function _renderMiddleBotCard(bot, botId, container, gameScores) {
    const combinedAvg = (status === 'ladder_arb_yes_filled' || status === 'ladder_arb_no_filled') && hedgePriceForPnl > 0
        ? (status === 'ladder_arb_yes_filled' ? avgYes : avgNo) + hedgePriceForPnl  // anchor avg + actual hedge
        : avgYes + avgNo;
    const estFeePerContract = combinedAvg > 0 ? kalshiFeeCents(avgYes || Math.round(combinedAvg / 2), avgNo || Math.round(combinedAvg / 2), 1) : 0;
    const effectiveProfit = combinedAvg > 0 ? (100 - combinedAvg - estFeePerContract) : 0;
    const pnlColor = effectiveProfit > 2 ? '#00ff88' : effectiveProfit > 0 ? '#00aaff' : '#ff4444';

    // Rungs table — show consolidated hedge when one side is filled
    const isConsolidated = bot._consolidated;
    const filledSideForRungs = status === 'ladder_arb_yes_filled' ? 'yes' : status === 'ladder_arb_no_filled' ? 'no' : null;
    const hedgePrice = bot.hedge_price || 0;
    const hedgeQty = bot.hedge_qty || 0;
    const hedgeSide = filledSideForRungs === 'yes' ? 'no' : 'yes';

    // Hedge history (completed hedge generations)
    const hedgeHistory = bot.hedge_history || [];
    const completedRungs = bot.completed_rungs_count || 0;
    const cumulativePnl = (bot.lifetime_pnl || 0) + (bot.net_pnl_cents || bot.cumulative_pnl || 0);

    // Shared fill-state variables
    const filledSideKey = status === 'ladder_arb_yes_filled' ? 'yes'
        : status === 'ladder_arb_no_filled' ? 'no'
        : status === 'apex_selling_back' ? (bot.first_fill_side || 'yes')
        : status === 'awaiting_settlement' ? (bot.first_fill_side || 'yes')
        : null;
    const isFilled = !!filledSideKey;
    const filledSideLabel = filledSideKey === 'yes' ? 'YES' : filledSideKey === 'no' ? 'NO' : '';
    const unfilledSideLabel = filledSideLabel === 'YES' ? 'NO' : 'YES';
    const filledColor = filledSideKey === 'yes' ? '#00ff88' : '#ff4444';
    const hedgeColorSide = hedgeSide === 'yes' ? '#00ff88' : '#ff4444';
    const avgFilled = isFilled ? (filledSideKey === 'yes' ? avgYes : avgNo) : 0;
    const filledQty = isFilled ? (filledSideKey === 'yes' ? totalYesFill : totalNoFill) : 0;
    const unfilledBid = isFilled ? (unfilledSideLabel === 'YES' ? (bot.live_yes_bid || 0) : (bot.live_no_bid || 0)) : 0;
    const unfilledAsk = isFilled ? (unfilledSideLabel === 'YES' ? (bot.live_yes_ask || 0) : (bot.live_no_ask || 0)) : 0;
    const filledBid = isFilled ? (filledSideLabel === 'YES' ? (bot.live_yes_bid || 0) : (bot.live_no_bid || 0)) : 0;
    const filledAsk = isFilled ? (filledSideLabel === 'YES' ? (bot.live_yes_ask || 0) : (bot.live_no_ask || 0)) : 0;
    const currentHedgePrice = hedgePrice || 0;
    const combined = avgFilled + currentHedgePrice;
    const _botCeiling = bot.hard_ceiling || 98;
    const firstFillAt = bot.first_fill_at || 0;
    const lastWalkAt = bot.last_walk_at || firstFillAt || 0;
    const atCeiling = combined >= _botCeiling;
    const gameUrgency = bot._game_urgency || 'normal';
    const walkInterval = bot._walk_interval != null ? bot._walk_interval : (atCeiling ? 3 : 20);
    const nextWalkIn = lastWalkAt > 0 ? Math.max(0, Math.ceil(walkInterval - (nowSec - lastWalkAt))) : walkInterval;
    const urgencyBadge = gameUrgency === 'critical' ? '<span style="color:#ff4444;font-weight:700;font-size:9px;background:#ff444422;padding:1px 4px;border-radius:3px;">⚡ CRITICAL</span>'
        : gameUrgency === 'late' ? '<span style="color:#ff8800;font-weight:700;font-size:9px;background:#ff880022;padding:1px 4px;border-radius:3px;">🔥 LATE</span>'
        : gameUrgency === 'halftime' ? '<span style="color:#818cf8;font-weight:700;font-size:9px;background:#818cf822;padding:1px 4px;border-radius:3px;">⏸ HALF</span>'
        : '<span style="color:#8892a6;font-weight:600;font-size:9px;background:#8892a612;padding:1px 4px;border-radius:3px;">NORMAL</span>';
    const fillAgeS = firstFillAt > 0 ? Math.floor(nowSec - firstFillAt) : 0;
    const fillAgeStr = fillAgeS >= 60 ? `${Math.floor(fillAgeS / 60)}m ${fillAgeS % 60}s` : `${fillAgeS}s`;
    // Ceiling distance
    const ceilingDist = isFilled ? (98 - combined) : 0;

    let rungsHTML;
    if (status === 'ladder_arb_active') {
        // ── APEX 2.0: per-rung rows with time-stage badges and countdowns ──
        rungsHTML = rungs.map((r, i) => {
            const rQty = r.quantity || qtyPer;
            const rs = r.status || 'posted';
            const width = r.width;
            if (rs === 'posted') {
                const yFill = r.yes_fill_qty || 0;
                const nFill = r.no_fill_qty || 0;
                return `<div style="display:grid;grid-template-columns:30px 1fr 1fr;gap:6px;align-items:center;font-size:10px;padding:3px 0;opacity:0.4;">
                    <span style="color:#ffaa00;font-weight:700;">${width}¢</span>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span style="color:#00ff88;font-size:9px;width:24px;">Y${r.yes_price}</span>
                        <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                            <div style="width:${rQty > 0 ? Math.round((yFill/rQty)*100) : 0}%;height:100%;background:${yFill >= rQty ? '#00ff88' : '#333'};border-radius:2px;"></div>
                        </div>
                        <span style="color:#555;font-size:9px;">${yFill}/${rQty}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span style="color:#ff4444;font-size:9px;width:24px;">N${r.no_price}</span>
                        <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                            <div style="width:${rQty > 0 ? Math.round((nFill/rQty)*100) : 0}%;height:100%;background:${nFill >= rQty ? '#ff4444' : '#333'};border-radius:2px;"></div>
                        </div>
                        <span style="color:#555;font-size:9px;">${nFill}/${rQty}</span>
                    </div>
                </div>`;
            }
            if (rs === 'completed' || r._profit_recorded) {
                const aS = r.anchor_side || 'yes';
                const hP = r.hedge_price || 0;
                let yP, nP;
                if (aS === 'yes') {
                    yP = r.yes_price || 0;
                    nP = hP || r.no_price || 0;
                } else if (aS === 'no') {
                    yP = hP || r.yes_price || 0;
                    nP = r.no_price || 0;
                } else {
                    yP = r.yes_price || 0;
                    nP = r.no_price || 0;
                }
                const comb = yP + nP;
                const wasSnapped = r.time_stage === 'snapped';
                const prof = r._net_pnl != null ? r._net_pnl : (comb > 0 ? (100 - comb) * (r.quantity || qtyPer) : 0);
                const pCol = prof > 0 ? '#00ff88' : prof < 0 ? '#ff4444' : '#555';
                return `<div style="display:grid;grid-template-columns:40px 1fr 1fr 55px;gap:4px;align-items:center;font-size:10px;padding:4px 0;border-bottom:1px solid #1e274015;opacity:0.5;">
                    <span style="color:#ffaa00;font-weight:700;">${width}¢</span>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span style="color:#00ff88;font-size:9px;width:28px;">Y${yP}</span>
                        <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                            <div style="width:100%;height:100%;background:#00ff88;border-radius:2px;"></div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span style="color:#ff4444;font-size:9px;width:28px;">N${nP}</span>
                        <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                            <div style="width:100%;height:100%;background:#ff4444;border-radius:2px;"></div>
                        </div>
                    </div>
                    <span style="color:${pCol};font-weight:700;font-size:10px;text-align:right;">${wasSnapped ? '⚡' : '🎯'}${prof > 0 ? '+' : ''}${prof}¢</span>
                </div>`;
            }
            // Active rung — time-stage with countdown
            const aS = r.anchor_side || 'yes';
            const aP = r[`${aS}_price`] || 0;
            const hP = r.hedge_price || 0;
            const hFill = r.hedge_fill_qty || 0;
            const elapsed = Math.floor(nowSec - (r.anchor_fill_at || nowSec));
            const ts = r.time_stage || 'profit';
            const aCol = aS === 'yes' ? '#00ff88' : '#ff4444';
            const sm = { profit: { l:'PROFIT', c:'#00ff88', lim:15 }, scratch: { l:'SCRATCH', c:'#ffaa00', lim:30 }, panic: { l:'PANIC', c:'#ff4444', lim:60 } };
            const st = sm[ts] || sm.profit;
            const cdStr = ts === 'profit' ? `${Math.max(0,15-elapsed)}s` : ts === 'scratch' ? `${Math.max(0,30-elapsed)}s` : `${elapsed}s`;
            let hStr, hCol;
            if (hFill >= rQty && hP > 0) { hStr = `${hP}¢ FILLED`; hCol = '#00ff88'; }
            else if (hP > 0) { hStr = `${hP}¢ (${hFill}/${rQty})`; hCol = '#ffaa00'; }
            else { hStr = rs === 'anchor_filled' ? 'posting...' : 'pending'; hCol = '#555'; }
            const tPct = Math.min(100, (elapsed / st.lim) * 100);
            return `<div style="padding:4px 0;border-bottom:1px solid #1e274022;">
                <div style="display:flex;align-items:center;gap:6px;font-size:10px;">
                    <span style="color:#ffaa00;font-weight:700;width:28px;">${width}¢</span>
                    <span style="color:${aCol};font-weight:700;font-size:9px;">${aS.toUpperCase()} ${aP}¢</span>
                    <span style="background:${st.c}22;color:${st.c};font-size:8px;font-weight:800;padding:1px 6px;border-radius:3px;">${st.l}</span>
                    <span style="color:${st.c};font-family:monospace;font-weight:700;font-size:12px;">${cdStr}</span>
                    <span style="color:${hCol};font-size:9px;margin-left:auto;">hedge ${hStr}</span>
                </div>
                <div style="height:3px;background:#1a2540;border-radius:2px;overflow:hidden;margin-top:3px;">
                    <div style="width:${tPct}%;height:100%;background:${st.c}88;border-radius:2px;transition:width 1s;"></div>
                </div>
            </div>`;
        }).join('');
    } else if (isFilled && (isConsolidated || completedRungs > 0)) {
        // ── CONSOLIDATED VIEW: anchor summary + per-rung breakdown + hedge detail ──
        const hedgeLabel = hedgeSide === 'yes' ? 'YES' : 'NO';

        // Split rungs into filled (consolidated) and unfilled (show individually)
        const filledRungs = rungs.filter(r => (r[`${filledSideKey}_fill_qty`] || 0) > 0);
        const unfilledRungs = rungs.filter(r => (r[`${filledSideKey}_fill_qty`] || 0) === 0 && !r.completed && !r.cancelled);

        // Cleanup generation: split anchors into completed (hedged) vs cleanup (unhedged)
        const hasCleanup = hedgeHistory.length > 0 && hedgeQty > 0 && currentHedgePrice > 0;
        const historyHedgedQty = hedgeHistory.reduce((s, h) => s + (h.fill_qty || h.qty || 0), 0);
        const cleanupQty = hasCleanup ? Math.max(0, filledQty - historyHedgedQty) : 0;
        const completedQty = hasCleanup ? historyHedgedQty : 0;

        // Anchor summary block — split into COMPLETED + CLEANUP if cleanup generation active
        let anchorSummary;
        if (hasCleanup && completedQty > 0) {
            anchorSummary = `
                <div style="color:#556;font-size:8px;font-weight:700;letter-spacing:.08em;margin-bottom:4px;">── COMPLETED ──</div>
                <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#060a14;border:1px solid ${filledColor}22;border-radius:6px;margin-bottom:4px;opacity:0.35;">
                    <span style="color:${filledColor};font-weight:800;font-size:12px;">${filledSideLabel} ANCHOR</span>
                    <span style="color:${filledColor};font-size:11px;font-weight:700;">${completedQty} contracts · HEDGED</span>
                </div>
                ${cleanupQty > 0 ? `
                <div style="color:#ffaa00;font-size:8px;font-weight:700;letter-spacing:.08em;margin:8px 0 4px;">── CLEANUP ──</div>
                <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#060a14;border:1px solid ${filledColor}33;border-radius:6px;margin-bottom:6px;">
                    <span style="color:${filledColor};font-weight:800;font-size:12px;">${filledSideLabel} ANCHOR</span>
                    <span style="color:${filledColor};font-size:11px;font-weight:700;">${cleanupQty} contracts @ avg ${avgFilled}¢</span>
                    <span style="color:#ffaa00;font-size:8px;">cancel-race fills</span>
                </div>` : ''}`;
        } else {
            anchorSummary = `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#060a14;border:1px solid ${filledColor}33;border-radius:6px;margin-bottom:6px;">
                <span style="color:${filledColor};font-weight:800;font-size:12px;">${filledSideLabel} ANCHOR</span>
                <span style="color:${filledColor};font-size:11px;font-weight:700;">${filledQty} contracts @ avg ${avgFilled}¢</span>
                <span style="color:#555;font-size:9px;">bid ${filledBid}¢ · ask ${filledAsk}¢</span>
            </div>`;
        }

        // Unfilled anchors — show individually so user can see where limit orders sit
        const unfilledRows = unfilledRungs.map(r => {
            const anchorPrice = r[`${filledSideKey}_price`] || 0;
            return `<div style="display:flex;align-items:center;gap:6px;font-size:9px;padding:1px 0;opacity:0.4;">
                <span style="color:#ffaa00;font-weight:700;width:22px;">${r.width}¢</span>
                <span style="color:${filledColor};width:30px;">${filledSideLabel[0]}${anchorPrice}</span>
                <div style="flex:1;height:3px;background:#1a2540;border-radius:2px;overflow:hidden;">
                    <div style="width:0%;height:100%;background:#333;border-radius:2px;"></div>
                </div>
                <span style="color:#555;width:20px;text-align:right;">0/${r.quantity || qtyPer}</span>
                <span style="color:#335;font-size:8px;">LIVE</span>
            </div>`;
        }).join('');

        const rungRows = (unfilledRungs.length > 0)
            ? `<div style="padding:2px 8px;margin-top:4px;border-top:1px solid #1e274022;">
                <div style="color:#556;font-size:8px;font-weight:600;margin-bottom:2px;">PENDING ANCHORS (${unfilledRungs.length})</div>
                ${unfilledRows}
               </div>`
            : '';

        // Hedge detail block
        let hedgeBlock = '';
        const hedgeFill = bot[`filled_${hedgeSide}_qty`] || 0;
        const historyFills = hedgeHistory.reduce((s, h) => s + (h.fill_qty || 0), 0);
        const rawActiveHedgeFill = Math.max(0, hedgeFill - historyFills);
        const activeHedgeFill = Math.min(rawActiveHedgeFill, hedgeQty); // cap at hedge qty for display
        const overflowFills = Math.max(0, rawActiveHedgeFill - hedgeQty); // extra fills needing new hedge

        // Completed hedge history
        const historyHTML = hedgeHistory.map(h => {
            const hLabel = (h.side === 'yes' ? 'YES' : 'NO');
            const hColor = h.side === 'yes' ? '#00ff88' : '#ff4444';
            return `<div style="display:flex;align-items:center;gap:6px;font-size:9px;padding:2px 0;opacity:0.35;">
                <span style="color:${hColor};font-weight:700;">HEDGE</span>
                <span style="color:${hColor};">${hLabel} @${h.price}¢ × ${h.qty}</span>
                <span style="color:#00ff8888;font-size:8px;">DONE</span>
            </div>`;
        }).join('');

        // Active hedge
        if (currentHedgePrice > 0 && hedgeQty > 0) {
            const hedgeFilled = activeHedgeFill >= hedgeQty;
            const hedgeCol = hedgeFilled ? hedgeColorSide : activeHedgeFill > 0 ? '#ffaa00' : '#00aaff';
            const hedgePct = hedgeQty > 0 ? Math.round((activeHedgeFill / hedgeQty) * 100) : 0;
            const gapToBid = unfilledBid - currentHedgePrice;
            const gapToAsk = unfilledAsk - currentHedgePrice;
            const gapCol = gapToBid === 0 ? '#00ff88' : gapToBid <= 2 ? '#00ff88' : gapToBid <= 5 ? '#ffaa00' : gapToBid <= 10 ? '#ff8800' : '#ff4444';
            const gapStr = gapToBid > 0 ? `+${gapToBid}¢ to bid` : gapToBid === 0 ? '= bid' : '';
            // System state
            const maxHedge = bot._max_hedge || 0;
            const snapReady = bot._snap_ready || false;
            const spread = unfilledAsk > 0 ? unfilledAsk - unfilledBid : 0;
            // State label — 3 zones: snap (≤96), walk (97), ceiling (≥98)
            let stateLabel, stateColor;
            if (hedgeFilled) { stateLabel = 'FILLED'; stateColor = '#00ff88'; }
            else if (snapReady && currentHedgePrice >= unfilledBid) { stateLabel = 'AT BID — SNAP'; stateColor = '#00ff88'; }
            else if (snapReady) { stateLabel = 'SNAP → BID'; stateColor = '#00ff88'; }
            else if (combined >= _botCeiling) { stateLabel = 'CEILING — WAIT'; stateColor = '#ff4444'; }
            else { stateLabel = 'SNAPPING'; stateColor = '#00aaff'; }
            hedgeBlock = `<div style="margin-top:6px;padding:6px 8px;background:#060a14;border:1px solid ${hedgeColorSide}33;border-radius:6px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <span style="color:${hedgeColorSide};font-weight:800;font-size:12px;">${hedgeLabel} HEDGE</span>
                    <span style="color:${hedgeColorSide};font-size:11px;font-weight:700;">${hedgeQty}× @ ${currentHedgePrice}¢</span>
                    <span style="color:#555;font-size:9px;">bid ${unfilledBid}¢ · ask ${unfilledAsk}¢${spread > 1 ? ` · gap ${spread}¢` : ''}</span>
                    <span style="background:${stateColor}22;color:${stateColor};font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">${stateLabel}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                    <div style="flex:1;height:5px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${hedgePct}%;height:100%;background:${hedgeCol};border-radius:2px;transition:width 0.3s;"></div>
                    </div>
                    <span style="color:${hedgeCol};font-weight:700;font-size:10px;">${activeHedgeFill}/${hedgeQty}</span>
                </div>
                <div style="display:flex;gap:10px;font-size:9px;color:#555;flex-wrap:wrap;">
                    <span>ceiling: <strong style="color:${_botCeiling <= 96 ? '#00ff88' : _botCeiling <= 97 ? '#ffaa00' : '#ff4444'};">${_botCeiling}¢</strong></span>
                    <span>snap: <strong style="color:#00aaff;">bid</strong></span>
                    ${snapReady ? `<span style="color:#00ff88;">≤${bot._game_urgency === 'late' || bot._game_urgency === 'critical' ? '97' : '96'}¢ — snap</span>` : ''}
                    ${gapStr ? `<span style="color:${gapCol};">${gapStr}</span>` : ''}
                </div>
            </div>`;
        }

        // Overflow: extra anchor fills that arrived after hedge was placed (cancel race)
        const overflowBlock = overflowFills > 0 ? `<div style="margin-top:4px;padding:4px 8px;background:#ffaa0011;border:1px dashed #ffaa0044;border-radius:4px;font-size:10px;">
            <span style="color:#ffaa00;font-weight:700;">⚡ +${overflowFills} late fill${overflowFills > 1 ? 's' : ''}</span>
            <span style="color:#8892a6;"> — extra anchor${overflowFills > 1 ? 's' : ''} filled during cancel, awaiting new hedge</span>
        </div>` : '';

        rungsHTML = anchorSummary
            + rungRows
            + (historyHTML ? `<div style="padding:2px 8px;border-top:1px solid #1e274033;">${historyHTML}</div>` : '')
            + hedgeBlock
            + overflowBlock;
    } else if (isFilled) {
        // Filled but not yet consolidated — show per-rung with fills (hide cancelled rungs)
        const filledLabel = filledSideKey === 'yes' ? 'YES' : 'NO';
        rungsHTML = rungs.filter(r => {
            // Only show rungs that have fills on the anchor side
            return (r[`${filledSideKey}_fill_qty`] || 0) > 0;
        }).map((r, i) => {
            const fill = r[`${filledSideKey}_fill_qty`] || 0;
            const rQty = r.quantity || qtyPer;
            const filled = fill >= rQty;
            const col = filled ? filledColor : fill > 0 ? '#ffaa00' : '#333';
            const pct = rQty > 0 ? Math.round((fill / rQty) * 100) : 0;
            return `<div style="display:grid;grid-template-columns:30px 1fr;gap:6px;align-items:center;font-size:10px;padding:3px 0;">
                <span style="color:#ffaa00;font-weight:700;">${r.width}¢</span>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:${filledColor};font-size:9px;width:24px;">${filledLabel[0]}${r[`${filledSideKey}_price`]}</span>
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:${col};border-radius:2px;"></div>
                    </div>
                    <span style="color:${col};font-weight:700;font-size:9px;">${fill}/${rQty}</span>
                </div>
            </div>`;
        }).join('');
    } else {
        // Normal: show both sides per rung — dim completed ones
        rungsHTML = rungs.map((r, i) => {
            const yFill = r.yes_fill_qty || 0;
            const nFill = r.no_fill_qty || 0;
            const rQty = r.quantity || qtyPer;
            const yFilled = yFill >= rQty;
            const nFilled = nFill >= rQty;
            const isCompleted = r.completed;
            const dimStyle = isCompleted ? 'opacity:0.3;' : '';
            const yCol = yFilled ? '#00ff88' : yFill > 0 ? '#ffaa00' : '#333';
            const nCol = nFilled ? '#00ff88' : nFill > 0 ? '#ffaa00' : '#333';
            const yPct = rQty > 0 ? Math.round((yFill / rQty) * 100) : 0;
            const nPct = rQty > 0 ? Math.round((nFill / rQty) * 100) : 0;
            return `<div style="display:grid;grid-template-columns:30px 1fr 1fr;gap:6px;align-items:center;font-size:10px;padding:3px 0;${dimStyle}">
                <span style="color:#ffaa00;font-weight:700;">${r.width}¢</span>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:#00ff88;font-size:9px;width:24px;">Y${r.yes_price}</span>
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${yPct}%;height:100%;background:${yCol};border-radius:2px;"></div>
                    </div>
                    <span style="color:${yCol};font-weight:700;font-size:9px;">${yFill}/${rQty}</span>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="color:#ff4444;font-size:9px;width:24px;">N${r.no_price}</span>
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${nPct}%;height:100%;background:${nCol};border-radius:2px;"></div>
                    </div>
                    <span style="color:${nCol};font-weight:700;font-size:9px;">${nFill}/${rQty}</span>
                </div>
            </div>`;
        }).join('');
    }

    // Walk info — detailed status bar
    let walkInfo = '';
    if (status === 'awaiting_settlement') {
        walkInfo = `<div style="background:#00e5ff11;border:1px solid #00e5ff33;border-radius:5px;padding:6px 8px;font-size:10px;color:#00e5ff;margin-top:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-weight:700;">⏳ <strong>AWAITING SETTLEMENT</strong></span>
                <span style="color:#8892a6;">Market closed — waiting for Kalshi to settle</span>
            </div>
            <div style="color:#8892a6;font-size:9px;margin-top:3px;">
                Position held · P&L calculated on settlement result · anchor ${avgFilled}¢ × ${filledQty}
            </div>
        </div>`;
    } else if (status === 'apex_selling_back') {
        // ── SELL-BACK STATE — full exit visibility (must be before isFilled check) ──
        const sbPrice = bot._sellback_price || 0;
        const sbStarted = bot._sellback_started_at || 0;
        const sbElapsed = sbStarted > 0 ? Math.floor(nowSec - sbStarted) : 0;
        const sbWalks = bot._sellback_walk_count || 0;
        const sbUrgency = bot._game_urgency || 'normal';
        const sbTimeout = sbUrgency === 'critical' ? 30 : 300;
        const sbTimeLeft = Math.max(0, sbTimeout - sbElapsed);
        const sbPct = sbTimeout > 0 ? Math.min(100, (sbElapsed / sbTimeout) * 100) : 0;
        const sbTimerCol = sbTimeLeft <= 30 ? '#ff4444' : sbTimeLeft <= 60 ? '#ff8800' : '#ffaa00';
        const sbMinLeft = Math.floor(sbTimeLeft / 60);
        const sbSecLeft = Math.floor(sbTimeLeft % 60);
        const sbAnchorSide = bot.first_fill_side === 'yes' ? 'YES' : 'NO';
        const sbAvgAnchor = bot._sellback_avg_anchor || avgFilled || 0;
        const sbFillQty = bot._sellback_fill_qty || 0;
        const sbQty = bot._sellback_qty || bot.hedge_qty || 1;
        const sbFillPct = sbQty > 0 ? Math.round((sbFillQty / sbQty) * 100) : 0;
        const sbTimeoutNote = sbUrgency === 'critical' ? 'Emergency cross in'
            : sbTimeLeft <= 30 ? 'Taker cross in' : 'Timeout cross in';
        const sbBid = bot._sellback_bid || 0;
        const sbAsk = bot._sellback_ask || 0;
        const sbWalkTarget = bot._sellback_walk_target || sbBid;
        const sbAtBid = sbPrice > 0 && sbBid > 0 && sbPrice <= sbBid + 1;
        walkInfo = `<div style="background:#ff880011;border:1px solid #ff880033;border-radius:5px;padding:6px 8px;font-size:10px;color:#ff8800;margin-top:6px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                <span style="font-weight:700;">🔙 <strong>MAKER SELL-BACK</strong></span>
                ${urgencyBadge}
                ${sbAtBid ? '<span style="color:#00ff88;font-weight:700;font-size:9px;background:#00ff8818;padding:1px 4px;border-radius:3px;">AT BID</span>' : ''}
            </div>
            <div style="background:#0a0e1a;border-radius:4px;padding:4px 8px;margin-bottom:4px;">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">
                    <span style="color:#ff8800;font-weight:700;">${sbAnchorSide} sell @ ${sbPrice}¢ × ${sbQty}</span>
                    <span style="color:#8892a6;">bid ${sbBid}¢ · ask ${sbAsk}¢${sbWalkTarget > 0 ? ` · target ${sbWalkTarget}¢` : ''}</span>
                </div>
            </div>
            ${sbFillQty > 0 ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <div style="flex:1;height:6px;background:#1e2740;border-radius:3px;overflow:hidden;">
                    <div style="width:${sbFillPct}%;height:100%;background:#ff8800;border-radius:3px;transition:width 0.3s;"></div>
                </div>
                <span style="color:#ff8800;font-weight:700;font-size:10px;">${sbFillQty}/${sbQty} sold</span>
            </div>` : ''}
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="color:${sbTimerCol};font-weight:700;font-family:monospace;font-size:18px;">${sbMinLeft}:${String(sbSecLeft).padStart(2,'0')}</span>
                <div style="flex:1;height:4px;background:#1e2740;border-radius:2px;overflow:hidden;">
                    <div style="height:100%;width:${Math.round(sbPct)}%;background:${sbTimerCol};border-radius:2px;transition:width 1s;"></div>
            </div>
            <div style="color:#8892a6;font-size:9px;">
                anchor avg ${sbAvgAnchor}¢ · step #${sbWalks} · ${sbTimeoutNote} · taker cross if timeout
            </div>
        </div>`;
    } else if (isFilled) {
        const isHalftime = ((gameScores && gameKey && (gameScores[gameKey] || {}).status_detail) || '').toLowerCase().includes('half');
        const walkLabel = walkCount > 0 ? `walked +${walkCount}` : '';
        const ceilingStr = ceilingDist <= 3 ? `<span style="color:${ceilingDist <= 0 ? '#ff4444' : '#ff8800'};font-weight:700;">${ceilingDist}¢ to ceiling</span>` : '';

        if (isHalftime) {
            walkInfo = `<div style="background:#818cf822;border:1px solid #818cf833;border-radius:5px;padding:6px 8px;font-size:10px;color:#818cf8;margin-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>⏸ <strong>HALFTIME PAUSE</strong></span>
                    <span style="color:#8892a6;">anchor ${avgFilled}¢ + hedge ${currentHedgePrice}¢ = ${combined}¢ · ${unfilledSideLabel} bid ${unfilledBid}¢</span>
                </div>
            </div>`;
        } else if (atCeiling && currentHedgePrice > 0) {
            // ── AT CEILING — combined ≥ 98¢ (breakeven), waiting for fill or sell-back timer ──
            const bidGap = bot._bid_gap || 0;
            const bidGapWarn = bidGap >= 5 ? `<div style="background:#ff444422;border:1px solid #ff444444;border-radius:3px;padding:2px 6px;margin-top:3px;font-size:9px;color:#ff4444;font-weight:700;">⚠ bid ${bidGap}¢ from hedge — ${gameUrgency === 'critical' ? 'drift exit at 5¢' : gameUrgency === 'late' ? 'drift exit at 10¢' : 'watching'}</div>` : '';
            const sbTimeLeft = bot._sellback_time_left;
            const sbGrace = bot._sellback_grace_s || 0;
            const sbTimerHtml = (() => {
                if (sbGrace > 0 && sbGrace < 9999 && sbTimeLeft != null && sbTimeLeft > 0) {
                    const sbMin = Math.floor(sbTimeLeft / 60);
                    const sbSec = Math.floor(sbTimeLeft % 60);
                    const sbCol = sbTimeLeft <= 30 ? '#ff4444' : sbTimeLeft <= 60 ? '#ff8800' : '#818cf8';
                    return `<span style="color:${sbCol};font-size:9px;font-weight:700;background:${sbCol}18;padding:1px 5px;border-radius:3px;">⏱ sell-back in ${sbMin > 0 ? sbMin + 'm ' : ''}${sbSec}s</span>`;
                } else if (sbGrace >= 9999) {
                    return '<span style="color:#818cf8;font-size:9px;font-weight:600;background:#818cf818;padding:1px 5px;border-radius:3px;">⏸ sell-back paused</span>';
                } else if (sbTimeLeft != null && sbTimeLeft <= 0 && bot._apex_sellback_attempted) {
                    return '<span style="color:#ffaa00;font-size:9px;font-weight:700;background:#ffaa0018;padding:1px 5px;border-radius:3px;">⏱ completing cheaper — waiting for fill</span>';
                } else if (sbTimeLeft != null && sbTimeLeft <= 0) {
                    const decision = bot._sellback_decision;
                    const hp = bot.hedge_price || currentHedgePrice || '?';
                    if (decision === 'selling_back') {
                        const sbp = bot._sellback_price || '?';
                        return `<span style="color:#ff8800;font-size:9px;font-weight:700;background:#ff880018;padding:1px 5px;border-radius:3px;">🔙 SELLING BACK @ ${sbp}¢</span>`;
                    } else if (decision === 'crossing_to_bid') {
                        return `<span style="color:#ff4444;font-size:9px;font-weight:700;background:#ff444418;padding:1px 5px;border-radius:3px;">💀 CROSSING @ ${hp}¢ — waiting for fill</span>`;
                    }
                    return '<span style="color:#ff4444;font-size:9px;font-weight:700;background:#ff444418;padding:1px 5px;border-radius:3px;">⏱ sell-back evaluating...</span>';
                }
                return '';
            })();
            // Show live countdown in exit rule instead of static grace period
            const exitRule = (() => {
                if (gameUrgency === 'halftime') return 'Exit: paused until game resumes';
                if (sbTimeLeft != null && sbTimeLeft > 0) {
                    const m = Math.floor(sbTimeLeft / 60);
                    const s = Math.floor(sbTimeLeft % 60);
                    return `Exit: sell-back in ${m > 0 ? m + 'm ' : ''}${s}s`;
                }
                if (sbTimeLeft != null && sbTimeLeft <= 0) {
                    const d = bot._sellback_decision;
                    if (d === 'selling_back') return `Exit: selling back @ ${bot._sellback_price || '?'}¢`;
                    if (d === 'crossing_to_bid') return `Exit: crossing @ ${bot.hedge_price || '?'}¢ — waiting for fill`;
                    return 'Exit: sell-back timer expired — evaluating';
                }
                const grace = gameUrgency === 'critical' ? '10s' : gameUrgency === 'late' ? '60s' : '180s';
                return `Exit: sell-back · ${grace}`;
            })();
            walkInfo = `<div style="background:#ff444411;border:1px solid #ff444433;border-radius:5px;padding:6px 8px;font-size:10px;color:#ff4444;margin-top:6px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                    <span style="font-weight:700;">🔴 <strong>AT CEILING ${combined}¢</strong></span>
                    ${urgencyBadge}
                    ${sbTimerHtml}
                </div>
                <div style="background:#0a0e1a;border-radius:4px;padding:4px 8px;margin-bottom:3px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;">
                        <span style="color:#fff;">${unfilledSideLabel} hedge @ ${currentHedgePrice}¢</span>
                        <span style="color:#8892a6;">anchor ${avgFilled}¢ · bid ${unfilledBid}¢ · ask ${unfilledAsk}¢</span>
                    </div>
                </div>
                <div style="color:#8892a6;font-size:9px;">filled ${fillAgeStr} ago · step #${walkCount} · <span style="color:#ffaa00;">${exitRule}</span></div>
                ${bidGapWarn}
            </div>`;
        } else if (walkCount > 0 && currentHedgePrice > 0) {
            const atBid = currentHedgePrice >= unfilledBid;
            const walkStartPrice = bot.walk_start_price || currentHedgePrice;
            const prevPrice = walkCount > 1 ? currentHedgePrice - 1 : walkStartPrice;
            const nextPrice = atBid ? currentHedgePrice : currentHedgePrice + 1;
            const walkPct = Math.min(100, ((walkInterval - nextWalkIn) / walkInterval) * 100);
            const statusIcon = atCeiling ? '🔴' : atBid ? '🎯' : '📈';
            const statusText = atBid ? 'AT BID' : 'SNAPPING TO BID';
            const statusCol = atCeiling ? '#ff4444' : atBid ? '#00ff88' : '#00aaff';
            // Exit rules line
            const exitRule = gameUrgency === 'critical' ? 'Exit: cross to bid if >97¢ · 30s'
                : gameUrgency === 'late' ? 'Exit: sell-back if >97¢ · 5min timeout'
                : gameUrgency === 'halftime' ? 'Exit: paused until game resumes'
                : 'Exit: sell-back if >96¢ · 5min timeout';
            walkInfo = `<div style="background:${statusCol}11;border:1px solid ${statusCol}33;border-radius:5px;padding:6px 8px;font-size:10px;color:${statusCol};margin-top:6px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
                    <span style="font-weight:700;">${statusIcon} <strong>${statusText}</strong> — ${unfilledSideLabel} hedge</span>
                    <span style="color:#666;font-size:9px;">start ${walkStartPrice}¢</span>
                    <span style="color:#888;">prev ${prevPrice}¢ →</span>
                    <span style="color:#00ff88;font-weight:700;font-size:12px;">${currentHedgePrice}¢</span>
                    <span style="color:#888;">→ next ${nextPrice}¢</span>
                    <span style="position:relative;display:inline-block;width:20px;height:20px;flex-shrink:0;" title="Next walk in ${nextWalkIn}s">
                      <svg width="20" height="20" viewBox="0 0 20 20" style="transform:rotate(-90deg);">
                        <circle cx="10" cy="10" r="8" fill="none" stroke="#333" stroke-width="2"/>
                        <circle cx="10" cy="10" r="8" fill="none" stroke="${statusCol}" stroke-width="2"
                          stroke-dasharray="${2*Math.PI*8}" stroke-dashoffset="${2*Math.PI*8*(1-walkPct/100)}"
                          stroke-linecap="round"/>
                      </svg>
                      <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:7px;color:#aaa;">${nextWalkIn}</span>
                    </span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;color:#8892a6;font-size:9px;">
                    <span>anchor ${avgFilled}¢ + hedge ${currentHedgePrice}¢ = <strong style="color:${combined <= 96 ? '#00ff88' : combined <= 98 ? '#ffaa00' : '#ff4444'};">${combined}¢</strong> · step #${walkCount} · ${walkInterval}s interval · filled ${fillAgeStr} ago</span>
                    ${urgencyBadge} ${atCeiling ? `<span style="color:#ff4444;font-weight:700;">≥98¢ — maker at bid until fill</span>` : ceilingStr}
                    ${(() => {
                        const sbTimeLeft = bot._sellback_time_left;
                        const sbGrace = bot._sellback_grace_s || 0;
                        if (sbGrace > 0 && sbGrace < 9999 && sbTimeLeft != null && sbTimeLeft > 0) {
                            const sbMin = Math.floor(sbTimeLeft / 60);
                            const sbSec = Math.floor(sbTimeLeft % 60);
                            const sbCol = sbTimeLeft <= 30 ? '#ff4444' : sbTimeLeft <= 60 ? '#ff8800' : '#818cf8';
                            return `<span style="color:${sbCol};font-size:8px;font-weight:600;background:${sbCol}18;padding:1px 5px;border-radius:3px;">⏱ sell-back in ${sbMin > 0 ? sbMin + 'm ' : ''}${sbSec}s</span>`;
                        } else if (sbGrace >= 9999) {
                            return '<span style="color:#818cf8;font-size:8px;font-weight:600;background:#818cf818;padding:1px 5px;border-radius:3px;">⏸ sell-back paused</span>';
                        }
                        return '';
                    })()}
                    <span style="color:#ffaa00;font-size:8px;">${exitRule}</span>
                </div>
            </div>`;
        } else if (currentHedgePrice > 0 && currentHedgePrice >= unfilledBid) {
            walkInfo = `<div style="background:#00ff8811;border:1px solid #00ff8833;border-radius:5px;padding:6px 8px;font-size:10px;color:#00ff88;margin-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>🎯 <strong>${unfilledSideLabel} AT BID</strong> — @${currentHedgePrice}¢ × ${hedgeQty} — waiting for fill</span>
                    <span style="color:#8892a6;">${combined}¢ combined · ${fillAgeStr}</span>
                </div>
            </div>`;
        } else {
            walkInfo = `<div style="background:#ffaa0011;border:1px solid #ffaa0033;border-radius:5px;padding:6px 8px;font-size:10px;color:#ffaa00;margin-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>⏳ <strong>${filledSideLabel} FILLED</strong> (avg ${avgFilled}¢ × ${filledQty}) — posting ${unfilledSideLabel} hedge</span>
                    <span style="color:#8892a6;">${unfilledSideLabel} bid ${unfilledBid}¢ · ask ${unfilledAsk}¢ · next walk ${nextWalkIn}s</span>
                </div>
            </div>`;
        }
    } else if (status === 'ladder_arb_posted') {
        const yBid = bot.live_yes_bid != null ? bot.live_yes_bid : '?';
        const yAsk = bot.live_yes_ask != null ? bot.live_yes_ask : '?';
        const nBid = bot.live_no_bid != null ? bot.live_no_bid : '?';
        const nAsk = bot.live_no_ask != null ? bot.live_no_ask : '?';
        walkInfo = `<div style="background:#00aaff11;border:1px solid #00aaff33;border-radius:5px;padding:6px 8px;font-size:10px;color:#00aaff;margin-top:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                <span>⚡ All ${rungs.length} rungs live — YES+NO posted</span>
                <span style="color:#8892a6;">Y <strong style="color:#00ff88;">${yBid}/${yAsk}¢</strong> · N <strong style="color:#ff4444;">${nBid}/${nAsk}¢</strong></span>
            </div>
        </div>`;
    }

    // Repeat + ceiling info
    const repeatCount = bot.repeat_count || 0;
    const repeatsDone = bot.repeats_done || 0;
    let cycleInfo = '';
    if (repeatCount > 0) {
        const totalRuns = repeatCount + 1;
        const currentCycle = repeatsDone + 1;
        cycleInfo = `<span style="background:#6366f122;color:#818cf8;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">Run ${currentCycle}/${totalRuns}</span>`;
    }
    if (_botCeiling < 98) {
        cycleInfo += ` <span style="background:${_botCeiling <= 96 ? '#00ff8822' : '#ffaa0022'};color:${_botCeiling <= 96 ? '#00ff88' : '#ffaa00'};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">⬆ ${_botCeiling}¢</span>`;
    }

    const item = document.createElement('div');
    item.style.cssText = `background:#0f1419;border:1px solid ${borderCol}33;border-left:3px solid ${borderCol};border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;`;
    item.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('a')) showBotDetail(botId); };
    item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <svg width="22" height="22" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 4px #00aaff66);"><polygon points="12,2 22,20 2,20" fill="none" stroke="#00aaff" stroke-width="2" stroke-linejoin="round"/><polygon points="12,8 17,17 7,17" fill="#00aaff33" stroke="#00aaff" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.5" fill="#00aaff"/></svg>
                <span style="color:#00aaff;font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;">APEX</span>
                <span style="color:#fff;font-weight:700;font-size:14px;">${teamName}</span>
                <span style="background:${borderCol}22;color:${borderCol};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${statusLabel}</span>
                <span style="background:#ffaa0022;color:#ffaa00;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">🪜 ${rungs.length} RUNGS</span>
                ${cumulativePnl !== 0 ? `<span style="background:${cumulativePnl >= 0 ? '#00ff88' : '#ff4444'}22;color:${cumulativePnl >= 0 ? '#00ff88' : '#ff4444'};padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;">${cumulativePnl >= 0 ? '+' : ''}${cumulativePnl}¢</span>` : ''}
                ${liveScoreHtml}
                ${cycleInfo}
                ${(() => {
                    const gu = bot._game_urgency || '';
                    const wi = bot._walk_interval || 20;
                    if (gu === 'critical') return '<span style="background:#ff444433;color:#ff4444;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800;animation:pulse 1s infinite;">⚡ CRITICAL · 3s</span>';
                    if (gu === 'late') return `<span style="background:#ff880033;color:#ff8800;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">🔥 LATE · ${wi}s</span>`;
                    if (gu === 'halftime') return '<span style="background:#818cf833;color:#818cf8;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">⏸ HALF</span>';
                    if (isFilled) return `<span style="background:#33445522;color:#8892a6;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">● ${wi}s walk</span>`;
                    return '';
                })()}
                ${isFilled ? (() => {
                    const sbGrace = bot._sellback_grace_s || 0;
                    const sbLeft = bot._sellback_time_left != null ? bot._sellback_time_left : sbGrace;
                    if (sbGrace <= 0 || sbGrace >= 9999) return '';
                    const sbMin = Math.floor(sbLeft / 60);
                    const sbSec = Math.floor(sbLeft % 60);
                    const sbPct = sbGrace > 0 ? Math.round(((sbGrace - sbLeft) / sbGrace) * 100) : 0;
                    const sbCol = sbLeft <= 30 ? '#ff4444' : sbLeft <= 60 ? '#ff8800' : '#00aaff';
                    return `<span style="background:${sbCol}22;color:${sbCol};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:monospace;">⏱ ${sbMin}:${String(sbSec).padStart(2,'0')}</span>`;
                })() : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <button onclick="cancelBot('${botId}')" style="background:#ff444422;color:#ff4444;border:1px solid #ff444444;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">✕</button>
            </div>
        </div>
        <div style="background:#060a14;border:1px solid #1e274033;border-radius:8px;padding:10px;">
            ${isFilled && (isConsolidated || completedRungs > 0) ? '' : `
            <div style="display:grid;grid-template-columns:30px 1fr 1fr;gap:6px;font-size:9px;font-weight:800;color:#555;text-transform:uppercase;padding-bottom:4px;border-bottom:1px solid #1e2740;margin-bottom:4px;">
                <span>W</span>
                <span>YES ${bot.live_yes_bid != null ? `<span style="font-weight:400;color:#00ff8866;text-transform:none;">bid ${bot.live_yes_bid} · ask ${bot.live_yes_ask || '?'}</span>` : ''}</span>
                <span>NO ${bot.live_no_bid != null ? `<span style="font-weight:400;color:#ff444466;text-transform:none;">bid ${bot.live_no_bid} · ask ${bot.live_no_ask || '?'}</span>` : ''}</span>
            </div>`}
            ${rungsHTML}
        </div>
        ${avgYes > 0 || avgNo > 0 ? `
        <div style="display:flex;gap:16px;margin-top:8px;padding:6px 10px;background:#060a14;border-radius:6px;font-size:11px;flex-wrap:wrap;">
            ${avgYes > 0 ? `<span style="color:#00ff88;">Avg YES: <strong>${hedgePriceForPnl > 0 && status === 'ladder_arb_no_filled' ? hedgePriceForPnl : avgYes}¢</strong> (${totalYesFill}/${totalExpected})</span>` : ''}
            ${avgNo > 0 ? `<span style="color:#ff4444;">Avg NO: <strong>${hedgePriceForPnl > 0 && status === 'ladder_arb_yes_filled' ? hedgePriceForPnl : avgNo}¢</strong> (${totalNoFill}/${totalExpected})</span>` : ''}
            ${combinedAvg > 0 ? `<span style="color:${pnlColor};font-weight:700;">P&L: ${effectiveProfit > 0 ? '+' : ''}${effectiveProfit}¢/ea</span>` : ''}
            ${cumulativePnl !== 0 ? `<span style="color:${cumulativePnl >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">Total: ${cumulativePnl >= 0 ? '+' : ''}${cumulativePnl}¢</span>` : ''}
            ${(() => { const hedged = !!bot.fav_order_id || bot._consolidated || (bot.dog_fill_qty || 0) > 0; const lat = hedged ? bot.hedge_latency_ms : null; const raw = hedged ? bot.raw_hedge_ms : null; return (lat != null ? `<span style="color:${lat < 300 ? '#00ff88' : lat < 800 ? '#ffaa00' : '#ff4444'};font-weight:700;">⚡ ${Math.round(lat)}ms</span>` : '') + (raw != null && raw > 0 ? `<span style="color:${raw < 5 ? '#00ffcc' : raw < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;"> ⚡raw ${raw.toFixed(1)}ms</span>` : ''); })()}
        </div>` : ''}
        ${walkInfo}
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid #1e2740;font-size:10px;">
            <span style="color:#ffaa00;">Widths: ${rungs.map(r => r.width + '¢').join(', ')}</span>
            <span style="color:#8892a6;">×${qtyPer} each</span>
            <span style="color:#555;">${phase === 'live' ? '🔴 LIVE' : '⏳ PRE'}</span>
            ${bot.repost_count ? `<span style="color:#555;">Repost #${bot.repost_count}</span>` : ''}
        </div>
        <div style="text-align:right;font-size:9px;color:#444;margin-top:4px;">${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${ageMin}m</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="color:#2a3550;font-size:8px;font-family:monospace;">${botId.slice(-12)}</span>
            <button onclick="event.stopPropagation();navigator.clipboard.writeText('${botId}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:8px;padding:0;color:#2a3550;" title="Copy bot ID">📋</button>
        </div>
    `;
    container.appendChild(item);
}


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

    // Live bid/ask from WS enrichment
    const liveNoABid = bot.live_no_a_bid || 0;
    const liveNoAAsk = bot.live_no_a_ask || 0;
    const liveNoBBid = bot.live_no_b_bid || 0;
    const liveNoBAsk = bot.live_no_b_ask || 0;

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
            // Kalshi ticker format: SERIES-{DATE}{TIME}{AWAY}{HOME}-{TEAMCODE}{SPREAD}
            // e.g. KXMLBSPREAD-26APR031610TBMIN-TB2 → date=26APR03, time=1610, away=TB, home=MIN
            let legAInRangeDir = null, legBInRangeDir = null;
            let _awayCode = '', _homeCode = '';
            const tParts = (bot.ticker_a || '').split('-');
            if (tParts.length >= 3) {
                const tACode = (tParts[2].match(/^([A-Z]+)/) || [])[1] || '';
                const tGameSeg = tParts[1].replace(/^\d{2}[A-Z]{3}\d+/, ''); // strip date+time digits, e.g. "26APR031610" → "TBMIN"
                if (tACode && tGameSeg.includes(tACode)) {
                    const teamAIsAway = tGameSeg.startsWith(tACode);
                    _awayCode = teamAIsAway ? (bot.team_a_name||'Away') : (bot.team_b_name||'Away');
                    _homeCode = teamAIsAway ? (bot.team_b_name||'Home') : (bot.team_a_name||'Home');
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
                : legAInRange ? `✅ ${bot.team_a_name||'A'} NO winning`
                : legBInRange ? `✅ ${bot.team_b_name||'B'} NO winning`
                : '⛔ both losing';
            const detail = gs.status_detail || '';
            const scoreTeams = _awayCode ? `${_awayCode} ` : '';
            const scoreTeamsR = _homeCode ? ` ${_homeCode}` : '';
            liveScoreHtml = `<span style="background:#ffffff0a;border-radius:4px;padding:2px 7px;font-size:10px;color:${scoreColor};font-weight:700;">${scoreTeams}${aw}–${h}${scoreTeamsR}${detail ? ' · ' + detail : ''} · ${rangeLabel}</span>`;
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
            <span style="color:#8892a6;margin-left:10px;">NO: ${legAFill||'?'} + NO: ${legBFill||'?'} = ${(parseInt(legAFill)||0)+(parseInt(legBFill)||0)}¢/ct</span>
            ${rangeHtml}
        </div>`;
    }

    // ── Rebalancer status indicator ──
    const rebalOn = bot.rebalancer_enabled !== false && bot.rebalancer_mode !== 'off';
    const rebalExitReason = bot.rebalancer_exit_reason;
    let rebalHtml = '';
    if (rebalExitReason) {
        // Rebalancer already acted
        const reasonMap = { scrape: '🔄 SCRAPED', enhance: '💰 ENHANCED', ride: '🏇 RIDING TO SETTLE' };
        const reasonCol = { scrape: '#ff4444', enhance: '#00ff88', ride: '#00aaff' };
        rebalHtml = `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:${(reasonCol[rebalExitReason]||'#aa66ff')}11;border:1px solid ${(reasonCol[rebalExitReason]||'#aa66ff')}33;border-radius:5px;font-size:10px;margin-top:4px;">
            <span style="color:${reasonCol[rebalExitReason]||'#aa66ff'};font-weight:700;">${reasonMap[rebalExitReason]||rebalExitReason}</span>
            <span style="color:#8892a6;">Rebalancer took action</span>
        </div>`;
    } else if (status === 'one_filled' || status === 'both_filled') {
        // Show rebalancer plan
        const loserBidA = liveNoABid, loserBidB = liveNoBBid;
        const minBid = Math.min(loserBidA || 99, loserBidB || 99);
        const maxBid = Math.max(loserBidA || 0, loserBidB || 0);
        const protectFloor = bot.rebalancer_protect_floor || 80;
        const scrapeCeil = bot.rebalancer_scrape_ceil || 10;
        let planLabel = '', planColor = '#555';
        if (!rebalOn) {
            planLabel = 'OFF';
            planColor = '#555';
        } else if (minBid >= protectFloor) {
            planLabel = 'HOLDING — both legs healthy';
            planColor = '#00ff88';
        } else if (minBid < scrapeCeil && hasLiveScore) {
            planLabel = status === 'both_filled' ? 'WILL ENHANCE — sell dead leg late game' : 'WILL SCRAPE — sell dead leg late game';
            planColor = '#ffaa00';
        } else if (maxBid >= 70 && minBid < 30 && hasLiveScore) {
            planLabel = status === 'one_filled' ? 'WILL RIDE winner to settlement' : 'WATCHING — may sell loser late game';
            planColor = '#00aaff';
        } else {
            planLabel = 'WATCHING — acts late game only';
            planColor = '#8892a6';
        }
        rebalHtml = `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:#aa66ff08;border:1px solid #aa66ff22;border-radius:5px;font-size:10px;margin-top:4px;">
            <span style="color:#aa66ff;font-weight:700;font-size:9px;letter-spacing:.05em;">REBALANCER</span>
            <span style="color:${rebalOn ? '#aa66ff' : '#555'};font-weight:600;">${rebalOn ? 'AUTO' : 'OFF'}</span>
            ${rebalOn ? `<span style="color:#333;">·</span><span style="color:${planColor};">${planLabel}</span>` : ''}
        </div>`;
    }

    const el = document.createElement('div');
    el.className = 'bot-item';
    el.style.cssText = `flex-direction:column;gap:8px;border-left:3px solid ${borderCol};cursor:pointer;`;
    el.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('a')) showBotDetail(botId); };
    el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="color:#aa66ff;font-size:11px;font-weight:700;">◈ MERIDIAN</span>
                <span style="color:#fff;font-weight:700;font-size:13px;">${bot.team_a_name||'A'} vs ${bot.team_b_name||'B'}</span>
                <span style="background:${borderCol}22;color:${borderCol};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${statusLabel}</span>
                ${liveScoreHtml}
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="cancelBot('${botId}')">✕</button>
            </div>
        </div>
        ${(() => {
            // Swap legs to match scoreboard order: away team on left, home team on right
            // Ticker game segment: MINBOS → first code = away (MIN), second = home (BOS)
            // Leg A shows team_b getting points (left), Leg B shows team_a getting points (right)
            // If team_a is the away team, we need to swap so team_a's card (Leg B) is on the LEFT
            const _tParts = (bot.ticker_a || '').split('-');
            const _gameSeg = _tParts.length >= 2 ? _tParts[1].replace(/^\d{2}[A-Z]{3}\d+/, '') : '';
            const _tACode = _tParts.length >= 3 ? (_tParts[2].match(/^([A-Z]+)/) || [])[1] || '' : '';
            const _teamAIsAway = _gameSeg && _tACode && _gameSeg.startsWith(_tACode);
            // If team_a is away, swap: show Leg B (team_a getting pts) on left, Leg A on right
            const swapped = _teamAIsAway;
            // Build leg data arrays for clean rendering
            const L = swapped ? {
                inRange: legBInRange, filled: bot.leg_b_filled, teamPts: bot.team_a_name||'Opp',
                spread: bot.spread_b||'?', teamNo: bot.team_b_name||'?', ticker: bot.ticker_b||'?',
                target: targetB||'?', bid: liveNoBBid, ask: liveNoBAsk,
                fillQty: legBFillQty, fillPrice: legBFill
            } : {
                inRange: legAInRange, filled: bot.leg_a_filled, teamPts: bot.team_b_name||'Opp',
                spread: bot.spread_a||'?', teamNo: bot.team_a_name||'?', ticker: bot.ticker_a||'?',
                target: targetA||'?', bid: liveNoABid, ask: liveNoAAsk,
                fillQty: legAFillQty, fillPrice: legAFill
            };
            const R = swapped ? {
                inRange: legAInRange, filled: bot.leg_a_filled, teamPts: bot.team_b_name||'Opp',
                spread: bot.spread_a||'?', teamNo: bot.team_a_name||'?', ticker: bot.ticker_a||'?',
                target: targetA||'?', bid: liveNoABid, ask: liveNoAAsk,
                fillQty: legAFillQty, fillPrice: legAFill
            } : {
                inRange: legBInRange, filled: bot.leg_b_filled, teamPts: bot.team_a_name||'Opp',
                spread: bot.spread_b||'?', teamNo: bot.team_b_name||'?', ticker: bot.ticker_b||'?',
                target: targetB||'?', bid: liveNoBBid, ask: liveNoBAsk,
                fillQty: legBFillQty, fillPrice: legBFill
            };
            function renderLeg(d) {
                const winLabel = hasLiveScore ? (d.inRange ? ' ✓ WINNING' : ' ✗ NOT YET') : '';
                const winGlow = hasLiveScore && d.inRange ? 'border:2px solid #00ff8888;box-shadow:0 0 12px #00ff8833;' : '';
                return `<div style="${legStyle(d.inRange, d.filled)}${winGlow}">
                    <div style="color:#aa66ff;font-size:9px;font-weight:700;margin-bottom:4px;">NO${winLabel}</div>
                    <div style="color:#fff;font-size:11px;font-weight:600;">${d.teamPts} +${d.spread}</div>
                    <div style="color:#555;font-size:9px;margin-bottom:4px;">NO: ${d.teamNo} wins by ${d.spread} · ${d.ticker}</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:4px;">
                        <span style="color:#8892a6;">Limit: <strong style="color:#aa66ff;">${d.target}¢</strong></span>
                        ${d.bid ? `<span style="color:#555;font-size:10px;">Bid <strong style="color:#fff;">${d.bid}¢</strong> · Ask <strong style="color:#fff;">${d.ask}¢</strong></span>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="flex:1;height:6px;background:#1a2540;border-radius:3px;overflow:hidden;">
                            <div style="width:${qty > 0 ? Math.round((d.fillQty / qty) * 100) : 0}%;height:100%;background:${d.filled?'#00ff88':(d.fillQty>0?'#ffaa00':'#333')};border-radius:3px;"></div>
                        </div>
                        <span style="color:${d.filled?'#00ff88':(d.fillQty>0?'#ffaa00':'#8892a6')};font-weight:700;font-size:10px;">${d.fillQty}/${qty}${d.filled?' ✓':''}</span>
                    </div>
                </div>`;
            }
            return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${renderLeg(L)}${renderLeg(R)}</div>`;
        })()}
        <div style="display:flex;gap:16px;font-size:10px;color:#555;padding-top:4px;border-top:1px solid #1e2740;flex-wrap:wrap;">
            ${targetA && targetB ? (() => {
                const arbWidth = 100 - targetA - targetB;
                const arbLabel = arbWidth <= 0 ? 'Straight Middle' : arbWidth + '¢ arb';
                const arbColor = arbWidth <= 0 ? '#ffaa00' : '#00ff88';
                return `<span style="color:${arbColor};font-weight:700;">${arbLabel}</span>
                <span>Floor: <strong style="color:${floor>=0?'#00ff88':'#ff4444'};">${floor>=0?'+':''}${floor}¢</strong></span>
                <span>Middle: <strong style="color:#aa66ff;">+${midP}¢</strong></span>
                <span style="color:#8892a6;">Cost/ct: <strong style="color:#fff;">${targetA + targetB}¢</strong></span>
                <span style="color:#8892a6;">Total: <strong style="color:#fff;">${cost}¢</strong></span>`;
            })() : '<span style="color:#555;font-style:italic;">price data unavailable</span>'}
            <span>×${qty}</span>
            ${floorPrice > 0 ? `<span style="color:#ff6666;">Stop-loss: ${floorPrice}¢ drop</span>` : ''}
        </div>
        ${legStatusHtml}
        ${rebalHtml}
        <div style="text-align:right;font-size:9px;color:#444;margin-top:4px;">${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${ageMin}m</div>
    `;
    container.appendChild(el);
}

function _renderWatchBotCard(bot, botId, container, gameScores) {
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
    const ticker = bot.ticker || '';
    const parts = ticker.split('-');
    const gameKey = parts.length >= 2 ? parts[1] : parts[0];
    const watchScoreBadge = buildScoreBadgeHtml(gameScores[gameKey] || {}, 'compact');

    const curBidNum = typeof liveBid === 'number' ? liveBid : 0;
    const unrealizedPnl = orderFilled && curBidNum > 0 ? (curBidNum - entry) * watchQty : 0;
    const unrealColor = unrealizedPnl >= 0 ? '#00ff88' : '#ff4444';

    let fillStatusHtml = '';
    if (!orderFilled) {
        fillStatusHtml = fillQty > 0
            ? `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">FILLING ${fillQty}/${watchQty}</span>`
            : `<span style="background:#ffaa0022;color:#ffaa00;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">PENDING</span>`;
    }

    const item = document.createElement('div');
    item.className = 'bot-item';
    item.style.cssText = 'flex-direction:column;gap:8px;border-left:3px solid #00ff88;cursor:pointer;';
    item.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('a')) showBotDetail(botId); };
    item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="color:#00ff88;font-size:11px;font-weight:700;">💰 BET</span>
                <a href="#" onclick="navigateToMarket('${ticker.toUpperCase().split('-').slice(0,2).join('-')}');return false;" style="color:#fff;font-weight:700;font-size:13px;text-decoration:none;" title="View in Markets tab">${watchDisplayName}</a>
                ${watchScoreBadge}
                <span class="bot-status watching">${orderFilled ? 'WATCHING' : 'PENDING'}</span>
                <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${side==='yes'?'#00ff8822':'#ff444422'};color:${side==='yes'?'#00ff88':'#ff4444'};">${side.toUpperCase()}</span>
                ${fillStatusHtml}
                <span style="color:#555;font-size:10px;">${ageMin >= 60 ? Math.floor(ageMin/60)+'h '+ageMin%60+'m' : ageMin+'m'} ago</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                ${orderFilled && unrealizedPnl !== 0 ? `<span style="color:${unrealColor};font-size:11px;font-weight:700;">${unrealizedPnl > 0 ? '+' : ''}${unrealizedPnl}¢</span>` : ''}
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;" onclick="cancelBot('${botId}')">✕</button>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;font-size:11px;color:#8892a6;">
            <div>Entry: <strong style="color:#fff;">${entry}¢</strong></div>
            <div>Qty: <strong style="color:#fff;">×${watchQty}</strong></div>
            <div>Live bid: <strong style="color:${typeof liveBid === 'number' && liveBid < entry - sl ? '#ff4444' : '#00ff88'};">${liveBid}¢</strong></div>
            <div>SL: <strong style="color:#ff6666;">${entry - sl}¢</strong>${tp > 0 ? ` · TP: <strong style="color:#00ff88;">${entry + tp}¢</strong>` : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
            <div style="flex:1;height:6px;background:#1a2540;border-radius:3px;overflow:hidden;">
                <div style="width:${watchQty > 0 ? Math.round((fillQty / watchQty) * 100) : 0}%;height:100%;background:${orderFilled?'#00ff88':(fillQty>0?'#ffaa00':'#333')};border-radius:3px;transition:width 0.3s;"></div>
            </div>
            <span style="color:${orderFilled?'#00ff88':(fillQty>0?'#ffaa00':'#8892a6')};font-weight:700;font-size:10px;">${fillQty}/${watchQty}${orderFilled?' ✓':''}</span>
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
            <span>${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${ageMin}m</span>
        </div>
    `;
    container.appendChild(item);
}

function setBotsTab(mode) {
    botsTabMode = mode;
    const arbBtn    = document.getElementById('bots-tab-arb');
    const midBtn    = document.getElementById('bots-tab-middle');
    const dogBtn    = document.getElementById('bots-tab-dog');
    const betsBtn   = document.getElementById('bots-tab-bets');
    const arbList   = document.getElementById('bots-list');
    const midList   = document.getElementById('middle-bots-list');
    const dogList   = document.getElementById('dog-bots-list');
    const betsList  = document.getElementById('bets-bots-list');
    const arbDaily  = document.getElementById('bots-arb-daily');
    const midDaily  = document.getElementById('bots-middle-daily');
    const dogDaily  = document.getElementById('bots-dog-daily');
    const betsDaily = document.getElementById('bots-bets-daily');
    if (arbBtn)  { arbBtn.style.background  = mode === 'arb'    ? '#253555' : '#1a2540'; arbBtn.style.color  = mode === 'arb'    ? '#00ff88' : '#8892a6'; }
    if (midBtn)  { midBtn.style.background  = mode === 'middle' ? '#253555' : '#1a2540'; midBtn.style.color  = mode === 'middle' ? '#aa66ff' : '#8892a6'; }
    if (dogBtn)  { dogBtn.style.background  = mode === 'dog'    ? '#253555' : '#1a2540'; dogBtn.style.color  = mode === 'dog'    ? '#ffaa00' : '#8892a6'; }
    if (betsBtn) { betsBtn.style.background = mode === 'bets'   ? '#253555' : '#1a2540'; betsBtn.style.color = mode === 'bets'   ? '#9966ff' : '#8892a6'; }
    if (arbList)   arbList.style.display   = mode === 'arb'    ? '' : 'none';
    if (midList)   midList.style.display   = mode === 'middle' ? '' : 'none';
    if (dogList)   dogList.style.display   = mode === 'dog'    ? '' : 'none';
    const _awaitDiv = document.getElementById('awaiting-settlement-list');
    if (_awaitDiv) _awaitDiv.style.display = mode === 'dog' ? '' : 'none';
    if (betsList)  betsList.style.display  = mode === 'bets'   ? '' : 'none';
    if (arbDaily)  arbDaily.style.display  = mode === 'arb'    ? 'flex' : 'none';
    if (midDaily)  midDaily.style.display  = mode === 'middle' ? 'flex' : 'none';
    if (dogDaily)  dogDaily.style.display  = mode === 'dog'    ? 'flex' : 'none';
    if (betsDaily) betsDaily.style.display = mode === 'bets'   ? 'flex' : 'none';
    // Re-render the main P&L header for the active tab
    _renderPnlDisplay(mode);
    // Switch buddy outfit to match active tab
    setBuddyOutfit(mode);
}

function _renderPnlDisplay(mode) {
    const pnl = window._lastPnlData;
    const el  = document.getElementById('pnl-display');
    if (!el) return;
    if (!pnl) return;  // not loaded yet

    if (mode === 'dog') {
        const net   = (pnl.dog_net_cents || 0) / 100;
        const color = net >= 0 ? '#ffaa00' : '#ff4444';
        const wins  = pnl.dog_wins   || 0;
        const losses = pnl.dog_losses || 0;
        const gross = ((pnl.dog_profit_cents || 0) / 100).toFixed(2);
        const loss  = ((pnl.dog_loss_cents   || 0) / 100).toFixed(2);
        const dayLabel = pnl.day_key || _localDateStr();
        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Phantom Bots Today <span style="color:#444;font-size:9px;">${dayLabel}</span></span>
            <span style="color:${color};font-weight:800;font-size:1.2rem;text-shadow:0 0 12px ${color}44;">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
            <span style="font-size:11px;">
                <span style="color:#ffaa00;">↑ $${gross}</span>
                <span style="color:#555;margin:0 3px;">·</span>
                <span style="color:#ff5555;">↓ $${loss}</span>
                <span style="color:#555;margin:0 6px;">|</span>
                <span style="color:#ffaa00;font-weight:700;">${wins}W</span><span style="color:#444;"> / </span><span style="color:#ff5555;font-weight:700;">${losses}L</span>
            </span>
        `;
    } else if (mode === 'bets') {
        const net   = (pnl.bet_net_cents || 0) / 100;
        const color = net >= 0 ? '#9966ff' : '#ff4444';
        const gross = ((pnl.bet_profit_cents || 0) / 100).toFixed(2);
        const loss  = ((pnl.bet_loss_cents   || 0) / 100).toFixed(2);
        const wins  = pnl.bet_wins   || 0;
        const losses = pnl.bet_losses || 0;
        const dayLabel = pnl.day_key || _localDateStr();
        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Bets Today <span style="color:#444;font-size:9px;">${dayLabel}</span></span>
            <span style="color:${color};font-weight:800;font-size:1.2rem;text-shadow:0 0 12px ${color}44;">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
            <span style="font-size:11px;">
                <span style="color:#9966ff;">↑ $${gross}</span>
                <span style="color:#555;margin:0 3px;">·</span>
                <span style="color:#ff5555;">↓ $${loss}</span>
                <span style="color:#555;margin:0 6px;">|</span>
                <span style="color:#9966ff;font-weight:700;">${wins}W</span><span style="color:#444;"> / </span><span style="color:#ff5555;font-weight:700;">${losses}L</span>
            </span>
        `;
    } else if (mode === 'middle') {
        const net   = (pnl.mid_net_cents || 0) / 100;
        const unrealized = (pnl.mid_unrealized_cents || 0) / 100;
        const unrealizedCount = pnl.mid_unrealized_count || 0;
        const color = net >= 0 ? '#aa66ff' : '#ff4444';
        const wins  = pnl.mid_wins   || 0;
        const losses = pnl.mid_losses || 0;
        const gross = ((pnl.mid_profit_cents || 0) / 100).toFixed(2);
        const loss  = ((pnl.mid_loss_cents   || 0) / 100).toFixed(2);
        const dayLabel = pnl.day_key || _localDateStr();
        const unrealizedBadge = unrealizedCount > 0 ? `<span style="color:#00aaff;font-size:10px;font-weight:600;">+ $${unrealized.toFixed(2)} locked (${unrealizedCount} settling)</span>` : '';
        const atRisk = (pnl.mid_at_risk_cents || 0) / 100;
        const atRiskCount = pnl.mid_at_risk_count || 0;
        const atRiskBadge = atRiskCount > 0 ? `<span style="color:#ffaa00;font-size:10px;font-weight:600;">$${atRisk.toFixed(2)} at risk (${atRiskCount} open)</span>` : '';
        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Meridian Today <span style="color:#444;font-size:9px;">${dayLabel}</span></span>
            <span style="color:${color};font-weight:800;font-size:1.2rem;text-shadow:0 0 12px ${color}44;">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
            <span style="font-size:11px;">
                <span style="color:#aa66ff;">↑ $${gross}</span>
                <span style="color:#555;margin:0 3px;">·</span>
                <span style="color:#ff5555;">↓ $${loss}</span>
                <span style="color:#555;margin:0 6px;">|</span>
                <span style="color:#aa66ff;font-weight:700;">${wins}W</span><span style="color:#444;"> / </span><span style="color:#ff5555;font-weight:700;">${losses}L</span>
                ${unrealizedBadge ? `<span style="color:#555;margin:0 6px;">|</span>${unrealizedBadge}` : ''}
                ${atRiskBadge ? `<span style="color:#555;margin:0 6px;">|</span>${atRiskBadge}` : ''}
            </span>
        `;
    } else {
        const net      = (pnl.arb_net_cents || 0) / 100;
        const netColor = net >= 0 ? '#00ff88' : '#ff4444';
        const gross    = ((pnl.arb_profit_cents || 0) / 100).toFixed(2);
        const loss     = ((pnl.arb_loss_cents   || 0) / 100).toFixed(2);
        const wins     = pnl.arb_wins   || 0;
        const losses   = pnl.arb_losses || 0;
        const dayLabel = pnl.day_key || _localDateStr();
        el.innerHTML = `
            <span style="color:#8892a6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Apex Today <span style="color:#444;font-size:9px;">${dayLabel}</span></span>
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
    // Don't re-render while smart exit menu is open — it destroys the menu
    if (window._smartExitMenuOpen) return;
    try {
        const response = await fetch(`${API_BASE}/bot/list`);
        const data = await response.json();
        const bots = data.bots || {};
        window._lastBotsData = bots;  // used by emergencyExitGame

        const now = Date.now();
        const gameScores = data.game_scores || {};
        const botIds = Object.keys(bots);

        const section = document.getElementById('bots-section');
        section.style.display = 'block';

        const botsList   = document.getElementById('bots-list');
        const middleList = document.getElementById('middle-bots-list');
        const dogList    = document.getElementById('dog-bots-list');

        const awaitingBotIds = botIds.filter(id => bots[id].status === 'awaiting_settlement');
        const activeBots = botIds.filter(id => {
            const s = bots[id].status;
            // Active/in-progress statuses always show
            if (s !== 'completed' && s !== 'stopped' && s !== 'cancelled') return true;
            // Awaiting settlement always shows
            if (s === 'awaiting_settlement') return true;
            // Cross-market bots with positions show until Kalshi settles
            if (bots[id].hedge_ticker && bots[id].hedge_ticker !== bots[id].ticker
                && (bots[id]._cross_settled_qty > 0 || bots[id]._cross_settled_qty_dog > 0)) return true;
            // Smart Apex: keep for restart button
            if (bots[id].smart_mode && bots[id].bot_category === 'ladder_arb') return true;
            // Completed: show for 5min so user can review and restart
            const fin = bots[id].completed_at || bots[id].stopped_at;
            if (!fin) return false;  // no timestamp + completed = old bot, hide
            return (now - fin * 1000) < 300000;
        });
        const dogBotIds    = activeBots.filter(id => ['anchor_dog','anchor_ladder'].includes(bots[id].bot_category));
        const betsBotIds   = activeBots.filter(id => bots[id].type === 'watch');
        const arbBotIds    = activeBots.filter(id => bots[id].type !== 'middle' && bots[id].type !== 'watch' && !['anchor_dog','anchor_ladder'].includes(bots[id].bot_category));
        const middleBotIds = activeBots.filter(id => bots[id].type === 'middle');

        // Update tab badges with global pixel art icons
        const _tabImg = (type) => botIconImg(type, 14);
        const midBtn = document.getElementById('bots-tab-middle');
        if (midBtn) midBtn.innerHTML = `${_tabImg('meridian')} MERIDIAN${middleBotIds.length > 0 ? ' (' + middleBotIds.length + ')' : ''}`;
        const dogBtn = document.getElementById('bots-tab-dog');
        if (dogBtn) dogBtn.innerHTML = `${_tabImg('phantom')} PHANTOM${dogBotIds.length > 0 ? ' (' + dogBotIds.length + ')' : ''}`;
        const betsBtn = document.getElementById('bots-tab-bets');
        if (betsBtn) betsBtn.innerHTML = `${_tabImg('scout')} SCOUT${betsBotIds.length > 0 ? ' (' + betsBotIds.length + ')' : ''}`;
        const arbBtn = document.getElementById('bots-tab-arb');
        if (arbBtn) arbBtn.innerHTML = `${_tabImg('apex')} APEX${arbBotIds.length > 0 ? ' (' + arbBotIds.length + ')' : ''}`;

        // Render bets (watch bots) list — grouped by game
        const betsList = document.getElementById('bets-bots-list');
        if (betsList) {
            if (betsBotIds.length === 0) {
                betsList.innerHTML = '<div class="empty-state"><div class="icon">💰</div><div class="title">No active straight bets</div><div class="desc">Place a straight bet from the Markets tab</div></div>';
            } else {
                betsList.innerHTML = '';
                const betGameGroups = {};
                betsBotIds.forEach(botId => {
                    const bot = bots[botId];
                    const t = bot.ticker || '';
                    const parts = t.split('-');
                    const gk = parts.length >= 2 ? parts[1] : parts[0];
                    if (!betGameGroups[gk]) betGameGroups[gk] = [];
                    betGameGroups[gk].push(botId);
                });
                Object.values(betGameGroups).forEach(ids => ids.sort((a, b) => (bots[b].created_at || 0) - (bots[a].created_at || 0)));
                const sortedBetKeys = Object.keys(betGameGroups).sort((a, b) => {
                    const fa = Math.min(...betGameGroups[a].map(id => bots[id].created_at || 0));
                    const fb = Math.min(...betGameGroups[b].map(id => bots[id].created_at || 0));
                    return fb - fa;
                });
                sortedBetKeys.forEach(gk => {
                    const groupIds = betGameGroups[gk];
                    const sampleBot = bots[groupIds[0]];
                    const rawTickerBets = sampleBot.ticker || '';
                    const sampleTicker = rawTickerBets.toUpperCase();
                    const groupName = formatBotDisplayName(sampleTicker).split('·')[0].split('—')[0].trim();
                    const sportIcon = sampleTicker.includes('NBA') ? '🏀' : sampleTicker.includes('NHL') ? '🏒' : sampleTicker.includes('NCAA') ? '🏀' : '📊';
                    const kalshiUrl = `https://kalshi.com/markets/${rawTickerBets.split('-')[0]}/${rawTickerBets}`;
                    const gs = gameScores[gk] || {};
                    const scoreBadge = buildScoreBadgeHtml(gs, 'compact');
                    const header = document.createElement('div');
                    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-top:12px;margin-bottom:4px;background:#0d1117;border-left:3px solid #00ff88;border-radius:4px;font-size:12px;';
                    header.innerHTML = `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <a href="${kalshiUrl}" target="_blank" style="color:#00ff88;font-weight:700;text-decoration:none;" title="Open on Kalshi">${sportIcon} ${groupName}</a>
                            ${scoreBadge}
                        </div>
                        <span style="color:#555;font-size:10px;">${groupIds.length} bet${groupIds.length > 1 ? 's' : ''}</span>`;
                    betsList.appendChild(header);
                    for (const botId of groupIds) {
                        _renderWatchBotCard(bots[botId], botId, betsList, gameScores);
                    }
                });
            }
        }

        // Render middle bots list — grouped by game
        if (middleList) {
            if (middleBotIds.length === 0) {
                middleList.innerHTML = '<div class="empty-state"><div class="icon">◈</div><div class="title">No active Meridian bots</div><div class="desc">Open a Meridian bot from the scanner</div></div>';
            } else {
                middleList.innerHTML = '';
                const midGameGroups = {};
                middleBotIds.forEach(botId => {
                    const bot = bots[botId];
                    const t = bot.ticker_a || bot.ticker || '';
                    const parts = t.split('-');
                    const gk = parts.length >= 2 ? parts[1] : parts[0];
                    if (!midGameGroups[gk]) midGameGroups[gk] = [];
                    midGameGroups[gk].push(botId);
                });
                Object.values(midGameGroups).forEach(ids => ids.sort((a, b) => (bots[b].created_at || 0) - (bots[a].created_at || 0)));
                const sortedMidKeys = Object.keys(midGameGroups).sort((a, b) => {
                    const fa = Math.min(...midGameGroups[a].map(id => bots[id].created_at || 0));
                    const fb = Math.min(...midGameGroups[b].map(id => bots[id].created_at || 0));
                    return fb - fa;
                });
                sortedMidKeys.forEach(gk => {
                    const groupIds = midGameGroups[gk];
                    const sampleBot = bots[groupIds[0]];
                    const rawTickerMid = sampleBot.ticker_a || sampleBot.ticker || '';
                    const sampleTicker = rawTickerMid.toUpperCase();
                    const groupName = formatBotDisplayName(sampleTicker).split('·')[0].split('—')[0].trim();
                    const sportIcon = sampleTicker.includes('NBA') ? '🏀' : sampleTicker.includes('NHL') ? '🏒' : sampleTicker.includes('NCAA') ? '🏀' : '📊';
                    const kalshiUrl = `https://kalshi.com/markets/${rawTickerMid.split('-')[0]}/${rawTickerMid}`;
                    const gs = gameScores[gk] || {};
                    const scoreBadge = buildScoreBadgeHtml(gs, 'compact');
                    const header = document.createElement('div');
                    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-top:12px;margin-bottom:4px;background:#0d1117;border-left:3px solid #60a5fa;border-radius:4px;font-size:12px;';
                    header.innerHTML = `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <a href="${kalshiUrl}" target="_blank" style="color:#60a5fa;font-weight:700;text-decoration:none;" title="Open on Kalshi">${sportIcon} ${groupName}</a>
                            ${scoreBadge}
                        </div>
                        <span style="color:#555;font-size:10px;">${groupIds.length} bot${groupIds.length > 1 ? 's' : ''}</span>`;
                    middleList.appendChild(header);
                    for (const botId of groupIds) {
                        _renderMiddleBotCard(bots[botId], botId, middleList, gameScores);
                    }
                });
            }
        }

        // Render dog bots list
        if (dogList) {
            if (dogBotIds.length === 0) {
                dogList.innerHTML = '<div class="empty-state"><div class="icon">👻</div><div class="title">No active Phantom bots</div><div class="desc">Deploy a Phantom bot from the Markets tab</div></div>';
            } else {
                dogList.innerHTML = '';
                // Group dog bots by game (same logic as arb bots)
                const dogGameGroups = {};
                dogBotIds.forEach(botId => {
                    const bot = bots[botId];
                    const ticker = bot.ticker || '';
                    const parts = ticker.split('-');
                    const gk = parts.length >= 2 ? parts[1] : parts[0];
                    if (!dogGameGroups[gk]) dogGameGroups[gk] = [];
                    dogGameGroups[gk].push(botId);
                });
                Object.values(dogGameGroups).forEach(ids => ids.sort((a, b) => (bots[b].created_at || 0) - (bots[a].created_at || 0)));
                const sortedDogGameKeys = Object.keys(dogGameGroups).sort((a, b) => {
                    const firstA = Math.min(...dogGameGroups[a].map(id => bots[id].created_at || 0));
                    const firstB = Math.min(...dogGameGroups[b].map(id => bots[id].created_at || 0));
                    return firstB - firstA;
                });
                sortedDogGameKeys.forEach(gk => {
                    const groupIds = dogGameGroups[gk];
                    const sampleBot = bots[groupIds[0]];
                    const groupName = formatBotDisplayName(sampleBot.ticker).split('·')[0].split('—')[0].trim();
                    const rawTickerDog = sampleBot.ticker || '';
                    const sampleTicker = rawTickerDog.toUpperCase();
                    const sportIcon = sampleTicker.includes('NBA') ? '🏀' : sampleTicker.includes('NHL') ? '🏒' : sampleTicker.includes('MLB') ? '⚾' : sampleTicker.includes('NFL') ? '🏈' : sampleTicker.includes('TENNIS') || sampleTicker.includes('ATP') || sampleTicker.includes('WTA') ? '🎾' : sampleTicker.includes('NCAA') ? '🏀' : '📊';
                    const kalshiUrl = `https://kalshi.com/markets/${rawTickerDog.split('-')[0]}/${rawTickerDog}`;
                    const gs = gameScores[gk] || {};
                    const scoreBadge = buildScoreBadgeHtml(gs, 'compact');
                    const groupIsLive = groupIds.some(id => bots[id].game_phase === 'live');
                    const groupPhase = groupIsLive ? '🔴 LIVE' : '⏳ PRE';
                    const escapedGk = gk.replace(/'/g, "\\'");
                    const groupPnlTotal = groupIds.reduce((sum, id) => {
                        const b = bots[id];
                        return sum + (b.lifetime_pnl ?? b.net_pnl_cents ?? 0);
                    }, 0);
                    const header = document.createElement('div');
                    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-top:12px;margin-bottom:4px;background:#0d1117;border-left:3px solid #ffaa00;border-radius:4px;font-size:12px;';
                    header.innerHTML = `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <a href="${kalshiUrl}" target="_blank" style="color:#ffaa00;font-weight:700;text-decoration:none;" title="Open on Kalshi">${sportIcon} ${groupName}</a>
                            <span style="color:${groupIsLive ? '#ff6666' : '#556'};font-size:10px;font-weight:700;">${groupPhase}</span>
                            ${scoreBadge}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="color:#555;font-size:10px;">${groupIds.length} bot${groupIds.length > 1 ? 's' : ''}</span>
                            <span style="color:${groupPnlTotal >= 0 ? '#00ff88' : '#ff4444'};font-size:11px;font-weight:700;">${groupPnlTotal >= 0 ? '+' : ''}${groupPnlTotal}¢</span>
                            <button onclick="emergencyExitGame('${escapedGk}')" title="Cancel & sell ALL bots for this game" style="background:#ff333322;color:#ff6666;border:1px solid #ff333355;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;">🚨 Exit</button>
                        </div>`;
                    dogList.appendChild(header);
                    for (const botId of groupIds) {
                        try {
                            _renderDogBotCard(bots[botId], botId, dogList, gameScores);
                        } catch(e) {
                            console.error('Phantom render error:', botId, e);
                            const errCard = document.createElement('div');
                            errCard.style.cssText = 'background:#0f1419;border:1px solid #ff880033;border-left:3px solid #ff8800;border-radius:12px;padding:14px;margin-bottom:10px;';
                            const bot = bots[botId] || {};
                            errCard.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><span style="color:#ffaa00;font-weight:800;font-size:10px;">PHANTOM</span><span style="color:#fff;font-weight:700;">' + (bot.status || '?') + '</span><span style="color:#ff8800;font-size:11px;">Card render error: ' + (e.message || e) + '</span></div><div style="color:#555;font-size:9px;margin-top:4px;">' + botId + '</div>';
                            dogList.appendChild(errCard);
                        }
                    }
                });
            }
        }

        // Awaiting settlement bots are now shown inline in the normal bot list
        // Clear the old separate section if it exists
        const awaitList = document.getElementById('awaiting-settlement-list');
        if (awaitList) { awaitList.innerHTML = ''; awaitList.style.display = 'none'; }

        if (arbBotIds.length === 0) {
            botsList.innerHTML = `<div class="empty-state"><div class="icon">△</div><div class="title">No active Apex bots</div><div class="desc">Deploy an Apex bot from the Markets tab or use the Apex Scanner</div></div>`;
            updateBotBuddy(0, 0);
            updateBotsBadge(arbBotIds.length + middleBotIds.length + dogBotIds.length + betsBotIds.length);
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
            // Live detection: use game_scores from backend OR Kalshi-native live detection
            const groupGameScore = gameScores[gameKey] || {};
            const groupIsLive = groupGameScore.status === 'in' || groupBots.some(id => {
                const b = bots[id];
                return b.game_phase === 'live' || (b.live_yes_bid > 0 && b.live_no_bid > 0);
            });
            const groupPhase = groupIsLive ? '🔴 LIVE' : (groupGameScore.status === 'post' ? '✅ FINAL' : '⏳ PRE');
            const groupProfitTotal = groupBots.reduce((sum, id) => {
                const b = bots[id];
                if (b.type === 'watch') {
                    return sum + ((100 - (b.entry_price || 50)) * (b.quantity || 1));
                }
                // Use lifetime_pnl or net_pnl_cents for accumulated P&L across all runs
                if (b.bot_category === 'ladder_arb' || b.bot_category === 'anchor_dog' || b.bot_category === 'anchor_ladder') {
                    let estPnl = b.lifetime_pnl ?? b.net_pnl_cents ?? b.cumulative_pnl ?? 0;
                    // Add estimated P&L for current active run
                    const anchorPrice = b.avg_fill_price || b.dog_price || 0;
                    const favSide = b.first_fill_side === 'yes' ? 'no' : 'yes';
                    const favBid = b[`live_${favSide}_bid`] || 0;
                    const favPrice = b.fav_price || b.hedge_price || favBid;
                    const dogFilled = (b.total_dog_fill_qty || b.dog_fill_qty || b[`filled_${b.first_fill_side || 'yes'}_qty`] || 0) > 0;
                    if (anchorPrice > 0 && dogFilled) {
                        const curFav = favPrice > 0 ? favPrice : favBid;
                        if (curFav > 0) {
                            const q = b.hedge_qty || b.quantity || 1;
                            const spread = 100 - anchorPrice - curFav;
                            const fee = typeof kalshiFeeCents === 'function' ? kalshiFeeCents(anchorPrice, curFav, q) : 0;
                            estPnl += spread * q - fee;
                        }
                    }
                    return sum + estPnl;
                }
                // Regular Arb (both_posted): use lifetime_pnl from completed runs, NOT theoretical profit
                const lifetimePnl = b.lifetime_pnl ?? b.net_pnl_cents ?? 0;
                const yFillCnt = b.yes_fill_qty || 0;
                const nFillCnt = b.no_fill_qty || 0;
                const bQty = b.quantity || 1;
                if (yFillCnt >= bQty && nFillCnt >= bQty) {
                    // Both filled on current run — count theoretical as locked
                    const yp = b.yes_price || 0, np = b.no_price || 0;
                    const rawProfit = (100 - yp - np) * bQty;
                    const fee = (yp > 0 && np > 0) ? kalshiFeeCents(yp, np, bQty) : 0;
                    return sum + lifetimePnl + rawProfit - fee;
                }
                // Not fully filled — only count completed runs' P&L
                return sum + lifetimePnl;
            }, 0);

            const groupHeader = document.createElement('div');
            groupHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;margin-top:16px;margin-bottom:4px;background:#0d1117;border-left:3px solid #00aaff;border-radius:4px;font-size:12px;';
            const rawTickerApex = sampleBot.ticker || '';
            const sampleTicker = rawTickerApex.toUpperCase();
            const sportIcon = sampleTicker.includes('NBA') ? '🏀' : sampleTicker.includes('NHL') ? '🏒' : sampleTicker.includes('MLB') ? '⚾' : sampleTicker.includes('NFL') ? '🏈' : sampleTicker.includes('TENNIS') || sampleTicker.includes('ATP') || sampleTicker.includes('WTA') ? '🎾' : sampleTicker.includes('NCAA') ? '🏀' : '📊';
            const kalshiUrl = `https://kalshi.com/markets/${rawTickerApex.split('-')[0]}/${rawTickerApex}`;
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
                    <a href="${kalshiUrl}" target="_blank" style="color:#00aaff;font-weight:700;text-decoration:none;" title="Open on Kalshi">${sportIcon} ${groupMatchup}</a>
                    <span style="color:${groupIsLive ? '#ff6666' : '#556'};font-size:10px;font-weight:700;">${groupPhase}</span>
                    ${groupScoreBadge}
                    ${groupSignalBadge}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:#8892a6;font-size:10px;">${groupBots.length} bot${groupBots.length > 1 ? 's' : ''}</span>
                    <span style="color:${groupProfitTotal >= 0 ? '#00ff88' : '#ff4444'};font-size:11px;font-weight:700;">${groupProfitTotal >= 0 ? '+' : ''}${(groupProfitTotal / 100).toFixed(2)}</span>
                    <button onclick="emergencyExitGame('${escapedGameKey}')" title="Cancel & sell ALL bots for this game" style="background:#ff333322;color:#ff6666;border:1px solid #ff333355;border-radius:5px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">🚨 Exit All</button>
                </div>
            `;
            botsList.appendChild(groupHeader);

            groupBots.forEach(botId => {
            const bot = bots[botId];

            // Middle bots are rendered in their own list — skip here
            if (bot.type === 'middle') return;

            // Watch bots now rendered in BETS tab — skip here
            if (bot.type === 'watch') return;

            // ── Ladder-Arb Bots ───────────────────────────────────────
            if (bot.bot_category === 'ladder_arb') {
                try {
                    _renderLadderArbCard(bot, botId, botsList, gameScores, gameKey);
                } catch(e) {
                    console.error('APEX RENDER ERROR:', e, 'bot:', botId, 'status:', bot.status);
                    const errDiv = document.createElement('div');
                    errDiv.style.cssText = 'background:#ff000022;border:1px solid #ff4444;border-radius:8px;padding:10px;margin-bottom:10px;color:#ff4444;font-size:11px;';
                    errDiv.textContent = `Apex render error: ${e.message} (${botId})`;
                    botsList.appendChild(errDiv);
                }
                activeBotCount++;
                if (bot.status === 'ladder_arb_active') anchoredCount++;
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
            const isAnchorDog = bot.bot_category === 'anchor_dog';
            const isAnchorLadder = bot.bot_category === 'anchor_ladder';
            const isLadderArb = bot.bot_category === 'ladder_arb';
            const statusLabel = {
                both_posted:      '⚡ BOTH LIVE',
                fav_posted:       '⏳ WAITING',     // legacy: one order posted
                pending_fills:    '⏳ FILLING',
                yes_filled:       '✓ YES FILLED',
                no_filled:        '✓ NO FILLED',
                amending_no:      '🔧 AMENDING NO',
                amending_yes:     '🔧 AMENDING YES',
                waiting_repeat:       '🔄 REPEATING',
                flipping:             '⚡ EXITING',
                drift_cancelled:      '🚫 DRIFT GUARD',
                awaiting_settlement:  '⏳ AWAITING SETTLEMENT',
                dog_anchor_posted:    '👻 ANCHORED',
                fav_hedge_posted:     '🔒 HEDGING FAV',
                dog_filled:           '⚡ DOG FILLED',
                ladder_posted:        '🪜 LADDER ACTIVE',
                ladder_filled_no_fav: '⚡ LADDER FILLED',
                ladder_arb_posted:      '⚡ BOTH LIVE',
                ladder_arb_active:      '🔥 ACTIVE',
                ladder_arb_yes_filled:  '✓ YES FILLED',
                ladder_arb_no_filled:   '✓ NO FILLED',
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
                amending_no:    'leg1_filled',
                amending_yes:   'leg1_filled',
                waiting_repeat: 'monitoring',
                dog_anchor_posted: 'monitoring',
                fav_hedge_posted:  'leg1_filled',
                dog_filled:        'leg1_filled',
                ladder_posted:     'monitoring',
                ladder_filled_no_fav: 'leg1_filled',
                ladder_arb_posted:      'monitoring',
                ladder_arb_active:      'leg1_filled',
                ladder_arb_yes_filled:  'leg1_filled',
                ladder_arb_no_filled:   'leg1_filled',
            }[bot.status] || 'monitoring';

            activeBotCount++;
            if (yFill >= qty) filledLegs++;
            if (nFill >= qty) filledLegs++;
            // Anchored = status explicitly transitioned to yes_filled or no_filled (or amending), or anchor-dog hedge active
            if (bot.status === 'yes_filled' || bot.status === 'no_filled' ||
                bot.status === 'amending_no' || bot.status === 'amending_yes' ||
                bot.status === 'fav_hedge_posted' || bot.status === 'dog_filled' ||
                bot.status === 'ladder_filled_no_fav') anchoredCount++;

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
                        timeoutInfo = `<span style="color:#818cf8;font-size:10px;">⏸ HALFTIME</span>`;
                    } else if (bot._snap_ready) {
                        timeoutInfo = `<span style="color:#00ff88;font-size:10px;">⚡ SNAP → BID</span>`;
                    } else {
                        const wc = bot.walk_count || 0;
                        const cmbnd = (bot.avg_yes_price || bot.avg_no_price || 0) + (bot.hedge_price || 0);
                        timeoutInfo = wc > 0
                            ? `<span style="color:#00aaff;font-size:10px;">📈 Walk #${wc} · ${cmbnd}¢ combined</span>`
                            : `<span style="color:#ffaa00;font-size:10px;">⏳ Walk pending</span>`;
                    }
                }
            } else if (phase === 'pregame') {
                timeoutInfo = `<span style="color:#555;font-size:10px;">⏳ Pre-game</span>`;
            }

            // Waiting for repeat spread
            let driftInfo = '';
            if (bot.status === 'drift_cancelled') {
                const driftY = bot.drift_yes_bid != null ? bot.drift_yes_bid : '?';
                const driftN = bot.drift_no_bid  != null ? bot.drift_no_bid  : '?';
                driftInfo = `<div style="background:#ff8c0011;border:1px solid #ff8c0033;border-radius:5px;padding:4px 8px;font-size:10px;color:#ff8c00;margin-top:6px;">
                    👁 Market drifted to ${driftY}¢ / ${driftN}¢ — watching for recovery (auto-resumes if prices come back below 80¢, otherwise closes in 5 min).
                </div>`;
            }

            let waitRepeatInfo = '';
            if (bot.status === 'waiting_repeat') {
                const waitSince = bot.waiting_repeat_since || 0;
                const elapsedSec = waitSince > 0 ? Date.now() / 1000 - waitSince : 0;
                const maxWaitSec = 20 * 60; // 20 min max
                const secsLeft = Math.max(0, maxWaitSec - elapsedSec);
                const minsLeft = Math.floor(secsLeft / 60);
                const secsRem = Math.floor(secsLeft % 60);
                const pctLeft = secsLeft / maxWaitSec;
                const timerCol = pctLeft > 0.5 ? '#818cf8' : pctLeft > 0.2 ? '#ffaa00' : '#ff4444';
                const targetW = bot.arb_width || bot.profit_per || '?';
                waitRepeatInfo = `<div style="background:#6366f111;border:1px solid #6366f133;border-radius:5px;padding:6px 10px;font-size:10px;color:#818cf8;margin-top:6px;display:flex;align-items:center;gap:10px;">
                    <span style="color:#fff;font-weight:800;font-size:14px;font-family:monospace;min-width:50px;color:${timerCol};">${minsLeft}:${String(secsRem).padStart(2,'0')}</span>
                    <div style="flex:1;">
                        <div style="margin-bottom:3px;">🔄 Waiting for <strong>${targetW}¢</strong> spread to reopen</div>
                        <div style="height:4px;background:#1e2740;border-radius:2px;overflow:hidden;">
                            <div style="height:100%;width:${Math.round(pctLeft*100)}%;background:${timerCol};border-radius:2px;transition:width 1s;"></div>
                        </div>
                    </div>
                </div>`;
                timeoutInfo = `<span style="color:${timerCol};font-size:10px;font-weight:700;">${minsLeft}:${String(secsRem).padStart(2,'0')}</span>`;
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
                    <span style="color:#555;">${ageMin}m · ${bot.timeout_min || 2}-min exit if one fills</span>
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
            } else if (bot.status === 'yes_filled' || bot.status === 'no_filled' ||
                       bot.status === 'amending_no' || bot.status === 'amending_yes') {
                const isAmending = bot.status === 'amending_no' || bot.status === 'amending_yes';
                const filledSide = (bot.status === 'yes_filled' || bot.status === 'amending_no') ? 'YES' : 'NO';
                const pendingSide = (bot.status === 'yes_filled' || bot.status === 'amending_no') ? 'NO' : 'YES';
                const entryFilled = (bot.status === 'yes_filled' || bot.status === 'amending_no') ? (bot.yes_price || 0) : (bot.no_price || 0);
                const liveBidFilled = (bot.status === 'yes_filled' || bot.status === 'amending_no') ? bot.live_yes_bid : bot.live_no_bid;
                const isFavFilled = entryFilled >= ((bot.status === 'yes_filled' || bot.status === 'amending_no') ? (bot.no_price || 0) : (bot.yes_price || 0));
                const walkCount = bot.walk_count || 0;
                const livePendingBid = (bot.status === 'yes_filled' || bot.status === 'amending_no') ? bot.live_no_bid : bot.live_yes_bid;
                const pendingPrice = pendingSide === 'YES' ? (bot.yes_price || 0) : (bot.no_price || 0);
                const combined = (bot.yes_price || 0) + (bot.no_price || 0);
                const gameOver = livePendingBid != null && livePendingBid < 5;
                const amendPrice = bot.amend_price;
                const urgColor = isAmending ? '#ff8800' : isHalftime ? '#818cf8' : walkCount > 0 ? '#00aaff' : '#ffaa00';
                const bidDisplay = liveBidFilled != null ? `${liveBidFilled}¢` : '?';
                const lastWalkAt = bot.last_walk_at || bot.first_fill_at || 0;
                const _walkInterval = combined >= 98 ? 3 : 20;
                const nextWalkIn = lastWalkAt > 0 ? Math.max(0, _walkInterval - (Date.now()/1000 - lastWalkAt)) : _walkInterval;
                const nextWalkPct = Math.min(100, ((_walkInterval - nextWalkIn) / _walkInterval) * 100);
                const nextWalkStr = Math.ceil(nextWalkIn) + 's';
                const walkStartPrice = bot.walk_start_price || pendingPrice;
                const prevPrice = walkCount > 0 ? pendingPrice - 1 : walkStartPrice;
                const nextPrice = pendingPrice + 1;
                const exitLine = isAmending
                    ? `<span style="color:#ff8800;font-weight:700;">🔧 ${pendingSide} posted ${pendingPrice}¢ → amend ${amendPrice != null ? amendPrice + '¢' : '?¢'} (completing arb…)</span>`
                    : gameOver
                    ? `<span style="color:#818cf8;font-weight:700;">⏳ Awaiting settlement — game ended, position held</span>`
                    : isHalftime
                    ? `<span style="color:#818cf8;font-weight:700;">⏸ HALFTIME — walk-up paused</span>`
                    : walkCount > 0
                    ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="color:#00aaff;font-weight:700;">📈 ${pendingSide} hedge @ ${pendingPrice}¢</span>
                        <span style="color:#555;font-size:9px;">combined ${combined}¢ · step #${walkCount}</span>
                      </div>`
                    : `<span style="color:#ffaa00;font-weight:700;">⏳ ${pendingSide} hedge @ ${pendingPrice}¢</span>`;
                stopLossInfo = `<div style="background:${gameOver ? '#818cf811' : urgColor+'11'};border:1px solid ${gameOver ? '#818cf833' : urgColor+'33'};border-radius:5px;padding:4px 8px;font-size:10px;color:${gameOver ? '#818cf8' : urgColor};margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>✓ <strong>${filledSide}</strong> filled ${fillAgeMin}m ago${isFavFilled ? ' (fav)' : ' (dog)'} @ ${entryFilled}¢</span>
                    <span style="color:#8892a6;">Bid now: <strong style="color:#fff;">${bidDisplay}</strong></span>
                    ${exitLine}
                </div>`;
            } else if (bot.status === 'awaiting_settlement') {
                const heldY = bot.awaiting_qty_yes || 0;
                const heldN = bot.awaiting_qty_no  || 0;
                const awaitMin = bot.awaiting_since ? Math.round((Date.now()/1000 - bot.awaiting_since) / 60) : 0;
                const heldDesc = [heldY > 0 ? `YES ×${heldY}` : '', heldN > 0 ? `NO ×${heldN}` : ''].filter(Boolean).join(' · ') || 'contracts held';
                stopLossInfo = `<div style="background:#818cf811;border:1px solid #818cf844;border-radius:5px;padding:6px 10px;font-size:10px;color:#818cf8;margin-top:6px;">
                    ⏳ <strong>AWAITING SETTLEMENT</strong> — market closed, position held on Kalshi<br>
                    <span style="color:#aaa;">${heldDesc}</span> <span style="color:#555;">· waiting ${awaitMin}m</span>
                    <br><span style="color:#555;font-size:9px;">Will auto-resolve when Kalshi settles the market</span>
                </div>`;
            } else if (isAnchorDog && bot.status === 'dog_anchor_posted') {
                const dogSide = (bot.dog_side || '?').toUpperCase();
                const favSide = (bot.fav_side || '?').toUpperCase();
                const dogPrice = bot.dog_price || '?';
                const targetW = bot.target_width || bot.arb_width || '?';
                const liveBid = dogSide === 'YES' ? bot.live_yes_bid : bot.live_no_bid;
                const liveFavBid = favSide === 'YES' ? bot.live_yes_bid : bot.live_no_bid;
                const hasBid = liveBid != null && liveBid > 0;
                const dist = hasBid && typeof dogPrice === 'number' ? liveBid - dogPrice : null;
                const distColor = dist != null ? (dist <= 2 ? '#00ff88' : dist <= 5 ? '#ffaa00' : '#ff4444') : '#555';
                const distText = dist != null ? (dist === 0 ? 'AT anchor' : dist > 0 ? `${dist}¢ away` : `${Math.abs(dist)}¢ past!`) : '';
                const repostCount = bot.dog_repost_count || 0;
                const repostMin = 3; // DOG_REPOST_MINUTES
                const postedAt = bot.posted_at || bot.created_at || 0;
                const sinceRepost = postedAt > 0 ? Math.round((Date.now()/1000 - postedAt) / 60 * 10) / 10 : 0;
                const repostLeft = Math.max(0, repostMin - sinceRepost);
                // Estimated hedge: what we'd pay for fav if dog fills now
                const estFavMax = typeof dogPrice === 'number' ? 100 - dogPrice - targetW : '?';
                const estTotal = typeof dogPrice === 'number' && liveFavBid ? dogPrice + Math.min(liveFavBid, estFavMax) : '?';
                const priceAge = bot._price_age_s || 0;
                const priceSource = (bot._price_source === 'stale' ? ' ⚠ NO DATA' : bot._price_source === 'rest' ? ' (REST)' : '') + (priceAge > 30 ? ` ${priceAge}s stale` : '');
                stopLossInfo = `<div style="background:#ffaa0011;border:1px solid #ffaa0033;border-radius:5px;padding:6px 8px;font-size:10px;color:#ffaa00;margin-top:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
                        <span>🎯 <strong>ANCHOR:</strong> ${dogSide} @ ${dogPrice}¢</span>
                        ${hasBid ? `<span style="color:${distColor};font-weight:700;">${distText}</span>` : '<span style="color:#555;">no bid data</span>'}
                        <span style="color:#555;">Target: +${targetW}¢</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;color:#8892a6;">
                        ${hasBid ? `<span>Dog bid: <strong>${liveBid}¢</strong>${priceSource}</span>` : ''}
                        ${liveFavBid ? `<span>Fav bid: <strong>${liveFavBid}¢</strong> · est total: <strong>${estTotal}¢</strong></span>` : ''}
                        <span style="color:#555;">${repostCount > 0 ? `repost #${repostCount} · ` : ''}${repostLeft > 0 ? `repost in ${repostLeft.toFixed(0)}m` : 'repost ready'} · ${ageMin}m</span>
                    </div>
                </div>`;
            } else if (isAnchorDog && (bot.status === 'dog_filled' || bot.status === 'fav_hedge_posted')) {
                const dogSide = (bot.dog_side || '?').toUpperCase();
                const favSide = (bot.fav_side || '?').toUpperCase();
                const dogPrice = bot.dog_price || '?';
                const favPrice = bot.fav_price || '?';
                const hedgeTimeout = bot.hedge_timeout_s || 120;
                const dogFilledAt = bot.dog_filled_at || 0;
                const favPostedAt = bot.fav_posted_at || dogFilledAt || 0;
                const hedgeElapsed = favPostedAt > 0 ? (Date.now()/1000 - favPostedAt) : 0;
                const hedgeLeft = Math.max(0, hedgeTimeout - hedgeElapsed);
                const hedgeColor = hedgeLeft <= 15 ? '#ff4444' : hedgeLeft <= 45 ? '#ff8800' : '#00aaff';
                const isFavPosted = bot.status === 'fav_hedge_posted';
                const favFillQty = bot.fav_fill_qty || 0;
                const qty = bot.quantity || 1;
                const totalCost = typeof dogPrice === 'number' && typeof favPrice === 'number' ? dogPrice + favPrice : '?';
                const estPnl = typeof totalCost === 'number' ? (100 - totalCost) * qty : '?';
                const pnlColor = typeof estPnl === 'number' ? (estPnl >= 0 ? '#00ff88' : '#ff4444') : '#555';
                const sellbackAttempts = bot._sellback_attempts || 0;
                stopLossInfo = `<div style="background:${isFavPosted ? '#00aaff11' : '#00ff8811'};border:1px solid ${isFavPosted ? '#00aaff33' : '#00ff8833'};border-radius:5px;padding:6px 8px;font-size:10px;color:${isFavPosted ? '#00aaff' : '#00ff88'};margin-top:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:3px;">
                        <span>✓ <strong>${dogSide}</strong> filled @ ${dogPrice}¢ — ${isFavPosted ? `<strong>${favSide}</strong> hedge @ ${favPrice}¢ ${favFillQty > 0 ? `(${favFillQty}/${qty} filled)` : 'posted'}` : 'posting fav hedge...'}</span>
                        <span style="color:${hedgeColor};font-weight:700;font-family:monospace;font-size:12px;">${Math.floor(hedgeLeft/60)}:${String(Math.floor(hedgeLeft%60)).padStart(2,'0')}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;color:#8892a6;">
                        <span>Total: <strong>${totalCost}¢</strong> · Est P&L: <strong style="color:${pnlColor};">${typeof estPnl === 'number' ? (estPnl >= 0 ? '+' : '') + estPnl + '¢' : '?'}</strong></span>
                        <span style="color:#555;">${sellbackAttempts > 0 ? `⚠ sellback retry #${sellbackAttempts} · ` : ''}Sellback if ceiling</span>
                    </div>
                </div>`;
            } else if (isAnchorLadder && bot.status === 'ladder_posted') {
                const rungs = bot.rungs || [];
                const totalFill = rungs.reduce((s, r) => s + (r.fill_qty || 0), 0);
                const totalQty = bot.total_dog_qty || rungs.reduce((s, r) => s + r.qty, 0);
                const dogSide = (bot.dog_side || '?').toUpperCase();
                const lowestBid = bot.lowest_dog_bid_seen || '?';
                const bounceT = bot.bounce_threshold || 2;
                const rungPrices = rungs.map(r => {
                    if (r.cancelled) return `<span style="text-decoration:line-through;color:#555;">${r.price}¢ ✕</span>`;
                    return `${r.price}¢(${r.fill_qty||0}/${r.qty})`;
                }).join(' · ');
                stopLossInfo = `<div style="background:#ff660011;border:1px solid #ff660033;border-radius:5px;padding:4px 8px;font-size:10px;color:#ff6600;margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>🪜 <strong>LADDER:</strong> ${dogSide} · ${rungPrices}</span>
                    <span style="color:#8892a6;">Fills: <strong style="color:#ff6600;">${totalFill}/${totalQty}</strong></span>
                    <span style="color:#555;">Low: ${lowestBid}¢ · Bounce: +${bounceT}¢ · ${ageMin}m</span>
                </div>`;
            } else if (isAnchorLadder && (bot.status === 'ladder_filled_no_fav' || bot.status === 'fav_hedge_posted')) {
                const rungs = bot.rungs || [];
                const totalFill = rungs.reduce((s, r) => s + (r.fill_qty || 0), 0);
                const avgPrice = bot.avg_fill_price || (totalFill > 0
                    ? Math.round(rungs.reduce((s, r) => s + r.price * (r.fill_qty || 0), 0) / totalFill) : 0);
                const favSide = (bot.fav_side || '?').toUpperCase();
                const favPrice = bot.fav_price || '—';
                const hedgeTimeout = bot.hedge_timeout_s || 120;
                const triggerAt = bot.bounce_triggered_at || bot.dog_filled_at || 0;
                const hedgeElapsed = triggerAt > 0 ? (Date.now()/1000 - triggerAt) : 0;
                const hedgeLeft = Math.max(0, hedgeTimeout - hedgeElapsed);
                const hedgeColor = hedgeLeft <= 15 ? '#ff4444' : hedgeLeft <= 45 ? '#ff8800' : '#00aaff';
                const isFavPosted = bot.status === 'fav_hedge_posted';
                stopLossInfo = `<div style="background:${isFavPosted ? '#00aaff11' : '#ff444411'};border:1px solid ${isFavPosted ? '#00aaff33' : '#ff444433'};border-radius:5px;padding:4px 8px;font-size:10px;color:${isFavPosted ? '#00aaff' : '#ff4444'};margin-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>🪜 <strong>${totalFill}</strong> fills @ avg <strong>${avgPrice}¢</strong> — ${isFavPosted ? `<strong>${favSide}</strong> hedge @ ${favPrice}¢` : 'posting hedge...'}</span>
                    <span style="color:${hedgeColor};font-weight:700;font-family:monospace;font-size:12px;">${Math.floor(hedgeLeft/60)}:${String(Math.floor(hedgeLeft%60)).padStart(2,'0')}</span>
                    <span style="color:#555;">Sellback if ceiling breached</span>
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
                healthColor = '#ff8c00';
                healthLabel = '👁 WATCHING';
            } else if (bot.status === 'awaiting_settlement') {
                healthColor = '#818cf8';
                healthLabel = '⏳ SETTLING';
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
                const toutMin = bot.timeout_min || 2;
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
            } else if (bot.status === 'dog_anchor_posted') {
                healthColor = '#ffaa00';
                healthLabel = '🎯 ANCHORED';
                anchoredHealthKey = 'waiting';
            } else if (bot.status === 'dog_filled' || (bot.status === 'fav_hedge_posted' && !isAnchorLadder)) {
                // Anchor-dog: dog filled, fav hedge in progress — time-based health
                const hedgeTimeout = bot.hedge_timeout_s || 120;
                const dogFilledAt = bot.dog_filled_at || 0;
                const hedgeElapsed = dogFilledAt > 0 ? (Date.now()/1000 - dogFilledAt) : 0;
                const hedgePctLeft = hedgeTimeout > 0 ? Math.max(0, hedgeTimeout - hedgeElapsed) / hedgeTimeout : 0;
                if (hedgePctLeft <= 0.15) {
                    healthColor = '#ff4444';
                    healthAnim = 'animation: dangerPulse 0.8s ease-in-out infinite;';
                    healthLabel = `🔴 ${Math.ceil(Math.max(0, hedgeTimeout - hedgeElapsed))}s`;
                    anchoredHealthKey = 'danger';
                } else if (hedgePctLeft <= 0.40) {
                    healthColor = '#ff8800';
                    healthLabel = `🟠 ${Math.ceil(Math.max(0, hedgeTimeout - hedgeElapsed))}s`;
                    anchoredHealthKey = 'warning';
                } else {
                    healthColor = '#00aaff';
                    healthLabel = `🔵 HEDGING`;
                    anchoredHealthKey = 'holding';
                }
            } else if (bot.status === 'ladder_posted') {
                // Ladder: rungs posted, watching for fills + bounce
                const rungs = bot.rungs || [];
                const totalFill = rungs.reduce((s, r) => s + (r.fill_qty || 0), 0);
                const totalQty = bot.total_dog_qty || rungs.reduce((s, r) => s + r.qty, 0);
                if (totalFill > 0 && totalFill < totalQty) {
                    // Partial fills — amber pulsing
                    healthColor = '#ff6600';
                    healthAnim = 'animation: warningPulse 1.5s ease-in-out infinite;';
                    healthLabel = `🪜 ${totalFill}/${totalQty} FILLED`;
                    anchoredHealthKey = 'warning';
                } else if (totalFill >= totalQty) {
                    healthColor = '#00ff88';
                    healthLabel = '✅ ALL FILLED';
                    anchoredHealthKey = 'healthy';
                } else {
                    healthColor = '#ffaa00';
                    healthLabel = '🪜 WATCHING';
                    anchoredHealthKey = 'waiting';
                }
            } else if (bot.status === 'ladder_filled_no_fav') {
                // Ladder filled but fav hedge not posted yet — urgent
                healthColor = '#ff4444';
                healthAnim = 'animation: dangerPulse 0.8s ease-in-out infinite;';
                healthLabel = '⚡ HEDGE NEEDED';
                anchoredHealthKey = 'danger';
            } else if (bot.status === 'fav_hedge_posted' && isAnchorLadder) {
                // Ladder: fav hedge posted — time-based health
                const hedgeTimeout = bot.hedge_timeout_s || 120;
                const dogFilledAt = bot.dog_filled_at || bot.bounce_triggered_at || 0;
                const hedgeElapsed = dogFilledAt > 0 ? (Date.now()/1000 - dogFilledAt) : 0;
                const hedgePctLeft = hedgeTimeout > 0 ? Math.max(0, hedgeTimeout - hedgeElapsed) / hedgeTimeout : 0;
                if (hedgePctLeft <= 0.15) {
                    healthColor = '#ff4444';
                    healthAnim = 'animation: dangerPulse 0.8s ease-in-out infinite;';
                    healthLabel = `🔴 ${Math.ceil(Math.max(0, hedgeTimeout - hedgeElapsed))}s`;
                    anchoredHealthKey = 'danger';
                } else if (hedgePctLeft <= 0.40) {
                    healthColor = '#ff8800';
                    healthLabel = `🟠 ${Math.ceil(Math.max(0, hedgeTimeout - hedgeElapsed))}s`;
                    anchoredHealthKey = 'warning';
                } else {
                    healthColor = '#00aaff';
                    healthLabel = `🔵 HEDGING`;
                    anchoredHealthKey = 'holding';
                }
            }
            // Safety net: if bot is anchored (one leg filled) but no key was assigned, count as holding
            if (!anchoredHealthKey && (yFill >= qty) !== (nFill >= qty)) {
                anchoredHealthKey = 'holding';
            }
            if (anchoredHealthKey) anchoredHealthBuckets[anchoredHealthKey]++;

            const item = document.createElement('div');
            item.className = 'bot-item';
            item.style.cssText = `flex-direction:column;gap:8px;border-left:3px solid ${healthColor};${healthAnim}cursor:pointer;`;
            item.onclick = (e) => { if (!e.target.closest('button') && !e.target.closest('a')) showBotDetail(botId); };
            const botEventPrefix = (bot.ticker || '').toUpperCase().split('-').slice(0, 2).join('-');
            item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        ${getTeamLogoHtml(getTeamCodeFromTicker(bot.ticker), 18)}
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
                        ${repostCount > 0 ? `<span style="color:#555;font-size:10px;">${repostCount}↻</span>` : ''}
                        <button class="btn btn-secondary" style="padding:4px 10px;font-size:11px;"
                                onclick="cancelBot('${botId}')">✕</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:11px;">
                    ${(() => {
                        // Anchor-dog bots: show dog/fav legs instead of YES/NO
                        if (isAnchorDog) {
                            const dogSide = (bot.dog_side || 'no');
                            const favSide = (bot.fav_side || 'yes');
                            const dogFill = bot.dog_fill_qty || 0;
                            const favFill = bot.fav_fill_qty || 0;
                            const dogPct = Math.round((dogFill / qty) * 100);
                            const favPct = Math.round((favFill / qty) * 100);
                            const dogPrice = bot.dog_price || '?';
                            const favPrice = bot.fav_price || '—';
                            const isDogPosted = bot.status === 'dog_anchor_posted';
                            const isFavWaiting = !bot.fav_price && bot.status !== 'fav_hedge_posted';
                            const dogColor = dogSide === 'yes' ? '#00ff88' : '#ff4444';
                            const favColor = favSide === 'yes' ? '#00ff88' : '#ff4444';

                            return `
                            <div>
                                <div style="display:flex;justify-content:space-between;color:#8892a6;margin-bottom:3px;">
                                    <span>👻${bot.cross_market ? '<span style="color:#00ddff;font-size:8px;font-weight:800;margin:0 3px;">✕</span>' : ''} ANCHOR ${dogSide.toUpperCase()} @ <strong style="color:${dogColor};">${dogPrice}¢</strong></span>
                                    <span style="color:${dogFill >= qty ? dogColor : '#8892a6'};font-weight:${dogFill >= qty ? '700' : '400'};">${dogFill >= qty ? `${dogFill}/${qty} ✓` : `${dogFill}/${qty}`}</span>
                                </div>
                                <div style="height:6px;background:#1e2740;border-radius:3px;overflow:hidden;${dogFill >= qty ? `box-shadow:0 0 8px ${dogColor}44;` : ''}">
                                    <div style="height:100%;width:${dogPct}%;background:${dogFill >= qty ? dogColor : dogColor + '66'};border-radius:3px;transition:width .5s,background .5s;"></div>
                                </div>
                            </div>
                            <div style="opacity:${isFavWaiting ? '0.4' : '1'};transition:opacity .5s;">
                                <div style="display:flex;justify-content:space-between;color:${isFavWaiting ? '#555' : '#8892a6'};margin-bottom:3px;">
                                    <span>🔒 FAV ${favSide.toUpperCase()} @ <strong style="color:${isFavWaiting ? favColor + '44' : favColor};">${favPrice}¢</strong>${bot.cross_market && bot.hedge_ticker ? ` <span style="color:#00ddff;font-size:8px;">→ ${(bot.hedge_ticker||'').split('-').pop()}</span>` : ''}</span>
                                    <span style="color:${favFill >= qty ? favColor : (isFavWaiting ? '#555' : '#8892a6')};font-weight:${favFill >= qty ? '700' : '400'};">${isFavWaiting ? 'PENDING' : (favFill >= qty ? `${favFill}/${qty} ✓` : `${favFill}/${qty}`)}</span>
                                </div>
                                <div style="height:6px;background:#1e2740;border-radius:3px;overflow:hidden;${favFill >= qty ? `box-shadow:0 0 8px ${favColor}44;` : ''}">
                                    <div style="height:100%;width:${favPct}%;background:${favFill >= qty ? favColor : favColor + '66'};border-radius:3px;transition:width .5s,background .5s;"></div>
                                </div>
                            </div>`;
                        }

                        // Anchor-ladder bots: show rung fill bars + fav hedge
                        if (isAnchorLadder) {
                            const rungs = bot.rungs || [];
                            const dogSide = bot.dog_side || 'no';
                            const favSide = bot.fav_side || 'yes';
                            const dogColor = dogSide === 'yes' ? '#00ff88' : '#ff4444';
                            const favColor = favSide === 'yes' ? '#00ff88' : '#ff4444';
                            const totalFill = rungs.reduce((s, r) => s + (r.fill_qty || 0), 0);
                            const totalQty = bot.total_dog_qty || rungs.reduce((s, r) => s + r.qty, 0);
                            const avgPrice = bot.avg_fill_price || (totalFill > 0
                                ? Math.round(rungs.reduce((s, r) => s + r.price * (r.fill_qty || 0), 0) / totalFill) : 0);
                            const favPrice = bot.fav_price || '—';
                            const favFill = bot.fav_fill_qty || 0;
                            const hedgeQty = bot.hedge_qty || totalQty;
                            const isFavWaiting = !bot.fav_price;
                            const favPct = hedgeQty > 0 ? Math.round((favFill / hedgeQty) * 100) : 0;
                            const lowestBid = bot.lowest_dog_bid_seen || '?';
                            const bounceT = bot.bounce_threshold || 2;

                            let rungsHtml = rungs.map((r, i) => {
                                const pct = Math.round(((r.fill_qty || 0) / r.qty) * 100);
                                const filled = (r.fill_qty || 0) >= r.qty;
                                return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;">
                                    <span style="color:#ffaa00;font-size:9px;width:26px;font-weight:700;">${r.price}¢</span>
                                    <div style="flex:1;height:4px;background:#1e2740;border-radius:2px;overflow:hidden;">
                                        <div style="height:100%;width:${pct}%;background:${filled ? dogColor : dogColor + '55'};border-radius:2px;transition:width .5s;"></div>
                                    </div>
                                    <span style="color:${filled ? dogColor : '#555'};font-size:9px;width:32px;text-align:right;">${r.fill_qty||0}/${r.qty}</span>
                                </div>`;
                            }).join('');

                            rungsHtml += `<div style="display:flex;justify-content:space-between;font-size:9px;color:#8892a6;margin-top:3px;padding-top:3px;border-top:1px solid #1e274044;">
                                <span>Total: <b>${totalFill}/${totalQty}</b></span>
                                <span>Avg: <b style="color:#ff6600;">${avgPrice || '—'}¢</b></span>
                                <span>Low: <b style="color:#ffaa00;">${lowestBid}¢</b> (+${bounceT}¢)</span>
                            </div>`;

                            return `
                            <div>
                                <div style="color:#ff6600;font-weight:700;font-size:10px;margin-bottom:4px;">👻 PHANTOM${bot.cross_market ? ' <span style="background:linear-gradient(135deg,#ff006620,#00aaff20);color:#00ddff;border:1px solid #00aaff44;border-radius:3px;padding:0 4px;font-size:8px;font-weight:800;letter-spacing:.05em;">✕ CROSS</span>' : ''} · ${dogSide.toUpperCase()}</div>
                                ${rungsHtml}
                            </div>
                            <div style="opacity:${isFavWaiting ? '0.4' : '1'};transition:opacity .5s;">
                                <div style="display:flex;justify-content:space-between;color:${isFavWaiting ? '#555' : '#8892a6'};margin-bottom:3px;">
                                    <span>🔒 FAV ${favSide.toUpperCase()} @ <strong style="color:${isFavWaiting ? favColor + '44' : favColor};">${favPrice}¢</strong>${bot.cross_market && bot.hedge_ticker ? ` <span style="color:#00ddff;font-size:8px;">→ ${(bot.hedge_ticker||'').split('-').pop()}</span>` : ''}</span>
                                    <span>${isFavWaiting ? 'PENDING' : (favFill >= hedgeQty ? `${favFill}/${hedgeQty} ✓` : `${favFill}/${hedgeQty}`)}</span>
                                </div>
                                <div style="height:6px;background:#1e2740;border-radius:3px;overflow:hidden;">
                                    <div style="height:100%;width:${favPct}%;background:${favFill >= hedgeQty ? favColor : favColor + '66'};border-radius:3px;transition:width .5s;"></div>
                                </div>
                            </div>`;
                        }

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
                    ${isAnchorLadder
                      ? `<span>Target: <strong style="color:#ff6600;">+${bot.target_width || profit}¢</strong></span>
                         <span>Rungs: <strong style="color:#8892a6;">${(bot.rungs||[]).length}</strong></span>
                         <span>Bounce: <strong style="color:#8892a6;">+${bot.bounce_threshold || 2}¢</strong></span>
                         <span>Hedge: <strong style="color:#8892a6;">${bot.hedge_timeout_s || 120}s</strong></span>
                         <span style="color:#ff6600;">🪜 Ladder</span>`
                      : isAnchorDog
                      ? `<span>Target: <strong style="color:#ffaa00;">+${bot.target_width || profit}¢</strong></span>
                         <span>Dog: <strong style="color:#8892a6;">${bot.dog_price || '?'}¢</strong></span>
                         <span>Hedge: <strong style="color:#8892a6;">${bot.hedge_timeout_s || 120}s</strong></span>
                         <span style="color:#ffaa00;">🎯 Anchor-Dog</span>`
                      : `<span>Width: <strong style="color:#00aaff;">${profit}¢</strong></span>
                         <span>Cost: <strong style="color:#8892a6;">$${((100 - profit) * qty / 100).toFixed(2)}</strong></span>
                         <span>Payout: <strong style="color:#00ff88;">$${(qty).toFixed(2)}</strong></span>`
                    }
                    <span title="If one leg fills but other doesn't within timeout, exit at market">⏱ ${bot.timeout_min || 2}m exit</span>
                    <span>${phase === 'live' ? '🔴 Live' : '⏳ Patient'}</span>
                </div>
                ${stopLossInfo}
                ${(() => {
                    // Run history for Regular Arb bots (non-Apex, non-Phantom)
                    if (isLadderArb || isAnchorDog || isAnchorLadder) return '';
                    const runHist = bot._run_history || [];
                    const ltPnl = bot.lifetime_pnl ?? bot.net_pnl_cents ?? 0;
                    if (runHist.length === 0 && ltPnl === 0) return '';
                    let html = '';
                    if (runHist.length > 0) {
                        html += '<div style="margin-top:6px;border-top:1px solid #1e2740;padding-top:4px;">';
                        html += runHist.map((r, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 6px;${i > 0 ? 'border-top:1px solid #1e274033;' : ''}font-size:10px;">
                            <span style="color:#555;font-weight:600;">#${r.run || i + 1}</span>
                            <span style="color:#8892a6;">Y${r.dog_price || r.yes_price || '?'}¢ + N${r.fav_price || r.no_price || '?'}¢</span>
                            <span style="color:#8892a6;">x${r.qty || bot.quantity || 1}</span>
                            <span style="color:${(r.pnl||0) >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">${(r.pnl||0) >= 0 ? '+' : ''}${r.pnl||0}¢</span>
                        </div>`).join('');
                        html += '</div>';
                    }
                    if (ltPnl !== 0 || runHist.length > 0) {
                        html += `<div style="text-align:center;padding:3px 6px;margin-top:4px;font-size:10px;"><span style="color:${ltPnl >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">Total P&L: ${ltPnl >= 0 ? '+' : ''}${ltPnl}¢</span></div>`;
                    }
                    return html;
                })()}
                ${waitRepeatInfo}
                ${driftInfo}
                <div style="text-align:right;font-size:9px;color:#444;margin-top:4px;">${bot.created_at ? new Date(bot.created_at * 1000).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : ''} · ${createdMin}m</div>`;
            botsList.appendChild(item);
            });  // end groupBots.forEach
        });  // end sortedGameKeys.forEach

        _botsAnchored = anchoredCount;
        _botsActive   = activeBotCount;
        _botHealth    = anchoredHealthBuckets;
        const badge = document.getElementById('anchored-badge');
        if (badge) badge.innerHTML = _buildAnchoredBadgeHTML();
        updateBotBuddy(activeBotCount, filledLegs);
        updateBotsBadge(activeBotCount + dogBotIds.length);
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
    setBuddyOutfit(botsTabMode || 'arb');
    buddyMonitorStart = Date.now();
    buddyMonitorCycles = 0;
    monitorBots();
}

// ── Bot Detail Modal ────────────────────────────────────────────
function closeBotDetail() { document.getElementById('bot-detail-modal').classList.remove('show'); }

async function showBotDetail(botId) {
    const modal = document.getElementById('bot-detail-modal');
    const content = document.getElementById('bd-content');
    const title = document.getElementById('bd-title');
    const subtitle = document.getElementById('bd-subtitle');
    const icon = document.getElementById('bd-icon');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:#8892a6;">Loading...</div>';
    modal.classList.add('show');

    try {
        // Fetch bot detail + activity log in parallel
        const [botResp, logResp] = await Promise.all([
            fetch(`${API_BASE}/bot/list`).then(r => r.json()),
            fetch(`${API_BASE}/activity-log?bot_id=${encodeURIComponent(botId)}&minutes=1440&limit=50`).then(r => r.json()).catch(() => ({events:[]})),
        ]);
        const bots = botResp.bots || {};
        const bot = bots[botId];
        if (!bot) { content.innerHTML = '<div style="color:#ff4444;padding:20px;">Bot not found</div>'; return; }

        const cat = bot.bot_category || bot.type || 'arb';
        const typeMap = {anchor_dog:'Phantom',anchor_ladder:'Phantom Ladder',ladder_arb:'Apex',watch:'Scout',middle:'Meridian',arb:'Arb',both_posted:'Arb'};
        const colorMap = {anchor_dog:'#ff9900',anchor_ladder:'#ff9900',ladder_arb:'#00d4ff',watch:'#00ff88',middle:'#cc66ff',arb:'#00d4ff'};
        const iconMap = {anchor_dog:'👻',anchor_ladder:'👻',ladder_arb:'△',watch:'💰',middle:'🔀',arb:'⚡'};
        const typeName = typeMap[cat] || cat;
        const color = colorMap[cat] || '#00d4ff';
        const statusDisplayMap = {
            ladder_arb_posted: 'Both Live', ladder_arb_active: 'Active', ladder_arb_yes_filled: 'YES Filled',
            ladder_arb_no_filled: 'NO Filled', apex_selling_back: 'Selling Back', awaiting_settlement: '⏳ Settlement',
            completed: 'Completed', stopped: 'Stopped', waiting_repeat: 'Waiting Repeat',
            anchor_posted: 'Anchor Posted', anchor_filled: 'Anchor Filled',
            hedge_posted: 'Hedge Posted', hedge_filled: 'Hedge Filled',
        };
        const displayStatus = statusDisplayMap[bot.status] || bot.status || '?';
        title.textContent = formatBotDisplayName(bot.ticker, bot.spread_line);
        subtitle.textContent = `${typeName} · ${displayStatus}`;
        subtitle.style.color = color;
        icon.textContent = iconMap[cat] || '⚡';

        let html = '';
        const nowSec = Date.now() / 1000;
        const ageMin = bot.created_at ? Math.round((nowSec - bot.created_at) / 60) : 0;
        const ageStr = ageMin >= 60 ? `${Math.floor(ageMin/60)}h ${ageMin%60}m` : `${ageMin}m`;
        const qty = bot.quantity || bot.qty || 1;

        // ── Computed fields ──
        const isApex = cat === 'ladder_arb';
        const isPhantom = cat === 'anchor_dog' || cat === 'anchor_ladder';
        const isMeridian = cat === 'middle';
        const isScout = cat === 'watch';
        const filledSide = bot.first_fill_side || '';
        const unfilledSide = filledSide === 'yes' ? 'no' : 'yes';
        const avgFilled = bot[`avg_${filledSide}_price`] || 0;
        const hedgePrice = bot.hedge_price || bot.fav_price || 0;
        const combined = isApex ? (avgFilled + hedgePrice) : isPhantom ? ((bot.dog_price||0) + (bot.fav_price||0)) : ((bot.yes_price||0) + (bot.no_price||0));
        const profit = combined > 0 ? 100 - combined : 0;
        const walkCount = bot.walk_count || bot.fav_walk_count || 0;
        const walkInterval = bot._walk_interval != null ? bot._walk_interval : 20;
        const urgency = bot._game_urgency || 'normal';
        const gamePhase = bot.game_phase || '?';
        const hedgeFills = bot._hedge_fill_count || bot.fav_fill_qty || 0;
        const hedgeQty = bot.hedge_qty || qty;
        const yFills = bot.filled_yes_qty || bot.yes_fill_qty || 0;
        const nFills = bot.filled_no_qty || bot.no_fill_qty || 0;
        const netPnl = bot.net_pnl_cents || 0;
        const repeatsDone = bot.repeats_done || 0;
        const repeatsTotal = bot.repeat_count || 0;

        // ── Overview: 4-column top stats ──
        html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:12px;">`;
        const _statBox = (label, value, valColor='#fff') => `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:8px 6px;text-align:center;">
            <div style="color:#8892a6;font-size:8px;text-transform:uppercase;margin-bottom:3px;">${label}</div>
            <div style="color:${valColor};font-weight:700;font-size:11px;">${value}</div></div>`;
        html += _statBox('Status', displayStatus, color);
        html += _statBox('Age', ageStr);
        html += _statBox('Qty', `×${qty}`);
        const combinedColor = combined <= 0 ? '#555' : combined <= 96 ? '#00ff88' : combined <= 98 ? '#ffaa00' : '#ff4444';
        html += _statBox('Combined', combined > 0 ? `${combined}¢` : '—', combinedColor);
        html += `</div>`;

        // ── P&L + Fill Progress bar ──
        const isFilled = isApex ? (yFills > 0 || nFills > 0) : isPhantom ? (bot.dog_fill_qty > 0) : false;
        if (isFilled || netPnl !== 0) {
            const profitColor = profit > 3 ? '#00ff88' : profit > 0 ? '#ffaa00' : '#ff4444';
            const pnlColor = netPnl > 0 ? '#00ff88' : netPnl < 0 ? '#ff4444' : '#8892a6';
            const fillPct = hedgeQty > 0 ? Math.min(100, Math.round((hedgeFills / hedgeQty) * 100)) : 0;
            html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">`;
            html += `<div style="font-size:10px;font-weight:700;color:#8892a6;">POSITION</div>`;
            if (netPnl !== 0) html += `<div style="font-size:11px;font-weight:700;color:${pnlColor};">${netPnl > 0 ? '+' : ''}${(netPnl/100).toFixed(2)}</div>`;
            html += `</div>`;
            html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:10px;margin-bottom:8px;">`;
            if (isApex) {
                html += `<div><span style="color:#8892a6;">Anchor:</span> <strong style="color:#ff9900;">${avgFilled}¢ × ${filledSide === 'yes' ? yFills : nFills}</strong></div>`;
                html += `<div><span style="color:#8892a6;">Hedge:</span> <strong style="color:#00aaff;">${hedgePrice}¢ × ${hedgeFills}/${hedgeQty}</strong></div>`;
                html += `<div><span style="color:#8892a6;">Profit/c:</span> <strong style="color:${profitColor};">${profit > 0 ? '+' : ''}${profit}¢</strong></div>`;
            } else if (isPhantom) {
                html += `<div><span style="color:#8892a6;">Dog (${bot.dog_side||'?'}):</span> <strong style="color:#ff9900;">${bot.dog_price||'?'}¢</strong></div>`;
                html += `<div><span style="color:#8892a6;">Fav:</span> <strong style="color:#00ff88;">${bot.fav_price||'—'}¢</strong></div>`;
                html += `<div><span style="color:#8892a6;">Profit/c:</span> <strong style="color:${profitColor};">${profit > 0 ? '+' : ''}${profit}¢</strong></div>`;
            }
            html += `</div>`;
            // Hedge fill progress bar
            if (hedgeQty > 0 && (isApex || isPhantom)) {
                html += `<div style="display:flex;align-items:center;gap:8px;">`;
                html += `<span style="color:#8892a6;font-size:9px;width:70px;">Hedge fill:</span>`;
                html += `<div style="flex:1;height:6px;background:#1a2540;border-radius:3px;overflow:hidden;">
                    <div style="width:${fillPct}%;height:100%;background:${fillPct>=100?'#00ff88':fillPct>0?'#ffaa00':'#333'};border-radius:3px;transition:width 0.3s;"></div></div>`;
                html += `<span style="color:${fillPct>=100?'#00ff88':'#8892a6'};font-size:10px;font-weight:700;width:50px;text-align:right;">${hedgeFills}/${hedgeQty}</span>`;
                html += `</div>`;
            }
            html += `</div>`;
        }

        // ── Time-Decay Status (Apex 2.0) / Walk Status (legacy) ──
        if (isApex) {
            html += `<div style="background:#0a0e1a;border:1px solid #00aaff33;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="color:#00aaff;font-size:10px;font-weight:700;margin-bottom:6px;">TIME-DECAY EXIT</div>`;
            html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:10px;">`;
            html += `<div><span style="color:#00ff88;">●</span> Profit <strong>0-15s</strong></div>`;
            html += `<div><span style="color:#ffaa00;">●</span> Scratch <strong>15-30s</strong></div>`;
            html += `<div><span style="color:#ff4444;">●</span> Panic <strong>30s+</strong></div>`;
            html += `</div>`;
            html += `<div style="color:#555;font-size:9px;margin-top:4px;">Drift threshold: 3¢ adverse → escalate · Panic exit: maker at bid (bid+1 if gapped)</div>`;
            html += `</div>`;
        } else if (walkCount > 0 || urgency !== 'normal') {
            const urgColors = {normal:'#8892a6', late:'#ff8800', critical:'#ff4444', halftime:'#818cf8'};
            const urgLabels = {normal:'NORMAL', late:'LATE GAME', critical:'CRITICAL', halftime:'HALFTIME'};
            html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">`;
            html += `<div style="font-size:10px;font-weight:700;color:#8892a6;">WALK STATUS</div>`;
            html += `<div style="font-size:9px;font-weight:700;color:${urgColors[urgency]||'#8892a6'};background:${urgColors[urgency]||'#8892a6'}22;padding:2px 6px;border-radius:3px;">${urgLabels[urgency]||urgency}</div>`;
            html += `</div>`;
            html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:10px;">`;
            html += `<div><span style="color:#8892a6;">Steps:</span> <strong>${walkCount}</strong></div>`;
            html += `<div><span style="color:#8892a6;">Interval:</span> <strong>${walkInterval}s</strong></div>`;
            html += `<div><span style="color:#8892a6;">Phase:</span> <strong>${gamePhase}</strong></div>`;
            html += `</div></div>`;
        }

        // ── Latency section (Phantom/Apex) ──
        const rawMs = bot.raw_hedge_ms || bot.hedge_latency_ms;
        const fillMs = bot.hedge_fill_latency_ms;
        if (rawMs || fillMs) {
            html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="color:#ffaa00;font-size:10px;font-weight:700;margin-bottom:6px;">LATENCY</div>`;
            html += `<div style="display:flex;gap:20px;font-size:11px;">`;
            if (rawMs) html += `<div><span style="color:#8892a6;">Hedge posted:</span> <strong style="color:${rawMs < 50 ? '#00ff88' : rawMs < 200 ? '#ffaa00' : '#ff4444'};">${rawMs}ms</strong></div>`;
            if (fillMs) html += `<div><span style="color:#8892a6;">Hedge filled:</span> <strong style="color:${fillMs < 500 ? '#00ff88' : fillMs < 2000 ? '#ffaa00' : '#ff4444'};">${fillMs}ms</strong></div>`;
            html += `</div></div>`;
        }

        // ── Prices section ──
        html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
        html += `<div style="color:#8892a6;font-size:10px;font-weight:700;margin-bottom:6px;">PRICES</div>`;
        if (isPhantom) {
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">`;
            html += `<div>Dog (${bot.dog_side||'?'}): <strong style="color:#ff9900;">${bot.dog_price||'?'}¢</strong></div>`;
            html += `<div>Fav: <strong style="color:#00ff88;">${bot.fav_price||'pending'}¢</strong></div>`;
            html += `<div>Width: <strong>${bot.target_width||'?'}¢</strong></div>`;
            html += `<div>Ceiling: <strong>98¢</strong> <span style="color:#555;">(${98-combined}¢ left)</span></div>`;
            html += `<div>Anchor depth: <strong>${bot.anchor_depth||'?'}¢</strong></div>`;
            html += `<div>Timeout: <strong>${bot.hedge_timeout_s||120}s</strong></div>`;
            html += `</div>`;
        } else if (isScout) {
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">`;
            html += `<div>Entry: <strong style="color:#fff;">${bot.entry_price||'?'}¢</strong></div>`;
            html += `<div>Live bid: <strong style="color:#00ff88;">${bot.live_bid||'?'}¢</strong></div>`;
            html += `<div>SL: <strong style="color:#ff4444;">${(bot.entry_price||50) - (bot.stop_loss_cents||5)}¢</strong></div>`;
            if (bot.take_profit_cents > 0) html += `<div>TP: <strong style="color:#00ff88;">${(bot.entry_price||50) + bot.take_profit_cents}¢</strong></div>`;
            html += `</div>`;
        } else if (isApex) {
            const rungWidths = (bot.rungs || []).map(r => r.width).filter(Boolean);
            const widthRange = rungWidths.length > 1 ? `${Math.min(...rungWidths)}-${Math.max(...rungWidths)}¢` : rungWidths.length === 1 ? `${rungWidths[0]}¢` : '?';
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">`;
            html += `<div>Widths: <strong>${widthRange}</strong> (${rungWidths.length} rungs)</div>`;
            html += `<div>Phase: <strong>${gamePhase}</strong></div>`;
            if (repeatsTotal > 0) html += `<div>Repeats: <strong>${repeatsDone}/${repeatsTotal}</strong></div>`;
            if (bot.repost_count) html += `<div>Reposts: <strong style="color:#ff8800;">${bot.repost_count}</strong></div>`;
            html += `</div>`;
        } else {
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">`;
            html += `<div>YES: <strong style="color:#00ff88;">${bot.yes_price||'?'}¢</strong></div>`;
            html += `<div>NO: <strong style="color:#ff4444;">${bot.no_price||'?'}¢</strong></div>`;
            const total = (bot.yes_price||0) + (bot.no_price||0);
            if (total > 0) html += `<div>Spread: <strong>${100-total}¢</strong></div>`;
            html += `</div>`;
        }
        html += `</div>`;

        // ── Live Market Data ──
        const yBid = bot.live_yes_bid, yAsk = bot.live_yes_ask, nBid = bot.live_no_bid, nAsk = bot.live_no_ask;
        if (yBid || nBid) {
            html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="color:#8892a6;font-size:10px;font-weight:700;margin-bottom:6px;">LIVE MARKET</div>`;
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:10px;">`;
            html += `<div>YES: <span style="color:#00ff88;">${yBid||'?'}¢</span> / <span style="color:#8892a6;">${yAsk||'?'}¢</span> <span style="color:#555;">(${(yAsk&&yBid)?(yAsk-yBid):0}¢ spread)</span></div>`;
            html += `<div>NO: <span style="color:#ff4444;">${nBid||'?'}¢</span> / <span style="color:#8892a6;">${nAsk||'?'}¢</span> <span style="color:#555;">(${(nAsk&&nBid)?(nAsk-nBid):0}¢ spread)</span></div>`;
            if (yBid && nBid) html += `<div>Bid sum: <strong>${yBid+nBid}¢</strong></div>`;
            html += `</div></div>`;
        }

        // ── Rungs section (Apex 2.0 / Phantom Ladder) ──
        const rungs = bot.rungs || bot.placed_rungs;
        if (isApex && rungs && rungs.length > 0) {
            const stageColors = { profit:'#00ff88', scratch:'#ffaa00', panic:'#ff4444' };
            const stageLabels = { profit:'PROFIT', scratch:'SCRATCH', panic:'PANIC', posted:'POSTED', completed:'DONE', anchor_filled:'FILLING' };
            html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="color:#8892a6;font-size:10px;font-weight:700;margin-bottom:6px;">RUNGS (${rungs.length})</div>`;
            html += `<div style="font-size:10px;">`;
            rungs.forEach((r, i) => {
                const rs = r.status || 'posted';
                const w = r.width || '?';
                const sl = r.stop_loss_cents || _apexStopLossThreshold(w);
                const stage = r.time_stage || rs;
                const sCol = stageColors[stage] || '#8892a6';
                const sLabel = stageLabels[stage] || rs.toUpperCase();
                const isDone = rs === 'completed' || r._profit_recorded;
                const dim = isDone ? 'opacity:0.35;' : '';
                let pnlStr = '';
                if (isDone) {
                    const aS = r.anchor_side || 'yes';
                    const aP = r[`${aS}_price`] || 0;
                    const hP = r.hedge_price || 0;
                    const prof = (aP + hP > 0) ? 100 - aP - hP : 0;
                    const pCol = prof > 0 ? '#00ff88' : prof < 0 ? '#ff4444' : '#555';
                    pnlStr = `<span style="color:${pCol};font-weight:700;">${prof > 0 ? '+' : ''}${prof}¢</span>`;
                }
                html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;${dim}">
                    <span style="color:#555;width:16px;">#${i+1}</span>
                    <span style="color:#ffaa00;font-weight:700;width:28px;">${w}¢</span>
                    <span style="color:#ff444466;font-size:9px;width:28px;">SL${sl}</span>
                    <span style="background:${sCol}22;color:${sCol};font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;width:55px;text-align:center;">${sLabel}</span>
                    <span style="flex:1;"></span>
                    ${pnlStr}
                </div>`;
            });
            html += `</div></div>`;
        } else if (rungs && rungs.length > 0) {
            html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
            html += `<div style="color:#8892a6;font-size:10px;font-weight:700;margin-bottom:6px;">RUNGS (${rungs.length})</div>`;
            html += `<div style="font-size:10px;">`;
            rungs.forEach((r, i) => {
                const fillKey = cat === 'anchor_ladder' ? 'fill_qty' : (bot.first_fill_side === 'yes' ? 'yes_fill_qty' : 'no_fill_qty');
                const filled = r[fillKey] || r.fill_qty || 0;
                const rQty = r.quantity || r.qty || qty;
                const pct = rQty > 0 ? Math.round((filled/rQty)*100) : 0;
                const priceLabel = r.width ? `${r.width}¢ wide` : `${r.price||r.yes_price||'?'}¢`;
                const completedBadge = r.completed ? ' <span style="color:#00ff88;">✓</span>' : '';
                html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                    <span style="color:#555;width:16px;">#${i+1}</span>
                    <span style="width:70px;">${priceLabel}${completedBadge}</span>
                    <div style="flex:1;height:4px;background:#1a2540;border-radius:2px;overflow:hidden;">
                        <div style="width:${pct}%;height:100%;background:${pct>=100?'#00ff88':'#ffaa00'};border-radius:2px;"></div>
                    </div>
                    <span style="color:${pct>=100?'#00ff88':'#8892a6'};width:40px;text-align:right;">${filled}/${rQty}</span>
                </div>`;
            });
            html += `</div></div>`;
        }

        // ── Order IDs section (collapsed by default) ──
        html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
        html += `<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('span').textContent=this.nextElementSibling.style.display==='none'?'▸':'▾'" style="color:#8892a6;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;"><span>▸</span> ORDER IDS</div>`;
        html += `<div style="display:none;margin-top:6px;">`;
        html += `<div style="font-size:10px;font-family:monospace;color:#556;word-break:break-all;">`;
        const oidKeys = ['dog_order_id','fav_order_id','yes_order_id','no_order_id','hedge_order_id','order_id'];
        oidKeys.forEach(k => {
            if (bot[k]) html += `<div style="margin-bottom:2px;display:flex;align-items:center;gap:4px;"><span style="color:#8892a6;">${k.replace(/_/g,' ')}:</span> <span style="color:#556;">${bot[k].slice(-12)}</span><button onclick="event.stopPropagation();navigator.clipboard.writeText('${bot[k]}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:8px;padding:0;color:#3a4560;" title="Copy full ID: ${bot[k]}">📋</button></div>`;
        });
        html += `<div style="margin-top:4px;display:flex;align-items:center;gap:4px;"><span style="color:#8892a6;">bot_id:</span> <span style="color:#556;">${botId.slice(-12)}</span><button onclick="event.stopPropagation();navigator.clipboard.writeText('${botId}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:8px;padding:0;color:#3a4560;" title="Copy full ID: ${botId}">📋</button></div>`;
        html += `</div></div></div>`;

        // ── Activity Log section (collapsed by default) ──
        const events = logResp.events || logResp.log || [];
        html += `<div style="background:#0a0e1a;border:1px solid #1e2740;border-radius:8px;padding:10px 14px;margin-bottom:12px;">`;
        html += `<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('span').textContent=this.nextElementSibling.style.display==='none'?'▸':'▾'" style="color:#ffaa00;font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;"><span>▸</span> EVENT LOG (${events.length})</div>`;
        html += `<div style="display:none;margin-top:6px;">`;
        if (events.length === 0) {
            html += `<div style="color:#555;font-size:10px;">No events found</div>`;
        } else {
            html += `<div style="max-height:300px;overflow-y:auto;font-size:10px;">`;
            events.slice(0, 50).forEach(evt => {
                const ts = evt.timestamp ? new Date(evt.timestamp * 1000).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'}) : '';
                const evtName = evt.event || evt.type || '?';
                const evtColor = evtName.includes('ERROR') || evtName.includes('FAIL') ? '#ff4444' :
                    evtName.includes('FILL') || evtName.includes('COMPLETE') || evtName.includes('SELLBACK') ? '#00ff88' :
                    evtName.includes('REPOST') || evtName.includes('WALK') ? '#ffaa00' : '#8892a6';
                const evtData = evt.data || {};
                // Format key data fields instead of raw JSON
                const keyFields = [];
                if (evtData.walk_type) keyFields.push(evtData.walk_type);
                if (evtData.old_price != null && evtData.new_price != null) keyFields.push(`${evtData.old_price}→${evtData.new_price}¢`);
                if (evtData.urgency && evtData.urgency !== 'normal') keyFields.push(evtData.urgency);
                if (evtData.walk_interval != null) keyFields.push(`${evtData.walk_interval}s`);
                if (evtData.dog_price) keyFields.push(`dog:${evtData.dog_price}¢`);
                if (evtData.fav_bid) keyFields.push(`fav:${evtData.fav_bid}¢`);
                if (evtData.combined) keyFields.push(`comb:${evtData.combined}¢`);
                if (evtData.loss_cents) keyFields.push(`-${evtData.loss_cents}¢`);
                if (evtData.profit_cents) keyFields.push(`+${evtData.profit_cents}¢`);
                if (evtData.error) keyFields.push(String(evtData.error).slice(0,60));
                const dataStr = keyFields.length > 0 ? keyFields.join(' · ') : JSON.stringify(evtData).slice(0,80);
                html += `<div style="display:flex;gap:6px;padding:2px 0;border-bottom:1px solid #111;">
                    <span style="color:#555;min-width:60px;flex-shrink:0;">${ts}</span>
                    <span style="color:${evtColor};font-weight:600;min-width:100px;flex-shrink:0;font-size:9px;">${evtName}</span>
                    <span style="color:#667;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;">${dataStr}</span>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div></div>`;

        // ── Ticker link ──
        html += `<div style="text-align:center;font-size:10px;color:#555;">
            <a href="#" onclick="navigateToMarket('${(bot.ticker||'').toUpperCase().split('-').slice(0,2).join('-')}');closeBotDetail();return false;" style="color:#00d4ff;">View in Meridian</a>
            · <a href="https://kalshi.com/markets/${(bot.ticker||'').split('-')[0]}/${bot.ticker||''}" target="_blank" style="color:#8892a6;">Kalshi ↗</a>
        </div>`;

        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = `<div style="color:#ff4444;padding:20px;">Error: ${e.message}</div>`;
    }
}

// Smart stop for Apex: stop after current cycle completes
async function smartStopApex(botId) {
    if (!confirm('Stop smart mode after this cycle completes?')) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/smart-stop/${botId}`, { method: 'POST' });
        const data = await resp.json();
        if (data.success) showNotification('⏹ Smart stop queued — will stop after this cycle');
        else showNotification(`Error: ${data.error}`, 'error');
    } catch (e) { showNotification(`Error: ${e.message}`, 'error'); }
}

// Manual snap: cancel hedge and repost at bid+1 for immediate fill
async function snapRung(botId, rungIdx) {
    try {
        const resp = await fetch(`${API_BASE}/bot/snap/${botId}/${rungIdx}`, { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
            showNotification(`⚡ Snapped rung #${rungIdx + 1} → ${data.snap_price}¢`);
        } else {
            showNotification(`Snap failed: ${data.error}`, 'error');
        }
    } catch (e) {
        showNotification(`Snap error: ${e.message}`, 'error');
    }
}

// Add runs to a non-smart bot (prompts for count)
async function addRuns(botId) {
    const countStr = prompt('How many runs to add?', '3');
    if (!countStr) return;
    const count = parseInt(countStr);
    if (!count || count < 1) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/add-runs/${botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`+${count} runs added (${data.new_repeat_count - data.repeats_done} remaining)`, 'success');
        } else {
            showNotification(data.error || 'Failed to add runs', 'error');
        }
    } catch (e) {
        showNotification('Failed to add runs: ' + e.message, 'error');
    }
}

// Cancel bot
// Restart a smart-mode bot (no prompt, just restart)
async function restartSmart(botId) {
    try {
        const resp = await fetch(`${API_BASE}/bot/add-runs/${botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 0 }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification('Smart mode restarted', 'success');
        } else {
            showNotification(data.error || 'Failed to restart', 'error');
        }
    } catch (e) {
        showNotification('Failed to restart: ' + e.message, 'error');
    }
}

async function stopSmart(botId) {
    if (!confirm('Stop smart mode? If dog is already filled, current cycle will finish first.')) return;
    try {
        const resp = await fetch(`${API_BASE}/bot/stop-smart/${botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(data.message || 'Smart mode stopping', 'success');
        } else {
            showNotification(data.error || 'Failed to stop', 'error');
        }
        loadBots();
    } catch (e) {
        showNotification('Failed to stop: ' + e.message, 'error');
    }
}

function smartExitMenu(botId) {
    // Show modal overlay — body-level so loadBots() can't destroy it
    const existing = document.getElementById('smart-exit-overlay');
    if (existing) { existing.remove(); window._smartExitMenuOpen = false; return; }
    window._smartExitMenuOpen = true;
    const bot = window._lastBotsData?.[botId] || {};
    const dogTeam = (bot.ticker || '').split('-').pop();
    const favTeam = (bot.hedge_ticker || '').split('-').pop();
    const dogSide = bot.dog_side || 'no';
    const favSide = bot.fav_side || (dogSide === 'yes' ? 'no' : 'yes');
    // For cross-market: determine loser by current bid (lower bid = loser to sell)
    const dogBidSE = dogSide === 'yes' ? (bot.live_yes_bid || 0) : (bot.live_no_bid || 0);
    const favBidSE = favSide === 'yes' ? (bot.live_hedge_yes_bid || 0) : (bot.live_hedge_no_bid || 0);
    // Determine loser: lower bid = loser. If one side has no data (0), it's the loser.
    const dogIsLoser = favBidSE > 0 ? (dogBidSE <= favBidSE) : false;
    const sellTeam = dogIsLoser ? dogTeam : favTeam;
    const holdTeam = dogIsLoser ? favTeam : dogTeam;
    const sellBid = dogIsLoser ? dogBidSE : favBidSE;
    const holdBid = dogIsLoser ? favBidSE : dogBidSE;
    const overlay = document.createElement('div');
    overlay.id = 'smart-exit-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:#0d1117;border:1px solid #64ffda44;border-radius:12px;padding:20px;min-width:260px;max-width:320px;box-shadow:0 8px 24px rgba(0,0,0,.7);">
            <div style="color:#64ffda;font-size:12px;font-weight:700;margin-bottom:8px;text-align:center;">SMART EXIT</div>
            <div style="display:flex;justify-content:center;gap:12px;margin-bottom:6px;font-size:11px;">
                <span style="color:#ff4444;font-weight:700;">📉 SELL: ${sellTeam} · ${sellBid}¢</span>
            </div>
            <div style="display:flex;justify-content:center;gap:12px;margin-bottom:12px;font-size:11px;">
                <span style="color:#00ff88;font-weight:700;">💎 HOLD: ${holdTeam} · ${holdBid}¢</span>
            </div>
            <button onclick="smartExitNow('${botId}')" style="display:block;width:100%;background:#64ffda22;color:#64ffda;border:1px solid #64ffda44;border-radius:8px;padding:10px;font-size:13px;cursor:pointer;font-weight:700;margin-bottom:10px;">Sell ${sellTeam} Now</button>
            <div style="color:#8892a6;font-size:10px;margin-bottom:8px;text-align:center;">Or auto-sell when loser bid drops to:</div>
            <div style="display:flex;gap:6px;margin-bottom:12px;">
                ${[3, 5, 8, 10, 15].map(p => `<button onclick="setSmartExitTrigger('${botId}', ${p})" style="flex:1;background:#1a2540;color:#fff;border:1px solid #333;border-radius:6px;padding:8px 4px;font-size:12px;cursor:pointer;font-weight:600;">${p}¢</button>`).join('')}
            </div>
            <button onclick="document.getElementById('smart-exit-overlay').remove(); window._smartExitMenuOpen=false;" style="display:block;width:100%;background:transparent;color:#555;border:1px solid #333;border-radius:8px;padding:8px;font-size:11px;cursor:pointer;">Cancel</button>
        </div>
    `;
    // Click backdrop to close
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); window._smartExitMenuOpen = false; } });
    document.body.appendChild(overlay);
}

async function smartExitNow(botId) {
    if (!confirm('Sell the losing side at market now?')) return;
    const _seo = document.getElementById('smart-exit-overlay');
    if (_seo) _seo.remove();
    window._smartExitMenuOpen = false;
    try {
        const resp = await fetch(`${API_BASE}/bot/smart-exit/${botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await resp.json();
        if (data.success) {
            const loser = (data.loser_ticker || '').split('-').pop();
            showNotification(`Sold ${data.qty}x ${loser} @ ${data.sell_price}¢ — holding winner for settlement`, 'success');
        } else {
            showNotification(data.error || 'Smart exit failed', 'error');
        }
        loadBots();
    } catch (e) {
        showNotification('Smart exit failed: ' + e.message, 'error');
    }
}

async function setSmartExitTrigger(botId, price) {
    const _seo = document.getElementById('smart-exit-overlay');
    if (_seo) _seo.remove();
    window._smartExitMenuOpen = false;
    try {
        const resp = await fetch(`${API_BASE}/bot/smart-exit-trigger/${botId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger_price: price }),
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`Auto exit set: sell loser when bid ≤ ${price}¢`, 'success');
        } else {
            showNotification(data.error || 'Failed to set trigger', 'error');
        }
        loadBots();
    } catch (e) {
        showNotification('Failed: ' + e.message, 'error');
    }
}

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
            // Awaiting settlement — bot stays alive, don't delete
            if (data.awaiting_settlement) {
                const heldY = data.held_yes || 0;
                const heldN = data.held_no  || 0;
                alert(`⏳ Bot set to AWAITING SETTLEMENT\n\nPositions still held on Kalshi:\n${heldY > 0 ? `  YES: ${heldY} contracts\n` : ''}${heldN > 0 ? `  NO: ${heldN} contracts\n` : ''}\nThe bot will stay supervised and settle automatically.`);
                loadBots();
                return;
            }

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

// Emergency exit — cancel/sell ALL bots for a game group (bulk endpoint)
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
    if (!confirm(`🚨 EMERGENCY EXIT\n\nThis will cancel and amend-exit ALL ${botIds.length} active bot(s) for this game.\n\nFilled positions will be amended to close. This cannot be undone.\n\nContinue?`)) return;

    showNotification(`🚨 Exiting ${botIds.length} bot(s)...`);
    try {
        const resp = await fetch(`${API_BASE}/bot/cancel-bulk`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({bot_ids: botIds})
        });
        const data = await resp.json();
        if (data.success) {
            let msg = `🚨 Emergency exit: ${data.ok} cancelled · ${data.fail} failed`;
            if (data.orphan_sweep) {
                const sw = data.orphan_sweep;
                msg += ` · 🧹 ${sw.cancelled_count} orphaned order(s) swept`;
                if (sw.failed_count > 0) msg += ` (${sw.failed_count} sweep failures)`;
            }
            showNotification(msg);
            if (data.fail > 0) alert(`⚠️ ${data.fail} bot(s) failed to cancel. Check your positions on Kalshi.`);
        } else {
            showNotification(`🚨 Emergency exit failed: ${data.error || 'unknown error'}`);
        }
    } catch (e) {
        showNotification(`🚨 Emergency exit error: ${e.message}`);
    }
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
        `<strong>Offline.</strong> Hit Auto-Monitor and I'll run the whole show`,
        `<strong>Sleeping...</strong> Wake me up — these markets won't trade themselves 🥱`,
        `<strong>Standing by</strong> — your bots aren't being watched right now`,
        `<strong>Nothing to do...</strong> I live for this, just press the button`,
        `<strong>Bench mode.</strong> Put me in coach, I'm ready`,
        `<strong>Idle.</strong> One click and I'm on every orderbook simultaneously`,
    ],
    scanning: [
        `<strong>On it.</strong> Checking fills every 2 seconds — nothing slips past me`,
        `<strong>Locked in</strong> — WebSocket + REST double-watching everything 🔍`,
        `<strong>Patrolling</strong> — DriftGuard, amend retries, repost logic all active`,
        `<strong>Steady.</strong> Watching spreads, queuing reposts, tracking timeouts`,
        `<strong>Eyes open.</strong> I'll catch the fill before you even look up`,
        `<strong>Working.</strong> Apex, Phantom, middles, bets — all monitored`,
        `<strong>All systems green</strong> — keeping your orders fresh and alive`,
        `<strong>Meridian active.</strong> Markets are moving — I'm right here`,
    ],
    both_posted: [
        `<strong>△ Both sides live.</strong> YES and NO resting — first fill starts the clock`,
        `<strong>Apex dual post</strong> — both legs in the book, whichever fills first I guard the other`,
        `<strong>Simultaneous mode</strong> — YES and NO both posted, timeout starts on first fill`,
        `<strong>Two orders out.</strong> Waiting for fills — I've got the timer ready`,
    ],
    fav_posted: [
        `<strong>△ Fav posted.</strong> Liquid side is in the book — other leg queued for after fill`,
        `<strong>Sequencing.</strong> Higher-bid side out first, waiting for the bite`,
        `<strong>Fav-first mode</strong> — watching for fill, then I post the other side instantly`,
        `<strong>Waiting on the fav</strong> — order's live, Apex clock starts on fill`,
    ],
    fav_filled: [
        `<strong>△ Fav filled!</strong> Posting the other side now — almost locked 🔒`,
        `<strong>Phase 2.</strong> Liquid side eaten — other leg going in right now`,
        `<strong>One leg in.</strong> Fav filled, deploying the other side. Don't touch anything`,
        `<strong>Halfway there.</strong> Other side going up — sit tight, I've got this`,
    ],
    filled: [
        `<strong>Leg filled!</strong> Holding for the other side — timeout clock running`,
        `<strong>One side in.</strong> No panic — completes naturally or via amend exit`,
        `<strong>In position.</strong> Waiting on the other leg — amend exit is the backstop`,
        `<strong>Locked in.</strong> One leg filled, watching for the other side`,
    ],
    amending: [
        `<strong>🔧 Amending order.</strong> Moving the price to match the current bid`,
        `<strong>Price adjustment.</strong> Amending the pending leg to complete the trade`,
        `<strong>Completing via amend.</strong> Price sent — waiting for Kalshi to fill it`,
        `<strong>🔧 Working on it.</strong> Amend submitted, polling for fill confirmation`,
    ],
    timeout_retry: [
        `<strong>⏳ Retrying amend.</strong> Didn't fill yet — adjusting to the new bid`,
        `<strong>Still on it.</strong> Amend retry in progress — I'll keep going until it fills`,
        `<strong>Persistence mode.</strong> Order being re-amended to fresh bid`,
        `<strong>Not giving up.</strong> Re-amending with updated price — this will fill`,
    ],
    // ── Apex-specific completions ──
    apex_win: [
        `<strong>△ APEX WIN!</strong> Both legs filled — profit locked at settlement 🎉`,
        `<strong>△ That's a W.</strong> Clean Apex fill, clean profit 💰`,
        `<strong>△ Locked in!</strong> Dual fill confirmed — collecting at settlement`,
        `<strong>△ We ate.</strong> Apex complete, profit secured. Easy money 😎`,
        `<strong>△ Apex complete!</strong> Settlement will close this out. Nice trade`,
    ],
    apex_loss: [
        `<strong>△ Apex loss.</strong> Both legs filled but fees ate the spread`,
        `<strong>△ Tough one.</strong> Apex complete at a loss — width was too tight`,
        `<strong>△ Red fill.</strong> Apex closed negative — on to the next one`,
    ],
    // ── Phantom-specific completions ──
    phantom_win: [
        `<strong>👻 PHANTOM WIN!</strong> Anchor + hedge locked — profit secured 🎉`,
        `<strong>👻 Phantom cashed.</strong> Deep anchor paid off — hedge filled clean 💰`,
        `<strong>👻 That's the play.</strong> Volatility spike → anchor fill → hedge profit`,
        `<strong>👻 Phantom complete!</strong> Patience rewarded. Love to see it`,
    ],
    phantom_loss: [
        `<strong>👻 Phantom loss.</strong> Hedge didn't cover — small hit, move on`,
        `<strong>👻 Red phantom.</strong> Anchor filled but hedge cost too much`,
        `<strong>👻 Tough break.</strong> Phantom cycle closed negative — risk managed`,
    ],
    // ── Middle bot completions ──
    middle_win: [
        `<strong>⚖️ Middle hit!</strong> Both legs filled — locked profit at settlement`,
        `<strong>⚖️ Sandwiched.</strong> Middle bot caught both sides — easy money`,
        `<strong>⚖️ Clean middle.</strong> YES and NO both in, guaranteed profit`,
    ],
    middle_loss: [
        `<strong>⚖️ Middle loss.</strong> One leg expired — taking the hit`,
        `<strong>⚖️ Incomplete middle.</strong> Only one side filled — settled negative`,
    ],
    // ── Straight bet completions ──
    bet_win: [
        `<strong>🎯 Bet won!</strong> Called it right — collecting at settlement`,
        `<strong>🎯 Winner.</strong> Straight bet paid off — nice read`,
        `<strong>🎯 That's money.</strong> Bet settled in your favor 💰`,
    ],
    bet_loss: [
        `<strong>🎯 Bet lost.</strong> Wrong side — it happens. On to the next`,
        `<strong>🎯 Tough call.</strong> Bet settled against you — risk was sized right`,
    ],
    // ── Generic celebrating (fallback) ──
    celebrating: [
        `<strong>LET'S GO!</strong> Profit locked — love when a plan comes together 🎉`,
        `<strong>That's money.</strong> Another one in the books 💰`,
        `<strong>Nailed it.</strong> Clean fill, clean profit. You're welcome 😎`,
        `<strong>Bag secured.</strong> That's what we built Meridian for`,
        `<strong>Cash.</strong> Settlement incoming — this one's a wrap 🏆`,
    ],
    loss_complete: [
        `<strong>Red close.</strong> Both sides filled but net negative — fees or slippage`,
        `<strong>Loss locked.</strong> Not every trade hits — discipline means taking the L`,
        `<strong>Negative fill.</strong> Width wasn't enough — review and adjust`,
    ],
    flip_triggered: [
        `<strong>△ Timeout amend.</strong> Timer ran out — amending to fill and complete 🛡️`,
        `<strong>△ Amend exit.</strong> Couldn't fill naturally — completing via bid amend`,
        `<strong>Clock expired.</strong> Moving to amend exit — trade will still complete`,
        `<strong>Timeout path.</strong> Amending the pending leg to settle cleanly`,
    ],
    stop_loss: [
        `<strong>Stop-loss fired.</strong> Hit the limit — exiting to protect the bag`,
        `<strong>SL triggered.</strong> Price crossed the line — sold. That's discipline`,
        `<strong>Out.</strong> Position stopped. Risk managed, next trade`,
    ],
    take_profit: [
        `<strong>🎯 Cha-ching!</strong> Take-profit hit — locking those gains`,
        `<strong>🎯 Target hit.</strong> Sold for profit. Discipline pays`,
        `<strong>🎯 TP triggered.</strong> That's why we set targets — secured at the top`,
    ],
    watching: [
        `<strong>Eyes on it</strong> — monitoring your position vs SL/TP levels`,
        `<strong>Position active</strong> — watching price movement, I'll react if needed`,
    ],
    near_flip: [
        `<strong>⚠️ Getting close...</strong> Timeout approaching — amend exit may kick in soon`,
        `<strong>Heads up.</strong> Timer winding down — watching for fill before amend`,
        `<strong>Watch this one.</strong> Close to timeout — will amend to complete if needed`,
    ],
    holding: [
        `<strong>Holding steady</strong> — one leg filled, waiting for the other side`,
        `<strong>Riding it out</strong> — this is normal. Bid moves, trade stays on track`,
        `<strong>On the bid.</strong> Hedge is tracking the market — waiting for the fill`,
        `<strong>Sitting tight.</strong> Both orders are working, just need the fill`,
        `<strong>All good.</strong> Plenty of time left — watching for the second leg`,
    ],
    profitable: [
        `<strong>Looking good!</strong> Session is in the green — let's keep it going 📈`,
        `<strong>Making money.</strong> Strategy is working — Meridian doing its thing 💪`,
        `<strong>Green session.</strong> Stay disciplined, stay profitable`,
    ],
    losing: [
        `<strong>Rough patch.</strong> Session is red but risk is managed — stick to the plan`,
        `<strong>Down but not out.</strong> Every red session ends. Stay disciplined`,
        `<strong>Temporary.</strong> Red days happen — the edge is long-term`,
    ],
    dog_anchored: [
        `<strong>👻 Phantom anchored.</strong> Deep limit posted — waiting for volatility to bite`,
        `<strong>👻 Anchor set.</strong> Cheap leg in the book — if it fills, I hedge instantly`,
        `<strong>👻 Patience mode.</strong> Phantom is out there — one spike and we hedge`,
        `<strong>👻 Anchored deep.</strong> Low cost, low risk — let the market come to us`,
    ],
    dog_filled_hedging: [
        `<strong>👻 Phantom filled!</strong> Posting fav hedge NOW — locking the spread`,
        `<strong>👻 Volatility bite!</strong> Anchor eaten — fav going up at current bid`,
        `<strong>👻 Phase 2.</strong> Anchor filled, deploying fav hedge. Don't touch anything`,
        `<strong>👻 Got the fill!</strong> Hedging immediately — this is what we anchored for`,
    ],
    anchor_sellback: [
        `<strong>👻 Ceiling breach.</strong> Sold anchor back — small loss, risk managed`,
        `<strong>👻 Hard ceiling hit.</strong> Fav too expensive — sold back the anchor`,
        `<strong>👻 Safety net caught it.</strong> Ceiling breached, anchor sold. Discipline > hope`,
    ],
    apex_sellback: [
        `<strong>△ Apex escape.</strong> Sell-back cheaper than completing — cut the loss`,
        `<strong>△ Ceiling hit, sold back.</strong> Dog still had value — saved vs completing`,
        `<strong>△ Smart exit.</strong> Arb went bad but caught it early — discipline over hope`,
    ],
    // ── Straight bet filled ──
    bet_filled: [
        `<strong>🎯 Limit filled!</strong> Your straight bet just got eaten`,
        `<strong>🎯 Order filled.</strong> Position is live — watching for SL/TP`,
        `<strong>🎯 In the market.</strong> Bet filled, now we ride`,
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

// force=true skips the background cooldown (use for event-driven updates)
// Even forced messages have a 4s minimum display time so text doesn't flicker
let lastForcedMsgTime = 0;
function updateBotBuddyMsg(state, force = false) {
    const el = document.getElementById('bot-buddy-msg');
    if (!el) return;
    const now = Date.now();
    // Background state messages (scanning, holding, etc.) only refresh every 18s
    if (!force && state === lastBuddyMsgState && now - lastBuddyMsgTime < 18000) return;
    // Even forced messages must display for at least 4s before being replaced by another force
    if (force && now - lastForcedMsgTime < 4000) return;
    lastBuddyMsgState = state;
    lastBuddyMsgTime = now;
    if (force) lastForcedMsgTime = now;

    const pool = botBuddyMessages[state] || botBuddyMessages.idle;
    let idx = Math.floor(Math.random() * pool.length);
    if (idx === lastBuddyMsgIdx && pool.length > 1) idx = (idx + 1) % pool.length;
    lastBuddyMsgIdx = idx;
    const dotColor = state === 'idle' ? '#555' :
                     state === 'stop_loss' || state === 'near_sl' || state === 'losing' ||
                     state === 'apex_loss' || state === 'phantom_loss' || state === 'middle_loss' ||
                     state === 'bet_loss' || state === 'loss_complete' || state === 'anchor_sellback' || state === 'apex_sellback' ? '#ff4444' :
                     state === 'amending' || state === 'timeout_retry' ? '#ff8800' :
                     state === 'celebrating' || state === 'take_profit' ||
                     state === 'apex_win' || state === 'phantom_win' || state === 'middle_win' || state === 'bet_win' ? '#ffdd00' :
                     state === 'dog_filled_hedging' || state === 'bet_filled' ? '#ffaa00' : '#00ff88';
    const dotAnim = state === 'idle' ? 'animation:none;' : '';
    // Fade transition so text doesn't snap
    el.style.transition = 'opacity 0.25s';
    el.style.opacity = '0';
    setTimeout(() => {
        el.innerHTML = `<span class="bot-buddy-status-dot" style="background:${dotColor};${dotAnim}"></span>${pool[idx]}`;
        el.style.opacity = '1';
    }, 250);
}

// ── Completion Sound ──────────────────────────────────────────────────
function playArbCompleteSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const play = () => {
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
        };
        if (ctx.state === 'suspended') {
            ctx.resume().then(play).catch(() => {});
        } else {
            play();
        }
    } catch (e) { /* audio not supported */ }
}

// Softer two-tone chime for amend exits (completed but via timeout amend)
function playAmendCompleteSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const play = () => {
            // Two-note muted chime: D5 → A5 (resolved but understated)
            const notes = [
                { freq: 587.33, start: 0.00, dur: 0.22, gain: 0.25 },  // D5
                { freq: 880.00, start: 0.15, dur: 0.30, gain: 0.20 },  // A5
            ];
            notes.forEach(({ freq, start, dur, gain }) => {
                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.connect(env);
                env.connect(ctx.destination);
                osc.type = 'triangle';  // softer waveform
                osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                env.gain.setValueAtTime(0, ctx.currentTime + start);
                env.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.03);
                env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur + 0.05);
            });
        };
        if (ctx.state === 'suspended') {
            ctx.resume().then(play).catch(() => {});
        } else {
            play();
        }
    } catch (e) { /* audio not supported */ }
}

// Subtle amber flash for amend exits (not confetti)
function triggerAmendFlash() {
    const flash = document.createElement('div');
    flash.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;
        background:radial-gradient(ellipse at center,rgba(255,170,0,0.15) 0%,rgba(255,136,0,0.05) 50%,transparent 80%);
        pointer-events:none;animation:amendFlashAnim 1.2s ease-out forwards;`;
    // Inject keyframes if not already present
    if (!document.getElementById('amend-flash-style')) {
        const style = document.createElement('style');
        style.id = 'amend-flash-style';
        style.textContent = `@keyframes amendFlashAnim { 0%{opacity:1} 100%{opacity:0} }`;
        document.head.appendChild(style);
    }
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1300);
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

// Switch buddy outfit based on active bot tab
let buddyCurrentOutfit = '';
const buddyOutfitNames = { arb: 'apex', dog: 'phantom', middle: 'middle', bets: 'bet' };
function setBuddyOutfit(tabMode) {
    const buddy = document.getElementById('bot-buddy');
    if (!buddy) return;
    const outfit = buddyOutfitNames[tabMode] || 'apex';
    if (outfit === buddyCurrentOutfit) return;
    buddy.classList.remove('buddy-apex', 'buddy-phantom', 'buddy-middle', 'buddy-bet');
    // Morph flash
    buddy.classList.add('buddy-morphing');
    setTimeout(() => buddy.classList.remove('buddy-morphing'), 400);
    buddy.classList.add(`buddy-${outfit}`);
    buddyCurrentOutfit = outfit;
    // Update name tag
    const nameEl = buddy.querySelector('.bot-buddy-name');
    if (nameEl) {
        const names = { apex: 'Apex', phantom: 'Phantom', middle: 'Meridian', bet: 'Scout' };
        nameEl.textContent = names[outfit] || 'Meridian';
    }
    // Intro message — each bot introduces itself when you switch tabs
    const intros = {
        apex: [
            'Apex online. Scanning for multi-rung setups.',
            'All angles covered. Show me the spreads.',
            'Precision mode. Every rung is a chance.',
            'Ladders locked. Watching for width.',
        ],
        phantom: [
            'Phantom active. Watching the deep book.',
            'Patience pays. I strike when they least expect it.',
            'Anchors set. Waiting for volatility.',
            'Silent. Still. Ready to pounce.',
        ],
        middle: [
            'Meridian ready. Looking for the line between two worlds.',
            'The gap exists. Let me find it.',
            'Spread arbitrage is an art. Let\'s paint.',
            'Two sides, one profit. That\'s the Meridian way.',
        ],
        bet: [
            'Scout deployed. Eyes on the market.',
            'One position, one edge. Keep it clean.',
            'Scanning for entry points. Standing by.',
            'First in, first out. That\'s my game.',
        ],
    };
    const msgs = intros[outfit];
    if (msgs) {
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        const msgEl = document.getElementById('bot-buddy-msg');
        if (msgEl) {
            const dotColor = { apex: '#00aaff', phantom: '#ffaa00', middle: '#aa66ff', bet: '#00ff88' }[outfit] || '#00ff88';
            msgEl.innerHTML = `<span class="bot-buddy-status-dot" style="background:${dotColor}"></span><strong>${msg.split('.')[0]}.</strong> ${msg.split('.').slice(1).join('.').trim()}`;
        }
    }
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
        const pnl = action.profit_cents ?? action.pnl_cents ?? 0;
        if (pnl > 0) {
            setBuddyMood('celebrating');
            updateBotBuddyMsg('apex_win', true);
            // triggerConfetti(); — removed
        } else {
            setBuddyMood('alert');
            updateBotBuddyMsg('apex_loss', true);
        }
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
        // Timeout amend exits complete the trade but aren't natural fills — softer celebration
        setBuddyMood('happy');
        updateBotBuddyMsg('flip_triggered', true);
        triggerAmendFlash();
        lockThen(8000);
    } else if (action.action === 'timeout_amend_retry') {
        setBuddyMood('focused');
        updateBotBuddyMsg('timeout_retry', true);
        lockThen(6000);
    } else if (action.action === 'straight_bet_filled') {
        setBuddyMood('happy');
        updateBotBuddyMsg('bet_filled', true);
        lockThen(8000);
    } else if (action.action === 'reposted') {
        updateBotBuddyMsg('scanning');
    } else if (action.action === 'dog_filled_hedging') {
        setBuddyMood('happy');
        updateBotBuddyMsg('dog_filled_hedging', true);
        lockThen(10000);
    } else if (action.action === 'anchor_complete' || action.action === 'ladder_complete') {
        const pnl = action.profit_cents ?? 0;
        if (pnl > 0) {
            setBuddyMood('celebrating');
            updateBotBuddyMsg('phantom_win', true);
            // triggerConfetti(); — removed
        } else {
            setBuddyMood('alert');
            updateBotBuddyMsg('phantom_loss', true);
        }
        lockThen(12000);
    } else if (action.action === 'anchor_sellback' || action.action === 'ladder_sellback' || action.action === 'hard_ceiling_sellback') {
        setBuddyMood('alert');
        updateBotBuddyMsg('anchor_sellback', true);
        lockThen(8000);
    } else if (action.action === 'apex_sellback') {
        setBuddyMood('alert');
        updateBotBuddyMsg('apex_sellback', true);
        lockThen(8000);
    } else if (action.action === 'middle_complete') {
        const pnl = action.profit_cents ?? 0;
        if (pnl > 0) {
            setBuddyMood('celebrating');
            updateBotBuddyMsg('middle_win', true);
            // triggerConfetti(); — removed
        } else {
            setBuddyMood('alert');
            updateBotBuddyMsg('middle_loss', true);
        }
        lockThen(10000);
    } else if (action.action === 'bet_settled') {
        const pnl = action.profit_cents ?? 0;
        if (pnl > 0) {
            setBuddyMood('celebrating');
            updateBotBuddyMsg('bet_win', true);
        } else {
            setBuddyMood('alert');
            updateBotBuddyMsg('bet_loss', true);
        }
        lockThen(10000);
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
    } else if (_botsAnchored > 0) {
        // Check if any anchor-dog bots are active
        const bots = window._lastBotsData || {};
        const hasAnchoredDog = Object.values(bots).some(b => b.bot_category === 'anchor_dog' && b.status === 'dog_anchor_posted');
        if (hasAnchoredDog) {
            updateBotBuddyMsg('dog_anchored');
        } else {
            updateBotBuddyMsg('filled');
        }
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
                    if (action.action === 'completed' || action.action === 'timeout_exit_yes' || action.action === 'timeout_exit_no') {
                        // Silent — no notification, no confetti, no sound
                    } else if (action.action === 'repeat_spawned') {
                        const repeatMsg = action.yes_price != null
                            ? `🔄 REPEAT #${action.repeat_num}/${action.repeat_total}: YES ${action.yes_price}¢ + NO ${action.no_price}¢ → ${action.profit_per}¢ profit`
                            : `🔄 REPEAT #${action.repeat_num}/${action.repeat_total} spawned`;
                        showNotification(repeatMsg);
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
                    } else if (action.action === 'dog_filled_hedging') {
                        // Silent
                    } else if (action.action === 'anchor_complete' || action.action === 'ladder_complete') {
                        // Silent
                    } else if (action.action === 'anchor_sellback' || action.action === 'ladder_sellback' || action.action === 'hard_ceiling_sellback') {
                        const loss = action.loss_cents ?? 0;
                        const lossStr = `-$${(loss/100).toFixed(2)}`;
                        showNotification(`🛡️ ${action.action === 'hard_ceiling_sellback' ? 'CEILING BREACH' : 'ANCHOR SELLBACK'}: ${lossStr} — sold back`);
                        sendPushNotification('🛡️ Anchor Sellback', `${lossStr} — ceiling breached`);
                    } else if (action.action === 'apex_sellback') {
                        const loss = action.loss_cents ?? 0;
                        const profit = action.profit_cents ?? 0;
                        const pnlStr = profit > 0 ? `+$${(profit/100).toFixed(2)}` : `-$${(loss/100).toFixed(2)}`;
                        showNotification(`🔙 APEX SELLBACK: ${pnlStr} — sold dog back (cheaper than completing)`);
                        sendPushNotification('🔙 Apex Sellback', `${pnlStr} — escape at ceiling`);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error monitoring bots:', error);
    }
}

// Load balance — uses WS cache for fast updates (falls back to REST)
let _balancePollInterval = null;

async function loadBalance(useCached = false) {
    try {
        // Always use the WS-backed cache for fast live balance — falls back gracefully
        const url = `${API_BASE}/ws/balance`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.error && data.balance !== undefined) {
            document.getElementById('balance-display').style.display = 'flex';
            document.getElementById('balance-amount').textContent = `$${data.balance.toFixed(2)}`;
            document.getElementById('portfolio-value').textContent = `$${(data.portfolio_value || 0).toFixed(2)}`;
        }
    } catch (error) {
        console.log('Balance fetch error:', error);
    }
}

function startBalancePoll() {
    if (_balancePollInterval) clearInterval(_balancePollInterval);
    // Poll the WS-backed cache every 5s for live balance updates
    _balancePollInterval = setInterval(() => loadBalance(true), 5000);
}

// ─── Upgrade #3: Multi-Market Arb Scanner ─────────────────────────────────────

let _scanModalSport    = 'all';
let _scanMarketType    = 'markets';  // 'markets' | 'props' | 'all'
let _middlesModalSport = 'all';
let _middlesModalPhase = 'all';      // 'all' | 'live' | 'pregame'
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

function setMiddlesPhase(phase) {
    _middlesModalPhase = phase;
    document.querySelectorAll('.mid-phase-pill').forEach(el => el.classList.toggle('active', el.dataset.phase === phase));
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

function setScanMarketType(mtype) {
    _scanMarketType = mtype;
    document.querySelectorAll('.scan-mtype-pill').forEach(el => {
        const isActive = el.dataset.mtype === mtype;
        el.classList.toggle('active', isActive);
        el.style.background = isActive ? '#00ff8822' : 'transparent';
        el.style.color = isActive ? '#00ff88' : '#8892a6';
        el.style.borderColor = isActive ? '#00ff8844' : '#2a3550';
    });
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
    const mtypeParam = `&market_type=${_scanMarketType}`;
    // Open modal first
    const modal = document.getElementById('scan-modal');
    if (modal) modal.classList.add('show');
    const countEl = document.getElementById('scan-count');
    const typeLabel = _scanMarketType === 'props' ? 'props' : _scanMarketType === 'all' ? 'all markets' : 'markets';
    if (countEl) countEl.textContent = _scanModalSport === 'all' ? `Scanning ${typeLabel} (15-20s)…` : `Scanning ${typeLabel}…`;
    const results = document.getElementById('scan-results');
    if (results) results.innerHTML = `<p style="color:#8892a6;text-align:center;padding:24px;">⏳ Scanning ${typeLabel}${_scanModalSport !== 'all' ? ' · ' + _scanModalSport.toUpperCase() : ''}…</p>`;
    const controller = new AbortController();
    const scanTimeout = setTimeout(() => controller.abort(), 45000);
    try {
        const resp = await fetch(`${API_BASE}/bot/scan?min_width=${minWidth}${sportParam}${mtypeParam}`, { signal: controller.signal });
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
    const smartMode       = document.getElementById('scan-smart-mode')?.checked || false;
    const repeatCount     = smartMode ? 999 : parseInt(document.getElementById('scan-repeat-count')?.value) || 0;
    const totalCost       = (yesPrice + noPrice) * quantity;
    const profitPer       = 100 - yesPrice - noPrice;

    const runsLabel = smartMode ? 'Smart mode (auto-repeat)' : repeatCount > 0 ? `${repeatCount + 1} runs` : '1 run';
    if (!confirm(`⚡ Deploy Instant Arb — ${quantity}× ${runsLabel}\n\nTicker: ${ticker}\nYES limit: ${yesPrice}¢  ·  NO limit: ${noPrice}¢\nCost: ${totalCost}¢ ($${(totalCost / 100).toFixed(2)})\nWidth: +${profitPer}¢/contract\n\nBoth sides posted at bid+1. Sits patiently.\n2.5-min timeout if one leg fills.\n\nConfirm?`)) return;

    try {
        const resp = await fetch(`${API_BASE}/bot/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, yes_price: yesPrice, no_price: noPrice, quantity, repeat_count: repeatCount, smart_mode: smartMode }),
        });
        const data = await resp.json();
        if (data.success) {
            const profitPer = 100 - yesPrice - noPrice;
            showNotification(`✅ ARB deployed: ${quantity} contracts | ${profitPer}¢ width | YES ${yesPrice}¢ → NO ${noPrice}¢ queued`);
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

// ─── Meridian Scanner ─────────────────────────────────────────────────────────
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
    const params = new URLSearchParams();
    if (_middlesModalSport && _middlesModalSport !== 'all') params.set('sport', _middlesModalSport);
    if (_middlesModalPhase && _middlesModalPhase !== 'all') params.set('phase', _middlesModalPhase);
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
        const resp = await fetch(`${API_BASE}/scan/middles${qs}`);
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

            // ── Live score range detection ──
            let legAInRange = false, legBInRange = false, hasScore = false;
            if (m.is_live && m.score_home != null && m.score_away != null) {
                hasScore = true;
                // Determine which team is team_a vs team_b using ticker
                // Ticker format: KXNBASPREAD-26MAR10MEMPHI-MEM35
                // Game segment after date = AWAYCODE+HOMECODE
                const tParts = (m.ticker_a || '').split('-');
                if (tParts.length >= 3) {
                    const tACode = (tParts[2].match(/^([A-Z]+)/) || [])[1] || '';
                    const tGameSeg = tParts[1].replace(/^\d{2}[A-Z]{3}\d{2}/, '');
                    if (tACode && tGameSeg.includes(tACode)) {
                        const teamAIsAway = tGameSeg.startsWith(tACode);
                        const teamA_score = teamAIsAway ? m.score_away : m.score_home;
                        const teamB_score = teamAIsAway ? m.score_home : m.score_away;
                        const teamA_lead = teamA_score - teamB_score;
                        // Leg A: NO "team_a wins by spread_a" → NO wins when team_a doesn't cover
                        legAInRange = teamA_lead < m.spread_a;
                        // Leg B: NO "team_b wins by spread_b" → NO wins when team_b doesn't cover
                        legBInRange = teamA_lead > -m.spread_b;
                    }
                }
                // Fallback if ticker parsing fails
                if (!legAInRange && !legBInRange && tParts.length < 3) {
                    const sd = Math.abs(m.score_home - m.score_away);
                    legAInRange = sd < m.spread_a;
                    legBInRange = sd < m.spread_b;
                }
            }
            const bothInRange = legAInRange && legBInRange;

            // Leg row border style based on range
            function legRowStyle(inRange) {
                if (!hasScore) return 'border-bottom:1px solid #0d1220;';
                if (inRange) return 'border:1px solid #00ff8855;border-radius:4px;background:#00ff8808;box-shadow:0 0 6px #00ff8822;';
                return 'border-bottom:1px solid #0d1220;opacity:0.6;';
            }
            // Range indicator badge for each leg
            function rangeTag(inRange) {
                if (!hasScore) return '';
                if (inRange) return '<span style="color:#00ff88;font-size:9px;font-weight:700;margin-left:4px;">✓ WINNING</span>';
                return '<span style="color:#ff555588;font-size:9px;font-weight:700;margin-left:4px;">✗</span>';
            }

            return `<div style="background:#0a0e1a;border-radius:8px;padding:12px 14px;margin-bottom:8px;border-left:3px solid ${borderColor};">
                <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:10px;">
                    ${guarLabel}
                    <span style="background:${speedColor}22;color:${speedColor};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;">${(m.catch_speed||'slow').toUpperCase()}</span>
                    ${hasScore ? `<span style="background:${bothInRange ? '#00ff8822' : (legAInRange||legBInRange) ? '#ffaa0022' : '#ff555522'};color:${bothInRange ? '#00ff88' : (legAInRange||legBInRange) ? '#ffaa00' : '#ff5555'};padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">${bothInRange ? '🎯 IN MIDDLE' : (legAInRange||legBInRange) ? '½ ONE LEG' : '⛔ OUTSIDE'}</span>` : ''}
                </div>
                <!-- Pricing table -->
                <div style="background:#060a14;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:11px;">
                    <div style="display:grid;grid-template-columns:1fr 55px 55px 80px;gap:4px;padding-bottom:4px;border-bottom:1px solid #1a2030;margin-bottom:4px;">
                        <div style="color:#556;font-size:10px;font-weight:600;">LEG</div>
                        <div style="color:#556;font-size:10px;font-weight:600;text-align:center;">BID</div>
                        <div style="color:#556;font-size:10px;font-weight:600;text-align:center;">ASK</div>
                        <div style="color:#ffaa00;font-size:10px;font-weight:600;text-align:center;">YOUR LIMIT</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 55px 55px 80px;gap:4px;align-items:center;padding:4px 0;${legRowStyle(legAInRange)}">
                        <div>
                            <span style="color:#fff;font-weight:700;font-size:11px;">${m.team_b||'Opp'} +${m.spread_a||'?'}</span>${rangeTag(legAInRange)}
                            <div style="color:#555;font-size:9px;">NO: ${m.title_a.replace(' Points?','').replace(' points?','')}</div>
                        </div>
                        <div style="text-align:center;color:#8892a6;font-weight:600;">${m.no_a_bid}¢</div>
                        <div style="text-align:center;color:#556;font-weight:600;">${m.no_a_ask || '?'}¢${(m.no_spread_a || 0) > 2 ? '<div style="color:#ffaa00;font-size:8px;">GAP</div>' : ''}</div>
                        <div style="text-align:center;">
                            <input id="mid-pa-${idx}" type="number" min="1" max="99" value="${m.suggested_a}"
                                oninput="updateMiddleProfit(${idx},${m.no_a_bid},${m.no_b_bid})"
                                style="width:46px;padding:2px 4px;background:#1a2540;border:1px solid #2a3550;border-radius:4px;color:#fff;font-size:12px;font-weight:700;text-align:center;">
                            ${shaveA > 0 ? `<span style="color:#ff9944;font-size:9px;">-${shaveA}¢</span>` : ''}
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 55px 55px 80px;gap:4px;align-items:center;padding:4px 0;${legRowStyle(legBInRange)}">
                        <div>
                            <span style="color:#fff;font-weight:700;font-size:11px;">${m.team_a||'Opp'} +${m.spread_b||'?'}</span>${rangeTag(legBInRange)}
                            <div style="color:#555;font-size:9px;">NO: ${m.title_b.replace(' Points?','').replace(' points?','')}</div>
                        </div>
                        <div style="text-align:center;color:#8892a6;font-weight:600;">${m.no_b_bid}¢</div>
                        <div style="text-align:center;color:#556;font-weight:600;">${m.no_b_ask || '?'}¢${(m.no_spread_b || 0) > 2 ? '<div style="color:#ffaa00;font-size:8px;">GAP</div>' : ''}</div>
                        <div style="text-align:center;">
                            <input id="mid-pb-${idx}" type="number" min="1" max="99" value="${m.suggested_b}"
                                oninput="updateMiddleProfit(${idx},${m.no_a_bid},${m.no_b_bid})"
                                style="width:46px;padding:2px 4px;background:#1a2540;border:1px solid #2a3550;border-radius:4px;color:#fff;font-size:12px;font-weight:700;text-align:center;">
                            ${shaveB > 0 ? `<span style="color:#ff9944;font-size:9px;">-${shaveB}¢</span>` : ''}
                        </div>
                    </div>
                </div>
                <!-- Width preset pills -->
                <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;">
                    ${[0,2,4,6].map(w => {
                        const isActive = w === 0;
                        return `<button class="mid-width-pill-${idx}" data-width="${w}"
                            onclick="setMiddleScanWidth(${idx},${w},${m.no_a_bid},${m.no_b_bid})"
                            style="padding:3px 10px;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid ${isActive ? '#ffaa00' : '#2a3550'};background:${isActive ? '#ffaa0022' : '#0a0e1a'};color:${isActive ? '#ffaa00' : '#8892a6'};">${w === 0 ? 'Straight' : '+' + w + '¢'}</button>`;
                    }).join('')}
                </div>
                <!-- Profit summary -->
                <div id="mid-summary-${idx}" style="background:#060a14;border-radius:6px;padding:7px 10px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;text-align:center;">
                    <div>
                        <div style="color:#556;font-size:9px;font-weight:600;margin-bottom:2px;">TOTAL COST</div>
                        <div style="color:#fff;font-weight:700;" id="mid-cost-${idx}">${m.suggested_a + m.suggested_b}¢</div>
                        <div style="color:#556;font-size:9px;" id="mid-cost-dollars-${idx}">$${((m.suggested_a + m.suggested_b) / 100).toFixed(2)}</div>
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
                        oninput="updateMiddleProfit(${idx},${m.no_a_bid},${m.no_b_bid})"
                        style="width:44px;padding:4px 6px;background:#0a0e1a;border:1px solid #2a3550;border-radius:5px;color:#fff;font-size:12px;font-weight:600;text-align:center;">
                    <button onclick="deployMiddleBotFromCard(${idx})"
                            style="background:${isGuaranteed ? '#00ff88' : '#aa66ff'};color:${isGuaranteed ? '#000' : '#fff'};border:none;padding:5px 16px;border-radius:5px;cursor:pointer;font-weight:700;font-size:11px;">
                        📐 Deploy
                    </button>
                </div>
            </div>`;
        }

        // Build game data for tab navigation
        const gameList = [];
        for (const [gameId, entries] of gameGroups) {
            const first = entries[0].m;
            const hasLive = entries.some(e => e.m.is_live);
            const hasGuar = entries.some(e => e.m.guaranteed_profit > 0);
            const teamNames = `${first.team_a_name || first.team_a} vs ${first.team_b_name || first.team_b}`;
            const shortNames = `${(first.team_a || '').slice(0,3)} v ${(first.team_b || '').slice(0,3)}`;
            gameList.push({ gameId, entries, first, hasLive, hasGuar, teamNames, shortNames });
        }

        function renderGameTab(gameIdx) {
            const g = gameList[gameIdx];
            if (!g) return;
            const { entries, first, hasLive, hasGuar, teamNames } = g;
            const mDate = first.game_date ? ` · ${first.game_date}` : '';

            // Score badge
            let scoreBadge = '';
            if (hasLive && first.score_home != null) {
                let gameLegAIn = false, gameLegBIn = false;
                const tP = (first.ticker_a || '').split('-');
                if (tP.length >= 3) {
                    const tCode = (tP[2].match(/^([A-Z]+)/) || [])[1] || '';
                    const tSeg = tP[1].replace(/^\d{2}[A-Z]{3}\d{2}/, '');
                    if (tCode && tSeg.includes(tCode)) {
                        const isAway = tSeg.startsWith(tCode);
                        const aScore = isAway ? first.score_away : first.score_home;
                        const bScore = isAway ? first.score_home : first.score_away;
                        const lead = aScore - bScore;
                        gameLegAIn = lead < first.spread_a;
                        gameLegBIn = lead > -first.spread_b;
                    }
                }
                const gameBothIn = gameLegAIn && gameLegBIn;
                const scoreCol = gameBothIn ? '#00ff88' : (gameLegAIn || gameLegBIn) ? '#ffaa00' : '#ff5555';
                const scoreBg = gameBothIn ? '#00ff8822' : (gameLegAIn || gameLegBIn) ? '#ffaa0022' : '#ff555522';
                const rangeEmoji = gameBothIn ? '🎯' : (gameLegAIn || gameLegBIn) ? '⚠️' : '⛔';
                scoreBadge = `<span style="background:${scoreBg};color:${scoreCol};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;border:1px solid ${scoreCol}44;">${rangeEmoji} ${first.score_away}–${first.score_home}</span>
                              <span style="color:#556;font-size:9px;">${first.score_detail || ''}</span>`;
            }

            const viewTicker = first.ticker_a || '';
            const viewBtn = viewTicker ? `<button onclick="closeMiddlesModal(); openMarketByTicker('${viewTicker}')" style="background:#1e2740;color:#818cf8;border:1px solid #818cf844;border-radius:4px;padding:2px 8px;font-size:9px;font-weight:700;cursor:pointer;margin-left:auto;">View Market</button>` : '';

            const gameContent = document.getElementById('middles-game-content');
            if (!gameContent) return;
            gameContent.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;padding:6px 0;margin-bottom:8px;border-bottom:1px solid #1e2740;flex-wrap:wrap;">
                    <span style="color:#fff;font-weight:800;font-size:13px;">${teamNames}</span>
                    ${hasLive ? '<span style="background:#ff333333;color:#ff3333;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">🔴 LIVE</span>' : ''}
                    ${scoreBadge}
                    ${hasGuar ? '<span style="background:#00ff8822;color:#00ff88;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">✓ ARB</span>' : ''}
                    <span style="color:#444;font-size:10px;">${mDate}</span>
                    ${viewBtn}
                    <span style="color:#444;font-size:10px;">${entries.length} pair${entries.length > 1 ? 's' : ''}</span>
                </div>
                ${entries.map(({ m, idx }) => buildMiddleCard(m, idx)).join('')}
            `;

            // Update active tab
            document.querySelectorAll('.mid-game-tab').forEach((el, i) => {
                const isActive = i === gameIdx;
                el.style.background = isActive ? '#aa66ff22' : '#0a0e1a';
                el.style.color = isActive ? '#cc66ff' : '#8892a6';
                el.style.borderBottom = isActive ? '2px solid #cc66ff' : '2px solid transparent';
            });
        }

        // Build tabs + content area
        let tabsHtml = `<div style="display:flex;gap:0;overflow-x:auto;border:1px solid #1e2740;border-radius:8px;margin-bottom:12px;-webkit-overflow-scrolling:touch;">`;
        gameList.forEach((g, i) => {
            const liveDot = g.hasLive ? '<span style="color:#ff3333;font-size:8px;">●</span> ' : '';
            const arbBadge = g.hasGuar ? ' <span style="color:#00ff88;font-size:8px;">✓</span>' : '';
            tabsHtml += `<button class="mid-game-tab" onclick="window._midRenderGameTab(${i})"
                style="flex:none;padding:8px 14px;border:none;cursor:pointer;font-size:11px;font-weight:700;white-space:nowrap;
                background:${i===0?'#aa66ff22':'#0a0e1a'};color:${i===0?'#cc66ff':'#8892a6'};
                border-bottom:${i===0?'2px solid #cc66ff':'2px solid transparent'};">
                ${liveDot}${g.shortNames}${arbBadge}</button>`;
        });
        tabsHtml += `</div><div id="middles-game-content"></div>`;
        results.innerHTML = tabsHtml;

        // Store render function globally and show first game
        window._midRenderGameTab = renderGameTab;
        if (gameList.length > 0) renderGameTab(0);
    }
    // modal is already shown by scanMiddles(); don't re-open here
}

function setMiddleScanWidth(idx, width, bidA, bidB) {
    const targetSum = 100 - width;
    const cost = bidA + bidB;
    let pA, pB;
    if (cost <= targetSum && (bidA + 1) + (bidB + 1) <= targetSum) {
        // Instant arb — bid+1 to get first in line
        pA = bidA + 1;
        pB = bidB + 1;
    } else if (cost <= targetSum) {
        // Instant arb but bid+1 pushes over — stay at bid
        pA = bidA;
        pB = bidB;
    } else {
        // Over target — shave evenly
        const shaveEach = (cost - targetSum) / 2;
        pA = Math.max(1, Math.round(bidA - shaveEach));
        pB = Math.max(1, Math.round(bidB - shaveEach));
    }
    const elA = document.getElementById(`mid-pa-${idx}`);
    const elB = document.getElementById(`mid-pb-${idx}`);
    if (elA) elA.value = pA;
    if (elB) elB.value = pB;
    // Highlight active pill
    document.querySelectorAll(`.mid-width-pill-${idx}`).forEach(el => {
        const w = parseInt(el.dataset.width);
        el.style.borderColor = w === width ? '#ffaa00' : '#2a3550';
        el.style.background = w === width ? '#ffaa0022' : '#0a0e1a';
        el.style.color = w === width ? '#ffaa00' : '#8892a6';
    });
    updateMiddleProfit(idx, bidA, bidB);
}

function updateMiddleProfit(idx, bidA, bidB) {
    const pa = parseInt(document.getElementById(`mid-pa-${idx}`)?.value) || bidA;
    const pb = parseInt(document.getElementById(`mid-pb-${idx}`)?.value) || bidB;
    const qty = parseInt(document.getElementById(`mid-qty-${idx}`)?.value) || 1;
    const costPer = pa + pb;
    const profitPer = 100 - costPer;
    const bothPer = 200 - costPer;
    const costEl = document.getElementById(`mid-cost-${idx}`);
    const costDollarsEl = document.getElementById(`mid-cost-dollars-${idx}`);
    const profitEl = document.getElementById(`mid-profit-${idx}`);
    const bothEl = document.getElementById(`mid-both-${idx}`);
    if (costEl) costEl.textContent = qty > 1 ? `${costPer * qty}¢ (${costPer}¢×${qty})` : `${costPer}¢`;
    if (costDollarsEl) costDollarsEl.textContent = `$${((costPer * qty) / 100).toFixed(2)}`;
    if (profitEl) {
        const total = profitPer * qty;
        profitEl.textContent = qty > 1 ? `${total >= 0 ? '+' : ''}${total}¢ (${profitPer >= 0 ? '+' : ''}${profitPer}¢×${qty})` : `${profitPer >= 0 ? '+' : ''}${profitPer}¢`;
        profitEl.style.color = profitPer >= 0 ? '#00ff88' : '#ff4444';
    }
    if (bothEl) {
        const total = bothPer * qty;
        bothEl.textContent = qty > 1 ? `+${total}¢ (+${bothPer}¢×${qty})` : `+${bothPer}¢`;
    }
    // Clear width pill highlights when manually editing prices
    // (pills call this after setting prices, so only clear if called from oninput)
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

function openMarketByTicker(ticker) {
    // Find the market in allMarkets by ticker (exact or event_ticker match)
    const eventTicker = ticker.split('-').slice(0, 2).join('-');  // e.g. KXNBASPREAD-26MAR13OKCCHI
    let market = allMarkets.find(m => m.ticker === ticker);
    if (!market) market = allMarkets.find(m => m.event_ticker === eventTicker || (m.ticker && m.ticker.startsWith(eventTicker)));
    if (!market) {
        // Not in current view — search by the game portion of the ticker
        const gamePart = ticker.split('-')[1] || '';
        market = allMarkets.find(m => m.ticker && m.ticker.includes(gamePart));
    }
    if (market) {
        openBotModal(market);
    } else {
        showNotification('Market not loaded — try switching to the correct sport tab first.');
    }
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
            rebalancer_mode: document.getElementById('middle-rebalancer-toggle')?.checked ? 'live' : 'off',
            rebalancer_enabled: document.getElementById('middle-rebalancer-toggle')?.checked !== false,
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

let _latencyInterval = null;
async function loadLatency() {
    const panel = document.getElementById('latency-panel');
    const stats = document.getElementById('latency-stats');
    if (!panel || !stats) return;
    panel.style.display = '';
    // Start auto-refresh every 10s
    if (!_latencyInterval) {
        _latencyInterval = setInterval(loadLatency, 10000);
    }
    try {
        const resp = await fetch(`${API_BASE}/latency`);
        const data = await resp.json();
        const livePing = data.live_ping_ms;
        const rawPing = data.raw_ping_ms;
        const rawPhantom = data.raw_hedge_phantom || {};
        const rawApex = data.raw_hedge_apex || {};
        const cats = [
            { key: 'order_place',   label: 'Order Place',   color: '#ffaa00', icon: '📤' },
            { key: 'orderbook',     label: 'Orderbook',     color: '#00aaff', icon: '📊' },
            { key: 'fill_to_hedge_phantom', label: 'Phantom Hedge', color: '#00ff88', icon: '👻', rawKey: 'raw_hedge_phantom' },
            { key: 'fill_to_hedge_apex',    label: 'Apex Hedge',    color: '#66ffcc', icon: '🏹', rawKey: 'raw_hedge_apex' },
            { key: 'api_ping',      label: 'API Ping',      color: '#ff66cc', icon: '🏓', live: livePing },
        ];
        stats.innerHTML = cats.map(c => {
            const s = data[c.key] || {};
            if (!s.count) return `<div style="background:#0f1419;border:1px solid #1e2740;border-radius:8px;padding:12px;text-align:center;">
                <div style="color:${c.color};font-size:11px;font-weight:700;">${c.icon} ${c.label}</div>
                <div style="color:#555;font-size:11px;margin-top:4px;">No data yet</div>
            </div>`;
            const _fmtMs = v => v < 1 ? v.toFixed(1) : Math.round(v);
            const mainVal = c.live != null ? _fmtMs(c.live) : _fmtMs(s.median != null ? s.median : s.avg);
            const mainLabel = c.live != null ? 'now' : 'avg';
            const _mainNum = parseFloat(mainVal);
            const valCol = _mainNum < 200 ? '#00ff88' : _mainNum < 500 ? '#ffaa00' : '#ff4444';
            // Hedge tiles: side-by-side raw + round trip at equal size
            if (c.rawKey) {
                const rs = data[c.rawKey] || {};
                const rawVal = rs.count ? _fmtMs(rs.median != null ? rs.median : rs.avg) : null;
                const _rawNum = rawVal != null ? parseFloat(rawVal) : null;
                const rawCol = _rawNum != null ? (_rawNum < 5 ? '#00ffcc' : _rawNum < 15 ? '#00ff88' : _rawNum < 50 ? '#ffaa00' : '#ff4444') : '#555';
                return `<div style="background:#0f1419;border:1px solid #1e2740;border-radius:8px;padding:12px;">
                    <div style="color:${c.color};font-size:11px;font-weight:700;margin-bottom:8px;">${c.icon} ${c.label}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="background:#0a1520;border:1px solid #1a3050;border-radius:6px;padding:6px;text-align:center;overflow:hidden;">
                            <div style="color:#8892a6;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Raw Speed</div>
                            <div style="color:${rawCol};font-size:18px;font-weight:800;white-space:nowrap;">${rawVal != null ? rawVal + 'ms' : '—'}</div>
                            ${rs.count ? `<div style="display:flex;justify-content:space-between;font-size:8px;color:#667;margin-top:3px;">
                                <span>min ${_fmtMs(rs.min)}</span>
                                <span>p95 ${_fmtMs(rs.p95)}</span>
                            </div>
                            <div style="color:#555;font-size:8px;text-align:center;margin-top:1px;">${rs.count} samples</div>` : ''}
                        </div>
                        <div style="background:#0a1218;border:1px solid #1a2535;border-radius:6px;padding:6px;text-align:center;overflow:hidden;">
                            <div style="color:#8892a6;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Round Trip</div>
                            <div style="color:${valCol};font-size:18px;font-weight:800;white-space:nowrap;">${mainVal}ms</div>
                            <div style="display:flex;justify-content:space-between;font-size:8px;color:#667;margin-top:3px;">
                                <span>min ${_fmtMs(s.min)}</span>
                                <span>p95 ${_fmtMs(s.p95)}</span>
                            </div>
                            <div style="color:#555;font-size:8px;text-align:center;margin-top:1px;">${s.count} samples</div>
                        </div>
                    </div>
                </div>`;
            }
            // API Ping tile: side-by-side raw ping + API ping
            if (c.key === 'api_ping' && rawPing != null) {
                const rpCol = rawPing < 2 ? '#00ffcc' : rawPing < 10 ? '#00ff88' : '#ffaa00';
                return `<div style="background:#0f1419;border:1px solid #1e2740;border-radius:8px;padding:12px;">
                    <div style="color:${c.color};font-size:11px;font-weight:700;margin-bottom:8px;">${c.icon} ${c.label}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="background:#0a1520;border:1px solid #1a3050;border-radius:6px;padding:6px;text-align:center;overflow:hidden;">
                            <div style="color:#8892a6;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Raw Ping</div>
                            <div style="color:${rpCol};font-size:18px;font-weight:800;white-space:nowrap;">${rawPing}ms</div>
                        </div>
                        <div style="background:#0a1218;border:1px solid #1a2535;border-radius:6px;padding:6px;text-align:center;overflow:hidden;">
                            <div style="color:#8892a6;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">API Call</div>
                            <div style="color:${valCol};font-size:18px;font-weight:800;white-space:nowrap;">${mainVal}ms</div>
                            <div style="display:flex;justify-content:space-between;font-size:8px;color:#667;margin-top:3px;">
                                <span>min ${Math.round(s.min)}</span>
                                <span>p95 ${Math.round(s.p95)}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
            // Order Place + Orderbook tiles: same consistent style
            return `<div style="background:#0f1419;border:1px solid #1e2740;border-radius:8px;padding:12px;">
                <div style="color:${c.color};font-size:11px;font-weight:700;margin-bottom:8px;">${c.icon} ${c.label}</div>
                <div style="background:#0a1218;border:1px solid #1a2535;border-radius:6px;padding:6px;text-align:center;overflow:hidden;">
                    <div style="color:${valCol};font-size:18px;font-weight:800;white-space:nowrap;">${mainVal}ms</div>
                    <div style="color:#666;font-size:9px;margin-top:-2px;">${mainLabel}</div>
                    <div style="display:flex;justify-content:space-between;font-size:8px;color:#667;margin-top:3px;">
                        <span>min ${Math.round(s.min)}</span>
                        <span>p95 ${Math.round(s.p95)}</span>
                        <span>max ${Math.round(s.max)}</span>
                    </div>
                    <div style="color:#555;font-size:8px;margin-top:1px;">${s.count} samples</div>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        stats.innerHTML = `<p style="color:#ff4444;font-size:11px;">Failed: ${e.message}</p>`;
    }
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
        const dateParam = selectedHistoryDays.length ? `?dates=${selectedHistoryDays.join(',')}` : '';
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
        const amendedN     = (s.amended_stats || {}).total || 0;
        const filledN      = completedN - amendedN;  // natural fills (both legs)
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
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">${selectedHistoryDays.length ? `📅 ${selectedHistoryDays.length === 1 ? selectedHistoryDays[0] : selectedHistoryDays.length + ' days'}` : 'Lifetime P&L'}</div>
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
                        <div style="color:#555;font-size:10px;margin-top:2px;">${dW}W / ${dL}L today (Apex)</div>
                    </div>`;
                })()}
            </div>

            <!-- Result breakdown + Completed + Flip analysis -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:16px;">
                <div style="background:#0f1419;border-radius:8px;padding:14px;border:1px solid #1e2740;">
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;font-weight:600;">📊 How Trades End</div>
                    ${totalResults > 0 ? `
                    <div style="display:flex;flex-direction:column;gap:4px;">
                        ${filledN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#00ff88;font-size:11px;">✅ Filled (both legs natural)</span>
                            <span style="color:#00ff88;font-weight:700;font-size:12px;">${filledN} <span style="color:#555;font-weight:400;">(${Math.round(filledN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${amendedN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff8800;font-size:11px;">🔧 Amended (timeout → force fill)</span>
                            <span style="color:#ff8800;font-weight:700;font-size:12px;">${amendedN} <span style="color:#555;font-weight:400;">(${Math.round(amendedN/totalResults*100)}%)</span></span>
                        </div>` : ''}
                        ${timeoutN > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color:#ff8800;font-size:11px;">⏱ Timeout exit (legacy)</span>
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
                    <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;font-weight:600;">🔧 Amended Arbs</div>
                    ${(() => {
                        const am = s.amended_stats || {};
                        if (!am.total) return '<div style="color:#00ff88;font-size:11px;">✅ No amended arbs — all completed cleanly</div>';
                        const amNet = am.net_cents || 0;
                        const amNetColor = amNet >= 0 ? '#00ff88' : '#ff4444';
                        const profColor = am.gross_profit_cents > 0 ? '#00ff88' : '#555';
                        const lossColor = am.gross_loss_cents > 0 ? '#ff4444' : '#555';
                        return `<div style="display:flex;flex-direction:column;gap:5px;">
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Total amended</span>
                                <span style="color:#ff8800;font-weight:700;font-size:12px;">${am.total}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Profitable</span>
                                <span style="color:#00ff88;font-weight:700;font-size:12px;">${am.profitable_n} <span style="color:#555;font-weight:400;font-size:10px;">(avg +${am.avg_profit_cents}¢)</span></span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Losing</span>
                                <span style="color:#ff4444;font-weight:700;font-size:12px;">${am.losing_n} <span style="color:#555;font-weight:400;font-size:10px;">(avg -${am.avg_loss_cents}¢)</span></span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px solid #1e2740;">
                                <span style="color:#8892a6;font-size:11px;">Gross +</span>
                                <span style="color:${profColor};font-weight:700;font-size:12px;">+${am.gross_profit_cents}¢</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;">Gross −</span>
                                <span style="color:${lossColor};font-weight:700;font-size:12px;">-${am.gross_loss_cents}¢</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#8892a6;font-size:11px;font-weight:600;">Net</span>
                                <span style="color:${amNetColor};font-weight:800;font-size:13px;">${amNet >= 0 ? '+' : ''}${amNet}¢ ($${(amNet/100).toFixed(2)})</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px solid #1e2740;">
                                <span style="color:#555;font-size:10px;">YES first / NO first</span>
                                <span style="color:#555;font-weight:600;font-size:10px;">${am.yes_first_n} / ${am.no_first_n}</span>
                            </div>
                        </div>`;
                    })()}
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
let selectedHistoryDays = [];      // Array of YYYY-MM-DD strings, empty = full history
let historyViewMode = 'arb';  // 'arb' | 'bets' | 'middle' | 'dog'

const HIST_MODES = {
    arb:     { btn: 'histmode-arb',     sec: 'hist-arb-section',     color: '#00ff88' },
    bets:    { btn: 'histmode-bets',    sec: 'hist-bets-section',    color: '#ffaa00' },
    middle:  { btn: 'histmode-middle',  sec: 'hist-middle-section',  color: '#aa66ff' },
    dog:     { btn: 'histmode-dog',     sec: 'hist-dog-section',     color: '#ffaa00' },
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
    if (mode === 'middle')  { loadMiddleHistory(); }
    if (mode === 'dog')     { loadDogHistory(); }
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
    const todayStr = _localDateStr(today);

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

        const isSelected = selectedHistoryDays.includes(key);
        const todayRing = isSelected
            ? 'box-shadow:0 0 0 2px #ffaa00;'
            : isToday ? 'box-shadow:0 0 0 2px #00aaff;' : '';
        const clickable = (dayData || isToday) && !isFuture;
        const cursor = clickable ? 'cursor:pointer;' : '';
        cellsHtml += `<div onclick="${clickable ? `selectHistoryDay('${key}', event)` : ''}" style="background:${bg};border:1px solid ${border};border-radius:6px;padding:4px 2px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;${todayRing}${cursor}" title="${key}${isSelected ? ' (selected)' : ''}">${content}</div>`;
    }

    const filterBanner = selectedHistoryDays.length > 0
        ? `<div style="display:flex;align-items:center;justify-content:space-between;background:#ffaa0022;border:1px solid #ffaa0066;border-radius:6px;padding:6px 10px;margin-bottom:10px;font-size:11px;">
               <span style="color:#ffaa00;font-weight:700;">📅 Filtered: ${selectedHistoryDays.length === 1 ? selectedHistoryDays[0] : selectedHistoryDays.length + ' days'}</span>
               <button onclick="selectHistoryDay(null)" style="background:none;border:none;color:#ffaa00;cursor:pointer;font-size:12px;font-weight:700;padding:0 4px;">✕ Clear</button>
           </div>`
        : '';

    panel.innerHTML = `
        <div style="background:#0d1120;border:1px solid #1e2740;border-radius:12px;padding:16px;">
            ${filterBanner}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <button onclick="calendarPrevMonth()" style="background:none;border:1px solid #2a3550;color:#8892a6;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:14px;">‹</button>
                <div style="text-align:center;">
                    <div onclick="selectHistoryMonth()" style="color:#fff;font-weight:700;font-size:14px;cursor:pointer;" title="Click to select/deselect all days in ${monthName}">📅 ${monthName}</div>
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

function selectHistoryDay(dateStr, event) {
    if (!dateStr) {
        // Clear all
        selectedHistoryDays = [];
    } else if (event && event.shiftKey && selectedHistoryDays.length > 0) {
        // Shift-click: select range from last selected to this day
        const last = selectedHistoryDays[selectedHistoryDays.length - 1];
        const start = new Date(last), end = new Date(dateStr);
        const lo = start < end ? start : end, hi = start < end ? end : start;
        for (let d = new Date(lo); d <= hi; d.setDate(d.getDate() + 1)) {
            const key = _localDateStr(d);
            if (!selectedHistoryDays.includes(key)) selectedHistoryDays.push(key);
        }
    } else {
        // Toggle single day
        const idx = selectedHistoryDays.indexOf(dateStr);
        if (idx >= 0) selectedHistoryDays.splice(idx, 1);
        else selectedHistoryDays.push(dateStr);
    }
    selectedHistoryDays.sort();
    setHistoryMode(historyViewMode);
}

function selectHistoryMonth() {
    // Select all days in the currently viewed month that have data
    const year = calendarViewDate.getFullYear(), month = calendarViewDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const monthDays = [];
    for (let d = 1; d <= totalDays; d++) {
        monthDays.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    // If all days in this month are already selected, deselect them (toggle)
    const allSelected = monthDays.every(d => selectedHistoryDays.includes(d));
    if (allSelected) {
        selectedHistoryDays = selectedHistoryDays.filter(d => !monthDays.includes(d));
    } else {
        for (const d of monthDays) {
            if (!selectedHistoryDays.includes(d)) selectedHistoryDays.push(d);
        }
    }
    selectedHistoryDays.sort();
    setHistoryMode(historyViewMode);
}

function calendarPrevMonth() {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    setHistoryMode(historyViewMode);
}

function calendarNextMonth() {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    setHistoryMode(historyViewMode);
}

async function loadTradeHistoryList() {
    const el = document.getElementById('trade-history-list');
    if (!el) return;
    try {
        const dateParam = selectedHistoryDays.length ? `&dates=${selectedHistoryDays.join(',')}` : '';
        const resp = await fetch(`${API_BASE}/bot/history?limit=200${dateParam}`);
        const data = await resp.json();
        let trades = (data.trades || []).filter(t => t.type !== 'watch' && t.type !== 'middle' && !['anchor_dog','anchor_ladder'].includes(t.bot_category) && !['anchor_sellback','ladder_sellback'].includes(t.result));

        // Group ladder_arb trades by bot_id + run cycle into summary entries
        const grouped = [];
        const larbGroups = {};
        for (const t of trades) {
            if ((t.bot_category === 'ladder_arb' || t.fill_source === 'ladder_arb') && t.bot_id) {
                // Group by bot_id + repeat_cycle (or detect run boundaries)
                const cycle = t.repeat_cycle || 1;
                const groupKey = `${t.bot_id}__run${cycle}`;
                if (!larbGroups[groupKey]) larbGroups[groupKey] = [];
                larbGroups[groupKey].push(t);
            } else {
                grouped.push(t);
            }
        }
        // For trades without repeat_cycle, split by rungs_completed resets
        const splitGroups = {};
        for (const [key, rungTrades] of Object.entries(larbGroups)) {
            if (rungTrades[0].repeat_cycle) {
                splitGroups[key] = rungTrades;
            } else {
                // Detect run boundaries: sort by time, split when rungs_completed resets
                const sorted = rungTrades.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                let runIdx = 1;
                let lastRc = 0;
                for (const t of sorted) {
                    const rc = t.rungs_completed || 0;
                    if (rc <= lastRc && lastRc > 0) runIdx++;
                    lastRc = rc;
                    const sk = `${key}__split${runIdx}`;
                    if (!splitGroups[sk]) splitGroups[sk] = [];
                    splitGroups[sk].push(t);
                }
            }
        }
        // Create one summary entry per run
        for (const [groupKey, rungTrades] of Object.entries(splitGroups)) {
            const totalProfit = rungTrades.reduce((s, t) => s + (t.profit_cents || 0), 0);
            const totalLoss = rungTrades.reduce((s, t) => s + (t.loss_cents || 0), 0);
            const totalFees = rungTrades.reduce((s, t) => s + (t.fee_cents || 0), 0);
            const totalQty = rungTrades.reduce((s, t) => s + (t.quantity || 1), 0);
            const netPnl = totalProfit - totalLoss;
            const rungsCompleted = rungTrades.length;
            const rungsTotal = rungTrades[0].rungs_total || rungsCompleted;
            // Weighted avg prices
            const avgYes = totalQty > 0 ? Math.round(rungTrades.reduce((s, t) => s + (t.yes_price || 0) * (t.quantity || 1), 0) / totalQty) : 0;
            const avgNo = totalQty > 0 ? Math.round(rungTrades.reduce((s, t) => s + (t.no_price || 0) * (t.quantity || 1), 0) / totalQty) : 0;
            // Widths
            const widths = rungTrades.map(t => t.rung_width || t.arb_width || 0).filter(w => w > 0);
            const widthRange = widths.length > 0 ? `${Math.min(...widths)}-${Math.max(...widths)}¢` : '';
            // Use earliest placed_at and latest timestamp
            const earliest = Math.min(...rungTrades.map(t => t.placed_at || t.timestamp || 0));
            const latest = Math.max(...rungTrades.map(t => t.timestamp || 0));
            grouped.push({
                ...rungTrades[0],
                _is_larb_summary: true,
                profit_cents: netPnl >= 0 ? netPnl : 0,
                loss_cents: netPnl < 0 ? Math.abs(netPnl) : 0,
                fee_cents: totalFees,
                quantity: totalQty,
                yes_price: avgYes,
                no_price: avgNo,
                placed_at: earliest,
                timestamp: latest,
                result: rungTrades.some(r => r.result === 'apex_sellback' || r.result === 'ladder_arb_sellback') ? 'apex_sellback'
                    : netPnl >= 0 ? 'completed' : 'arb_loss',
                _rungs_completed: rungsCompleted,
                _rungs_total: rungsTotal,
                _width_range: widthRange,
                _rung_trades: rungTrades,
                _net_pnl: netPnl,
                _run_number: rungTrades[0].repeat_cycle || null,
                _repeat_total: rungTrades[0].repeat_total || null,
                _smart_mode: rungTrades[0].smart_mode || false,
                _hard_ceiling: rungTrades[0].hard_ceiling || null,
            });
        }
        // Sort by timestamp descending
        grouped.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        trades = grouped.slice(0, 50);

        // Clear button at top
        let clearBtn = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
            <button onclick="clearTradeHistory()" style="background:#2a1a1a;border:1px solid #ff4444;color:#ff4444;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">Clear History</button>
        </div>`;
        
        if (trades.length === 0) {
            el.innerHTML = clearBtn + '<p style="color:#555;text-align:center;">No completed or stopped trades yet.</p>';
            return;
        }
        
        const rows = trades.map(t => {
            // ── Ladder Arb Summary Card ──
            if (t._is_larb_summary) {
                const pnl = t._net_pnl || 0;
                const isSellback = t.result === 'apex_sellback';
                const pnlCol = pnl > 0 ? '#00ff88' : pnl < 0 ? '#ff4444' : '#ffaa00';
                const icon = isSellback ? '🔙' : pnl >= 0 ? '✅' : '⛔';
                const resultLabel = isSellback ? 'SOLD BACK' : pnl >= 0 ? 'COMPLETED' : 'ARB LOSS';
                const teamName = formatBotDisplayName(t.ticker || '', t.spread_line || '');
                const sDt = new Date(t.timestamp * 1000);
                const sDate = sDt.toLocaleDateString([], {month:'short', day:'numeric'});
                const sTime = sDt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                const sPlacedDt = t.placed_at ? new Date(t.placed_at * 1000) : null;
                const sPlacedTime = sPlacedDt ? sPlacedDt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                const totalCost = (t.yes_price || 0) + (t.no_price || 0);
                const rungsInfo = t._rung_trades || [];
                // Hedge speed: use fill_duration_s from first rung, or hedge_latency_ms
                const hedgeLat = rungsInfo.reduce((best, r) => {
                    const lat = r.hedge_latency_ms != null ? r.hedge_latency_ms : null;
                    return lat != null && (best === null || lat < best) ? lat : best;
                }, null);
                const rawHedge = rungsInfo.reduce((best, r) => {
                    const raw = r.raw_hedge_ms != null ? r.raw_hedge_ms : null;
                    return raw != null && (best === null || raw < best) ? raw : best;
                }, null);
                const fillDur = t.fill_duration_s || rungsInfo.reduce((best, r) => {
                    return r.fill_duration_s != null ? Math.max(best || 0, r.fill_duration_s) : best;
                }, null);
                const totalWalks = rungsInfo.reduce((s, r) => s + (r.walk_count || 0), 0);
                const hedgeSpeedHtml = (() => {
                    let parts = [];
                    if (hedgeLat != null) parts.push(`<span style="color:${hedgeLat < 300 ? '#00ff88' : hedgeLat < 800 ? '#ffaa00' : '#ff4444'};font-weight:700;">⚡ ${Math.round(hedgeLat)}ms</span>`);
                    if (rawHedge != null) parts.push(`<span style="color:${rawHedge < 5 ? '#00ffcc' : rawHedge < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;">raw ${rawHedge.toFixed(1)}ms</span>`);
                    if (fillDur != null) parts.push(`<span style="color:#8892a6;">${fillDur >= 60 ? Math.floor(fillDur/60) + 'm' + (fillDur%60) + 's' : fillDur + 's'} total</span>`);
                    if (totalWalks > 0) parts.push(`<span style="color:#8892a6;">${totalWalks} walks</span>`);
                    return parts.join(' · ');
                })();
                const rungRows = rungsInfo.map(r => {
                    const rPnl = r.net_pnl != null ? r.net_pnl : ((r.profit_cents || 0) - (r.loss_cents || 0));
                    const rCol = rPnl > 0 ? '#00ff88' : rPnl < 0 ? '#ff4444' : '#555';
                    const w = r.rung_width || r.arb_width || '?';
                    const rComb = r.combined_price || ((r.yes_price || 0) + (r.no_price || 0));
                    const wasSnapped = r.snapped ? '⚡' : '🎯';
                    return `<span style="color:${rCol};font-size:9px;">${wasSnapped}${w}¢ ${rComb}¢ → ${rPnl >= 0 ? '+' : ''}${rPnl}¢</span>`;
                }).join(' · ');
                return `
                <div style="background:#0f1419;border:1px solid ${pnl >= 0 ? '#00ff8822' : '#ff444422'};border-left:3px solid ${pnlCol};border-radius:8px;padding:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 3px #00aaff44);"><polygon points="12,2 22,20 2,20" fill="none" stroke="#00aaff" stroke-width="2" stroke-linejoin="round"/><polygon points="12,8 17,17 7,17" fill="#00aaff33" stroke="#00aaff" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.5" fill="#00aaff"/></svg>
                            <span style="font-size:14px;">${icon}</span>
                            <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                            <span style="background:#00aaff22;color:#00aaff;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">△ APEX</span>
                            <span style="background:${isSellback ? '#ff880022' : pnl >= 0 ? '#00ff8822' : '#ff444422'};color:${isSellback ? '#ff8800' : pnlCol};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${resultLabel}</span>
                            <span style="background:#ffaa0022;color:#ffaa00;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${t._rungs_completed}/${t._rungs_total} rungs</span>
                            ${t._run_number ? `<span style="background:#aa66ff22;color:#aa66ff;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${t._smart_mode ? 'Smart ' : ''}Run ${t._run_number}${t._repeat_total ? '/' + t._repeat_total : ''}</span>` : ''}
                            ${t._hard_ceiling && t._hard_ceiling < 98 ? `<span style="background:${t._hard_ceiling <= 96 ? '#00ff8822' : '#ffaa0022'};color:${t._hard_ceiling <= 96 ? '#00ff88' : '#ffaa00'};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">⬆ ${t._hard_ceiling}¢</span>` : ''}
                            ${t._width_range ? `<span style="color:#555;font-size:9px;">Widths: ${t._width_range}</span>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <div style="color:${pnlCol};font-weight:800;font-size:16px;">${pnl >= 0 ? '+' : ''}${pnl}¢</div>
                            <div style="color:${pnlCol};font-size:10px;">$${(pnl/100).toFixed(2)}</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:16px;font-size:11px;margin-bottom:6px;flex-wrap:wrap;">
                        ${isSellback ? (() => {
                            const filledSide = (t.exit_via || '').includes('yes') ? 'YES' : 'NO';
                            const filledPrice = filledSide === 'YES' ? t.yes_price : t.no_price;
                            const otherBid = filledSide === 'YES' ? t.no_price : t.yes_price;
                            const sellPrice = t.sell_back_price || t.sell_price || filledPrice || 0;
                            return `<span style="color:#ff8800;">Filled ${filledSide}: <strong>${filledPrice}¢</strong></span>
                                <span style="color:#ff4444;">Sold back @<strong>${sellPrice}¢</strong></span>
                                <span style="color:#555;">Other side bid: ${otherBid}¢ (too expensive)</span>
                                <span style="color:#8892a6;">×${t.quantity} contracts</span>`;
                        })() : `
                        <span style="color:#00ff88;">Avg YES: <strong>${t.yes_price}¢</strong></span>
                        <span style="color:#ff4444;">Avg NO: <strong>${t.no_price}¢</strong></span>
                        <span style="color:#8892a6;">Combined: <strong style="color:${totalCost <= 100 ? '#00ff88' : '#ff4444'};">${totalCost}¢</strong></span>
                        <span style="color:#8892a6;">×${t.quantity} contracts</span>`}
                    </div>
                    <div style="display:flex;gap:12px;font-size:10px;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="color:#555;">Fees: ${t.fee_cents}¢</span>
                        <span style="color:#555;">Placed: ${sPlacedTime || '—'}</span>
                        <span style="color:#555;">Done: ${sTime} · ${sDate}</span>
                        ${hedgeSpeedHtml ? `<span>${hedgeSpeedHtml}</span>` : ''}
                    </div>
                    ${rungRows ? `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px;border-top:1px solid #1e2740;">${rungRows}</div>` : ''}
                    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;padding-top:4px;border-top:1px solid #1e274033;">
                        <span style="color:#3a4560;font-size:9px;font-family:monospace;">${t.bot_id.slice(-12)}</span>
                        <button onclick="navigator.clipboard.writeText('${t.bot_id}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:9px;padding:0;color:#3a4560;" title="Copy bot ID">📋</button>
                    </div>
                </div>`;
            }

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
                         || t.result === 'manual_exit_completed'
                         || t.result === 'anchor_dog_complete';
            const isSL = t.result?.includes('stop_loss') || t.result?.includes('flip_');
            const isAnchorSellback = t.result === 'anchor_sellback' || t.result === 'ladder_sellback';
            const isApexSellback = t.result === 'apex_sellback';
            const isCeilingExit = t.result === 'hard_ceiling_sellback';
            const isSettledWin = t.result === 'settled_win_yes' || t.result === 'settled_win_no';
            const isSettledLoss = t.result === 'settled_loss_yes' || t.result === 'settled_loss_no';
            const isManualExit = t.result?.startsWith('manual_exit');
            const isRebalancerScrape = t.result === 'rebalancer_scrape';
            // Timeout amend: both legs completed via amend after one leg timed out
            // Still detect for detailed analytics display, but result label is just 'FILLED'
            const isTimeoutExit = t.exit_via === 'timeout_amend' || t.exit_via === 'amend_fallback'
                                || t.result === 'timeout_exit_yes' || t.result === 'timeout_exit_no'
                                || t.result === 'amended' || t.result === 'arb_loss';
            // P&L: for timeout amend trades, recalculate from leg prices to fix stale 0-profit records
            let pnl;
            if (isTimeoutExit && t.yes_price && t.no_price) {
                // Always derive from actual leg prices: profit = (100 - yes - no) × qty
                pnl = (100 - (t.yes_price || 0) - (t.no_price || 0)) * (t.quantity || 1);
            } else if (isWin || isTimeoutExit) {
                pnl = (t.profit_cents || 0);
            } else if (isManualExit && !t.loss_cents) {
                pnl = (t.profit_cents || 0);
            } else if (isRebalancerScrape) {
                pnl = t.profit_cents ? t.profit_cents : -(t.loss_cents || 0);
            } else {
                pnl = -(t.loss_cents || 0);
            }
            const isSettled = isSettledWin || isSettledLoss;
            const pnlColor = isSettledWin ? '#00e5ff' : (isSettledLoss ? '#ff8800' : (pnl >= 0 ? '#00ff88' : '#ff4444'));
            const icon = isSettledWin ? '🏆' : (isSettledLoss ? '🏁' : (pnl >= 0 ? '✅' : '⛔'));
            const isFlip = t.result?.includes('flip_');
            const resultLabel = isSettledWin ? 'SETTLED WIN' : (isSettledLoss ? 'SETTLED LOSS' : (isRebalancerScrape ? 'REBALANCER' : (isApexSellback ? 'APEX SELLBACK' : (isAnchorSellback ? (t.result === 'ladder_arb_sellback' ? 'SELLBACK' : 'ANCHOR SELLBACK') : (isCeilingExit ? 'CEILING EXIT' : (isManualExit ? 'MANUAL EXIT' : (pnl < 0 ? 'AMENDED' : (isTimeoutExit ? 'AMENDED' : (isWin ? 'FILLED' : (isFlip ? 'FLIPPED' : (isSL ? 'STOP LOSS' : 'STOPPED')))))))))));
            const borderColor = isSettledWin ? '#00e5ff33' : (isSettledLoss ? '#ff880033' : ((isApexSellback || isAnchorSellback || isCeilingExit) ? '#ffaa0033' : (isTimeoutExit ? (pnl >= 0 ? '#ffaa0022' : '#ff880033') : ((isWin) ? (pnl >= 0 ? '#00ff8822' : '#ff444422') : '#ff444422'))));
            const settleBadge = isSettled ? `<span style="background:${isSettledWin ? '#00e5ff22' : '#ff880022'};color:${isSettledWin ? '#00e5ff' : '#ff8800'};padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">⚖️ SETTLEMENT</span>` : '';
            
            // Display name
            const teamName = formatBotDisplayName(t.ticker || '', t.spread_line || '');
            
            // Verified badge
            const verified = t.verified_prices || t.verified_cleared ? '<span style="color:#00ff88;font-size:9px;margin-left:4px;">✓ verified</span>' : '';
            
            // Trade type
            const isAnchorTrade = t.bot_category === 'anchor_dog' || t.fill_source === 'anchor_dog';
            const isLadderArbTrade = t.bot_category === 'ladder_arb' || t.fill_source === 'ladder_arb';
            const tradeType = t.type === 'watch' ? 'WATCH' : (isAnchorTrade ? 'PHANTOM' : 'APEX');
            const typeColor = t.type === 'watch' ? '#ffaa00' : (isAnchorTrade ? '#ffaa00' : '#00aaff');

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
            } else if (t.yes_price || t.no_price) {
                const parts = [];
                if (isAnchorSellback && t.filled_side && t.avg_fill_price) {
                    // Sellback: show buy avg → sell price, not YES+NO arb total
                    const side = t.filled_side.toUpperCase();
                    const sideCol = t.filled_side === 'yes' ? '#00ff88' : '#ff4444';
                    const avgBuy = t.avg_fill_price || 0;
                    const sellAt = t.sell_price || 0;
                    const diff = sellAt - avgBuy;
                    const diffCol = diff >= 0 ? '#00ff88' : '#ff4444';
                    parts.push(`<span style="color:#8892a6;">Bought <strong style="color:${sideCol}">${side}</strong> avg <strong style="color:#fff">${avgBuy}¢</strong> × ${t.quantity || 1}</span>`);
                    parts.push(`<span style="color:#8892a6;">Sold back @ <strong style="color:#ffaa00">${sellAt}¢</strong></span>`);
                    parts.push(`<span style="color:${diffCol};font-weight:700;">${diff >= 0 ? '+' : ''}${diff}¢/contract</span>`);
                    if (phase) parts.push(`<span style="background:${phase === 'live' ? '#00ff8822' : '#8892a622'};color:${phase === 'live' ? '#00ff88' : '#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${phase.toUpperCase()}</span>`);
                } else {
                    // Unified arb detail row — same format for all arbs (clean fills and amended)
                    const leg = (t.first_leg || 'yes').toUpperCase();
                    const otherLeg = leg === 'YES' ? 'NO' : 'YES';
                    const firstFillPrice = leg === 'YES' ? (t.original_yes || t.yes_price || 0) : (t.original_no || t.no_price || 0);
                    const secondFillPrice = leg === 'YES' ? (t.no_price || 0) : (t.yes_price || 0);
                    const originalPending = leg === 'YES' ? (t.original_no || 0) : (t.original_yes || 0);
                    const totalCost = (t.yes_price || 0) + (t.no_price || 0);
                    const isFav = firstFillPrice >= secondFillPrice;

                    parts.push(`<span style="color:#8892a6;"><strong style="color:${leg==='YES'?'#00ff88':'#ff4444'}">${leg}</strong> @ <strong style="color:#fff">${firstFillPrice}¢</strong> <span style="color:#ffaa00">(${isFav ? 'fav' : 'dog'})</span></span>`);
                    parts.push(`<span style="color:#8892a6;"><strong style="color:${otherLeg==='YES'?'#00ff88':'#ff4444'}">${otherLeg}</strong> @ <strong style="color:#fff">${secondFillPrice}¢</strong>${isTimeoutExit && originalPending && originalPending !== secondFillPrice ? ` <span style="color:#555">(was ${originalPending}¢)</span>` : ''}</span>`);
                    parts.push(`<span style="color:#8892a6;">Total: <strong style="color:${totalCost <= 100 ? '#00ff88' : '#ff4444'}">${totalCost}¢</strong>/100¢</span>`);
                    if (durStr) parts.push(`<span style="color:#8892a6;">Fill: <strong style="color:#fff;">${durStr}</strong></span>`);
                    if (isTimeoutExit && t.timeout_min) parts.push(`<span style="color:#8892a6;">⏱ ${t.timeout_min}m timeout</span>`);
                    if (phase) parts.push(`<span style="background:${phase === 'live' ? '#00ff8822' : '#8892a622'};color:${phase === 'live' ? '#00ff88' : '#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${phase.toUpperCase()}</span>`);
                }
                // Ladder-arb rungs detail
                if (isLadderArbTrade && t.rungs_detail && t.rungs_detail.length > 0) {
                    const rungParts = t.rungs_detail.map(r => {
                        const yp = r.yes_price || r.price || 0;
                        const np = r.no_price || 0;
                        const w = r.width || 0;
                        return `<span style="color:#8892a6;">${w ? w + '¢: ' : ''}Y${yp}+N${np}</span>`;
                    }).join(' · ');
                    parts.push(`<span style="color:#ffaa00;">🪜 ${t.rungs_filled || t.rungs_detail.length}/${t.rungs_total || t.rungs_detail.length} rungs</span>`);
                    analyticsRow = `<div style="display:flex;gap:12px;font-size:10px;margin-top:4px;flex-wrap:wrap;">${parts.join('')}</div>
                        <div style="font-size:9px;margin-top:2px;color:#555;">${rungParts}</div>`;
                } else {
                    analyticsRow = `<div style="display:flex;gap:12px;font-size:10px;margin-top:4px;flex-wrap:wrap;">${parts.join('')}</div>`;
                }
            }
            
            return `
                <div style="background:#0f1419;border:1px solid ${borderColor};border-radius:8px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
                            ${isLadderArbTrade ? '<svg width="18" height="18" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 3px #00aaff44);"><polygon points="12,2 22,20 2,20" fill="none" stroke="#00aaff" stroke-width="2" stroke-linejoin="round"/><polygon points="12,8 17,17 7,17" fill="#00aaff33" stroke="#00aaff" stroke-width="1" stroke-linejoin="round"/><circle cx="12" cy="13" r="1.5" fill="#00aaff"/></svg>' : `<span style="font-size:14px;">${icon}</span>`}
                            <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                            <span style="background:${typeColor}22;color:${typeColor};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${isLadderArbTrade ? '△ APEX' : tradeType}</span>
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
                        ${(() => {
                            const idBtn = (label, id, color) => `<span style="display:inline-flex;align-items:center;gap:2px;"><span style="color:${color};">${label}: ${id.slice(-8)}</span><button onclick="event.stopPropagation();navigator.clipboard.writeText('${id}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:8px;padding:0;color:#3a4560;" title="Copy ${label} ID: ${id}">📋</button></span>`;
                            const ids = [
                                t.yes_order_id && idBtn('Y', t.yes_order_id, '#00ff88'),
                                t.no_order_id && idBtn('N', t.no_order_id, '#ff4444'),
                                t.dog_order_id && idBtn('Dog', t.dog_order_id, '#ffaa00'),
                                t.fav_order_id && idBtn('Fav', t.fav_order_id, '#aa66ff'),
                                t.hedge_order_id && idBtn('Hedge', t.hedge_order_id, '#00aaff'),
                            ].filter(Boolean);
                            return ids.length ? `<div style="font-size:9px;margin-top:2px;color:#555;display:flex;flex-wrap:wrap;gap:4px 10px;">${ids.join('')}</div>` : '';
                        })()}
                        <div style="display:flex;gap:12px;font-size:11px;margin-top:4px;flex-wrap:wrap;">
                            ${isAnchorSellback && t.filled_side && t.avg_fill_price ? `
                                <span style="color:${t.filled_side==='yes'?'#00ff88':'#ff4444'};">${t.filled_side.toUpperCase()} avg ${t.avg_fill_price}¢</span>
                                <span style="color:#ffaa00;">→ sold ${t.sell_price || '?'}¢</span>
                                <span style="color:#8892a6;">×${t.quantity || 1}</span>
                                <span style="color:#555;">Cost $${((t.avg_fill_price||0) * (t.quantity||1) / 100).toFixed(2)}</span>
                            ` : `
                                ${t.type === 'watch' && t.entry_price ? `<span style="color:${(t.side||'yes')==='yes'?'#00ff88':'#ff4444'};">${(t.side||'YES').toUpperCase()} Entry ${t.entry_price}¢${t.sell_price ? ` <span style="color:#ffaa00;">→ exit ${t.sell_price}¢</span>` : ''}</span>` : ''}
                                ${t.type !== 'watch' && t.yes_price ? `<span style="color:#00ff88;">YES ${t.yes_price}¢${(t.sell_price_yes || (t.result==='manual_exit_yes' && t.sell_price)) ? ` <span style="color:#ffaa00;">→ ${t.sell_price_yes || t.sell_price}¢</span>` : ''}</span>` : ''}
                                ${t.type !== 'watch' && t.no_price ? `<span style="color:#ff4444;">NO ${t.no_price}¢${(t.sell_price_no || (t.result==='manual_exit_no' && t.sell_price)) ? ` <span style="color:#ffaa00;">→ ${t.sell_price_no || t.sell_price}¢</span>` : ''}</span>` : ''}
                                ${t.exit_bid ? `<span style="color:#ffaa00;">Exit ${t.exit_bid}¢</span>` : ''}
                                <span style="color:#8892a6;">×${t.quantity || 1}</span>
                                ${t.type !== 'watch' ? `<span style="color:#555;">Cost $${(((t.yes_price||0) + (t.no_price||0)) * (t.quantity||1) / 100).toFixed(2)}</span>` : `<span style="color:#555;">Cost $${((t.entry_price||0) * (t.quantity||1) / 100).toFixed(2)}</span>`}
                            `}
                        </div>
                        ${analyticsRow}
                    </div>
                    <div style="text-align:right;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
                        <div style="color:${pnlColor};font-weight:800;font-size:16px;">${pnl >= 0 ? '+' : ''}${pnl}¢</div>
                        <div style="color:${pnlColor};font-size:10px;font-weight:600;">${resultLabel}</div>
                    </div>
                ${t.bot_id ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;padding-top:4px;border-top:1px solid #1e274033;grid-column:1/-1;">
                    <span style="color:#3a4560;font-size:9px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.bot_id.slice(-12)}</span>
                    <button onclick="navigator.clipboard.writeText('${t.bot_id}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:9px;padding:0;color:#3a4560;" title="Copy bot ID">📋</button>
                </div>` : ''}
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
    if (historyViewMode === 'middle')  { loadMiddleHistory();   return; }
    loadHistoryStats();
    loadPnLCalendar();
    loadTradeHistoryList();
}

// ── Straight Bets history ───────────────────────────────────────────────────
async function loadBetsHistory() {
    const calPanel = document.getElementById('bets-pnl-calendar-panel');
    const statsEl = document.getElementById('bets-stats-panel');
    const sportEl = document.getElementById('bets-sport-panel');
    const listEl  = document.getElementById('bets-history-list');
    if (!listEl) return;
    try {
        const dateParam = selectedHistoryDays.length ? `&dates=${selectedHistoryDays.join(',')}` : '';
        const resp = await fetch(`${API_BASE}/bot/history?limit=500&category=watch${dateParam}`);
        const data = await resp.json();
        const trades = (data.trades || []).filter(t => t.type === 'watch');

        // ── Calendar (all bets, ignore date filter) ──
        if (calPanel) {
            try {
                const calResp = await fetch(`${API_BASE}/bot/history?limit=5000&category=watch`);
                const calData = await calResp.json();
                const allBets = (calData.trades || []).filter(t => t.type === 'watch');
                const dayMap = {};
                allBets.forEach(t => {
                    const d = new Date((t.timestamp||0) * 1000);
                    const key = _localDateStr(d);
                    if (!dayMap[key]) dayMap[key] = { date: key, net_cents: 0, wins: 0, losses: 0, trades: 0 };
                    const net = (t.profit_cents||0) - (t.loss_cents||0);
                    dayMap[key].net_cents += net;
                    dayMap[key].trades++;
                    if (net >= 0) dayMap[key].wins++; else dayMap[key].losses++;
                });
                const days = Object.values(dayMap).sort((a,b) => a.date.localeCompare(b.date));
                renderPnLCalendar(calPanel, days);
            } catch (_) { calPanel.innerHTML = ''; }
        }

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

        // Fetch /api/pnl for lifetime + daily cards
        let pnl = {};
        try { const pnlResp = await fetch(`${API_BASE}/pnl`); pnl = await pnlResp.json(); } catch (_) {}
        const ltNet = pnl.lifetime_bet_net_cents || 0;
        const ltCol = ltNet >= 0 ? '#00ff88' : '#ff4444';
        const dNet_bet = pnl.bet_net_cents || 0;
        const dCol_bet = dNet_bet >= 0 ? '#00ff88' : '#ff4444';

        if (statsEl) {
            statsEl.innerHTML = trades.length === 0
                ? '<p style="color:#555;text-align:center;font-size:12px;">No straight bets recorded yet.</p>'
                : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:8px;">
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Lifetime P&amp;L</div>
                        <div style="color:${ltCol};font-size:24px;font-weight:800;">${ltNet>=0?'+':''}$${(ltNet/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${(pnl.lifetime_bet_wins||0)}W / ${(pnl.lifetime_bet_losses||0)}L</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Daily P&amp;L <span style="font-size:8px;color:#555;">${pnl.day_key||''}</span></div>
                        <div style="color:${dCol_bet};font-size:24px;font-weight:800;">${dNet_bet>=0?'+':''}$${(dNet_bet/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${(pnl.bet_wins||0)}W / ${(pnl.bet_losses||0)}L today</div>
                    </div>
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
                        ${t.exit_price || t.sl_sell_price ? `<span style="color:#8892a6;">→ ${t.exit_price || t.sl_sell_price}¢</span>` : ''}
                        <span style="color:#8892a6;">×${t.quantity||1}</span>
                        ${t.stop_loss_cents ? `<span style="color:#ff4444;font-size:10px;">SL: ${t.stop_loss_cents}¢</span>` : ''}
                        ${t.take_profit_cents ? `<span style="color:#00ff88;font-size:10px;">TP: ${t.take_profit_cents}¢</span>` : ''}
                        ${t.fee_cents ? `<span style="color:#555;font-size:10px;">Fee: ${t.fee_cents}¢</span>` : ''}
                    </div>
                    <div style="color:#555;font-size:10px;margin-top:4px;">${dateStr}${t.fill_duration_s ? ` · ${t.fill_duration_s < 60 ? t.fill_duration_s + 's' : Math.floor(t.fill_duration_s/60) + 'm ' + (t.fill_duration_s%60) + 's'}` : ''}</div>
                    ${t.bot_id ? `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;"><span style="color:#3a4560;font-size:9px;font-family:monospace;">${(t.bot_id||'').slice(-12)}</span><button onclick="navigator.clipboard.writeText('${t.bot_id}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:9px;padding:0;color:#3a4560;" title="Copy bot ID">📋</button></div>` : ''}
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

// ── Meridian history ─────────────────────────────────────────────────────────
async function loadMiddleHistory() {
    const calPanel = document.getElementById('middle-pnl-calendar-panel');
    const statsEl = document.getElementById('middle-stats-panel');
    const listEl  = document.getElementById('middle-history-list');
    if (!listEl) return;
    try {
        const dateParam = selectedHistoryDays.length ? `&dates=${selectedHistoryDays.join(',')}` : '';
        const resp = await fetch(`${API_BASE}/bot/history?limit=500&category=middle${dateParam}`);
        const data = await resp.json();
        const trades = (data.trades || []).filter(t => t.type === 'middle');

        // ── Calendar (all middles, ignore date filter) ──
        if (calPanel) {
            try {
                const calResp = await fetch(`${API_BASE}/bot/history?limit=5000&category=middle`);
                const calData = await calResp.json();
                const allMiddle = (calData.trades || []).filter(t => t.type === 'middle');
                const dayMap = {};
                allMiddle.forEach(t => {
                    const d = new Date((t.timestamp||0) * 1000);
                    const key = _localDateStr(d);
                    if (!dayMap[key]) dayMap[key] = { date: key, net_cents: 0, wins: 0, losses: 0, trades: 0 };
                    const net = (t.profit_cents||0) - (t.loss_cents||0);
                    dayMap[key].net_cents += net;
                    dayMap[key].trades++;
                    if (net >= 0) dayMap[key].wins++; else dayMap[key].losses++;
                });
                const days = Object.values(dayMap).sort((a,b) => a.date.localeCompare(b.date));
                renderPnLCalendar(calPanel, days);
            } catch (_) { calPanel.innerHTML = ''; }
        }

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

        // Fetch /api/pnl for lifetime + daily cards
        let pnl = {};
        try { const pnlResp = await fetch(`${API_BASE}/pnl`); pnl = await pnlResp.json(); } catch (_) {}
        const mLtNet = pnl.lifetime_mid_net_cents || 0;
        const mLtCol = mLtNet >= 0 ? '#00ff88' : '#ff4444';
        const mDNet = pnl.mid_net_cents || 0;
        const mDCol = mDNet >= 0 ? '#00ff88' : '#ff4444';

        if (statsEl) {
            statsEl.innerHTML = trades.length === 0
                ? '<p style="color:#555;text-align:center;font-size:12px;">No middles recorded yet. Launch a middle bot from the Middles scanner to start tracking.</p>'
                : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Lifetime P&amp;L</div>
                        <div style="color:${mLtCol};font-size:24px;font-weight:800;">${mLtNet>=0?'+':''}$${(mLtNet/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${(pnl.lifetime_mid_wins||0)}W / ${(pnl.lifetime_mid_losses||0)}L</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Daily P&amp;L <span style="font-size:8px;color:#555;">${pnl.day_key||''}</span></div>
                        <div style="color:${mDCol};font-size:24px;font-weight:800;">${mDNet>=0?'+':''}$${(mDNet/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${(pnl.mid_wins||0)}W / ${(pnl.mid_losses||0)}L today</div>
                    </div>
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

        listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">${trades.filter(t => t.result !== 'rebalancer_enhance').slice(0,50).map(t => {
            const dt = new Date(t.timestamp * 1000);
            const dateStr = dt.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const isPend  = t.status === 'pending';
            const isHit   = t.middle_hit === true;
            const isArbW  = t.result === 'arb_win';
            const isScrape  = t.result === 'rebalancer_scrape';
            const isEnhance = false; // enhance is now merged into settlement card
            const hasRebal  = !!t.rebalancer_sold_leg; // rebalancer info on settlement card
            const isLoss  = t.result === 'loss';
            const net = (t.profit_cents||0) - (t.loss_cents||0);
            const netCol = isPend ? '#ffaa00' : net >= 0 ? '#00ff88' : '#ff4444';
            const statusIcon  = isPend ? '⏳' : isHit ? '🎯' : (isArbW && hasRebal) ? '💰' : isArbW ? '✅' : isScrape ? '🔄' : '⛔';
            const statusLabel = isPend ? 'PENDING' : isHit ? 'MIDDLE HIT' : (isArbW && hasRebal) ? 'ARB WIN + ENHANCED' : isArbW ? 'ARB WIN' : isScrape ? 'SOLD BACK' : 'LOSS';
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
            const l1Col = l1Res === 'win' ? '#00ff88' : l1Res === 'sold_early' ? '#ff8800' : l1Res === 'loss' ? '#ff4444' : '#8892a6';
            const l2Col = l2Res === 'win' ? '#00ff88' : l2Res === 'sold_early' ? '#ff8800' : l2Res === 'loss' ? '#ff4444' : '#8892a6';
            // Header label: team names if bot trade, else generic
            const matchupLabel = isBot && t.team_a_name && t.team_b_name
                ? `${t.team_a_name} vs ${t.team_b_name}`
                : 'Meridian Trade';
            // Window calc: use arb_width if set, else calculate from fill prices
            let arbW = t.arb_width || 0;
            const priceA = parseInt(l1.price) || 0;
            const priceB = parseInt(l2.price) || 0;
            if (arbW === 0 && priceA > 0 && priceB > 0) arbW = 100 - priceA - priceB;
            const totalCost = priceA + priceB;
            const arbLabel = arbW > 0
                ? `<span style="color:#aa66ff;font-weight:700;">Arb: +${arbW}¢</span>`
                : arbW === 0
                ? `<span style="color:#8892a6;">Arb: break-even</span>`
                : `<span style="color:#ffaa00;font-weight:700;">Cost: ${Math.abs(arbW)}¢</span>`;
            // Filled status
            const l1Filled = l1Res === 'win' || l1Res === 'loss' || l1Res === 'sold_early' || (priceA > 0 && l1Res !== null);
            const l2Filled = l2Res === 'win' || l2Res === 'loss' || l2Res === 'sold_early' || (priceB > 0 && l2Res !== null);
            // Bot ID
            const botIdHtml = t.bot_id ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:6px;border-top:1px solid #1e274033;">
                <span style="color:#3a4560;font-size:9px;font-family:monospace;">${(t.bot_id||'').slice(-12)}</span>
                <button onclick="navigator.clipboard.writeText('${t.bot_id}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:9px;padding:0;color:#3a4560;" title="Copy bot ID">📋</button>
            </div>` : '';
            // Timing
            const placedDt = t.placed_at ? new Date(t.placed_at * 1000) : null;
            const placedTime = placedDt ? placedDt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
            // Individual leg P&L
            const l1Pnl = l1Filled && l1Res ? (l1Res === 'win' ? (100 - priceA) * (l1.qty||1) : -(priceA) * (l1.qty||1)) : null;
            const l2Pnl = l2Filled && l2Res ? (l2Res === 'win' ? (100 - priceB) * (l2.qty||1) : -(priceB) * (l2.qty||1)) : null;
            // Order IDs
            const orderA = t.order_a_id || t.yes_order_id || '';
            const orderB = t.order_b_id || t.no_order_id || '';
            // Game ID for Kalshi link
            const gameId = t.game_id || '';
            return `<div style="background:#0f1419;border:1px solid ${borderCol};border-top:3px solid ${isHit ? '#aa66ff' : borderCol};border-radius:10px;padding:14px;">
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:15px;">${statusIcon}</span>
                        <span style="color:#aa66ff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;">${matchupLabel}</span>
                        ${isHit ? '<span style="background:#aa66ff22;color:#cc88ff;padding:2px 8px;border-radius:4px;font-weight:700;font-size:10px;">MIDDLE HIT</span>' : ''}
                        ${t.spread_a && t.spread_b ? `<span style="color:#555;font-size:9px;">+${t.spread_a} / +${t.spread_b}</span>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="color:${netCol};font-weight:800;font-size:18px;">${isPend ? '—' : (net>=0?'+':'') + net + '¢'}</div>
                        <div style="color:${netCol};font-size:10px;font-weight:700;">${statusLabel}</div>
                        ${!isPend && totalCost > 0 ? `<div style="color:${netCol};font-size:9px;">$${(net/100).toFixed(2)}</div>` : ''}
                    </div>
                </div>
                ${(isScrape || isEnhance) ? (() => {
                    // Rebalancer trades: show BOTH legs side by side (filled + unfilled)
                    // with the rebalancer sell-back info inside the filled leg's box
                    const fLeg = t.filled_leg || 'a';
                    const buyPrice = t.fill_price || t.target_price || '?';
                    const sellPrice = t.sl_sell_price || '?';
                    const qty = t.qty || 1;
                    const sellProfit = sellPrice !== '?' && buyPrice !== '?' ? (sellPrice - buyPrice) * qty : null;
                    // Build both legs with correct labels
                    const legA = {
                        label: t.team_b_name ? `${t.team_b_name} +${t.spread_a||''}` : (t.ticker_a || 'Leg A'),
                        price: fLeg === 'a' ? buyPrice : (t.target_price || '?'),
                        filled: fLeg === 'a',
                        qty: qty,
                    };
                    const legB = {
                        label: t.team_a_name ? `${t.team_a_name} +${t.spread_b||''}` : (t.ticker_b || 'Leg B'),
                        price: fLeg === 'b' ? buyPrice : (t.target_price || '?'),
                        filled: fLeg === 'b',
                        qty: qty,
                    };
                    const filledLeg = fLeg === 'a' ? legA : legB;
                    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                        ${[legA, legB].map(leg => {
                            const isFilled = leg.filled;
                            const borderCol = isFilled ? '#aa66ff88' : '#333';
                            const fillPct = isFilled ? 100 : 0;
                            const fillCol = isFilled ? '#aa66ff' : '#333';
                            const statusBadge = isFilled ? '<span style="background:#aa66ff22;color:#aa66ff;font-size:8px;font-weight:700;padding:1px 6px;border-radius:4px;">FILLED</span>'
                                : '<span style="background:#33333388;color:#555;font-size:8px;font-weight:700;padding:1px 6px;border-radius:4px;">NOT FILLED</span>';
                            return `<div style="background:#0a0e1a;border:2px solid ${borderCol};border-radius:8px;padding:10px;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                    <span style="color:${isFilled ? '#aa66ff' : '#555'};font-size:9px;font-weight:800;">NO · BOUGHT</span>
                                    ${statusBadge}
                                </div>
                                <div style="color:${isFilled ? '#fff' : '#555'};font-size:12px;font-weight:600;margin-bottom:4px;">${leg.label}</div>
                                <div style="display:flex;gap:6px;align-items:center;font-size:11px;">
                                    <span style="color:${isFilled ? '#fff' : '#555'};font-weight:700;">@ ${leg.price}¢</span>
                                    <span style="color:#8892a6;">×${leg.qty}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                                    <div style="flex:1;height:5px;background:#1a2540;border-radius:3px;overflow:hidden;">
                                        <div style="width:${fillPct}%;height:100%;background:${fillCol};border-radius:3px;"></div>
                                    </div>
                                    <span style="color:${isFilled ? '#aa66ff' : '#555'};font-weight:700;font-size:9px;">${isFilled ? leg.qty : 0}/${leg.qty}${isFilled ? ' ✓' : ''}</span>
                                </div>
                                ${isFilled ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e2740;">
                                    <div style="color:${isScrape ? '#ff8800' : '#00ff88'};font-size:9px;font-weight:800;margin-bottom:4px;">${isScrape ? '🔄 REBALANCER SOLD' : '💰 ENHANCED'}</div>
                                    <div style="display:flex;gap:6px;align-items:center;font-size:11px;">
                                        <span style="color:#fff;font-weight:700;">@ ${sellPrice}¢</span>
                                        <span style="color:#8892a6;">×${qty}</span>
                                    </div>
                                    ${sellProfit !== null ? `<div style="color:${sellProfit >= 0 ? '#00ff88' : '#ff4444'};font-size:10px;font-weight:700;margin-top:4px;">${sellProfit >= 0 ? '+' : ''}${sellProfit}¢ ${sellProfit >= 0 ? 'recovered' : 'lost'}</div>` : ''}
                                </div>` : ''}
                            </div>`;
                        }).join('')}
                    </div>`;
                })() : `<!-- Side by side legs -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                    ${[{l: l1, res: l1Res, col: l1Col, filled: l1Filled, pnl: l1Pnl, teamOwn: t.team_b_name, teamOpp: t.team_a_name, spread: t.spread_a, origLabel: `NO ${t.team_a_name||''} +${t.spread_a||'?'}`, legKey: 'a'},
                       {l: l2, res: l2Res, col: l2Col, filled: l2Filled, pnl: l2Pnl, teamOwn: t.team_a_name, teamOpp: t.team_b_name, spread: t.spread_b, origLabel: `NO ${t.team_b_name||''} +${t.spread_b||'?'}`, legKey: 'b'}
                    ].map((leg, idx) => {
                        const isSoldEarly = leg.res === 'sold_early';
                        const soldPrice = isSoldEarly && t.rebalancer_sold_leg === leg.legKey ? t.rebalancer_sell_price : null;
                        const fillPct = leg.filled ? 100 : 0;
                        const fillCol = leg.filled ? (leg.res === 'win' ? '#00ff88' : isSoldEarly ? '#ff8800' : '#ff4444') : '#333';
                        const borderC = leg.filled ? leg.col + '88' : '#1e274044';
                        // Reverse display: show "TeamOwn +spread" as main, original underneath
                        const mainLabel = leg.teamOwn ? `${leg.teamOwn} +${leg.spread||'?'}` : (leg.l.title || '—');
                        // P&L for sold-early: (sell_price - buy_price) × qty
                        const legPnl = isSoldEarly && soldPrice !== null ? (soldPrice - (parseInt(leg.l.price)||0)) * (leg.l.qty||1) : leg.pnl;
                        return `<div style="background:#0a0e1a;border:2px solid ${borderC};border-radius:8px;padding:10px;${!leg.filled ? 'opacity:0.5;' : ''}">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <span style="color:#aa66ff;font-size:9px;font-weight:800;">NO</span>
                                ${leg.filled ? `<span style="background:${leg.col}22;color:${leg.col};font-size:8px;font-weight:700;padding:1px 6px;border-radius:4px;">${leg.res === 'win' ? '✓ WON' : isSoldEarly ? '💰 SOLD' : '✗ LOST'}</span>` : '<span style="color:#555;font-size:8px;">—</span>'}
                            </div>
                            <div style="color:#fff;font-size:12px;font-weight:600;margin-bottom:2px;">${mainLabel}</div>
                            <div style="color:#555;font-size:8px;margin-bottom:6px;">${leg.origLabel}</div>
                            <div style="display:flex;gap:6px;align-items:center;font-size:11px;margin-bottom:4px;">
                                <span style="color:#fff;font-weight:700;">@ ${leg.l.price||'?'}¢</span>
                                <span style="color:#8892a6;">×${leg.l.qty||'?'}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                                <div style="flex:1;height:5px;background:#1a2540;border-radius:3px;overflow:hidden;">
                                    <div style="width:${fillPct}%;height:100%;background:${fillCol};border-radius:3px;"></div>
                                </div>
                                <span style="color:${fillCol};font-weight:700;font-size:9px;">${leg.filled ? (leg.l.qty||1)+'/'+(leg.l.qty||1)+' ✓' : '0/'+(leg.l.qty||'?')}</span>
                            </div>
                            ${isSoldEarly && soldPrice !== null ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #1e2740;">
                                <div style="color:#ff8800;font-size:9px;font-weight:800;margin-bottom:3px;">💰 REBALANCER SOLD</div>
                                <div style="color:#fff;font-size:11px;font-weight:700;">@ ${soldPrice}¢ <span style="color:#8892a6;font-weight:400;">×${leg.l.qty||1}</span></div>
                                <div style="color:${(soldPrice||0) > 0 ? '#00ff88' : '#ff4444'};font-size:10px;font-weight:700;margin-top:2px;">+${(soldPrice||0) * (leg.l.qty||1)}¢ recovered</div>
                            </div>` : ''}
                            ${!isSoldEarly && legPnl !== null ? `<div style="color:${legPnl >= 0 ? '#00ff88' : '#ff4444'};font-size:10px;font-weight:700;">${legPnl >= 0 ? '+' : ''}${legPnl}¢</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>`}
                <!-- Trade details -->
                <div style="display:flex;gap:12px;font-size:11px;flex-wrap:wrap;padding-top:8px;border-top:1px solid #1e2740;align-items:center;">
                    ${isScrape
                        ? `<span style="color:${net >= 0 ? '#00ff88' : '#ff4444'};font-weight:700;">Rebalancer exit: ${net >= 0 ? '+' : ''}${net}¢</span>
                           <span style="color:#8892a6;">Bought @ ${t.fill_price||t.target_price||'?'}¢ · Sold @ ${t.sl_sell_price||'?'}¢</span>`
                        : `${arbLabel}
                           ${hasRebal && t.rebalancer_recovery_cents ? `<span style="color:#ff8800;font-weight:700;">Recovery: +${t.rebalancer_recovery_cents}¢</span>` : ''}
                           ${totalCost > 0 ? `<span style="color:#8892a6;">Cost/ct: ${totalCost}¢ ($${(totalCost * (l1.qty||1) / 100).toFixed(2)})</span>` : ''}`}
                    <span style="color:#8892a6;">×${l1.qty || t.qty || '?'}</span>
                </div>
                <div style="display:flex;gap:12px;font-size:10px;flex-wrap:wrap;margin-top:6px;color:#555;">
                    ${placedTime ? `<span>Placed: ${placedTime}</span>` : ''}
                    <span>Settled: ${dateStr}</span>
                    ${t.fee_cents ? `<span>Fees: ${t.fee_cents}¢</span>` : ''}
                    ${gameId ? `<span style="font-family:monospace;font-size:8px;">${gameId.split('-').slice(-1)[0]}</span>` : ''}
                </div>
                ${orderA || orderB ? `<div style="font-size:8px;margin-top:4px;color:#3a4560;word-break:break-all;">
                    ${orderA ? `<span>A: ${orderA}</span>` : ''}
                    ${orderA && orderB ? ' · ' : ''}
                    ${orderB ? `<span>B: ${orderB}</span>` : ''}
                </div>` : ''}
                ${botIdHtml}
            </div>`;
        }).join('')}</div>`;
    } catch (e) {
        if (listEl) listEl.innerHTML = `<p style="color:#ff4444;">Failed: ${e.message}</p>`;
    }
}

// ── Dog Bot history ──────────────────────────────────────────────────────────
async function loadDogHistory() {
    const calPanel   = document.getElementById('dog-pnl-calendar-panel');
    const statsPanel = document.getElementById('dog-stats-panel');
    const widthPanel = document.getElementById('dog-width-panel');
    const listEl     = document.getElementById('dog-history-list');
    if (!listEl) return;
    try {
        const dateParam = selectedHistoryDays.length ? `&dates=${selectedHistoryDays.join(',')}` : '';
        const resp = await fetch(`${API_BASE}/bot/history?limit=500&category=anchor_dog,anchor_ladder,anchor_sellback${dateParam}`);
        const data = await resp.json();
        const trades = data.trades || [];

        // ── Calendar (server-side bucketed to match /api/pnl timezone) ──
        if (calPanel) {
            try {
                const calResp = await fetch(`${API_BASE}/pnl/calendar?category=dog`);
                const calData = await calResp.json();
                const days = calData.days || [];
                renderPnLCalendar(calPanel, days);
            } catch (_) { calPanel.innerHTML = ''; }
        }

        // ── Stats panel ──
        if (statsPanel) {
            const totalProfit = trades.reduce((s,t) => s + (t.profit_cents||0), 0);
            const totalLoss   = trades.reduce((s,t) => s + (t.loss_cents||0), 0);
            const totalFees   = trades.reduce((s,t) => s + (t.fee_cents||0), 0);
            const net = totalProfit - totalLoss - totalFees;
            const netCol = net >= 0 ? '#00ff88' : '#ff4444';
            const wins  = trades.filter(t => { const n = (t.profit_cents||0) - (t.loss_cents||0); return n >= 0 && (t.profit_cents||0) > 0; }).length;
            const losses = trades.filter(t => { const n = (t.profit_cents||0) - (t.loss_cents||0); return n < 0; }).length;
            const avgWidth = trades.length > 0 ? (trades.reduce((s,t) => s + (t.arb_width||0), 0) / trades.length).toFixed(1) : '—';
            const sellbacks = trades.filter(t => t.result === 'anchor_sellback' || t.result === 'ladder_sellback').length;
            // Fetch /api/pnl for lifetime + daily cards
            let pnl = {};
            try { const pnlResp = await fetch(`${API_BASE}/pnl`); pnl = await pnlResp.json(); } catch (_) {}
            const dLtNet = pnl.lifetime_dog_net_cents || 0;
            const dLtCol = dLtNet >= 0 ? '#00ff88' : '#ff4444';
            const dDNet = pnl.dog_net_cents || 0;
            const dDCol = dDNet >= 0 ? '#00ff88' : '#ff4444';

            statsPanel.innerHTML = trades.length === 0
                ? '<p style="color:#555;text-align:center;font-size:12px;">No Phantom trades yet.</p>'
                : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Lifetime P&L</div>
                        <div style="color:${dLtCol};font-size:24px;font-weight:800;">${dLtNet>=0?'+':''}$${(dLtNet/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${(pnl.lifetime_dog_wins||0)}W / ${(pnl.lifetime_dog_losses||0)}L</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Daily P&L <span style="font-size:8px;color:#555;">${pnl.day_key||''}</span></div>
                        <div style="color:${dDCol};font-size:24px;font-weight:800;">${dDNet>=0?'+':''}$${(dDNet/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${(pnl.dog_wins||0)}W / ${(pnl.dog_losses||0)}L today</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Net P&L</div>
                        <div style="color:${netCol};font-size:24px;font-weight:800;">${net>=0?'+':''}$${(net/100).toFixed(2)}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${trades.length} trades</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Win Rate</div>
                        <div style="color:#ffaa00;font-size:24px;font-weight:800;">${wins+losses > 0 ? Math.round(wins/(wins+losses)*100) : 0}%</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">${wins}W / ${losses}L</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Avg Width</div>
                        <div style="color:#00aaff;font-size:24px;font-weight:800;">${avgWidth}¢</div>
                    </div>
                    <div style="background:#0f1419;border-radius:8px;padding:14px;text-align:center;border:1px solid #1e2740;">
                        <div style="color:#8892a6;font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Sellbacks</div>
                        <div style="color:#ff4444;font-size:24px;font-weight:800;">${sellbacks}</div>
                        <div style="color:#555;font-size:10px;margin-top:2px;">safety exits</div>
                    </div>
                </div>`;
        }

        // ── Width breakdown ──
        if (widthPanel) {
            const widthMap = {};
            trades.forEach(t => {
                const w = t.arb_width || 0;
                if (!widthMap[w]) widthMap[w] = { width: w, wins: 0, losses: 0, net: 0 };
                const net = (t.profit_cents||0) - (t.loss_cents||0);
                widthMap[w].net += net;
                if (net >= 0) widthMap[w].wins++; else widthMap[w].losses++;
            });
            const widths = Object.values(widthMap).sort((a,b) => a.width - b.width);
            widthPanel.innerHTML = widths.length === 0 ? '' : `
                <h4 style="color:#ffaa00;font-size:12px;font-weight:700;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:.05em;">Width Performance</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;">
                    ${widths.map(w => {
                        const wCol = w.net >= 0 ? '#00ff88' : '#ff4444';
                        const total = w.wins + w.losses;
                        return `<div style="background:#0f1419;border-radius:8px;padding:10px;text-align:center;border:1px solid #1e2740;">
                            <div style="color:#ffaa00;font-size:14px;font-weight:800;">${w.width}¢</div>
                            <div style="color:${wCol};font-size:12px;font-weight:700;">${w.net>=0?'+':''}${w.net}¢</div>
                            <div style="color:#555;font-size:10px;">${w.wins}W/${w.losses}L${total > 0 ? ' · ' + Math.round(w.wins/total*100) + '%' : ''}</div>
                        </div>`;
                    }).join('')}
                </div>`;
        }

        // ── Trade log ──
        if (trades.length === 0) {
            listEl.innerHTML = '<p style="color:#555;text-align:center;padding:24px;">No Phantom trades yet. Deploy a Phantom bot to get started.</p>';
            return;
        }

        listEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">${trades.slice(0,50).map(t => {
            const dt = new Date(t.timestamp * 1000);
            const dateStr = dt.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
            const net = (t.profit_cents||0) - (t.loss_cents||0);
            const isSellback = t.result === 'anchor_sellback' || t.result === 'ladder_sellback';
            const isWin = net > 0;
            const netCol = net > 0 ? '#00ff88' : net < 0 ? '#ff4444' : '#8892a6';
            const icon = isSellback ? (isWin ? '🔄✅' : '🔄') : isWin ? '✅' : '⛔';
            const statusLabel = isSellback ? (isWin ? 'SELLBACK +' : 'SELLBACK') : isWin ? 'COMPLETED' : 'LOSS';
            const borderCol = net > 0 ? '#00ff8822' : net < 0 ? '#ff444422' : '#1e2740';
            const teamName = formatBotDisplayName(t.ticker||'', '');
            const dogSide = t.dog_side || t.first_leg || (t.exit_via === 'sell_back_yes' ? 'yes' : t.exit_via === 'sell_back_no' ? 'no' : 'no');
            const favSide = dogSide === 'yes' ? 'no' : 'yes';
            const dogCol = dogSide === 'yes' ? '#00ff88' : '#ff4444';
            const favCol = favSide === 'yes' ? '#00ff88' : '#ff4444';
            // Use explicit dog_price/fav_price fields, fall back to yes/no_price
            const dogPrice = t.dog_price || t.avg_dog_price || (dogSide === 'yes' ? t.yes_price : t.no_price) || '?';
            const favPrice = t.fav_price || (favSide === 'yes' ? t.yes_price : t.no_price) || '?';
            const phaseBadge = t.game_phase ? `<span style="background:${t.game_phase==='live'?'#00ff8822':'#8892a622'};color:${t.game_phase==='live'?'#00ff88':'#8892a6'};padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;">${t.game_phase.toUpperCase()}</span>` : '';
            const widthBadge = t.arb_width ? `<span style="color:#ffaa00;font-weight:700;">⇄ ${t.arb_width}¢</span>` : '';
            // Rungs detail for ladder trades
            const rungsHtml = (t.rungs_detail && t.rungs_detail.length > 1)
                ? `<div style="color:#8892a6;font-size:9px;margin-top:2px;">${t.rungs_detail.map(r => `${r.price}¢×${r.qty}`).join(' · ')}</div>`
                : '';
            return `<div style="background:#0f1419;border:1px solid ${borderCol};border-radius:10px;padding:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0;filter:drop-shadow(0 0 3px #ffaa0044);"><path d="M12 2C8 2 5 5 5 9c0 2 .8 3.5 2 4.5V16c0 1 .5 2 1.5 2.5L10 22h4l1.5-3.5C16.5 18 17 17 17 16v-2.5c1.2-1 2-2.5 2-4.5 0-4-3-7-7-7z" fill="#ffaa0022" stroke="#ffaa00" stroke-width="1.5"/><circle cx="9.5" cy="9" r="1.5" fill="#ffaa00" opacity=".8"/><circle cx="14.5" cy="9" r="1.5" fill="#ffaa00" opacity=".8"/></svg>
                        <span style="font-size:14px;">${icon}</span>
                        <span style="color:#fff;font-weight:700;font-size:13px;">${teamName}</span>
                        ${t.cross_market ? '<span style="background:#00ddff18;color:#00ddff;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:800;border:1px solid #00ddff44;">✕ CROSS</span>' : '<span style="background:#8892a612;color:#8892a6;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;">SAME MKT</span>'}
                        ${phaseBadge}
                        ${widthBadge}
                        ${t.repeat_cycle && t.repeat_total > 1 ? `<span style="background:#aa66ff22;color:#aa66ff;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;">${t.smart_mode ? 'Smart ' : ''}Run ${t.repeat_cycle}/${t.repeat_total}</span>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="color:${netCol};font-weight:800;font-size:16px;">${net>=0?'+':''}${net}¢</div>
                        <div style="color:${netCol};font-size:10px;font-weight:600;">${statusLabel}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <div style="background:#0a0e1a;border-radius:8px;padding:10px;border:1px solid ${dogCol}22;">
                        <div style="color:#ffaa00;font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:4px;">👻 ANCHOR · BOUGHT</div>
                        <div style="color:${dogCol};font-weight:700;font-size:12px;">${dogSide.toUpperCase()} @ ${dogPrice}¢</div>
                        <div style="color:#8892a6;font-size:10px;">×${t.quantity||1}</div>
                        ${rungsHtml}
                    </div>
                    <div style="background:#0a0e1a;border-radius:8px;padding:10px;border:1px solid ${isSellback ? '#ff444422' : favCol+'22'};">
                        <div style="color:${isSellback ? '#ff4444' : '#00aaff'};font-size:9px;font-weight:800;text-transform:uppercase;margin-bottom:4px;">${isSellback ? '🔙 SOLD BACK' : '⭐ FAV HEDGE'}${t.cross_market && t.hedge_ticker ? ` <span style="color:#00ddff;font-size:8px;">→ ${(t.hedge_ticker||'').split('-').pop()}</span>` : ''}</div>
                        ${isSellback
                            ? `<div style="color:${net > 0 ? '#00ff88' : '#ff4444'};font-weight:700;font-size:12px;">${t.sell_back_price > 0 ? dogSide.toUpperCase() + ' sold @ ' + t.sell_back_price + '¢' : 'Sell failed — full loss'}</div>
                               <div style="color:${net > 0 ? '#00ff88' : '#ff6644'};font-size:10px;">Dog cost: ${dogPrice}¢ · ${net > 0 ? 'Recovered +' + (t.profit_cents||0) + '¢' : 'Lost ' + (t.loss_cents||0) + '¢'}</div>
                               <div style="color:#8892a6;font-size:9px;margin-top:2px;">Fav ${favSide.toUpperCase()} was ${favPrice}¢</div>
                               ${t.raw_hedge_ms != null || t.hedge_latency_ms != null ? `<div style="margin-top:2px;font-size:9px;">${t.raw_hedge_ms != null ? `<span style="color:${t.raw_hedge_ms < 5 ? '#00ffcc' : t.raw_hedge_ms < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;">⚡ raw ${t.raw_hedge_ms.toFixed(1)}ms</span>` : ''}${t.hedge_latency_ms != null ? ` <span style="color:#8892a6;">rt ${Math.round(t.hedge_latency_ms)}ms</span>` : ''}</div>` : ''}`
                            : `<div style="color:${favCol};font-weight:700;font-size:12px;">${favSide.toUpperCase()} @ ${favPrice}¢</div>
                               <div style="color:#00ff88;font-size:10px;">Total: ${typeof dogPrice === 'number' && typeof favPrice === 'number' ? dogPrice + favPrice : '?'}¢ · Profit: +${t.profit_cents||0}¢</div>
                               ${t.raw_hedge_ms != null || t.hedge_latency_ms != null ? `<div style="margin-top:3px;font-size:10px;">${t.raw_hedge_ms != null ? `<span style="color:${t.raw_hedge_ms < 5 ? '#00ffcc' : t.raw_hedge_ms < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;">⚡ raw ${t.raw_hedge_ms.toFixed(1)}ms</span>` : ''}${t.hedge_latency_ms != null ? ` <span style="color:${t.hedge_latency_ms < 100 ? '#00ff88' : t.hedge_latency_ms < 300 ? '#ffaa00' : '#ff4444'};font-weight:700;">rt ${Math.round(t.hedge_latency_ms)}ms</span>` : ''}</div>` : ''}`
                        }
                    </div>
                </div>
                <div style="display:flex;gap:12px;font-size:11px;flex-wrap:wrap;padding-top:6px;border-top:1px solid #1e2740;">
                    <span style="color:#555;">${dateStr}</span>
                    ${t.fee_cents ? `<span style="color:#8892a6;">Fee: ${t.fee_cents}¢</span>` : ''}
                    ${t.fill_duration_s != null ? `<span style="color:#8892a6;">Fill: ${t.fill_duration_s}s</span>` : ''}
                    ${(() => { const lat = t.hedge_latency_ms != null ? t.hedge_latency_ms : t.hedge_fill_latency_ms; const raw = t.raw_hedge_ms; return (lat != null ? `<span style="color:${lat < 300 ? '#00ff88' : lat < 800 ? '#ffaa00' : '#ff4444'};font-weight:700;">⚡ ${Math.round(lat)}ms</span>` : '') + (raw != null ? `<span style="color:${raw < 5 ? '#00ffcc' : raw < 15 ? '#00ff88' : '#ffaa00'};font-weight:700;"> raw ${raw.toFixed(1)}ms</span>` : ''); })()}
                    ${isSellback && t.hard_ceiling_total ? `<span style="color:#ff6644;">Ceiling: ${t.hard_ceiling_total}¢</span>` : ''}
                    ${t.rungs_filled ? `<span style="color:#8892a6;">Rungs: ${t.rungs_filled}/${t.rungs_total||'?'}</span>` : ''}
                </div>
                ${t.bot_id ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><span style="color:#3a4560;font-size:9px;font-family:monospace;">${(t.bot_id||'').slice(-12)}</span><button onclick="navigator.clipboard.writeText('${t.bot_id}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" style="background:none;border:none;cursor:pointer;font-size:9px;padding:0;color:#3a4560;" title="Copy bot ID">📋</button></div>` : ''}
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
    // Only show loading spinner on first load — don't flash on subsequent polls
    if (!el.dataset.loaded) {
        el.innerHTML = '<p style="color:#8892a6;text-align:center;padding:24px;">Loading positions from Kalshi...</p>';
    }

    try {
        const resp = await fetch(`${API_BASE}/positions/active`);
        const data = await resp.json();
        if (data.error) {
            el.innerHTML = `<p style="color:#ff4444;text-align:center;padding:24px;">Error: ${data.error}</p>`;
            return;
        }

        const positions = data.positions || [];
        el.dataset.loaded = '1';
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
            const isOrphaned = pos.is_orphaned && pos.orphaned_qty > 0;
            const cardBorder = isOrphaned ? 'border-color:#ff4444;box-shadow:0 0 10px rgba(255,68,68,0.3);' : (isWatched ? 'border-color:#9966ff66;' : '');

            return `<div class="position-card" style="${cardBorder}">
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
                ${(pos.managing_bots && pos.managing_bots.length > 0) ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${pos.managing_bots.map(mb => {
                    const c = BOT_COLORS[mb.type] || '#888';
                    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;background:${c}22;border:1px solid ${c}44;border-radius:6px;font-size:11px;font-weight:600;color:${c};">${botIconImg(mb.type, 12)} ×${mb.qty}</span>`;
                }).join('')}</div>` : ''}
                ${isOrphaned ? `<div style="margin-top:6px;padding:6px 10px;background:#ff444422;border:1px solid #ff444444;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:11px;color:#ff4444;font-weight:600;">👻 ${pos.orphaned_qty} orphaned — no bot managing</span>
                    <button onclick="sellOrphan('${pos.ticker}','${pos.side}',${pos.orphaned_qty})" style="background:#ff4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;">Sell Orphan</button>
                </div>` : ''}
            </div>`;
        }).join('');
    } catch (err) {
        el.innerHTML = `<p style="color:#ff4444;text-align:center;">Failed to load positions: ${err.message}</p>`;
    }
}

async function sellOrphan(ticker, side, qty) {
    if (!confirm(`Sell ${qty} orphaned ${side.toUpperCase()} contract(s) on ${ticker}?`)) return;
    try {
        const resp = await fetch(`${API_BASE}/emergency-sell`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ticker, side, count: qty})
        });
        const data = await resp.json();
        if (data.success) {
            showNotification(`Orphan sold: ${qty}x ${side.toUpperCase()} on ${ticker} at ${data.sell_price}¢`);
            loadPositions();
        } else {
            showNotification(`Sell failed: ${data.error || 'unknown'}`, 'error');
        }
    } catch (err) {
        showNotification(`Sell error: ${err.message}`, 'error');
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

