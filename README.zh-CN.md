# usage-rings

[English](README.md) | 简体中文

[![release](https://img.shields.io/github/v/release/shiqkuangsan/claude-mod-usage-statusbar)](https://github.com/shiqkuangsan/claude-mod-usage-statusbar/releases) · 当前版本：**0.3.0** · [更新日志](CHANGELOG.md)

![usage-rings 在 Claude 桌面端的效果](docs/screenshot.png)

> 早期版本：面板的布局和展示内容仍在调整中。

一个 Claude Code mod，在输入框上方显示一条用量面板，每项用量画成一个圆环，百分比显示在圆环中间：

- **ctx**：上下文窗口用了多少，附带 token 数
- **5h** 和 **7d**：套餐的两个限额窗口，各自带有距离重置的剩余时间
- API 返回的按模型单独计算的周限额，以模型名显示
- **时间刻度**：每个限额圆环上的一道刻度，标出窗口时间已经过去多少；用量弧越过刻度，说明用量跑得比时间快
- **用满预测**：按窗口开始以来的平均速度，如果会在重置前用满，小卡会显示 `约 1h57m 用满`，圆环变成琥珀色
- **花费**：本会话花费，加上今日和本月累计，还可以显示本轮花费和每小时花费
- **速度**：每秒输出 token 数，生成过程中实时显示估算值（`~58 tok/s`），结束后换成精确值；还可以显示缓存命中率和首 token 延迟

圆环颜色随档位变化：60% 以下为正常色，85% 以下为警告色，再往上为危险色。在终端里，圆环会换成 `○ ◔ ◑ ◕ ●` 字符，时间刻度换成箭头（`▲` 用得比时间快，`▽` 比时间慢）。

## 布局

| 布局 | 效果 |
| --- | --- |
| `tiles`（默认） | 双行小卡：每个圆环旁边两行字，上行是名称，下行有用满预测时显示预测，否则显示重置时间。花费和速度各一张卡，主数字在上，其余放在下行。宽度按桌面端输入框设计，可以放进一行。 |
| `minimal` | 极简：只显示圆环，以及花费和速度的主数字。 |

## 设置

运行 `/rings settings` 打开设置面板，可以选择布局、主题和语言，逐项开关组件，设置新会话在哪些端默认显示，以及自定义颜色。也可以直接在输入框里用命令修改：

| 命令 | 作用 |
| --- | --- |
| `/rings` | 在当前会话隐藏或显示面板 |
| `/rings mode tiles` / `/rings mode minimal` | 切换布局 |
| `/rings lang en` / `/rings lang zh` | 英文（默认）或中文 |
| `/rings show <组件>` / `/rings hide <组件>` | 显示或隐藏组件，可以一次写多个，或写 `all` |
| `/rings theme <名称>` | `default`、`ocean`、`grape` 或 `mono` |
| `/rings color <颜色槽> <#hex>` | 覆盖某个颜色；颜色写成 `reset` 则恢复跟随主题 |
| `/rings default desktop on` / `/rings default terminal off` | 设置该端的新会话是否默认显示面板；单独运行 `/rings default` 查看当前设置 |
| `/rings reset` | 恢复默认设置，语言保持不变 |

组件：`ctx`、`5h`、`7d`、`models`（按模型的限额和花费上限）、`resets`（重置倒计时）、`pace`（时间刻度）、`forecast`（用满预测）、`session`（本会话花费）、`day`（今日花费）、`month`（本月花费）、`turn`（本轮花费）、`rate`（每小时花费）、`cache`（缓存命中率）、`speed`（输出速度）、`ttft`（首 token 延迟）。除 `turn`、`rate`、`cache`、`ttft` 外默认全部开启。

颜色槽：`ok`、`warn`、`danger`（圆环的三档颜色）、`pace`（时间刻度）、`track`（圆环底色）、`accent`（本会话花费）。

新会话在桌面端默认显示面板，在终端默认隐藏；VS Code 和移动端跟随桌面端的设置。面板隐藏时仍会累计花费，所以今日和本月总额包含所有会话。

设置保存在 Claude Code 的插件存储里，所有会话共用；在一个会话里改了设置，已经在运行的其他会话要在下次启动时才会生效。

## 安装

在 Claude Code 终端会话的输入框里：

```
/plugin install usage-rings --marketplace shiqkuangsan/claude-mod-usage-statusbar
```

在 shell 里：

```
claude plugin install usage-rings --marketplace shiqkuangsan/claude-mod-usage-statusbar
```

Claude 桌面端不能运行 `/plugin`：点击输入框旁边的 **+**，选 **Plugins**，再选 **Add marketplace** 并填入 `shiqkuangsan/claude-mod-usage-statusbar`，最后点 **Add plugin**。

需要 Claude Code 2.1.287 或更高版本。

## 说明

- 面板上的所有数据都来自 Claude Code 报给 mod 的用量数据。mod 不发起任何网络请求，也不读取任何文件。
- 今日和本月花费由 mod 自己累计，从安装时开始算，跨会话保存在 Claude Code 的插件存储里。安装之前的花费不计入。
- 实时速度是按已输出的字符数估算的（英文约 4 个字符算 1 个 token，中日韩文字每字算 1 个）；界面上不显示的思考内容要等响应结束才计入。响应结束后的数值按 API 返回的 token 数计算。subagent 的响应不计入。
- 用满预测按窗口开始以来的平均速度计算，窗口时间过去 5% 之后才显示。
- 新会话在收到第一次响应之前，显示上次保存的限额数据；上下文在那之前显示 `–`。

## 许可证

MIT
