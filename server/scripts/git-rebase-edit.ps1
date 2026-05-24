param([string]$filePath)
$contents = Get-Content -LiteralPath $filePath
$contents = $contents -replace '^pick 3d54a59', 'edit 3d54a59'
Set-Content -LiteralPath $filePath -Value $contents
