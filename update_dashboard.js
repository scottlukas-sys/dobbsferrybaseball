#!/usr/bin/env node
/**
 * Dobbs Ferry Eagles Baseball Dashboard Updater
 *
 * Updates the static HTML dashboard with:
 * - Current date stamps
 * - Next Four Games (Varsity + JV) based on today's date
 * - Quick Stats (Record, Games This Week, Streak)
 * - Recent Scores from scores.json
 * - Completed game markers in schedule tables
 * - Next Game callout with days-until countdown
 * - JV status alert
 * - Footer timestamp
 *
 * Usage: node update_dashboard.js <path-to-html> [path-to-scores.json]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// WEATHER — Open-Meteo forecast (no API key, 16-day window)
// ============================================================
// Dobbs Ferry, NY — used as the regional reference point for all games.
// Most opponents are within 20 miles; forecast differences are negligible.
const DFB_LAT = 41.0137;
const DFB_LON = -73.8718;

// WMO weather interpretation codes → short human text + emoji
function wmoToText(code) {
    const map = {
        0: ['Clear', '☀️'],
        1: ['Mainly clear', '🌤️'],
        2: ['Partly cloudy', '⛅'],
        3: ['Overcast', '☁️'],
        45: ['Fog', '🌫️'], 48: ['Fog', '🌫️'],
        51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
        56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
        61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
        66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
        71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'],
        77: ['Snow grains', '🌨️'],
        80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Heavy showers', '⛈️'],
        85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
        95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm + hail', '⛈️'], 99: ['Thunderstorm + hail', '⛈️'],
    };
    return map[code] || ['', ''];
}

// Parse "4:30 PM" → 16 (24h hour)
function parseTimeTo24h(timeStr) {
    if (!timeStr) return 16;
    const m = timeStr.match(/(\d+):?(\d+)?\s*(AM|PM)/i);
    if (!m) return 16;
    let h = parseInt(m[1], 10);
    const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h;
}

// Returns a formatted weather string for a given game date + time, or null on failure.
// Uses open-meteo.com (free, no key, 16-day forecast window).
function fetchGameWeather(gameDate, gameTime) {
    try {
        // Open-Meteo only forecasts 16 days out; anything beyond returns no data for that date.
        const today = new Date();
        const target = new Date(gameDate + 'T12:00:00');
        const daysOut = Math.round((target - today) / 86400000);
        if (daysOut < 0) return null; // past game
        if (daysOut > 15) return 'Forecast available ~14 days before game';

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${DFB_LAT}&longitude=${DFB_LON}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=16`;
        const raw = execSync(`curl -sSL --max-time 10 "${url}"`, { encoding: 'utf8' });
        const data = JSON.parse(raw);
        if (!data.hourly || !data.hourly.time) return null;

        // Build the target timestamp string: YYYY-MM-DDTHH:00
        const h24 = parseTimeTo24h(gameTime);
        const hh = String(h24).padStart(2, '0');
        const targetStamp = `${gameDate}T${hh}:00`;

        // Find exact match or nearest hour
        const times = data.hourly.time;
        let idx = times.indexOf(targetStamp);
        if (idx === -1) {
            // Fall back to nearest hour on that date
            const sameDay = times
                .map((t, i) => ({ t, i }))
                .filter(x => x.t.startsWith(gameDate));
            if (sameDay.length === 0) return null;
            // pick 4pm-ish default if can't find exact
            const prefer = sameDay.find(x => x.t.endsWith('T16:00')) || sameDay[Math.floor(sameDay.length / 2)];
            idx = prefer.i;
        }

        const temp = Math.round(data.hourly.temperature_2m[idx]);
        const pop = data.hourly.precipitation_probability[idx];
        const wind = Math.round(data.hourly.wind_speed_10m[idx]);
        const code = data.hourly.weather_code[idx];
        const [desc, emoji] = wmoToText(code);

        const parts = [];
        if (desc) parts.push(`${emoji} ${desc}`);
        parts.push(`${temp}°F`);
        if (pop != null) parts.push(`${pop}% precip`);
        if (wind != null) parts.push(`${wind} mph wind`);
        return parts.join(' • ');
    } catch (e) {
        return null;
    }
}


const htmlPath = process.argv[2];
const scoresPath = process.argv[3] || path.join(path.dirname(htmlPath), 'scores.json');

if (!htmlPath) {
    console.error('Usage: node update_dashboard.js <path-to-html> [path-to-scores.json]');
    process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf8');
let scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));

const today = new Date();
const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatLongDate(d) {
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatShortMonth(d) {
    return MONTHS[d.getMonth()].slice(0, 3);
}

function daysBetween(a, b) {
    const msPerDay = 86400000;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcB - utcA) / msPerDay);
}

function parseGameDate(dateStr) {
    // Parse "Mar 24", "Apr 7", "May 11" etc into a Date object for 2026
    const parts = dateStr.trim().split(/\s+/);
    const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const month = monthMap[parts[0]];
    const day = parseInt(parts[1]);
    return new Date(2026, month, day);
}

// Format averages in TV style: no leading zero. ".333" not "0.333", "1.000" stays "1.000"
function fmtAvg(n) {
    return n.toFixed(3).replace(/^0\./, '.');
}

// ============================================================
// VARSITY SCHEDULE (hardcoded from the HTML)
// ============================================================
const varsitySchedule = [
    { date: '2026-03-19', display: 'Mar 19', day: 'Thu', time: '4:15 PM', opponent: 'Ardsley', location: 'Away', venue: 'Ardsley High School', address: '300 Farm Rd, Ardsley, NY 10502', type: 'Scrimmage' },
    { date: '2026-03-24', display: 'Mar 24', day: 'Tue', time: '4:30 PM', opponent: 'Irvington', location: 'Away', venue: 'Memorial Park (Dow\'s Lane)', address: '11 Dows Ln, Irvington, NY 10533', type: 'Game' },
    { date: '2026-03-27', display: 'Mar 27', day: 'Fri', time: '4:30 PM', opponent: 'Saunders', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'Game' },
    { date: '2026-04-07', display: 'Apr 7', day: 'Tue', time: '4:30 PM', opponent: 'Edgemont', location: 'Away', venue: 'Edgemont HS', address: '300 White Oak Ln, Scarsdale, NY 10583', type: 'Game' },
    { date: '2026-04-08', display: 'Apr 8', day: 'Wed', time: '4:30 PM', opponent: 'Sleepy Hollow', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'Game' },
    // Apr 11 Pearl River game WAS played despite earlier postponement report — confirmed by @dfeaglesbaseball IG 4/12 post (DF L 10-11)
    { date: '2026-04-11', display: 'Apr 11', day: 'Sat', time: '3:00 PM', opponent: 'Pearl River', location: 'Away', venue: 'Pearl River HS', address: '275 E Central Ave, Pearl River, NY 10965', type: 'Game' },
    { date: '2026-04-13', display: 'Apr 13', day: 'Mon', time: '4:30 PM', opponent: 'Irvington', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'Game' },
    { date: '2026-04-14', display: 'Apr 14', day: 'Tue', time: '4:30 PM', opponent: 'Ardsley', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'Game' },
    { date: '2026-04-18', display: 'Apr 18', day: 'Sat', time: '11:00 AM', opponent: 'Haldane', location: 'Away', venue: 'Haldane HS', address: '15 Craigside Dr, Cold Spring, NY 10516', type: 'Game' },
    { date: '2026-04-20', display: 'Apr 20', day: 'Mon', time: '4:30 PM', opponent: 'Blind Brook', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'League' },
    { date: '2026-04-22', display: 'Apr 22', day: 'Wed', time: '4:30 PM', opponent: 'Blind Brook', location: 'Away', venue: 'Blind Brook HS', address: '840 King St, Rye Brook, NY 10573', type: 'League' },
    { date: '2026-04-24', display: 'Apr 24', day: 'Fri', time: '4:30 PM', opponent: 'Hastings', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'League' },
    { date: '2026-04-27', display: 'Apr 27', day: 'Mon', time: '5:00 PM', opponent: 'Valhalla', location: 'Away', venue: 'Kensico Field', address: '316 Columbus Ave, Valhalla, NY 10595', type: 'Game' },
    { date: '2026-04-28', display: 'Apr 28', day: 'Tue', time: '4:30 PM', opponent: 'Hastings', location: 'Away', venue: 'Hastings HS', address: '27 Farragut Ave, Hastings-on-Hudson, NY 10706', type: 'League' },
    { date: '2026-04-30', display: 'Apr 30', day: 'Thu', time: '4:30 PM', opponent: 'Rye Neck', location: 'Away', venue: 'Rye Neck HS', address: '310 Palmer Rd, Mamaroneck, NY 10543', type: 'League' },
    { date: '2026-05-01', display: 'May 1', day: 'Fri', time: '4:30 PM', opponent: 'Rye Neck', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'League' },
    { date: '2026-05-04', display: 'May 4', day: 'Mon', time: '4:30 PM', opponent: 'Tuckahoe', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'League' },
    { date: '2026-05-06', display: 'May 6', day: 'Wed', time: '4:30 PM', opponent: 'Tuckahoe', location: 'Away', venue: 'Parkway Oval', address: '65 Elm St, Tuckahoe, NY 10707', type: 'League' },
    { date: '2026-05-07', display: 'May 7', day: 'Thu', time: '4:30 PM', opponent: 'Leffell School', location: 'Away', venue: 'Leffell School', address: '40 Woods Rd, Hartsdale, NY 10530', type: 'League' },
    { date: '2026-05-11', display: 'May 11', day: 'Mon', time: '4:30 PM', opponent: 'Westlake', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'Game' },
    { date: '2026-05-12', display: 'May 12', day: 'Tue', time: '4:30 PM', opponent: 'Leffell School', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522', type: 'League' },
];

const jvSchedule = [
    { date: '2026-04-07', display: 'Apr 7', day: 'Tue', time: '4:30 PM', opponent: 'Edgemont JV', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522' },
    { date: '2026-04-08', display: 'Apr 8', day: 'Wed', time: '4:30 PM', opponent: 'Sleepy Hollow JV', location: 'Away', venue: 'Sleepy Hollow HS', address: '210 N Broadway, Sleepy Hollow, NY 10591' },
    // POSTPONED — removed from DFSD athletic calendar as of 2026-04-07; no makeup date posted
    // { date: '2026-04-11', display: 'Apr 11', day: 'Sat', time: '3:00 PM', opponent: 'Pearl River JV', location: 'Home' },
    { date: '2026-04-14', display: 'Apr 14', day: 'Tue', time: '4:30 PM', opponent: 'Ardsley JV', location: 'Away', venue: 'Ardsley HS', address: '300 Farm Rd, Ardsley, NY 10502' },
    { date: '2026-04-16', display: 'Apr 16', day: 'Thu', time: '4:30 PM', opponent: 'Hastings JV', location: 'Away', venue: 'Hastings HS', address: '27 Farragut Ave, Hastings-on-Hudson, NY 10706' },
    { date: '2026-04-18', display: 'Apr 18', day: 'Sat', time: '2:30 PM', opponent: 'Irvington JV', location: 'Away', venue: 'Memorial Park', address: '11 Dows Ln, Irvington, NY 10533' },
    { date: '2026-04-20', display: 'Apr 20', day: 'Mon', time: '4:30 PM', opponent: 'Blind Brook JV', location: 'Away', venue: 'Blind Brook HS', address: '840 King St, Rye Brook, NY 10573' },
    { date: '2026-04-22', display: 'Apr 22', day: 'Wed', time: '4:30 PM', opponent: 'Blind Brook JV', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522' },
    { date: '2026-04-24', display: 'Apr 24', day: 'Fri', time: '4:30 PM', opponent: 'Pearl River JV', location: 'Away', venue: 'Pearl River HS', address: '275 E Central Ave, Pearl River, NY 10965' },
    { date: '2026-04-28', display: 'Apr 28', day: 'Tue', time: '4:30 PM', opponent: 'Hastings JV', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522' },
    { date: '2026-04-30', display: 'Apr 30', day: 'Thu', time: '4:30 PM', opponent: 'Rye Neck JV', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522' },
    { date: '2026-05-01', display: 'May 1', day: 'Fri', time: '4:30 PM', opponent: 'Rye Neck JV', location: 'Away', venue: 'Rye Neck HS', address: '310 Palmer Rd, Mamaroneck, NY 10543' },
    { date: '2026-05-04', display: 'May 4', day: 'Mon', time: '4:30 PM', opponent: 'Tuckahoe JV', location: 'Away', venue: 'Parkway Oval', address: '65 Elm St, Tuckahoe, NY 10707' },
    { date: '2026-05-06', display: 'May 6', day: 'Wed', time: '4:30 PM', opponent: 'Tuckahoe JV', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522' },
    { date: '2026-05-07', display: 'May 7', day: 'Thu', time: '4:30 PM', opponent: 'Leffell JV', location: 'Home', venue: 'Gould Park', address: '33 Ashford Ave, Dobbs Ferry, NY 10522' },
    { date: '2026-05-12', display: 'May 12', day: 'Tue', time: '4:30 PM', opponent: 'Leffell JV', location: 'Away', venue: 'Leffell School', address: '40 Woods Rd, Hartsdale, NY 10530' },
];

// ============================================================
// COMPUTE RECORDS
// ============================================================
function computeRecord(teamScores) {
    let wins = 0, losses = 0;
    const sortedDates = Object.keys(teamScores).sort();
    let streak = '';
    let streakCount = 0;
    let lastType = '';

    for (const date of sortedDates) {
        const g = teamScores[date];
        if (g.df > g.opp) {
            wins++;
            if (lastType === 'W') streakCount++;
            else { lastType = 'W'; streakCount = 1; }
        } else {
            losses++;
            if (lastType === 'L') streakCount++;
            else { lastType = 'L'; streakCount = 1; }
        }
    }

    streak = lastType ? `${lastType}${streakCount}` : 'N/A';
    return { wins, losses, record: `${wins}-${losses}`, streak };
}

function computeLeagueRecord(teamScores, schedule) {
    let wins = 0, losses = 0;
    const leagueGames = schedule.filter(g => g.type === 'League');
    const leagueDates = new Set(leagueGames.map(g => g.date));

    for (const [date, g] of Object.entries(teamScores)) {
        if (leagueDates.has(date)) {
            if (g.df > g.opp) wins++;
            else losses++;
        }
    }
    if (wins === 0 && losses === 0) return 'N/A';
    return `${wins}-${losses}`;
}

// ============================================================
// 1. UPDATE TITLE DATE
// ============================================================
const longDate = formatLongDate(today);
// Title tag is now static "The Dobbs Ferry Eagles Baseball Club" — do not overwrite
// Subtitle is now static "Section 1 | Conference 3 | Division B" — do not overwrite

// ============================================================
// 2. UPDATE VARSITY QUICK STATS
// ============================================================
const vRecord = computeRecord(scores.varsity);
const vLeague = computeLeagueRecord(scores.varsity, varsitySchedule);

// Find next varsity game (non-scrimmage, not yet played)
const playedVarsityDates = new Set(Object.keys(scores.varsity));
// Also mark scrimmages as "played" — they're always in the past
const nextVarsityGames = varsitySchedule.filter(g => {
    if (g.type === 'Scrimmage') return false;
    if (playedVarsityDates.has(g.date)) return false;
    return g.date >= todayStr;
});

const nextVarsityGame = nextVarsityGames[0];

// Update Record
html = html.replace(
    /(<div class="stat-label">Record<\/div>\s*<div class="stat-value")(.*?)(>)[^<]*(.*?<\/div>)/,
    function(match, pre, attrs, gt, post) {
        const color = vRecord.wins > vRecord.losses ? '#D4A017' : vRecord.losses > vRecord.wins ? '#888' : '#FFFFFF';
        return `<div class="stat-label">Record</div>\n                    <div class="stat-value" style="color: ${color};">${vRecord.record}</div>`;
    }
);

// Update League
html = html.replace(
    /(<div class="stat-label">League<\/div>\s*<div class="stat-value">)[^<]*/,
    `$1${vLeague}`
);

// Update Games This Week in stats (Mon-Sun week containing today)
{
    const todayDate = new Date(todayStr + 'T12:00:00');
    // getDay(): 0=Sun, 1=Mon ... 6=Sat. We want Mon=start, Sun=end.
    const dayOfWeek = todayDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday is end of week, so Monday was 6 days ago
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    const varsityThisWeek = varsitySchedule.filter(g => g.date >= mondayStr && g.date <= sundayStr && g.type !== 'Scrimmage');
    const jvThisWeek = jvSchedule.filter(g => g.date >= mondayStr && g.date <= sundayStr);
    const gamesThisWeek = varsityThisWeek.length + jvThisWeek.length;

    html = html.replace(
        /(<div class="stat-label">Games This Week<\/div>\s*<div class="stat-value">)[^<]*/,
        `$1${gamesThisWeek}`
    );
}

