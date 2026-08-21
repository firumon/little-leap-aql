const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const registryPath = path.join(__dirname, '../TENANTS/tenant_registry.json');
const claspPath = path.join(__dirname, '../TENANTS/.clasp.json');
const manifestPath = path.join(__dirname, '../TENANTS/appsscript.json');
const envPath = path.join(__dirname, '../FRONTENT/.env');

// CLI arguments: e.g. "node scripts/tenant.js <push|update-libs|deploy> [TENANT_CODE]"
const args = process.argv.slice(2);
const command = (args[0] || 'push').toLowerCase();
const target = args[1] || null;

// 1. Helper to fetch live tenant registry from Master Web App
async function getTenantMap() {
  let masterUrl = null;
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_MASTER_GAS_URL=(https:\/\/script\.google\.com\/macros\/s\/[\w-]+(?:\/exec)?)/);
    if (match && match[1]) {
      masterUrl = match[1];
      if (!masterUrl.endsWith('/exec')) masterUrl += '/exec';
    }
  }

  if (masterUrl) {
    try {
      console.log(`Querying live tenants from Master Web App (${masterUrl})...`);
      const response = await fetch(masterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'getTenants' })
      });
      const data = await response.json();
      if (data && data.success && Array.isArray(data.tenants) && data.tenants.length > 0) {
        const liveMap = {};
        data.tenants.forEach(t => {
          if (t.code && t.projectId) {
            liveMap[t.code.toUpperCase()] = t.projectId;
          }
        });
        if (Object.keys(liveMap).length > 0) {
          console.log(`✅ Loaded ${Object.keys(liveMap).length} live tenant(s) from Master Web App:`, Object.keys(liveMap).join(', '));
          try {
            fs.writeFileSync(registryPath, JSON.stringify({ tenants: liveMap }, null, 2) + '\n', 'utf8');
          } catch (e) {}
          return liveMap;
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not reach Master Web App, falling back to local tenant_registry.json:', err.message);
    }
  }

  // Fallback to local registry JSON
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      return reg.tenants || {};
    } catch (e) {
      console.error('Error parsing local registry JSON:', e.message);
    }
  }
  return {};
}

// 2. Query latest library version of AqlCore from standalone library
function getLatestLibraryVersion() {
  const gasClaspPath = path.join(__dirname, '../GAS/.clasp.json');
  let originalGasClasp = null;
  if (fs.existsSync(gasClaspPath)) {
    originalGasClasp = fs.readFileSync(gasClaspPath, 'utf8');
  }

  try {
    console.log('Querying latest library versions from GAS (pointing to AqlCore)...');
    const tempClasp = {
      scriptId: '1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg',
      rootDir: '.'
    };
    fs.writeFileSync(gasClaspPath, JSON.stringify(tempClasp, null, 2) + '\n', 'utf8');

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
        if (version > maxVersion) maxVersion = version;
      }
    });
    return maxVersion > 0 ? maxVersion : null;
  } catch (e) {
    console.error('Warning: Failed to get latest library version from clasp:', e.message);
    return null;
  } finally {
    if (originalGasClasp !== null) {
      fs.writeFileSync(gasClaspPath, originalGasClasp, 'utf8');
    } else if (fs.existsSync(gasClaspPath)) {
      fs.unlinkSync(gasClaspPath);
    }
  }
}

