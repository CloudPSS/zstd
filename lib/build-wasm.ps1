param(
  [switch]$DEBUG
)

Push-Location "$PSScriptRoot/.."

# We use -sSINGLE_FILE=1 to encode the wasm binary into the js file, so environment is useless, 
# to avoid nodejs module require (require("node:fs")) which is problematic in some bundlers, we use -sENVIRONMENT="web"
# To load this module in nodejs, -sASSERTIONS=0 is required, since the asset will reject the nodejs environment

$ExportedFunctions = 'ZSTD_versionNumber', 'ZSTD_isError', 'ZSTD_getErrorName', 'ZSTD_compressBound', 'ZSTD_decompressBound', 'compress', 'CompressorCreate', 'CompressorData', 'CompressorEnd', 'DecompressorCreate', 'DecompressorData', 'DecompressorEnd', 'decompress', 'malloc', 'free', 'usedmem'
$ExportedRuntimeMethods = 'UTF8ToString', 'HEAPU8'

docker run --rm -v ${PWD}:/src emscripten/emsdk `
  emcc ./lib/wasm.cc -o ./prebuilds/zstd.js `
  --js-library ./lib/wasm.js `
  -sSTRICT `
  -sMALLOC=emmalloc `
  -sEXPORTED_FUNCTIONS="[$($ExportedFunctions | ForEach-Object { "_$_" } | Join-String -Separator ',' -SingleQuote )]" `
  -sFILESYSTEM=0 `
  -sMINIMAL_RUNTIME=1 `
  -sEXPORT_KEEPALIVE=1 `
  -sSINGLE_FILE=1 `
  -sWASM_BIGINT=1 `
  -sALLOW_MEMORY_GROWTH=1 `
  -sINCOMING_MODULE_JS_API="[]" `
  -sEXPORTED_RUNTIME_METHODS="[$($ExportedRuntimeMethods | Join-String -Separator ',' -SingleQuote )]" `
  -sENVIRONMENT="web" `
  -sASSERTIONS=0 `
  -sMODULARIZE `
  -sEXPORT_ES6 `
$(if ($DEBUG) { "-O1", "-g3", "-DDEBUG" } else { "-flto", "-O3", "--closure", "1", "-DNDEBUG" } )

Pop-Location
