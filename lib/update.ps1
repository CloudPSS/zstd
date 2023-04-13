
Push-Location "$PSScriptRoot/zstd"

git fetch --all --tags

$latest = $(git tag --list 'v*' | % { [version]($_.SubString(1)) } | Sort-Object -Descending | % { "v$_" })[0]

Write-Output "Current zstd version: $latest"

git checkout "tags/$latest"

Pop-Location