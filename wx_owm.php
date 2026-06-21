<?php
// OpenWeatherMap raster-tile proxy.
// The API key stays on the SERVER and is never sent to the browser.
// Usage: wx_owm.php?layer=temp_new&z=5&x=16&y=10
//
// IMPORTANT: keep $OWM_KEY empty ('') in the public GitHub copy. The real key
// belongs only on the live server (FTP).

$OWM_KEY = '';

// 1x1 transparent PNG — returned when not configured or on any error, so the map stays clean.
$blank = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC');

function send_png($bytes, $maxage) {
    header('Content-Type: image/png');
    header('Cache-Control: public, max-age=' . $maxage);
    header('Access-Control-Allow-Origin: *');
    echo $bytes;
    exit;
}

$allowed = array('temp_new', 'precipitation_new', 'clouds_new', 'pressure_new', 'wind_new');
$layer = isset($_GET['layer']) ? (string)$_GET['layer'] : '';
$z = isset($_GET['z']) ? (int)$_GET['z'] : -1;
$x = isset($_GET['x']) ? (int)$_GET['x'] : -1;
$y = isset($_GET['y']) ? (int)$_GET['y'] : -1;

if ($OWM_KEY === '' || !in_array($layer, $allowed, true) || $z < 0 || $z > 22 || $x < 0 || $y < 0) {
    send_png($blank, 300);
}

$url = 'https://tile.openweathermap.org/map/' . $layer . '/' . $z . '/' . $x . '/' . $y . '.png?appid=' . $OWM_KEY;

$data = false;
$code = 0;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'PZMAP-wx-proxy');
    $data = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($data === false || $code >= 400) { $data = false; }
}
if ($data === false && ini_get('allow_url_fopen')) {
    $ctx = stream_context_create(array('http' => array('timeout' => 12, 'user_agent' => 'PZMAP-wx-proxy', 'ignore_errors' => true)));
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw !== false && strlen($raw) >= 8 && substr($raw, 0, 1) !== '{') { $data = $raw; }
}

if ($data === false || strlen($data) < 8) {
    send_png($blank, 60);
}

send_png($data, 600);