// Update Streak
html = html.replace(
    /(<div class="stat-label">Streak<\/div>\s*<div class="stat-value")(.*?)(>)[^<]*(.*?<\/div>)/,
    function(match) {
        const color = vRecord.streak.startsWith('W') ? '#D4A017' : vRecord.streak.startsWith('L') ? '#888' : '#FFFFFF';
        return `<div class="stat-label">Streak</div>\n                    <div class="stat-value" style="color: ${color};">${vRecord.streak}</div>`;
    }
);

// ============================================================
// 3. UPDATE NEXT GAME CALLOUT (the alert card at top of varsity tab)
// ============================================================
if (nextVarsityGame) {
    const nextDate = new Date(nextVarsityGame.date + 'T12:00:00');
    const daysUntil = daysBetween(today, nextDate);
    const dayOfWeek = SHORT_DAYS[nextDate.getDay()];
    const shortMonth = formatShortMonth(nextDate);
    const homeAway = nextVarsityGame.location === 'Home' ? 'vs' : '@';
    const venueName = nextVarsityGame.location === 'Home' ? 'Gould Park (Home)' : `${nextVarsityGame.venue} (Away)`;
    const daysText = daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil} DAYS AWAY`;

    // Get last result for context
    const sortedScoreDates = Object.keys(scores.varsity).sort().reverse();
    let lastResultText = '';
    if (sortedScoreDates.length > 0) {
        const lastDate = sortedScoreDates[0];
        const lastScore = scores.varsity[lastDate];
        const won = lastScore.df > lastScore.opp;
        const ld = new Date(lastDate + 'T12:00:00');
        const lm = formatShortMonth(ld);
        lastResultText = ` | Last result: ${won ? 'W' : 'L'} ${lastScore.df}-${lastScore.opp} vs ${lastScore.opponent} (${lm} ${ld.getDate()})`;
    }

    // Weather for next varsity game (Dobbs Ferry area forecast)
    const vWeather = fetchGameWeather(nextVarsityGame.date, nextVarsityGame.time);
    const vWeatherRow = vWeather
        ? `\n                <div class="weather"><strong>Weather:</strong> ${vWeather} <span style="color:#666;font-size:11px;">(Dobbs Ferry area)</span></div>`
        : `\n                <div class="weather"><strong>Weather:</strong> Forecast unavailable</div>`;

    // Address row for away games
    const vAddressRow = (nextVarsityGame.location !== 'Home' && nextVarsityGame.address)
        ? `\n                <div style="color:#aaa;font-size:15px;margin-top:6px;"><strong>Address:</strong> <a href="https://maps.google.com/?q=${encodeURIComponent(nextVarsityGame.address)}" target="_blank" style="color:#6b9fd4;text-decoration:none;">${nextVarsityGame.address}</a></div>`
        : '';

    // Replace the entire varsity alert card
    const alertRegex = /(<div id="varsity"[\s\S]*?)(<div class="card alert"[\s\S]*?<\/div>\s*<\/div>)([\s\S]*?<!-- Quick Stats -->)/;
    html = html.replace(alertRegex, `$1<div class="card alert">
                <div class="alert-title">NEXT GAME — ${daysText} (${shortMonth.toUpperCase()} ${nextDate.getDate()})</div>
                <div class="alert-game">${shortMonth} ${nextDate.getDate()} (${dayOfWeek}) <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextVarsityGame.time} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${homeAway} ${nextVarsityGame.opponent} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${venueName}</div>
                <div class="alert-details">Non-league</div>${vAddressRow}${vWeatherRow}
            </div>$3`);
}

// ============================================================
// 4. UPDATE NEXT FOUR GAMES (VARSITY)
// ============================================================
function buildNextFourVarsity() {
    // Get all non-scrimmage games
    const realGames = varsitySchedule.filter(g => g.type !== 'Scrimmage');

    // Only show upcoming games — no completed games in this section
    const upcomingGames = realGames.filter(g => !playedVarsityDates.has(g.date) && g.date >= todayStr);

    const displayGames = upcomingGames.slice(0, 4);

    let cardsHtml = '';

    for (let i = 0; i < displayGames.length; i++) {
        const g = displayGames[i];
        const d = new Date(g.date + 'T12:00:00');
        const monthName = MONTHS[d.getMonth()].toUpperCase();
        const dayName = DAYS[d.getDay()].toUpperCase();
        const homeAway = g.location === 'Home' ? 'vs' : g.location === 'Away' ? 'at' : '@';
        const venueLine = g.location === 'Home' ? `Home (${g.venue || 'Gould Park'})` : `Away (${g.venue})`;

        const badge = '';
        const borderStyle = '';

        cardsHtml += `
                    <div class="game-card"${borderStyle}>
                        <div class="game-date">${monthName} ${d.getDate()} | ${dayName}</div>
                        <div class="game-opponent">${homeAway} ${g.opponent}</div>
                        <div class="game-details">${g.time}</div>
                        <div class="game-details">${venueLine}</div>
                        ${badge}
                    </div>`;
    }

    return cardsHtml;
}

// Replace the entire Next Four Games card (from comment to next comment)
const nextFourRegex = /(<!-- Next Four Games -->)[\s\S]*?(<!-- (?:Conference Scores|Recent Scores) -->)/;
const newNextFour = buildNextFourVarsity();
html = html.replace(nextFourRegex, `$1
            <div class="card">
                <h2>Next Four Games</h2>
                <div class="games-grid">${newNextFour}
                </div>
            </div>

            $2`);

// ============================================================
// 5. UPDATE SCORES THIS WEEK
// ============================================================

// Get Monday-Sunday of the current week
function getWeekBounds(d) {
    const day = d.getDay(); // 0=Sun
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
        monStr: mon.toISOString().split('T')[0],
        sunStr: sun.toISOString().split('T')[0],
        monDisplay: `${formatShortMonth(mon)} ${mon.getDate()}`,
        sunDisplay: `${formatShortMonth(sun)} ${sun.getDate()}`
    };
}

function buildWeeklyScores() {
    const week = getWeekBounds(today);
    let allGames = [];

    // DF varsity games this week ONLY (no JV in Varsity tab)
    for (const [date, g] of Object.entries(scores.varsity)) {
        if (date >= week.monStr && date <= week.sunStr) {
            const d = new Date(date + 'T12:00:00');
            const won = g.df > g.opp;
            allGames.push({
                date,
                sortDate: date,
                dateDisplay: `${formatShortMonth(d)} ${d.getDate()}`,
                line: `<span class="df-name">Dobbs Ferry ${g.df}</span>, ${g.opponent} ${g.opp}`,
                isDF: true,
                badge: won ? 'W' : 'L',
                badgeColor: won ? '#D4A017' : '#888',
                source: g.source || 'Reported'
            });
        }
    }

    // Opponent results this week
    const oppResults = scores.opponentResults || [];
    for (const g of oppResults) {
        if (g.date >= week.monStr && g.date <= week.sunStr) {
            const d = new Date(g.date + 'T12:00:00');
            const hasScore = g.winnerRuns > 0 || g.loserRuns > 0;
            const scoreLine = hasScore
                ? `${g.winner} ${g.winnerRuns}, ${g.loser} ${g.loserRuns}`
                : `${g.winner} def. ${g.loser}`;
            allGames.push({
                date: g.date,
                sortDate: g.date,
                dateDisplay: `${formatShortMonth(d)} ${d.getDate()}`,
                line: scoreLine,
                isDF: false,
                badge: null,
                badgeColor: null,
                source: g.source || 'Reported'
            });
        }
    }

    // Sort by date
    allGames.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    if (allGames.length === 0) {
        return `<p style="color: #888; font-size: 14px;">No scores reported this week (${week.monDisplay}\u2013${week.sunDisplay}).</p>`;
    }

    // Chunk into columns of 4
    const chunks = [];
    for (let i = 0; i < allGames.length; i += 4) {
        chunks.push(allGames.slice(i, i + 4));
    }

    let out = '                <div class="scores-columns">\n';
    for (const chunk of chunks) {
        out += '                    <div class="scores-col"><table class="scores-table"><tbody>\n';
        for (const g of chunk) {
            const rowClass = g.isDF ? ' class="df-row"' : '';
            const badgeHtml = g.badge
                ? `<span class="badge-${g.badge.toLowerCase()}">${g.badge}</span>`
                : '';
            out += `                        <tr${rowClass}><td class="score-date">${g.dateDisplay}</td><td class="score-matchup">${g.line}</td><td class="score-result">${badgeHtml}</td></tr>\n`;
        }
        out += '                    </tbody></table></div>\n';
    }
    out += '                </div>';
    return out;
}

// Build the week range for the heading subtitle
const weekBounds = getWeekBounds(today);
const weekRangeText = `${weekBounds.monDisplay}\u2013${weekBounds.sunDisplay}`;

const recentScoresRegex = /(<!-- Conference Scores -->\s*<div class="card">\s*)<h2>(?:Conference 3 Division B Scores|Scores This Week)<\/h2>([\s\S]*?)(<\/div>\s*(?=\s*<!-- Standings))/;
html = html.replace(recentScoresRegex, `$1<h2>Scores This Week</h2>\n                <p style="font-size: 12px; color: #888; margin-bottom: 12px;">${weekRangeText} \u2014 DF games and schedule opponents</p>\n${buildWeeklyScores()}\n            </div>\n\n            `);

// ============================================================
// 6. MARK COMPLETED GAMES IN VARSITY SCHEDULE TABLE
// ============================================================
for (const [date, score] of Object.entries(scores.varsity)) {
    const d = new Date(date + 'T12:00:00');
    const shortMonth = formatShortMonth(d);
    const dayNum = d.getDate();
    const won = score.df > score.opp;
    const resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
    const resultColor = won ? '#D4A017' : '#888';

    // Match the schedule row for this date and mark as completed
    // Pattern: <tr> or <tr class="completed"> with the date cell
    // VARSITY ONLY: must have 7 columns (date, day, time, opp, location, venue, type)
    // This pattern specifically matches a row with 6 <td> elements BEFORE the badge/type column,
    // and includes the venue column to ensure it's a varsity row (not JV which has only 6 columns)
    const datePattern = new RegExp(
        `(<tr(?:\\s+class="[^"]*")?>\\s*<td>${shortMonth} ${dayNum}<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>)`,
        'g'
    );

    html = html.replace(datePattern, (match) => {
        if (match.includes('class="completed"')) return match;
        return match.replace('<tr>', '<tr class="completed">').replace(/<tr\s+class="([^"]*)"/, '<tr class="completed $1"');
    });

    // Update the type badge in the varsity schedule to show score
    const badgePattern = new RegExp(
        `(<tr class="completed[^"]*">\\s*<td>${shortMonth} ${dayNum}<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>)([\\s\\S]*?)(<\\/td>)`,
    );

    html = html.replace(badgePattern, `$1<span class="game-badge" style="background-color:${resultColor};">${resultText}</span>$3`);
}

// ============================================================
// 6a2. REGENERATE FULL JV SCHEDULE TABLE from jvSchedule array
// ============================================================
// Fully rebuild the JV schedule table so it's always in sync with the code.
// Previously this was a static HTML table that could go stale (e.g. missing games).
function buildFullJvScheduleRows() {
    let rows = '';
    for (const g of jvSchedule) {
        const score = scores.jv[g.date];
        const isCompleted = !!score;
        const trClass = isCompleted ? ' class="completed"' : '';
        let typeCell = '<span class="game-badge league">League</span>';
        if (isCompleted) {
            const won = score.df > score.opp;
            const resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
            const resultColor = won ? '#D4A017' : '#888';
            typeCell = `<span class="game-badge" style="background-color:${resultColor};">${resultText}</span>`;
        }
        rows += `
                        <tr${trClass}>
                            <td>${g.display}</td>
                            <td>${g.day}</td>
                            <td>${g.time}</td>
                            <td>${g.opponent}</td>
                            <td>${g.location}</td>
                            <td>${typeCell}</td>
                        </tr>`;
    }
    return rows;
}

// Replace the Full JV Schedule table body
const jvFullSchedRegex = /(<!-- Full JV Schedule -->\s*<div class="card">\s*<h2>)[\s\S]*?(<\/h2>\s*<table>\s*<thead>[\s\S]*?<\/thead>\s*<tbody>)([\s\S]*?)(<\/tbody>\s*<\/table>\s*<\/div>)/;
html = html.replace(jvFullSchedRegex, `$1Full JV Schedule (${jvSchedule.length} Games)$2${buildFullJvScheduleRows()}
                    $4`);

// ============================================================
// 6a3. DYNAMICALLY REBUILD KEY DATES FROM FULL SCHEDULE
// ============================================================
// Parses the full schedule table, filters for League + Rival games,
// and rebuilds Key Dates tbody with the next 5 upcoming such games.
// Completed games get score badges; upcoming games show "League" or "Rival".

// Rivals = all schedule opponents EXCEPT one-off non-rival teams
const NON_RIVAL_TEAMS = ['saunders', 'pearl river'];

function isRivalOrLeague(opponent, typeText) {
    if (typeText.toLowerCase().includes('league')) return 'League';
    if (typeText.toLowerCase().includes('scrimmage')) return false;
    const oppLower = opponent.toLowerCase().replace(/ jv$/i, '');
    if (NON_RIVAL_TEAMS.some(nr => oppLower.includes(nr))) return false;
    return 'Rival';
}

function parseDateFromShort(dateStr, year) {
    // Parse "Apr 22" or "May 1" into a Date
    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const mon = months[parts[0].toLowerCase()];
    const day = parseInt(parts[1]);
    if (mon === undefined || isNaN(day)) return null;
    return new Date(year, mon, day);
}

function rebuildKeyDatesSection(htmlStr, scoresMap, keyDatesComment, scheduleComment) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();

    // Build score lookup: "Mon DD" → { df, opp, opponent }
    const scoreLookup = {};
    for (const [dateStr, score] of Object.entries(scoresMap)) {
        const d = new Date(dateStr + 'T12:00:00');
        const shortMonth = formatShortMonth(d);
        const dayNum = d.getDate();
        scoreLookup[`${shortMonth} ${dayNum}`] = score;
    }

    // Parse the full schedule table to extract all games
    // Schedule tables have 7 cols (varsity): Date, Day, Time, Opponent, Location, Venue, Type
    // or 6 cols (JV): Date, Day, Time, Opponent, Location, Type
    const schedPattern = new RegExp(
        `${scheduleComment}[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>`,
        ''
    );
    const schedMatch = htmlStr.match(schedPattern);
    if (!schedMatch) {
        console.log(`  WARNING: Could not find schedule section for ${scheduleComment}`);
        return htmlStr;
    }

    const schedTbody = schedMatch[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    const allGames = [];
    let rm;
    while ((rm = rowRegex.exec(schedTbody)) !== null) {
        const cells = [];
        const cellRegex = /<td>([\s\S]*?)<\/td>/g;
        let cm;
        while ((cm = cellRegex.exec(rm[1])) !== null) {
            cells.push(cm[1].trim());
        }
        if (cells.length < 6) continue;

        const dateCell = cells[0]; // e.g. "Apr 22"
        const isVarsity = cells.length >= 7;
        const opponent = cells[3];
        const location = isVarsity ? cells[4] : cells[4];
        const venue = isVarsity ? cells[5] : '';
        const typeRaw = isVarsity ? cells[6] : cells[5];
        const typeText = typeRaw.replace(/<[^>]+>/g, '').trim();

        const tag = isRivalOrLeague(opponent, typeText);
        if (!tag) continue;

        const gameDate = parseDateFromShort(dateCell, year);
        if (!gameDate) continue;

        // Check if this game has a score (completed)
        const scoreKey = dateCell;
        const score = scoreLookup[scoreKey];

        // Determine display location for Key Dates
        const locDisplay = location === 'Home' ? `Gould Park (H)` :
                           location === 'Away' && venue ? `${venue} (A)` :
                           location === 'Away' ? `Away` : location;

        // Determine opponent display (vs/at prefix)
        const oppDisplay = location === 'Away' ? `at ${opponent}` : `vs ${opponent}`;

        allGames.push({
            dateCell,
            gameDate,
            opponent: oppDisplay,
            time: cells[2],
            location: locDisplay,
            tag, // 'League' or 'Rival'
            score,
            typeText
        });
    }

    // Sort by date
    allGames.sort((a, b) => a.gameDate - b.gameDate);

    // Find games: prefer next 5 upcoming (on or after today).
    // If a game was completed in the last 3 days, include it at the top.
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const recentCompleted = allGames.filter(g => g.score && g.gameDate >= threeDaysAgo && g.gameDate < today);
    const upcoming = allGames.filter(g => g.gameDate >= today);

    // Take recent completed (max 2) + upcoming to fill 5 total
    const recentSlice = recentCompleted.slice(-2);
    const upcomingSlice = upcoming.slice(0, 5 - recentSlice.length);
    const display = [...recentSlice, ...upcomingSlice].slice(0, 5);

    if (display.length === 0) {
        console.log(`  WARNING: No upcoming League/Rival games found for ${keyDatesComment}`);
        return htmlStr;
    }

    // Build new tbody rows
    const newRows = display.map(g => {
        if (g.score) {
            const won = g.score.df > g.score.opp;
            const resultText = won ? `W ${g.score.df}-${g.score.opp}` : `L ${g.score.df}-${g.score.opp}`;
            const resultColor = won ? '#D4A017' : '#888';
            return `                        <tr class="completed"><td>${g.dateCell}</td><td>${g.opponent}</td><td>${g.time}</td><td>${g.location}</td><td><span class="game-badge" style="background-color:${resultColor};">${resultText}</span></td></tr>`;
        } else {
            const highlight = g.gameDate.getTime() === today.getTime() ? ' highlight' : '';
            return `                        <tr class="${highlight}"><td>${g.dateCell}</td><td>${g.opponent}</td><td>${g.time}</td><td>${g.location}</td><td>${g.tag}</td></tr>`;
        }
    }).join('\n');

    // Replace the Key Dates tbody
    const keyPattern = new RegExp(
        `(${keyDatesComment}[\\s\\S]*?<tbody>)([\\s\\S]*?)(</tbody>)`,
        ''
    );

    return htmlStr.replace(keyPattern, (match, before, tbody, after) => {
        return before + '\n' + newRows + '\n                    ' + after;
    });
}

