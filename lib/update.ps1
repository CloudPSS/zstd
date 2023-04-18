
Push-Location "$PSScriptRoot/zstd"

git fetch --all --tags

$latest = $(git tag --list 'v*' | ? { $_ -match '^v\d+\.\d+\.\d+$' } | % { [version]($_.SubString(1)) } | Sort-Object -Descending | % { "v$_" })[0]

Write-Output "Latest zstd version: $latest"

git checkout "tags/$latest"

Pop-Location