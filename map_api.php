<?php
declare(strict_types=1);

// ===== Optional auth =====
// Leave empty for no authentication (default). If you set this, set the SAME
// value in index.html (const SERVER_API_TOKEN) so the app can write data.
$API_TOKEN = '';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Api-Token');

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawBody = file_get_contents('php://input');
$payload = [];
if ($rawBody !== false && trim($rawBody) !== '') {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $payload = $decoded;
    }
}

$entity = (string)($_GET['entity'] ?? $payload['entity'] ?? '');
$action = (string)($_GET['action'] ?? $payload['action'] ?? 'list');
$allowed = ['presets', 'projects'];
if (!in_array($entity, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid entity'], JSON_UNESCAPED_UNICODE);
    exit;
}

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'map_data';
if (!is_dir($dataDir) && !mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Cannot create data directory'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Block direct web access to the stored JSON files (Apache). The app only ever
// reads/writes them through this script, so they never need to be public.
$dataGuard = $dataDir . DIRECTORY_SEPARATOR . '.htaccess';
if (!file_exists($dataGuard)) {
    @file_put_contents($dataGuard, "Require all denied\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n");
}

$file = $dataDir . DIRECTORY_SEPARATOR . $entity . '.json';
if (!file_exists($file)) {
    file_put_contents($file, "[]\n", LOCK_EX);
}

function read_items(string $file): array {
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Cannot open storage file');
    }
    try {
        if (!flock($handle, LOCK_SH)) {
            throw new RuntimeException('Cannot lock storage file for reading');
        }
        $contents = stream_get_contents($handle);
        flock($handle, LOCK_UN);
        $items = json_decode($contents ?: '[]', true);
        return is_array($items) ? $items : [];
    } finally {
        fclose($handle);
    }
}

function write_items(string $file, array $items): void {
    $handle = fopen($file, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Cannot open storage file');
    }
    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Cannot lock storage file for writing');
        }
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode(array_values($items), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fwrite($handle, "\n");
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET' || $action === 'list') {
        $items = read_items($file);
        echo json_encode(['ok' => true, 'items' => array_values($items)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action !== 'replace') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Unsupported action'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Require the shared secret for write operations, if one is configured.
    if ($API_TOKEN !== '') {
        $provided = $_SERVER['HTTP_X_API_TOKEN'] ?? ($payload['token'] ?? '');
        if (!is_string($provided) || !hash_equals($API_TOKEN, $provided)) {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Unauthorized'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $items = $payload['items'] ?? null;
    if (!is_array($items)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Items must be an array'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $cleanItems = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        if (!isset($item['id']) || trim((string)$item['id']) === '') {
            $item['id'] = uniqid($entity . '_', true);
        }
        if (!isset($item['createdAt'])) {
            $item['createdAt'] = (int)round(microtime(true) * 1000);
        }
        $item['updatedAt'] = (int)round(microtime(true) * 1000);
        $cleanItems[] = $item;
    }

    write_items($file, $cleanItems);
    echo json_encode(['ok' => true, 'count' => count($cleanItems)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
