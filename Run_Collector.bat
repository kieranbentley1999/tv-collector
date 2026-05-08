@echo off
title TV Collector Server
echo Starting Cinematic Server...
echo -----------------------------------
echo Opening game at http://localhost:8000
echo -----------------------------------
start "" "http://localhost:8000"
python -m http.server 8000
pause
