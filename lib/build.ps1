
Push-Location "$PSScriptRoot/zstd/build/single_file_libs"

bash ./create_single_file_library.sh

Copy-Item ./zstd.c ../../../zstd.c

Pop-Location