import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { execSync } from 'child_process';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;

console.log(`Starting release for version ${version}...`);

// Check if tag already exists
try {
    execSync(`git rev-parse v${version}`);
    console.log(`Tag v${version} already exists. Aborting.`);
    process.exit(1);
} catch (error) {
    // Tag does not exist, continue
}

console.log('Building plugin...');
execSync('npm run build');

const outputDir = 'build';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const zipPath = path.join(outputDir, `obsidian-vision-insights-${version}.zip`);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
    zlib: { level: 9 }
});

output.on('close', function() {
  console.log(`Successfully created ${zipPath} (${archive.pointer()} total bytes)`);
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

archive.file('main.js', { name: 'main.js' });
archive.file('manifest.json', { name: 'manifest.json' });
if (fs.existsSync('styles.css')) {
    archive.file('styles.css', { name: 'styles.css' });
}

archive.finalize();

console.log('Creating git tag...');
execSync(`git tag v${version}`);
console.log(`Tag v${version} created.`);
console.log('Push the tag to GitHub with: git push --tags'); 