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
    param([string[]]$Arguments)

    $output = & curl.exe -sS @Arguments -w "`n%{http_code}"

    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe failed with exit code $LASTEXITCODE"
    }

    $lines = @($output)
    $statusCode = [int]$lines[-1]
    $bodyText = ($lines[0..($lines.Count - 2)] -join "`n").Trim()
    $json = if ($bodyText) { $bodyText | ConvertFrom-Json } else { $null }

    return [PSCustomObject]@{
        StatusCode = $statusCode
        Json = $json
        Raw = $bodyText
    }
}

function Upload-Csv {
    param([string]$Path)

    return Invoke-CurlJson @(
        "-X", "POST",
        "-F", "file=@$Path;type=text/csv",
        "$ApiBase/files/upload"
    )
}

function Invoke-MappingPreview {
    param(
        [string]$UploadId,
        [object[]]$Mappings,
        [string]$TempName
    )

    $payloadPath = Join-Path $env:TEMP $TempName

    @{
        mappings = $Mappings
    } |
        ConvertTo-Json -Depth 6 |
        Set-Content -Encoding UTF8 $payloadPath

    try {
        return Invoke-CurlJson @(
            "-X", "POST",
            "-H", "Content-Type: application/json",
            "--data-binary", "@$payloadPath",
            "$ApiBase/files/$UploadId/mapping/preview"
        )
    }
    finally {
        Remove-Item $payloadPath -Force -ErrorAction SilentlyContinue
    }
}

$Mappings = @(
    @{ sourceKey = "employee_id"; sourceIndex = 0; destinationField = "employeeId" },
    @{ sourceKey = "name"; sourceIndex = 1; destinationField = "fullName" },
    @{ sourceKey = "department"; sourceIndex = 2; destinationField = "department" },
    @{ sourceKey = "email"; sourceIndex = 3; destinationField = "email" },
    @{ sourceKey = "salary"; sourceIndex = 4; destinationField = "salary" }
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " StreamWeaver Week 2 Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

try {
    $health = Invoke-RestMethod "$ApiBase/health"
    Write-TestResult "Health API" ($health.success -eq $true) $health.message
}
catch {
    Write-TestResult "Health API" $false $_.Exception.Message
    exit 1
}

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-small.csv")
    $uploadId = $upload.Json.data.uploadId
    $response = Invoke-MappingPreview $uploadId $Mappings "streamweaver-week2-small.json"
    $data = $response.Json.data

    $ok =
        $response.StatusCode -eq 200 -and
        $data.previewCount -eq 20 -and
        $data.hasMoreRows -eq $false -and
        $data.rows[0].data.employeeId -eq "1" -and
        $data.rows[0].data.fullName

    Write-TestResult `
        "Small CSV mapping pipeline" `
        $ok `
        "rows=$($data.previewCount), employeeId=$($data.rows[0].data.employeeId)"
}
catch {
    Write-TestResult "Small CSV mapping pipeline" $false $_.Exception.Message
}

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-preview-limit.csv")
    $response = Invoke-MappingPreview $upload.Json.data.uploadId $Mappings "streamweaver-week2-limit.json"
    $data = $response.Json.data

    $ok =
        $response.StatusCode -eq 200 -and
        $data.previewCount -eq 25 -and
        $data.previewLimit -eq 25 -and
        $data.hasMoreRows -eq $true

    Write-TestResult `
        "Bounded mapping preview" `
        $ok `
        "rows=$($data.previewCount)/$($data.previewLimit), more=$($data.hasMoreRows)"
}
catch {
    Write-TestResult "Bounded mapping preview" $false $_.Exception.Message
}

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-small.csv")
    $duplicateMappings = @(
        @{ sourceKey = "employee_id"; sourceIndex = 0; destinationField = "sameField" },
        @{ sourceKey = "name"; sourceIndex = 1; destinationField = "sameField" }
    )

    $response = Invoke-MappingPreview $upload.Json.data.uploadId $duplicateMappings "streamweaver-week2-duplicate.json"

    Write-TestResult `
        "Duplicate destination rejected" `
        ($response.StatusCode -eq 400 -and $response.Json.error.code -eq "MAPPING_DUPLICATE_DESTINATION") `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Duplicate destination rejected" $false $_.Exception.Message
}

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-small.csv")
    $missingSourceMappings = @(
        @{ sourceKey = "missing"; sourceIndex = 99; destinationField = "missing" }
    )

    $response = Invoke-MappingPreview $upload.Json.data.uploadId $missingSourceMappings "streamweaver-week2-source.json"

    Write-TestResult `
        "Missing source column rejected" `
        ($response.StatusCode -eq 400 -and $response.Json.error.code -eq "MAPPING_SOURCE_NOT_FOUND") `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Missing source column rejected" $false $_.Exception.Message
}

try {
    $upload = Upload-Csv (Join-Path $Samples "employees-small.csv")
    $invalidDestinationMappings = @(
        @{ sourceKey = "employee_id"; sourceIndex = 0; destinationField = '$employee.id' }
    )

    $response = Invoke-MappingPreview $upload.Json.data.uploadId $invalidDestinationMappings "streamweaver-week2-destination.json"

    Write-TestResult `
        "Invalid destination field rejected" `
        ($response.StatusCode -eq 400 -and $response.Json.error.code -eq "INVALID_DESTINATION_FIELD") `
        "$($response.Json.error.code) - HTTP $($response.StatusCode)"
}
catch {
    Write-TestResult "Invalid destination field rejected" $false $_.Exception.Message
}

try {
    $health = Invoke-RestMethod "$ApiBase/health"
    Write-TestResult `
        "Server survives mapping errors" `
        ($health.success -eq $true) `
        $health.message
}
catch {
    Write-TestResult "Server survives mapping errors" $false $_.Exception.Message
}

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
    Write-Host "WEEK 2 MAPPING/TRANSFORM VERIFICATION PASSED." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Some Week 2 tests require attention." -ForegroundColor Yellow
exit 1
