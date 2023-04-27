param(
  [switch]$DEBUG
)

Push-Location "$PSScriptRoot/.."

# We use -sSINGLE_FILE=1 to encode the wasm binary into the js file, so environment is useless, 
# to avoid nodejs module require (require("node:fs")) which is problematic in some bundlers, we use -sENVIRONMENT="web"
# To load this module in nodejs, -sASSERTIONS=0 is required, since the asset will reject the nodejs environment

docker run --rm -v ${PWD}:/src emscripten/emsdk `
  emcc ./lib/wasm.c -o ./prebuilds/zstd.js `
  --memory-init-file 0 `
  -sSTRICT `
  -sMALLOC=emmalloc `
  -sEXPORTED_FUNCTIONS="['_ZSTD_versionNumber', '_ZSTD_isError', '_ZSTD_getErrorName', '_ZSTD_getFrameContentSize', '_ZSTD_decompress', '_ZSTD_compress', '_ZSTD_compressBound', '_malloc', '_free', '_usedmem']" `
  -sFILESYSTEM=0 `
  -sALLOW_MEMORY_GROWTH=1 `
  -sSINGLE_FILE=1 `
  -sINCOMING_MODULE_JS_API="[]" `
  -sEXPORTED_RUNTIME_METHODS="['UTF8ToString']" `
  -sENVIRONMENT="web" `
  -sASSERTIONS=0 `
  -sMODULARIZE `
  --extern-post-js ./lib/post.js `
$(if ($DEBUG) { "-O1", "-g3", "-DDEBUG" } else { "-flto", "-O3", "--closure", "1", "-DNDEBUG" } )

Pop-Location
