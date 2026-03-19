const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Deploying Google Apps Script...');

try {
  // We use shell:true on Windows specifically to allow npx and path resolution natively
  const result = execSync('npx clasp deploy', { 
    cwd: path.join(__dirname, '..', 'GAS'), 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'] 
  });
  console.log(result);

  const match = result.match(/Deployed ([\w-]+) @/);
  if (!match || !match[1]) {
    console.error('Failed to extract Deployment ID from clasp output. Make sure clasp is authenticated and the web app is configured.');
    process.exit(1);
  }

  const deploymentId = match[1];
  const webAppUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;
  console.log(`\nNew Web App URL: ${webAppUrl}`);

  const envPath = path.join(__dirname, '..', 'FRONTENT', '.env');
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
