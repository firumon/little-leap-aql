const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const registryPath = path.join(__dirname, '../TENANTS/tenant_registry.json');
const claspPath = path.join(__dirname, '../TENANTS/.clasp.json');
const manifestPath = path.join(__dirname, '../TENANTS/appsscript.json');

const target = process.argv[2];

if (!fs.existsSync(registryPath)) {
  console.error(`Error: Registry file not found at ${registryPath}`);
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
} catch (e) {
  console.error('Error parsing registry JSON:', e.message);
  process.exit(1);
}

// 1. Get latest library version of AqlCore from GAS project
function getLatestLibraryVersion() {
  try {
    console.log('Querying latest library versions from GAS...');
    const output = execSync('npx clasp versions', {
      cwd: path.join(__dirname, '../GAS'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const lines = output.split('\n');
    let maxVersion = 0;
    lines.forEach(line => {
      const match = line.match(/^\s*(\d+)\s*-/);
      if (match) {
        const version = parseInt(match[1], 10);
        if (version > maxVersion) {
          maxVersion = version;
        }
      }
    });
    return maxVersion > 0 ? maxVersion : null;
  } catch (e) {
    console.error('Warning: Failed to get latest library version from clasp:', e.message);
    return null;
  }
}

const latestVersion = getLatestLibraryVersion();
if (latestVersion) {
  console.log(`Latest Master Library Version found: ${latestVersion}`);
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let updated = false;
      if (manifest.dependencies && manifest.dependencies.libraries) {
        manifest.dependencies.libraries.forEach(lib => {
          if (lib.userSymbol === 'AqlCore' || lib.libraryId === '1gWyoy-tvOBR61iopJEo2FPpKIme1B8tw-P9IemDTAbCRG9YfbP1-KXxz') {
            if (lib.version !== String(latestVersion)) {
              console.log(`Updating AqlCore library version in manifest from ${lib.version} to ${latestVersion}`);
              lib.version = String(latestVersion);
              updated = true;
            }
          }
        });
      }
      if (updated) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        console.log('Successfully updated TENANTS/appsscript.json manifest.');
      } else {
        console.log('Manifest library version is already up-to-date.');
      }
    } catch (e) {
      console.error('Error updating appsscript.json manifest:', e.message);
    }
  }
} else {
  console.log('Could not retrieve latest library version. Skipping manifest version update.');
}

// Determine targets to push to
const targetsToPush = target ? [target] : Object.keys(registry.tenants || {});

if (targetsToPush.length === 0) {
  console.log('No tenants found in tenant_registry.json.');
  process.exit(0);
}

console.log(`Starting push sequence for ${targetsToPush.length} target(s)...`);

for (const t of targetsToPush) {
  const scriptId = registry.tenants[t.toUpperCase()] || registry.tenants[t];
  
  if (!scriptId) {
    console.error(`\nError: Tenant "${t}" not found in tenant_registry.json`);
    continue;
  }

  console.log(`\n------------------------------------------------------------`);
  console.log(`Setting up clasp for tenant: ${t} (Script ID: ${scriptId})`);

  // Write temporary .clasp.json
  const claspConfig = {
    scriptId: scriptId,
    rootDir: '.'
  };

  fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + '\n', 'utf8');

  console.log(`Pushing template code to Apps Script for tenant: ${t}...`);
  try {
    execSync('npx clasp push -f', {
      cwd: path.join(__dirname, '../TENANTS'),
      stdio: 'inherit'
    });
    console.log(`Successfully pushed to tenant ${t}!`);

    // Automate Web App deployment
    console.log(`Deploying web app for tenant: ${t}...`);
    const deploymentsOutput = execSync('npx clasp deployments', {
      cwd: path.join(__dirname, '../TENANTS'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const lines = deploymentsOutput.split('\n');
    let webappDeploymentId = null;
    lines.forEach(line => {
      const match = line.match(/^\s*-\s*([\w-]+)\s+@\d+\s+-\s+webapp/);
      if (match) {
        webappDeploymentId = match[1];
      }
    });

    let deployCmd;
    if (webappDeploymentId) {
      console.log(`Updating existing webapp deployment: ${webappDeploymentId}`);
      deployCmd = `npx clasp deploy --deploymentId ${webappDeploymentId} --description "Automated Deploy"`;
    } else {
      console.log(`Creating new webapp deployment...`);
      deployCmd = `npx clasp deploy --description "Automated Deploy"`;
    }

    const deployResult = execSync(deployCmd, {
      cwd: path.join(__dirname, '../TENANTS'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(deployResult);

    console.log(`Successfully deployed tenant ${t}!`);
    console.log(`\n⚠️  CRITICAL ACTION REQUIRED for tenant ${t}:`);
    console.log(`Deployment via command line automatically resets the web app access permissions.`);
    console.log(`You MUST open the Apps Script online editor for tenant ${t} (Script ID: ${scriptId}),`);
    console.log(`click 'Deploy' > 'Manage deployments', edit the active webapp deployment, and`);
    console.log(`change 'Who has access' to 'Anyone', then click 'Deploy'.\n`);

  } catch (error) {
    console.error(`Failed to push/deploy for tenant ${t}:`, error.message);
  }
}
