@echo off
REM create-assets.cmd - Creates placeholder asset files

echo Creating assets directory...
if not exist "assets" mkdir "assets"

echo Creating placeholder icon files...

REM Create a simple BMP and convert to PNG using PowerShell
powershell -Command "Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap(256, 256); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(102, 126, 234)); $font = New-Object System.Drawing.Font('Arial', 72); $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White); $g.DrawString('ESM', $font, $brush, 50, 80); $bmp.Save('assets\icon.png', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()"

powershell -Command "Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap(32, 32); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(102, 126, 234)); $font = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold); $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White); $g.DrawString('M', $font, $brush, 8, 6); $bmp.Save('assets\tray-icon.png', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()"

powershell -Command "Add-Type -AssemblyName System.Drawing; $bmp = New-Object System.Drawing.Bitmap(64, 64); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(102, 126, 234)); $font = New-Object System.Drawing.Font('Arial', 32, [System.Drawing.FontStyle]::Bold); $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White); $g.DrawString('M', $font, $brush, 16, 12); $bmp.Save('assets\tray-icon@2x.png', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()"

echo.
echo Assets created successfully!
echo.
echo Note: These are placeholder icons. Replace them with your actual icons for production.
echo.
pause