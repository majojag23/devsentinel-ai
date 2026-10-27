<?php
// Reverse proxy hacia DevSentinel AI (Next.js, puerto local 8810).
// Reenvía método, cuerpo JSON, Cookie / Set-Cookie y Location (OAuth y login).
$BACKEND = "http://127.0.0.1:8810";
if (strpos($_SERVER["REQUEST_URI"], "/_next/static/") !== 0) header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
$uri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];
$ch = curl_init($BACKEND . $uri);
curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true,
  CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false]);
$h = ['X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? ''), 'X-Forwarded-Host: ' . ($_SERVER['HTTP_HOST'] ?? ''), 'X-Forwarded-Proto: https'];
if (!empty($_SERVER['HTTP_HOST'])) $h[] = 'Host: ' . $_SERVER['HTTP_HOST'];
// Reenvía los encabezados del cliente (Auth.js usa X-Auth-Return-Redirect, Origin, Cookie, Content-Type...).
foreach (getallheaders() as $n => $v)
  if (!preg_match('/^(host|connection|content-length|accept-encoding|x-forwarded-.*|transfer-encoding)$/i', $n)) $h[] = "$n: $v";
if (!in_array($method, ['GET', 'HEAD'])) curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
$r = curl_exec($ch);
if ($r === false) { http_response_code(502); header('Content-Type: application/json'); echo json_encode(['error' => 'Backend no disponible']); exit; }
$hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$head = substr($r, 0, $hs); $body = substr($r, $hs); curl_close($ch);
http_response_code($code);
foreach (explode("\r\n", $head) as $l) {
  if (preg_match('/^(Content-Type|Content-Disposition|Location|Cache-Control|Retry-After):/i', $l)) header($l);
  elseif (stripos($l, 'Set-Cookie:') === 0) header($l, false);
}
echo $body;
