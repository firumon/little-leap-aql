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
  const gasClaspPath = path.join(__dirname, '../GAS/.clasp.json');
  let originalGasClasp = null;
  if (fs.existsSync(gasClaspPath)) {
    originalGasClasp = fs.readFileSync(gasClaspPath, 'utf8');
  }

  try {
    console.log('Querying latest library versions from GAS (pointing to AqlCore)...');
    
    // Temporarily point GAS clasp to AqlCore standalone library ID to fetch its versions
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
        if (version > maxVersion) {
          maxVersion = version;
        }
      }
    });
    return maxVersion > 0 ? maxVersion : null;
  } catch (e) {
    console.error('Warning: Failed to get latest library version from clasp:', e.message);
    return null;
  } finally {
    // Restore original GAS clasp config
    if (originalGasClasp !== null) {
      fs.writeFileSync(gasClaspPath, originalGasClasp, 'utf8');
    } else if (fs.existsSync(gasClaspPath)) {
      fs.unlinkSync(gasClaspPath);
    }
  }
}

const latestVersion = getLatestLibraryVersion();
if (!latestVersion) {
  console.error('Error: Could not retrieve latest library version of AqlCore. Aborting update.');
  process.exit(1);
}

console.log(`Latest Master Library Version found: ${latestVersion}`);

if (fs.existsSync(manifestPath)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let updated = false;
    if (manifest.dependencies && manifest.dependencies.libraries) {
      manifest.dependencies.libraries.forEach(lib => {
        if (lib.userSymbol === 'AqlCore' || lib.libraryId === '1qTNMNpdGwfF3zr-53KqWtM5ibM2bblHiHBIIwB3aJtX3k-82jMLmIiPg') {
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
      console.log('Successfully updated TENANTS/appsscript.json manifest file.');
    } else {
      console.log('Manifest library version is already up-to-date.');
    }
  } catch (e) {
    console.error('Error updating appsscript.json manifest:', e.message);
    process.exit(1);
  }
} else {
  console.error(`Error: Manifest file not found at ${manifestPath}`);
  process.exit(1);
}

// Determine targets to push to
const targetsToPush = target ? [target] : Object.keys(registry.tenants || {});

if (targetsToPush.length === 0) {
  console.log('No tenants found in tenant_registry.json.');
  process.exit(0);
}

// Backup original TENANTS/.clasp.json config if exists
let originalTenantClasp = null;
if (fs.existsSync(claspPath)) {
  originalTenantClasp = fs.readFileSync(claspPath, 'utf8');
}

try {
  console.log(`Starting library version update for ${targetsToPush.length} tenant(s)...`);

  for (const t of targetsToPush) {
    const matchedKey = Object.keys(registry.tenants).find(k => k.toUpperCase() === t.toUpperCase());
    const scriptId = matchedKey ? registry.tenants[matchedKey] : null;
    
    if (!scriptId) {
      console.error(`\nError: Tenant "${t}" not found in tenant_registry.json`);
      continue;
    }

    console.log(`\n------------------------------------------------------------`);
    console.log(`Setting up clasp for tenant: ${matchedKey} (Script ID: ${scriptId})`);

    // Write temporary .clasp.json
    const claspConfig = {
      scriptId: scriptId,
      rootDir: '.'
    };
    fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + '\n', 'utf8');

    console.log(`Pushing updated manifest containing AqlCore v${latestVersion} to ${matchedKey}...`);
    try {
      execSync('npx clasp push -f', {
        cwd: path.join(__dirname, '../TENANTS'),
        stdio: 'inherit'
      });
      console.log(`Successfully pushed manifest to tenant ${matchedKey}!`);
      console.log(`Skipping deployment to avoid resetting web app access permissions.`);
    } catch (error) {
      console.error(`Failed to push manifest for tenant ${matchedKey}:`, error.message);
    }
  }
} finally {
  // Restore original clasp config for TENANTS
  if (originalTenantClasp !== null) {
    fs.writeFileSync(claspPath, originalTenantClasp, 'utf8');
    console.log('\nRestored original TENANTS/.clasp.json configuration.');
  } else if (fs.existsSync(claspPath)) {
    fs.unlinkSync(claspPath);
    console.log('\nRemoved temporary TENANTS/.clasp.json configuration.');
  }
}
