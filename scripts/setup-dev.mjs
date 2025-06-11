import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const pluginName = 'vision-insights';

// 1. Get the destination path from the environment variable
const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
if (!vaultPath) {
  console.error(
    'Error: OBSIDIAN_VAULT_PATH is not defined. Please create a .env file and add the path to your Obsidian test vault.'
  );
  process.exit(1);
}

// 2. Define source and destination paths
const pluginBasePath = path.join(vaultPath, '.obsidian', 'plugins');
const destinationPath = path.join(pluginBasePath, pluginName);
const sourcePath = process.cwd();

// 3. Ensure the base plugins directory exists
if (!fs.existsSync(pluginBasePath)) {
  fs.mkdirSync(pluginBasePath, { recursive: true });
  console.log(`Created missing plugins directory at: ${pluginBasePath}`);
}

// 4. Remove any existing link or directory at the destination
if (fs.existsSync(destinationPath)) {
  console.log(`Removing existing item at: ${destinationPath}`);
  fs.rmSync(destinationPath, { recursive: true, force: true });
}

// 5. Create the symbolic link
try {
  fs.symlinkSync(sourcePath, destinationPath, 'dir');
  console.log(`✅ Attempted to create symlink.`);

  // 6. Verify the symlink was created successfully
  const stats = fs.lstatSync(destinationPath);
  if (stats.isSymbolicLink()) {
    console.log(`   ✅ Verification successful: Symlink exists at destination.`);
    console.log(`   Source: ${sourcePath}`);
    console.log(`   Destination: ${destinationPath}`);
  } else {
    throw new Error('Verification failed: An item exists at the destination, but it is not a symlink.');
  }
} catch (error) {
  console.error('❌ Error: Failed to create or verify the symbolic link.');
  console.error(error.message);
  console.error('\nPlease check for the following issues:');
  console.error('  1. Permissions issues with your vault folder, especially if it is in a cloud-synced directory (Google Drive, Dropbox, etc.).');
  console.error('  2. Whether your file system supports symbolic links.');
  process.exit(1);
}