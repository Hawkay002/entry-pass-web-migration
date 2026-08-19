# install-node.ps1 — downloads and silently installs the latest Node.js LTS.
# Called by 0b-INSTALL-NEEDED.bat (which has already self-elevated).
# A plain .ps1 file avoids the quoting nightmare of inline PowerShell in .bat.

$ErrorActionPreference = "Stop"

Write-Host "Finding the latest Node.js LTS version..."
$versions = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
$lts = $versions | Where-Object { $_.lts } | Select-Object -First 1
$v = $lts.version
Write-Host "Latest LTS: $v"

$msi = "node-$v-x64.msi"
$url = "https://nodejs.org/dist/$v/$msi"
Write-Host "Downloading $url (about 30 MB)..."
Invoke-WebRequest -Uri $url -OutFile $msi

Write-Host "Installing (a progress window may appear - wait for it)..."
$proc = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$msi`"", "/qb" -Wait -PassThru
Remove-Item $msi -Force -ErrorAction SilentlyContinue

if ($proc.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "INSTALL DID NOT FINISH (code $($proc.ExitCode))."
    Write-Host "Try again, or install manually from https://nodejs.org"
    exit 1
}
Write-Host "Node.js installed."
exit 0
