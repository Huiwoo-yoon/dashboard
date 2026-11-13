#!/bin/zsh
# 맥미니에 실행 일정 등록 (launchd, 로그인 사용자 기준)
#   뉴스 제목 모으기: 매일 06:30 (화면 표시 없음) / 주간 소식: 매주 금요일 07:00 / 식단 분석: 매일 23:00
#   주간 건강 리포트: 매주 월요일 07:15 (지난 월~일) / 검진 인사이트: 10분마다 변경·요청 확인
#   붙여넣기 AI 정리(worker): 계속 실행, 15초마다 확인
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

make_every() { # label logname seconds args...
  local label=$1 logname=$2 secs=$3; shift 3
  local args=""; for a in "$@"; do args+="<string>$a</string>"; done
  cat > "$AGENTS/$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/scripts/daily.mjs</string>$args</array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartInterval</key><integer>$secs</integer>
  <key>StandardOutPath</key><string>$LOGDIR/$logname.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/$logname.log</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/$label.plist"
  echo "등록: $label ($*, ${secs}초마다) → 로그 $LOGDIR/$logname.log"
}

# 10분마다 조용히 확인 (할 일이 없으면 바로 끝남)
make_every com.dashboard.market-new market 600 market --missing   # 새로 추가한 종목만
make_every com.dashboard.checkup checkup 600 checkup              # 검진 기록·메모 변경, 화면의 '다시 분석'

# 계속 도는 작업: 붙여넣은 검사 결과·아플 때 메모를 15초마다 확인해 AI로 정리 (죽으면 launchd가 다시 띄움)
cat > "$AGENTS/com.dashboard.worker.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.dashboard.worker</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/scripts/daily.mjs</string><string>worker</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOGDIR/worker.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/worker.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/com.dashboard.worker" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENTS/com.dashboard.worker.plist"
echo "등록: com.dashboard.worker (붙여넣기 AI 정리, 계속 실행) → 로그 $LOGDIR/worker.log"
