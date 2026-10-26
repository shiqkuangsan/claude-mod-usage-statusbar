#!/usr/bin/env bash
# Prints the bilingual GitHub release notes for one version, taken from both changelogs.
# Usage: scripts/release-notes.sh 0.3.0 > notes.md
set -euo pipefail

version="${1:?usage: $0 <version>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

# The body of "## <version> (...)" up to the next "## " heading.
section() {
  awk -v v="$version" '
    /^## / { on = index($0, "## " v " ") == 1; next }
    on
  ' "$1" | sed -e '/./,$!d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'
}

en="$(section "$root/CHANGELOG.md")"
zh="$(section "$root/CHANGELOG.zh-CN.md")"
if [ -z "$en" ] || [ -z "$zh" ]; then
  echo "version $version is missing from CHANGELOG.md or CHANGELOG.zh-CN.md" >&2
  exit 1
fi

cat <<EOF
## English

$en

## 中文

$zh

---

\`claude plugin update usage-rings@claude-mod-usage-statusbar\`, then \`/reload-plugins\` or a new session.
已安装的用户运行上面的命令更新，然后执行 \`/reload-plugins\` 或开新会话。
EOF
