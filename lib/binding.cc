extern "C"
{
#include "zstd.c"
}
#include <napi.h>

Napi::Value compress(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  if (info.Length() != 2)
  {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  if (!info[0].IsBuffer())
  {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return env.Null();
  }
  if (!info[1].IsNumber())
  {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return env.Null();
  }
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto level = info[1].As<Napi::Number>().Int32Value();

  auto maxSize = ZSTD_compressBound(inBuffer.Length());
  auto outBuffer = Napi::Buffer<char>::New(env, maxSize);
  auto code = ZSTD_compress(outBuffer.Data(), maxSize, inBuffer.Data(),
                            inBuffer.Length(), level);
  if (ZSTD_isError(code))
  {
    Napi::Error::New(env, ZSTD_getErrorName(code)).ThrowAsJavaScriptException();
    return env.Null();
  }

  auto resultBuffer = Napi::Buffer<char>::New(env, code);
  memcpy(resultBuffer.Data(), outBuffer.Data(), code);
  return resultBuffer;
}

Napi::Value decompress(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  if (info.Length() != 2)
  {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  if (!info[0].IsBuffer())
  {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return env.Null();
  }
  if (!info[1].IsNumber())
  {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return env.Null();
  }
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto maxSize = info[1].As<Napi::Number>().Int64Value();
  auto outSize = ZSTD_getFrameContentSize(inBuffer.Data(), inBuffer.Length());
  if (outSize == ZSTD_CONTENTSIZE_ERROR)
  {
    Napi::Error::New(env, "Invalid frame").ThrowAsJavaScriptException();
    return env.Null();
  }
  if (outSize == ZSTD_CONTENTSIZE_UNKNOWN)
  {
    Napi::Error::New(env, "Unknown frame size").ThrowAsJavaScriptException();
    return env.Null();
  }
  if (outSize > (uint64_t)maxSize)
  {
    Napi::Error::New(env, "Frame size is too large")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  auto outBuffer = Napi::Buffer<char>::New(env, outSize);
  auto code = ZSTD_decompress(outBuffer.Data(), outSize, inBuffer.Data(),
                              inBuffer.Length());
  if (ZSTD_isError(code))
  {
    Napi::Error::New(env, ZSTD_getErrorName(code)).ThrowAsJavaScriptException();
    return env.Null();
  }
  return outBuffer;
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  exports.Set(Napi::String::New(env, "compress"),
              Napi::Function::New(env, compress));
  exports.Set(Napi::String::New(env, "decompress"),
              Napi::Function::New(env, decompress));
  return exports;
}

NODE_API_MODULE(zstd, Init)
