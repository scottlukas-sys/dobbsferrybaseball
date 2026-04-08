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

// Format averages in TV style: no leading zero. ".333" not "0.333", "1.000" stays "1.000"
function fmtAvg(n) {
    return n.toFixed(3).replace(/^0\./, '.');
}

// ============================================================
// VARSITY SCHEDULE (hardcoded from the HTML)
// ============================================================
const varsitySchedule = [
    { date: '2026-03-19', display: 'Mar 19', day: 'Thu', time: '4:15 PM', opponent: 'Ardsley', location: 'Away', venue: 'Ardsley High School', type: 'Scrimmage' },
    { date: '2026-03-24', display: 'Mar 24', day: 'Tue', time: '4:30 PM', opponent: 'Irvington', location: 'Away', venue: 'Memorial Park (Dow\'s Lane)', type: 'Game' },
    { date: '2026-03-27', display: 'Mar 27', day: 'Fri', time: '4:30 PM', opponent: 'Saunders', location: 'Home', venue: 'Gould Park', type: 'Game' },
    { date: '2026-04-07', display: 'Apr 7', day: 'Tue', time: '4:30 PM', opponent: 'Edgemont', location: 'Away', venue: 'Edgemont HS', type: 'Game' },
    { date: '2026-04-08', display: 'Apr 8', day: 'Wed', time: '4:30 PM', opponent: 'Sleepy Hollow', location: 'Home', venue: 'Gould Park', type: 'Game' },
    // POSTPONED — removed from DFSD athletic calendar as of 2026-04-07; no makeup date posted
    // { date: '2026-04-11', display: 'Apr 11', day: 'Sat', time: '3:00 PM', opponent: 'Pearl River', location: 'Away', venue: 'Pearl River HS', type: 'Game' },
    { date: '2026-04-13', display: 'Apr 13', day: 'Mon', time: '4:30 PM', opponent: 'Irvington', location: 'Home', venue: 'Gould Park', type: 'Game' },
    { date: '2026-04-14', display: 'Apr 14', day: 'Tue', time: '4:30 PM', opponent: 'Ardsley', location: 'Home', venue: 'Gould Park', type: 'Game' },
    { date: '2026-04-18', display: 'Apr 18', day: 'Sat', time: '11:00 AM', opponent: 'Haldane', location: 'Away', venue: 'Haldane HS', type: 'Game' },
    { date: '2026-04-20', display: 'Apr 20', day: 'Mon', time: '4:30 PM', opponent: 'Blind Brook', location: 'Home', venue: 'Gould Park', type: 'League' },
    { date: '2026-04-22', display: 'Apr 22', day: 'Wed', time: '4:30 PM', opponent: 'Blind Brook', location: 'Away', venue: 'Blind Brook HS', type: 'League' },
    { date: '2026-04-24', display: 'Apr 24', day: 'Fri', time: '4:30 PM', opponent: 'Hastings', location: 'Home', venue: 'Gould Park', type: 'League' },
    { date: '2026-04-27', display: 'Apr 27', day: 'Mon', time: '5:00 PM', opponent: 'Valhalla', location: 'Away', venue: 'Kensico Field', type: 'Game' },
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
    // POSTPONED — removed from DFSD athletic calendar as of 2026-04-07; no makeup date posted
    // { date: '2026-04-11', display: 'Apr 11', day: 'Sat', time: '3:00 PM', opponent: 'Pearl River JV', location: 'Home' },
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
// 6a2. MARK COMPLETED GAMES IN JV SCHEDULE TABLE (6 columns: date, day, time, opp, location, type)
// ============================================================
// JV ONLY: Iterate scores.jv and mark completed JV games
// Pattern: Row with exactly 5 <td> elements BEFORE the type column (date, day, time, opp, location)
// This ensures we only match JV rows (6 columns total), never varsity rows (7 columns)
for (const [date, score] of Object.entries(scores.jv || {})) {
    const d = new Date(date + 'T12:00:00');
    const shortMonth = formatShortMonth(d);
    const dayNum = d.getDate();
    const won = score.df > score.opp;
    let resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
    const resultColor = won ? '#D4A017' : '#888';

    // Mark the matching JV row as completed (exactly 6 td columns — NOT 7 which would be varsity)
    // The 6th column (type/badge) should only contain text or spans, not another <td>
    // The content pattern [^<]*(?:<[^/td][^<]*)*  matches text that may contain non-closing tags (like <span>)
    // but stops before any closing tag or new <td> opening
    const jvRowPattern = new RegExp(
        `(<tr(?:\\s+class="[^"]*")?>\\s*<td>${shortMonth} ${dayNum}<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>[^<]*<\\/td>\\s*<td>)([^<]*(?:<(?!td)[^<]*)*?)(<\\/td>\\s*<\\/tr>)`,
        'g'
    );
    html = html.replace(jvRowPattern, (match, p1, p2, p3) => {
        // Mark row as completed and add score badge
        const opened = p1.replace(/<tr(?:\s+class="[^"]*")?>/, m => {
            if (m.includes('completed')) return m;
            return m.includes('class=') ? m.replace(/class="([^"]*)"/, 'class="completed $1"') : '<tr class="completed">';
        });
        return `${opened}<span class="game-badge" style="background-color:${resultColor};">${resultText}</span>${p3}`;
    });
}

