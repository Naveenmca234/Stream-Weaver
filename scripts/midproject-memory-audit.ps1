param(
    [ValidateSet(100, 500, 1024, 2048)]
    [int]$TargetMB = 100,

    [string]$ApiBase = "http://localhost:5000/api",

    [switch]$KeepSourceFile
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BenchmarkDirectory = Join-Path $ProjectRoot "benchmark-data"
$ResultsDirectory = Join-Path $ProjectRoot "docs\benchmarks"
$ScratchDirectory = Join-Path $PSScriptRoot ".benchmark-temp"
$Generator = Join-Path $PSScriptRoot "generate-benchmark-csv.mjs"
$BenchmarkFile = Join-Path $BenchmarkDirectory "streamweaver-$TargetMB`mb.csv"
$ResponseFile = Join-Path $ScratchDirectory "upload-response-$TargetMB.json"
$ErrorFile = Join-Path $ScratchDirectory "upload-error-$TargetMB.txt"
$ResultsFile = Join-Path $ResultsDirectory "memory-audit.csv"

New-Item -ItemType Directory -Force $BenchmarkDirectory | Out-Null
New-Item -ItemType Directory -Force $ResultsDirectory | Out-Null
New-Item -ItemType Directory -Force $ScratchDirectory | Out-Null

function Convert-ToMB {
    param([double]$Bytes)
    return [Math]::Round($Bytes / 1MB, 2)
}

function Get-BackendProcess {
    $listener = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $listener) {
        throw "No backend process is listening on port 5000. Start the StreamWeaver backend first."
    }

    $process = Get-Process -Id $listener.OwningProcess -ErrorAction Stop

    if ($process.ProcessName -notlike "node*") {
        Write-Warning "Port 5000 is owned by $($process.ProcessName), not node."
    }

    return $process
}

function Remove-FileSafely {
    param([string]$Path)

    if ($Path -and (Test-Path $Path)) {
        Remove-Item -Force $Path -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " StreamWeaver Mid-Project Memory Audit - $TargetMB MB" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify the backend and upload limit before generating a huge file.
try {
    $health = Invoke-RestMethod "$ApiBase/health"
    if (-not $health.success) {
        throw "Health API returned success=false."
    }
}
catch {
    throw "Backend health check failed. Keep 'npm run dev' running in the server terminal. $($_.Exception.Message)"
}

$configResponse = Invoke-RestMethod "$ApiBase/files/config"
$maxUploadBytes = [int64]$configResponse.data.maxFileSizeBytes
$requestedBytes = [int64]$TargetMB * 1MB

if ($maxUploadBytes -lt $requestedBytes) {
    $required = [int64]3GB
    Write-Host "Current MAX_UPLOAD_BYTES is too small for this audit." -ForegroundColor Yellow
    Write-Host "Current : $maxUploadBytes bytes"
    Write-Host "Required: at least $requestedBytes bytes"
    Write-Host ""
    Write-Host "For the full 2GB audit, set this LOCAL value in server\.env:" -ForegroundColor Yellow
    Write-Host "MAX_UPLOAD_BYTES=$required" -ForegroundColor White
    Write-Host "Then restart the backend and rerun the audit."
    exit 2
}

# 2. Generate the benchmark CSV with a streaming writer.
Write-Host "Generating benchmark CSV on disk..." -ForegroundColor Cyan
& node $Generator $TargetMB $BenchmarkFile

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $BenchmarkFile)) {
    throw "Benchmark CSV generation failed."
}

$fileInfo = Get-Item $BenchmarkFile
$actualBytes = [int64]$fileInfo.Length
$actualMB = Convert-ToMB $actualBytes

Write-Host "Benchmark file ready: $actualMB MB" -ForegroundColor Green
Write-Host ""

# 3. Resolve the real Node process that owns the backend port.
$backendProcess = Get-BackendProcess
$backendPid = $backendProcess.Id
$backendProcess.Refresh()

$baselineWorkingSet = [int64]$backendProcess.WorkingSet64
$baselinePrivate = [int64]$backendProcess.PrivateMemorySize64
$peakWorkingSet = $baselineWorkingSet
$peakPrivate = $baselinePrivate
$sampleCount = 1

Write-Host "Backend PID: $backendPid"
Write-Host "Baseline working set: $(Convert-ToMB $baselineWorkingSet) MB"
Write-Host "Uploading with curl.exe while sampling server memory..." -ForegroundColor Cyan
Write-Host ""

Remove-FileSafely $ResponseFile
Remove-FileSafely $ErrorFile

$curlArguments = @(
    "-sS",
    "-X", "POST",
    "-F", "file=@$BenchmarkFile;type=text/csv",
    "$ApiBase/files/upload"
)

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

$curlProcess = Start-Process `
    -FilePath "curl.exe" `
    -ArgumentList $curlArguments `
    -RedirectStandardOutput $ResponseFile `
    -RedirectStandardError $ErrorFile `
    -NoNewWindow `
    -PassThru

while (-not $curlProcess.HasExited) {
    try {
        $sample = Get-Process -Id $backendPid -ErrorAction Stop
        $workingSet = [int64]$sample.WorkingSet64
        $privateMemory = [int64]$sample.PrivateMemorySize64

        if ($workingSet -gt $peakWorkingSet) {
            $peakWorkingSet = $workingSet
        }

        if ($privateMemory -gt $peakPrivate) {
            $peakPrivate = $privateMemory
        }

        $sampleCount++
    }
    catch {
        throw "The backend process stopped during the upload."
    }

    Start-Sleep -Milliseconds 100
}

