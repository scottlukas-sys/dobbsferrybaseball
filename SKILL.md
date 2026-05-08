---
name: eagles-baseball-daily
description: Daily update of Dobbs Ferry Eagles Baseball Dashboard — refreshes scores, next games, records, standings, opponent intel, JV opponent scores (Rye Neck, Irvington, Hastings, Sleepy Hollow), and publishes to dobbsferrybaseball.com via GitHub Pages. PIS formula excludes errors (positional bias); errors surfaced in JV Team Leaders.
---

Daily update of Dobbs Ferry Eagles Baseball Dashboard (dobbsferrybaseball.com).

## EXECUTION MODEL: ZERO DISCRETION
Every step in this protocol executes on every run. There is no "nothing to do" shortcut. There is no "no new games found, skipping" exit. Every source gets checked, every section gets refreshed, every step gets logged. If a step cannot be completed (source down, data unavailable, tool error), log the failure explicitly and continue to the next step. A run that skips steps silently is a failed run. A run that finds no new games but refreshes team intel and pushes that update is a successful run.

## Git Clone Fallback
Try locations in this order:
1. `~/dfb` (persistent local clone)
2. `/tmp/dfb_YYYYMMDD/` (dated temp clone — create fresh if needed)
3. If both fail, STOP and report failure. Do not proceed without a working repo.

After obtaining the repo, ALWAYS run `git push --dry-run` before doing any work. If dry-run fails (auth, remote, network), STOP and report. Do not do a full sweep only to fail at push.

## Source Access Fallback Chain
For EVERY source URL in this protocol, use this fallback chain:
1. Chrome MCP (navigate + extract) — preferred
2. web_fetch (direct fetch) — if Chrome MCP is unavailable or fails
3. web_search (search for the data) — last resort

NEVER skip a source because Chrome MCP is unavailable. NEVER report a source as "unreachable" without trying all three methods. If all three fail, log the failure and continue.

## GameChanger WAF Note
GameChanger (web.gc.com) uses AWS WAF bot detection. Chrome MCP and web_fetch will often return only the JS shell with no data. Known workarounds:
- If the user has GC open in their browser and is logged in, Chrome MCP may succeed using their active session cookies
- If the user provides a direct box score URL, Chrome MCP can sometimes load it via their session
- If GC is blocked, flag it in the sweep report as "GC: WAF-blocked" and use secondary sources (DigitalSports, Section 1, MaxPreps) to cross-reference scores
- NEVER fabricate or assume GC data. If you cannot load it, say so.

## Repository
Clone or pull: https://github.com/scottlukas-sys/dobbsferrybaseball.git
Working files: update_dashboard.js, scores.json, index.html, verify_render.js

## GitHub Push Credentials
PAT: [REDACTED — see local skill file]
After cloning, run: `git remote set-url origin https://[REDACTED — see local skill file]@github.com/scottlukas-sys/dobbsferrybaseball.git`
This ensures every scheduled run can push without manual intervention.

## Persistent Source URLs (DO NOT SEARCH FOR THESE — USE DIRECTLY)
- **GC Varsity**: https://web.gc.com/teams/GYDHZe9Qnc3R
- **GC JV**: https://web.gc.com/teams/fwj3Lx91dyA2
- **DFSD Athletic Calendar**: https://www.dfsd.org/departments/athletics/athletic-calendar (use Chrome MCP + JavaScript extraction — calendar is JS-rendered)
- **DF DigitalSports**: https://72456.digitalsports.com
- **Section 1 Athletics (DF)**: https://www.section1ny.org/public/genie/434/school/161/
- **JV Opponent DigitalSports**:
  - Hastings: 47487.digitalsports.com (approximate — verify if first load fails)
  - Irvington: 63518.digitalsports.com
  - Sleepy Hollow: 68463.digitalsports.com
  - Rye Neck: search digitalsports.com for "Rye Neck" JV baseball results
- **GitHub repo**: https://github.com/scottlukas-sys/dobbsferrybaseball.git

## Steps

