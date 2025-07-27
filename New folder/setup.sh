#!/bin/bash

# Software Usage Monitor - Complete Setup Script
# This script creates the entire project structure

echo "🚀 Setting up Software Usage Monitor v2.0..."

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p software-usage-monitor/{src/{main,renderer},assets,build,userData,dist}

cd software-usage-monitor

# Create .gitignore
echo "📝 Creating .gitignore..."
cat > .gitignore << 'EOL'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
out/
*.local

# OS files
.DS_Store
Thumbs.db
desktop.ini

# IDE files
.vscode/
.idea/
*.swp
*.swo

# User data
userData/
*.log
logs/

# Environment files
.env
.env.local

# Temporary files
*.tmp
*.temp
.cache/

# Certificates
*.p12
*.key
*.pem
EOL

# Create LICENSE.txt
echo "📜 Creating LICENSE.txt..."
cat > LICENSE.txt << 'EOL'
MIT License

Copyright (c) 2024 Your Company Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOL

# Create entitlements.mac.plist
echo "🍎 Creating macOS entitlements..."
cat > build/entitlements.mac.plist << 'EOL'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.temporary-exception.apple-events</key>
    <string>com.apple.systemevents</string>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
EOL

# Create placeholder icon files
echo "🎨 Creating placeholder icons..."
touch assets/icon.ico
touch assets/icon.icns
touch assets/icon.png
touch assets/tray-icon.png

echo "⚠️  Note: You need to replace the placeholder icon files in the assets/ directory"

# Create a simple README for icon creation
cat > assets/README-ICONS.md << 'EOL'
# Icon Requirements

## icon.ico (Windows)
- Size: 256x256 pixels
- Format: ICO
- Include sizes: 16, 32, 48, 256

## icon.icns (macOS)
- Sizes needed: 16, 32, 64, 128, 256, 512 (1024 for Retina)
- Format: ICNS
- Use iconutil or Icon Set Creator

## icon.png (Linux)
- Size: 512x512 pixels
- Format: PNG with transparency

## tray-icon.png (System Tray)
- Size: 24x24 pixels (Windows/Linux) or 22x22 (macOS)
- Format: PNG with transparency
- Should be monochrome/white for dark backgrounds

## Quick Creation Tips
1. Create your logo at 1024x1024
2. Use online converters like:
   - https://cloudconvert.com/png-to-ico
   - https://cloudconvert.com/png-to-icns
3. Or use ImageMagick:
   ```bash
   convert logo.png -resize 256x256 icon.ico
   convert logo.png -resize 512x512 icon.png
   convert logo.png -resize 24x24 tray-icon.png
   ```
EOL

# Create package.json placeholder
echo "📦 Creating package.json notice..."
cat > SETUP-INSTRUCTIONS.md << 'EOL'
# Setup Instructions

## 1. Copy all source files from the artifacts:
- Copy main.js to src/main/
- Copy monitoring.js to src/main/
- Copy data-manager.js to src/main/
- Copy index.html to src/renderer/
- Copy preload.js to src/renderer/
- Copy renderer.js to src/renderer/
- Copy styles.css to src/renderer/
- Copy package.json to root directory

## 2. Create icon files:
- Replace placeholder icons in assets/ directory
- See assets/README-ICONS.md for specifications

## 3. Install dependencies:
```bash
npm install
```

## 4. Run the application:
```bash
npm start
```

## 5. Build for distribution:
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Platform-Specific Notes:

### Windows
- Run as Administrator for best results
- Windows Defender may need exclusion

### macOS
- Grant accessibility permissions when prompted
- May need to allow in Security & Privacy

### Linux
- Works on Ubuntu, Fedora, Debian
- May need to set executable permissions

## Support
For issues, check the README.md or contact support.
EOL

echo "✅ Project structure created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Copy all source code files from the artifacts to their respective directories"
echo "2. Create proper icon files (see assets/README-ICONS.md)"
echo "3. Run 'npm install' to install dependencies"
echo "4. Run 'npm start' to launch the application"
echo ""
echo "📁 Project structure:"
tree -d -L 3 2>/dev/null || find . -type d -maxdepth 3 | sed -e "s/[^-][^\/]*\// |/g" -e "s/|\([^ ]\)/|-\1/"