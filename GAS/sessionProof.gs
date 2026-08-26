/**
 * ============================================================
 * AQL - Dynamic Session Proof
 * ============================================================
 * Every protected request carries { token, sessionKey }. The key is a rolling
 * value derived from the session UUID, so a stolen token alone is not enough.
 */

const SESSION_GEN_WINDOW = 2;

var _session_proof_memory = {};
var _session_auth_version = null;

function buildSessionAuthVersionKey() {
  return 'AQL_SESSION_AUTHVER_' + getAppSpreadsheet().getId();
}

// Cached auth would otherwise survive an admin changing a user's roles,
// region, or status. Every session state is stamped with this version.
function getSessionAuthVersion() {
  if (_session_auth_version) return _session_auth_version;

  const key = buildSessionAuthVersionKey();
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (cached) {
      _session_auth_version = cached;
      return cached;
    }
  } catch (e) { /* fall through */ }

  let value = '1';
  try {
    value = PropertiesService.getScriptProperties().getProperty(key) || '1';
  } catch (e) { /* keep the default */ }

  try {
    CacheService.getScriptCache().put(key, value, CACHE_TTL_SEC);
  } catch (e) { /* non-fatal */ }

  _session_auth_version = value;
  return value;
}

function bumpSessionAuthVersion() {
  const key = buildSessionAuthVersionKey();
  const next = String(Date.now());
  _session_auth_version = next;
  _session_proof_memory = {};
  try {
    PropertiesService.getScriptProperties().setProperty(key, next);
  } catch (e) { /* non-fatal */ }
  try {
    CacheService.getScriptCache().put(key, next, CACHE_TTL_SEC);
  } catch (e) { /* non-fatal */ }
}

function buildSessionProofCacheKey(token) {
  return 'AQL_SESSION_' + getAppSpreadsheet().getId() + '_' + token;
}

function deriveSessionParams(token) {
  const parts = (token || '').toString().trim().split('-');
  if (parts.length < 4) return null;

  const genPrime = parseInt(parts[0], 16);
  const letterShift = parseInt(parts[1], 16);
  const digitShift = parseInt(parts[2], 16);
  const genOffset = parseInt(parts[3], 16);

  if (!isFinite(genPrime) || !isFinite(letterShift) || !isFinite(digitShift) || !isFinite(genOffset)) {
    return null;
  }
  if (genPrime <= 0) return null;

  return {
    genPrime: genPrime,
    letterShift: letterShift,
    digitShift: digitShift,
    genOffset: genOffset
  };
}

function deriveSessionCode(token, letterShift, digitShift) {
  const hex = (token || '').toString().replace(/-/g, '').toUpperCase();
  const reversed = hex.split('').reverse().join('');
  let code = '';
  for (let i = 0; i < reversed.length; i++) {
    const char = reversed.charAt(i);
    if (char >= '0' && char <= '9') {
      code += String((Number(char) + digitShift) % 10);
    } else {
      code += String(char.charCodeAt(0) + letterShift);
    }
  }
  return code;
}

function decodeSessionGeneration(sessionKey, uuidCode, params) {
  let key;
  try {
    key = BigInt((sessionKey || '').toString().trim());
  } catch (e) {
    return -1;
  }

  // The Apps Script uploader rejects BigInt literals like 0n, so build zero.
  const zero = BigInt(0);

  const diff = key - BigInt(uuidCode);
  if (diff < zero) return -1;

  const val = diff - BigInt(params.genOffset);
  if (val < zero) return -1;
  if (val % BigInt(params.genPrime) !== zero) return -1;

  return Number(val / BigInt(params.genPrime));
}

function readSessionProofState(token) {
  const version = getSessionAuthVersion();

  const inMemory = _session_proof_memory[token];
  if (inMemory) {
    return inMemory.v === version ? inMemory : null;
  }

  try {
    const raw = CacheService.getScriptCache().get(buildSessionProofCacheKey(token));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.generation === 'number' && parsed.v === version) {
        _session_proof_memory[token] = parsed;
        return parsed;
      }
    }
  } catch (e) { /* degrade to a fresh state */ }
  return null;
}

function writeSessionProofState(token, state) {
  state.v = getSessionAuthVersion();
  _session_proof_memory[token] = state;
  try {
    CacheService.getScriptCache().put(buildSessionProofCacheKey(token), JSON.stringify(state), CACHE_TTL_SEC);
  } catch (e) { /* non-fatal */ }
}

function clearSessionProofState(token) {
  delete _session_proof_memory[token];
  try {
    CacheService.getScriptCache().remove(buildSessionProofCacheKey(token));
  } catch (e) { /* non-fatal */ }
}

/**
 * Returns { ok: true, generation } or { ok: false, message }.
 * A cache miss is a cold start, not a failure: the first generation seen wins.
 */
function verifySessionProof(token, sessionKey) {
  const params = deriveSessionParams(token);
  if (!params) {
    return { ok: false, message: 'Invalid session proof' };
  }
  if (!sessionKey) {
    return { ok: false, message: 'Invalid session proof' };
  }

  const expectedUuidCode = deriveSessionCode(token, params.letterShift, params.digitShift);
  const clientGen = decodeSessionGeneration(sessionKey, expectedUuidCode, params);
  if (clientGen < 0) {
    return { ok: false, message: 'Invalid session proof' };
  }

  let state = readSessionProofState(token);
  if (!state || !state.user) {
    const authContext = resolveUserAuthFromSheet(token);
    if (!authContext) {
      return { ok: false, message: 'Unauthorized' };
    }
    state = {
      uuid_code: expectedUuidCode,
      generation: clientGen - 1,
      user: authContext.user,
      roleIds: authContext.roleIds,
      accessRegionScope: authContext.accessRegionScope,
      rowNumber: authContext.rowNumber
    };
  }

  const stored = state.generation;
  if (clientGen < stored - SESSION_GEN_WINDOW || clientGen > stored + SESSION_GEN_WINDOW) {
    return { ok: false, message: 'Invalid session proof' };
  }

  state.uuid_code = expectedUuidCode;
  state.generation = Math.max(stored, clientGen);
  writeSessionProofState(token, state);

  return {
    ok: true,
    generation: clientGen,
    auth: {
      rowNumber: state.rowNumber,
      user: state.user,
      roleIds: state.roleIds,
      accessRegionScope: state.accessRegionScope,
      sessionGeneration: clientGen
    }
  };
}

const SESSION_AUTH_LEVEL_KEYS = {
  roleIds: true,
  accessRegionScope: true,
  rowNumber: true
};

/**
 * Patches the live session so a profile edit is visible on the very next
 * request. Unknown keys are treated as user-row columns.
 */
function updateSessionAuth(token, patch) {
  if (!token || !patch) return null;

  const state = readSessionProofState(token);
  if (!state || !state.user) return null;

  let regionChanged = false;
  Object.keys(patch).forEach(function (key) {
    if (SESSION_AUTH_LEVEL_KEYS[key]) {
      state[key] = patch[key];
      return;
    }
    state.user[key] = patch[key];
    if (key === 'AccessRegion') regionChanged = true;
    if (key === 'Roles') state.roleIds = resolveUserRoleIds(state.user);
  });

  if (regionChanged) {
    state.accessRegionScope = buildUserAccessRegionScope(state.user);
  }

  delete state.user.PasswordHash;
  writeSessionProofState(token, state);
  return state;
}
