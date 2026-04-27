#!/usr/bin/env node
/**
 * verify_sweep.js — Pre-flight gap detector for eagles-baseball-daily
 *
 * Compares the hardcoded schedule in update_dashboard.js against
 * scores.json to find missing game results. Run BEFORE any sweep work.
 *
 * Usage: node verify_sweep.js [scores.json]
 *
 * Exit codes:
 *   0 = no gaps (all past scheduled games have results)
 *   1 = gaps found (missing game results for past dates)
 *   2 = error (file not found, parse error, etc.)
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// LOAD SCHEDULES FROM update_dashboard.js
// ============================================================
function extractSchedules(updaterPath) {
    const src = fs.readFileSync(updaterPath, 'utf8');

    // Extract varsitySchedule and jvSchedule by eval-ing them in a sandbox
    // Strip comments first to avoid parsing commented-out entries
    const cleanSrc = src.replace(/\/\/.*$/gm, '');

    const vMatch = cleanSrc.match(/const varsitySchedule\s*=\s*(\[[\s\S]*?\]);/);
    const jMatch = cleanSrc.match(/const jvSchedule\s*=\s*(\[[\s\S]*?\]);/);

    if (!vMatch || !jMatch) {
        console.error('ERROR: Could not parse schedule arrays from update_dashboard.js');
        process.exit(2);
    }

    // Use Function constructor to safely eval the array literals
    let varsity, jv;
    try {
        varsity = new Function(`return ${vMatch[1]}`)();
        jv = new Function(`return ${jMatch[1]}`)();
    } catch (e) {
        console.error('ERROR: Failed to parse schedule arrays:', e.message);
        process.exit(2);
    }

    return { varsity, jv };
}

// ============================================================
// MAIN
// ============================================================
const scoresPath = process.argv[2] || 'scores.json';
const updaterPath = path.join(path.dirname(scoresPath), 'update_dashboard.js');

if (!fs.existsSync(scoresPath)) {
    console.error(`ERROR: scores.json not found at ${scoresPath}`);
    process.exit(2);
}
if (!fs.existsSync(updaterPath)) {
    console.error(`ERROR: update_dashboard.js not found at ${updaterPath}`);
    process.exit(2);
}

const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
const schedules = extractSchedules(updaterPath);

const today = new Date().toISOString().slice(0, 10);

let gaps = [];
let upcoming = [];
let liveToday = [];
let scoreOnly = [];

console.log('=== DOBBS FERRY BASEBALL — PRE-FLIGHT VERIFICATION ===');
console.log(`Date: ${today}`);
console.log();

// --- VARSITY ---
console.log('--- VARSITY SCHEDULE CHECK ---');
const vScored = scores.varsity || {};
for (const g of schedules.varsity) {
    const loc = g.location === 'Home' ? 'vs' : '@';

    if (g.type === 'Scrimmage') {
        console.log(`  ⏭️  ${g.date} Scrimmage ${loc} ${g.opponent} — skipped`);
        continue;
    }

    if (g.date < today) {
        if (!vScored[g.date]) {
            const msg = `${g.date} V ${loc} ${g.opponent} (${g.type || 'Game'})`;
            console.log(`  ❌ GAP: ${msg} — NO RESULT`);
            gaps.push(msg);
        } else {
            const s = vScored[g.date];
            console.log(`  ✅ ${g.date} ${loc} ${g.opponent}: DF ${s.df}-${s.opp} ${s.df > s.opp ? 'W' : 'L'}`);
        }
    } else if (g.date === today) {
        const msg = `${g.date} V ${loc} ${g.opponent} ${g.type === 'League' ? '(League)' : ''}`;
        console.log(`  🔴 TODAY: ${msg} — check GC for live/final`);
        liveToday.push(msg);
    } else {
        upcoming.push(`${g.date} V ${loc} ${g.opponent}`);
    }
}

// Check for results not in schedule
for (const date of Object.keys(vScored).sort()) {
    const inSchedule = schedules.varsity.some(g => g.date === date);
    if (!inSchedule) {
        console.log(`  ⚠️  ${date} DF ${vScored[date].df}-${vScored[date].opp} vs ${vScored[date].opponent} — IN scores.json BUT NOT IN SCHEDULE`);
    }
}

console.log();

// --- JV ---
console.log('--- JV SCHEDULE CHECK ---');
const jScored = scores.jv || {};
for (const g of schedules.jv) {
    const loc = g.location === 'Home' ? 'vs' : '@';

    if (g.date < today) {
        if (!jScored[g.date]) {
            const msg = `${g.date} JV ${loc} ${g.opponent}`;
            console.log(`  ❌ GAP: ${msg} — NO RESULT`);
            gaps.push(msg);
        } else {
            const s = jScored[g.date];
            console.log(`  ✅ ${g.date} ${loc} ${g.opponent}: DF ${s.df}-${s.opp} ${s.df > s.opp ? 'W' : 'L'}`);
        }
    } else if (g.date === today) {
        const msg = `${g.date} JV ${loc} ${g.opponent}`;
        console.log(`  🔴 TODAY: ${msg} — check GC for live/final`);
        liveToday.push(msg);
    } else {
        upcoming.push(`${g.date} JV ${loc} ${g.opponent}`);
    }
}

for (const date of Object.keys(jScored).sort()) {
    const inSchedule = schedules.jv.some(g => g.date === date);
    if (!inSchedule) {
        console.log(`  ⚠️  ${date} DF ${jScored[date].df}-${jScored[date].opp} vs ${jScored[date].opponent} — IN scores.json BUT NOT IN SCHEDULE`);
    }
}

console.log();

// --- BOX SCORE COMPLETENESS ---
console.log('--- BOX SCORE COMPLETENESS ---');
const playerStats = scores.playerStats || {};
for (const pool of ['varsity', 'jv']) {
    const poolStats = playerStats[pool] || {};
    const poolScores = scores[pool] || {};
    const gameDates = Object.keys(poolScores).sort();

    for (const date of gameDates) {
        let hasBoxScore = false;
        for (const [name, pdata] of Object.entries(poolStats)) {
            if (pdata.games && pdata.games.some(g => g.date === date)) {
                hasBoxScore = true;
                break;
            }
        }
        if (!hasBoxScore) {
            const opp = poolScores[date].opponent;
            console.log(`  📊 ${date} ${pool} vs ${opp}: SCORE ONLY — needs box score from GC`);
            scoreOnly.push(`${date} ${pool} vs ${opp}`);
        }
    }
}

console.log();

// --- SUMMARY ---
console.log('=== SUMMARY ===');
if (gaps.length === 0) {
    console.log('✅ NO GAPS — all past scheduled games have results');
} else {
    console.log(`❌ ${gaps.length} GAP(S) FOUND:`);
    gaps.forEach(g => console.log(`   ${g}`));
}

if (liveToday.length > 0) {
    console.log(`🔴 ${liveToday.length} GAME(S) TODAY:`);
    liveToday.forEach(g => console.log(`   ${g}`));
}

if (scoreOnly.length > 0) {
    console.log(`📊 ${scoreOnly.length} game(s) missing box scores`);
}

if (upcoming.length > 0) {
    console.log(`📅 Next ${Math.min(3, upcoming.length)} upcoming:`);
    upcoming.slice(0, 3).forEach(g => console.log(`   ${g}`));
}

console.log();
if (gaps.length > 0) {
    console.log('EXIT 1 — Gaps must be resolved before sweep can proceed.');
    process.exit(1);
} else {
    console.log('EXIT 0 — Clear to proceed.');
    process.exit(0);
}
