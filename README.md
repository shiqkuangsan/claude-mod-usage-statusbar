# usage-rings

English | [简体中文](README.zh-CN.md)

[![release](https://img.shields.io/github/v/release/shiqkuangsan/claude-mod-usage-statusbar?color=22c55e)](https://github.com/shiqkuangsan/claude-mod-usage-statusbar/releases) [![changelog](https://img.shields.io/badge/changelog-view-3b82f6)](CHANGELOG.md) [![Claude Code](https://img.shields.io/badge/Claude%20Code-%E2%89%A5%202.1.287-d97757)](#install) [![license](https://img.shields.io/github/license/shiqkuangsan/claude-mod-usage-statusbar)](LICENSE)

![usage-rings in the Claude desktop app](docs/screenshot.png)

> Early version: the layout and what the band shows are still evolving.

A Claude Code mod that keeps a usage band above the prompt, drawn as ring gauges with the percentage inside:

- **ctx**: how full the context is against the auto-compact window, as the session rail and `/context` measure it, and how many tokens are left before compaction; `/rings ctx model` measures against the model's whole window instead, with the token count
- **5h** and **7d**: plan rate-limit windows, each with the time left until it resets
- any per-model weekly window the API reports, under the model's name
- **pace tick**: a mark across each window's ring where its time has got to, so an arc past the mark means usage runs ahead of time
- **forecast**: when the window's average rate so far would use it up before it resets, the tile says `full ~1h57m` and the ring turns amber
- **spend**: this session's whole cost, marked `session`, then today's and this month's totals, either across every session (`all:`) or for this session alone (`session:`); optionally per turn and per hour
- **speed**: output tokens per second, live while a response streams (`~58 tok/s`) and exact once it ends, plus optionally cache hits and time to first token

Ring colors follow the level: ok under 60%, warn under 85%, danger above. In the terminal the rings become `○ ◔ ◑ ◕ ●` glyphs, and the pace tick an arrow (`▲` ahead of pace, `▽` behind).

## Layouts

| Layout | What it looks like |
| --- | --- |
| `tiles` (default) | Each ring with a two-line label: the name, then the forecast when there is one, else the reset time. Spend and speed are a tile each: the first figure on top, the rest below. Sized to sit in one row beside the desktop prompt box. |
| `minimal` | Rings and the leading spend and speed figures only. |

## Settings

Run `/rings settings` to open a pane where you pick the layout, theme, language, totals scope and what ctx measures against, switch each part on or off (grouped as rings, ring details, spend and speed), choose where new sessions show the band, and set colors. The same can be done from the prompt:

| Command | Does |
| --- | --- |
| `/rings` | Hide or show the band in this session |
| `/rings mode tiles` / `/rings mode minimal` | Switch the layout |
| `/rings lang en` / `/rings lang zh` | English (default) or Chinese |
| `/rings scope all` / `/rings scope session` | Whether today and month total every session (default) or this session alone |
| `/rings ctx compact` / `/rings ctx model` | Whether ctx measures against the auto-compact window (default) or the model's whole window |
| `/rings show <parts>` / `/rings hide <parts>` | Switch parts on or off, several at once, or `all` |
| `/rings theme <name>` | `default`, `ocean`, `grape` or `mono` |
| `/rings color <slot> <#hex>` | Override one color; `reset` in place of the color follows the theme again |
| `/rings default desktop on` / `/rings default terminal off` | Whether new sessions on that surface start with the band shown; `/rings default` alone shows the current choice |
| `/rings reset` | Back to the defaults, keeping the language |

Parts: `ctx`, `5h`, `7d`, `models` (per-model and spend limits), `resets`, `pace`, `forecast`, `session`, `day`, `month`, `turn`, `rate` ($/h), `cache`, `speed`, `ttft`. All are on by default except `turn`, `rate`, `cache` and `ttft`.

Color slots: `ok`, `warn`, `danger` (ring levels), `pace` (the pace tick), `track` (the ring background), `accent` (session spend).

New sessions show the band in the desktop app and hide it in the terminal; VS Code and mobile follow the desktop choice. A hidden band still counts spend, so today's and this month's totals include every session.

Settings are kept in Claude Code's plugin storage and shared by every session; a session already running picks up changes made in another one when it starts again.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-rings --marketplace shiqkuangsan/claude-mod-usage-statusbar
```

From a shell:

```
claude plugin install usage-rings --marketplace shiqkuangsan/claude-mod-usage-statusbar
```

In the Claude desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `shiqkuangsan/claude-mod-usage-statusbar`, then **Add plugin**.

Requires Claude Code 2.1.287 or later.

## Notes

- Everything shown comes from the usage figures Claude Code reports to the mod. It makes no network calls and reads no files.
- Day and month spend are summed by the mod itself across sessions, using Claude Code's plugin storage. A session begun today (or this month) counts from its first message for today (or this month), even when the mod loaded later; one begun earlier counts from when the mod first saw it in that day (or month). Days before the install are not counted. With several sessions open, each band picks up the others' spend within a minute.
- The live speed is an estimate from the characters streamed (about four per token, one per CJK character); thinking the interface does not show is not counted until the response ends. The figure after a response ends uses the token count the API reports. Subagents' responses are left out.
- The forecast uses the average rate since the window began, and appears once 5% of the window has gone by.
- A fresh session shows the last saved rate-limit reading until its first response arrives; context shows `–` until then.
- With auto-compact off, or before the first reading of the auto-compact window, ctx measures against the model's window.

## License

MIT
