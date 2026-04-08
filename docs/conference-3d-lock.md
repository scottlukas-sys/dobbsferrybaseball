# Section 1 Conference 3, Division D — LOCKED ROSTER

**Authoritative source:** MaxPreps live standings and game-page "conference" labels, cross-validated 2026-04-08.

## Why this matters

Dobbs Ferry's regular-season league standings are determined by **Conference 3-D**, a 6-team sub-division within Section 1. **Class B** is the NYSPHSAA playoff enrollment class — a larger pool of teams from multiple sub-divisions who compete for the Section 1 Class B championship at sectional playoff time. **They are not the same.** Do not build regular-season standings from a Class B playoff pool.

## The 6 teams (Conference 3-D)

| # | Team | Town |
|---|------|------|
| 1 | Dobbs Ferry Eagles | Dobbs Ferry |
| 2 | Blind Brook Trojans | Rye Brook |
| 3 | Hastings Yellow Jackets | Hastings-on-Hudson |
| 4 | Rye Neck Panthers | Mamaroneck |
| 5 | The Leffell School Lions | Hartsdale |
| 6 | Tuckahoe Tigers | Tuckahoe |

## Other Class B sub-divisions (NOT in Dobbs Ferry's league)

Share the Class B playoff bracket but not the regular-season standings:

- **Conference 3-E:** Putnam Valley, Pawling, Haldane, North Salem
- **Conference 3-C (approx.):** Briarcliff, Valhalla

These teams are ONLY counted if Dobbs Ferry meets them in the Class B playoffs.

## Rules

1. `divBTeams` in `update_dashboard.js` must exactly match the 6 teams above. Do not silently modify.
2. Only games between two Conference 3-D teams count for the standings widget.
3. Games vs. non-conference opponents (Valhalla, Sleepy Hollow, Irvington, Ardsley, Edgemont, Haldane, Pearl River, Saunders, Westlake, etc.) are `type: 'Game'` in the schedule, not `type: 'League'`.
4. If MaxPreps shows a different roster for Conference 3-D, update this file AND `divBTeams` in the same commit with a citation.

Last verified: 2026-04-08.
