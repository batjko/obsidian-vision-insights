import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function execCommand(command, silent = false) {
  try {
    const result = execSync(command, { encoding: 'utf8' });
    if (!silent) {
      console.log(result.trim());
    }
    return result.trim();
  } catch (err) {
    if (!silent) {
      console.error(err.message);
    }
    throw err;
  }
}

function checkGitStatus() {
  info('Checking git status...');
  
  try {
    const status = execCommand('git status --porcelain', true);
    if (status) {
      error('Working directory is not clean. Please commit or stash your changes.');
    }
    success('Working directory is clean');
  } catch (err) {
    error('Failed to check git status');
  }
}

function checkVersionSync() {
  info('Checking version synchronization...');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  
  if (packageJson.version !== manifest.version) {
    error(`Version mismatch: package.json (${packageJson.version}) !== manifest.json (${manifest.version})`);
  }
  
  success(`Version synchronized: ${packageJson.version}`);
  return packageJson.version;
}

function checkRemoteSync() {
  info('Checking if local branch is up to date with remote...');
  
  try {
    // Fetch latest from remote
    execCommand('git fetch origin', true);
    
    // Get current branch
    const currentBranch = execCommand('git branch --show-current', true);
    
    // Check if local is behind remote
    const behind = execCommand(`git rev-list --count HEAD..origin/${currentBranch}`, true);
    if (parseInt(behind) > 0) {
      error(`Local branch is ${behind} commits behind remote. Please pull latest changes.`);
    }
    
    // Check if local is ahead of remote
    const ahead = execCommand(`git rev-list --count origin/${currentBranch}..HEAD`, true);
    if (parseInt(ahead) > 0) {
      warning(`Local branch is ${ahead} commits ahead of remote. Will push changes.`);
      
      info('Pushing changes to remote...');
      execCommand('git push origin ' + currentBranch);
      success('Changes pushed to remote');
    } else {
      success('Local branch is up to date with remote');
    }
  } catch (err) {
    error('Failed to sync with remote repository');
  }
}

function checkTagExists(version) {
  try {
    execCommand(`git rev-parse v${version}`, true);
    return true;
  } catch (err) {
    return false;
  }
}

function checkGitHubCLI() {
  try {
    execCommand('gh --version', true);
    
    // Check if authenticated
    execCommand('gh auth status', true);
    success('GitHub CLI is installed and authenticated');
  } catch (err) {
    error('GitHub CLI is not installed or not authenticated. Please install gh CLI and run "gh auth login"');
  }
}

function buildPlugin() {
  info('Building plugin...');
  try {
    execCommand('npm run build');
    success('Plugin built successfully');
  } catch (err) {
    error('Failed to build plugin');
  }
}

function checkRequiredFiles() {
  const requiredFiles = ['main.js', 'manifest.json'];
  const optionalFiles = ['styles.css'];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  if (missingFiles.length > 0) {
    error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  const existingFiles = [
    ...requiredFiles,
    ...optionalFiles.filter(file => fs.existsSync(file))
  ];
  
  success(`Required files found: ${existingFiles.join(', ')}`);
  return existingFiles;
}

function createGitHubRelease(version, assetFiles) {
  info(`Creating GitHub release v${version}...`);
  
  try {
    // Check if release already exists
    try {
      execCommand(`gh release view v${version}`, true);
      warning(`Release v${version} already exists. Updating assets...`);
      
      // Delete existing assets
      for (const file of assetFiles) {
        try {
          execCommand(`gh release delete-asset v${version} ${file} --yes`, true);
          info(`Deleted existing asset: ${file}`);
        } catch (err) {
          // Asset might not exist, continue
        }
      }
      
      // Upload new assets
      execCommand(`gh release upload v${version} ${assetFiles.join(' ')}`);
      success(`Updated release v${version} with latest assets`);
      
    } catch (err) {
      // Release doesn't exist, create it
      const command = `gh release create v${version} ${assetFiles.join(' ')} --generate-notes`;
      execCommand(command);
      success(`Created release v${version} with assets`);
    }
    
    // Get release URL
    const releaseUrl = execCommand(`gh release view v${version} --json url --jq .url`, true);
    success(`Release available at: ${releaseUrl}`);
    
  } catch (err) {
    error('Failed to create GitHub release');
  }
}

function main() {
  log('🚀 Starting release process...', 'blue');
  
  // Pre-flight checks
  checkGitHubCLI();
  checkGitStatus();
  const version = checkVersionSync();
  checkRemoteSync();
  
  // Build and validate
  buildPlugin();
  const assetFiles = checkRequiredFiles();
  
  // Create release
  createGitHubRelease(version, assetFiles);
  
  log('🎉 Release process completed successfully!', 'green');
  log(`\nNext steps:`, 'blue');
  log(`• Visit the release page to add release notes if needed`);
  log(`• Share the release with your users`);
  log(`• Update any documentation that references the version`);
}

// Run the release process
main(); 