$curlProcess.WaitForExit()
$curlProcess.Refresh()
$stopwatch.Stop()

# Windows PowerShell can occasionally expose a null ExitCode on a Start-Process
# object after redirected I/O. Do not treat null as failure; validate the actual
# HTTP response body as the source of truth.
$curlExitCode = $curlProcess.ExitCode
$curlError = if (Test-Path $ErrorFile) { Get-Content $ErrorFile -Raw } else { "" }
$responseText = if (Test-Path $ResponseFile) { Get-Content $ResponseFile -Raw } else { "" }

if ($null -ne $curlExitCode -and [int]$curlExitCode -ne 0) {
    throw "curl.exe failed with exit code $curlExitCode. $curlError"
}

if ([string]::IsNullOrWhiteSpace($responseText)) {
    $exitDisplay = if ($null -eq $curlExitCode) { "unavailable" } else { [string]$curlExitCode }
    throw "curl.exe returned no upload response. Exit code: $exitDisplay. $curlError"
}

try {
    $uploadResponse = $responseText | ConvertFrom-Json
}
catch {
    throw "Upload response was not valid JSON: $responseText"
}

if (-not $uploadResponse.success) {
    throw "Upload API returned an error: $($uploadResponse.message)"
}

$backendAfter = Get-Process -Id $backendPid -ErrorAction Stop
$finalWorkingSet = [int64]$backendAfter.WorkingSet64
$finalPrivate = [int64]$backendAfter.PrivateMemorySize64

$durationSeconds = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 2)
$throughputMBps = if ($stopwatch.Elapsed.TotalSeconds -gt 0) {
    [Math]::Round($actualMB / $stopwatch.Elapsed.TotalSeconds, 2)
} else {
    0
}

# 4. Verify that the same large upload still produces only a bounded 1,000-row preview.
$previewStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$previewResponse = Invoke-RestMethod "$ApiBase/files/$($uploadResponse.data.uploadId)/preview"
$previewStopwatch.Stop()

$previewSeconds = [Math]::Round($previewStopwatch.Elapsed.TotalSeconds, 3)
$previewRows = [int]$previewResponse.data.previewCount
$hasMoreRows = [bool]$previewResponse.data.hasMoreRows

$peakWorkingSetMB = Convert-ToMB $peakWorkingSet
$peakPrivateMB = Convert-ToMB $peakPrivate
$baselineWorkingSetMB = Convert-ToMB $baselineWorkingSet
$finalWorkingSetMB = Convert-ToMB $finalWorkingSet
$workingSetDeltaMB = [Math]::Round($peakWorkingSetMB - $baselineWorkingSetMB, 2)
$under150MB = $peakWorkingSetMB -lt 150

$result = [PSCustomObject]@{
    Timestamp = (Get-Date).ToString("s")
    TargetMB = $TargetMB
    ActualMB = $actualMB
    ActualBytes = $actualBytes
    BackendPID = $backendPid
    Samples = $sampleCount
    BaselineWorkingSetMB = $baselineWorkingSetMB
    PeakWorkingSetMB = $peakWorkingSetMB
    WorkingSetDeltaMB = $workingSetDeltaMB
    FinalWorkingSetMB = $finalWorkingSetMB
    PeakPrivateMemoryMB = $peakPrivateMB
    FinalPrivateMemoryMB = (Convert-ToMB $finalPrivate)
    UploadSeconds = $durationSeconds
    ThroughputMBps = $throughputMBps
    PreviewRows = $previewRows
    PreviewHasMoreRows = $hasMoreRows
    PreviewSeconds = $previewSeconds
    Under150MB = $under150MB
}

if (Test-Path $ResultsFile) {
    $result | Export-Csv -Path $ResultsFile -Append -NoTypeInformation
}
else {
    $result | Export-Csv -Path $ResultsFile -NoTypeInformation
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Audit Result" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
$result | Format-List

if ($under150MB) {
    Write-Host "PASS: Peak backend working set remained below 150 MB." -ForegroundColor Green
}
else {
    Write-Host "ATTENTION: Peak backend working set exceeded 150 MB." -ForegroundColor Yellow
    Write-Host "Do not claim the company memory target until this is optimized and retested." -ForegroundColor Yellow
}

if ($previewRows -eq 1000 -and $hasMoreRows) {
    Write-Host "PASS: Large-file preview remained bounded at 1,000 rows." -ForegroundColor Green
}
else {
    Write-Host "ATTENTION: Preview did not match the expected bounded behavior." -ForegroundColor Yellow
}

Write-Host "Results saved to: $ResultsFile" -ForegroundColor Cyan

# 5. Avoid wasting several GB of disk after each local audit.
$storedFileName = $uploadResponse.data.storedFileName
if ($storedFileName) {
    $stagedUpload = Join-Path $ProjectRoot "server\temp\uploads\$storedFileName"
    Remove-FileSafely $stagedUpload
}

if (-not $KeepSourceFile) {
    Remove-FileSafely $BenchmarkFile
}

Remove-FileSafely $ResponseFile
Remove-FileSafely $ErrorFile

Write-Host "Temporary benchmark data cleaned from disk." -ForegroundColor DarkGray
Write-Host ""
