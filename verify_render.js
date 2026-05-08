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

// 2. League record
const leagueGames = vGames.filter(g => g.league);
const lW = leagueGames.filter(g => g.df > g.opp).length;
const lL = leagueGames.filter(g => g.df < g.opp).length;
const expectedLeague = `${lW}-${lL}`;
// League record might appear in different formats
if (html.includes(expectedLeague)) {
  pass(`League record ${expectedLeague} found in HTML`);
} else {
  fail(`League record ${expectedLeague} NOT found in HTML`);
}

// 3. Every varsity game appears in HTML (score or opponent name + date)
for (const [date, g] of Object.entries(scores.varsity)) {
  const d = new Date(date + 'T12:00:00');
  const opponent = g.opponent;
  if (!html.includes(opponent)) {
    fail(`Opponent "${opponent}" from ${date} not found in HTML`);
  }
}
pass(`All ${Object.keys(scores.varsity).length} varsity opponents referenced in HTML`);

// 4. Team intel: every blurb from scores.json appears in rendered HTML
const teamIntel = scores.teamIntel || {};
let intelRendered = 0;
let intelMissing = [];
for (const [team, data] of Object.entries(teamIntel)) {
  const blurb = data.blurb || data.intel || '';
  // Check first 40 chars of blurb appear in HTML (enough to confirm it rendered)
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

// 5. Check that team intel dates are today or yesterday (not stale)
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
let staleIntel = [];
for (const [team, data] of Object.entries(teamIntel)) {
  if (data.lastUpdated !== today && data.lastUpdated !== yesterday) {
    staleIntel.push(`${team} (${data.lastUpdated})`);
  }
}
if (staleIntel.length > 0) {
  fail(`Stale team intel (>1 day old): ${staleIntel.join(', ')}`);
} else {
  pass(`All team intel updated within last day`);
}

// 6. Most recent game appears in "Scores This Week" or similar
const latestDate = Object.keys(scores.varsity).sort().pop();
const latestGame = scores.varsity[latestDate];
const latestScore = `${latestGame.df}-${latestGame.opp}`;
if (html.includes(latestScore) || html.includes(`${latestGame.df} - ${latestGame.opp}`)) {
  pass(`Latest game score ${latestScore} (${latestDate} vs ${latestGame.opponent}) found`);
} else {
  fail(`Latest game score ${latestScore} (${latestDate} vs ${latestGame.opponent}) NOT found in HTML`);
}

// 7. PIS section exists and has player names
const hasPIS = html.includes('PIS Per Game') || html.includes('PIS per Game');
if (hasPIS) {
  pass('PIS section found');
} else {
  fail('PIS section NOT found in HTML');
}

// 8. File size sanity check (should be >200KB for a full render)
const sizeKB = Math.round(html.length / 1024);
if (sizeKB > 200) {
  pass(`HTML file size: ${sizeKB}KB (healthy)`);
} else {
  fail(`HTML file size: ${sizeKB}KB (suspiciously small — possible partial render)`);
}

// 9. No "undefined" or "NaN" in rendered HTML (common bugs)
const undefinedCount = (html.match(/undefined/g) || []).length;
const nanCount = (html.match(/\bNaN\b/g) || []).length;
if (undefinedCount > 10) {  // allow a couple in JS code
  fail(`Found ${undefinedCount} instances of "undefined" in HTML`);
} else {
  pass(`No stray "undefined" in HTML (${undefinedCount} found, likely in JS)`);
}
if (nanCount > 0) {
  fail(`Found ${nanCount} instances of "NaN" in HTML`);
} else {
  pass('No "NaN" in HTML');
}

console.log(`\n=== RESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'} ===`);
process.exit(failures > 0 ? 1 : 0);