### Step 0: SCHEDULE-FIRST GAP DETECTION (MANDATORY — DO THIS BEFORE ANYTHING ELSE)
1. **Pull latest** from main branch
2. **Load the DFSD Athletic Calendar** using the Source Access Fallback Chain (Chrome MCP + JavaScript extraction preferred). Extract EVERY baseball event (Varsity and JV) with dates.
3. **Compare DFSD schedule dates against scores.json**. For every scheduled game where the date has PASSED and no result exists in scores.json: flag it as a GAP. This is the single most important step — it catches missed games immediately.
4. **Output the gap report** before proceeding. Format: "GAPS FOUND: [date] [V/JV] vs [opponent] — NO RESULT IN scores.json" or "NO GAPS — all past scheduled games have results."

### Step 1: CHECK GAMECHANGER FIRST (PRIMARY SOURCE FOR SCORES + STATS)
GameChanger is the live scorekeeping app and the source of truth for all scores and box scores.
1. Load GC Varsity page (URL above) using the Source Access Fallback Chain. Extract: all game results, any LIVE games, any games with scores but no W/L (in-progress or recently completed).
2. Load GC JV page (URL above). Same extraction.
3. For any game on GC that is NOT in scores.json: add it.
4. For any game on GC with a different score than scores.json: GC WINS. Correct scores.json.
5. For any LIVE game: flag it in the sweep output. Note the current score. Do NOT add it as a final result.
6. For any completed game that has only a score (no box score data in scores.json): flag it for stats collection.

### Step 2: CROSS-REFERENCE WITH SECONDARY SOURCES
After GC, check these for confirmation and supplemental data:
1. **DF DigitalSports** (72456.digitalsports.com) — official school athletics site
2. **Section 1 Athletics** — section-level schedule/results
3. **MaxPreps** — schedule and stats
4. **@dfeaglesbaseball Instagram** — box score photos, score announcements
If any secondary source has a score that conflicts with GC, note the discrepancy but USE THE GC SCORE.

### Step 3: CHECK JV OPPONENT RESULTS
For tracked schools (Rye Neck, Irvington, Hastings, Sleepy Hollow):
1. Check each school's DigitalSports page for new JV game results
2. Search for "[school] junior varsity baseball" on digitalsports.com for recent results
3. Add any new results to jvOpponentScores in scores.json

### Step 4: UPDATE TEAM INTEL (MANDATORY EVERY RUN)
The "What's Happening Elsewhere" section renders from `scores.teamIntel` in scores.json. This data must be refreshed on every single sweep — stale intel (more than 2 days old) is a sweep failure.

For each team in teamIntel:
1. Search lohud scoreboard, MaxPreps, Section 1, and web search for latest results and records
2. Update the `blurb` with current record, recent results, and relevant notes
3. Update `lastUpdated` to today's date
4. If a source is unreachable, still update from other sources — do not skip

Add `TEAM INTEL UPDATED: [count] entries refreshed to [date]` to the sweep report.

Even when no new games exist, a team intel refresh is a legitimate change. Commit and push it. "No new games" is never an excuse to skip the push.

### Step 5: RUN THE UPDATER
`node update_dashboard.js index.html scores.json`

### Step 6: VERIFY OUTPUT (MANDATORY — AUTOMATED, GATE TO COMMIT)
Run `node verify_render.js index.html scores.json` immediately after the updater. This script checks:
- Varsity and JV records match computed W-L from scores.json
- League record matches league:true games only
- All opponents appear in the rendered HTML
- All 17 teamIntel blurbs are rendered (not missing or truncated)
- Intel freshness (all entries updated within 1 day)
- Latest game score appears in HTML
- PIS section exists and renders
- File size >200KB (catches empty/truncated output)
- No stray `undefined` or `NaN` values in rendered HTML

**If verify_render.js exits non-zero, the sweep STOPS. Do not commit. Do not push. Fix the issue first, re-run update_dashboard.js, re-run verify_render.js, and only proceed when it passes.**

