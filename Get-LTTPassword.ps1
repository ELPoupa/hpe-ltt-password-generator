param(
    [ValidateRange(0,255)][int]$Days = 20,
    [datetime]$Date = (Get-Date)
)
$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'ltt_password.py'
$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (Test-Path -LiteralPath $venvPython) {
    & $venvPython $scriptPath generate --date $Date.ToString('yyyy-MM-dd') --days $Days
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 $scriptPath generate --date $Date.ToString('yyyy-MM-dd') --days $Days
} else {
    & python $scriptPath generate --date $Date.ToString('yyyy-MM-dd') --days $Days
}
if ($LASTEXITCODE -ne 0) { throw 'Password generation failed.' }
