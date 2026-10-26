# Start/stop the private development Postgres cluster (port 5433).
# It lives in ..\.dev\pgdata and never touches any other Postgres on this machine.
param([Parameter(Mandatory = $true)][ValidateSet("start", "stop", "status", "init")][string]$Action)

$ErrorActionPreference = "Stop"
$pgBin = if ($env:HH_PG_BIN) { $env:HH_PG_BIN } else { "C:\Program Files\PostgreSQL\18\bin" }
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$data = Join-Path $root ".dev\pgdata"
$log = Join-Path $root ".dev\pg.log"
$port = 5433

function Invoke-Psql($sql) { & "$pgBin\psql.exe" -h 127.0.0.1 -p $port -U postgres -v ON_ERROR_STOP=1 -tAc $sql }

switch ($Action) {
    "init" {
        if (Test-Path (Join-Path $data "PG_VERSION")) { Write-Host "Cluster already initialised at $data"; break }
        New-Item -ItemType Directory -Force (Split-Path $data) | Out-Null
        # trust auth is acceptable ONLY because the cluster listens on 127.0.0.1 and holds throw-away dev data
        & "$pgBin\initdb.exe" -D $data -U postgres --auth=trust -E UTF8 --locale=C | Out-Null
        Write-Host "Initialised $data"
    }
    "start" {
        if (-not (Test-Path (Join-Path $data "PG_VERSION"))) { & $PSCommandPath init }
        Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList @("-D", "`"$data`"", "-o", "`"-p $port -c listen_addresses=127.0.0.1`"", "-l", "`"$log`"", "start") -WindowStyle Hidden -Wait
        Start-Sleep -Seconds 2
        foreach ($db in "harihaat_dev", "harihaat_test") {
            if (-not (Invoke-Psql "select 1 from pg_database where datname='$db'")) { Invoke-Psql "create database $db" | Out-Null }
        }
        Write-Host "Postgres running on 127.0.0.1:$port (databases: harihaat_dev, harihaat_test)"
    }
    "stop" { & "$pgBin\pg_ctl.exe" -D $data stop -m fast }
    "status" { & "$pgBin\pg_ctl.exe" -D $data status }
}
