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

// ============================================================
// VARSITY SCHEDULE (hardcoded from the HTML)
// ============================================================
const varsitySchedule = [
    { date: '2026-03-19', display: 'Mar 19', day: 'Thu', time: '4:15 PM', opponent: 'Ardsley', location: 'Away', venue: 'Ardsley High School', type: 'Scrimmage' },
    { date: '2026-03-24', display: 'Mar 24', day: 'Tue', time: '4:30 PM', opponent: 'Irvington', location: 'Away', venue: 'Memorial Park (Dow\'s Lane)', type: 'Game' },
    { date: '2026-03-27', display: 'Mar 27', day: 'Fri', time: '4:30 PM', opponent: 'Saunders', location: 'Home', venue: 'Gould Park', type: 'Game' },
    { date: '2026-04-07', display: 'Apr 7', day: 'Tue', time: '4:30 PM', opponent: 'Edgemont', location: 'Away', venue: 'Edgemont HS', type: 'Game' },
    { date: '2026-04-08', display: 'Apr 8', day: 'Wed', time: '4:45 PM', opponent: 'Sleepy Hollow', location: 'Home', venue: 'Gould Park', type: 'Game (time per SG)' },
    { date: '2026-04-11', display: 'Apr 11', day: 'Sat', time: '3:00 PM', opponent: 'Pearl River', location: 'Away', venue: 'Pearl River HS', type: 'Game' },
    { date: '2026-04-13', display: 'Apr 13', day: 'Mon', time: '4:30 PM', opponent: 'Irvington', location: 'Away', venue: 'Memorial Field', type: 'Game' },
    { date: '2026-04-14', display: 'Apr 14', day: 'Tue', time: '4:30 PM', opponent: 'Ardsley', location: 'Home', venue: 'Gould Park', type: 'Game' },
    { date: '2026-04-18', display: 'Apr 18', day: 'Sat', time: '11:00 AM', opponent: 'Haldane', location: 'Away', venue: 'Haldane HS', type: 'Game' },
    { date: '2026-04-20', display: 'Apr 20', day: 'Mon', time: '4:30 PM', opponent: 'Blind Brook', location: 'Home', venue: 'Gould Park', type: 'League' },
    { date: '2026-04-22', display: 'Apr 22', day: 'Wed', time: '4:30 PM', opponent: 'Blind Brook', location: 'Away', venue: 'Blind Brook HS', type: 'League' },
    { date: '2026-04-24', display: 'Apr 24', day: 'Fri', time: '4:30 PM', opponent: 'Hastings', location: 'Home', venue: 'Gould Park', type: 'League' },
    { date: '2026-04-27', display: 'Apr 27', day: 'Mon', time: '5:00 PM', opponent: 'Valhalla', location: 'Away', venue: 'Kensico Field', type: 'League' },
    { date: '2026-04-28', display: 'Apr 28', day: 'Tue', time: '4:30 PM', opponent: 'Hastings', location: 'Away', venue: 'Hastings HS', type: 'League' },
    { date: '2026-04-30', display: 'Apr 30', day: 'Thu', time: '4:30 PM', opponent: 'Rye Neck', location: 'Away', venue: 'Rye Neck HS', type: 'League' },
    { date: '2026-05-01', display: 'May 1', day: 'Fri', time: '4:30 PM', opponent: 'Rye Neck', location: 'Home', venue: 'Gould Park', type: 'League' },
    { date: '2026-05-04', display: 'May 4', day: 'Mon', time: '4:30 PM', opponent: 'Tuckahoe', location: 'Home', venue: 'Gould Park', type: 'League' },
    { date: '2026-05-06', display: 'May 6', day: 'Wed', time: '4:30 PM', opponent: 'Tuckahoe', location: 'Away', venue: 'Parkway Oval', type: 'League' },
    { date: '2026-05-07', display: 'May 7', day: 'Thu', time: '4:30 PM', opponent: 'Leffell School', location: 'Away', venue: 'Leffell School', type: 'League' },
    { date: '2026-05-11', display: 'May 11', day: 'Mon', time: '4:30 PM', opponent: 'Westlake', location: 'Home', venue: 'Gould Park', type: 'Game' },
    { date: '2026-05-12', display: 'May 12', day: 'Tue', time: '4:30 PM', opponent: 'Leffell School', location: 'Home', venue: 'Gould Park', type: 'League' },
];

