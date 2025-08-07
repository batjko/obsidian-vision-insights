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

async function checkGitStatus() {
  info('Checking git status...');
  
  try {
    const status = execCommand('git status --porcelain', true);
    if (status) {
      const lines = status.split('\n').filter(line => line.trim());
      warning(`Working directory has ${lines.length} uncommitted change(s).`);
    }
    success('Git status check passed');
  } catch (err) {
    error('Failed to check git status');
  }
}

function commitAllPendingChanges() {
  const status = execCommand('git status --porcelain', true);
  if (!status) {
    info('No pending changes to commit before version bump');
    return;
  }
  info('Committing pending changes before version bump...');
  try {
    execCommand('git add -A');
    execCommand('git commit -m "chore: pre-release commit of pending changes"');
    success('Committed pending changes');
  } catch (err) {
    error('Failed to commit pending changes');
  }
}

function promptForVersionType() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\nSelect version bump type:');
    console.log('1. patch (1.0.0 → 1.0.1) - Bug fixes');
    console.log('2. minor (1.0.0 → 1.1.0) - New features (backward compatible)');
    console.log('3. major (1.0.0 → 2.0.0) - Breaking changes');
    console.log('4. skip - Use current version');
    
    rl.question('\nEnter your choice (1-4): ', (answer) => {
      rl.close();
      
      const choices = {
        '1': 'patch',
        '2': 'minor', 
        '3': 'major',
        '4': 'skip'
      };
      
      const choice = choices[answer];
      if (!choice) {
        error('Invalid choice. Please run the script again.');
      }
      
      resolve(choice);
    });
  });
}

function updateVersion(versionType) {
  if (versionType === 'skip') {
    info('Skipping version bump...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
  }

  info(`Bumping ${versionType} version...`);
  
  try {
    // Use npm version to bump package.json and create git tag
    const newVersion = execCommand(`npm version ${versionType} --no-git-tag-version`, true);
    const version = newVersion.replace('v', ''); // Remove 'v' prefix if present
    
    // Update manifest.json
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    manifest.version = version;
    fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
    
    success(`Version bumped to ${version}`);
    success(`Updated package.json and manifest.json`);
    
    return version;
  } catch (err) {
    error(`Failed to bump version: ${err.message}`);
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

function updateVersionsFile(version) {
  info('Updating versions.json...');
  
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const minAppVersion = manifest.minAppVersion;
  
  let versions = {};
  if (fs.existsSync('versions.json')) {
    versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
  }
  
  // Add current version with its minimum app version
  versions[version] = minAppVersion;
  
  // Write back to file with proper formatting
  fs.writeFileSync('versions.json', JSON.stringify(versions, null, 2));
  success(`Updated versions.json with ${version}: ${minAppVersion}`);
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
  const optionalFiles = ['styles.css', 'versions.json'];
  
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
      const command = `gh release create v${version} ${assetFiles.join(' ')} --title "v${version}" --generate-notes`;
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

async function main(directVersionType) {
  log('🚀 Starting release process...', 'blue');
  
  // Pre-flight checks
  checkGitHubCLI();
  await checkGitStatus();
  checkRemoteSync();
  // Ensure all work is committed prior to version bump
  commitAllPendingChanges();
  
  // Version management
  const versionType = directVersionType || await promptForVersionType();
  const version = updateVersion(versionType);
  
  // Build and validate
  buildPlugin();
  updateVersionsFile(version);
  const assetFiles = checkRequiredFiles();
  
  // Commit version changes
  if (versionType !== 'skip') {
    info('Committing version changes...');
    execCommand('git add package.json package-lock.json manifest.json versions.json');
    execCommand(`git commit -m "chore: bump version to ${version}"`);
    execCommand(`git tag v${version}`);
    // Push any pre-release commits and version bump together
    execCommand('git push origin main');
    execCommand('git push origin --tags');
    success('Version changes committed and tagged');
  }
  
  // Create release
  createGitHubRelease(version, assetFiles);
  
  log('🎉 Release process completed successfully!', 'green');
  log(`\nNext steps:`, 'blue');
  log(`• Visit the release page to add release notes if needed`);
  log(`• Share the release with your users`);
  log(`• Update any documentation that references the version`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const versionTypeArg = args.find(arg => ['patch', 'minor', 'major', 'skip'].includes(arg));

// Run the release process
if (versionTypeArg) {
  // Direct version type specified
  main(versionTypeArg);
} else {
  // Interactive mode
  main();
} 