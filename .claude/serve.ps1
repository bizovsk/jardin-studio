# Minimal static file server (no admin / no Python / no Node needed)
# Serves the project root over http://127.0.0.1:$Port using TcpListener.
# Robust: per-socket receive timeout so a half-open browser preconnect can never
# block the loop, and the accept loop never dies on a per-connection error.
param([int]$Port = 8011)

$root = Split-Path -Parent $PSScriptRoot   # project root (parent of .claude)

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.svg'='image/svg+xml';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
  '.ico'='image/x-icon'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.txt'='text/plain; charset=utf-8'
}

# Loopback (127.0.0.1) uniquement : le serveur n'est PAS exposé au réseau.
# (Pour un test mobile, repasser sur [System.Net.IPAddress]::Any + ouvrir le port pare-feu.)
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start(64)
Write-Output "Serving $root on http://127.0.0.1:$Port/"

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 2000   # ms : a silent preconnect socket can't hang us
    $client.SendTimeout = 5000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)

    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    while ($true) { $l = $reader.ReadLine(); if ($null -eq $l -or $l -eq '') { break } }  # drain headers

    $parts = $requestLine -split ' '
    $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
    $rawPath = ($rawPath -split '\?')[0]
    if ($rawPath -eq '/') { $rawPath = '/index.html' }
    $rel = [System.Uri]::UnescapeDataString($rawPath).TrimStart('/') -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))

    if (-not $full.StartsWith([System.IO.Path]::GetFullPath($root))) {
      $body = [System.Text.Encoding]::UTF8.GetBytes('403'); $status = '403 Forbidden'; $ctype = 'text/plain'
    } elseif (Test-Path $full -PathType Leaf) {
      $body = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctype = $mime[$ext]; if (-not $ctype) { $ctype = 'application/octet-stream' }
      $status = '200 OK'
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found: ' + $rel); $status = '404 Not Found'; $ctype = 'text/plain; charset=utf-8'
    }

    $header = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
  } catch {
    # ignore any per-connection error (timeout, reset, etc.) and keep serving
  } finally {
    if ($client) { try { $client.Close() } catch {} }
  }
}
