# pos-bridge

Programa de impresion de tickets para Windows. Es un script de PowerShell que corre en segundo plano, sin administrador.

- Instalar: en la Caja, boton "Impresora", copiar el comando y pegarlo en PowerShell (normal, no como administrador).
- Se inicia solo con Windows y se actualiza solo (revisa cada 6 horas).
- Archivos en la PC: %LOCALAPPDATA%\PosBridge (config.json y pos-bridge.log).
- Solo atiende a las paginas listadas en config.json (origenes) y solo escucha en 127.0.0.1:9631.

## Desinstalar (PowerShell normal)

    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*PosBridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Remove-Item "$([Environment]::GetFolderPath('Startup'))\PosBridge.lnk" -Force
    Remove-Item "$env:LOCALAPPDATA\PosBridge" -Recurse -Force

## Para publicar una version nueva

Cambiar `$VERSION` en pos-bridge.ps1 y subir a main. Cada PC se actualiza sola.