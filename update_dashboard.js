#!/usr/bin/env node
/**
 * Dobbs Ferry Eagles Baseball Dashboard Updater
 *
 * Updates the static HTML dashboard with:
 * - Current date stamps
 * - Next Four Games (Varsity + JV) based on today's date
 * - Quick Stats (Record, Streak, Next Game)
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

// Update Next Game in stats
if (nextVarsityGame) {
    const d = new Date(nextVarsityGame.date + 'T12:00:00');
    const shortMonth = formatShortMonth(d);
    html = html.replace(
        /(<div class="stat-label">Next Game<\/div>\s*<div class="stat-detail">)[^<]*/,
        `$1${shortMonth} ${d.getDate()} vs ${nextVarsityGame.opponent}`
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
// 3. UPDATE NEXT GAME CALLOUT
// ============================================================
if (nextVarsityGame) {
    const nextDate = new Date(nextVarsityGame.date + 'T12:00:00');
    const daysUntil = daysBetween(today, nextDate);
    const dayOfWeek = SHORT_DAYS[nextDate.getDay()];
    const shortMonth = formatShortMonth(nextDate);
    const homeAway = nextVarsityGame.location === 'Home' ? 'vs' : '@';
    const venueName = nextVarsityGame.location === 'Home' ? 'Gould Park (Home)' : `${nextVarsityGame.venue} (Away)`;
    const daysText = daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `in ${daysUntil} days.`;

    const nextGameHtml = `<strong>Next Game:</strong> ${shortMonth} ${nextDate.getDate()} (${dayOfWeek}) ${homeAway} ${nextVarsityGame.opponent}, ${nextVarsityGame.time}, ${venueName}. <span style="color: #EF4444;">${daysText}</span>`;

    html = html.replace(
        /<strong>Next Game:<\/strong>[^<]*<span style="color: #EF4444;">[^<]*<\/span>/,
        nextGameHtml
    );
}

// ============================================================
// 4. UPDATE NEXT FOUR GAMES (VARSITY)
// ============================================================
function buildNextFourVarsity() {
    // Get all non-scrimmage games
    const realGames = varsitySchedule.filter(g => g.type !== 'Scrimmage');

    // Find games: show the most recent completed game (if within last 3 days) + next upcoming
    const completedGames = realGames.filter(g => playedVarsityDates.has(g.date)).sort((a, b) => b.date.localeCompare(a.date));
    const upcomingGames = realGames.filter(g => !playedVarsityDates.has(g.date) && g.date >= todayStr);

    let displayGames = [];

    // Show most recent completed game if within 3 days
    if (completedGames.length > 0) {
        const lastCompleted = completedGames[0];
        const lastDate = new Date(lastCompleted.date + 'T12:00:00');
        const daysAgo = daysBetween(lastDate, today);
        if (daysAgo <= 3) {
            displayGames.push({ ...lastCompleted, completed: true });
        }
    }

    // Fill remaining slots with upcoming games
    for (const g of upcomingGames) {
        if (displayGames.length >= 4) break;
        displayGames.push({ ...g, completed: false });
    }

    // If still not 4, just show upcoming
    while (displayGames.length < 4 && displayGames.length < upcomingGames.length) {
        // already added above
        break;
    }

    let cardsHtml = '';
    let isFirstUpcoming = true;

    for (const g of displayGames) {
        const d = new Date(g.date + 'T12:00:00');
        const monthName = MONTHS[d.getMonth()].toUpperCase();
        const dayName = DAYS[d.getDay()].toUpperCase();
        const homeAway = g.location === 'Home' ? 'vs' : g.location === 'Away' ? 'at' : '@';
        const venueLine = g.location === 'Home' ? `Home (${g.venue || 'Gould Park'})` : `Away (${g.venue})`;

        if (g.completed) {
            const score = scores.varsity[g.date];
            const won = score.df > score.opp;
            const resultText = won ? `W ${score.df}-${score.opp}` : `L ${score.df}-${score.opp}`;
            const resultColor = won ? '#10B981' : '#EF4444';
            const badgeColor = won ? '#10B981' : '#EF4444';

            cardsHtml += `
                    <div class="game-card" style="opacity: 0.6; border-color: ${resultColor};">
                        <div class="game-date">${monthName} ${d.getDate()} | ${dayName}</div>
                        <div class="game-opponent">${homeAway} ${g.opponent}</div>
                        <div class="game-details" style="color: ${resultColor}; font-weight: 700;">${resultText}</div>
                        <div class="game-details">${score.location || venueLine}</div>
                        <span class="game-badge" style="background-color: ${badgeColor};">FINAL</span>
                    </div>`;
        } else {
            let badge = '';
            if (isFirstUpcoming) {
                badge = '<span class="game-badge highlight">NEXT</span>';
                isFirstUpcoming = false;
            }

            cardsHtml += `
                    <div class="game-card">
                        <div class="game-date">${monthName} ${d.getDate()} | ${dayName}</div>
                        <div class="game-opponent">${homeAway} ${g.opponent}</div>
                        <div class="game-details">${g.time}</div>
                        <div class="game-details">${venueLine}</div>
                        ${badge}
                    </div>`;
        }
    }

    return cardsHtml;
}

// Replace the Next Four Games content
const nextFourRegex = /(<!-- Next Four Games -->\s*<div class="card">\s*<h2>Next Four Games<\/h2>\s*<div class="games-grid">)([\s\S]*?)(<\/div>\s*<\/div>)/;
const newNextFour = buildNextFourVarsity();
html = html.replace(nextFourRegex, `$1${newNextFour}\n                $3`);

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

const recentScoresRegex = /(<!-- Conference Scores -->\s*<div class="card">\s*<h2>Recent Scores<\/h2>)([\s\S]*?)(<\/div>\s*(?=\s*<!-- What's Happening))/;
html = html.replace(recentScoresRegex, `$1\n${buildRecentScores()}\n            </div>\n\n            `);

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
        /(<div id="jv"[\s\S]*?<div class="alert-game">)[^<]*/,
        `$1${shortMonth} ${nextJvDate.getDate()} (${dayName}) <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextJvGame.time} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${homeAway} ${nextJvGame.opponent} <span style="color:#555;font-weight:400;margin:0 6px;">&#x2022;</span> ${nextJvGame.location}`
    );
}

// Update JV Quick Stats - Record
html = html.replace(
    /(<!-- JV Quick Stats -->[\s\S]*?<div class="stat-label">Record<\/div>\s*<div class="stat-value">)[^<]*/,
    `$1${jvRecord.record}`
);

// Update JV Next Game in stats
if (nextJvGame) {
    const d = new Date(nextJvGame.date + 'T12:00:00');
    const shortMonth = formatShortMonth(d);
    html = html.replace(
        /(<!-- JV Quick Stats -->[\s\S]*?<div class="stat-label">Next Game<\/div>\s*<div class="stat-detail">)[^<]*/,
        `$1${shortMonth} ${d.getDate()} vs ${nextJvGame.opponent}`
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

const jvNextFourRegex = /(<!-- Next Four JV Games -->\s*<div class="card">\s*<h2>Next Four JV Games<\/h2>\s*<div class="games-grid">)([\s\S]*?)(<\/div>\s*<\/div>)/;
html = html.replace(jvNextFourRegex, `$1${buildNextFourJV()}\n                $3`);

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
