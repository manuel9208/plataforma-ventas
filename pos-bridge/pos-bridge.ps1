# pos-bridge: programa de impresion de tickets para Windows (sin permisos de administrador).
# Solo escucha dentro de esta computadora (127.0.0.1) y solo atiende a las paginas autorizadas en config.json.
$VERSION = '1.0.0'
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$carpeta = $PSScriptRoot
$configRuta = Join-Path $carpeta 'config.json'
$logRuta = Join-Path $carpeta 'pos-bridge.log'

function Escribir-Log($texto) {
  try {
    if ((Test-Path $logRuta) -and ((Get-Item $logRuta).Length -gt 500KB)) { Remove-Item $logRuta -Force }
    Add-Content -Path $logRuta -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto)
  } catch {}
}

try {
  $config = Get-Content -Raw -Path $configRuta | ConvertFrom-Json
  $puerto = [int]$config.puerto
  $origenes = @($config.origenes)
} catch {
  Escribir-Log ('No se pudo leer config.json: ' + $_.Exception.Message)
  exit 1
}

# ---------- Impresion directa a una impresora de Windows (USB) ----------
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ImpresoraRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string nombre, out IntPtr h, IntPtr valores);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool StartDocPrinter(IntPtr h, int nivel, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW doc);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] datos, int cantidad, out int escritos);

  // Devuelve "" si todo salio bien, o el motivo del error
  public static string Enviar(string impresora, byte[] datos) {
    IntPtr h;
    if (!OpenPrinter(impresora, out h, IntPtr.Zero)) return "No se pudo abrir la impresora (codigo " + Marshal.GetLastWin32Error() + ")";
    try {
      DOCINFOW doc = new DOCINFOW();
      doc.pDocName = "Ticket";
      doc.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, doc)) return "Windows no acepto el trabajo (codigo " + Marshal.GetLastWin32Error() + ")";
      try {
        if (!StartPagePrinter(h)) return "No se pudo iniciar la pagina (codigo " + Marshal.GetLastWin32Error() + ")";
        int escritos = 0;
        bool ok = WritePrinter(h, datos, datos.Length, out escritos);
        EndPagePrinter(h);
        if (!ok || escritos != datos.Length) return "No se pudo enviar el ticket a la impresora (codigo " + Marshal.GetLastWin32Error() + ")";
      } finally {
        EndDocPrinter(h);
      }
    } finally {
      ClosePrinter(h);
    }
    return "";
  }
}
"@

function Listar-Impresoras {
  $lista = @()
  try {
    foreach ($p in (Get-CimInstance -ClassName Win32_Printer)) {
      if ($p.Name -notmatch 'PDF|XPS|Fax|OneNote') {
        $lista += [pscustomobject]@{ nombre = [string]$p.Name; predeterminada = [bool]$p.Default }
      }
    }
  } catch { Escribir-Log ('No se pudo listar impresoras: ' + $_.Exception.Message) }
  return $lista
}

# ---------- Impresion por red (IP, puerto 9100) ----------
function Es-IpPrivada($ip) {
  $m = [regex]::Match([string]$ip, '^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$')
  if (-not $m.Success) { return $false }
  $o = @(1..4 | ForEach-Object { [int]$m.Groups[$_].Value })
  foreach ($n in $o) { if ($n -gt 255) { return $false } }
  return ($o[0] -eq 10) -or ($o[0] -eq 192 -and $o[1] -eq 168) -or ($o[0] -eq 172 -and $o[1] -ge 16 -and $o[1] -le 31)
}

function Enviar-Ip($ip, $puertoImpresora, [byte[]]$datos) {
  $cliente = New-Object System.Net.Sockets.TcpClient
  try {
    $espera = $cliente.BeginConnect($ip, $puertoImpresora, $null, $null)
    if (-not $espera.AsyncWaitHandle.WaitOne(5000)) { throw 'La impresora no responde (tiempo agotado)' }
    $cliente.EndConnect($espera)
    $flujo = $cliente.GetStream()
    $flujo.Write($datos, 0, $datos.Length)
    $flujo.Flush()
    Start-Sleep -Milliseconds 300
  } finally { $cliente.Close() }
}

# ---------- Respuestas ----------
function Responder($contexto, [int]$codigo, $objeto, $origen) {
  $r = $contexto.Response
  $r.StatusCode = $codigo
  if ($origen) {
    $r.Headers.Add('Access-Control-Allow-Origin', $origen)
    $r.Headers.Add('Vary', 'Origin')
    $r.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    $r.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
    $r.Headers.Add('Access-Control-Allow-Private-Network', 'true')
    $r.Headers.Add('Access-Control-Max-Age', '600')
  }
  if ($null -ne $objeto) {
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $objeto -Depth 5 -Compress))
    $r.ContentType = 'application/json; charset=utf-8'
    $r.ContentLength64 = $bytes.Length
    $r.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $r.ContentLength64 = 0
  }
  $r.OutputStream.Close()
}

