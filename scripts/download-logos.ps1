$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
$Logos = @(
    @{ Name = "ibm.svg"; Url = "https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg" },
    @{ Name = "redhat.svg"; Url = "https://upload.wikimedia.org/wikipedia/commons/e/e0/Red_Hat_text_logo.svg" },
    @{ Name = "microsoft.svg"; Url = "https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo.svg" },
    @{ Name = "blockchain.svg"; Url = "https://upload.wikimedia.org/wikipedia/commons/archive/8/8c/20211026071018%21Blockchain.svg" }, 
    @{ Name = "tableau.svg"; Url = "https://cdn.worldvectorlogo.com/logos/tableau-software.svg" },
    @{ Name = "mulesoft.svg"; Url = "https://cdn.worldvectorlogo.com/logos/mulesoft-1.svg" },
    @{ Name = "trending.svg"; Url = "https://www.svgrepo.com/show/331304/trend-up.svg" },
    @{ Name = "ai_alliance.svg"; Url = "https://www.svgrepo.com/show/306354/artificial-intelligence.svg" }
)

$DestDir = "client/src/assets/logos"
If (!(Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir
}

ForEach ($Logo in $Logos) {
    $FilePath = Join-Path $DestDir $Logo.Name
    Try {
        Invoke-WebRequest -Uri $Logo.Url -OutFile $FilePath -UserAgent $UserAgent
        Write-Host "Downloaded $($Logo.Name)"
    }
    Catch {
        Write-Host "Failed to download $($Logo.Name): $_"
        # Try alternate URL for Blockchain if first fails
        If ($Logo.Name -eq "blockchain.svg") {
             Try {
                Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/commons/8/8c/Blockchain.svg" -OutFile $FilePath -UserAgent $UserAgent
                Write-Host "Downloaded $($Logo.Name) (Alternate)"
             } Catch { Write-Host "Alternate failed for $($Logo.Name)" }
        }
    }
}
