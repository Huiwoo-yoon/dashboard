#!/bin/zsh
# 맥미니에 매일 실행 일정 등록 (launchd, 로그인 사용자 기준)
#   소식: 매일 07:00 / 식단 분석: 매일 23:00  — 시간은 아래 숫자만 바꾸고 다시 실행
# 잠자기 중이었다면 깨어난 직후 한 번 실행된다. 해제: scripts/uninstall-launchd.sh
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
AGENTS="$HOME/Library/LaunchAgents"
LOGDIR="$HOME/Library/Logs/dashboard"
mkdir -p "$AGENTS" "$LOGDIR"
[ -f "$DIR/scripts/.env.local" ] || { echo "scripts/.env.local 이 없습니다. .env.local.example 을 복사해 채우세요."; exit 1; }

make_job() { # label job hour minute
  local plist="$AGENTS/$1.plist"
  cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/scripts/daily.mjs</string><string>$2</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$3</integer><key>Minute</key><integer>$4</integer></dict>
  <key>StandardOutPath</key><string>$LOGDIR/$2.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/$2.log</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "등록: $1 ($2, 매일 $3:$(printf %02d $4)) → 로그 $LOGDIR/$2.log"
}

make_job com.dashboard.daily-news news 7 0
make_job com.dashboard.daily-meals meals 23 0
