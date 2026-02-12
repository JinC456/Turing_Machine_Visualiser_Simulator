@echo off
echo Building the project...
call npm run build

echo Navigating to dist folder...
cd dist

echo Initializing temporary Git...
git init
git add -A
git commit -m "deploy"

echo Pushing to GitHub Pages...
git push -f https://github.com/JinC456/Turing_Machine_Visualiser_Simulator.git master:gh-pages

echo Cleaning up...
cd ..
echo DEPLOYMENT COMPLETE!
pause