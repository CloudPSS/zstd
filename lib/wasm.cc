#include <malloc.h>
#include <unistd.h>
#include <memory>
#include "emscripten.h"

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

static auto cBufferCapacity = ZSTD_CStreamOutSize();
static auto cBuffer = malloc(cBufferCapacity);

extern "C" ZSTD_CStream *CompressorCreate(int compressionLevel)
{
  auto ctx = ZSTD_createCStream();
  if (ctx == nullptr)
    return nullptr;
  auto code = ZSTD_initCStream(ctx, compressionLevel);
  if (ZSTD_isError(code))
  {
    ZSTD_freeCStream(ctx);
    return reinterpret_cast<ZSTD_CStream *>(code);
  }
  return ctx;
}

EM_IMPORT(onCompressorData)
extern "C" void onCompressorData(ZSTD_CStream *ctx, void *dst, size_t dstSize);

extern "C" size_t
CompressorData(ZSTD_CStream *ctx, const void *src, size_t srcSize)
{
  ZSTD_inBuffer in = {src, srcSize, 0};
  ZSTD_outBuffer out = {cBuffer, cBufferCapacity, 0};
  while (in.pos < in.size)
  {
    auto code = ZSTD_compressStream(ctx, &out, &in);
    if (ZSTD_isError(code))
    {
      ZSTD_freeCStream(ctx);
      return code;
    }
    if (out.pos == out.size)
    {
      onCompressorData(ctx, out.dst, out.pos);
      out.pos = 0;
    }
  }
  if (out.pos > 0)
  {
    onCompressorData(ctx, out.dst, out.pos);
  }
  return 0;
}

extern "C" size_t
CompressorEnd(ZSTD_CStream *ctx)
{
  ZSTD_outBuffer out = {cBuffer, cBufferCapacity, 0};
  while (true)
  {
    auto code = ZSTD_endStream(ctx, &out);
    if (ZSTD_isError(code))
    {
      ZSTD_freeCStream(ctx);
      return code;
    }
    if (out.pos == out.size)
    {
      onCompressorData(ctx, out.dst, out.pos);
      out.pos = 0;
    }
    if (code == 0)
    {
      break;
    }
  }
  if (out.pos > 0)
  {
    onCompressorData(ctx, out.dst, out.pos);
  }
  return ZSTD_freeCStream(ctx);
}

static auto dBufferCapacity = ZSTD_DStreamOutSize();
static auto dBuffer = malloc(dBufferCapacity);

extern "C" ZSTD_DStream *DecompressorCreate()
{
  auto ctx = ZSTD_createDStream();
  if (ctx == nullptr)
    return nullptr;
  auto code = ZSTD_initDStream(ctx);
  if (ZSTD_isError(code))
  {
    ZSTD_freeDStream(ctx);
    return reinterpret_cast<ZSTD_DStream *>(code);
  }
  return ctx;
}

EM_IMPORT(onDecompressorData)
extern "C" void onDecompressorData(ZSTD_DStream *ctx, void *dst, size_t dstSize);

extern "C" size_t DecompressorData(ZSTD_DStream *ctx, const void *src, size_t srcSize)
{
  ZSTD_inBuffer in = {src, srcSize, 0};
  ZSTD_outBuffer out = {dBuffer, dBufferCapacity, 0};
  while (in.pos < in.size)
  {
    auto code = ZSTD_decompressStream(ctx, &out, &in);
    if (ZSTD_isError(code))
    {
      ZSTD_freeDStream(ctx);
      return code;
    }
    if (out.pos == out.size)
    {
      onDecompressorData(ctx, out.dst, out.pos);
      out.pos = 0;
    }
  }
  if (out.pos > 0)
  {
    onDecompressorData(ctx, out.dst, out.pos);
  }
  return 0;
}

extern "C" size_t DecompressorEnd(ZSTD_DStream *ctx)
{
  ZSTD_inBuffer dummy = {nullptr, 0, 0};
  ZSTD_outBuffer out = {dBuffer, dBufferCapacity, 0};
  auto code = ZSTD_decompressStream(ctx, &out, &dummy);
  if (ZSTD_isError(code))
  {
    ZSTD_freeDStream(ctx);
    return code;
  }
  if (out.pos > 0)
  {
    onDecompressorData(ctx, out.dst, out.pos);
  }
  return 0;
}