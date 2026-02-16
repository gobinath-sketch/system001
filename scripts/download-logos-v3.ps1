$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
$Logos = @(
    @{ Name = "redhat.svg"; Url = "https://cdn.worldvectorlogo.com/logos/red-hat.svg" },
    @{ Name = "microsoft.svg"; Url = "https://cdn.worldvectorlogo.com/logos/microsoft-5.svg" },
    @{ Name = "blockchain.svg"; Url = "https://www.vectorlogo.zone/logos/blockchain/blockchain-icon.svg" },
    @{ Name = "trending.svg"; Url = "https://api.iconify.design/heroicons:arrow-trending-up.svg?color=%238884d8" },
    @{ Name = "ai_alliance.svg"; Url = "https://api.iconify.design/carbon:ai.svg" }
)

$DestDir = "client/src/assets/logos"

ForEach ($Logo in $Logos) {
    $FilePath = Join-Path $DestDir $Logo.Name
    Try {
        Invoke-WebRequest -Uri $Logo.Url -OutFile $FilePath -UserAgent $UserAgent
        Write-Host "Downloaded $($Logo.Name)"
    }
    Catch {
        Write-Host "Failed to download $($Logo.Name): $_"
    }
}
