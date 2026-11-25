# Restauración de un respaldo de GeoAlerta en una base VACÍA (con PostGIS instalado).
# Uso:  powershell -File scripts\restore.ps1 -Archivo D:\respaldos\geoalerta\geoalerta_20261125_120000.dump -Base geoalerta_restaurada
param(
  [Parameter(Mandatory = $true)][string]$Archivo,
  [Parameter(Mandatory = $true)][string]$Base,
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin",
  [string]$Host_ = "127.0.0.1",
  [string]$Usuario = "postgres"
)
$ErrorActionPreference = "Stop"
& "$PgBin\createdb.exe" -h $Host_ -U $Usuario $Base
& "$PgBin\pg_restore.exe" -h $Host_ -U $Usuario -d $Base --no-owner --exit-on-error $Archivo
if ($LASTEXITCODE -ne 0) { throw "pg_restore falló" }
Write-Host "Base $Base restaurada. Verifique con: SELECT count(*) FROM geoalerta.mining_records;"