Also spot-check league standings: verify DF's league W-L, RF, and RA match scores.varsity (league:true games only). If numbers look wrong, check for divisionB contamination (see divisionB rules below).

### Step 7: COMMIT AND PUSH
Commit all changes and push to main to deploy via GitHub Pages. Include a descriptive commit message listing what changed (new games, intel refresh, corrections, etc.).

### Step 8: POST-PUSH VERIFICATION
After pushing, verify the site is live and updated. Check that the commit landed on GitHub.

### Step 9: MANDATORY SWEEP REPORT (REQUIRED — SWEEP FAILS WITHOUT THIS)
Every single run MUST produce this report. If this report is not generated, the sweep is a failure regardless of what else happened. No exceptions.

```
SOURCES CHECKED:
- [ ] DFSD Calendar: [checked/unreachable] [method: Chrome/web_fetch/web_search]
- [ ] GC Varsity: [checked/unreachable] [method: Chrome/web_fetch/web_search]
- [ ] GC JV: [checked/unreachable] [method: Chrome/web_fetch/web_search]
- [ ] DF DigitalSports: [checked/unreachable] [method: Chrome/web_fetch/web_search]
- [ ] Section 1: [checked/unreachable] [method: Chrome/web_fetch/web_search]
- [ ] MaxPreps: [checked/unreachable] [method: Chrome/web_fetch/web_search]

SCHEDULE GAPS (past games with no result): [list or NONE]
NEW GAMES ADDED: [list or NONE]
SCORE CORRECTIONS: [list or NONE]
LIVE/IN-PROGRESS GAMES: [list or NONE]
GAMES MISSING BOX SCORES: [list or NONE]
SOURCES UNREACHABLE AFTER FULL FALLBACK CHAIN (requires follow-up): [list or NONE]
JV OPPONENT RESULTS ADDED: [list or NONE]
TEAM INTEL UPDATED: [count] entries refreshed to [date]
VERIFY_RENDER.JS: [PASS/FAIL — details if failed]
GIT PUSH: [success/failed — reason]
```

## ACCURACY RULES (NON-NEGOTIABLE)

### NEVER fabricate, assume, or infer schedule data
This is the single most important rule. If you do not have a verified source confirming a game exists at a specific date/time, you CANNOT:
- Move a game to a new date based on assumption (e.g., "varsity moved so JV probably did too")
- Create a schedule entry that doesn't exist in any source
- Infer a makeup date without confirmation from DFSD calendar, GC, or the coach
- Change a game time without a verified source

If a game was rained out and no makeup is confirmed, leave it as rained out. Do not guess. If the user provides schedule info from the coach, verify against DFSD calendar or GC if possible, but coach info from the user is an acceptable source. Your own inference is NEVER an acceptable source.

### Source unreachable is not permission to skip
If a source cannot be loaded, you MUST: (1) try all three methods in the Source Access Fallback Chain, (2) report it as unreachable in the sweep report with which methods were attempted. NEVER silently skip a source.

### Date verification rule
NEVER enter a game into scores.json at a date from a single source (including the user) without cross-referencing the DFSD calendar or GC schedule. If the user says "we lost to X today," verify what game was actually scheduled today before entering data.

### Score cross-reference rule
Any game with a score from DS or Instagram MUST be verified against GC if a GC entry exists. When sources conflict, GC wins.

### "No game found" vs. "no game happened"
These are different. If a scheduled game date has passed and you find no result anywhere, report it as "SCHEDULED BUT NO RESULT FOUND — may have been postponed or data not yet entered." Do NOT report it as "no new games."

### Live game detection
If GC shows a game as LIVE or with a score but no W/L prefix, flag it as in-progress. Note the current score. Do NOT add it as a final result. Do NOT ignore it.

### Per-game data completeness
After adding a game, check: does it have full box score data (player stats per game) or just a score? If score-only, flag it: "Apr [X] vs [opponent]: SCORE ONLY — box score data needed from GC on next sweep."

### verify_render.js is mandatory
After every run of update_dashboard.js, run verify_render.js. If it fails, the sweep cannot proceed to commit/push. This is not optional. This is not "nice to have." This is a hard gate.

