param(
    [int]$Count = 20,
    [string]$AuthorContains = "",
    [string]$Since = "",
    [string]$Path = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-LineRangeText {
    param(
        [int]$Start,
        [int]$CountValue
    )
    if ($CountValue -le 0) { return "none" }
    if ($CountValue -eq 1) { return "$Start" }
    return "$Start-$($Start + $CountValue - 1)"
}

$logArgs = @("log", "--date=iso", "--pretty=format:%H")
if ($Count -gt 0) {
    $logArgs += @("-n", "$Count")
}
if ($AuthorContains) {
    $logArgs += @("--author=$AuthorContains")
}
if ($Since) {
    $logArgs += @("--since=$Since")
}
if ($Path) {
    $logArgs += "--"
    $logArgs += $Path
}

$commitsRaw = git @logArgs
if (-not $commitsRaw) {
    Write-Output "No commits found for the selected filters."
    exit 0
}

$commits = $commitsRaw -split "`r?`n" | Where-Object { $_ -and $_.Trim().Length -gt 0 }

foreach ($sha in $commits) {
    $meta = git show -s --date=iso --pretty=format:"%h|%an|%ad|%s" $sha
    if (-not $meta) { continue }

    $parts = $meta -split "\|", 4
    if ($parts.Count -lt 4) { continue }

    $shortSha = $parts[0]
    $author = $parts[1]
    $date = $parts[2]
    $subject = $parts[3]

    Write-Output ""
    Write-Output "Commit: $shortSha"
    Write-Output "Author: $author"
    Write-Output "Date  : $date"
    Write-Output "Title : $subject"

    $diff = git show --unified=0 --pretty=format: $sha
    $lines = $diff -split "`r?`n"

    $currentFile = ""
    foreach ($line in $lines) {
        if ($line -match '^diff --git a/(.+) b/(.+)$') {
            $currentFile = $matches[2]
            continue
        }

        if ($line -match '^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@') {
            $oldStart = [int]$matches[1]
            $oldCount = if ($matches[2]) { [int]$matches[2] } else { 1 }
            $newStart = [int]$matches[3]
            $newCount = if ($matches[4]) { [int]$matches[4] } else { 1 }

            $oldRange = Get-LineRangeText -Start $oldStart -CountValue $oldCount
            $newRange = Get-LineRangeText -Start $newStart -CountValue $newCount
            Write-Output "  File: $currentFile | old lines: $oldRange -> new lines: $newRange"
        }
    }
}