html = rebuildKeyDatesSection(html, scores.varsity || {}, '<!-- Key Varsity Dates -->', '<!-- Varsity Schedule -->');
html = rebuildKeyDatesSection(html, scores.jv || {}, '<!-- Key JV Dates -->', '<!-- Full JV Schedule -->');

// ============================================================
// 6b. UPDATE DIVISION B STANDINGS
// ============================================================
// ============================================================
// CONFERENCE 3-D LEAGUE — LOCKED ROSTER (do not modify without authoritative source)
// Dobbs Ferry's actual regular-season league is Section 1 Conference 3, Division D —
// a 6-team sub-division within the Class B playoff bracket. Confirmed via MaxPreps live
// standings and individual game-page "conference" labels (2026-04-08).
// Class B is the NYSPHSAA playoff enrollment class (multiple sub-divisions pooled for
// sectional championship), NOT the regular-season league. Do not conflate the two.
// Single source of truth: docs/conference-3d-lock.md
// ============================================================
const divBTeams = [
    'Dobbs Ferry Eagles',
    'Blind Brook Trojans',
    'Hastings Yellow Jackets',
    'Rye Neck Panthers',
    'The Leffell School Lions',
    'Tuckahoe Tigers'
];

// Map team names to schedule opponent names
const teamToOpponent = {
    'Dobbs Ferry Eagles': 'Dobbs Ferry'
};