const jvSchedule = [
    { date: '2026-04-07', display: 'Apr 7', day: 'Tue', time: '4:30 PM', opponent: 'Edgemont JV', location: 'Home' },
    { date: '2026-04-08', display: 'Apr 8', day: 'Wed', time: '4:30 PM', opponent: 'Sleepy Hollow JV', location: 'Away' },
    { date: '2026-04-11', display: 'Apr 11', day: 'Sat', time: '3:00 PM', opponent: 'Pearl River JV', location: 'Home' },
    { date: '2026-04-14', display: 'Apr 14', day: 'Tue', time: '4:30 PM', opponent: 'Ardsley JV', location: 'Away' },
    { date: '2026-04-16', display: 'Apr 16', day: 'Thu', time: '4:30 PM', opponent: 'Hastings JV', location: 'Away' },
    { date: '2026-04-20', display: 'Apr 20', day: 'Mon', time: '4:30 PM', opponent: 'Blind Brook JV', location: 'Away' },
    { date: '2026-04-22', display: 'Apr 22', day: 'Wed', time: '4:30 PM', opponent: 'Blind Brook JV', location: 'Home' },
    { date: '2026-04-28', display: 'Apr 28', day: 'Tue', time: '4:30 PM', opponent: 'Hastings JV', location: 'Home' },
    { date: '2026-04-30', display: 'Apr 30', day: 'Thu', time: '4:30 PM', opponent: 'Rye Neck JV', location: 'Home' },
    { date: '2026-05-01', display: 'May 1', day: 'Fri', time: '4:30 PM', opponent: 'Rye Neck JV', location: 'Away' },
    { date: '2026-05-04', display: 'May 4', day: 'Mon', time: '4:30 PM', opponent: 'Tuckahoe JV', location: 'Away' },
    { date: '2026-05-06', display: 'May 6', day: 'Wed', time: '4:30 PM', opponent: 'Tuckahoe JV', location: 'Home' },
    { date: '2026-05-07', display: 'May 7', day: 'Thu', time: '4:30 PM', opponent: 'Leffell JV', location: 'Home' },
    { date: '2026-05-12', display: 'May 12', day: 'Tue', time: '4:30 PM', opponent: 'Leffell JV', location: 'Away' },
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
html = html.replace(
    /Eagles Baseball Daily Intelligence - [A-Z][a-z]+ \d{1,2}, \d{4}/,
    `Eagles Baseball Daily Intelligence - ${longDate}`
);
// Update subtitle "The Latest — March 25, 2026"
html = html.replace(
    /The Latest — [A-Z][a-z]+ \d{1,2}, \d{4}/,
    `The Latest — ${longDate}`
);

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
        const color = vRecord.wins > vRecord.losses ? '#10B981' : vRecord.losses > vRecord.wins ? '#EF4444' : '#FFFFFF';
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
        const color = vRecord.streak.startsWith('W') ? '#10B981' : vRecord.streak.startsWith('L') ? '#EF4444' : '#FFFFFF';
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

    // Replace the entire varsity alert card
    const alertRegex = /(<div id="varsity"[\s\S]*?)(<div class="card alert"[\s\S]*?<\/div>\s*<\/div>)([\s\S]*?<!-- Quick Stats -->)/;
    html = html.replace(alertRegex, `$1<div class="card alert">
                <div class="alert-title">NEXT GAME — ${daysText} (${shortMonth.toUpperCase()} ${nextDate.getDate()})</div>
                <div class="alert-game">${shortMonth} ${nextDate.getDate()} (${dayOfWeek}) <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextVarsityGame.time} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${homeAway} ${nextVarsityGame.opponent} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${venueName}</div>
                <div class="alert-details">Non-league${lastResultText}</div>
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

        const badge = i === 0
            ? '<span class="game-badge highlight">NEXT</span>'
            : '';
        const borderStyle = i === 0
            ? ' style="border-left-color: #10B981;"'
            : '';

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
// 5. UPDATE RECENT SCORES (VARSITY)
// ============================================================
function buildRecentScores() {
    const sortedDates = Object.keys(scores.varsity).sort().reverse();
    if (sortedDates.length === 0) {
        return '<div class="empty-state"><p>No games played yet.</p></div>';
    }

    let html = '';
    for (const date of sortedDates) {
        const g = scores.varsity[date];
        const d = new Date(date + 'T12:00:00');
        const shortMonth = formatShortMonth(d);
        const won = g.df > g.opp;
        const dfColor = won ? '#10B981' : '#EF4444';
        const badgeColor = won ? '#10B981' : '#EF4444';
        const badgeText = won ? 'W' : 'L';

        // Determine league/non-league
        const schedGame = varsitySchedule.find(sg => sg.date === date);
        const gameType = schedGame && schedGame.type === 'League' ? 'League' : 'Non-League';

        html += `
                <div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">${shortMonth} ${d.getDate()} | ${gameType}</div>
                        <div style="font-size: 16px; font-weight: 700;"><span style="color: ${dfColor};">Dobbs Ferry ${g.df}</span>, ${g.opponent} ${g.opp}</div>
                        <div style="font-size: 12px; color: #888; margin-top: 4px;">@ ${g.location} | Source: ${g.source || 'Reported'}</div>
                    </div>
                    <span class="game-badge" style="background-color: ${badgeColor};">${badgeText}</span>
                </div>`;
    }
    return html;
}

const recentScoresRegex = /(<!-- Conference Scores -->\s*<div class="card">\s*<h2>Conference 3 Division B Scores<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- Standings))/;
html = html.replace(recentScoresRegex, `$1\n${buildRecentScores()}\n                <p style="color: #888; font-size: 13px; margin-top: 10px;">Conference play begins April 20.</p>\n            </div>\n\n            `);

// ============================================================
// 6. MARK COMPLETED GAMES IN VARSITY SCHEDULE TABLE
// ============================================================
for (const [date, score] of Object.entries(scores.varsity)) {
    const d = new Date(date + 'T12:00:00');
    const shortMonth = formatShortMonth(d);
    const dayNum = d.getDate();
    const won = score.df > score.opp;
    const resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
    const resultColor = won ? '#10B981' : '#EF4444';

    // Match the schedule row for this date and mark as completed
    // Pattern: <tr> or <tr class="completed"> with the date cell
    const datePattern = new RegExp(
        `(<tr(?:\\s+class="[^"]*")?>\\s*<td>${shortMonth} ${dayNum}<\\/td>)`,
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
// 6b. UPDATE DIVISION B STANDINGS
// ============================================================
// Division B teams and their league game data
const divBTeams = [
    'Ardsley Panthers',
    'Blind Brook Trojans',
    'Dobbs Ferry Eagles',
    'Hastings Yellow Jackets',
    'Rye Neck Panthers',
    'Tuckahoe Tigers',
    'Valhalla Vikings'
];

// Map team names to schedule opponent names
const teamToOpponent = {
    'Dobbs Ferry Eagles': 'Dobbs Ferry'
};

// Compute league records for DF from scores.json
function computeDivBStandings() {
    const standings = {};
    for (const team of divBTeams) {
        standings[team] = { w: 0, l: 0, streak: '—', lastResults: [] };
    }

    // DF league games from scores.json
    const leagueGames = varsitySchedule.filter(g => g.type === 'League');
    const leagueDates = new Set(leagueGames.map(g => g.date));

    for (const [date, g] of Object.entries(scores.varsity)) {
        if (!leagueDates.has(date)) continue;
        const won = g.df > g.opp;
        if (won) {
            standings['Dobbs Ferry Eagles'].w++;
            standings['Dobbs Ferry Eagles'].lastResults.push('W');
        } else {
            standings['Dobbs Ferry Eagles'].l++;
            standings['Dobbs Ferry Eagles'].lastResults.push('L');
        }
    }

    // Compute streak for each team
    for (const team of divBTeams) {
        const results = standings[team].lastResults;
        if (results.length > 0) {
            const last = results[results.length - 1];
            let count = 0;
            for (let i = results.length - 1; i >= 0; i--) {
                if (results[i] === last) count++;
                else break;
            }
            standings[team].streak = `${last}${count}`;
        }
    }

    // Sort by win pct, then wins
    const sorted = divBTeams.slice().sort((a, b) => {
        const sa = standings[a], sb = standings[b];
        const totalA = sa.w + sa.l, totalB = sb.w + sb.l;
        const pctA = totalA > 0 ? sa.w / totalA : 0;
        const pctB = totalB > 0 ? sb.w / totalB : 0;
        if (pctB !== pctA) return pctB - pctA;
        return sb.w - sa.w;
    });

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
        rowsHtml += `
                        <tr${highlight}>
                            <td>${team}</td>
                            <td>${s.w}</td>
                            <td>${s.l}</td>
                            <td>${pct}</td>
                            <td>${gb}</td>
                            <td>${s.streak}</td>
                        </tr>`;
    }

    return rowsHtml;
}

// Check if any league games have been played
const leagueGamesPlayed = Object.keys(scores.varsity).some(date => {
    return varsitySchedule.some(g => g.date === date && g.type === 'League');
});

const standingsSubtitle = leagueGamesPlayed
    ? `Updated ${formatLongDate(today)}.`
    : 'League play begins April 20.';

const standingsRegex = /(<!-- Standings -->\s*<div class="card">\s*<h2>Division B Standings<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- What's Happening))/;
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
                            <th>Streak</th>
                        </tr>
                    </thead>
                    <tbody>${computeDivBStandings()}
                    </tbody>
                </table>
            </div>

            `);

// ============================================================
// 7. UPDATE JV SECTION
// ============================================================
const jvRecord = computeRecord(scores.jv);
const playedJvDates = new Set(Object.keys(scores.jv));
const nextJvGames = jvSchedule.filter(g => !playedJvDates.has(g.date) && g.date >= todayStr);
const nextJvGame = nextJvGames[0];

// Update JV Status Alert
if (nextJvGame) {
    const nextJvDate = new Date(nextJvGame.date + 'T12:00:00');
    const daysUntil = daysBetween(today, nextJvDate);
    const dayName = SHORT_DAYS[nextJvDate.getDay()];
    const shortMonth = formatShortMonth(nextJvDate);
    const homeAway = nextJvGame.location === 'Home' ? 'vs' : 'at';

    // Check if JV has played any games
    const jvHasPlayed = Object.keys(scores.jv).length > 0;

    let alertTitle, alertClass;
    if (!jvHasPlayed) {
        alertTitle = `JV SEASON OPENER — ${daysUntil} DAYS AWAY (${shortMonth.toUpperCase()} ${nextJvDate.getDate()})`;
    } else {
        alertTitle = `JV NEXT GAME — ${shortMonth} ${nextJvDate.getDate()} ${homeAway} ${nextJvGame.opponent}`;
    }

    html = html.replace(
        /<div class="alert-title">JV [^<]*/,
        `<div class="alert-title">${alertTitle}`
    );

    html = html.replace(
        /(<div id="jv"[\s\S]*?<div class="alert-game">)[\s\S]*?(<\/div>\s*<div class="alert-details">)/,
        `$1${shortMonth} ${nextJvDate.getDate()} (${dayName}) <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextJvGame.time} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${homeAway} ${nextJvGame.opponent} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextJvGame.location}$2`
    );
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
    const streakColor = jvRecord.streak.startsWith('W') ? '#10B981' : jvRecord.streak.startsWith('L') ? '#EF4444' : '#888';
    const streakDisplay = jvRecord.streak || '--';
    html = html.replace(
        /(<!-- JV Quick Stats -->[\s\S]*?<div class="stat-label">Streak<\/div>\s*<div class="stat-value")(.*?)(>)[^<]*([\s\S]*?<\/div>)/,
        `$1 style="color: ${streakColor};">${streakDisplay}</div>`
    );
}

// Update Next Four JV Games
function buildNextFourJV() {
    const upcoming = jvSchedule.filter(g => !playedJvDates.has(g.date) && g.date >= todayStr);
    const completedJv = jvSchedule.filter(g => playedJvDates.has(g.date)).sort((a, b) => b.date.localeCompare(a.date));

    let displayGames = [];

    // Show most recent completed JV game if within 3 days
    if (completedJv.length > 0) {
        const last = completedJv[0];
        const lastDate = new Date(last.date + 'T12:00:00');
        if (daysBetween(lastDate, today) <= 3) {
            displayGames.push({ ...last, completed: true });
        }
    }

    for (const g of upcoming) {
        if (displayGames.length >= 4) break;
        displayGames.push({ ...g, completed: false });
    }

    let cardsHtml = '';
    let isFirstUpcoming = true;
    const jvHasPlayed = Object.keys(scores.jv).length > 0;

    for (const g of displayGames) {
        const d = new Date(g.date + 'T12:00:00');
        const monthName = MONTHS[d.getMonth()].toUpperCase();
        const dayName = DAYS[d.getDay()].toUpperCase();
        const homeAway = g.location === 'Home' ? 'vs' : 'at';

        if (g.completed) {
            const score = scores.jv[g.date];
            const won = score.df > score.opp;
            const resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
            const resultColor = won ? '#10B981' : '#EF4444';

            cardsHtml += `
                    <div class="game-card" style="opacity: 0.6; border-color: ${resultColor};">
                        <div class="game-date">${monthName} ${d.getDate()} | ${dayName}</div>
                        <div class="game-opponent">${homeAway} ${g.opponent}</div>
                        <div class="game-details" style="color: ${resultColor}; font-weight: 700;">${resultText}</div>
                        <div class="game-details">${g.location}</div>
                        <span class="game-badge" style="background-color: ${resultColor};">FINAL</span>
                    </div>`;
        } else {
            let badge = '';
            if (isFirstUpcoming) {
                badge = !jvHasPlayed && displayGames.indexOf(g) === 0
                    ? '<span class="game-badge highlight">OPENER</span>'
                    : '<span class="game-badge highlight">NEXT</span>';
                isFirstUpcoming = false;
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

// Update JV Scores section
function buildJvScores() {
    const sortedDates = Object.keys(scores.jv).sort().reverse();
    if (sortedDates.length === 0) {
        return '<div class="empty-state">\n                    <p>No JV games played yet. Season opens Apr 7.</p>\n                </div>';
    }

    let html = '';
    for (const date of sortedDates) {
        const g = scores.jv[date];
        const d = new Date(date + 'T12:00:00');
        const shortMonth = formatShortMonth(d);
        const won = g.df > g.opp;
        const dfColor = won ? '#10B981' : '#EF4444';
        const badgeColor = won ? '#10B981' : '#EF4444';
        const badgeText = won ? 'W' : 'L';

        html += `
                <div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">${shortMonth} ${d.getDate()}</div>
                        <div style="font-size: 16px; font-weight: 700;"><span style="color: ${dfColor};">Dobbs Ferry ${g.df}</span>, ${g.opponent} ${g.opp}</div>
                        <div style="font-size: 12px; color: #888; margin-top: 4px;">Source: ${g.source || 'Reported'}</div>
                    </div>
                    <span class="game-badge" style="background-color: ${badgeColor};">${badgeText}</span>
                </div>`;
    }
    return html;
}

const jvScoresRegex = /(<!-- JV Scores -->\s*<div class="card">\s*<h2>JV Scores<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- Key JV Dates))/;
html = html.replace(jvScoresRegex, `$1\n                ${buildJvScores()}\n            </div>\n\n            `);

// ============================================================
// 8. UPDATE FOOTER TIMESTAMP
// ============================================================
// Footer format: "March 25, 2026 (Updated 7:06 AM)"
const timeStr = today.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
html = html.replace(
    /[A-Z][a-z]+ \d{1,2}, \d{4} \(Updated [^)]*\)/,
    `${longDate} (Updated ${timeStr})`
);

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
