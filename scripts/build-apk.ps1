# Builds a signed Tether APK into .\release\Tether-<version>.apk
# Usage (from the project folder):  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# Build tools installed for this project (Java 21 + Android SDK in the user folder)
$env:JAVA_HOME = (Get-ChildItem "$env:LOCALAPPDATA\Programs\tether-build\jdk" -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path "$env:USERPROFILE\TetherKeys\keystore.properties")) {
  throw 'Signing key not found in TetherKeys. Restore it from your backup before building an update.'
}

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
Write-Host "Building Tether $version..."

npm.cmd run build
if ($LASTEXITCODE) { throw 'Web build failed' }
npx.cmd cap sync android
if ($LASTEXITCODE) { throw 'Capacitor sync failed' }

Push-Location android
.\gradlew.bat assembleRelease --console=plain
$code = $LASTEXITCODE
Pop-Location
if ($code) { throw 'Android build failed' }

New-Item -ItemType Directory -Force release | Out-Null
$out = "release\Tether-$version.apk"
Copy-Item android\app\build\outputs\apk\release\app-release.apk $out -Force
Write-Host "Done: $out"
