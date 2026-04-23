const fs = require('fs');
const scores = JSON.parse(fs.readFileSync('scores.json', 'utf8'));

// ============================================================
// 1. Add Apr 22 Varsity game score
// ============================================================
scores.varsity['2026-04-22'] = {
    opponent: "Blind Brook",
    df: 1,
    opp: 3,
    location: "Away",
    source: "GameChanger",
    league: true,
    errors: 1,
    innings: 7
};

// Also add to divisionB
scores.divisionB.push({
    date: "2026-04-22",
    home: "Blind Brook",
    away: "Dobbs Ferry",
    homeRuns: 3,
    awayRuns: 1,
    source: "GameChanger"
});

// ============================================================
// 2. Add per-game data for Apr 22
// ============================================================
const df = scores.playerStats.df;

// Per-game hitting data from box score
const apr22Games = {
    'Jake Evan': {
        hitting: { ab: 4, r: 0, h: 2, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'DJ Kollar': {
        hitting: { ab: 3, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Andrew Zendel': {
        hitting: { ab: 2, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 1, sb: 0, e: 0 },
        pitching: null
    },
    'Anthony Ficarrotta': {
        hitting: { ab: 3, r: 0, h: 2, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 1, hbp: 0, sb: 0, e: 1 },
        pitching: null
    },
    'Brendan Marron': {
        hitting: { ab: 3, r: 0, h: 1, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sb: 0, e: 0 },
        pitching: { ip: 1.0, h: 0, r: 0, er: 0, bb: 0, so: 1, w: 0, sv: 0, hbp: 0, bf: 3, pitches: 8, strikes: 7 }
    },
    'Ian Hwangbo': {
        hitting: { ab: 3, r: 1, h: 1, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sb: 0, e: 0 },
        pitching: { ip: 3.0, h: 2, r: 3, er: 3, bb: 4, so: 1, w: 0, sv: 0, hbp: 1, bf: 14, pitches: 51, strikes: 24 }
    },
    'Drew Kimerling': {
        hitting: { ab: 3, r: 0, h: 2, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 1, hbp: 0, sb: 0, e: 0 },
        pitching: { ip: 2.0, h: 2, r: 0, er: 0, bb: 1, so: 2, w: 0, sv: 0, hbp: 2, bf: 11, pitches: 38, strikes: 17 }
    },
    'Donovan Dilore-Troy': {
        hitting: { ab: 3, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Ian Foley': {
        hitting: { ab: 3, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 1, bb: 0, so: 1, hbp: 0, sb: 0, e: 0 },
        pitching: null
    }
};

for (const [name, gameData] of Object.entries(apr22Games)) {
    if (!df[name]) { console.log('WARNING: player not found:', name); continue; }
    const entry = { date: "2026-04-22", opp: "Blind Brook" };
    if (gameData.hitting) entry.hitting = gameData.hitting;
    if (gameData.pitching) entry.pitching = gameData.pitching;
    df[name].games.push(entry);
}

// ============================================================
// 3. Update ALL seasonStats from GC season batting totals (10 GP)
// ============================================================
const seasonBatting = {
    'Rommel Eusebio': { gp: 3, pa: 5, ab: 3, avg: ".667", obp: ".800", ops: "1.800", slg: "1.000", h: 2, "1b": 1, "2b": 1, "3b": 0, hr: 0, rbi: 2, r: 2, bb: 1, so: 1, kl: 1, hbp: 1, sac: 0, sf: 0, sb: 0, cs: 0, roe: 0, fc: 0 },
    'Justin Costa': { gp: 4, pa: 7, ab: 5, avg: ".400", obp: ".500", ops: "1.100", slg: ".600", h: 2, "1b": 1, "2b": 1, "3b": 0, hr: 0, rbi: 1, r: 1, bb: 1, so: 2, kl: 0, hbp: 0, sac: 1, sf: 0, sb: 3, cs: 0, roe: 0, fc: 0 },
    'Jake Evan': { gp: 10, pa: 39, ab: 32, avg: ".375", obp: ".487", ops: ".893", slg: ".406", h: 12, "1b": 11, "2b": 1, "3b": 0, hr: 0, rbi: 3, r: 7, bb: 6, so: 4, kl: 1, hbp: 1, sac: 0, sf: 0, sb: 8, cs: 0, roe: 0, fc: 0 },
    'Anthony Ficarrotta': { gp: 10, pa: 37, ab: 35, avg: ".371", obp: ".405", ops: ".920", slg: ".514", h: 13, "1b": 10, "2b": 2, "3b": 0, hr: 1, rbi: 6, r: 11, bb: 2, so: 7, kl: 3, hbp: 0, sac: 0, sf: 0, sb: 11, cs: 1, roe: 1, fc: 3 },
    'Andrew Zendel': { gp: 10, pa: 36, ab: 33, avg: ".364", obp: ".417", ops: ".841", slg: ".424", h: 12, "1b": 10, "2b": 2, "3b": 0, hr: 0, rbi: 7, r: 6, bb: 1, so: 6, kl: 0, hbp: 2, sac: 0, sf: 0, sb: 1, cs: 0, roe: 3, fc: 1 },
    'Donovan Dilore-Troy': { gp: 10, pa: 28, ab: 23, avg: ".348", obp: ".464", ops: ".856", slg: ".391", h: 8, "1b": 7, "2b": 1, "3b": 0, hr: 0, rbi: 2, r: 5, bb: 3, so: 5, kl: 3, hbp: 2, sac: 0, sf: 0, sb: 4, cs: 0, roe: 1, fc: 2 },
    'Ian Hwangbo': { gp: 10, pa: 33, ab: 27, avg: ".333", obp: ".455", ops: ".862", slg: ".407", h: 9, "1b": 7, "2b": 2, "3b": 0, hr: 0, rbi: 4, r: 6, bb: 6, so: 7, kl: 5, hbp: 0, sac: 0, sf: 0, sb: 1, cs: 1, roe: 1, fc: 2 },
    'Ian Foley': { gp: 2, pa: 6, ab: 6, avg: ".333", obp: ".333", ops: ".833", slg: ".500", h: 2, "1b": 1, "2b": 1, "3b": 0, hr: 0, rbi: 1, r: 0, bb: 0, so: 2, kl: 1, hbp: 0, sac: 0, sf: 0, sb: 0, cs: 1, roe: 0, fc: 1 },
    'Drew Kimerling': { gp: 8, pa: 28, ab: 25, avg: ".240", obp: ".296", ops: ".536", slg: ".240", h: 6, "1b": 6, "2b": 0, "3b": 0, hr: 0, rbi: 4, r: 2, bb: 1, so: 5, kl: 1, hbp: 1, sac: 1, sf: 0, sb: 3, cs: 1, roe: 2, fc: 1 },
    'Brendan Marron': { gp: 10, pa: 37, ab: 30, avg: ".233", obp: ".378", ops: ".645", slg: ".267", h: 7, "1b": 6, "2b": 1, "3b": 0, hr: 0, rbi: 4, r: 5, bb: 5, so: 11, kl: 8, hbp: 2, sac: 0, sf: 0, sb: 3, cs: 2, roe: 1, fc: 0 },
    'DJ Kollar': { gp: 10, pa: 38, ab: 28, avg: ".214", obp: ".395", ops: ".752", slg: ".357", h: 6, "1b": 2, "2b": 4, "3b": 0, hr: 0, rbi: 8, r: 6, bb: 7, so: 5, kl: 2, hbp: 2, sac: 0, sf: 1, sb: 4, cs: 0, roe: 1, fc: 2 },
    'Rodger Frisch': { gp: 5, pa: 12, ab: 9, avg: ".000", obp: ".167", ops: ".167", slg: ".000", h: 0, "1b": 0, "2b": 0, "3b": 0, hr: 0, rbi: 2, r: 2, bb: 2, so: 4, kl: 3, hbp: 0, sac: 0, sf: 1, sb: 0, cs: 0, roe: 0, fc: 0 },
    'Brendan Molina': { gp: 3, pa: 4, ab: 4, avg: ".000", obp: ".000", ops: ".000", slg: ".000", h: 0, "1b": 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 2, kl: 0, hbp: 0, sac: 0, sf: 0, sb: 0, cs: 0, roe: 0, fc: 0 },
    'Harrison Brewer': { gp: 5, pa: 8, ab: 6, avg: ".000", obp: ".250", ops: ".250", slg: ".000", h: 0, "1b": 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, r: 2, bb: 0, so: 4, kl: 0, hbp: 2, sac: 0, sf: 0, sb: 2, cs: 0, roe: 0, fc: 0 },
    'Ethan Gallagher': { gp: 1, pa: 1, ab: 1, avg: ".000", obp: ".000", ops: ".000", slg: ".000", h: 0, "1b": 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 1, kl: 1, hbp: 0, sac: 0, sf: 0, sb: 0, cs: 0, roe: 0, fc: 0 }
};

for (const [name, stats] of Object.entries(seasonBatting)) {
    if (!df[name]) { console.log('WARNING: player not found:', name); continue; }
    df[name].seasonStats = { ...stats, source: "GameChanger", asOf: "2026-04-22" };
}

// ============================================================
// 4. Update ALL seasonPitching from GC season pitching totals
// ============================================================
const seasonPitching = {
    'Anthony Ficarrotta': { ip: 19.0, gp: 5, gs: 4, bf: 84, pitches: 309, w: 2, l: 2, sv: 0, h: 13, r: 12, er: 7, bb: 5, so: 29, kl: 9, hbp: 3, era: "2.579", whip: ".947" },
    'Andrew Zendel': { ip: 14.1, gp: 5, gs: 2, bf: 70, pitches: 244, w: 2, l: 0, sv: 0, h: 9, r: 5, er: 3, bb: 15, so: 16, kl: 6, hbp: 2, era: "1.465", whip: "1.674" },
    'Brendan Molina': { ip: 10.2, gp: 6, gs: 1, bf: 57, pitches: 204, w: 1, l: 1, sv: 0, h: 14, r: 12, er: 8, bb: 5, so: 9, kl: 2, hbp: 4, era: "5.250", whip: "1.781" },
    'Ian Hwangbo': { ip: 8.0, gp: 3, gs: 1, bf: 40, pitches: 139, w: 0, l: 1, sv: 0, h: 5, r: 8, er: 5, bb: 11, so: 6, kl: 2, hbp: 1, era: "4.375", whip: "2.000" },
    'Drew Kimerling': { ip: 4.2, gp: 3, gs: 0, bf: 26, pitches: 79, w: 0, l: 0, sv: 1, h: 6, r: 3, er: 2, bb: 1, so: 5, kl: 1, hbp: 5, era: "3.000", whip: "1.500" },
    'Ian Foley': { ip: 4.2, gp: 3, gs: 2, bf: 25, pitches: 113, w: 0, l: 1, sv: 0, h: 4, r: 4, er: 3, bb: 6, so: 8, kl: 4, hbp: 0, era: "4.500", whip: "2.143" },
    'Ethan Gallagher': { ip: 1.2, gp: 1, gs: 0, bf: 9, pitches: 44, w: 0, l: 0, sv: 0, h: 2, r: 1, er: 1, bb: 2, so: 1, kl: 0, hbp: 1, era: "4.200", whip: "2.400" },
    'DJ Kollar': { ip: 1.2, gp: 1, gs: 0, bf: 10, pitches: 37, w: 0, l: 0, sv: 0, h: 2, r: 4, er: 0, bb: 1, so: 3, kl: 2, hbp: 0, era: ".000", whip: "1.800" },
    'Brendan Marron': { ip: 1.0, gp: 1, gs: 0, bf: 3, pitches: 8, w: 0, l: 0, sv: 0, h: 0, r: 0, er: 0, bb: 0, so: 1, kl: 1, hbp: 0, era: ".000", whip: ".000" },
    'Rodger Frisch': { ip: 0.1, gp: 1, gs: 0, bf: 2, pitches: 7, w: 0, l: 0, sv: 0, h: 0, r: 0, er: 0, bb: 1, so: 0, kl: 0, hbp: 0, era: ".000", whip: "3.000" },
    'Justin Costa': { ip: 0.1, gp: 1, gs: 0, bf: 8, pitches: 36, w: 0, l: 0, sv: 0, h: 4, r: 6, er: 5, bb: 1, so: 0, kl: 0, hbp: 1, era: "105.000", whip: "15.000" }
};

for (const [name, stats] of Object.entries(seasonPitching)) {
    if (!df[name]) { console.log('WARNING: pitcher not found:', name); continue; }
    df[name].seasonPitching = { ...stats, source: "GameChanger", asOf: "2026-04-22" };
}

// ============================================================
// 5. Update ALL fielding from GC season fielding totals
// ============================================================
const fielding = {
    'Rodger Frisch': { tc: 12, a: 2, po: 10, fpct: 1.000, e: 0, dp: 2 },
    'DJ Kollar': { tc: 46, a: 1, po: 44, fpct: 0.978, e: 1, dp: 0 },
    'Andrew Zendel': { tc: 28, a: 5, po: 22, fpct: 0.964, e: 1, dp: 2 },
    'Anthony Ficarrotta': { tc: 28, a: 4, po: 23, fpct: 0.964, e: 1, dp: 0 },
    'Brendan Marron': { tc: 54, a: 7, po: 44, fpct: 0.944, e: 3, dp: 0 },
    'Justin Costa': { tc: 18, a: 3, po: 13, fpct: 0.889, e: 2, dp: 1 },
    'Donovan Dilore-Troy': { tc: 26, a: 12, po: 11, fpct: 0.885, e: 3, dp: 2 },
    'Ian Hwangbo': { tc: 21, a: 11, po: 5, fpct: 0.762, e: 5, dp: 0 },
    'Jake Evan': { tc: 27, a: 10, po: 10, fpct: 0.741, e: 7, dp: 1 },
    'Drew Kimerling': { tc: 7, a: 0, po: 5, fpct: 0.714, e: 2, dp: 0 },
    'Harrison Brewer': { tc: 7, a: 1, po: 4, fpct: 0.714, e: 2, dp: 0 },
    'Brendan Molina': { tc: 3, a: 1, po: 1, fpct: 0.667, e: 1, dp: 0 },
    'Ethan Gallagher': { tc: 0, a: 0, po: 0, fpct: 0.000, e: 0, dp: 0 },
    'Ian Foley': { tc: 1, a: 0, po: 0, fpct: 0.000, e: 1, dp: 0 },
    'Rommel Eusebio': { tc: 0, a: 0, po: 0, fpct: 0.000, e: 0, dp: 0 }
};

for (const [name, stats] of Object.entries(fielding)) {
    if (!df[name]) { console.log('WARNING: fielding player not found:', name); continue; }
    df[name].fielding = stats;
}

// ============================================================
// 6. Write scores.json
// ============================================================
fs.writeFileSync('scores.json', JSON.stringify(scores, null, 2));
console.log('scores.json updated successfully');
console.log('Varsity scores now:', Object.keys(scores.varsity).length, 'games');
console.log('Apr 22 game added: DF 1, Blind Brook 3 (L)');

// Verify game counts
for (const [name, data] of Object.entries(df)) {
    console.log(name.padEnd(25), '| games:', data.games.length, '| gp:', data.seasonStats.gp);
}
