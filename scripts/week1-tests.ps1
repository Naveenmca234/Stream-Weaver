$ErrorActionPreference = "Stop"

$ApiBase = "http://localhost:5000/api"
$Root = "A:\StreamWeaver"
$Samples = Join-Path $Root "sample-data"

$Passed = 0
$Failed = 0
$Results = @()

function Write-TestResult {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Details
    )

    if ($Success) {
        $script:Passed++
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    else {
        $script:Failed++
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }

    if ($Details) {
        Write-Host "       $Details" -ForegroundColor DarkGray
    }

    $script:Results += [PSCustomObject]@{
        Test = $Name
        Result = if ($Success) { "PASS" } else { "FAIL" }
        Details = $Details
    }
}

function Invoke-CurlJson {
    param(
        [string[]]$Arguments
    )

    $output = & curl.exe -sS @Arguments -w "`n%{http_code}"

    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe failed with exit code $LASTEXITCODE"
    }

    $lines = @($output)

    if ($lines.Count -lt 2) {
        throw "Unexpected curl response."
    }

    $statusCode = [int]$lines[-1]
    $bodyText = ($lines[0..($lines.Count - 2)] -join "`n").Trim()

    $json = $null

    if ($bodyText) {
        try {
            $json = $bodyText | ConvertFrom-Json
        }
        catch {
            throw "Response was not valid JSON: $bodyText"
        }
    }

    return [PSCustomObject]@{
        StatusCode = $statusCode
        Json = $json
        Raw = $bodyText
    }
}

function Upload-Csv {
    param(
        [string]$Path,
        [string]$MimeType = "text/csv"
    )

    return Invoke-CurlJson @(
        "-X", "POST",
        "-F", "file=@$Path;type=$MimeType",
        "$ApiBase/files/upload"
    )
}