// Compute league records for all Division B teams from scores.json
// Sources: scores.varsity (DF league games) + scores.divisionB (all other league matchups)
function computeDivBStandings() {
    const standings = {};
    for (const team of divBTeams) {
        standings[team] = { w: 0, l: 0, rf: 0, ra: 0, results: [] };
    }

    // Map short names to full standings names (Conference 3-D only)
    const nameMap = {
        'Dobbs Ferry': 'Dobbs Ferry Eagles',
        'Blind Brook': 'Blind Brook Trojans',
        'Hastings': 'Hastings Yellow Jackets',
        'Rye Neck': 'Rye Neck Panthers',
        'Leffell School': 'The Leffell School Lions',
        'Leffell': 'The Leffell School Lions',
        'The Leffell School': 'The Leffell School Lions',
        'Tuckahoe': 'Tuckahoe Tigers'
    };

    // DF league games from scores.varsity
    const leagueGames = varsitySchedule.filter(g => g.type === 'League');
    const leagueDates = new Set(leagueGames.map(g => g.date));

    const dfEntries = Object.entries(scores.varsity)
        .filter(([date]) => leagueDates.has(date))
        .sort(([a], [b]) => a.localeCompare(b));

    for (const [date, g] of dfEntries) {
        const dfFull = 'Dobbs Ferry Eagles';
        const oppFull = nameMap[g.opponent] || null;
        standings[dfFull].rf += g.df;
        standings[dfFull].ra += g.opp;
        if (g.df > g.opp) {
            standings[dfFull].w++;
            standings[dfFull].results.push({ date, outcome: 'W', opponent: oppFull });
        } else {
            standings[dfFull].l++;
            standings[dfFull].results.push({ date, outcome: 'L', opponent: oppFull });
        }
        // Also record opponent side if they're a Division B team
        if (oppFull && standings[oppFull]) {
            standings[oppFull].rf += g.opp;
            standings[oppFull].ra += g.df;
            if (g.opp > g.df) {
                standings[oppFull].w++;
                standings[oppFull].results.push({ date, outcome: 'W', opponent: dfFull });
            } else {
                standings[oppFull].l++;
                standings[oppFull].results.push({ date, outcome: 'L', opponent: dfFull });
            }
        }
    }

    // Division B cross-division league games from scores.divisionB
    // Format: { date, home, away, homeRuns, awayRuns, source }
    const divBGames = (scores.divisionB || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    for (const g of divBGames) {
        const homeFull = nameMap[g.home] || g.home;
        const awayFull = nameMap[g.away] || g.away;

        if (standings[homeFull]) {
            standings[homeFull].rf += g.homeRuns;
            standings[homeFull].ra += g.awayRuns;
            if (g.homeRuns > g.awayRuns) {
                standings[homeFull].w++;
                standings[homeFull].results.push({ date: g.date, outcome: 'W', opponent: awayFull });
            } else {
                standings[homeFull].l++;
                standings[homeFull].results.push({ date: g.date, outcome: 'L', opponent: awayFull });
            }
        }
        if (standings[awayFull]) {
            standings[awayFull].rf += g.awayRuns;
            standings[awayFull].ra += g.homeRuns;
            if (g.awayRuns > g.homeRuns) {
                standings[awayFull].w++;
                standings[awayFull].results.push({ date: g.date, outcome: 'W', opponent: homeFull });
            } else {
                standings[awayFull].l++;
                standings[awayFull].results.push({ date: g.date, outcome: 'L', opponent: homeFull });
            }
        }
    }

    // Pythagorean Win% (exponent 1.83 for baseball)
    const PYTH_EXP = 1.83;
    function pythWinPct(rf, ra) {
        if (rf === 0 && ra === 0) return 0.500;
        if (ra === 0) return 1.000;
        if (rf === 0) return 0.000;
        const rfExp = Math.pow(rf, PYTH_EXP);
        return rfExp / (rfExp + Math.pow(ra, PYTH_EXP));
    }

    // Compute base Pythagorean rating for each team
    for (const team of divBTeams) {
        const s = standings[team];
        s.pythWinPct = pythWinPct(s.rf, s.ra);
    }

    // Check if we're in Phase 2 (avg 4+ league games per team)
    const totalLeagueGames = divBTeams.reduce((sum, t) => sum + standings[t].w + standings[t].l, 0);
    const avgGamesPerTeam = totalLeagueGames / divBTeams.length;
    const useSOS = avgGamesPerTeam >= 4;

    // Compute Strength of Schedule (average opponent Pythagorean Win%)
    // For each team, SOS = avg pythWinPct of all opponents they played (excluding self)
    if (useSOS) {
        for (const team of divBTeams) {
            const s = standings[team];
            // Gather opponents from results
            const oppRatings = [];
            for (const r of (s.results || [])) {
                if (r.opponent && standings[r.opponent]) {
                    oppRatings.push(standings[r.opponent].pythWinPct);
                }
            }
            s.sos = oppRatings.length > 0
                ? oppRatings.reduce((a, b) => a + b, 0) / oppRatings.length
                : 0.500;
        }
    }

    // Compute Power Rating
    for (const team of divBTeams) {
        const s = standings[team];
        if (useSOS) {
            // Phase 2: PythWin% weighted by SOS (70/30 split)
            s.powerRating = s.pythWinPct * (0.7 + 0.3 * s.sos);
        } else {
            // Phase 1: Pure Pythagorean Win%
            s.powerRating = s.pythWinPct;
        }
    }

    // Sort by power rating (descending), then win pct, then run diff
    const sorted = divBTeams.slice().sort((a, b) => {
        const sa = standings[a], sb = standings[b];
        if (sb.powerRating !== sa.powerRating) return sb.powerRating - sa.powerRating;
        const totalA = sa.w + sa.l, totalB = sb.w + sb.l;
        const pctA = totalA > 0 ? sa.w / totalA : 0;
        const pctB = totalB > 0 ? sb.w / totalB : 0;
        if (pctB !== pctA) return pctB - pctA;
        return (sb.rf - sb.ra) - (sa.rf - sa.ra);
    });

    // Assign power ranks 1-7
    sorted.forEach((team, i) => { standings[team].powerRank = i + 1; });

    // Compute GB from leader
    const leader = standings[sorted[0]];
    const leaderTotal = leader.w + leader.l;

    let rowsHtml = '';
    for (const team of sorted) {
        const s = standings[team];
        const total = s.w + s.l;
        const pct = total > 0 ? (s.w / total).toFixed(3).replace('0.', '.') : '.000';
        let gb = '—';
        if (leaderTotal > 0 && total > 0) {
            const gbVal = ((leader.w - s.w) + (s.l - leader.l)) / 2;
            gb = gbVal === 0 ? '—' : gbVal.toFixed(1).replace('.0', '');
        }
        const highlight = team === 'Dobbs Ferry Eagles' ? ' style="background-color: rgba(43, 93, 170, 0.15);"' : '';
        const prDisplay = s.powerRating.toFixed(3).replace('0.', '.');
        rowsHtml += `
                        <tr${highlight}>
                            <td>${team}</td>
                            <td>${s.w}</td>
                            <td>${s.l}</td>
                            <td>${pct}</td>
                            <td>${gb}</td>
                            <td>${s.rf}</td>
                            <td>${s.ra}</td>
                            <td title="Power Rating: ${prDisplay}${useSOS ? ' (SOS-adjusted)' : ''}">${s.powerRank}</td>
                        </tr>`;
    }

    return rowsHtml;
}

// Check if any league games have been played (DF league games or any divisionB entries)
const leagueGamesPlayed = Object.keys(scores.varsity).some(date => {
    return varsitySchedule.some(g => g.date === date && g.type === 'League');
}) || (scores.divisionB && scores.divisionB.length > 0);

const standingsSubtitle = leagueGamesPlayed
    ? `Updated ${formatLongDate(today)}.`
    : 'League play begins April 20.';

const standingsRegex = /(<!-- Standings -->\s*<div class="card">\s*<h2>(?:Class B|Division B|Conference 3-D) Standings<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- What's Happening))/;
html = html.replace(standingsRegex, `$1
                <p style="font-size: 12px; color: #888888; margin-bottom: 15px;">${standingsSubtitle}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Team</th>
                            <th>W</th>
                            <th>L</th>
                            <th>PCT</th>
                            <th>GB</th>
                            <th>RF</th>
                            <th>RA</th>
                            <th>PWR</th>
                        </tr>
                    </thead>
                    <tbody>${computeDivBStandings()}
                    </tbody>
                </table>
            </div>

            `);

// ============================================================
// 6c. UPDATE WHAT'S HAPPENING ELSEWHERE
// ============================================================
function buildElsewhere() {
    const teamIntel = scores.teamIntel || {};
    const teams = Object.keys(teamIntel);

    // For each team, find the earliest upcoming DF game date
    function getNextDFDate(teamName) {
        const upcoming = varsitySchedule.filter(g =>
            g.type !== 'Scrimmage' &&
            g.opponent === teamName &&
            g.date >= todayStr
        );
        return upcoming.length > 0 ? upcoming[0].date : '9999-12-31';
    }

    // Sort: most recently updated first, then by next DF game date (sooner = higher)
    teams.sort((a, b) => {
        const aUpdated = teamIntel[a].lastUpdated || '2000-01-01';
        const bUpdated = teamIntel[b].lastUpdated || '2000-01-01';
        // Primary: most recently updated first (descending)
        if (bUpdated !== aUpdated) return bUpdated.localeCompare(aUpdated);
        // Secondary: earliest upcoming DF game first (ascending)
        return getNextDFDate(a).localeCompare(getNextDFDate(b));
    });

    let cardsHtml = '';
    for (const team of teams) {
        const t = teamIntel[team];
        const threat = t.threat || '';
        let borderStyle = '';
        let badgeHtml = '';
        if (threat === 'THREAT') {
            borderStyle = ' style="border-left-color: #888;"';
            badgeHtml = `<span class="threat-badge" style="background-color: #888;">THREAT</span>`;
        }

        // Compute next DF matchup from varsity + JV schedules
        const nextDFDate = getNextDFDate(team);
        let nextVsDFText = 'No game scheduled';
        if (nextDFDate !== '9999-12-31') {
            const matchV = varsitySchedule.find(g => g.opponent === team && g.date === nextDFDate);
            const matchJ = jvSchedule.find(g => g.opponent.replace(/ JV$/, '') === team && g.date >= todayStr);
            const match = matchV || matchJ;
            if (match) {
                const md = new Date(match.date + 'T12:00:00');
                const ha = match.location === 'Home' ? 'vs' : '@';
                nextVsDFText = `${formatShortMonth(md)} ${md.getDate()} ${ha} ${match.opponent}`;
            }
        }

        cardsHtml += `
                <div class="team-card"${borderStyle}>
                    <div class="team-name">${team}</div>
                    ${badgeHtml}
                    <div class="team-intel">${t.intel || t.blurb || 'No intel available.'}</div>
                    <div class="team-next">Next vs DF: ${nextVsDFText}</div>
                </div>`;
    }

    return cardsHtml;
}

// Replace the What's Happening Elsewhere section
const elsewhereRegex = /(<!-- What's Happening Elsewhere -->\s*<div class="card">\s*<h2>WHAT'S HAPPENING ELSEWHERE<\/h2>\s*<div class="team-grid">)([\s\S]*?)(<\/div>\s*<\/div>\s*(?=\s*<!-- Key Varsity))/;
html = html.replace(elsewhereRegex, `$1${buildElsewhere()}
                $3`);

// ============================================================
// 7. UPDATE JV SECTION
// ============================================================
const jvRecord = computeRecord(scores.jv);
const playedJvDates = new Set(Object.keys(scores.jv));
const nextJvGames = jvSchedule.filter(g => !playedJvDates.has(g.date) && g.date >= todayStr);
const nextJvGame = nextJvGames[0];

// Update JV Status Alert — match varsity formatting
if (nextJvGame) {
    const nextJvDate = new Date(nextJvGame.date + 'T12:00:00');
    const daysUntil = daysBetween(today, nextJvDate);
    const dayName = SHORT_DAYS[nextJvDate.getDay()];
    const shortMonth = formatShortMonth(nextJvDate);
    const homeAway = nextJvGame.location === 'Home' ? 'vs' : '@';
    const jvVenueName = nextJvGame.location === 'Home' ? 'Gould Park (Home)' : `${nextJvGame.venue || nextJvGame.opponent} (Away)`;
    const daysText = daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil} DAYS AWAY`;

    // Get last JV result for context
    const sortedJvDates = Object.keys(scores.jv).sort().reverse();
    let lastJvResultText = '';
    if (sortedJvDates.length > 0) {
        const lastDate = sortedJvDates[0];
        const lastScore = scores.jv[lastDate];
        const won = lastScore.df > lastScore.opp;
        const ld = new Date(lastDate + 'T12:00:00');
        const lm = formatShortMonth(ld);
        lastJvResultText = ` | Last result: ${won ? 'W' : 'L'} ${lastScore.df}-${lastScore.opp} vs ${lastScore.opponent} (${lm} ${ld.getDate()})`;
    }

    // Address row for away games
    const jvAddressRow = (nextJvGame.location !== 'Home' && nextJvGame.address)
        ? `\n                <div style="color:#aaa;font-size:15px;margin-top:6px;"><strong>Address:</strong> <a href="https://maps.google.com/?q=${encodeURIComponent(nextJvGame.address)}" target="_blank" style="color:#6b9fd4;text-decoration:none;">${nextJvGame.address}</a></div>`
        : '';

    // JV weather row
    const jvWeather = fetchGameWeather(nextJvGame.date, nextJvGame.time);
    const jvWeatherRow = jvWeather
        ? `\n                <div class="weather"><strong>Weather:</strong> ${jvWeather} <span style="color:#666;font-size:11px;">(Dobbs Ferry area)</span></div>`
        : `\n                <div class="weather"><strong>Weather:</strong> Forecast unavailable</div>`;

    // Replace the entire JV alert card to match varsity style
    const jvAlertRegex = /(<div id="jv"[\s\S]*?)(<div class="card alert"[\s\S]*?<\/div>\s*<\/div>)([\s\S]*?<!-- JV Quick Stats -->)/;
    html = html.replace(jvAlertRegex, `$1<div class="card alert">
                <div class="alert-title">JV NEXT GAME — ${daysText} (${shortMonth.toUpperCase()} ${nextJvDate.getDate()})</div>
                <div class="alert-game">${shortMonth} ${nextJvDate.getDate()} (${dayName}) <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextJvGame.time} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${homeAway} ${nextJvGame.opponent} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${jvVenueName}</div>
                <div class="alert-details">Non-league</div>${jvAddressRow}${jvWeatherRow}
            </div>$3`);
}

// Update JV Quick Stats - Record
html = html.replace(
    /(<!-- JV Quick Stats -->[\s\S]*?<div class="stat-label">Record<\/div>\s*<div class="stat-value">)[^<]*/,
    `$1${jvRecord.record}`
);

// Update JV Games This Week
{
    const todayDate = new Date(todayStr + 'T12:00:00');
    const dayOfWeek = todayDate.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);
    const jvThisWeek = jvSchedule.filter(g => g.date >= mondayStr && g.date <= sundayStr);
    html = html.replace(
        /(<!-- JV Quick Stats -->[\s\S]*?<div class="stat-label">Games This Week<\/div>\s*<div class="stat-value">)[^<]*/,
        `$1${jvThisWeek.length}`
    );
}

// Update JV Streak
{
    const streakColor = jvRecord.streak.startsWith('W') ? '#D4A017' : jvRecord.streak.startsWith('L') ? '#888' : '#888';
    const streakDisplay = jvRecord.streak || '--';
    html = html.replace(
        /(<!-- JV Quick Stats -->[\s\S]*?<div class="stat-label">Streak<\/div>\s*<div class="stat-value")(.*?)(>)[^<]*([\s\S]*?<\/div>)/,
        `$1 style="color: ${streakColor};">${streakDisplay}</div>`
    );
}

// Update Next Four JV Games
function buildNextFourJV() {
    // Only show upcoming games — no completed games in this section
    const upcoming = jvSchedule.filter(g => !playedJvDates.has(g.date) && g.date >= todayStr);
    const displayGames = upcoming.slice(0, 4);

    let cardsHtml = '';
    const jvHasPlayed = Object.keys(scores.jv).length > 0;

    for (let i = 0; i < displayGames.length; i++) {
        const g = displayGames[i];
        const d = new Date(g.date + 'T12:00:00');
        const monthName = MONTHS[d.getMonth()].toUpperCase();
        const dayName = DAYS[d.getDay()].toUpperCase();
        const homeAway = g.location === 'Home' ? 'vs' : 'at';

        let badge = '';
        if (i === 0) {
            badge = !jvHasPlayed
                ? '<span class="game-badge highlight">OPENER</span>'
                : '<span class="game-badge highlight">NEXT</span>';
        }

        cardsHtml += `
                    <div class="game-card">
                        <div class="game-date">${monthName} ${d.getDate()} | ${dayName}</div>
                        <div class="game-opponent">${homeAway} ${g.opponent}</div>
                        <div class="game-details">${g.time}</div>
                        <div class="game-details">${g.location}</div>
                        ${badge}
                    </div>`;
    }

    return cardsHtml;
}

// Replace the entire JV Next Four card (from comment to next comment)
const jvNextFourRegex = /(<!-- Next Four JV Games -->)[\s\S]*?(<!-- (?:JV Scores|JV Schedule) -->)/;
html = html.replace(jvNextFourRegex, `$1
            <div class="card">
                <h2>Next Four JV Games</h2>
                <div class="games-grid">${buildNextFourJV()}
                </div>
            </div>

            $2`);

// Update JV Scores This Week section (mirrors Varsity buildWeeklyScores)
function buildJvWeeklyScores() {
    const week = getWeekBounds(today);
    let allGames = [];

    // DF JV games this week
    for (const [date, g] of Object.entries(scores.jv)) {
        if (date >= week.monStr && date <= week.sunStr) {
            const d = new Date(date + 'T12:00:00');
            const won = g.df > g.opp;
            allGames.push({
                date,
                sortDate: date,
                dateDisplay: `${formatShortMonth(d)} ${d.getDate()}`,
                line: `<span class="df-name">Dobbs Ferry JV ${g.df}</span>, ${g.opponent} ${g.opp}`,
                isDF: true,
                badge: won ? 'W' : 'L',
                badgeColor: won ? '#D4A017' : '#888',
                source: g.source || 'Reported'
            });
        }
    }

    // JV opponent scores this week
    const jvOppResults = scores.jvOpponentScores || [];
    for (const g of jvOppResults) {
        if (g.date >= week.monStr && g.date <= week.sunStr) {
            const d = new Date(g.date + 'T12:00:00');
            const hasScore = g.winnerRuns > 0 || g.loserRuns > 0;
            const scoreLine = hasScore
                ? `${g.winner} ${g.winnerRuns}, ${g.loser} ${g.loserRuns}`
                : `${g.winner} def. ${g.loser}`;
            allGames.push({
                date: g.date,
                sortDate: g.date,
                dateDisplay: `${formatShortMonth(d)} ${d.getDate()}`,
                line: scoreLine,
                isDF: false,
                badge: null,
                badgeColor: null,
                source: g.source || 'DigitalSports'
            });
        }
    }

    // Sort by date
    allGames.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    if (allGames.length === 0) {
        return `<p style="color: #888; font-size: 14px;">No JV scores reported this week (${week.monDisplay}\u2013${week.sunDisplay}).</p>`;
    }

    // Chunk into columns of 4
    const chunks = [];
    for (let i = 0; i < allGames.length; i += 4) {
        chunks.push(allGames.slice(i, i + 4));
    }

    let out = '                <div class="scores-columns">\n';
    for (const chunk of chunks) {
        out += '                    <div class="scores-col"><table class="scores-table"><tbody>\n';
        for (const g of chunk) {
            const rowClass = g.isDF ? ' class="df-row"' : '';
            const badgeHtml = g.badge
                ? `<span class="badge-${g.badge.toLowerCase()}">${g.badge}</span>`
                : '';
            out += `                        <tr${rowClass}><td class="score-date">${g.dateDisplay}</td><td class="score-matchup">${g.line}</td><td class="score-result">${badgeHtml}</td></tr>\n`;
        }
        out += '                    </tbody></table></div>\n';
    }
    out += '                </div>';
    return out;
}

const jvWeekBounds = getWeekBounds(today);
const jvWeekRangeText = `${jvWeekBounds.monDisplay}\u2013${jvWeekBounds.sunDisplay}`;
const jvScoresRegex = /(<!-- JV Scores -->\s*<div class="card">\s*)<h2>(?:JV Scores|Scores This Week)<\/h2>([\s\S]*?)(<\/div>\s*(?=\s*<!-- Key JV Dates))/;
html = html.replace(jvScoresRegex, `$1<h2>Scores This Week</h2>\n                <p style="font-size: 12px; color: #888; margin-bottom: 12px;">${jvWeekRangeText} \u2014 DF JV games and league opponents</p>\n${buildJvWeeklyScores()}\n            </div>\n\n            `);

// ============================================================
// 8. PLAYERS TO WATCH — AUTO-GENERATED BY PIS (Player Impact Score)
// ============================================================
// PIS Formula:
//   JV Hitting (per game avg):
//     H(1) + 2B(+0.75) + 3B(+1.25) + HR(+2) + RBI(0.25) + BB(0.75)
//     + HBP(0.75) + SB(0.5) + multi-hit(+1.5) - SO(0.35) - E(0.5)
//     R dropped (not a batting skill — lineup/context artifact)
//     PIS = total / games played (per-game rate, 1 decimal)
//   Varsity Hitting (cumulative):
//     H(1) + 2B(+0.75) + 3B(+1.25) + HR(+2) + RBI(0.75) + R(0.5)
//     + BB(0.75) + HBP(0.75) + SB(0.5) + multi-hit(+1.5) - SO(0.25) - E(0.5)
//   JV Pitching (per pitching appearance):
//     IP(1.5) + SO(1.0) - ER(1.25) - BB(0.5) - H(0.25)
//     W and SV dropped (team stats / irrelevant at JV)
//     Denominator = pitching appearances only (not total games)
//   Varsity Pitching (cumulative): W(3) + SV(2) + IP(1) + SO(1) - ER(1.5)
//   Threshold: min 2 games with stats for "confirmed"; 1 game = "emerging"

function latestLineForRole(gameLines, role) {
    for (let i = gameLines.length - 1; i >= 0; i--) {
        const gl = gameLines[i];
        const line = role === 'pitcher' ? gl.pitLine : gl.hitLine;
        if (line) return { date: gl.date, opp: gl.opp, line };
    }
    return null;
}

// Baseball IP math helpers: IP notation uses .1 = 1/3 inning, .2 = 2/3 inning
function ipToOuts(ip) { return Math.floor(ip) * 3 + Math.round((ip % 1) * 10); }
function outsToIp(outs) { return Math.floor(outs / 3) + (outs % 3) * 0.1; }
function ipToInnings(ip) { return Math.floor(ip) + Math.round((ip % 1) * 10) / 3; }

function computePIS(playerStats) {
    const results = [];
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    function scoreGame(game, poolLabel) {
        let hitPts = 0, pitPts = 0;
        const h = game.hitting;
        const p = game.pitching;
        // JV uses v2 formula (per-game, no R, RBI 0.25, SO -0.35)
        // Varsity/opponents use v1 formula (cumulative, with R and RBI)
        const isJV = poolLabel === 'jv';

        if (h) {
            const hits = h.h || 0;
            hitPts += hits * 1.0;              // base hit
            hitPts += (h['2b'] || 0) * 0.75;   // XBH bonus: double
            hitPts += (h['3b'] || 0) * 1.25;   // XBH bonus: triple
            hitPts += (h.hr || 0) * 2.0;        // XBH bonus: HR
            if (isJV) {
                hitPts += (h.rbi || 0) * 0.25;     // JV: tiny RBI weight (situational clutch signal)
                // R dropped entirely for JV — not a batting skill, lineup-context artifact
            } else {
                hitPts += (h.rbi || 0) * 0.75;     // Varsity: original weight
                hitPts += (h.r || 0) * 0.5;         // Varsity: original weight
            }
            hitPts += (h.bb || 0) * 0.75;        // plate discipline / on-base
            hitPts += (h.hbp || 0) * 0.75;       // toughness + on-base
            hitPts += (h.sb || 0) * 0.5;          // speed/aggression
            hitPts -= (h.so || 0) * (isJV ? 0.35 : 0.25);  // JV: heavier SO penalty (put it in play matters)
            hitPts -= (h.e || 0) * 0.5;           // defensive liability penalty
            if (hits >= 2) hitPts += 1.5;          // multi-hit game bonus
        }

        if (p) {
            if (isJV) {
                // JV v2 pitching: value innings, Ks, penalize walks/hits/earned runs
                // W and SV dropped (team stats / irrelevant at JV level)
                pitPts += ipToInnings(p.ip || 0) * 1.5;   // depth = coach confidence
                pitPts += (p.so || 0) * 1.0;               // clean outs, bypass defense
                pitPts -= (p.er || 0) * 1.25;              // run prevention (reduced: BB now also penalized)
                pitPts -= (p.bb || 0) * 0.5;               // free bases, 100% pitcher's fault
                pitPts -= (p.h || 0) * 0.25;               // contact allowed (lighter: partly batter skill)
            } else {
                // Varsity/opponents: original formula
                pitPts += (p.w || 0) * 3;
                pitPts += (p.sv || 0) * 2;
                pitPts += ipToInnings(p.ip || 0) * 1;
                pitPts += (p.so || 0) * 1;
                pitPts -= (p.er || 0) * 1.5;
            }
        }

        return { total: hitPts + pitPts, hit: hitPts, pit: pitPts };
    }

    function buildGameLine(game) {
        const h = game.hitting;
        const p = game.pitching;
        let hitLine = '';
        let pitLine = '';
        if (h && ((h.ab || 0) > 0 || (h.bb || 0) > 0 || (h.hbp || 0) > 0)) {
            if (h.ab > 0) hitLine += `${h.h || 0}-${h.ab}`;
            else if (h.h > 0) hitLine += `${h.h}H`;
            const extras = [];
            if (h['2b'] > 0) extras.push(`${h['2b']} 2B`);
            if (h['3b'] > 0) extras.push(`${h['3b']} 3B`);
            if (h.hr > 0) extras.push(`${h.hr} HR`);
            if (h.rbi > 0) extras.push(`${h.rbi} RBI`);
            if (h.r > 0) extras.push(`${h.r}R`);
            if (h.bb > 0) extras.push(`${h.bb} BB`);
            if (h.hbp > 0) extras.push(`${h.hbp} HBP`);
            if (h.sb > 0) extras.push(`${h.sb} SB`);
            if (extras.length > 0) hitLine += `, ${extras.join(', ')}`;
        }
        if (p && p.ip > 0) {
            pitLine = `${p.ip}IP`;
            const pExtras = [];
            if (p.so > 0) pExtras.push(`${p.so}K`);
            if (p.er > 0) pExtras.push(`${p.er}ER`);
            else pExtras.push('0ER');
            if (p.w) pExtras.push('W');
            if (p.sv) pExtras.push('SV');
            pitLine += `, ${pExtras.join(', ')}`;
        }
        if (hitLine || pitLine) {
            const d = new Date(game.date + 'T12:00:00');
            return { date: `${formatShortMonth(d)} ${d.getDate()}`, opp: game.opp, hitLine, pitLine };
        }
        return null;
    }


    function processPool(pool, poolLabel) {
        for (const [name, data] of Object.entries(pool)) {
            const games = data.games || [];
            const tags = data.tags || [];

            let totalWeighted = 0;
            let hitTotal = 0;
            let pitTotal = 0;
            let gamesWithStats = 0;
            let pitchingApps = 0;  // separate counter for pitching appearances
            const gameLines = [];

            // --- GC / MaxPreps season totals support ---
            // If player has seasonStats from GameChanger (flat format: ss.h, ss.ab, etc.)
            // OR nested format (ss.batting / ss.pitching), compute PIS from those
            // and SKIP game-level accumulation to avoid double-counting.
            const ss = data.seasonStats;
            const sp = data.seasonPitching;
            let useSeasonStats = false;

            // Per-game data coverage check: if we have per-game data for all
            // (or nearly all) GC games, use per-game accumulation for accurate
            // multi-hit bonuses. Only fall back to GC aggregates when per-game
            // data is incomplete (e.g. opponents with only season totals).
            const gcGP = ss ? (ss.gp || 0) : 0;
            const hasFullGameLog = games.length > 0 && games.length >= gcGP;

            if (ss && ss.source && ss.source.includes('GameChanger') && !hasFullGameLog) {
                // GameChanger flat format — use aggregate when per-game data is incomplete
                const fakeHitting = (ss.h > 0 || ss.bb > 0 || ss.r > 0 || ss.rbi > 0 || (ss.ab || 0) > 0) ? {
                    h: ss.h || 0, '2b': ss['2b'] || 0, '3b': ss['3b'] || 0,
                    hr: ss.hr || 0, rbi: ss.rbi || 0, r: ss.r || 0, bb: ss.bb || 0, ab: ss.ab || 0,
                    hbp: ss.hbp || 0, sb: ss.sb || 0, so: ss.so || 0, e: ss.e || 0
                } : null;
                const fakePitching = sp ? {
                    ip: sp.ip || 0, so: sp.so || 0, er: sp.er || 0,
                    w: sp.w || 0, sv: sp.sv || 0, bb: sp.bb || 0, h: sp.h || 0
                } : null;
                if (fakeHitting || fakePitching) {
                    const fakeGame = { hitting: fakeHitting, pitching: fakePitching };
                    const pts = scoreGame(fakeGame, poolLabel);
                    totalWeighted += pts.total;
                    hitTotal += pts.hit;
                    pitTotal += pts.pit;
                    gamesWithStats = ss.gp || 1;
                    if (fakePitching) pitchingApps = sp.gp || sp.app || 1;
                    useSeasonStats = true;
                }
            } else if (ss && (ss.batting || ss.pitching)) {
                // Legacy nested format (MaxPreps scrape)
                const fakeGame = { hitting: ss.batting || null, pitching: ss.pitching || null };
                const pts = scoreGame(fakeGame, poolLabel);
                totalWeighted += pts.total;
                hitTotal += pts.hit;
                pitTotal += pts.pit;
                gamesWithStats = ss.gp || ss.batting?.gp || ss.pitching?.app || 1;
                if (ss.pitching) pitchingApps = ss.pitching.app || ss.pitching.gp || 1;
                useSeasonStats = true;
            }

            for (const game of games) {
                const h = game.hitting;
                // A player "had a plate appearance" if they have AB, BB, HBP, or any batting stat
                const hasHitting = h && ((h.ab || 0) > 0 || (h.bb || 0) > 0 || (h.hbp || 0) > 0 || (h.h || 0) > 0 || (h.r || 0) > 0 || (h.rbi || 0) > 0);
                const hasPitching = game.pitching && (game.pitching.ip > 0 || game.pitching.w > 0 || game.pitching.sv > 0);
                if (!hasHitting && !hasPitching) {
                    // No scoreable stats, but still build display line if there's a save
                    if (game.pitching && game.pitching.sv > 0) {
                        const gl = buildGameLine(game);
                        if (gl) gameLines.push(gl);
                    }
                    continue;
                }

                // If GC seasonStats already used for PIS, skip game-level PIS accumulation
                // but still build display lines for the game log
                if (!useSeasonStats) {
                    gamesWithStats++;
                    if (hasPitching) pitchingApps++;
                    const gamePts = scoreGame(game, poolLabel);
                    totalWeighted += gamePts.total;
                    hitTotal += gamePts.hit;
                    pitTotal += gamePts.pit;
                }

                const gl = buildGameLine(game);
                if (gl) gameLines.push(gl);
            }

            // JV: PIS per game (hitting uses total games, pitching uses pitching appearances)
            // Varsity/opponents: cumulative season total
            const isJVPool = poolLabel === 'jv';
            const pisRaw = totalWeighted;
            const hitPtsPerGame = (isJVPool && gamesWithStats > 0) ? Math.round((hitTotal / gamesWithStats) * 10) / 10 : Math.round(hitTotal * 10) / 10;
            const pitPtsPerGame = (isJVPool && pitchingApps > 0) ? Math.round((pitTotal / pitchingApps) * 10) / 10 : Math.round(pitTotal * 10) / 10;
            // Combined PIS: for JV, use role-appropriate denominator
            const pis = (isJVPool) ? (pitTotal > hitTotal ? pitPtsPerGame : hitPtsPerGame) : Math.round(pisRaw * 10) / 10;
            const tier = gamesWithStats >= 3 ? 'confirmed' : gamesWithStats >= 2 ? 'trending' : gamesWithStats >= 1 ? 'emerging' : 'roster';

            // Include player if they have stats OR tags/notes (roster intel)
            if (gamesWithStats === 0 && tags.length === 0 && !data.note && !ss) continue;

            // Role classification: pitcher if pitching points dominate, else hitter.
            // Two-way players go where their larger contribution is.
            const role = pitTotal > hitTotal ? 'pitcher' : 'hitter';
            // Compute PA for qualification threshold
            let seasonPA = 0;
            let seasonIPTotal = 0;
            if (useSeasonStats && ss) {
                seasonPA = ss.pa || ((ss.ab || 0) + (ss.bb || 0) + (ss.hbp || 0) + (ss.sac || 0) + (ss.sf || 0));
                if (sp) seasonIPTotal = ipToInnings(sp.ip || 0);
            } else if (ss && ss.batting) {
                const b = ss.batting;
                seasonPA = b.pa || ((b.ab || 0) + (b.bb || 0) + (b.hbp || 0) + (b.sac || 0) + (b.sf || 0));
                if (ss.pitching) seasonIPTotal = ipToInnings(ss.pitching.ip || 0);
            } else {
                for (const game of games) {
                    if (game.hitting) {
                        const gh = game.hitting;
                        seasonPA += (gh.ab || 0) + (gh.bb || 0) + (gh.hbp || 0) + (gh.sac || 0) + (gh.sf || 0);
                    }
                    if (game.pitching && game.pitching.ip > 0) {
                        seasonIPTotal += ipToInnings(game.pitching.ip);
                    }
                }
            }

            // Accumulate season totals for subtitle display
            let sH = 0, s2b = 0, s3b = 0, sHR = 0, sRBI = 0, sR = 0, sBB = 0, sGP = 0;
            let sSB = 0, sHBP = 0, sHitSO = 0, sE = 0;
            let sIP = 0, sSO = 0, sER = 0, sW = 0, sSV = 0, sPitGP = 0;
            // If GC seasonStats available, use those directly for display subtitles
            if (useSeasonStats && ss) {
                sGP = ss.gp || 0; sH = ss.h || 0; s2b = ss['2b'] || 0; s3b = ss['3b'] || 0;
                sHR = ss.hr || 0; sRBI = ss.rbi || 0; sR = ss.r || 0; sBB = ss.bb || 0;
                sSB = ss.sb || 0; sHBP = ss.hbp || 0; sHitSO = ss.so || 0; sE = ss.e || 0;
                if (sp) {
                    sPitGP = sp.gp || 0; sIP = sp.ip || 0; sSO = sp.so || 0;
                    sER = sp.er || 0; sW = sp.w || 0; sSV = sp.sv || 0;
                }
            } else if (ss && ss.batting) {
                // Legacy nested format (MaxPreps)
                const b = ss.batting;
                sGP = b.gp || 0; sH = b.h || 0; s2b = b['2b'] || 0; s3b = b['3b'] || 0;
                sHR = b.hr || 0; sRBI = b.rbi || 0; sR = b.r || 0; sBB = b.bb || 0;
                sSB = b.sb || 0; sHBP = b.hbp || 0; sHitSO = b.so || 0; sE = b.e || 0;
                if (ss.pitching) {
                    const p = ss.pitching;
                    sPitGP = p.app || p.gp || 0; sIP = p.ip || 0; sSO = p.so || 0;
                    sER = p.er || 0; sW = p.w || 0; sSV = p.sv || 0;
                }
            }
            // Accumulate from per-game data ONLY if seasonStats not used
            for (const game of games) {
                if (useSeasonStats) break; // GC season stats already loaded above
                if (game.hitting && ((game.hitting.ab || 0) > 0 || (game.hitting.bb || 0) > 0 || (game.hitting.hbp || 0) > 0 || (game.hitting.h || 0) > 0)) {
                    sGP++;
                    sH += game.hitting.h || 0;
                    s2b += game.hitting['2b'] || 0;
                    s3b += game.hitting['3b'] || 0;
                    sHR += game.hitting.hr || 0;
                    sRBI += game.hitting.rbi || 0;
                    sR += game.hitting.r || 0;
                    sBB += game.hitting.bb || 0;
                    sSB += game.hitting.sb || 0;
                    sHBP += game.hitting.hbp || 0;
                    sHitSO += game.hitting.so || 0;
                    sE += game.hitting.e || 0;
                }
                if (game.pitching && (game.pitching.ip > 0 || game.pitching.w > 0 || game.pitching.sv > 0)) {
                    sPitGP++;
                    sIP = outsToIp(ipToOuts(sIP) + ipToOuts(game.pitching.ip || 0));
                    sSO += game.pitching.so || 0;
                    sER += game.pitching.er || 0;
                    sW += game.pitching.w || 0;
                    sSV += game.pitching.sv || 0;
                }
            }
            // Build season summary lines
            let seasonHitLine = '';
            if (sGP > 0) {
                const parts = [`${sGP}GP: ${sH}H`];
                if (s2b > 0) parts.push(`${s2b} 2B`);
                if (s3b > 0) parts.push(`${s3b} 3B`);
                if (sHR > 0) parts.push(`${sHR} HR`);
                if (sRBI > 0) parts.push(`${sRBI} RBI`);
                if (sR > 0) parts.push(`${sR}R`);
                if (sBB > 0) parts.push(`${sBB} BB`);
                if (sHBP > 0) parts.push(`${sHBP} HBP`);
                if (sSB > 0) parts.push(`${sSB} SB`);
                seasonHitLine = parts.join(', ');
            }
            let seasonPitLine = '';
            if (sPitGP > 0) {
                const parts = [`${sIP}IP`, `${sSO}K`];
                if (sER > 0) parts.push(`${sER}ER`);
                if (sW > 0) parts.push(`${sW}W`);
                if (sSV > 0) parts.push(`${sSV}SV`);
                seasonPitLine = parts.join(', ');
            }

            results.push({
                name,
                team: data.team,
                pool: poolLabel,
                pis,
                hitPts: hitPtsPerGame,
                pitPts: pitPtsPerGame,
                role,
                gamesWithStats,
                pitchingApps,
                tier,
                gameLines,
                tags,
                note: data.note || null,
                seasonHitLine,
                seasonPitLine,
                seasonPA,
                seasonIPTotal
            });
        }
    }

    if (scores.playerStats) {
        if (scores.playerStats.df) processPool(scores.playerStats.df, 'df');
        if (scores.playerStats.jv) processPool(scores.playerStats.jv, 'jv');
        if (scores.playerStats.opponents) processPool(scores.playerStats.opponents, 'opponent');
    }

    // Sort: players with stats first (by PIS desc), then roster-only players alphabetically
    results.sort((a, b) => {
        if (a.gamesWithStats > 0 && b.gamesWithStats === 0) return -1;
        if (a.gamesWithStats === 0 && b.gamesWithStats > 0) return 1;
        if (a.gamesWithStats > 0 && b.gamesWithStats > 0) return b.pis - a.pis;
        return a.name.localeCompare(b.name);
    });
    return results;
}

function buildPlayersToWatch(pisData) {
    const dfPlayers = pisData.filter(p => p.pool === 'df');
    const oppPlayers = pisData.filter(p => p.pool === 'opponent');
    // Two-way players appear on BOTH lists. A player qualifies for hitters if they
    // have any hitting points, and for pitchers if they have any pitching points.
    // Force a role override on the rendered copy so the tile badge matches the panel.
    const dfHitters = dfPlayers
        .filter(p => (p.hitPts || 0) > 0 && (p.seasonPA || 0) >= varsityMinPA)
        .map(p => Object.assign({}, p, { role: 'hitter' }))
        .sort((a, b) => (b.hitPts || 0) - (a.hitPts || 0))
        .slice(0, 6);
    const dfPitchers = dfPlayers
        .filter(p => (p.pitPts || 0) > 0 && (p.seasonIPTotal || 0) >= varsityMinIP)
        .map(p => Object.assign({}, p, { role: 'pitcher' }))
        .sort((a, b) => (b.pitPts || 0) - (a.pitPts || 0))
        .slice(0, 6);

    // Group opponents by team
    const oppByTeam = {};
    for (const p of oppPlayers) {
        if (!oppByTeam[p.team]) oppByTeam[p.team] = [];
        oppByTeam[p.team].push(p);
    }

    const tierColors = { confirmed: '#D4A017', trending: '#D4A017', emerging: '#888', roster: '#555' };
    const tierLabels = { confirmed: 'CONFIRMED', trending: 'TRENDING', emerging: 'EMERGING', roster: 'ROSTER' };

    // --- DF Players: 2-column tile grid ---
    function renderDFTile(p) {
        const tierColor = tierColors[p.tier] || '#888';
        const tierLabel = tierLabels[p.tier] || p.tier.toUpperCase();
        // Show role-specific cumulative score on the badge
        const badgeVal = p.role === 'pitcher' ? (p.pitPts || p.pis) : (p.hitPts || p.pis);
        const badgeLabel = p.role === 'pitcher' ? 'Pitching PIS' : 'Hitting PIS';
        let html = `<div style="background-color: #222; border-radius: 6px; padding: 10px 12px; border-left: 3px solid #2B5DAA;">`;
        // Name row with PIS badge
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
        html += `<strong style="color: #fff; font-size: 13px;">${p.name}</strong>`;
        if (badgeVal > 0) {
            html += `<span style="background: ${tierColor}22; color: ${tierColor}; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">${badgeLabel} ${badgeVal}</span>`;
        }
        html += `</div>`;
        // One-line season totals summary
        const seasonLine = p.role === 'pitcher' ? p.seasonPitLine : p.seasonHitLine;
        if (seasonLine) {
            html += `<p style="color: #aaa; font-size: 11px; margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${seasonLine}</p>`;
        }
        html += `</div>`;
        return html;
    }

    let sectionHtml = '';

    // DF Section — split into Top Hitters and Top Pitchers
    sectionHtml += `<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid #2B5DAA;">`;
    sectionHtml += `<h3 style="margin-top: 0; margin-bottom: 10px; color: #2B5DAA;">Dobbs Ferry Eagles</h3>`;
    if (dfHitters.length === 0 && dfPitchers.length === 0) {
        sectionHtml += `<p style="color: #888; font-size: 13px;">No player stats recorded yet.</p>`;
    } else {
        if (dfHitters.length > 0) {
            sectionHtml += `<h4 style="margin: 0 0 6px 0; color: #b0b0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Top Hitters</h4>`;
            sectionHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">`;
            for (const p of dfHitters) sectionHtml += renderDFTile(p);
            sectionHtml += `</div>`;
        }
        if (dfPitchers.length > 0) {
            sectionHtml += `<h4 style="margin: 0 0 6px 0; color: #b0b0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Top Pitchers</h4>`;
            sectionHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
            for (const p of dfPitchers) sectionHtml += renderDFTile(p);
            sectionHtml += `</div>`;
        }
        // DF record summary
        const vRec = computeRecord(scores.varsity);
        const scoreDates = Object.keys(scores.varsity).sort();
        const gameSummaries = scoreDates.map(d => {
            const g = scores.varsity[d];
            const dt = new Date(d + 'T12:00:00');
            const won = g.df > g.opp;
            return `${won ? 'W' : 'L'} ${g.df}-${g.opp} vs ${g.opponent} ${formatShortMonth(dt)} ${dt.getDate()}`;
        }).join(', ');
        sectionHtml += `<p style="color: #888; font-size: 11px; margin-top: 8px; margin-bottom: 0;">Record: ${vRec.record} (${gameSummaries})</p>`;
    }
    sectionHtml += `</div>`;

    return sectionHtml;
}

