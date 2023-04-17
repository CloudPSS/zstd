
Push-Location "$PSScriptRoot/.."

$DEBUG = $false

docker run --rm -v ${PWD}:/src emscripten/emsdk `
  emcc ./lib/zstd.c -o ./prebuilds/zstd.js `
  --memory-init-file 0 `
  -sSTRICT `
  -sMALLOC=emmalloc `
  -sEXPORTED_FUNCTIONS="['_ZSTD_isError', '_ZSTD_getFrameContentSize', '_ZSTD_decompress', '_ZSTD_compress', '_ZSTD_compressBound', '_malloc', '_free']" `
  -sFILESYSTEM=0 `
  -sALLOW_MEMORY_GROWTH=1 `
  -sSINGLE_FILE=1 `
  -sINCOMING_MODULE_JS_API="[]" `
  -sMODULARIZE `
  -sEXPORT_ES6 `
$(if ($DEBUG) { "-O1", "-g3", "-sASSERTIONS=1" } else { "-flto", "-O3", "--closure", "1" } )

Pop-Location
