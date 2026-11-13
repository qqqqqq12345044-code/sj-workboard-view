@echo off
rem SJ Workboard read-only snapshot: build encrypted copy, push to gh-pages only when board changed
cd /d "%~dp0"
node build.mjs || exit /b 1
git add docs/index.html
git diff --cached --quiet && exit /b 0
git -c user.name="SJ Workboard Bot" -c user.email="noreply@users.noreply.github.com" commit -q -m "snapshot update" || exit /b 1
git push -q origin gh-pages
