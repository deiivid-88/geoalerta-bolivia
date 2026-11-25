# Respaldo de GeoAlerta: base de datos (pg_dump formato custom) + archivos de evidencias.
# Uso:  powershell -File scripts\backup.ps1 -Destino D:\respaldos\geoalerta
# La contraseña se toma de PGPASSWORD o del archivo %APPDATA%\postgresql\pgpass.conf (no se escribe aquí).
param(
  [Parameter(Mandatory = $true)][string]$Destino,
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin",
  [string]$Host_ = "127.0.0.1",
  [string]$Usuario = "geoalerta_app",
  [string]$Base = "geoalerta",
  [string]$Storage = ".\storage"
)
$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$dump = Join-Path $Destino "geoalerta_$stamp.dump"
& "$PgBin\pg_dump.exe" -h $Host_ -U $Usuario -d $Base -F c -Z 6 -f $dump
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló" }
if (Test-Path $Storage) { Compress-Archive -Path "$Storage\*" -DestinationPath (Join-Path $Destino "evidencias_$stamp.zip") }
Get-FileHash $dump -Algorithm SHA256 | Format-List
Write-Host "Respaldo completado en $Destino"
