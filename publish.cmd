@echo off
rem SJ Workboard 읽기 전용 사본: 보드가 바뀌었을 때만 암호화 사본을 만들어 gh-pages 브랜치에 push
cd /d "%~dp0"
node build.mjs || exit /b 1
git add docs/index.html
git diff --cached --quiet && exit /b 0
git -c user.name="SJ Workboard Bot" -c user.email="noreply@users.noreply.github.com" commit -q -m "snapshot update" || exit /b 1
git push -q origin gh-pages
