Push-Location "$PSScriptRoot"

docker run --rm -v ${PWD}:/src emscripten/emsdk `
  emcc ./zstd.c -o ./zstd.js `
  -flto --closure 1 -O3 `
  --memory-init-file 0 `
  -s EXPORTED_FUNCTIONS="['_ZSTD_isError', '_ZSTD_getFrameContentSize', '_ZSTD_decompress', '_ZSTD_compress', '_ZSTD_compressBound', '_malloc', '_free']" `
  -s FILESYSTEM=0 `
  -s ALLOW_MEMORY_GROWTH=1 `
  -s SINGLE_FILE=1 `
  -s INCOMING_MODULE_JS_API="[]" `
  -s ENVIRONMENT="web,worker" `
  -s EXPORT_ES6

"
export const VERSION = '$latest';
" >> ./zstd.js

Pop-Location