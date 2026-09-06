$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $projectRoot 'frontend'
$backend = Join-Path $projectRoot 'backend'
$desktop = Join-Path $projectRoot 'desktop'
$static = Join-Path $backend 'src\main\resources\static'
$frontendBuild = Join-Path $frontend 'dist\work-tracker-frontend\browser'
$jar = Join-Path $backend 'target\backend-0.0.1-SNAPSHOT.jar'
$extracted = Join-Path $backend 'target\extracted'

Write-Host 'Building Angular...'
Push-Location $frontend
npm run build

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw 'Angular build failed.'
}

Pop-Location

Write-Host 'Copying frontend into Spring Boot...'
Remove-Item $static -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $static | Out-Null
Copy-Item "$frontendBuild\*" $static -Recurse -Force

Write-Host 'Building Spring Boot...'
Push-Location $backend
.\mvnw.cmd package -DskipTests

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw 'Spring Boot build failed.'
}

Write-Host 'Extracting Spring Boot backend...'
Remove-Item $extracted -Recurse -Force -ErrorAction SilentlyContinue
& java '-Djarmode=tools' '-jar' $jar 'extract' '--destination' $extracted

if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw 'Spring Boot extraction failed.'
}

Pop-Location

Write-Host 'Starting WorkTracker...'
Push-Location $desktop
npm start
Pop-Location