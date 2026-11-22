param(
  [int]$Port = 8787,
  [switch]$NaoAbrir
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-Serving {
  $client = $null
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    if (-not $task.Wait(700)) { return $false }
    $stream = $client.GetStream()
    $stream.ReadTimeout = 1200
    $req = [System.Text.Encoding]::ASCII.GetBytes("GET / HTTP/1.0`r`nHost: localhost`r`nConnection: close`r`n`r`n")
    $stream.Write($req, 0, $req.Length)
    $buf = New-Object byte[] 32
    $n = $stream.Read($buf, 0, $buf.Length)
    return ($n -gt 0 -and [System.Text.Encoding]::ASCII.GetString($buf, 0, $n).StartsWith('HTTP/'))
  } catch {
    return $false
  } finally {
    if ($client) { $client.Close() }
  }
}

function Get-LanIp {
  $sock = $null
  try {
    $sock = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork, [System.Net.Sockets.SocketType]::Dgram, [System.Net.Sockets.ProtocolType]::Udp)
    $sock.Connect('8.8.8.8', 80)
    return $sock.LocalEndPoint.Address.ToString()
  } catch {
    return $null
  } finally {
    if ($sock) { $sock.Dispose() }
  }
}

if (Test-Serving) {
  Write-Host ''
  Write-Host "  A FLORESTA ja esta no ar em http://localhost:$Port" -ForegroundColor Green
  Write-Host '  (outra janela do servidor esta aberta; feche-a para desligar)'
  Write-Host ''
  if (-not $NaoAbrir) { Start-Process "http://localhost:$Port" }
  exit 0
}

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public static class FlorestaServer
{
    static string root;

    static readonly string[] exts = { ".html", ".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".txt", ".mp3", ".ogg", ".wav" };
    static readonly string[] mimes = {
        "text/html; charset=utf-8", "application/javascript; charset=utf-8", "text/css; charset=utf-8",
        "application/json; charset=utf-8", "image/png", "image/jpeg", "image/jpeg", "image/gif",
        "image/svg+xml", "image/x-icon", "font/woff", "font/woff2", "text/plain; charset=utf-8",
        "audio/mpeg", "audio/ogg", "audio/wav"
    };

    public static void Run(int port, string rootDir)
    {
        root = Path.GetFullPath(rootDir);
        if (!root.EndsWith(Path.DirectorySeparatorChar.ToString())) root += Path.DirectorySeparatorChar;

        var listener = new TcpListener(IPAddress.Any, port);
        listener.Start(128);

        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(Handle, client);
        }
    }

    static void Handle(object state)
    {
        var client = (TcpClient)state;
        try
        {
            client.ReceiveTimeout = 8000;
            client.SendTimeout = 8000;

            using (client)
            using (var stream = client.GetStream())
            using (var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true))
            {
                string requestLine = reader.ReadLine();
                if (string.IsNullOrEmpty(requestLine)) return;

                int guard = 0;
                while (guard++ < 200)
                {
                    string h = reader.ReadLine();
                    if (string.IsNullOrEmpty(h)) break;
                }

                string[] parts = requestLine.Split(' ');
                if (parts.Length < 2) return;

                bool head = parts[0].Equals("HEAD", StringComparison.OrdinalIgnoreCase);
                string path = parts[1];
                int q = path.IndexOf('?');
                if (q >= 0) path = path.Substring(0, q);
                if (path.Length == 0 || path == "/") path = "/index.html";
                path = Uri.UnescapeDataString(path);

                string full = "";
                try { full = Path.GetFullPath(Path.Combine(root, path.TrimStart('/'))); }
                catch { }

                byte[] body = null;
                string type = "text/plain; charset=utf-8";
                string status = "404 Not Found";

                if (full.Length > 0 && full.StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(full))
                {
                    body = File.ReadAllBytes(full);
                    string ext = Path.GetExtension(full).ToLowerInvariant();
                    for (int i = 0; i < exts.Length; i++)
                        if (exts[i] == ext) { type = mimes[i]; break; }
                    status = "200 OK";
                }
                if (body == null) body = Encoding.UTF8.GetBytes("404 - nao encontrado");

                string headText = "HTTP/1.1 " + status +
                    "\r\nContent-Type: " + type +
                    "\r\nContent-Length: " + body.Length +
                    "\r\nCache-Control: no-store" +
                    "\r\nConnection: close\r\n\r\n";
                byte[] hb = Encoding.ASCII.GetBytes(headText);
                stream.Write(hb, 0, hb.Length);
                if (!head) stream.Write(body, 0, body.Length);
                stream.Flush();
            }
        }
        catch
        {
            try { client.Close(); } catch { }
        }
    }
}
'@

$lan = Get-LanIp
Write-Host ''
Write-Host '  FLORESTA no ar.' -ForegroundColor Green
Write-Host "  Neste computador:      http://localhost:$Port"
if ($lan) { Write-Host "  Amigos na mesma rede:  http://${lan}:$Port" -ForegroundColor Cyan }
Write-Host '  Se o Windows perguntar, permita o acesso em "redes privadas".'
Write-Host '  Amigo nao consegue abrir? Rode liberar-firewall.bat uma vez.'
Write-Host '  (feche esta janela para desligar)'
Write-Host ''

if (-not $NaoAbrir) { Start-Process "http://localhost:$Port" }

try {
  [FlorestaServer]::Run($Port, $root)
}
catch [System.Net.Sockets.SocketException] {
  Write-Host ''
  Write-Host "  Nao consegui usar a porta $Port." -ForegroundColor Yellow
  Write-Host '  Feche a outra janela do servidor e tente de novo.'
}
catch {
  Write-Host ''
  Write-Host "  Erro: $($_.Exception.Message)" -ForegroundColor Red
}
