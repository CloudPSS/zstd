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
  auto codeOrSize = ZSTD_compress(outBuffer.Data(), maxSize, inBuffer.Data(),
                                  inBuffer.Length(), level);
  THROW_IF_FAILED(!ZSTD_isError(codeOrSize), ZSTD_getErrorName(codeOrSize));
  return Napi::Buffer<char>::Copy(env, outBuffer.Data(), codeOrSize);
}

Napi::Value decompress(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  THROW_TYPE_ERROR_IF_FAILED(info.Length() == 2, "Wrong number of arguments");
  THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
  THROW_TYPE_ERROR_IF_FAILED(info[1].IsNumber(), "Wrong argument 1");
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto maxSize = info[1].As<Napi::Number>().Int64Value();
  auto outSize = ZSTD_getFrameContentSize(inBuffer.Data(), inBuffer.Length());
  THROW_IF_FAILED(outSize != ZSTD_CONTENTSIZE_ERROR,
                  "Invalid compressed data");
  THROW_IF_FAILED(outSize != ZSTD_CONTENTSIZE_UNKNOWN,
                  "Unknown content size");
  THROW_IF_FAILED(outSize < (uint64_t)maxSize, "Content size is too large");
  auto outBuffer = Napi::Buffer<char>::New(env, outSize);
  auto code = ZSTD_decompress(outBuffer.Data(), outSize, inBuffer.Data(),
                              inBuffer.Length());
  THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
  return outBuffer;
}

Napi::String version(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  return Napi::String::New(env, ZSTD_versionString());
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  exports.Set(Napi::String::New(env, "compress"),
              Napi::Function::New(env, compress));
  exports.Set(Napi::String::New(env, "decompress"),
              Napi::Function::New(env, decompress));
  exports.Set(Napi::String::New(env, "version"),
              Napi::Function::New(env, version));
  return exports;
}

NODE_API_MODULE(zstd, Init)
