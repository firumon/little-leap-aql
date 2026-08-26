/**
 * ============================================================
 * AQL - Dynamic Session Proof
 * ============================================================
 * Every protected request carries { token, sessionKey }. The key is a rolling
 * value derived from the session UUID, so a stolen token alone is not enough.
 */

const SESSION_GEN_WINDOW = 2;

var _session_proof_memory = {};

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
  if (_session_proof_memory[token]) return _session_proof_memory[token];
  try {
    const raw = CacheService.getScriptCache().get(buildSessionProofCacheKey(token));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.generation === 'number') {
        _session_proof_memory[token] = parsed;
        return parsed;
      }
    }
  } catch (e) { /* degrade to a fresh state */ }
  return null;
}

function writeSessionProofState(token, state) {
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
  if (!state) {
    state = { uuid_code: expectedUuidCode, generation: clientGen - 1 };
  }

  const stored = state.generation;
  if (clientGen < stored - SESSION_GEN_WINDOW || clientGen > stored + SESSION_GEN_WINDOW) {
    return { ok: false, message: 'Invalid session proof' };
  }

  state.uuid_code = expectedUuidCode;
  state.generation = Math.max(stored, clientGen);
  writeSessionProofState(token, state);

  return { ok: true, generation: clientGen };
}
