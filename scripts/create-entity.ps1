<#
.SYNOPSIS
  Stand up a fresh, cleanly-branded Mizan deployment for a new entity (customer/prospect).

.DESCRIPTION
  Creates a new PostgreSQL database, applies the schema (Prisma migrations) and the
  append-only audit rules, then seeds the organisation, a default hierarchy, base units,
  and an admin + store keeper. With -Sample it also loads a small neutral catalogue.
  Nothing existing is touched - each entity is its own database.

.EXAMPLE
  # Blank deployment:
  ./scripts/create-entity.ps1 -Code ACME -NameEn "Acme Distribution"

.EXAMPLE
  # With a neutral sample catalogue to show immediately:
  ./scripts/create-entity.ps1 -Code ACME -NameEn "Acme Distribution" -Sample
#>
param(
  [Parameter(Mandatory = $true)][string]$Code,
  [Parameter(Mandatory = $true)][string]$NameEn,
  [string]$NameAr = "",
  [switch]$Sample,
  [string]$DbName = "",
  [string]$DbUser = "mizan",
  [string]$DbPassword = "mizan_dev_local",
  [string]$DbHost = "localhost",
  [int]$DbPort = 5432,
  [string]$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo "backend"
$rules = Join-Path $repo "database\migrations\0001_append_only_rules.sql"
if ($DbName -eq "") { $DbName = ($Code.ToLower()) + "_demo" }
if ($NameAr -eq "") { $NameAr = $NameEn }
$env:PGPASSWORD = $DbPassword
$dbUrl = "postgresql://${DbUser}:${DbPassword}@${DbHost}:${DbPort}/${DbName}"

Write-Host "1/4  Creating database '$DbName' ..." -ForegroundColor Cyan
& $Psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1 -c ('CREATE DATABASE "' + $DbName + '";')
if ($LASTEXITCODE -ne 0) { throw "Could not create '$DbName'. It may already exist; pick another -Code or drop it first." }

Write-Host "2/4  Applying schema (prisma migrate deploy) ..." -ForegroundColor Cyan
Push-Location $backend
try {
  $env:DATABASE_URL = $dbUrl
  & npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed." }
} finally { Pop-Location }

Write-Host "3/4  Applying append-only audit rules ..." -ForegroundColor Cyan
& $Psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $rules
if ($LASTEXITCODE -ne 0) { throw "Applying append-only rules failed." }

Write-Host "4/4  Seeding entity ..." -ForegroundColor Cyan
Push-Location $backend
try {
  $env:DATABASE_URL = $dbUrl
  $env:ENTITY_CODE = $Code
  $env:ENTITY_NAME_EN = $NameEn
  $env:ENTITY_NAME_AR = $NameAr
  if ($Sample) { $env:ENTITY_SAMPLE = "true" } else { $env:ENTITY_SAMPLE = "false" }
  & npx tsx prisma/entity-seed.ts
  if ($LASTEXITCODE -ne 0) { throw "Seeding failed." }
} finally {
  Pop-Location
  Remove-Item Env:ENTITY_CODE, Env:ENTITY_NAME_EN, Env:ENTITY_NAME_AR, Env:ENTITY_SAMPLE -ErrorAction SilentlyContinue
}

$codeLower = $Code.ToLower()
$titleCode = $Code.Substring(0,1) + $Code.Substring(1).ToLower()
Write-Host ""
Write-Host "Done. Switch the app to '$Code' by putting this block in backend/.env (comment the others) and restarting the backend:" -ForegroundColor Green
Write-Host "--------------------------------------------------------------------"
Write-Host "ORGANIZATION_CODE=$Code"
Write-Host "DATABASE_URL=$dbUrl"
Write-Host "DEMO_ADMIN_EMAIL=admin@$codeLower.demo"
Write-Host "DEMO_ADMIN_PASSWORD=Admin@${titleCode}2026"
Write-Host "DEMO_STOREKEEPER_EMAIL=storekeeper@$codeLower.demo"
Write-Host "DEMO_STOREKEEPER_PASSWORD=Store@${titleCode}2026"
Write-Host "--------------------------------------------------------------------"