## CRITICAL: divisionB vs scores.varsity (league standings)
The `computeDivBStandings()` function in update_dashboard.js builds Conference 3-D standings from TWO sources: `scores.varsity` (entries with `league: true`) and `scores.divisionB`. If a game appears in both, it gets double-counted and standings will be wrong.

**Rules:**
- `scores.divisionB` contains ONLY league games between OTHER Conference 3-D teams (not DF)
- DF league games go ONLY in `scores.varsity` with `league: true`
- NEVER put a DF game in divisionB — this causes double-counting
- When adding a new league game, check: is DF playing? If yes, it goes in scores.varsity with league:true. If no, it goes in divisionB.
- After running the updater, spot-check DF's league RF/RA against the sum of scores in scores.varsity league games. If they don't match, you have a divisionB contamination bug.

## CRITICAL: PIS Formula Rules (DO NOT CHANGE)
All PIS is per-game with 2 decimal precision. Formulas are final.

### Hitting (shared base, both pools):
H(1) + 2B(+0.75) + 3B(+1.25) + HR(+2) + BB(0.75) + HBP(0.75) + SB(0.5) + multi-hit(+1.5) - SO(0.35) - E(0.5)
- **JV only:** RBI(0.25), R dropped entirely
- **Varsity only:** RBI(0.5), R(0.25)
- Denominator: total games with stats
- Display: 2 decimal places

### Pitching (shared base, both pools):
IP(1.5) + SO(1.0) - ER(1.25) - BB(0.5) - H(0.25)
- **JV only:** W and SV dropped
- **Varsity only:** W(2) + SV(2)
- Denominator: pitching appearances only (NOT total games)
- Display: 2 decimal places

### Thresholds:
- JV hitters: 2.0 PA per team game
- JV pitchers: 0.83 IP per team game (~5 IP minimum)
- Varsity hitters: 2.0 PA per team game
- Varsity pitchers: 1.0 IP per team game

### Labels:
- Both JV and Varsity tiles show "PIS Per Game"

### Opponents:
- Remain cumulative (often only season totals available)

### Removed players:
- Eli Gallagher: removed from JV (moved to Varsity)

## CRITICAL: Per-game data rules
- Per-game data IS the complete record for all DF/JV players. If a player is not listed in a game, they didn't play. Do NOT treat missing games as incomplete data.
- The updater uses per-game accumulation whenever games[] has entries. Aggregate fallback (seasonStats) is ONLY for opponents with zero per-game data.
- When adding new game data, add per-game box scores for EVERY player who appeared in the game. Players who didn't play get no entry for that game.

## When adding new GameChanger data:
- Per-game box scores go in playerStats.[pool].[PlayerName].games[]
- Include all hitting fields: ab, h, 2b, 3b, hr, rbi, r, bb, so, e, hbp, sb
- Include all pitching fields: ip, h, er, so, bb, w, sv, r, pitches, strikes, bf
- **Fielding errors** go in BOTH game.hitting.e (per-game) AND playerStats.[pool].[PlayerName].fielding.e (season total). GameChanger stores errors as a fielding stat, not a batting stat. Always update the fielding object with current season totals (tc, a, po, fpct, e, dp).
- The updater handles all PIS calculation — just provide the raw stats

## CRITICAL: scores.json structure notes
- `scores.varsity` and `scores.jv` are OBJECTS keyed by date string (e.g., `'2026-05-07'`), NOT arrays. Use `Object.entries()` or `Object.values()` to iterate.
- Player stats live under `playerStats.df` (not `playerStats.varsity`). The keys under playerStats are: `df`, `opponents`, `jv`.
- When checking for existing games, use `scores.varsity['2026-05-07']` not `.find()` or `.forEach()`.

## Do NOT:
- Modify the scoreGame() function or PIS weights
- Change the per-game normalization logic
- Alter decimal precision
- Remove the pool-specific (isJV) branching in the formula
- Assume or fabricate any data point that is not confirmed by a verified source
