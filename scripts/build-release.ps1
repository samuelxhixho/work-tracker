param(
    [string]$JavaHome
)

$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$frontendDirectory =
    Join-Path $projectRoot "frontend"

$backendDirectory =
    Join-Path $projectRoot "backend"

$desktopDirectory =
    Join-Path $projectRoot "desktop"

$backendStaticDirectory =
    Join-Path `
        $backendDirectory `
        "src\main\resources\static"

if (-not $JavaHome) {
    $jdkCandidate =
        Get-ChildItem `
            "C:\Program Files\Eclipse Adoptium" `
            -Directory `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -like "jdk-25*"
        } |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if ($jdkCandidate) {
        $JavaHome =
            $jdkCandidate.FullName
    }
}

if (-not $JavaHome) {
    throw @"
JDK 25 could not be found.

Run:

.\scripts\build-release.ps1 -JavaHome "C:\path\to\jdk-25"
"@
}

$java =
    Join-Path $JavaHome "bin\java.exe"

$jlink =
    Join-Path $JavaHome "bin\jlink.exe"

if (
    -not (Test-Path $java) -or
    -not (Test-Path $jlink)
) {
    throw "The supplied JavaHome is not a complete JDK: $JavaHome"
}

$jlinkVersion =
    (& $jlink --version).Trim()

if (-not $jlinkVersion.StartsWith("25")) {
    throw "WorkTracker requires JDK 25. Found JDK $jlinkVersion."
}
Write-Host ""
Write-Host "========================================"
Write-Host " WorkTracker Release Build"
Write-Host "========================================"
Write-Host ""
Write-Host "JDK: $JavaHome"
Write-Host ""

$oldJavaHome =
    $env:JAVA_HOME

$oldPath =
    $env:Path

try {
    $env:JAVA_HOME =
        $JavaHome

    $env:Path =
        "$(Join-Path $JavaHome 'bin');$oldPath"

    Write-Host "[1/6] Building Angular frontend..."

    Push-Location $frontendDirectory

    try {
        npm ci

        if ($LASTEXITCODE -ne 0) {
            throw "Frontend npm ci failed."
        }

        npm run build

        if ($LASTEXITCODE -ne 0) {
            throw "Angular build failed."
        }
    }
    finally {
        Pop-Location
    }

    $frontendBuild =
        Join-Path `
            $frontendDirectory `
            "dist\work-tracker-frontend\browser"

    if (-not (Test-Path $frontendBuild)) {
        throw "Angular output was not found at: $frontendBuild"
    }

    Write-Host ""
    Write-Host "[2/6] Copying Angular into Spring Boot..."

    if (Test-Path $backendStaticDirectory) {
        Remove-Item `
            $backendStaticDirectory `
            -Recurse `
            -Force
    }

    New-Item `
        -ItemType Directory `
        -Path $backendStaticDirectory `
        -Force |
        Out-Null

    Copy-Item `
        "$frontendBuild\*" `
        $backendStaticDirectory `
        -Recurse `
        -Force

    Write-Host ""
    Write-Host "[3/6] Building Spring Boot..."

    Push-Location $backendDirectory

    try {
        .\mvnw.cmd clean package

        if ($LASTEXITCODE -ne 0) {
            throw "Spring Boot build failed."
        }
    }
    finally {
        Pop-Location
    }

    $jar =
        Join-Path `
            $backendDirectory `
            "target\backend-0.0.1-SNAPSHOT.jar"

    if (-not (Test-Path $jar)) {
        throw "Spring Boot JAR was not created."
    }

    Write-Host ""
    Write-Host "[4/6] Extracting Spring Boot backend..."

    $extractedBackendDirectory =
    Join-Path `
        $backendDirectory `
        "target\extracted"

    if (Test-Path $extractedBackendDirectory) {
        Remove-Item `
        $extractedBackendDirectory `
        -Recurse `
        -Force
    }

    & $java `
    "-Djarmode=tools" `
    -jar $jar `
    extract `
    --destination $extractedBackendDirectory

    if ($LASTEXITCODE -ne 0) {
        throw "Spring Boot extraction failed."
    }

    if (
    -not (
    Test-Path (
    Join-Path `
                $extractedBackendDirectory `
                "backend-0.0.1-SNAPSHOT.jar"
    )
    )
    ) {
        throw "Extracted Spring Boot JAR was not created."
    }

    & "$PSScriptRoot\build-runtime.ps1" `
        -JavaHome $JavaHome

    if ($LASTEXITCODE -ne 0) {
        throw "Runtime generation failed."
    }

    Write-Host ""
    Write-Host "[6/6] Building Windows installer..."

    Push-Location $desktopDirectory

    try {
        npm ci

        if ($LASTEXITCODE -ne 0) {
            throw "Desktop npm ci failed."
        }

        if (Test-Path ".\release") {
            Remove-Item `
                ".\release" `
                -Recurse `
                -Force
        }

        npm run build:win

        if ($LASTEXITCODE -ne 0) {
            throw "Electron installer build failed."
        }
    }
    finally {
        Pop-Location
    }

    $installer =
        Join-Path `
            $desktopDirectory `
            "release\WorkTracker-Setup-1.0.0.exe"

    if (-not (Test-Path $installer)) {
        throw "Installer was not created."
    }

    $installerSize =
        (Get-Item $installer).Length / 1MB

    Write-Host ""
    Write-Host "========================================"
    Write-Host " WorkTracker build completed"
    Write-Host "========================================"
    Write-Host ""
    Write-Host (
        "Installer: {0}" -f $installer
    )

    Write-Host (
        "Size: {0:N1} MB" -f $installerSize
    )
}
finally {
    $env:JAVA_HOME =
        $oldJavaHome

    $env:Path =
        $oldPath
}