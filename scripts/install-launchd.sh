#!/bin/zsh
# 맥미니에 실행 일정 등록 (launchd, 로그인 사용자 기준)
#   뉴스 제목 모으기: 매일 06:30 (화면 표시 없음) / 주간 소식: 매주 금요일 07:00 / 식단 분석: 매일 23:00
#   주간 건강 리포트: 매주 월요일 07:15 (지난 월~일)
#   경제 동향: 매일 07:30(미국 장 마감 후)·16:30(국내 장 마감 후) 전체 갱신 + 10분마다 새로 추가한 종목만 채우기
#   시간은 맨 아래 숫자만 바꾸고 다시 실행
# 잠자기 중이었다면 깨어난 직후 한 번 실행된다. 해제: scripts/uninstall-launchd.sh
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
AGENTS="$HOME/Library/LaunchAgents"
LOGDIR="$HOME/Library/Logs/dashboard"
mkdir -p "$AGENTS" "$LOGDIR"
[ -f "$DIR/scripts/.env.local" ] || { echo "scripts/.env.local 이 없습니다. .env.local.example 을 복사해 채우세요."; exit 1; }

make_job() { # label job hour minute [weekday: 1=월 … 7=일]
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
  <key>StartCalendarInterval</key><dict>${5:+<key>Weekday</key><integer>$5</integer>}<key>Hour</key><integer>$3</integer><key>Minute</key><integer>$4</integer></dict>
  <key>StandardOutPath</key><string>$LOGDIR/$2.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/$2.log</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "등록: $1 ($2, ${5:+매주 요일$5 }$3:$(printf %02d $4)) → 로그 $LOGDIR/$2.log"
}

# 예전 '매일 소식' 일정 정리
launchctl bootout "gui/$(id -u)/com.dashboard.daily-news" 2>/dev/null || true
rm -f "$AGENTS/com.dashboard.daily-news.plist"

make_job com.dashboard.news-collect collect 6 30
make_job com.dashboard.weekly-news news 7 0 5
make_job com.dashboard.daily-meals meals 23 0
make_job com.dashboard.weekly-health health 7 15 1
make_job com.dashboard.market-am market 7 30
make_job com.dashboard.market-pm market 16 30

# 새로 추가한 종목만 10분마다 확인 (할 일이 없으면 조용히 끝남)
cat > "$AGENTS/com.dashboard.market-new.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.dashboard.market-new</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/scripts/daily.mjs</string><string>market</string><string>--missing</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartInterval</key><integer>600</integer>
  <key>StandardOutPath</key><string>$LOGDIR/market.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/market.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/com.dashboard.market-new" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENTS/com.dashboard.market-new.plist"
echo "등록: com.dashboard.market-new (새 종목 확인, 10분마다) → 로그 $LOGDIR/market.log"