// ============================================================
// OPPONENT SCOUTING REPORT — replaces old opponent Players to Watch
// ============================================================
// Ranking logic:
//   1. If box score data exists: PIS (hidden from display)
//   2. If tags only: tag quality weighting
//        All-State 10, All-Section 7, All-League 4, Captain 2
//        +3 bonus for postseason tags (Champ, Finalist)
//        +1 for D1 commit
//   3. Combined score = PIS + tagScore. Show up to 4 per team.
//   4. If a team has zero players with any score > 0: show no players.

function buildOpponentScoutingReport(pisData) {
    const oppPlayers = pisData.filter(p => p.pool === 'opponent');

    // Tag quality scoring (hidden, used only for ranking)
    function tagScore(tags) {
        if (!tags || tags.length === 0) return 0;
        let score = 0;
        for (const tag of tags) {
            const t = tag.toLowerCase();
            if (t.includes('all-state') || t.includes('all state')) score += 10;
            else if (t.includes('all-section') || t.includes('all section')) score += 7;
            else if (t.includes('all-league') || t.includes('all league')) score += 4;
            else if (t.includes('captain')) score += 2;
            // Postseason bonus (stacks)
            if (t.includes('champ')) score += 3;
            else if (t.includes('finalist')) score += 3;
            // D1 bonus
            if (t.includes('d1')) score += 1;
        }
        return score;
    }

    // Group by team, compute composite score per player
    const oppByTeam = {};
    for (const p of oppPlayers) {
        if (!oppByTeam[p.team]) oppByTeam[p.team] = [];
        const composite = (p.pis || 0) + tagScore(p.tags);
        oppByTeam[p.team].push({ ...p, composite });
    }

    // All schedule opponents (varsity, non-scrimmage)
    const scheduleTeams = [...new Set(varsitySchedule.filter(g => g.type !== 'Scrimmage').map(g => g.opponent))];

    // Tag color map for rendering
    function renderTag(tag) {
        let tagColor = '#888';
        let tagBg = '#2a2a2a';
        if (tag.includes('Champ')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
        else if (tag.includes('Finalist')) { tagColor = '#C0C0C0'; tagBg = '#C0C0C022'; }
        else if (tag.includes('All-Section') || tag.includes('All-State')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
        else if (tag.includes('All-League') || tag.includes('Award')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
        else if (tag.includes('Captain')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
        else if (tag.includes('D1')) { tagColor = '#2B5DAA'; tagBg = '#2B5DAA22'; }
        else if (tag.includes('Returning')) { tagColor = '#8B8B8B'; tagBg = '#8B8B8B22'; }
        else if (tag.includes('Pitcher') || tag.includes('Senior') || tag.includes('Freshman') || tag.includes('Junior')) { tagColor = '#7BA3CC'; tagBg = '#7BA3CC22'; }
        // Filter out low-value display tags: Roster 2026, Returning (keep only meaningful ones)
        if (tag === 'Returning' || tag.startsWith('Roster')) return '';
        return `<span style="font-size: 9px; color: ${tagColor}; background: ${tagBg}; padding: 1px 4px; border-radius: 2px; margin-right: 3px; white-space: nowrap;">${tag}</span>`;
    }

    let html = '';
    html += `<div style="border-top: 1px solid #333; margin: 8px 0 15px 0;"></div>`;
    html += `<h3 style="margin: 0 0 12px 0; color: #b0b0b0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Opponent Scouting Report</h3>`;
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">`;

    for (const team of scheduleTeams) {
        const ti = scores.teamIntel ? scores.teamIntel[team] : null;
        const record = ti ? (ti.intel || '').match(/\d+-\d+/) : null;
        const recordText = record ? record[0] : '';

        // Get top 4 players by composite score (must have score > 0)
        const players = (oppByTeam[team] || [])
            .filter(p => p.composite > 0)
            .sort((a, b) => b.composite - a.composite)
            .slice(0, 4);

        // Conference badge
        const confTeams = ['Blind Brook', 'Hastings', 'Rye Neck', 'Leffell School', 'Tuckahoe'];
        const isConf = confTeams.includes(team);

        html += `<div style="background-color: #161616; padding: 12px 14px; border-radius: 6px;">`;

        // Team header with record
        html += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">`;
        html += `<div style="display: flex; align-items: center; gap: 6px;">`;
        html += `<span style="font-size: 14px; font-weight: 600; color: #ddd;">${team}</span>`;
        if (isConf) {
            html += `<span style="font-size: 9px; color: #D4A017; background: #D4A01722; padding: 1px 5px; border-radius: 2px; font-weight: 600;">CONF</span>`;
        }
        html += `</div>`;
        if (recordText) {
            html += `<span style="font-size: 12px; color: #888; font-weight: 500;">${recordText}</span>`;
        }
        html += `</div>`;

        // Players (up to 4)
        if (players.length > 0) {
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                const displayName = p.name.replace(/\s*\(.*?\)\s*$/, '');
                html += `<div style="display: flex; align-items: center; flex-wrap: wrap; padding: 3px 0;${i < players.length - 1 ? ' border-bottom: 1px solid #222;' : ''}">`;
                html += `<span style="color: #ccc; font-size: 11px; margin-right: 6px;">${displayName}</span>`;
                if (p.tags && p.tags.length > 0) {
                    for (const tag of p.tags) html += renderTag(tag);
                }
                html += `</div>`;
            }
        } else {
            html += `<div style="padding: 2px 0;"><span style="color: #555; font-size: 11px; font-style: italic;">No player intel</span></div>`;
        }

        html += `</div>`;
    }

    html += `</div>`; // close grid
    return html;
}

// Compute PIS and rebuild Players to Watch
const pisData = computePIS(scores.playerStats || {});

// Qualification thresholds: 2.0 PA per team game for hitters, 1.0 IP per team game for pitchers
const varsityTeamGames = Object.keys(scores.varsity || {}).length;
const jvTeamGames = Object.keys(scores.jv || {}).length;
const PA_PER_GAME_THRESHOLD = 2.0;
const IP_PER_GAME_THRESHOLD = 1.0;
const JV_IP_PER_GAME_THRESHOLD = 0.83;  // ~5 IP over 6 games (lower bar: smaller staff, more rotation)
const varsityMinPA = Math.floor(varsityTeamGames * PA_PER_GAME_THRESHOLD);
const jvMinPA = Math.floor(jvTeamGames * PA_PER_GAME_THRESHOLD);
const varsityMinIP = Math.floor(varsityTeamGames * IP_PER_GAME_THRESHOLD);
const jvMinIP = Math.floor(jvTeamGames * JV_IP_PER_GAME_THRESHOLD);
console.log(`\nQualification thresholds — Varsity (${varsityTeamGames}G): ${varsityMinPA} PA / ${varsityMinIP} IP | JV (${jvTeamGames}G): ${jvMinPA} PA / ${jvMinIP} IP`);

const pisExplainer = `<p style="font-size: 12px; color: #888888; margin-bottom: 15px;">Cumulative Player Impact Score, season to date. Hitters: H + 2B(+.75) + 3B(+1.25) + HR(+2) + RBI(.75) + R(.5) + BB(.75) + HBP(.75) + SB(.5) + multi-hit(+1.5) − SO(.25) − E(.5). Pitchers: W(3) + SV(2) + IP + SO − ER(1.5). Separate leaderboards for hitters and pitchers. Min 2 PA/team game for hitters; 1 IP/team game for pitchers.</p>`;

const playersRegex = /(<!-- Players to Watch[\s\S]*?<div class="card">\s*<h2>PLAYERS TO WATCH<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- News))/;
html = html.replace(playersRegex, `$1\n                ${pisExplainer}\n${buildPlayersToWatch(pisData)}\n${buildOpponentScoutingReport(pisData)}\n            </div>\n\n            `);

// JV Players to Watch (top 6 by PIS)
function buildJVPlayersToWatch(pisData) {
    const jvAll = pisData.filter(p => p.pool === 'jv' && p.gamesWithStats > 0);
    const jvHitters = jvAll
        .filter(p => (p.hitPts || 0) > 0 && (p.seasonPA || 0) >= jvMinPA)
        .map(p => Object.assign({}, p, { role: 'hitter' }))
        .sort((a, b) => (b.hitPts || 0) - (a.hitPts || 0))
        .slice(0, 6);
    const jvPitchers = jvAll
        .filter(p => (p.pitPts || 0) > 0 && (p.seasonIPTotal || 0) >= jvMinIP)
        .map(p => Object.assign({}, p, { role: 'pitcher' }))
        .sort((a, b) => (b.pitPts || 0) - (a.pitPts || 0))
        .slice(0, 6);
    const jvExplainer = `<p style="font-size: 12px; color: #888888; margin-bottom: 15px;">Player Impact Score Per Game. Hitting: H + 2B(+.75) + 3B(+1.25) + HR(+2) + RBI(.25) + BB(.75) + HBP(.75) + SB(.5) + multi-hit(+1.5) − SO(.35) − E(.5). R excluded (lineup-dependent). Pitching: IP(1.5) + SO − ER(1.25) − BB(.5) − H(.25). W/SV dropped. Hitting avg'd over games played; pitching avg'd over pitching appearances. Min 2 PA/team game for hitters; 1 IP/team game for pitchers.</p>`;
    if (jvHitters.length === 0 && jvPitchers.length === 0) {
        return `${jvExplainer}<p style="color: #888; font-size: 13px;">No JV player stats recorded yet. Upload GameChanger data to populate.</p>`;
    }
    function tile(p) {
        const tierColors = { confirmed: '#D4A017', trending: '#D4A017', emerging: '#888', roster: '#555' };
        const tierColor = tierColors[p.tier] || '#888';
        const badgeVal = p.role === 'pitcher' ? (p.pitPts || p.pis) : (p.hitPts || p.pis);
        const badgeLabel = 'PIS Per Game';
        let t = `<div style="background-color: #222; border-radius: 6px; padding: 10px 12px; border-left: 3px solid #2B5DAA;">`;
        t += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
        t += `<strong style="color: #fff; font-size: 13px;">${p.name}</strong>`;
        if (badgeVal > 0) {
            t += `<span style="background: ${tierColor}22; color: ${tierColor}; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">${badgeLabel} ${badgeVal}</span>`;
        }
        t += `</div>`;
        // Show cumulative season stats (matching varsity tile format)
        const seasonLine = p.role === 'pitcher' ? p.seasonPitLine : p.seasonHitLine;
        if (seasonLine) {
            t += `<p style="color: #aaa; font-size: 11px; margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${seasonLine}</p>`;
        }
        t += `</div>`;
        return t;
    }
    let html = jvExplainer;
    html += `<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; border-left: 3px solid #2B5DAA;">`;
    if (jvHitters.length > 0) {
        html += `<h4 style="margin: 0 0 6px 0; color: #b0b0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Top Hitters</h4>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">`;
        for (const p of jvHitters) html += tile(p);
        html += `</div>`;
    }
    if (jvPitchers.length > 0) {
        html += `<h4 style="margin: 0 0 6px 0; color: #b0b0b0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Top Pitchers</h4>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
        for (const p of jvPitchers) html += tile(p);
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}
const jvPlayersRegex = /(<!-- JV Players to Watch[\s\S]*?<div class="card">\s*<h2>JV PLAYERS TO WATCH<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- JV Intel))/;
html = html.replace(jvPlayersRegex, `$1\n                ${buildJVPlayersToWatch(pisData)}\n            $3`);

// Console output for PIS rankings
if (pisData.length > 0) {
    console.log('\n--- PIS Rankings (Top 10) ---');
    for (const p of pisData.slice(0, 10)) {
        console.log(`  ${p.pis.toFixed(1).padStart(5)} | ${p.tier.padEnd(9)} | ${p.name} (${p.team}) — ${p.gamesWithStats} game(s)`);
    }
}

// ============================================================
// 9. AUTO-GENERATE NEWS & UPDATES
// ============================================================
function buildNewsLog(newsLog) {
    if (!newsLog || newsLog.length === 0) return '<p style="color: #888; font-size: 13px;">No updates yet.</p>';

    // Sort by date descending, then by array order within same date
    const sorted = [...newsLog].sort((a, b) => b.date.localeCompare(a.date));

    // Group by date
    const byDate = {};
    for (const entry of sorted) {
        if (!byDate[entry.date]) byDate[entry.date] = [];
        byDate[entry.date].push(entry);
    }

    let newsHtml = '';
    const dates = Object.keys(byDate).sort().reverse();

    for (const date of dates) {
        const entries = byDate[date];
        const dt = new Date(date + 'T12:00:00');
        const dateLabel = `${formatShortMonth(dt)} ${dt.getDate()}`;

        newsHtml += `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #222;">`;
        newsHtml += `<div style="font-size: 11px; color: #666; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${dateLabel}</div>`;

        for (const entry of entries) {
            let color = '#ccc';
            let prefix = '';
            if (entry.highlight) { color = '#D4A017'; }
            else if (entry.type === 'score') { color = '#D4A017'; prefix = '⚾ '; }
            else if (entry.type === 'venue') { color = '#D4A017'; }
            else if (entry.type === 'intel') { color = '#aaa'; }
            else if (entry.type === 'source') { color = '#777'; }

            newsHtml += `<p style="margin: 0 0 4px 0; font-size: 12px; color: ${color};">`;
            newsHtml += `${prefix}${entry.text}`;
            if (entry.source) {
                newsHtml += ` <span style="color: #555; font-size: 10px;">[${entry.source}]</span>`;
            }
            newsHtml += `</p>`;
        }
        newsHtml += `</div>`;
    }
    return newsHtml;
}

const newsHtml = buildNewsLog(scores.newsLog);

// Replace News & Updates content and set collapsed by default
const newsRegex = /(<!-- News & Updates[\s\S]*?<button class="collapsible-header" onclick="toggleCollapsible\(this\)">)\s*<span class="collapsible-toggle[^"]*">▶<\/span>\s*<span>News & Updates<\/span>\s*<\/button>\s*<div class="collapsible-content[^"]*">([\s\S]*?)(<\/div>\s*<\/div>\s*(?=\s*<!-- Social Media))/;

html = html.replace(newsRegex, (match, before, content, after) => {
    return `${before}\n                    <span class="collapsible-toggle collapsed">▶</span>\n                    <span>News & Updates</span>\n                </button>\n                <div class="collapsible-content collapsed">\n                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #1a1a1a;">\n${newsHtml}\n                    </div>\n                ${after}`;
});

// ============================================================
// 10. DIAMOND CLUB BOOSTER NOTICE
// ============================================================
if (scores.diamondClub && scores.diamondClub.nextEvent) {
    const dc = scores.diamondClub;
    const dcLink = dc.link ? `<a href="${dc.link}" target="_blank" style="color: #D4A017; text-decoration: none;">` : '';
    const dcLinkClose = dc.link ? '</a>' : '';
    let dateStr = '';
    let isPast = false;
    if (dc.date) {
        const dcDate = new Date(dc.date + 'T12:00:00');
        dateStr = ` (${formatShortMonth(dcDate)} ${dcDate.getDate()})`;
        const todayYMD = today.toISOString().slice(0, 10);
        if (dc.date < todayYMD) isPast = true;
    }
    const dcNotice = isPast
        ? `<div class="meta-info dc-notice" style="margin-top: 4px;">Support Eagles Baseball & Softball. Contact <a href="https://www.instagram.com/df_diamond_club/" target="_blank" style="color: #D4A017; text-decoration: none;"><strong style="color: #fff;">Dobbs Ferry Diamond Club</strong></a></div>`
        : `<div class="meta-info dc-notice" style="margin-top: 4px;">Support Eagles Baseball & Softball. Next: ${dcLink}<strong style="color: #fff;">${dc.nextEvent}${dateStr}</strong>${dcLinkClose}</div>`;

    // Inject into header-center, below the disclaimer line (remove existing notice first if present)
    html = html.replace(/\s*<div class="[^"]*dc-notice"[^>]*>.*?Support Eagles.*?<\/div>/s, '');
    html = html.replace(
        /(<div class="meta-info">Independent fan site\.[^<]*<\/div>)/,
        `$1\n            ${dcNotice}`
    );
}

// ============================================================
// 10A. GENERATE & ENCRYPT JV PLAYER STATS
// ============================================================
const crypto = require('crypto');

function generateJVStatsHTML(playerStats, gameResults) {
    // Compute aggregates from playerStats.jv and scores.jv
    const jvPlayers = playerStats.jv || {};
    const jvGames = gameResults.jv || {};

    const players = Object.entries(jvPlayers).map(([name, data]) => {
        const games = data.games || [];
        let batting = { pa: 0, ab: 0, h: 0, r: 0, rbi: 0, bb: 0, so: 0, sac: 0, sb: 0, hbp: 0, '2b': 0, '3b': 0, hr: 0 };
        let pitching = { gp: 0, gs: 0, w: 0, l: 0, sv: 0, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0, strikes: 0, bf: 0, pitchBFGames: 0, strikeGames: 0 };

        for (const game of games) {
            if (game.hitting) {
                const h = game.hitting;
                batting.ab += h.ab || 0;
                batting.h += h.h || 0;
                batting.r += h.r || 0;
                batting.rbi += h.rbi || 0;
                batting.bb += h.bb || 0;
                batting.so += h.so || 0;
                batting.sac += h.sac || 0;
                batting.sb += h.sb || 0;
                batting.hbp += h.hbp || 0;
                batting['2b'] += h['2b'] || 0;
                batting['3b'] += h['3b'] || 0;
                batting.hr += h.hr || 0;
                batting.pa += (h.ab || 0) + (h.bb || 0) + (h.sac || 0) + (h.hbp || 0);
            }
            if (game.pitching) {
                const p = game.pitching;
                if (p.ip > 0 || p.w || p.sv) pitching.gp++;
                if (p.ip > 0) pitching.gs++;
                if (p.pitches > 0 && p.bf > 0) pitching.pitchBFGames++;
                if (p.strikes > 0) pitching.strikeGames++;
                pitching.w += p.w || 0;
                pitching.l += p.l || 0;
                pitching.sv += p.sv || 0;
                pitching.ip = outsToIp(ipToOuts(pitching.ip) + ipToOuts(p.ip || 0));
                pitching.h += p.h || 0;
                pitching.r += p.r || 0;
                pitching.er += p.er || 0;
                pitching.bb += p.bb || 0;
                pitching.so += p.so || 0;
                pitching.pitches += p.pitches || 0;
                pitching.strikes += p.strikes || 0;
                pitching.bf += p.bf || 0;
            }
        }

        // Override with seasonStats if available (GameChanger season totals are authoritative)
        const ss = data.seasonStats;
        if (ss && ss.source && ss.source.includes('GameChanger')) {
            batting.ab = ss.ab || 0;
            batting.h = ss.h || 0;
            batting.r = ss.r || 0;
            batting.rbi = ss.rbi || 0;
            batting.bb = ss.bb || 0;
            batting.so = ss.so || 0;
            batting.sac = ss.sac || 0;
            batting.sb = ss.sb || 0;
            batting.hbp = ss.hbp || 0;
            batting['2b'] = ss['2b'] || 0;
            batting['3b'] = ss['3b'] || 0;
            batting.hr = ss.hr || 0;
            batting.pa = ss.pa || ((ss.ab || 0) + (ss.bb || 0) + (ss.sac || 0) + (ss.hbp || 0));
        }
        const sp = data.seasonPitching;
        if (sp && sp.source && sp.source.includes('GameChanger')) {
            // Override counting stats from GC season totals (authoritative for IP/H/ER/BB/SO)
            pitching.gp = sp.gp || 0;
            pitching.gs = sp.gs || 0;
            pitching.ip = sp.ip || 0;
            pitching.h = sp.h || 0;
            pitching.r = sp.r || 0;
            pitching.er = sp.er || 0;
            pitching.bb = sp.bb || 0;
            pitching.so = sp.so || 0;
            // W/L/SV: use seasonPitching ONLY if nonzero, else keep game-level accumulation
            // (GC season summary often reports 0 wins even when game data has them)
            if (sp.w > 0) pitching.w = sp.w;
            if (sp.l > 0) pitching.l = sp.l;
            if (sp.sv > 0) pitching.sv = sp.sv;
            // pitches, strikes, bf: keep from game-level accumulation so Strike% and P/BF
            // ratios are internally consistent (GC seasonPitching doesn't track strikes,
            // and pitches/bf may cover different game sets than our game entries)
        }

        // Attach fielding data
        const fielding = data.fielding || {};
        const fld = {
            tc: parseInt(fielding.tc) || 0,
            a: parseInt(fielding.a) || 0,
            po: parseInt(fielding.po) || 0,
            e: parseInt(fielding.e) || 0,
            dp: parseInt(fielding.dp) || 0,
            fpct: fielding.tc > 0 ? ((parseInt(fielding.tc) - parseInt(fielding.e || 0)) / parseInt(fielding.tc)) : 0
        };

        return { name, batting, pitching, fielding: fld };
    });

    // Team stats
    let teamStats = {
        w: 0, l: 0,
        runsFor: 0, runsAgainst: 0,
        hits: 0, ab: 0,
        ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0,
        errors: 0, bbDrawn: 0, pitchingBB: 0,
        batSO: 0, batPA: 0, batHBP: 0, batSAC: 0,
        xbh: 0,
        pitches: 0, strikes: 0, bf: 0, pitchBFGames: 0, strikeGames: 0, totalPitchingGP: 0,
        cleanInnings: 0, defInningsLogged: 0, cleanTracked: false,
        games: Object.keys(jvGames).length,
        mercied: 0,
        fldTC: 0, fldPO: 0, fldA: 0, fldE: 0
    };

    for (const [date, game] of Object.entries(jvGames)) {
        if (game.df <= game.opp) teamStats.l++;
        else teamStats.w++;
        teamStats.runsFor += game.df || 0;
        teamStats.runsAgainst += game.opp || 0;
        teamStats.errors += game.errors || 0;
        if (game.mercy) teamStats.mercied++;
        if (game.cleanInnings != null && game.defInnings != null) {
            teamStats.cleanInnings += game.cleanInnings;
            teamStats.defInningsLogged += game.defInnings;
            teamStats.cleanTracked = true;
        }
    }

    for (const player of players) {
        teamStats.hits += player.batting.h;
        teamStats.ab += player.batting.ab;
        teamStats.bbDrawn += player.batting.bb || 0;
        teamStats.ip = outsToIp(ipToOuts(teamStats.ip) + ipToOuts(player.pitching.ip));
        teamStats.h += player.pitching.h;
        teamStats.r += player.pitching.r;
        teamStats.er += player.pitching.er;
        teamStats.bb += player.pitching.bb;
        teamStats.pitchingBB += player.pitching.bb || 0;
        teamStats.so += player.pitching.so;
        teamStats.batSO += player.batting.so || 0;
        teamStats.batPA += player.batting.pa || 0;
        teamStats.batHBP += player.batting.hbp || 0;
        teamStats.batSAC += player.batting.sac || 0;
        teamStats.xbh += (player.batting['2b'] || 0) + (player.batting['3b'] || 0) + (player.batting.hr || 0);
        teamStats.pitches += player.pitching.pitches || 0;
        teamStats.strikes += player.pitching.strikes || 0;
        teamStats.bf += player.pitching.bf || 0;
        teamStats.pitchBFGames += player.pitching.pitchBFGames || 0;
        teamStats.strikeGames += player.pitching.strikeGames || 0;
        teamStats.totalPitchingGP += player.pitching.gp || 0;
        // Accumulate fielding totals from individual players
        teamStats.fldTC += player.fielding.tc || 0;
        teamStats.fldPO += player.fielding.po || 0;
        teamStats.fldA += player.fielding.a || 0;
        teamStats.fldE += player.fielding.e || 0;
    }

    const teamAvg = teamStats.ab > 0 ? fmtAvg(teamStats.hits / teamStats.ab) : '.000';
    const teamERA = teamStats.ip > 0 ? ((teamStats.er * 7) / ipToInnings(teamStats.ip)).toFixed(2) : '—';
    const runDiff = teamStats.runsFor - teamStats.runsAgainst;
    const freeBasesAllowed = teamStats.pitchingBB + teamStats.errors;

    // Calculate total innings batted and pitched
    let totalInningsBatted = 0;
    let totalInningsPitched = 0;
    for (const [date, game] of Object.entries(jvGames)) {
        const innings = game.innings || 7;
        totalInningsBatted += innings;
        totalInningsPitched += innings; // Use game innings as default for pitching IP if not separately tracked
    }
    // Override with sum of pitcher IP if we have more granular data
    if (teamStats.ip > 0) {
        totalInningsPitched = teamStats.ip;
    }

    const runsPerInningOff = totalInningsBatted > 0 ? (teamStats.runsFor / totalInningsBatted).toFixed(2) : '—';
    const runsPerInningDef = totalInningsPitched > 0 ? (teamStats.runsAgainst / totalInningsPitched).toFixed(2) : '—';

    // Calculate Errors/Inning
    const totalInningsPlayed = totalInningsBatted > 0 ? totalInningsBatted : 0;
    const errorsPerInning = totalInningsPlayed > 0 ? (teamStats.errors / totalInningsPlayed).toFixed(2) : '—';

    // Team FPCT from individual fielding data
    const teamFPCT = teamStats.fldTC > 0 ? ((teamStats.fldTC - teamStats.fldE) / teamStats.fldTC).toFixed(3) : '—';

    // Team Leaders - Helper to format leader output
    function formatLeaderValue(players, filter, sort) {
        const filtered = players.filter(filter).sort(sort);
        if (filtered.length === 0) return '—';
        if (filtered.length === 1) return filtered[0].name;
        // Check for ties
        const firstVal = sort(filtered[0], filtered[1]) === 0 ? filter(filtered[0]) : null;
        if (firstVal !== null) {
            const tied = [];
            for (let i = 0; i < filtered.length && sort(filtered[i], filtered[i+1]) === 0; i++) {
                tied.push(filtered[i].name);
            }
            if (tied.length > 0) return tied.join(', ');
        }
        return filtered[0].name;
    }

    const leaders = {
        avg: '—', obp: '—', ops: '—', hits: '—', rbi: '—', sb: '—',
        wins: '—', era: '—', hbp: '—'
    };

    // Qualification threshold for rate stats: 2.0 PA per team game
    const LEADER_MIN_PA = jvMinPA;

    // AVG = H/AB (min PA threshold)
    if (teamStats.ab > 0) {
        const byAvg = players.filter(p => p.batting.pa >= LEADER_MIN_PA && p.batting.ab >= 1).sort((a, b) => (b.batting.h / b.batting.ab) - (a.batting.h / a.batting.ab));
        if (byAvg.length > 0) {
            const topAvg = (byAvg[0].batting.h / byAvg[0].batting.ab);
            const tied = byAvg.filter(p => Math.abs((p.batting.h / p.batting.ab) - topAvg) < 0.0001);
            leaders.avg = tied.map(p => p.name).join(', ');
        }
    }

    // OBP = (H+BB+HBP)/(AB+BB+HBP+SF), or (H+BB)/(AB+BB) if HBP/SF not tracked
    const byOBP = players.filter(p => p.batting.pa >= LEADER_MIN_PA).sort((a, b) => {
        const obpA = (a.batting.h + a.batting.bb) / (a.batting.ab + a.batting.bb);
        const obpB = (b.batting.h + b.batting.bb) / (b.batting.ab + b.batting.bb);
        return obpB - obpA;
    });
    if (byOBP.length > 0) {
        const topOBP = (byOBP[0].batting.h + byOBP[0].batting.bb) / (byOBP[0].batting.ab + byOBP[0].batting.bb);
        const tied = byOBP.filter(p => {
            const obp = (p.batting.h + p.batting.bb) / (p.batting.ab + p.batting.bb);
            return Math.abs(obp - topOBP) < 0.0001;
        });
        leaders.obp = tied.map(p => p.name).join(', ');
    }

    // OPS = OBP + SLG. SLG = TB/AB where TB = 1B + 2*2B + 3*3B + 4*HR. If only H tracked, SLG = H/AB
    const byOPS = players.filter(p => p.batting.ab > 0 && p.batting.pa >= LEADER_MIN_PA).sort((a, b) => {
        // Calculate TB (total bases)
        const tbA = (a.batting.h || 0) + (a.batting['2b'] || 0) + 2 * (a.batting['3b'] || 0) + 3 * (a.batting.hr || 0);
        const tbB = (b.batting.h || 0) + (b.batting['2b'] || 0) + 2 * (b.batting['3b'] || 0) + 3 * (b.batting.hr || 0);
        const slgA = tbA / a.batting.ab;
        const slgB = tbB / b.batting.ab;
        const obpA = (a.batting.h + a.batting.bb) / (a.batting.ab + a.batting.bb);
        const obpB = (b.batting.h + b.batting.bb) / (b.batting.ab + b.batting.bb);
        return (obpB + slgB) - (obpA + slgA);
    });
    if (byOPS.length > 0) {
        const p0 = byOPS[0];
        const tb0 = (p0.batting.h || 0) + (p0.batting['2b'] || 0) + 2 * (p0.batting['3b'] || 0) + 3 * (p0.batting.hr || 0);
        const topOPS = (p0.batting.h + p0.batting.bb) / (p0.batting.ab + p0.batting.bb) + tb0 / p0.batting.ab;
        const tied = byOPS.filter(p => {
            const tb = (p.batting.h || 0) + (p.batting['2b'] || 0) + 2 * (p.batting['3b'] || 0) + 3 * (p.batting.hr || 0);
            const ops = (p.batting.h + p.batting.bb) / (p.batting.ab + p.batting.bb) + tb / p.batting.ab;
            return Math.abs(ops - topOPS) < 0.0001;
        });
        leaders.ops = tied.map(p => p.name).join(', ');
    }

    // HITS = max H
    const byHits = players.filter(p => p.batting.h > 0).sort((a, b) => b.batting.h - a.batting.h);
    if (byHits.length > 0) {
        const topHits = byHits[0].batting.h;
        const tied = byHits.filter(p => p.batting.h === topHits);
        leaders.hits = tied.map(p => p.name).join(', ');
    }

    // RBI = max RBI
    const byRBI = players.filter(p => p.batting.rbi > 0).sort((a, b) => b.batting.rbi - a.batting.rbi);
    if (byRBI.length > 0) {
        const topRBI = byRBI[0].batting.rbi;
        const tied = byRBI.filter(p => p.batting.rbi === topRBI);
        leaders.rbi = tied.map(p => p.name).join(', ');
    }

    // SB = max SB
    const bySB = players.filter(p => p.batting.sb > 0).sort((a, b) => b.batting.sb - a.batting.sb);
    if (bySB.length > 0) {
        const topSB = bySB[0].batting.sb;
        const tied = bySB.filter(p => p.batting.sb === topSB);
        leaders.sb = tied.map(p => p.name).join(', ');
    }

    // WINS = max W among pitchers
    const byWins = players.filter(p => (p.pitching.w || 0) > 0).sort((a, b) => (b.pitching.w || 0) - (a.pitching.w || 0));
    if (byWins.length > 0) {
        const topWins = byWins[0].pitching.w;
        const tied = byWins.filter(p => p.pitching.w === topWins);
        leaders.wins = tied.map(p => p.name).join(', ');
    }

    // ERA = min ERA among pitchers meeting IP threshold, formula (ER*7)/IP (using actual innings)
    const byERA = players.filter(p => ipToInnings(p.pitching.ip) >= jvMinIP).sort((a, b) => {
        const eraA = (a.pitching.er * 7) / ipToInnings(a.pitching.ip);
        const eraB = (b.pitching.er * 7) / ipToInnings(b.pitching.ip);
        return eraA - eraB;
    });
    if (byERA.length > 0) {
        const topERA = (byERA[0].pitching.er * 7) / ipToInnings(byERA[0].pitching.ip);
        const tied = byERA.filter(p => {
            const era = (p.pitching.er * 7) / ipToInnings(p.pitching.ip);
            return Math.abs(era - topERA) < 0.0001;
        });
        leaders.era = tied.map(p => p.name).join(', ');
    }

    // HBP = max HBP (shows who isn't afraid to crowd the plate)
    const byHBP = players.filter(p => (p.batting.hbp || 0) > 0).sort((a, b) => (b.batting.hbp || 0) - (a.batting.hbp || 0));
    if (byHBP.length > 0) {
        const topHBP = byHBP[0].batting.hbp;
        const tied = byHBP.filter(p => p.batting.hbp === topHBP);
        leaders.hbp = tied.map(p => p.name).join(', ');
    }

    // Build HTML
    let html = '';

    // Team Stats Section - 6-line layout
    const G = teamStats.games || 0;
    const mercied = teamStats.mercied || 0;
    const fullG = G - mercied;
    const per = (n) => G > 0 ? (n / G).toFixed(1) : '—';
    const rPG = per(teamStats.runsFor);
    const bbPG = per(teamStats.bbDrawn);
    const kRate = teamStats.batPA > 0 ? Math.round((teamStats.batSO / teamStats.batPA) * 100) + '%' : '—';
    const whip = teamStats.ip > 0 ? ((teamStats.pitchingBB + teamStats.h) / ipToInnings(teamStats.ip)).toFixed(2) : '—';
    const k7 = teamStats.ip > 0 ? ((teamStats.so * 7) / ipToInnings(teamStats.ip)).toFixed(1) : '—';
    const kbb = teamStats.pitchingBB > 0 ? (teamStats.so / teamStats.pitchingBB).toFixed(1) : (teamStats.so > 0 ? '∞' : '—');
    const raPG = per(teamStats.runsAgainst);
    const bbAllowedPG = per(teamStats.pitchingBB);
    const ePG = per(teamStats.errors);
    const fbPG = per(freeBasesAllowed);
    const runDiffPG = G > 0 ? (runDiff / G).toFixed(1) : '—';
    const runDiffPGStr = (runDiff >= 0 ? '+' : '') + runDiffPG;
    const runDiffColor = runDiff < 0 ? '#c44' : '#2B5DAA';
    // OBP = (H + BB + HBP) / (AB + BB + HBP + SAC)
    const obpDen = teamStats.ab + teamStats.bbDrawn + teamStats.batHBP + teamStats.batSAC;
    const teamOBP = obpDen > 0 ? fmtAvg((teamStats.hits + teamStats.bbDrawn + teamStats.batHBP) / obpDen) : '—';
    // Strike% and P/BF: show if we have the underlying data, regardless of source
    const strikePct = (teamStats.strikes > 0 && teamStats.pitches > 0) ? Math.round((teamStats.strikes / teamStats.pitches) * 100) + '%' : '—';
    const pitchesPerBF = (teamStats.pitches > 0 && teamStats.bf > 0) ? (teamStats.pitches / teamStats.bf).toFixed(1) : '—';
    const cleanPct = teamStats.cleanTracked && teamStats.defInningsLogged > 0
        ? Math.round((teamStats.cleanInnings / teamStats.defInningsLogged) * 100) + '%'
        : '—';

    const totalInningsPlayedForHeader = Math.round(totalInningsBatted * 10) / 10;
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">';
    html += `<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Team Stats — Through ${G} game${G===1?'':'s'} (${totalInningsPlayedForHeader} inning${totalInningsPlayedForHeader===1?'':'s'} played)</h3>`;
    html += '<div style="font-size: 13px; line-height: 1.9; color: #ddd;">';
    html += `<div><strong style="color:#D4A017; display:inline-block; width:130px;">Record:</strong> ${teamStats.w}-${teamStats.l}</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:130px;">Hitting:</strong> AVG ${teamAvg} &nbsp;|&nbsp; OBP ${teamOBP} &nbsp;|&nbsp; ${teamStats.xbh} XBH &nbsp;|&nbsp; ${rPG} Runs/Game &nbsp;|&nbsp; ${bbPG} Walks/Game &nbsp;|&nbsp; ${kRate} K rate</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:130px;">Pitching:</strong> ERA ${teamERA} &nbsp;|&nbsp; WHIP ${whip} &nbsp;|&nbsp; Strike% ${strikePct} &nbsp;|&nbsp; ${pitchesPerBF} Pitches/BF &nbsp;|&nbsp; K/7 ${k7} &nbsp;|&nbsp; K/BB ${kbb} &nbsp;|&nbsp; ${raPG} Runs Allowed/Game &nbsp;|&nbsp; ${bbAllowedPG} Walks Allowed/Game</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:130px;">Defense:</strong> FPCT ${teamFPCT} &nbsp;|&nbsp; ${ePG} Errors/Game &nbsp;|&nbsp; ${fbPG} Free Bases Allowed/Game &nbsp;|&nbsp; Clean Innings ${cleanPct}</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:130px;">Run Diff/Game:</strong> <span style="color:${runDiffColor}; font-weight:700;">${runDiffPGStr}</span></div>`;
    html += '</div>';
    // Glossary
    html += '<div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #333; font-size: 11px; color: #999; line-height: 1.6;">';
    html += '<strong style="color:#bbb;">What the stats mean:</strong><br>';
    html += '<strong>AVG (batting average):</strong> hits ÷ at-bats.<br>';
    html += '<strong>OBP (On-Base Percentage):</strong> how often a batter reaches base. (Hits + Walks + Hit-by-pitch) ÷ (At-bats + Walks + HBP + Sacrifices). More complete than AVG because it rewards walks. .350+ is strong.<br>';
    html += '<strong>XBH (Extra-Base Hits):</strong> total doubles + triples + home runs. Power indicator.<br>';
    html += '<strong>Runs/Game:</strong> average runs we score per game.<br>';
    html += '<strong>Walks/Game:</strong> average walks we draw per game.<br>';
    html += '<strong>K rate:</strong> share of our plate appearances that end in a strikeout.<br>';
    html += '<strong>ERA:</strong> earned runs allowed per 7 innings pitched.<br>';
    html += '<strong>WHIP:</strong> Walks + Hits allowed, divided by innings pitched. How many baserunners our pitchers give up each inning. Under 1.30 is good, over 1.50 is trouble.<br>';
    html += '<strong>Strike%:</strong> share of total pitches that are strikes (called, swinging, foul, or put in play — any batted ball counts as a strike). 60%+ = throwing strikes, 65%+ = dealing. Best single measure of pitching command.<br>';
    html += '<strong>Pitches/BF:</strong> pitches thrown per batter faced. Under 3.8 = efficient, over 4.3 = laboring.<br>';
    html += '<strong>K/7:</strong> strikeouts per 7 innings pitched.<br>';
    html += '<strong>K/BB:</strong> strikeouts per walk issued. Higher = better command.<br>';
    html += '<strong>Runs Allowed/Game:</strong> average runs the other team scores against us per game.<br>';
    html += '<strong>Walks Allowed/Game:</strong> average walks our pitchers issue per game.<br>';
    html += '<strong>FPCT (Fielding Percentage):</strong> (total chances − errors) ÷ total chances. How often we make the play. .950+ is solid, under .900 is a problem.<br>';
    html += '<strong>Errors/Game:</strong> average fielding errors per game.<br>';
    html += '<strong>Free Bases Allowed/Game:</strong> walks issued + errors, per game. How often we hand the other team 90 feet for free.<br>';
    html += '<strong>Clean Innings:</strong> share of defensive innings with 0 runs allowed and 0 errors. Requires per-inning logging; shows "—" until tracked.<br>';
    html += '<strong>BB% (Walk Rate):</strong> walks ÷ plate appearances. How often a batter draws a walk. 10%+ shows plate discipline.<br>';
    html += '<strong>HBP (Hit By Pitch):</strong> times hit by a pitch. Gets on base and shows willingness to crowd the plate.<br>';
    html += '<strong>E (Errors):</strong> individual fielding errors on the season.<br>';
    html += '<strong>Run Diff/Game:</strong> (runs scored − runs allowed) ÷ games.';
    html += '</div>';
    html += '</div>';

    // Team Leaders
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 4px; color: #D4A017;">Team Leaders</h3>';
    html += `<p style="font-size: 11px; color: #666; margin: 0 0 12px 0;">Min. ${LEADER_MIN_PA} PA (2.0/team game) to qualify for rate stats. Min. ${jvMinIP} IP (1.0/team game) for ERA.</p>`;
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">';
    html += `<div><strong>AVG:</strong> ${leaders.avg}</div>`;
    html += `<div><strong>OBP:</strong> ${leaders.obp}</div>`;
    html += `<div><strong>OPS:</strong> ${leaders.ops}</div>`;
    html += `<div><strong>HITS:</strong> ${leaders.hits}</div>`;
    html += `<div><strong>RBI:</strong> ${leaders.rbi}</div>`;
    html += `<div><strong>SB:</strong> ${leaders.sb}</div>`;
    html += `<div><strong>WINS:</strong> ${leaders.wins}</div>`;
    html += `<div><strong>ERA:</strong> ${leaders.era}</div>`;
    html += `<div><strong>HBP:</strong> ${leaders.hbp}</div>`;
    html += '</div>';
    html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #333; font-size: 11px; color: #999; line-height: 1.6;">';
    html += '<strong>AVG:</strong> batting average (hits ÷ at-bats). &nbsp; ';
    html += '<strong>OBP (On-Base %):</strong> how often a batter reaches base (hits + walks + HBP) ÷ (AB + BB + HBP + sac flies). .350+ is strong. &nbsp; ';
    html += '<strong>OPS:</strong> On-Base % plus Slugging %. Single number combining getting on base and hitting for power. .800+ is excellent at any level. &nbsp; ';
    html += '<strong>HBP:</strong> most hit-by-pitches on the season. Shows willingness to crowd the plate.';
    html += '</div></div>';

    // Batting Table
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Batting</h3>';
    html += '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 1px solid #333;"><th style="text-align: left; padding: 8px;">Player</th><th style="text-align: center; padding: 8px;">PA</th><th style="text-align: center; padding: 8px;">AB</th><th style="text-align: center; padding: 8px;">H</th><th style="text-align: center; padding: 8px;">AVG</th><th style="text-align: center; padding: 8px;">OBP</th><th style="text-align: center; padding: 8px;">OPS</th><th style="text-align: center; padding: 8px;">XBH</th><th style="text-align: center; padding: 8px;">R</th><th style="text-align: center; padding: 8px;">RBI</th><th style="text-align: center; padding: 8px;">BB</th><th style="text-align: center; padding: 8px;">BB%</th><th style="text-align: center; padding: 8px;">SO</th><th style="text-align: center; padding: 8px;">HBP</th><th style="text-align: center; padding: 8px;">SB</th><th style="text-align: center; padding: 8px;">E</th></tr></thead>';
    html += '<tbody>';
    for (const player of players.filter(p => p.batting.pa > 0)) {
        const b = player.batting;
        const avg = b.ab > 0 ? fmtAvg(b.h / b.ab) : '.000';
        const obpDen = b.ab + b.bb + (b.hbp || 0) + (b.sac || 0);
        const obpVal = obpDen > 0 ? (b.h + b.bb + (b.hbp || 0)) / obpDen : 0;
        const tb = (b.tb != null) ? b.tb : (b.h || 0) + (b['2b'] || 0) + 2 * (b['3b'] || 0) + 3 * (b.hr || 0);
        const slgVal = b.ab > 0 ? tb / b.ab : 0;
        const opsStr = b.ab > 0 ? fmtAvg(obpVal + slgVal) : '—';
        html += `<tr style="border-bottom: 1px solid #222;"><td style="padding: 8px;">${player.name}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${b.pa}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${b.ab}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${b.h}</td>`;
        const obpStr = obpDen > 0 ? fmtAvg(obpVal) : '—';
        const xbhVal = (b['2b'] || 0) + (b['3b'] || 0) + (b.hr || 0);
        html += `<td style="text-align: center; padding: 8px;">${avg}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${obpStr}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${opsStr}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${xbhVal}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.r}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.rbi}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.bb}</td>`;
        const bbPct = b.pa > 0 ? Math.round((b.bb / b.pa) * 100) + '%' : '—';
        html += `<td style="text-align: center; padding: 8px;">${bbPct}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.so}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.hbp || 0}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.sb}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.fielding.e || 0}</td></tr>`;
    }
    html += '</tbody></table></div>';

    // Pitching Table
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Pitching</h3>';
    html += '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 1px solid #333;"><th style="text-align: left; padding: 8px;">Player</th><th style="text-align: center; padding: 8px;">GP</th><th style="text-align: center; padding: 8px;">GS</th><th style="text-align: center; padding: 8px;">W</th><th style="text-align: center; padding: 8px;">L</th><th style="text-align: center; padding: 8px;">SV</th><th style="text-align: center; padding: 8px;">IP</th><th style="text-align: center; padding: 8px;">H</th><th style="text-align: center; padding: 8px;">ER</th><th style="text-align: center; padding: 8px;">BB</th><th style="text-align: center; padding: 8px;">SO</th><th style="text-align: center; padding: 8px;">ERA</th><th style="text-align: center; padding: 8px;">WHIP</th><th style="text-align: center; padding: 8px;">Strike%</th><th style="text-align: center; padding: 8px;">P/BF</th></tr></thead>';
    html += '<tbody>';
    for (const player of players.filter(p => p.pitching.ip > 0)) {
        const era = ((player.pitching.er * 7) / ipToInnings(player.pitching.ip)).toFixed(2);
        const whip = (((player.pitching.bb + player.pitching.h) / ipToInnings(player.pitching.ip)) || 0).toFixed(2);
        html += `<tr style="border-bottom: 1px solid #222;"><td style="padding: 8px;">${player.name}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.gp}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.gs}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.w}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.l}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.sv}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.ip}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.h}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.er}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.bb}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.pitching.so}</td>`;
        // Strike% and P/BF: show if we have the underlying data (pitches, strikes, bf)
        // regardless of whether it came from seasonPitching or game accumulation
        const sPct = (player.pitching.strikes > 0 && player.pitching.pitches > 0) ? Math.round((player.pitching.strikes / player.pitching.pitches) * 100) + '%' : '—';
        const pbf = (player.pitching.pitches > 0 && player.pitching.bf > 0) ? (player.pitching.pitches / player.pitching.bf).toFixed(1) : '—';
        html += `<td style="text-align: center; padding: 8px;">${era}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${whip}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${sPct}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${pbf}</td></tr>`;
    }
    html += '</tbody></table></div>';

    return html;
}

function encryptJVStats(htmlString, password = 'baseball26eagles') {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(htmlString, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        data: encrypted.toString('base64')
    };
}

// Generate JV stats and encrypt
const jvStatsHtml = generateJVStatsHTML(scores.playerStats, scores);
const encryptedPayload = encryptJVStats(jvStatsHtml);
const jvStatsDataScript = JSON.stringify(encryptedPayload);

// Replace encrypted payload in HTML
html = html.replace(
    /<script id="jv-stats-data" type="application\/json" data-encrypted="true">\{[\s\S]*?\}<\/script>/,
    `<script id="jv-stats-data" type="application/json" data-encrypted="true">${jvStatsDataScript}</script>`
);

// ============================================================
// 11. UPDATE FOOTER TIMESTAMP
// ============================================================
// Footer format: "March 25, 2026 (Updated 7:06 AM)"
const timeStr = today.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
html = html.replace(
    /[A-Z][a-z]+ \d{1,2}, \d{4} \(Updated [^)]*\)/,
    `${longDate} (Updated ${timeStr})`
);

// ============================================================
// UPDATE DATA SOURCE STATUS
// ============================================================
function buildDataSourceStatus() {
    // Get the latest daily-sweep newsLog entries
    const sweeps = (scores.newsLog || [])
        .filter(e => e.type === 'daily-sweep' || e.type === 'gc-season-stats-load')
        .sort((a, b) => b.date.localeCompare(a.date));
    const latestSweep = sweeps.find(s => s.sourcesChecked);
    const latestDate = sweeps[0] ? sweeps[0].date : todayStr;

    // Build status items from latest sweep sourcesChecked
    const sources = [];
    if (latestSweep && latestSweep.sourcesChecked) {
        const checks = Array.isArray(latestSweep.sourcesChecked) ? latestSweep.sourcesChecked : Object.entries(latestSweep.sourcesChecked).map(([k,v]) => ({source: k, status: v}));
        for (const c of checks) {
            const name = c.source || c.name || 'Unknown';
            const status = c.status || 'unknown';
            const method = c.method || '';
            let dotClass = 'live';
            if (status.includes('broken') || status.includes('down') || status.includes('error') || status.includes('blocked') || status.includes('timeout')) dotClass = 'stale';
            else if (status.includes('limited') || status.includes('partial') || status.includes('empty')) dotClass = 'caution';
            sources.push({ name, status, method, dotClass });
        }
    }

    // Add GC season stats status
    const gcLoad = sweeps.find(s => s.type === 'gc-season-stats-load');
    if (gcLoad) {
        sources.push({ name: 'GameChanger Season Stats (Batting/Pitching/Fielding)', status: 'loaded', method: 'User-provided screenshots', dotClass: 'live' });
    }

    // Check if we have GC data on players
    const dfPlayers = scores.playerStats && scores.playerStats.df ? Object.keys(scores.playerStats.df) : [];
    const playersWithGC = dfPlayers.filter(n => {
        const p = scores.playerStats.df[n];
        return p.seasonStats && p.seasonStats.source && p.seasonStats.source.includes('GameChanger');
    });
    if (playersWithGC.length > 0) {
        sources.push({ name: `GameChanger Varsity (${playersWithGC.length}/${dfPlayers.length} players with season stats)`, status: 'loaded', method: 'Verified', dotClass: 'live' });
    }

    let html = '';
    const checked = sources.filter(s => s.dotClass === 'live');
    const caution = sources.filter(s => s.dotClass === 'caution');
    const stale = sources.filter(s => s.dotClass === 'stale');

    if (checked.length > 0) {
        html += `<h3 style="margin-bottom: 15px;">CHECKED</h3><div class="status-grid">`;
        for (const s of checked) {
            html += `<div class="status-item"><div class="status-dot live"></div><div class="status-label">${s.name}${s.method ? ' — ' + s.method : ''}</div></div>`;
        }
        html += `</div>`;
    }
    if (caution.length > 0) {
        html += `<h3 style="margin: 20px 0 15px;">LIMITED</h3><div class="status-grid">`;
        for (const s of caution) {
            html += `<div class="status-item"><div class="status-dot stale"></div><div class="status-label">${s.name}${s.method ? ' — ' + s.method : ''}</div></div>`;
        }
        html += `</div>`;
    }
    if (stale.length > 0) {
        html += `<h3 style="margin: 20px 0 15px;">UNREACHABLE</h3><div class="status-grid">`;
        for (const s of stale) {
            html += `<div class="status-item"><div class="status-dot stale"></div><div class="status-label">${s.name}${s.method ? ' — ' + s.method : ''}</div></div>`;
        }
        html += `</div>`;
    }

    html += `<p style="font-size: 11px; color: #555; margin-top: 15px;">Last sweep: ${latestDate}</p>`;
    return html;
}

// Replace Data Source Status content in both varsity and JV tabs
const dsStatusRegex = /<div class="collapsible-content collapsed">\s*<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #1a1a1a;">\s*<h3 style="margin-bottom: 15px;">CHECKED[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*(?=\s*<\/div>\s*(?:<\/div>|$|\s*<!--))/g;
const newDSContent = `<div class="collapsible-content collapsed">
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #1a1a1a;">
                        ${buildDataSourceStatus()}
                    </div>
                </div>
            </div>`;
html = html.replace(dsStatusRegex, newDSContent);

// ============================================================
// ANALYTICS (GoatCounter — free, privacy-friendly, no cookies)
// ============================================================
const goatScript = `<script data-goatcounter="https://dobbsferrybaseball.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`;
if (!html.includes('goatcounter')) {
    html = html.replace('</body>', `${goatScript}\n</body>`);
}

// ============================================================
// WRITE OUTPUT
// ============================================================
fs.writeFileSync(htmlPath, html);
console.log('Dashboard updated successfully.');
console.log(`Date: ${longDate}`);
console.log(`Varsity Record: ${vRecord.record} | Streak: ${vRecord.streak} | League: ${vLeague}`);
console.log(`JV Record: ${jvRecord.record}`);
if (nextVarsityGame) {
    const nd = new Date(nextVarsityGame.date + 'T12:00:00');
    console.log(`Next Varsity Game: ${formatShortMonth(nd)} ${nd.getDate()} vs ${nextVarsityGame.opponent} (${daysBetween(today, nd)} days)`);
}
if (nextJvGame) {
    const nd = new Date(nextJvGame.date + 'T12:00:00');
    console.log(`Next JV Game: ${formatShortMonth(nd)} ${nd.getDate()} vs ${nextJvGame.opponent} (${daysBetween(today, nd)} days)`);
}
