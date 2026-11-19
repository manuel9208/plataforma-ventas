# Instalador del programa de impresion. Se ejecuta pegando el comando que muestra la Caja (Impresora de esta computadora).
param(
  [Parameter(Mandatory = $true)][string]$Api,
  [Parameter(Mandatory = $true)][string]$Origen
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$patron = '^https?://[A-Za-z0-9.\-]+(:\d+)?$'
$Api = $Api.Trim().TrimEnd('/')
if ($Api -notmatch $patron) { throw 'La direccion del servidor no es valida' }
$origenes = @($Origen -split ',' | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ })
foreach ($o in $origenes) { if ($o -notmatch $patron) { throw ('La pagina autorizada no es valida: ' + $o) } }

$carpeta = Join-Path $env:LOCALAPPDATA 'PosBridge'
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
$rutaConfig = Join-Path $carpeta 'config.json'
$rutaPrograma = Join-Path $carpeta 'pos-bridge.ps1'

# Si ya estaba instalado, se conservan las paginas autorizadas anteriores
if (Test-Path $rutaConfig) {
  try { $origenes += @((Get-Content -Raw -Path $rutaConfig | ConvertFrom-Json).origenes) } catch {}
}
$origenes = @($origenes | Select-Object -Unique)

# Detiene la copia anterior, si esta corriendo
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
  Where-Object { $_.CommandLine -like '*PosBridge*pos-bridge.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1

Write-Host 'Descargando el programa...'
Invoke-WebRequest -Uri ($Api + '/pos-bridge/pos-bridge.ps1') -OutFile $rutaPrograma -UseBasicParsing

$config = [ordered]@{ api = $Api; puerto = 9631; origenes = $origenes }
Set-Content -Path $rutaConfig -Value (ConvertTo-Json -InputObject $config) -Encoding ASCII

# Se inicia solo al encender la computadora (carpeta Inicio del usuario, sin administrador)
$argumentos = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $rutaPrograma + '"'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$acceso = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'PosBridge.lnk'))
$acceso.TargetPath = $powershell
$acceso.Arguments = $argumentos
$acceso.WorkingDirectory = $carpeta
$acceso.WindowStyle = 7
$acceso.Save()

Start-Process -FilePath $powershell -WindowStyle Hidden -ArgumentList $argumentos
Start-Sleep -Seconds 4

try {
  $r = Invoke-RestMethod -Uri 'http://127.0.0.1:9631/salud' -Headers @{ Origin = $origenes[0] } -TimeoutSec 5
  Write-Host ('Listo. El programa de impresion (version ' + $r.version + ') esta funcionando.')
} catch {
  Write-Host ('Se instalo, pero todavia no responde. Revisa el archivo ' + (Join-Path $carpeta 'pos-bridge.log'))
}