// ============================================================
// 6b. UPDATE DIVISION B STANDINGS
// ============================================================
// Division B teams and their league game data
const divBTeams = [
    'Blind Brook Trojans',
    'Dobbs Ferry Eagles',
    'Hastings #D4A017 Jackets',
    'Leffell School Lions',
    'Rye Neck Panthers',
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

    // Map short names to full standings names
    const nameMap = {
        'Blind Brook': 'Blind Brook Trojans',
        'Dobbs Ferry': 'Dobbs Ferry Eagles',
        'Hastings': 'Hastings #D4A017 Jackets',
        'Leffell School': 'Leffell School Lions',
        'Leffell': 'Leffell School Lions',
        'Rye Neck': 'Rye Neck Panthers',
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
        const threat = t.threat || 'UNKNOWN';
        let borderStyle = '';
        let badgeStyle = '';
        if (threat === 'THREAT') {
            borderStyle = ' style="border-left-color: #888;"';
            badgeStyle = ' style="background-color: #888;"';
        } else if (threat === 'WATCH') {
            borderStyle = ' style="border-left-color: #D4A017;"';
            badgeStyle = ' style="background-color: #D4A017;"';
        }

        cardsHtml += `
                <div class="team-card"${borderStyle}>
                    <div class="team-name">${t.fullName}</div>
                    <span class="threat-badge"${badgeStyle}>${threat}</span>
                    <div class="team-intel">${t.intel}</div>
                    <div class="team-next">Next vs DF: ${t.nextVsDF}</div>
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
    const streakColor = jvRecord.streak.startsWith('W') ? '#D4A017' : jvRecord.streak.startsWith('L') ? '#888' : '#888';
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
            let resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
            const resultColor = won ? '#D4A017' : '#888';

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
        const dfColor = won ? '#D4A017' : '#888';
        const badgeColor = won ? '#D4A017' : '#888';
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
// 8. PLAYERS TO WATCH — AUTO-GENERATED BY PIS (Player Impact Score)
// ============================================================
// PIS Formula:
//   Hitting (per game): H(1) + XBH bonus(+1 per 2B/3B, +2 per HR) + RBI(1.5) + R(1) + BB(0.5) + multi-hit bonus(+2 if 2+ hits)
//   Pitching (per appearance): W(3) + SV(2) + IP(1) + SO(1) + ER(-1.5)
//   Recency: games in last 7 days count 1.5x
//   Threshold: min 2 games with stats for "confirmed" status; 1 game = "emerging"
//   PIS = weighted total / games with data

function computePIS(playerStats) {
    const results = [];
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    function scoreGame(game) {
        let pts = 0;
        const h = game.hitting;
        const p = game.pitching;

        if (h) {
            const hits = h.h || 0;
            pts += hits * 1;                              // hits
            pts += (h['2b'] || 0) * 1;                    // 2B bonus
            pts += (h['3b'] || 0) * 1;                    // 3B bonus
            pts += (h.hr || 0) * 2;                       // HR bonus
            pts += (h.rbi || 0) * 1.5;                    // RBI
            pts += (h.r || 0) * 1;                        // runs scored
            pts += (h.bb || 0) * 0.5;                     // walks
            if (hits >= 2) pts += 2;                      // multi-hit bonus
        }

        if (p) {
            pts += (p.w || 0) * 3;                        // win
            pts += (p.sv || 0) * 2;                       // save
            pts += (p.ip || 0) * 1;                       // innings pitched
            pts += (p.so || 0) * 1;                       // strikeouts
            pts -= (p.er || 0) * 1.5;                     // earned runs against
        }

        return pts;
    }

    function buildGameLine(game) {
        const parts = [];
        const h = game.hitting;
        const p = game.pitching;
        if (h && (h.h > 0 || h.bb > 0 || h.rbi > 0 || h.r > 0)) {
            let line = '';
            if (h.ab > 0) line += `${h.h}-${h.ab}`;
            else if (h.h > 0) line += `${h.h}H`;
            const extras = [];
            if (h['2b'] > 0) extras.push(`${h['2b']} 2B`);
            if (h['3b'] > 0) extras.push(`${h['3b']} 3B`);
            if (h.hr > 0) extras.push(`${h.hr} HR`);
            if (h.rbi > 0) extras.push(`${h.rbi} RBI`);
            if (h.r > 0) extras.push(`${h.r}R`);
            if (h.bb > 0) extras.push(`${h.bb} BB`);
            if (extras.length > 0) line += `, ${extras.join(', ')}`;
            parts.push(line);
        }
        if (p && p.ip > 0) {
            let line = `${p.ip}IP`;
            const pExtras = [];
            if (p.so > 0) pExtras.push(`${p.so}K`);
            if (p.er > 0) pExtras.push(`${p.er}ER`);
            else pExtras.push('0ER');
            if (p.w) pExtras.push('W');
            if (p.sv) pExtras.push('SV');
            line += `, ${pExtras.join(', ')}`;
            parts.push(line);
        }
        if (parts.length > 0) {
            const d = new Date(game.date + 'T12:00:00');
            return { date: `${formatShortMonth(d)} ${d.getDate()}`, opp: game.opp, line: parts.join(' | ') };
        }
        return null;
    }

    function processPool(pool, poolLabel) {
        for (const [name, data] of Object.entries(pool)) {
            const games = data.games || [];
            const tags = data.tags || [];

            let totalWeighted = 0;
            let gamesWithStats = 0;
            const gameLines = [];

            for (const game of games) {
                const hasHitting = game.hitting && (game.hitting.h > 0 || game.hitting.bb > 0 || game.hitting.r > 0 || game.hitting.rbi > 0);
                const hasPitching = game.pitching && (game.pitching.ip > 0 || game.pitching.w > 0 || game.pitching.sv > 0);
                if (!hasHitting && !hasPitching) {
                    // No scoreable stats, but still build display line if there's a save
                    if (game.pitching && game.pitching.sv > 0) {
                        const gl = buildGameLine(game);
                        if (gl) gameLines.push(gl);
                    }
                    continue;
                }

                gamesWithStats++;
                const gamePts = scoreGame(game);
                totalWeighted += gamePts;

                const gl = buildGameLine(game);
                if (gl) gameLines.push(gl);
            }

            const pis = gamesWithStats > 0 ? totalWeighted / gamesWithStats : 0;
            const tier = gamesWithStats >= 3 ? 'confirmed' : gamesWithStats >= 2 ? 'trending' : gamesWithStats >= 1 ? 'emerging' : 'roster';

            // Include player if they have stats OR tags/notes (roster intel)
            if (gamesWithStats === 0 && tags.length === 0 && !data.note) continue;

            results.push({
                name,
                team: data.team,
                pool: poolLabel,
                pis: Math.round(pis * 10) / 10,
                gamesWithStats,
                tier,
                gameLines,
                tags,
                note: data.note || null
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
    const dfDisplay = dfPlayers.slice(0, 6);

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
        let html = `<div style="background-color: #222; border-radius: 6px; padding: 10px 12px; border-left: 3px solid #2B5DAA;">`;
        // Name row with PIS badge
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
        html += `<strong style="color: #fff; font-size: 13px;">${p.name}</strong>`;
        if (p.pis > 0) {
            html += `<span style="background: ${tierColor}22; color: ${tierColor}; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">PIS ${p.pis}</span>`;
        }
        html += `</div>`;
        // One-line stat summary (latest game)
        if (p.gameLines.length > 0) {
            const latest = p.gameLines[p.gameLines.length - 1];
            html += `<p style="color: #aaa; font-size: 11px; margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">vs ${latest.opp}: ${latest.line}</p>`;
        }
        html += `</div>`;
        return html;
    }

    let sectionHtml = '';

    // DF Section
    sectionHtml += `<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 3px solid #2B5DAA;">`;
    sectionHtml += `<h3 style="margin-top: 0; margin-bottom: 10px; color: #2B5DAA;">Dobbs Ferry Eagles</h3>`;
    if (dfDisplay.length === 0) {
        sectionHtml += `<p style="color: #888; font-size: 13px;">No player stats recorded yet.</p>`;
    } else {
        sectionHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
        for (const p of dfDisplay) {
            sectionHtml += renderDFTile(p);
        }
        sectionHtml += `</div>`;
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

    // --- Visual separator between DF and opponents ---
    sectionHtml += `<div style="border-top: 1px solid #333; margin: 8px 0 15px 0;"></div>`;

    // --- Opponent teams: 3-column grid of compact team cards ---
    const teamOrder = Object.keys(oppByTeam).sort((a, b) => {
        const maxA = Math.max(...oppByTeam[a].map(p => p.pis), 0);
        const maxB = Math.max(...oppByTeam[b].map(p => p.pis), 0);
        if (maxB !== maxA) return maxB - maxA;
        return a.localeCompare(b);
    });

    sectionHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">`;

    for (const team of teamOrder) {
        const players = oppByTeam[team].slice(0, 8);
        sectionHtml += `<div style="background-color: #161616; padding: 10px 12px; border-radius: 5px;">`;
        sectionHtml += `<div style="font-size: 13px; font-weight: 600; color: #b0b0b0; margin-bottom: 6px;">${team}</div>`;
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const tierColor = tierColors[p.tier] || '#555';
            const displayName = p.name.replace(/\s*\(.*?\)\s*$/, '');
            sectionHtml += `<div style="display: flex; align-items: center; flex-wrap: wrap; padding: 2px 0;${i < players.length - 1 ? ' border-bottom: 1px solid #222;' : ''}">`;
            sectionHtml += `<span style="color: #ccc; font-size: 11px; margin-right: 6px;">${displayName}</span>`;
            if (p.tags && p.tags.length > 0) {
                for (const tag of p.tags) {
                    let tagColor = '#888';
                    let tagBg = '#2a2a2a';
                    if (tag.includes('Champ')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
                    else if (tag.includes('Finalist')) { tagColor = '#C0C0C0'; tagBg = '#C0C0C022'; }
                    else if (tag.includes('All-Section') || tag.includes('All-State')) { tagColor = '#888'; tagBg = '#88822'; }
                    else if (tag.includes('Captain')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
                    else if (tag.includes('All-League') || tag.includes('Award')) { tagColor = '#D4A017'; tagBg = '#D4A01722'; }
                    else if (tag.includes('D1')) { tagColor = '#2B5DAA'; tagBg = '#2B5DAA22'; }
                    else if (tag.includes('Returning')) { tagColor = '#8B8B8B'; tagBg = '#8B8B8B22'; }
                    else if (tag.includes('Pitcher') || tag.includes('Senior')) { tagColor = '#7BA3CC'; tagBg = '#7BA3CC22'; }
                    sectionHtml += `<span style="font-size: 9px; color: ${tagColor}; background: ${tagBg}; padding: 1px 4px; border-radius: 2px; margin-right: 3px; white-space: nowrap;">${tag}</span>`;
                }
            }
            if (p.pis > 0) {
                sectionHtml += `<span style="font-size: 9px; color: ${tierColor}; font-weight: 700; margin-left: auto; white-space: nowrap;">PIS ${p.pis}</span>`;
            }
            sectionHtml += `</div>`;
            if (p.gameLines.length > 0) {
                const latest = p.gameLines[p.gameLines.length - 1];
                sectionHtml += `<div style="padding: 0 0 2px 8px;"><span style="color: #888; font-size: 9px;">vs ${latest.opp}: ${latest.line}</span></div>`;
            }
        }
        sectionHtml += `</div>`;
    }

    // Monitoring: untracked teams as small muted cards in the same grid
    const scheduleTeams = [...new Set(varsitySchedule.filter(g => g.type !== 'Scrimmage').map(g => g.opponent))];
    const trackedTeams = new Set(teamOrder);
    trackedTeams.add('Dobbs Ferry');
    const untrackedTeams = scheduleTeams.filter(t => !trackedTeams.has(t));

    for (const team of untrackedTeams) {
        sectionHtml += `<div style="background-color: #161616; padding: 10px 12px; border-radius: 5px;">`;
        sectionHtml += `<div style="font-size: 13px; font-weight: 600; color: #b0b0b0; margin-bottom: 4px;">${team}</div>`;
        sectionHtml += `<span style="color: #888; font-size: 10px;">No intel yet</span>`;
        sectionHtml += `</div>`;
    }

    sectionHtml += `</div>`; // close grid

    return sectionHtml;
}

// Compute PIS and rebuild Players to Watch
const pisData = computePIS(scores.playerStats || {});

const pisExplainer = `<p style="font-size: 12px; color: #888888; margin-bottom: 15px;">Ranked by PIS (Player Impact Score). Hitting: H + XBH bonus + RBI(1.5x) + R + BB(0.5x) + multi-hit(+2). Pitching: W(3) + SV(2) + IP + SO - ER(1.5x). Season to date (no recency weighting). Top 6 Dobbs Ferry players shown.</p>`;

const playersRegex = /(<!-- Players to Watch[\s\S]*?<div class="card">\s*<h2>PLAYERS TO WATCH<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- News))/;
html = html.replace(playersRegex, `$1\n                ${pisExplainer}\n${buildPlayersToWatch(pisData)}\n            </div>\n\n            `);

// JV Players to Watch (top 6 by PIS)
function buildJVPlayersToWatch(pisData) {
    const jvPlayers = pisData.filter(p => p.pool === 'jv').slice(0, 6);
    const jvExplainer = `<p style="font-size: 12px; color: #888888; margin-bottom: 15px;">Ranked by PIS (Player Impact Score). Hitting: H + XBH bonus + RBI(1.5x) + R + BB(0.5x) + multi-hit(+2). Pitching: W(3) + SV(2) + IP + SO - ER(1.5x). Season to date (no recency weighting). Top 6 JV players shown.</p>`;
    if (jvPlayers.length === 0) {
        return `${jvExplainer}<p style="color: #888; font-size: 13px;">No JV player stats recorded yet. Upload GameChanger data to populate.</p>`;
    }
    let html = jvExplainer;
    html += `<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; border-left: 3px solid #2B5DAA;">`;
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
    for (const p of jvPlayers) {
        html += `<div style="background-color: #222; border-radius: 6px; padding: 10px 12px; border-left: 3px solid #2B5DAA;">`;
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
        html += `<strong style="color: #fff; font-size: 13px;">${p.name}</strong>`;
        if (p.pis > 0) {
            html += `<span style="background: #88882; color: #888; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 3px;">PIS ${p.pis}</span>`;
        }
        html += `</div>`;
        if (p.gameLines.length > 0) {
            const latest = p.gameLines[p.gameLines.length - 1];
            html += `<p style="color: #aaa; font-size: 11px; margin: 4px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">vs ${latest.opp}: ${latest.line}</p>`;
        }
        html += `</div>`;
    }
    html += `</div></div>`;
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
        let batting = { pa: 0, ab: 0, h: 0, r: 0, rbi: 0, bb: 0, so: 0, sac: 0, sb: 0, hbp: 0 };
        let pitching = { gp: 0, gs: 0, w: 0, l: 0, sv: 0, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0 };

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
                batting.pa += (h.ab || 0) + (h.bb || 0) + (h.sac || 0) + (h.hbp || 0);
            }
            if (game.pitching) {
                const p = game.pitching;
                if (p.ip > 0 || p.w || p.sv) pitching.gp++;
                if (p.ip > 0) pitching.gs++;
                pitching.w += p.w || 0;
                pitching.l += p.l || 0;
                pitching.sv += p.sv || 0;
                pitching.ip += p.ip || 0;
                pitching.h += p.h || 0;
                pitching.r += p.r || 0;
                pitching.er += p.er || 0;
                pitching.bb += p.bb || 0;
                pitching.so += p.so || 0;
            }
        }

        return { name, batting, pitching };
    });

    // Team stats
    let teamStats = {
        w: 0, l: 0,
        runsFor: 0, runsAgainst: 0,
        hits: 0, ab: 0,
        ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0,
        errors: 0, bbDrawn: 0, pitchingBB: 0,
        batSO: 0, batPA: 0, batHBP: 0,
        games: Object.keys(jvGames).length,
        mercied: 0
    };

    for (const [date, game] of Object.entries(jvGames)) {
        if (game.df <= game.opp) teamStats.l++;
        else teamStats.w++;
        teamStats.runsFor += game.df || 0;
        teamStats.runsAgainst += game.opp || 0;
        teamStats.errors += game.errors || 0;
        if (game.mercy) teamStats.mercied++;
    }

    for (const player of players) {
        teamStats.hits += player.batting.h;
        teamStats.ab += player.batting.ab;
        teamStats.bbDrawn += player.batting.bb || 0;
        teamStats.ip += player.pitching.ip;
        teamStats.h += player.pitching.h;
        teamStats.r += player.pitching.r;
        teamStats.er += player.pitching.er;
        teamStats.bb += player.pitching.bb;
        teamStats.pitchingBB += player.pitching.bb || 0;
        teamStats.so += player.pitching.so;
        teamStats.batSO += player.batting.so || 0;
        teamStats.batPA += player.batting.pa || 0;
        teamStats.batHBP += player.batting.hbp || 0;
    }

    const teamAvg = teamStats.ab > 0 ? fmtAvg(teamStats.hits / teamStats.ab) : '.000';
    const teamERA = teamStats.ip > 0 ? ((teamStats.er * 7) / teamStats.ip).toFixed(2) : '—';
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
        wins: '—', era: '—'
    };

    // AVG = H/AB (min 1 AB)
    if (teamStats.ab > 0) {
        const byAvg = players.filter(p => p.batting.ab >= 1).sort((a, b) => (b.batting.h / b.batting.ab) - (a.batting.h / a.batting.ab));
        if (byAvg.length > 0) {
            const topAvg = (byAvg[0].batting.h / byAvg[0].batting.ab);
            const tied = byAvg.filter(p => Math.abs((p.batting.h / p.batting.ab) - topAvg) < 0.0001);
            leaders.avg = tied.map(p => p.name).join(', ');
        }
    }

    // OBP = (H+BB+HBP)/(AB+BB+HBP+SF), or (H+BB)/(AB+BB) if HBP/SF not tracked
    const byOBP = players.filter(p => (p.batting.ab + p.batting.bb) > 0).sort((a, b) => {
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
    const byOPS = players.filter(p => p.batting.ab > 0).sort((a, b) => {
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

    // WINS = leave blank (no wins yet)
    // leaders.wins stays as '—'

    // ERA = min ERA among pitchers with IP > 0, formula (ER*7)/IP
    const byERA = players.filter(p => p.pitching.ip > 0).sort((a, b) => {
        const eraA = (a.pitching.er * 7) / a.pitching.ip;
        const eraB = (b.pitching.er * 7) / b.pitching.ip;
        return eraA - eraB;
    });
    if (byERA.length > 0) {
        const topERA = (byERA[0].pitching.er * 7) / byERA[0].pitching.ip;
        const tied = byERA.filter(p => {
            const era = (p.pitching.er * 7) / p.pitching.ip;
            return Math.abs(era - topERA) < 0.0001;
        });
        leaders.era = tied.map(p => p.name).join(', ');
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
    const whip = teamStats.ip > 0 ? ((teamStats.pitchingBB + teamStats.h) / teamStats.ip).toFixed(2) : '—';
    const k7 = teamStats.ip > 0 ? ((teamStats.so * 7) / teamStats.ip).toFixed(1) : '—';
    const kbb = teamStats.pitchingBB > 0 ? (teamStats.so / teamStats.pitchingBB).toFixed(1) : (teamStats.so > 0 ? '∞' : '—');
    const raPG = per(teamStats.runsAgainst);
    const bbAllowedPG = per(teamStats.pitchingBB);
    const ePG = per(teamStats.errors);
    const fbPG = per(freeBasesAllowed);
    const runDiffPG = G > 0 ? (runDiff / G).toFixed(1) : '—';
    const runDiffPGStr = (runDiff >= 0 ? '+' : '') + runDiffPG;
    const runDiffColor = runDiff < 0 ? '#c44' : '#2B5DAA';

    const totalInningsPlayedForHeader = Math.round(totalInningsBatted * 10) / 10;
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">';
    html += `<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Team Stats — Through ${G} game${G===1?'':'s'} (${totalInningsPlayedForHeader} inning${totalInningsPlayedForHeader===1?'':'s'} played)</h3>`;
    html += '<div style="font-size: 13px; line-height: 1.9; color: #ddd;">';
    html += `<div><strong style="color:#D4A017; display:inline-block; width:90px;">Record:</strong> ${teamStats.w}-${teamStats.l}</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:90px;">Hitting:</strong> AVG ${teamAvg} &nbsp;|&nbsp; ${rPG} Runs/Game &nbsp;|&nbsp; ${bbPG} Walks/Game &nbsp;|&nbsp; ${kRate} K rate</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:90px;">Pitching:</strong> ERA ${teamERA} &nbsp;|&nbsp; WHIP ${whip} &nbsp;|&nbsp; K/7 ${k7} &nbsp;|&nbsp; K/BB ${kbb} &nbsp;|&nbsp; ${raPG} Runs Allowed/Game &nbsp;|&nbsp; ${bbAllowedPG} Walks Allowed/Game</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:90px;">Defense:</strong> ${ePG} Errors/Game &nbsp;|&nbsp; ${fbPG} Free Bases Allowed/Game</div>`;
    html += `<div><strong style="color:#D4A017; display:inline-block; width:90px;">Run Diff/Game:</strong> <span style="color:${runDiffColor}; font-weight:700;">${runDiffPGStr}</span></div>`;
    html += '</div>';
    // Glossary
    html += '<div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #333; font-size: 11px; color: #999; line-height: 1.6;">';
    html += '<strong style="color:#bbb;">What the stats mean:</strong><br>';
    html += '<strong>Runs/Game:</strong> average runs we score per game.<br>';
    html += '<strong>Walks/Game:</strong> average walks we draw per game.<br>';
    html += '<strong>K rate:</strong> share of our plate appearances that end in a strikeout.<br>';
    html += '<strong>ERA:</strong> earned runs allowed per 7 innings pitched.<br>';
    html += '<strong>WHIP:</strong> Walks + Hits allowed, divided by innings pitched. How many baserunners our pitchers give up each inning. Under 1.30 is good, over 1.50 is trouble.<br>';
    html += '<strong>K/7:</strong> strikeouts per 7 innings pitched.<br>';
    html += '<strong>K/BB:</strong> strikeouts per walk issued. Higher = better command.<br>';
    html += '<strong>Runs Allowed/Game:</strong> average runs the other team scores against us per game.<br>';
    html += '<strong>Walks Allowed/Game:</strong> average walks our pitchers issue per game.<br>';
    html += '<strong>Errors/Game:</strong> average fielding errors per game.<br>';
    html += '<strong>Free Bases Allowed/Game:</strong> walks issued + errors, per game. How often we hand the other team 90 feet for free.<br>';
    html += '<strong>Run Diff/Game:</strong> (runs scored − runs allowed) ÷ games.';
    html += '</div>';
    html += '</div>';

    // Team Leaders
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Team Leaders</h3>';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">';
    html += `<div><strong>AVG:</strong> ${leaders.avg}</div>`;
    html += `<div><strong>OBP:</strong> ${leaders.obp}</div>`;
    html += `<div><strong>OPS:</strong> ${leaders.ops}</div>`;
    html += `<div><strong>HITS:</strong> ${leaders.hits}</div>`;
    html += `<div><strong>RBI:</strong> ${leaders.rbi}</div>`;
    html += `<div><strong>SB:</strong> ${leaders.sb}</div>`;
    html += `<div><strong>WINS:</strong> ${leaders.wins}</div>`;
    html += `<div><strong>ERA:</strong> ${leaders.era}</div>`;
    html += '</div>';
    html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #333; font-size: 11px; color: #999; line-height: 1.6;">';
    html += '<strong>AVG:</strong> batting average (hits ÷ at-bats). &nbsp; ';
    html += '<strong>OBP (On-Base %):</strong> how often a batter reaches base (hits + walks + HBP) ÷ (AB + BB + HBP + sac flies). .350+ is strong. &nbsp; ';
    html += '<strong>OPS:</strong> On-Base % plus Slugging %. Single number combining getting on base and hitting for power. .800+ is excellent at any level.';
    html += '</div></div>';

    // Batting Table
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px; margin-bottom: 15px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Batting</h3>';
    html += '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 1px solid #333;"><th style="text-align: left; padding: 8px;">Player</th><th style="text-align: center; padding: 8px;">PA</th><th style="text-align: center; padding: 8px;">AB</th><th style="text-align: center; padding: 8px;">H</th><th style="text-align: center; padding: 8px;">AVG</th><th style="text-align: center; padding: 8px;">OPS</th><th style="text-align: center; padding: 8px;">R</th><th style="text-align: center; padding: 8px;">RBI</th><th style="text-align: center; padding: 8px;">BB</th><th style="text-align: center; padding: 8px;">SO</th><th style="text-align: center; padding: 8px;">SAC</th><th style="text-align: center; padding: 8px;">SB</th></tr></thead>';
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
        html += `<td style="text-align: center; padding: 8px;">${avg}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${opsStr}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.r}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.rbi}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.bb}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.so}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.sac}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${player.batting.sb}</td></tr>`;
    }
    html += '</tbody></table></div>';

    // Pitching Table
    html += '<div style="background-color: #1a1a1a; padding: 15px; border-radius: 6px;">';
    html += '<h3 style="margin-top: 0; margin-bottom: 12px; color: #D4A017;">Pitching</h3>';
    html += '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
    html += '<thead><tr style="border-bottom: 1px solid #333;"><th style="text-align: left; padding: 8px;">Player</th><th style="text-align: center; padding: 8px;">GP</th><th style="text-align: center; padding: 8px;">GS</th><th style="text-align: center; padding: 8px;">W</th><th style="text-align: center; padding: 8px;">L</th><th style="text-align: center; padding: 8px;">SV</th><th style="text-align: center; padding: 8px;">IP</th><th style="text-align: center; padding: 8px;">H</th><th style="text-align: center; padding: 8px;">ER</th><th style="text-align: center; padding: 8px;">BB</th><th style="text-align: center; padding: 8px;">SO</th><th style="text-align: center; padding: 8px;">ERA</th><th style="text-align: center; padding: 8px;">WHIP</th></tr></thead>';
    html += '<tbody>';
    for (const player of players.filter(p => p.pitching.ip > 0)) {
        const era = ((player.pitching.er * 7) / player.pitching.ip).toFixed(2);
        const whip = (((player.pitching.bb + player.pitching.h) / player.pitching.ip) || 0).toFixed(2);
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
        html += `<td style="text-align: center; padding: 8px;">${era}</td>`;
        html += `<td style="text-align: center; padding: 8px;">${whip}</td></tr>`;
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
