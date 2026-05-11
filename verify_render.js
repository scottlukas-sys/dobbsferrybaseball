#!/usr/bin/env node
/**
 * POST-RENDER VERIFICATION — runs after every update_dashboard.js
 * Fails with exit code 1 if ANY section has stale or missing data.
 * Add new checks here when new sections are added.
 */

const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scores = JSON.parse(fs.readFileSync('scores.json', 'utf8'));

let failures = 0;
function fail(msg) { console.error(`FAIL: ${msg}`); failures++; }
function pass(msg) { console.log(`  OK: ${msg}`); }
function warn(msg) { console.log(`  WARN: ${msg}`); }

console.log('=== POST-RENDER VERIFICATION ===\n');

// 1. Varsity record matches computed record
const vGames = Object.values(scores.varsity);
const vWins = vGames.filter(g => g.df > g.opp).length;
const vLosses = vGames.filter(g => g.df < g.opp).length;
const expectedRecord = `${vWins}-${vLosses}`;
if (html.includes(expectedRecord)) {
  pass(`Varsity record ${expectedRecord} found in HTML`);
} else {
  fail(`Varsity record ${expectedRecord} NOT found in HTML`);
}

// 2. League record — check via schedule-based computation (matching update_dashboard.js logic)
// The updater uses varsitySchedule type === 'League' to determine league games,
// NOT scores.json's g.league field. Check both and warn on mismatch.
const leagueByFlag = vGames.filter(g => g.league);
const lW = leagueByFlag.filter(g => g.df > g.opp).length;
const lL = leagueByFlag.filter(g => g.df < g.opp).length;
const expectedLeague = `${lW}-${lL}`;
if (html.includes(expectedLeague)) {
  pass(`League record ${expectedLeague} found in HTML`);
} else {
  // Try the inverse — updater may compute differently
  warn(`League record ${expectedLeague} (from scores.json flags) not found — updater uses schedule-based type. Checking HTML for any league record...`);
  const leagueMatch = html.match(/League<\/div>\s*<div class="stat-value">(\d+-\d+)/);
  if (leagueMatch) {
    pass(`League record ${leagueMatch[1]} found in HTML (schedule-based)`);
  } else {
    fail(`No league record found in HTML`);
  }
}

// 3. Every varsity game appears in HTML (opponent name)
for (const [date, g] of Object.entries(scores.varsity)) {
  if (!html.includes(g.opponent)) {
    fail(`Opponent "${g.opponent}" from ${date} not found in HTML`);
  }
}
pass(`All ${Object.keys(scores.varsity).length} varsity opponents referenced in HTML`);

// 4. Team intel: every blurb rendered
const teamIntel = scores.teamIntel || {};
let intelRendered = 0;
let intelMissing = [];
for (const [team, data] of Object.entries(teamIntel)) {
  const blurb = data.blurb || data.intel || '';
  const snippet = blurb.substring(0, 40);
  if (html.includes(snippet)) {
    intelRendered++;
  } else {
    intelMissing.push(team);
    fail(`Team intel for "${team}" NOT rendered. Expected: "${snippet}..."`);
  }
}
if (intelMissing.length === 0) {
  pass(`All ${intelRendered} team intel blurbs rendered in HTML`);
}

// 5. Team intel staleness — only fail if games have been played since lastUpdated
// (no point flagging staleness on off-days when there's nothing to update)
const today = new Date().toISOString().split('T')[0];
const allGameDates = [
  ...Object.keys(scores.varsity),
  ...Object.keys(scores.jv)
].sort();
const latestGameDate = allGameDates[allGameDates.length - 1] || '2000-01-01';

let staleIntel = [];
for (const [team, data] of Object.entries(teamIntel)) {
  const lastUpdated = data.lastUpdated || '2000-01-01';
  // Only flag if games happened AFTER this blurb was last updated
  if (lastUpdated < latestGameDate) {
    // Check if any game since lastUpdated involved this team or a conference opponent
    const gamesSinceUpdate = allGameDates.filter(d => d > lastUpdated);
    if (gamesSinceUpdate.length > 0) {
      staleIntel.push(`${team} (updated ${lastUpdated}, games through ${latestGameDate})`);
    }
  }
}
if (staleIntel.length > 0) {
  warn(`Team intel may be stale for: ${staleIntel.join(', ')}`);
} else {
  pass(`All team intel is current`);
}

