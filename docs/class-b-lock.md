# Class B League — Locked Roster

**Authoritative as of 2026-04-08.** Source: Section 1 Class B standings page (screenshot).

## The 8 Class B teams (ONLY these)

1. Blind Brook Trojans
2. Briarcliff Bears
3. Dobbs Ferry Eagles
4. Hastings Yellow Jackets
5. Pawling Tigers
6. Putnam Valley Tigers
7. Rye Neck Panthers
8. Valhalla Vikings

## Not Class B (do not include in standings, even if they appear on the DF schedule)

- Ardsley — NOT Class B
- Edgemont — NOT Class B
- Haldane — NOT Class B (Class C)
- Irvington — NOT Class B
- Leffell School — NOT Class B (Class C)
- Pearl River — NOT Class B
- Saunders — NOT Class B
- Sleepy Hollow — NOT Class B
- Tuckahoe — NOT Class B
- Westlake — NOT Class B

## Rules for update_dashboard.js

- `divBTeams` in update_dashboard.js is the SINGLE SOURCE OF TRUTH.
- `nameMap` must only contain entries for the 8 Class B teams above.
- DO NOT add/remove teams without updating this file AND citing a new authoritative source.
- A DF non-league opponent (e.g., Edgemont, Irvington, Saunders) winning/losing does NOT affect Class B standings. Those games go in `scores.varsity` but are not counted in `computeDivBStandings`.
- Only games where BOTH teams are in the 8-team list above may be added to `scores.divisionB`.

## Terminology

- Use "Class B" throughout the dashboard. "Division B" and "Conference 3" are deprecated labels from older SKILL.md lore.
