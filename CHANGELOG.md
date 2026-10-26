# Changelog

English | [简体中文](CHANGELOG.zh-CN.md)

Every release is also on the [GitHub releases page](https://github.com/shiqkuangsan/claude-mod-usage-statusbar/releases). Update an installed copy with `claude plugin update usage-rings@claude-mod-usage-statusbar`, then `/reload-plugins` or a new session.

## 0.4.0 (2026-10-26)

- The session's figure is marked `session`, so it reads apart from today's and this month's totals, which cover every session. A session left open for days shows its whole cost there, while today counts only this day.
- New part `session-today`, off by default: this session's own spend today. `/rings show session-today` or the settings pane turns it on.

## 0.3.2 (2026-10-26)

- Fixed: today's and this month's spend left out what a session had spent before the mod loaded in it, so after an install, an update or a reload they could read far below the sessions' own figures. A session begun today now counts from its first message, whenever the mod loaded; one begun on an earlier day counts from when the mod first saw it that day.
- Each session's figure for a day is now recorded as one total rather than added to, so a reload or a resumed session cannot count the same spend twice.
- On the day of this update, today's figure starts from the sessions' own totals; the older ledgers still count for earlier days of the month.

## 0.3.1 (2026-10-26)

- Fixed: with several sessions open, a band's today and month figures stayed where they were until that session spent again; every band now picks up the other sessions' spend within a minute.
- Fixed: two sessions spending at the same moment could overwrite each other's addition to today's and this month's totals. Each session now keeps its own figure and the band sums them. Totals recorded by 0.3.0 carry over.

## 0.3.0 (2026-10-26)

- **Per-surface default visibility**: new sessions show the band in the desktop app and hide it in the terminal; VS Code and mobile follow the desktop choice.
- `/rings default desktop|terminal on|off` changes those defaults, `/rings default` alone shows them, and the settings pane has a toggle for each.
- `/rings` still hides or shows the band in the current session, and a plugin reload keeps that choice.
- A hidden band keeps counting spend, so today's and this month's totals include every session.

## 0.2.0 (2026-10-26)

- **Layouts**: `tiles` (default), each ring with a two-line label sized to fit beside the desktop prompt box, and `minimal`, the rings and leading figures only.
- **Pace tick** on each limit ring marking how much of the window's time has gone by; in the terminal an arrow (`▲` ahead of pace, `▽` behind).
- **Forecast**: when a window's average rate would use it up before it resets, the tile says `full ~1h57m` and the ring turns amber.
- **Output speed**: live tokens per second while a response streams, exact once it ends; optional cache hits and time to first token.
- Optional per-turn and per-hour spend.
- **Settings**: `/rings settings` pane and `/rings mode | lang | show | hide | theme | color | reset` commands; every part can be switched on or off.
- **Themes** `default`, `ocean`, `grape`, `mono`, and per-slot color overrides.
- **English and Chinese** (English by default); a Chinese README.
- Fixed: the rings no longer flash when the band redraws during a response, and the speed figure redraws at most once a second.

## 0.1.0 (2026-10-26)

- First release: a band above the prompt with ring gauges for context, the 5h and 7d limits, any per-model weekly limit, and spend for the session, today and this month.
- SVG rings in the desktop app, `○ ◔ ◑ ◕ ●` glyphs in the terminal.
- `/rings` hides or shows the band.
