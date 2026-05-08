@echo off
title TV Collector: Vault Edition
echo Starting Vault Backend...
echo -----------------------------------
echo Opening game at http://localhost:5000
echo -----------------------------------
start "" "http://localhost:5000"
py server.py
pause
