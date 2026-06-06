<?php
/**
 * ============================================================
 * AQL - Unified File Storage Service Script
 * ============================================================
 * Exposes actions: upload, confirm, delete, meta, download, register
 * Handles dynamic directory structure, temp upload, registry tracking, 
 * cleanups, and stateless domain-based token generation and validation.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Authorization, Content-Type");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configurable constants
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('TEMP_DIR', __DIR__ . '/_temp/');
define('REGISTRY_FILE', __DIR__ . '/temp_registry');

// Secret signing key for domain-based token generation.
// Change this to a secure random string for production deployments.
define('SECRET_SIGNING_KEY', 'aql_default_secure_signing_key_change_me');

// Helper: Clean and extract domain name (host) from any string/URL
function cleanDomain($domain) {
    $domain = strtolower(trim($domain));
    if (!$domain) return null;
    // If it doesn't have a protocol, prepend one so parse_url can extract host correctly
    if (strpos($domain, 'http://') !== 0 && strpos($domain, 'https://') !== 0) {
        $domain = 'http://' . $domain;
    }
    $parsedHost = parse_url($domain, PHP_URL_HOST);
    return $parsedHost ? $parsedHost : null;
}

// Helper: Extract requesting domain from headers or params
function getRequestingDomain() {
    // 1. Try Origin header (sent automatically by browser for CORS requests)
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $domain = cleanDomain($_SERVER['HTTP_ORIGIN']);
        if ($domain) return $domain;
    }
    // 2. Try Referer header
    if (isset($_SERVER['HTTP_REFERER'])) {
        $domain = cleanDomain($_SERVER['HTTP_REFERER']);
        if ($domain) return $domain;
    }
    // 3. Try query parameter (useful for direct download links pasted in browser)
    if (isset($_GET['domain'])) {
        return cleanDomain($_GET['domain']);
    }
    // 4. Try input JSON body for POST requests
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['domain'])) {
        return cleanDomain($input['domain']);
    }
    return null;
}

// Helper: Sanitize string to prevent directory traversal
function sanitize($str) {
    $str = str_replace(array('../', '..\\'), '', $str);
    return preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $str);
}

// Helper: Recursively delete a directory
function deleteDirectory($dir) {
    if (!file_exists($dir)) return true;
    if (!is_dir($dir)) return unlink($dir);
    foreach (scandir($dir) as $item) {
        if ($item == '.' || $item == '..') continue;
        if (!deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) return false;
    }
    return rmdir($dir);
}

// Helper: Recursively move a directory
function moveDirectory($src, $dst) {
    if (is_dir($src)) {
        if (!file_exists($dst)) {
            mkdir($dst, 0755, true);
        }
        $files = scandir($src);
        foreach ($files as $file) {
            if ($file != "." && $file != "..") {
                moveDirectory("$src/$file", "$dst/$file");
            }
        }
        rmdir($src);
    } else if (file_exists($src)) {
        rename($src, $dst);
    }
}

// Helper: Explicitly remove a UUID from the temp registry file
function removeUuidFromRegistry($uuidToSearch) {
    if (!file_exists(REGISTRY_FILE)) return;

    $lines = file(REGISTRY_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $newLines = [];
    $changed = false;

    foreach ($lines as $line) {
        $parts = explode("\t", $line);
        if (count($parts) < 2) continue;
        $uuid = $parts[1];

        if ($uuid === $uuidToSearch) {
            $changed = true;
            continue;
        }
        $newLines[] = $line;
    }

    if ($changed) {
        if (empty($newLines)) {
            if (file_exists(REGISTRY_FILE)) {
                unlink(REGISTRY_FILE);
            }
        } else {
            file_put_contents(REGISTRY_FILE, implode("\n", $newLines) . "\n", LOCK_EX);
        }
    }
}

// Helper: Perform cleanup of temp registry records older than 1 hour
function cleanUpExpiredTempFiles() {
    if (!file_exists(REGISTRY_FILE)) return;

    $lines = file(REGISTRY_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $newLines = [];
    $now = time();
    $changed = false;

    foreach ($lines as $line) {
        $parts = explode("\t", $line);
        if (count($parts) < 4) continue;
        list($timestamp, $uuid, $resource, $column) = $parts;

        $timestamp = (int)$timestamp;

        // If older than 1 hour (3600 seconds), delete the temp directory
        if ($now - $timestamp > 3600) {
            $resource = sanitize($resource);
            $column = sanitize($column);
            $uuid = sanitize($uuid);
            $tempFolder = TEMP_DIR . $resource . '/' . $column . '/' . $uuid;
            deleteDirectory($tempFolder);
            $changed = true;
        } else {
            $newLines[] = $line;
        }
    }

    if ($changed) {
        if (empty($newLines)) {
            if (file_exists(REGISTRY_FILE)) {
                unlink(REGISTRY_FILE);
            }
        } else {
            file_put_contents(REGISTRY_FILE, implode("\n", $newLines) . "\n", LOCK_EX);
        }
    }
}

// ────────────────────────────────────────────────────────────
// ACTION ROUTER
// ────────────────────────────────────────────────────────────

$action = isset($_GET['action']) ? $_GET['action'] : '';

// 1. REGISTER DOMAIN (GET TEXT TOKEN DIRECTLY VIA WEB)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'register') {
    $domainInput = isset($_GET['domain']) ? $_GET['domain'] : '';
    $domain = cleanDomain($domainInput);
    if (!$domain) {
        http_response_code(400);
        header("Content-Type: text/plain");
        echo "Error: Missing or invalid 'domain' parameter (e.g. index.php?action=register&domain=tenant-domain.com)";
        exit;
    }
    
    // Generate stateless token based on domain
    $token = hash_hmac('sha256', $domain, SECRET_SIGNING_KEY);
    
    header("Content-Type: text/plain");
    echo $token;
    exit;
}

// Fetch Storage Configuration token from Authorization Header
$headers = apache_request_headers();
$authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
if (isset($headers['authorization'])) {
    $authHeader = $headers['authorization'];
}

// Extract Bearer token
$token = '';
if (strpos($authHeader, 'Bearer ') === 0) {
    $token = substr($authHeader, 7);
}

// Alternate lookup: check query param token (for download requests)
if (!$token && isset($_GET['token'])) {
    $token = trim($_GET['token']);
}

// Extract requesting domain to validate token
$requestingDomain = getRequestingDomain();

if (!$requestingDomain) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Missing requesting domain context. Ensure CORS or referer headers are active, or pass 'domain' parameter."]);
    exit;
}

// Verify provided token against expected domain token
$expectedToken = hash_hmac('sha256', $requestingDomain, SECRET_SIGNING_KEY);

if (!$token || $token !== $expectedToken) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Unauthorized. Invalid token for the requesting domain: " . $requestingDomain]);
    exit;
}

// ────────────────────────────────────────────────────────────
// STORAGE OPERATIONS (AUTHORIZED)
// ────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];

// A. UPLOAD FILE (TEMP STORE)
if ($method === 'POST' && $action === 'upload') {
    if (!isset($_FILES['file']) || !isset($_POST['resource']) || !isset($_POST['column'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing parameters"]);
        exit;
    }

    $resource = sanitize($_POST['resource']);
    $column = sanitize($_POST['column']);
    $uuid = vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex(random_bytes(16)), 4));

    $originalName = $_FILES['file']['name'];
    $ext = pathinfo($originalName, PATHINFO_EXTENSION);
    
    // Construct temp folder path
    $tempFolder = TEMP_DIR . $resource . '/' . $column . '/' . $uuid . '/';
    if (!file_exists($tempFolder)) {
        mkdir($tempFolder, 0755, true);
    }

    $fileName = 'file.' . $ext;
    $targetFile = $tempFolder . $fileName;

    if (move_uploaded_file($_FILES['file']['tmp_name'], $targetFile)) {
        // Build metadata JSON
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
        // Append token and domain parameters to allow direct download links
        $downloadUrl = $protocol . "://" . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'] . "?action=download&resource=" . urlencode($resource) . "&column=" . urlencode($column) . "&uuid=" . urlencode($uuid) . "&domain=" . urlencode($requestingDomain) . "&token=" . urlencode($expectedToken);

        $metadata = [
            "uuid" => $uuid,
            "fileName" => $originalName,
            "contentType" => $_FILES['file']['type'],
            "size" => $_FILES['file']['size'],
            "uploadedAt" => date('Y-m-d\TH:i:s\Z'),
            "downloadUrl" => $downloadUrl
        ];

        // Save metadata file in the same directory
        file_put_contents($tempFolder . 'meta.json', json_encode($metadata));

        // Add to temp registry log
        $registryLine = time() . "\t" . $uuid . "\t" . $resource . "\t" . $column . "\n";
        file_put_contents(REGISTRY_FILE, $registryLine, FILE_APPEND | LOCK_EX);

        echo json_encode(["success" => true, "metadata" => $metadata]);
        exit;
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to save temp file"]);
        exit;
    }
}

// B. CONFIRM FILE (MOVE TEMP TO PERMANENT)
if ($method === 'POST' && $action === 'confirm') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['uuid']) || !isset($input['resource']) || !isset($input['column'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing parameters"]);
        exit;
    }

    $uuid = sanitize($input['uuid']);
    $resource = sanitize($input['resource']);
    $column = sanitize($input['column']);

    $srcFolder = TEMP_DIR . $resource . '/' . $column . '/' . $uuid;
    $dstFolder = UPLOAD_DIR . $resource . '/' . $column . '/' . $uuid;

    if (file_exists($srcFolder) && is_dir($srcFolder)) {
        // Move directory contents
        if (!file_exists(dirname($dstFolder))) {
            mkdir(dirname($dstFolder), 0755, true);
        }
        
        moveDirectory($srcFolder, $dstFolder);

        // Update temp registry and trigger cleanup on-demand
        removeUuidFromRegistry($uuid);
        cleanUpExpiredTempFiles();

        echo json_encode(["success" => true]);
        exit;
    } else {
        // If it's already in the destination folder, treat it as confirmed
        if (file_exists($dstFolder) && is_dir($dstFolder)) {
            removeUuidFromRegistry($uuid);
            echo json_encode(["success" => true, "message" => "Already confirmed"]);
            exit;
        }
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Temp file folder not found"]);
        exit;
    }
}

// C. DELETE FILE
if ($method === 'POST' && $action === 'delete') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['uuid']) || !isset($input['resource']) || !isset($input['column'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing parameters"]);
        exit;
    }

    $uuid = sanitize($input['uuid']);
    $resource = sanitize($input['resource']);
    $column = sanitize($input['column']);

    $dstFolder = UPLOAD_DIR . $resource . '/' . $column . '/' . $uuid;
    $tempFolder = TEMP_DIR . $resource . '/' . $column . '/' . $uuid;

    $deleted = false;
    if (file_exists($dstFolder) && is_dir($dstFolder)) {
        deleteDirectory($dstFolder);
        $deleted = true;
    }
    
    // Also remove from temp if it exists there
    if (file_exists($tempFolder) && is_dir($tempFolder)) {
        deleteDirectory($tempFolder);
        $deleted = true;
    }

    // Always clean up registry on delete request
    removeUuidFromRegistry($uuid);
    cleanUpExpiredTempFiles();

    echo json_encode(["success" => true, "message" => $deleted ? "Deleted" : "Already deleted"]);
    exit;
}

// D. GET METADATA
if ($method === 'GET' && $action === 'meta') {
    if (!isset($_GET['uuid']) || !isset($_GET['resource']) || !isset($_GET['column'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing parameters"]);
        exit;
    }

    $uuid = sanitize($_GET['uuid']);
    $resource = sanitize($_GET['resource']);
    $column = sanitize($_GET['column']);

    $metaFile = UPLOAD_DIR . $resource . '/' . $column . '/' . $uuid . '/meta.json';
    
    // Try temp as fallback if not confirmed yet (for previews)
    if (!file_exists($metaFile)) {
        $metaFile = TEMP_DIR . $resource . '/' . $column . '/' . $uuid . '/meta.json';
    }

    if (file_exists($metaFile)) {
        echo file_get_contents($metaFile);
        exit;
    } else {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Metadata not found"]);
        exit;
    }
}

// E. DOWNLOAD / STREAM FILE
if ($method === 'GET' && $action === 'download') {
    if (!isset($_GET['uuid']) || !isset($_GET['resource']) || !isset($_GET['column'])) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing parameters"]);
        exit;
    }

    $uuid = sanitize($_GET['uuid']);
    $resource = sanitize($_GET['resource']);
    $column = sanitize($_GET['column']);

    $folder = UPLOAD_DIR . $resource . '/' . $column . '/' . $uuid . '/';
    if (!file_exists($folder)) {
        $folder = TEMP_DIR . $resource . '/' . $column . '/' . $uuid . '/';
    }

    $metaFile = $folder . 'meta.json';

    if (file_exists($metaFile)) {
        $metadata = json_decode(file_get_contents($metaFile), true);
        $fileName = $metadata['fileName'];
        $contentType = $metadata['contentType'];

        // Find the actual file (starts with "file.")
        $files = scandir($folder);
        $actualFile = '';
        foreach ($files as $file) {
            if (strpos($file, 'file.') === 0) {
                $actualFile = $folder . $file;
                break;
            }
        }

        if ($actualFile && file_exists($actualFile)) {
            header('Content-Description: File Transfer');
            header('Content-Type: ' . $contentType);
            header('Content-Disposition: attachment; filename="' . $fileName . '"');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($actualFile));
            readfile($actualFile);
            exit;
        }
    }

    http_response_code(404);
    echo json_encode(["success" => false, "error" => "File not found"]);
    exit;
}

http_response_code(400);
echo json_encode(["success" => false, "error" => "Invalid request action"]);