// 3. Update TENANTS/appsscript.json with newest AqlCore library version
function updateManifestLibraryVersion(latestVersion) {
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Manifest file not found at ${manifestPath}`);
    return false;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let updated = false;
    if (manifest.dependencies && manifest.dependencies.libraries) {
      manifest.dependencies.libraries.forEach(lib => {
        if (lib.userSymbol === 'AqlCore' || lib.libraryId === '1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg' || lib.libraryId === '1gWyoy-tvOBR61iopJEo2FPpKIme1B8tw-P9IemDTAbCRG9YfbP1-KXxz') {
          const newLibId = '1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg';
          if (lib.libraryId !== newLibId) {
            console.log(`Updating AqlCore library ID in manifest from ${lib.libraryId} to ${newLibId}`);
            lib.libraryId = newLibId;
            updated = true;
          }
          if (lib.version !== String(latestVersion)) {
            console.log(`Updating AqlCore library version in manifest from ${lib.version} to ${latestVersion}`);
            lib.version = String(latestVersion);
            updated = true;
          }
          if (lib.developmentMode !== false) {
            console.log(`Setting AqlCore library developmentMode in manifest to false`);
            lib.developmentMode = false;
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
    return true;
  } catch (e) {
    console.error('Error updating appsscript.json manifest:', e.message);
    return false;
  }
}

// 4. Main task dispatcher
async function main() {
  console.log(`\n============================================================`);
  console.log(`AQL Tenant Manager | Task: [${command.toUpperCase()}]`);
  console.log(`============================================================`);

  if (command === 'update-libs') {
    const latestVersion = getLatestLibraryVersion();
    if (!latestVersion) {
      console.error('Error: Could not retrieve latest library version. Aborting.');
      process.exit(1);
    }
    console.log(`Latest Master Library Version found: ${latestVersion}`);
    updateManifestLibraryVersion(latestVersion);
  }

  // Load target tenants
  const tenantMap = await getTenantMap();
  const targetsToPush = target ? [target] : Object.keys(tenantMap);

  if (targetsToPush.length === 0) {
    console.log('No tenants found to process.');
    process.exit(0);
  }

  // Backup original clasp config
  let originalTenantClasp = null;
  if (fs.existsSync(claspPath)) {
    originalTenantClasp = fs.readFileSync(claspPath, 'utf8');
  }

  try {
    console.log(`Starting [${command.toUpperCase()}] for ${targetsToPush.length} tenant(s)...`);

    for (const t of targetsToPush) {
      const matchedKey = Object.keys(tenantMap).find(k => k.toUpperCase() === t.toUpperCase());
      const scriptId = matchedKey ? tenantMap[matchedKey] : null;

      if (!scriptId) {
        console.error(`\nError: Tenant "${t}" not found in tenant map.`);
        continue;
      }

      console.log(`\n------------------------------------------------------------`);
      console.log(`Setting up clasp for tenant: ${matchedKey} (Script ID: ${scriptId})`);

      const claspConfig = {
        scriptId: scriptId,
        rootDir: '.'
      };
      fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + '\n', 'utf8');

      // TASK 1: PUSH CODE (tenant.gs)
      if (command === 'push' || command === 'update-libs') {
        console.log(`Pushing files to tenant ${matchedKey}...`);
        try {
          execSync('npx clasp push -f', {
            cwd: path.join(__dirname, '../TENANTS'),
            stdio: 'inherit'
          });
          console.log(`✅ Successfully pushed to tenant ${matchedKey}!`);
        } catch (error) {
          console.error(`❌ Push failed for tenant ${matchedKey}:`, error.message);
        }
      }

      // TASK 2: DEPLOY WEB APP
      if (command === 'deploy') {
        console.log(`Deploying web app for tenant: ${matchedKey}...`);
        try {
          const deploymentsOutput = execSync('npx clasp deployments', {
            cwd: path.join(__dirname, '../TENANTS'),
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          const lines = deploymentsOutput.split('\n');
          let webappDeploymentId = null;
          lines.forEach(line => {
            const match = line.match(/^\s*-\s*([\w-]+)\s+@\d+\s+-\s+webapp/);
            if (match) webappDeploymentId = match[1];
          });

          let deployCmd = webappDeploymentId
            ? `npx clasp deploy --deploymentId ${webappDeploymentId} --description "Automated Deploy"`
            : `npx clasp deploy --description "Automated Deploy"`;

          const deployResult = execSync(deployCmd, {
            cwd: path.join(__dirname, '../TENANTS'),
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          console.log(deployResult);

          console.log(`✅ Successfully deployed tenant ${matchedKey}!`);
          console.log(`\n⚠️  CRITICAL ACTION REQUIRED for tenant ${matchedKey}:`);
          console.log(`Deployment via command line automatically resets the web app access permissions.`);
          console.log(`You MUST open the Apps Script online editor for tenant ${matchedKey} (Script ID: ${scriptId}),`);
          console.log(`click 'Deploy' > 'Manage deployments', edit the active webapp deployment, and`);
          console.log(`change 'Who has access' to 'Anyone', then click 'Deploy'.\n`);
        } catch (error) {
          console.error(`❌ Deploy failed for tenant ${matchedKey}:`, error.message);
        }
      }
    }
  } finally {
    if (originalTenantClasp !== null) {
      fs.writeFileSync(claspPath, originalTenantClasp, 'utf8');
      console.log('\nRestored original TENANTS/.clasp.json configuration.');
    } else if (fs.existsSync(claspPath)) {
      fs.unlinkSync(claspPath);
      console.log('\nRemoved temporary TENANTS/.clasp.json configuration.');
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
