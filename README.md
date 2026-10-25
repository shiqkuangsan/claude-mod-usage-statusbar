# usage-rings

English | [简体中文](README.zh-CN.md)

![usage-rings in the Claude desktop app](docs/screenshot.png)

> Early version: the layout and what the band shows are still evolving.

A Claude Code mod that keeps a usage band above the prompt, drawn as ring gauges with the percentage inside:

- **ctx**: how full the context window is, with the token count
- **5h** and **7d**: plan rate-limit windows, each with the time left until it resets
- any per-model weekly window the API reports, under the model's name
- **pace tick**: a mark across each window's ring where its time has got to, so an arc past the mark means usage runs ahead of time
- **forecast**: when the window's average rate so far would use it up before it resets, the tile says `full ~1h57m` and the ring turns amber
- **spend**: this session's cost, plus totals for today and this month, and optionally per turn and per hour
- **speed**: output tokens per second, live while a response streams (`~58 tok/s`) and exact once it ends, plus optionally cache hits and time to first token

Ring colors follow the level: ok under 60%, warn under 85%, danger above. Hover a ring for everything about it. In the terminal the rings become `○ ◔ ◑ ◕ ●` glyphs, and the pace tick an arrow (`▲` ahead of pace, `▽` behind).

## Layouts

| Layout | What it looks like |
| --- | --- |
| `tiles` (default) | Each ring with a two-line label: the name, then the forecast when there is one, else the reset time. Spend and speed are a tile each: the first figure on top, the rest below. Sized to sit in one row beside the desktop prompt box. |
| `minimal` | Rings and the leading spend and speed figures only; the rest is in each ring's hover. |

## Settings

Run `/rings settings` to open a pane where you pick the layout, theme and language, switch each part on or off, and set colors. The same can be done from the prompt:

| Command | Does |
| --- | --- |
| `/rings` | Hide or show the band |
| `/rings mode tiles` / `/rings mode minimal` | Switch the layout |
| `/rings lang en` / `/rings lang zh` | English (default) or Chinese |
| `/rings show <parts>` / `/rings hide <parts>` | Switch parts on or off, several at once, or `all` |
| `/rings theme <name>` | `default`, `ocean`, `grape` or `mono` |
| `/rings color <slot> <#hex>` | Override one color; `reset` in place of the color follows the theme again |
| `/rings reset` | Back to the defaults, keeping the language |

Parts: `ctx`, `5h`, `7d`, `models` (per-model and spend limits), `resets`, `pace`, `forecast`, `session`, `day`, `month`, `turn`, `rate` ($/h), `cache`, `speed`, `ttft`. All are on by default except `turn`, `rate`, `cache` and `ttft`.

Color slots: `ok`, `warn`, `danger` (ring levels), `pace` (the pace tick), `track` (the ring background), `accent` (session spend).

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
- Day and month spend are summed by the mod itself from the time it is installed, across sessions, using Claude Code's plugin storage. Spend from before the install is not counted.
- The live speed is an estimate from the characters streamed (about four per token, one per CJK character); thinking the interface does not show is not counted until the response ends. The figure after a response ends uses the token count the API reports. Subagents' responses are left out.
- The forecast uses the average rate since the window began, and appears once 5% of the window has gone by.
- A fresh session shows the last saved rate-limit reading until its first response arrives; context shows `–` until then.

## License

MIT
