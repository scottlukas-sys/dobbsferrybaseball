const fs = require('fs');
const scores = JSON.parse(fs.readFileSync('scores.json', 'utf8'));
const df = scores.playerStats.df;

// Apr 20 box score from GC screenshots
// Line: BLND 0-0-0-0-0-2-3 = 5R/5H/2E, DBBS 1-1-0-0-0-0-0 = 2R/6H/2E
// 2B: I Foley, J Evan
// TB: I Foley 3, J Evan 2, A Ficarrotta 1, D Dilorenzo-Troy 1, I Hwangbo 1
// SF: D Kollar
// SB: A Ficarrotta 3, B Marron
// CS: I Foley
// E: I Hwangbo, J Evan
// Pitching: Ficarrotta(L) 6.2IP/4H/5R/4ER/3BB/8SO, Molina 0.1IP/1H/0R/0ER/0BB/0SO

const apr20Games = {
    'Jake Evan': {
        hitting: { ab: 4, r: 1, h: 1, "2b": 1, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sb: 0, e: 1 },
        pitching: null
    },
    'DJ Kollar': {
        // 2AB, 0R, 0H, 1RBI, 1BB, 1SO, SF=1 (SF not in hitting obj but affects PA)
        hitting: { ab: 2, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 1, bb: 1, so: 1, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Andrew Zendel': {
        hitting: { ab: 4, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 3, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Anthony Ficarrotta': {
        hitting: { ab: 4, r: 0, h: 1, "2b": 0, "3b": 0, hr: 0, rbi: 1, bb: 0, so: 1, hbp: 0, sb: 3, e: 0 },
        pitching: { ip: 6.2, h: 4, r: 5, er: 4, bb: 3, so: 8, w: 0, sv: 0, hbp: 0, bf: 26, pitches: 94, strikes: 62 }
    },
    'Brendan Marron': {
        hitting: { ab: 2, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 2, so: 2, hbp: 0, sb: 1, e: 0 },
        pitching: null
    },
    'Ian Hwangbo': {
        hitting: { ab: 3, r: 0, h: 1, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 1, so: 2, hbp: 0, sb: 0, e: 1 },
        pitching: null
    },
    'Drew Kimerling': {
        hitting: { ab: 2, r: 0, h: 0, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 1, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Donovan Dilore-Troy': {
        hitting: { ab: 2, r: 1, h: 1, "2b": 0, "3b": 0, hr: 0, rbi: 0, bb: 1, so: 0, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Ian Foley': {
        // 3AB, 0R, 2H, 0RBI, 0BB, 1SO. 2B: I Foley. TB=3 so 1 double + 1 single
        hitting: { ab: 3, r: 0, h: 2, "2b": 1, "3b": 0, hr: 0, rbi: 0, bb: 0, so: 1, hbp: 0, sb: 0, e: 0 },
        pitching: null
    },
    'Brendan Molina': {
        hitting: null,
        pitching: { ip: 0.1, h: 1, r: 0, er: 0, bb: 0, so: 0, w: 0, sv: 0, hbp: 0, bf: 3, pitches: 11, strikes: 7 }
    }
};

for (const [name, gameData] of Object.entries(apr20Games)) {
    if (!df[name]) { console.log('WARNING: player not found:', name); continue; }
    const entry = { date: "2026-04-20", opp: "Blind Brook" };
    if (gameData.hitting) entry.hitting = gameData.hitting;
    if (gameData.pitching) entry.pitching = gameData.pitching;
    df[name].games.push(entry);
    // Sort games by date
    df[name].games.sort((a, b) => a.date.localeCompare(b.date));
}

fs.writeFileSync('scores.json', JSON.stringify(scores, null, 2));
console.log('Apr 20 per-game data added for', Object.keys(apr20Games).length, 'players');

// Verify
for (const [name, data] of Object.entries(df)) {
    const gl = data.games.length;
    const gp = data.seasonStats.gp;
    if (gl !== gp && gl > 0) {
        console.log(name.padEnd(25), '| games:', gl, '/ gp:', gp, gl < gp ? '(STILL MISSING)' : '(per-game > gp, OK)');
    }
}
