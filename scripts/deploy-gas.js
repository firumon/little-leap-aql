const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Deploying Google Apps Script...');

const description = process.argv[2] || 'Automatic deployment';
const envPath = path.join(__dirname, '..', 'FRONTENT', '.env');

// 1. Try to find existing deployment ID from .env to update it
let existingDeploymentId = null;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/VITE_GAS_URL=https:\/\/script\.google\.com\/macros\/s\/([\w-]+)\/exec/);
  if (match && match[1]) {
    existingDeploymentId = match[1];
    console.log(`Updating existing deployment: ${existingDeploymentId}`);
  }
}

try {
  // 2. Run deploy (update if ID exists, otherwise create new)
  const deployCmd = existingDeploymentId 
    ? `npx clasp deploy --deploymentId ${existingDeploymentId} --description "${description}"`
    : `npx clasp deploy --description "${description}"`;

  const result = execSync(deployCmd, { 
    cwd: path.join(__dirname, '..', 'GAS'), 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'] 
  });
  console.log(result);

  // 3. Extract ID (works for both new and updated)
  const match = result.match(/Deployed ([\w-]+) @/);
  if (!match || !match[1]) {
    console.error('Failed to extract Deployment ID from clasp output.');
    process.exit(1);
  }

  const deploymentId = match[1];
  const webAppUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;
  console.log(`\nWeb App URL: ${webAppUrl}`);

  // 4. Update .env
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const envVarName = 'VITE_GAS_URL';
  const newEnvLine = `${envVarName}=${webAppUrl}`;

  if (envContent.includes(envVarName)) {
    envContent = envContent.replace(new RegExp(`${envVarName}=.*`), newEnvLine);
  } else {
    envContent += (envContent && !envContent.endsWith('\n') ? '\n' : '') + newEnvLine + '\n';
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ FRONTENT/.env updated successfully.');
} catch (error) {
  console.error('Deployment failed:', error.stderr || error.message);
  process.exit(1);
}