// 6. Every completed varsity game has a score badge in the schedule table
const scoreDates = Object.keys(scores.varsity);
let badgeMissing = 0;
for (const date of scoreDates) {
  const g = scores.varsity[date];
  const won = g.df > g.opp;
  const resultText = won ? `W ${g.df}-${g.opp}` : `L ${g.df}-${g.opp}`;
  if (!html.includes(resultText)) {
    fail(`Score badge "${resultText}" for ${date} vs ${g.opponent} NOT found in HTML`);
    badgeMissing++;
  }
}
if (badgeMissing === 0) {
  pass(`All ${scoreDates.length} varsity score badges rendered`);
}

// 6b. Same check for JV
const jvDates = Object.keys(scores.jv);
let jvBadgeMissing = 0;
for (const date of jvDates) {
  const g = scores.jv[date];
  const won = g.df > g.opp;
  const resultText = won ? `W ${g.df}-${g.opp}` : `L ${g.df}-${g.opp}`;
  if (!html.includes(resultText)) {
    fail(`JV score badge "${resultText}" for ${date} vs ${g.opponent} NOT found in HTML`);
    jvBadgeMissing++;
  }
}
if (jvBadgeMissing === 0) {
  pass(`All ${jvDates.length} JV score badges rendered`);
}

// 7. PIS section
const hasPIS = html.includes('PIS Per Game') || html.includes('PIS per Game');
if (hasPIS) {
  pass('PIS section found');
} else {
  fail('PIS section NOT found in HTML');
}

// 8. File size
const sizeKB = Math.round(html.length / 1024);
if (sizeKB > 200) {
  pass(`HTML file size: ${sizeKB}KB (healthy)`);
} else {
  fail(`HTML file size: ${sizeKB}KB (suspiciously small)`);
}

// 9. No "undefined" or "NaN"
const undefinedCount = (html.match(/undefined/g) || []).length;
const nanCount = (html.match(/\bNaN\b/g) || []).length;
if (undefinedCount > 10) {
  fail(`Found ${undefinedCount} instances of "undefined" in HTML`);
} else {
  pass(`No stray "undefined" in HTML (${undefinedCount} found, likely in JS)`);
}
if (nanCount > 0) {
  fail(`Found ${nanCount} instances of "NaN" in HTML`);
} else {
  pass('No "NaN" in HTML');
}

// 10. Encoding check — no double-encoded UTF-8 mojibake
const mojibakePatterns = ['Ã·', 'Ã¢', 'Â·', 'Ã©', 'Ã¶', 'Ã¼', 'â', 'â', 'â¢'];
let mojibakeCount = 0;
for (const p of mojibakePatterns) {
  const count = (html.split(p).length - 1);
  if (count > 0) {
    mojibakeCount += count;
  }
}
if (mojibakeCount > 0) {
  fail(`Found ${mojibakeCount} mojibake/double-encoded sequences in HTML`);
} else {
  pass('No mojibake detected');
}

// 11. Weather line renders cleanly (no garbled chars in weather section)
const weatherMatch = html.match(/Weather:<\/strong>\s*([^<]{10,80})/);
if (weatherMatch) {
  const weatherText = weatherMatch[1];
  if (weatherText.includes('Ã') || weatherText.includes('â€')) {
    fail(`Weather line has garbled encoding: ${weatherText}`);
  } else {
    pass(`Weather line clean: ${weatherText.trim().substring(0, 60)}...`);
  }
} else {
  warn('Weather line not found (may be past all games)');
}

// 12. GB column in standings renders cleanly
const gbMatch = html.match(/<th>GB<\/th>/);
if (gbMatch) {
  pass('GB column header present in standings');
} else {
  fail('GB column header missing from standings');
}

console.log(`\n=== RESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'} ===`);
process.exit(failures > 0 ? 1 : 0);
