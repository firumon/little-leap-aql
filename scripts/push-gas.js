const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const claspPath = path.join(__dirname, '../GAS/.clasp.json');

const targets = [
  { name: 'AQL (Development App Bounded Script)', scriptId: '1sTCRkDJ--z23c0QrF3WuPr94EfktHYdohs_E0zVHpDAfwCW7N0vTL42n' },
  { name: 'AqlCore (Standalone Library)', scriptId: '1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg' }
];

// 1. Backup original .clasp.json
let originalClaspContent = null;
if (fs.existsSync(claspPath)) {
  originalClaspContent = fs.readFileSync(claspPath, 'utf8');
}

try {
  console.log(`Starting push sequence to ${targets.length} target project(s)...`);

  for (const target of targets) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Configuring clasp for: ${target.name}`);
    console.log(`Script ID: ${target.scriptId}`);

    const claspConfig = {
      scriptId: target.scriptId,
      rootDir: '.'
    };

    fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + '\n', 'utf8');

    console.log(`Pushing code to ${target.name}...`);
    execSync('npx clasp push --force', {
      cwd: path.join(__dirname, '../GAS'),
      stdio: 'inherit'
    });
    console.log(`Successfully pushed to ${target.name}!`);
  }

  console.log(`\n------------------------------------------------------------`);
  console.log('✅ Push sequence completed successfully!');
} catch (error) {
  console.error('\n❌ Push sequence failed:', error.message);
  process.exit(1);
} finally {
  // 2. Restore original .clasp.json
  if (originalClaspContent !== null) {
    fs.writeFileSync(claspPath, originalClaspContent, 'utf8');
    console.log('Restored original GAS/.clasp.json configuration.');
  } else {
    // If there was no original config, clean up
    if (fs.existsSync(claspPath)) {
      fs.unlinkSync(claspPath);
      console.log('Removed temporary GAS/.clasp.json configuration.');
    }
  }
}
