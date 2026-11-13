#!/bin/zsh
# 실행 일정 해제
for L in com.dashboard.news-collect com.dashboard.weekly-news com.dashboard.daily-news com.dashboard.daily-meals com.dashboard.weekly-health com.dashboard.market-am com.dashboard.market-pm com.dashboard.market-new com.dashboard.checkup com.dashboard.worker; do
  launchctl bootout "gui/$(id -u)/$L" 2>/dev/null && echo "해제: $L"
  rm -f "$HOME/Library/LaunchAgents/$L.plist"
done
