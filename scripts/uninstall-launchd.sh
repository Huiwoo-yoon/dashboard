#!/bin/zsh
# 매일 실행 일정 해제
for L in com.dashboard.daily-news com.dashboard.daily-meals; do
  launchctl bootout "gui/$(id -u)/$L" 2>/dev/null && echo "해제: $L"
  rm -f "$HOME/Library/LaunchAgents/$L.plist"
done
