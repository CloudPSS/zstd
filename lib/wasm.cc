#include <malloc.h>
#include <unistd.h>

// @see https://github.com/emscripten-core/emscripten/blob/9bb322f8a7ee89d6ac67e828b9c7a7022ddf8de2/tests/mallinfo.cpp

extern "C" unsigned int usedmem()
{
  struct mallinfo i = mallinfo();
  unsigned int dynamicTop = (unsigned int)sbrk(0);
  return dynamicTop - i.fordblks;
}

extern "C"
{
#include "zstd.c"
}

static ZSTD_CCtx *const compressCtx = ZSTD_createCCtx();
extern "C" size_t compress(
    void *dst, size_t dstCapacity,
    const void *src, size_t srcSize,
    int compressionLevel)
{
  return ZSTD_compressCCtx(compressCtx, dst, dstCapacity, src, srcSize, compressionLevel);
}

static ZSTD_DCtx *const decompressCtx = ZSTD_createDCtx();
extern "C" size_t decompress(
    void *dst, size_t dstCapacity,
    const void *src, size_t srcSize)
{
  return ZSTD_decompressDCtx(decompressCtx, dst, dstCapacity, src, srcSize);
}