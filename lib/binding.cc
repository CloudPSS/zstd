extern "C"
{
#include "zstd.c"
}
#include <napi.h>

#define THROW_IF_FAILED(cond, error)                           \
  if (!(cond))                                                 \
  {                                                            \
    Napi::Error::New(env, error).ThrowAsJavaScriptException(); \
    return env.Null();                                         \
  }

#define THROW_TYPE_ERROR_IF_FAILED(cond, error)                    \
  if (!(cond))                                                     \
  {                                                                \
    Napi::TypeError::New(env, error).ThrowAsJavaScriptException(); \
    return env.Null();                                             \
  }

static ZSTD_CCtx *const compressCtx = ZSTD_createCCtx();
Napi::Value compress(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  THROW_TYPE_ERROR_IF_FAILED(info.Length() == 2, "Wrong number of arguments");
  THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
  THROW_TYPE_ERROR_IF_FAILED(info[1].IsNumber(), "Wrong argument 1");
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto level = info[1].As<Napi::Number>().Int32Value();
  auto maxSize = ZSTD_compressBound(inBuffer.Length());
  auto outBuffer = Napi::Buffer<char>::New(env, maxSize);
  auto codeOrSize = ZSTD_compressCCtx(compressCtx,
                                      outBuffer.Data(), maxSize,
                                      inBuffer.Data(), inBuffer.Length(),
                                      level);
  THROW_IF_FAILED(!ZSTD_isError(codeOrSize), ZSTD_getErrorName(codeOrSize));
  return Napi::Buffer<char>::Copy(env, outBuffer.Data(), codeOrSize);
}

static ZSTD_DCtx *const decompressCtx = ZSTD_createDCtx();
Napi::Value decompress(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  THROW_TYPE_ERROR_IF_FAILED(info.Length() == 2, "Wrong number of arguments");
  THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
  THROW_TYPE_ERROR_IF_FAILED(info[1].IsNumber(), "Wrong argument 1");
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto maxSize = info[1].As<Napi::Number>().Int64Value();
  auto outSize = ZSTD_decompressBound(inBuffer.Data(), inBuffer.Length());
  THROW_IF_FAILED(outSize != ZSTD_CONTENTSIZE_ERROR,
                  "Invalid compressed data");
  THROW_IF_FAILED(outSize < (uint64_t)maxSize, "Content size is too large");
  auto outBuffer = Napi::Buffer<char>::New(env, outSize);
  auto code = ZSTD_decompressDCtx(decompressCtx,
                                  outBuffer.Data(), outSize,
                                  inBuffer.Data(), inBuffer.Length());
  THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
  if (code == outSize)
    return outBuffer;
  return Napi::Buffer<char>::Copy(env, outBuffer.Data(), code);
}

#define EXPORT_FUNCTION(name) \
  exports.Set(#name, Napi::Function::New(env, name, #name));

#define EXPORT_VALUE(name, value) \
  exports.Set(#name, value);

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  EXPORT_FUNCTION(compress);
  EXPORT_FUNCTION(decompress);
  EXPORT_VALUE(version, Napi::String::New(env, ZSTD_versionString()));
  EXPORT_VALUE(minLevel, ZSTD_minCLevel());
  EXPORT_VALUE(maxLevel, ZSTD_maxCLevel());
  EXPORT_VALUE(defaultLevel, ZSTD_defaultCLevel());
  return exports;
}

NODE_API_MODULE(zstd, Init)
