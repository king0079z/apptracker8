// client-installer/prepare-build.js
// Prepares the client files for inclusion in the installer

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function prepareBuild() {
  console.log('Preparing client build for installer...');
  
  const clientDir = path.join(__dirname, '..', 'enterprise-client');
  const targetDir = path.join(__dirname, 'client-build');
  
  try {
    // Clean target directory
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });
    
    // Build the client application
    console.log('Building client application...');
    execSync('npm run build', { 
      cwd: clientDir,
      stdio: 'inherit'
    });
    
    // Copy built client files
    console.log('Copying client files...');
    const clientBuildDir = path.join(clientDir, 'dist', 'win-unpacked');
    
    if (await exists(clientBuildDir)) {
      await copyDirectory(clientBuildDir, targetDir);
    } else {
      // Fallback: copy source files if no build output
      console.log('No build output found, copying source files...');
      await copyDirectory(clientDir, targetDir);
    }
    
    // Create default config directory
    const configDir = path.join(targetDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    
    // Create default config file
    const defaultConfig = {
      department: '',
      clientId: require('os').hostname(),
      monitoringInterval: 60000,
      dataRetentionDays: 30,
      allowNetworkAccess: true
    };
    
    await fs.writeFile(
      path.join(configDir, 'client-config.default.json'),
      JSON.stringify(defaultConfig, null, 2)
    );
    
    console.log('Client build preparation completed!');
    
  } catch (error) {
    console.error('Build preparation failed:', error);
    process.exit(1);
  }
}

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  
  const entries = await fs.readdir(source, { withFileTypes: true });
  
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other build artifacts
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
        await copyDirectory(sourcePath, destPath);
      }
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

// Run the build preparation
prepareBuild();