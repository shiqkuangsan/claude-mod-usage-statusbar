# 发版流程

## 三个副本

| 副本 | 位置 | 用途 |
| --- | --- | --- |
| 开发版 | `~/.claude/dev-mods/<session-id>/usage-rings/`，或用 `claude --plugin-dir <目录>` 加载的任意目录 | 改代码、热重载、看效果。`.claude-plugin/types/` 由引擎生成，`tsc` 在这里跑 |
| 仓库 | 本仓库 | 唯一的发布源。多出 `README*`、`CHANGELOG*`、`docs/`、`scripts/`、`LICENSE`、`.claude-plugin/marketplace.json` |
| 正式版 | `~/.claude/plugins/cache/claude-mod-usage-statusbar/usage-rings/<version>/` | `claude plugin install/update` 从 GitHub 拉下来的副本，不要手改 |

色带右上角的 `dev` 标签按加载路径判断：路径不在 `plugins/cache/` 下就显示（见 `hooks/register.tsx` 的 `isDevRoot`）。开发目录和仓库里不需要任何标记文件，同步时也不用特殊处理；正式版从缓存加载，不会显示。

## 同步规则

开发目录 → 仓库，只同步这几个文件或目录：

| 同步 | 不同步 |
| --- | --- |
| `hooks/`、`types/`、`tests/`、`tsconfig.json`、`.claude-plugin/plugin.json` | `.claude-plugin/types/`（生成物）；仓库独有的 `README*`、`CHANGELOG*`、`docs/`、`scripts/`、`LICENSE`、`marketplace.json` |

```bash
D=~/.claude/dev-mods/<session-id>/usage-rings
R=~/WorkSpace/PrivateSpace/claude-mod-usage-statusbar
for p in hooks types tests; do rsync -a $D/$p/ $R/$p/; done
cp $D/tsconfig.json $R/tsconfig.json
cp $D/.claude-plugin/plugin.json $R/.claude-plugin/plugin.json
for p in hooks types tests tsconfig.json .claude-plugin/plugin.json; do diff -rq $D/$p $R/$p; done
```

最后一条 `diff` 没有输出才算同步完。开发目录删过的文件，要在仓库里手动删掉（`rsync` 没加 `--delete`，以免误删）。

## 步骤

| 阶段 | 做什么 | 通过标准 |
| --- | --- | --- |
| 开发 | 在开发目录里改，桌面端和终端各看一眼效果 | 用户确认效果 |
| 检查 | `npx -y -p typescript@5.6.3 tsc -p $D`；`claude plugin validate $D`；`claude plugin test $D` | 无类型错误，校验通过，测试全过 |
| 版本号 | 改 `.claude-plugin/plugin.json` 的 `version`（semver：修 bug 改 patch，新功能改 minor） | 版本号比上一个发布高 |
| 文档 | 同时更新 `README.md` 和 `README.zh-CN.md`；界面有变化时换 `docs/screenshot.png`，`plugin.json` 的 `description` 也要跟上 | 中英文内容一致 |
| 更新日志 | 在 `CHANGELOG.md`（英文）和 `CHANGELOG.zh-CN.md`（中文）顶部各加一节 `## X.Y.Z (YYYY-MM-DD)`，写用户能感知的变化，两边条目一一对应 | `scripts/release-notes.sh X.Y.Z` 能输出中英两段 |
| 同步 | 按上面的同步规则复制到仓库，`diff` 核对 | `diff` 无输出 |
| 仓库检查 | `claude plugin validate $R`；`claude plugin test $R` | 同上 |
| 扫描 | 对要提交的文件跑一次密钥扫描（`scan_secrets` 工具或 `gitleaks detect`），再人工看一遍有没有内网地址或别人的数据 | 无发现 |
| 提交 | 列出确切文件清单后再 `git commit`；commit message 用英文，`feat:` / `fix:` / `docs:` 前缀，新版本号写在标题括号里 | — |
| 推送 | `git push origin main`，单独执行 | GitHub 上能看到新提交 |
| GitHub release | `scripts/release-notes.sh X.Y.Z > <notes 文件>` 生成中英双语 notes，再 `gh release create vX.Y.Z --target <发版提交 sha> --title "vX.Y.Z" --notes-file <notes 文件>`；它会在远端建 tag，之后 `git fetch --tags` 同步到本地。notes 文件放仓库外（如 `outputs/` 或临时目录） | releases 页面显示新版本、标为 Latest，正文有 English 和 中文 两段；README 徽章随后更新 |
| 更新本机 | `claude plugin marketplace update claude-mod-usage-statusbar`，再 `claude plugin update usage-rings@claude-mod-usage-statusbar`，然后在会话里 `/reload-plugins` 或开新会话 | `claude plugin list` 显示新版本 |

## 注意

- 版本号不改，`claude plugin update` 不会拉新代码：缓存目录按版本号命名，同一版本号视为已是最新。只改文档、不需要用户更新时，可以不改版本号。
- 提交、推送、发 GitHub release 分别需要明确授权，不能合并成一条命令执行。
- 改已发布的 release 说明：先改两个 CHANGELOG 并提交，再 `scripts/release-notes.sh X.Y.Z > <文件>`，`gh release edit vX.Y.Z --notes-file <文件>`。
- README 顶部的版本徽章由 shields.io 读取最新 GitHub release，发版后不用手改，有几分钟缓存；最低 Claude Code 版本变了时，改徽章和 Install 一节里的版本号。
- 仓库目录的 `validate` 目前有两个已知 warning：`marketplace.json` 缺 `description`，没有 icon。都不影响安装，只有提交到官方插件目录时才需要补。
- 同一个会话里同时加载开发版和正式版时，色带会出现两条。开发时可以先 `claude plugin disable usage-rings@claude-mod-usage-statusbar`，发版后再 `enable`。
- 回滚：`git revert` 出问题的提交，版本号继续往上加（例如 0.2.1 有问题就发 0.2.2），不要复用已经发过的版本号。