function Atender($contexto) {
  $req = $contexto.Request
  $origen = $req.Headers['Origin']
  $permitido = $origen -and ($origenes -contains $origen)
  if (-not $permitido) { Responder $contexto 403 @{ ok = $false; error = 'Pagina no autorizada' } $null; return }

  if ($req.HttpMethod -eq 'OPTIONS') { Responder $contexto 204 $null $origen; return }

  $ruta = $req.Url.AbsolutePath
  if ($req.HttpMethod -eq 'GET' -and $ruta -eq '/salud') {
    Responder $contexto 200 @{ ok = $true; version = $VERSION; impresoras = @(Listar-Impresoras) } $origen
    return
  }

  if ($req.HttpMethod -eq 'POST' -and $ruta -eq '/imprimir') {
    try {
      if ($req.ContentLength64 -gt 2000000) { throw 'El ticket es demasiado grande' }
      $lector = New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
      $pedido = $lector.ReadToEnd() | ConvertFrom-Json
      $datos = [Convert]::FromBase64String([string]$pedido.datos)
      if ($datos.Length -eq 0 -or $datos.Length -gt 1000000) { throw 'Ticket vacio o demasiado grande' }
      $destino = $pedido.destino

      if ($destino.tipo -eq 'usb') {
        $nombres = @(Listar-Impresoras | ForEach-Object { $_.nombre })
        if ($nombres -notcontains [string]$destino.nombre) { throw 'No se encontro esa impresora en Windows' }
        $error_ = [ImpresoraRaw]::Enviar([string]$destino.nombre, $datos)
        if ($error_) { throw $error_ }
      } elseif ($destino.tipo -eq 'ip') {
        if (-not (Es-IpPrivada $destino.host)) { throw 'Solo se permiten direcciones de la red local' }
        $puertoImpresora = [int]$destino.puerto
        if ($puertoImpresora -lt 1 -or $puertoImpresora -gt 65535) { throw 'Puerto invalido' }
        Enviar-Ip ([string]$destino.host) $puertoImpresora $datos
      } else {
        throw 'Destino invalido'
      }
      Responder $contexto 200 @{ ok = $true } $origen
    } catch {
      Escribir-Log ('Error al imprimir: ' + $_.Exception.Message)
      Responder $contexto 200 @{ ok = $false; error = $_.Exception.Message } $origen
    }
    return
  }

  Responder $contexto 404 @{ ok = $false; error = 'No existe' } $origen
}

# ---------- Actualizacion automatica ----------
function Revisar-Actualizacion {
  try {
    $api = ([string]$config.api).TrimEnd('/')
    $info = Invoke-RestMethod -Uri ($api + '/pos-bridge/version') -TimeoutSec 15
    if (-not $info.version -or $info.version -eq $VERSION) { return }

    $nuevo = Join-Path $carpeta 'pos-bridge.nuevo.ps1'
    Invoke-WebRequest -Uri ($api + '/pos-bridge/pos-bridge.ps1') -OutFile $nuevo -TimeoutSec 30 -UseBasicParsing
    $hash = (Get-FileHash -Path $nuevo -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne ([string]$info.sha256).ToLower()) {
      Remove-Item $nuevo -Force
      Escribir-Log 'Actualizacion descartada: el archivo no coincide'
      return
    }
    [void][scriptblock]::Create((Get-Content -Raw -Path $nuevo))
    Move-Item -Path $nuevo -Destination (Join-Path $carpeta 'pos-bridge.ps1') -Force
    Escribir-Log ('Actualizado a la version ' + $info.version)

    $escucha.Stop()
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $carpeta 'pos-bridge.ps1') + '"'
    Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList $argumentos
    exit
  } catch {
    Escribir-Log ('No se pudo revisar la actualizacion: ' + $_.Exception.Message)
  }
}

# ---------- Arranque ----------
# Si es una actualizacion, el programa anterior tarda un instante en cerrar: se reintenta unos segundos.
# Si el puerto sigue ocupado, ya hay otro programa corriendo y este se cierra.
$escucha = $null
for ($i = 0; $i -lt 20; $i++) {
  try {
    $escucha = New-Object System.Net.HttpListener
    $escucha.Prefixes.Add('http://127.0.0.1:' + $puerto + '/')
    $escucha.Start()
    break
  } catch {
    $escucha = $null
    Start-Sleep -Seconds 1
  }
}
if ($null -eq $escucha) {
  Escribir-Log 'No se pudo abrir el puerto (ya hay otro programa corriendo o Windows lo bloquea)'
  exit 1
}
Escribir-Log ('Programa de impresion ' + $VERSION + ' escuchando en el puerto ' + $puerto)

$ultimaRevision = Get-Date
Revisar-Actualizacion

while ($true) {
  try {
    $tarea = $escucha.GetContextAsync()
    while (-not $tarea.Wait(30000)) {
      if (((Get-Date) - $ultimaRevision).TotalHours -ge 6) {
        $ultimaRevision = Get-Date
        Revisar-Actualizacion
      }
    }
    $contexto = $tarea.Result
    try { Atender $contexto } catch {
      Escribir-Log ('Error inesperado: ' + $_.Exception.Message)
      try { $contexto.Response.Abort() } catch {}
    }
  } catch {
    Escribir-Log ('Error en el ciclo: ' + $_.Exception.Message)
    Start-Sleep -Seconds 1
  }
}