const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Deploying Google Apps Script (MASTER)...');

const description = process.argv[2] || 'Automated Master Update';
const masterDir = path.join(__dirname, '..', 'MASTER');
const envPath = path.join(__dirname, '..', 'FRONTENT', '.env');

// 1. Try to find existing master deployment ID from .env
let deploymentId = null;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/VITE_MASTER_GAS_URL=https:\/\/script\.google\.com\/macros\/s\/([\w-]+)\/exec/);
  if (match && match[1]) {
    deploymentId = match[1];
    console.log(`Updating existing Master deployment: ${deploymentId}`);
  }
}

if (!deploymentId) {
  console.error('Error: VITE_MASTER_GAS_URL was not found in FRONTENT/.env.');
  process.exit(1);
}

try {
  // 2. Push changes
  console.log('Pushing code to Master project...');
  execSync('npx clasp push --force', { cwd: masterDir, stdio: 'inherit' });

  // 3. Deploy to the specific deployment ID
  console.log(`Updating Master deployment: ${deploymentId}...`);
  const deployCmd = `npx clasp deploy --deploymentId ${deploymentId} --description "${description}"`;
  const result = execSync(deployCmd, { cwd: masterDir, encoding: 'utf8' });
  
  console.log(result);
  console.log('✅ MASTER deployment updated successfully.');
} catch (error) {
  console.error('MASTER deployment failed:', error.message);
  process.exit(1);
}