function Get-Preview {
    param(
        [string]$UploadId
    )

    return Invoke-CurlJson @(
        "$ApiBase/files/$UploadId/preview"
    )
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " StreamWeaver Week 1 Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# Check required samples
# ------------------------------------------------------------

$RequiredSamples = @(
    "employees-small.csv",
    "employees-preview-limit.csv",
    "employees-medium.csv",
    "employees-invalid.csv",
    "employees-malformed.csv"
)

foreach ($file in $RequiredSamples) {
    $path = Join-Path $Samples $file

    if (-not (Test-Path $path)) {
        Write-Host "Missing sample file: $file" -ForegroundColor Yellow
        Write-Host "Run: node .\sample-data\generate-samples.mjs"
        exit 1
    }
}

# ------------------------------------------------------------
# Prepare special test files
# ------------------------------------------------------------

$UppercaseCsv = Join-Path $Samples "employees-uppercase.CSV"
Copy-Item `
    (Join-Path $Samples "employees-small.csv") `
    $UppercaseCsv `
    -Force

$TxtFile = Join-Path $Samples "invalid-upload.txt"
"not a csv file" | Set-Content -Encoding UTF8 $TxtFile

$EmptyFile = Join-Path $Samples "empty.csv"
Set-Content -Path $EmptyFile -Value "" -NoNewline

$HeadersOnly = Join-Path $Samples "headers-only.csv"
"employee_id,name,department,email" |
    Set-Content -Encoding UTF8 $HeadersOnly

# ------------------------------------------------------------
# 1. Health
# ------------------------------------------------------------

try {
    $health = Invoke-RestMethod "$ApiBase/health"

    Write-TestResult `
        "Health API" `
        ($health.success -eq $true) `
        $health.message
}
catch {
    Write-TestResult `
        "Health API" `
        $false `
        $_.Exception.Message

    Write-Host ""
    Write-Host "Backend is not reachable. Keep npm run dev running." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# 2. Small CSV upload
# ------------------------------------------------------------

$smallUploadId = $null

try {
    $response = Upload-Csv (Join-Path $Samples "employees-small.csv")

    $ok =
        $response.StatusCode -eq 201 -and
        $response.Json.success -eq $true -and
        $response.Json.data.uploadId

    if ($ok) {
        $smallUploadId = $response.Json.data.uploadId
    }

    Write-TestResult `
        "Valid CSV upload" `
        $ok `
        "HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Valid CSV upload" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 3. Uppercase extension
# ------------------------------------------------------------

try {
    $response = Upload-Csv $UppercaseCsv

    Write-TestResult `
        "Uppercase .CSV extension" `
        ($response.StatusCode -eq 201 -and $response.Json.success -eq $true) `
        "HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Uppercase .CSV extension" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 4. TXT rejection
# ------------------------------------------------------------

try {
    $response = Invoke-CurlJson @(
        "-X", "POST",
        "-F", "file=@$TxtFile;type=text/plain",
        "$ApiBase/files/upload"
    )

    Write-TestResult `
        "TXT file rejected" `
        ($response.StatusCode -eq 415 -and $response.Json.success -eq $false) `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "TXT file rejected" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 5. Empty CSV
# ------------------------------------------------------------

try {
    $response = Upload-Csv $EmptyFile

    Write-TestResult `
        "Empty CSV rejected" `
        ($response.StatusCode -eq 400 -and $response.Json.error.code -eq "EMPTY_FILE") `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Empty CSV rejected" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 6. No file
# ------------------------------------------------------------

try {
    $response = Invoke-CurlJson @(
        "-X", "POST",
        "-F", "description=test",
        "$ApiBase/files/upload"
    )

    Write-TestResult `
        "No file supplied" `
        ($response.StatusCode -eq 400 -and $response.Json.error.code -eq "NO_FILE_SUPPLIED") `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "No file supplied" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 7. Multiple files
# ------------------------------------------------------------

try {
    $small = Join-Path $Samples "employees-small.csv"
    $invalid = Join-Path $Samples "employees-invalid.csv"

    $response = Invoke-CurlJson @(
        "-X", "POST",
        "-F", "file=@$small;type=text/csv",
        "-F", "file=@$invalid;type=text/csv",
        "$ApiBase/files/upload"
    )

    Write-TestResult `
        "Multiple files rejected" `
        ($response.StatusCode -eq 400 -and $response.Json.success -eq $false) `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Multiple files rejected" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 8. Small preview
# ------------------------------------------------------------

if ($smallUploadId) {
    try {
        $response = Get-Preview $smallUploadId

        $data = $response.Json.data

        $ok =
            $response.StatusCode -eq 200 -and
            $data.columns.Count -eq 5 -and
            $data.previewCount -eq 20 -and
            $data.hasMoreRows -eq $false

        Write-TestResult `
            "Small CSV preview" `
            $ok `
            "columns=$($data.columns.Count), rows=$($data.previewCount), more=$($data.hasMoreRows)"
    }
    catch {
        Write-TestResult "Small CSV preview" $false $_.Exception.Message
    }
}

# ------------------------------------------------------------
# 9. Preview limit: 1500 rows
# ------------------------------------------------------------

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-preview-limit.csv")
    $preview = Get-Preview $upload.Json.data.uploadId
    $data = $preview.Json.data

    $ok =
        $data.previewCount -eq 1000 -and
        $data.previewLimit -eq 1000 -and
        $data.hasMoreRows -eq $true

    Write-TestResult `
        "1,500-row preview limit" `
        $ok `
        "rows=$($data.previewCount)/$($data.previewLimit), more=$($data.hasMoreRows)"
}
catch {
    Write-TestResult "1,500-row preview limit" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 10. 50,000-row bounded preview
# ------------------------------------------------------------

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-medium.csv")
    $preview = Get-Preview $upload.Json.data.uploadId
    $data = $preview.Json.data

    $ok =
        $data.previewCount -eq 1000 -and
        $data.hasMoreRows -eq $true

    Write-TestResult `
        "50,000-row bounded preview" `
        $ok `
        "Only $($data.previewCount) preview rows returned"
}
catch {
    Write-TestResult "50,000-row bounded preview" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 11. Header-only CSV
# ------------------------------------------------------------

try {
    $upload = Upload-Csv $HeadersOnly
    $preview = Get-Preview $upload.Json.data.uploadId
    $data = $preview.Json.data

    $ok =
        $data.columns.Count -eq 4 -and
        $data.previewCount -eq 0 -and
        $data.hasMoreRows -eq $false

    Write-TestResult `
        "Header-only CSV" `
        $ok `
        "columns=$($data.columns.Count), rows=$($data.previewCount)"
}
catch {
    Write-TestResult "Header-only CSV" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 12. Inconsistent rows
# ------------------------------------------------------------

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-invalid.csv")
    $preview = Get-Preview $upload.Json.data.uploadId
    $data = $preview.Json.data

    $warningCodes = @(
        $data.warnings |
            ForEach-Object { $_.code }
    )

    $ok =
        $preview.StatusCode -eq 200 -and
        $warningCodes -contains "COLUMN_COUNT_MISMATCH"

    Write-TestResult `
        "Inconsistent rows warning" `
        $ok `
        "Warnings: $($warningCodes -join ', ')"
}
catch {
    Write-TestResult "Inconsistent rows warning" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 13. Malformed CSV
# ------------------------------------------------------------

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-malformed.csv")
    $preview = Get-Preview $upload.Json.data.uploadId

    $ok =
        $preview.StatusCode -eq 422 -and
        $preview.Json.error.code -eq "MALFORMED_CSV"

    Write-TestResult `
        "Malformed CSV handled" `
        $ok `
        "$($preview.Json.error.code) - HTTP $($preview.StatusCode)"
}
catch {
    Write-TestResult "Malformed CSV handled" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 14. Invalid upload ID
# ------------------------------------------------------------

try {
    $response = Invoke-CurlJson @(
        "$ApiBase/files/not-a-valid-id/preview"
    )

    Write-TestResult `
        "Invalid upload ID rejected" `
        ($response.StatusCode -eq 400 -and $response.Json.error.code -eq "INVALID_UPLOAD_ID") `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Invalid upload ID rejected" $false $_.Exception.Message
}

# ------------------------------------------------------------
# 15. Server still healthy after errors
# ------------------------------------------------------------

try {
    $health = Invoke-RestMethod "$ApiBase/health"

    Write-TestResult `
        "Server survives upload/preview errors" `
        ($health.success -eq $true) `
        $health.message
}
catch {
    Write-TestResult `
        "Server survives upload/preview errors" `
        $false `
        $_.Exception.Message
}

# ------------------------------------------------------------
# Clean local testing files
# ------------------------------------------------------------

Remove-Item $UppercaseCsv -Force -ErrorAction SilentlyContinue
Remove-Item $TxtFile -Force -ErrorAction SilentlyContinue
Remove-Item $EmptyFile -Force -ErrorAction SilentlyContinue
Remove-Item $HeadersOnly -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# Final report
# ------------------------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Verification Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$Results | Format-Table -AutoSize

Write-Host ""
Write-Host "Passed: $Passed" -ForegroundColor Green
Write-Host "Failed: $Failed" -ForegroundColor $(if ($Failed -eq 0) { "Green" } else { "Red" })

if ($Failed -eq 0) {
    Write-Host ""
    Write-Host "WEEK 1 BACKEND VERIFICATION PASSED." -ForegroundColor Green
    exit 0
}
else {
    Write-Host ""
    Write-Host "Some Week 1 tests require attention." -ForegroundColor Yellow
    exit 1
}
