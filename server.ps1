$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8787
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
$listener.Start()
Write-Host "Trade journal app: http://localhost:8787"

$fallbackJson = '{"stocks":[{"code":"0050","name":"Yuanta Taiwan 50","market":"TWSE","close":null,"referencePrice":null},{"code":"0056","name":"Yuanta High Dividend","market":"TWSE","close":null,"referencePrice":null},{"code":"00878","name":"Cathay ESG High Dividend","market":"TWSE","close":null,"referencePrice":null},{"code":"2330","name":"TSMC","market":"TWSE","close":null,"referencePrice":null},{"code":"2317","name":"Hon Hai","market":"TWSE","close":null,"referencePrice":null},{"code":"2454","name":"MediaTek","market":"TWSE","close":null,"referencePrice":null},{"code":"8069","name":"E Ink","market":"TPEX","close":null,"referencePrice":null}]}'

function Send-Response($stream, [int]$status, [string]$type, [byte[]]$body) {
  $statusText = if ($status -eq 200) { "OK" } elseif ($status -eq 404) { "Not Found" } else { "Server Error" }
  $header = "HTTP/1.1 $status $statusText`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($body, 0, $body.Length)
}

function Content-Type($file) {
  $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
  switch ($ext) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    default { "application/octet-stream" }
  }
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $buffer = New-Object byte[] 4096
    $read = $stream.Read($buffer, 0, $buffer.Length)
    $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
    $firstLine = ($request -split "`r`n")[0]
    $parts = $firstLine -split " "
    $path = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
    $pathOnly = ($path -split "\?")[0]

    if ($pathOnly -eq "/api/stocks") {
      Send-Response $stream 200 "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($fallbackJson))
      continue
    }

    if ($pathOnly -eq "/api/quote") {
      $quote = '{"price":null,"close":null,"time":"preview","note":"Preview server is running. Live quote backend can be switched back to server.js later."}'
      Send-Response $stream 200 "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($quote))
      continue
    }

    $relative = $pathOnly.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    if ((-not $file.StartsWith($root)) -or (-not [System.IO.File]::Exists($file))) {
      Send-Response $stream 404 "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
      continue
    }

    Send-Response $stream 200 (Content-Type $file) ([System.IO.File]::ReadAllBytes($file))
  } catch {
    try {
      Send-Response $stream 500 "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message))
    } catch {}
  } finally {
    $client.Close()
  }
}
