@echo off
REM Software Usage Monitor - Windows Setup Script

echo ========================================
echo Software Usage Monitor v2.0 Setup
echo ========================================
echo.

REM Create directory structure
echo Creating directory structure...
mkdir software-usage-monitor 2>nul
cd software-usage-monitor

mkdir src\main 2>nul
mkdir src\renderer 2>nul
mkdir assets 2>nul
mkdir build 2>nul
mkdir userData 2>nul
mkdir dist 2>nul

REM Create .gitignore
echo Creating .gitignore...
(
echo # Dependencies
echo node_modules/
echo npm-debug.log*
echo.
echo # Build output
echo dist/
echo out/
echo.
echo # OS files
echo .DS_Store
echo Thumbs.db
echo desktop.ini
echo.
echo # IDE files
echo .vscode/
echo .idea/
echo.
echo # User data
echo userData/
echo *.log
echo.
echo # Environment
echo .env
echo .env.local
) > .gitignore

REM Create LICENSE.txt
echo Creating LICENSE.txt...
(
echo MIT License
echo.
echo Copyright (c) 2024 Your Company Name
echo.
echo Permission is hereby granted, free of charge, to any person obtaining a copy
echo of this software and associated documentation files (the "Software"^), to deal
echo in the Software without restriction, including without limitation the rights
echo to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
echo copies of the Software, and to permit persons to whom the Software is
echo furnished to do so, subject to the following conditions:
echo.
echo The above copyright notice and this permission notice shall be included in all
echo copies or substantial portions of the Software.
echo.
echo THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
echo IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
echo FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
echo AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
echo LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
echo OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
echo SOFTWARE.
) > LICENSE.txt

REM Create placeholder icons
echo Creating placeholder icons...
type nul > assets\icon.ico
type nul > assets\icon.png
type nul > assets\tray-icon.png

REM Create setup instructions
echo Creating setup instructions...
(
echo # Setup Instructions for Windows
echo.
echo ## Prerequisites
echo - Node.js 16+ installed
echo - Run PowerShell as Administrator
echo.
echo ## Steps:
echo 1. Copy all source files from artifacts
echo 2. Create icon files in assets/
echo 3. Run: npm install
echo 4. Run: npm start
echo.
echo ## Building:
echo npm run build:win
echo.
echo ## Notes:
echo - Run as Administrator for process monitoring
echo - Add to Windows Defender exclusions if needed
) > SETUP-WINDOWS.md

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Copy source files to their directories
echo 2. Create icon files
echo 3. Run 'npm install'
echo 4. Run 'npm start'
echo.
echo Directory structure:
dir /s /b /ad | findstr /v "node_modules"
echo.
pause