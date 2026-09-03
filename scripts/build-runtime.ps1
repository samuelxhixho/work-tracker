param(
    [string]$JavaHome = $env:JAVA_HOME
)

$ErrorActionPreference = "Stop"

$projectRoot =
    Split-Path -Parent $PSScriptRoot

$desktopDirectory =
    Join-Path $projectRoot "desktop"

$runtimeDirectory =
    Join-Path $desktopDirectory "runtime"

$tempRuntimeDirectory =
    Join-Path $desktopDirectory "runtime-build"

if (-not $JavaHome) {
    throw @"
JavaHome was not provided.

Run the script like this:

.\scripts\build-runtime.ps1 -JavaHome "C:\Program Files\Eclipse Adoptium\jdk-25..."
"@
}

$jlink =
    Join-Path $JavaHome "bin\jlink.exe"

if (-not (Test-Path $jlink)) {
    throw "jlink.exe was not found at: $jlink"
}

$jlinkVersion =
    (& $jlink --version).Trim()

if (-not $jlinkVersion.StartsWith("25")) {
    throw "WorkTracker requires JDK 25. Found jlink $jlinkVersion."
}

Write-Host "Building WorkTracker Java runtime..."
Write-Host "JDK: $JavaHome"
Write-Host "jlink version: $jlinkVersion"

if (Test-Path $tempRuntimeDirectory) {
    Remove-Item `
        -Recurse `
        -Force `
        $tempRuntimeDirectory
}

$modules = @(
    "java.base",
    "java.compiler",
    "java.logging",
    "java.naming",
    "java.sql",
    "java.management",
    "java.instrument",
    "java.xml",
    "java.desktop",
    "java.net.http",
    "java.prefs",
    "java.rmi",
    "java.security.jgss",
    "java.security.sasl",
    "java.transaction.xa",
    "jdk.unsupported",
    "jdk.crypto.ec"
) -join ","

& $jlink `
    --add-modules $modules `
    --strip-debug `
    --no-header-files `
    --no-man-pages `
    --compress=2 `
    --output $tempRuntimeDirectory

if ($LASTEXITCODE -ne 0) {
    throw "jlink failed with exit code $LASTEXITCODE."
}

$java =
    Join-Path $tempRuntimeDirectory "bin\java.exe"

$javaw =
    Join-Path $tempRuntimeDirectory "bin\javaw.exe"

if (
    -not (Test-Path $java) -or
    -not (Test-Path $javaw)
) {
    throw "Generated runtime is missing java.exe or javaw.exe."
}

if (Test-Path $runtimeDirectory) {
    Remove-Item `
        -Recurse `
        -Force `
        $runtimeDirectory
}

Move-Item `
    $tempRuntimeDirectory `
    $runtimeDirectory

$runtimeSize =
    (
        Get-ChildItem `
            $runtimeDirectory `
            -Recurse `
            -File |
        Measure-Object Length -Sum
    ).Sum / 1MB

Write-Host ""
Write-Host "WorkTracker runtime created successfully."
Write-Host (
    "Runtime size: {0:N1} MB" -f $runtimeSize
)
Write-Host "Location: $runtimeDirectory"