extern "C"
{
#include "zstd.c"
}
#include <napi.h>
#include <iostream>

#if 0
#define DEBUG(x) \
  (std::cout << x << std::endl)
#else
#define DEBUG(x)
#endif

#define _THROW_IF_FAILED(cond, error, returns)                 \
  if (!(cond))                                                 \
  {                                                            \
    Napi::Error::New(env, error).ThrowAsJavaScriptException(); \
    return returns;                                            \
  }

#define _THROW_TYPE_ERROR_IF_FAILED(cond, error, returns)          \
  if (!(cond))                                                     \
  {                                                                \
    Napi::TypeError::New(env, error).ThrowAsJavaScriptException(); \
    return returns;                                                \
  }

#define THROW_IF_FAILED(cond, error) _THROW_IF_FAILED(cond, error, env.Null())
#define THROW_TYPE_ERROR_IF_FAILED(cond, error) _THROW_TYPE_ERROR_IF_FAILED(cond, error, env.Null())

#define THROW_IF_FAILED_VOID(cond, error) _THROW_IF_FAILED(cond, error, )
#define THROW_TYPE_ERROR_IF_FAILED_VOID(cond, error) _THROW_TYPE_ERROR_IF_FAILED(cond, error, )

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

class Compressor : public Napi::ObjectWrap<Compressor>
{
public:
  static Napi::Object Init(Napi::Env &env, Napi::Object &exports)
  {
    Napi::Function func = DefineClass(env, "Compressor",
                                      {
                                          InstanceMethod("data", &Compressor::Data),
                                          InstanceMethod("end", &Compressor::End),
                                      });
    exports.Set("Compressor", func);
    return exports;
  }

  Compressor(const Napi::CallbackInfo &info) : Napi::ObjectWrap<Compressor>(info), ctx(nullptr)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED_VOID(info.Length() == 1, "Wrong number of arguments");
    THROW_TYPE_ERROR_IF_FAILED_VOID(info[0].IsNumber(), "Wrong argument 0");
    auto level = info[0].As<Napi::Number>().Int32Value();

    ctx = ZSTD_createCStream();
    THROW_IF_FAILED_VOID(ctx != NULL, "Failed to create compression context");
    auto code = ZSTD_initCStream(ctx, level);
    THROW_IF_FAILED_VOID(!ZSTD_isError(code), ZSTD_getErrorName(code));
    DEBUG("[Compressor]");
  }

  ~Compressor()
  {
    ZSTD_freeCStream(ctx);
    ctx = nullptr;
    DEBUG("[~Compressor]");
  }

private:
  ZSTD_CStream *ctx;

  Napi::Value Data(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED(info.Length() == 2, "Wrong number of arguments");
    THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
    THROW_TYPE_ERROR_IF_FAILED(info[1].IsFunction(), "Wrong argument 1");
    auto inBuffer = info[0].As<Napi::Buffer<char>>();
    auto outBuffer = Napi::Buffer<char>::New(env, ZSTD_CStreamOutSize());
    auto callback = Napi::Persistent(info[1].As<Napi::Function>());

    ZSTD_inBuffer in = {inBuffer.Data(), inBuffer.Length(), 0};
    ZSTD_outBuffer out = {outBuffer.Data(), outBuffer.Length(), 0};

    while (in.pos < in.size)
    {
      auto code = ZSTD_compressStream(ctx, &out, &in);
      DEBUG("[Compress] code: " << code << ", in.pos: " << in.pos << ", in.size: " << in.size << ", out.pos: " << out.pos << ", out.size: " << out.size);
      THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
      if (out.pos == out.size)
      {
        DEBUG("[Compress] send chunk: " << out.pos);
        callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.size)});
        out.pos = 0;
      }
    }
    if (out.pos > 0)
    {
      DEBUG("[Compress] send chunk final: " << out.pos);
      callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.pos)});
    }
    return env.Undefined();
  }

  Napi::Value End(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED(info.Length() == 1, "Wrong number of arguments");
    THROW_TYPE_ERROR_IF_FAILED(info[0].IsFunction(), "Wrong argument 0");
    auto outBuffer = Napi::Buffer<char>::New(env, ZSTD_CStreamOutSize());
    ZSTD_outBuffer out = {outBuffer.Data(), outBuffer.Length(), 0};
    auto callback = Napi::Persistent(info[0].As<Napi::Function>());
    while (true)
    {
      auto code = ZSTD_endStream(ctx, &out);
      DEBUG("[End] code: " << code << ", out.pos: " << out.pos << ", out.size: " << out.size);
      THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
      if (out.pos == out.size)
      {
        DEBUG("[End] send chunk: " << out.pos);
        callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.size)});
        out.pos = 0;
      }
      if (code == 0)
        break;
    }
    if (out.pos > 0)
    {
      DEBUG("[End] send chunk final: " << out.pos);
      callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.pos)});
    }
    return env.Undefined();
  }
};

class Decompressor : public Napi::ObjectWrap<Decompressor>
{
public:
  static Napi::Object Init(Napi::Env &env, Napi::Object &exports)
  {
    Napi::Function func = DefineClass(env, "Decompressor",
                                      {
                                          InstanceMethod("data", &Decompressor::Data),
                                          InstanceMethod("end", &Decompressor::End),
                                      });
    exports.Set("Decompressor", func);
    return exports;
  }

  Decompressor(const Napi::CallbackInfo &info) : Napi::ObjectWrap<Decompressor>(info), ctx(nullptr)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED_VOID(info.Length() == 0, "Wrong number of arguments");

    ctx = ZSTD_createDStream();
    THROW_IF_FAILED_VOID(ctx != NULL, "Failed to create decompression context");
    auto code = ZSTD_initDStream(ctx);
    THROW_IF_FAILED_VOID(!ZSTD_isError(code), ZSTD_getErrorName(code));
    DEBUG("[Decompressor]");
  }

  ~Decompressor()
  {
    ZSTD_freeDStream(ctx);
    ctx = nullptr;
    DEBUG("[~Decompressor]");
  }

private:
  ZSTD_DStream *ctx;

  Napi::Value Data(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED(info.Length() == 2, "Wrong number of arguments");
    THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
    THROW_TYPE_ERROR_IF_FAILED(info[1].IsFunction(), "Wrong argument 1");
    auto inBuffer = info[0].As<Napi::Buffer<char>>();
    auto outBuffer = Napi::Buffer<char>::New(env, ZSTD_DStreamOutSize());
    auto callback = Napi::Persistent(info[1].As<Napi::Function>());

    ZSTD_inBuffer in = {inBuffer.Data(), inBuffer.Length(), 0};
    ZSTD_outBuffer out = {outBuffer.Data(), outBuffer.Length(), 0};

    while (in.pos < in.size)
    {
      auto code = ZSTD_decompressStream(ctx, &out, &in);
      DEBUG("[Decompress] code: " << code << ", in.pos: " << in.pos << ", in.size: " << in.size << ", out.pos: " << out.pos << ", out.size: " << out.size);
      THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
      if (out.pos == out.size)
      {
        DEBUG("[Decompress] send chunk: " << out.pos);
        callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.size)});
        out.pos = 0;
      }
    }
    if (out.pos > 0)
    {
      DEBUG("[Decompress] send chunk final: " << out.pos);
      callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.pos)});
    }
    return env.Undefined();
  }

  Napi::Value End(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED(info.Length() == 1, "Wrong number of arguments");
    THROW_TYPE_ERROR_IF_FAILED(info[0].IsFunction(), "Wrong argument 0");
    auto outBuffer = Napi::Buffer<char>::New(env, ZSTD_DStreamOutSize());
    ZSTD_outBuffer out = {outBuffer.Data(), outBuffer.Length(), 0};
    auto callback = Napi::Persistent(info[0].As<Napi::Function>());

    ZSTD_inBuffer dummy = {nullptr, 0, 0};
    auto code = ZSTD_decompressStream(ctx, &out, &dummy);
    DEBUG("[End] code: " << code << ", out.pos: " << out.pos << ", out.size: " << out.size);
    THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));

    if (out.pos > 0)
    {
      DEBUG("[End] send chunk: " << out.pos);
      callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.pos)});
      // Frame not complete
      THROW_IF_FAILED(code == 0, "Incomplete compressed data");
    }
    return env.Undefined();
  }
};

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

  EXPORT_VALUE(compressInputLength, ZSTD_CStreamInSize());
  EXPORT_VALUE(compressOutputLength, ZSTD_CStreamOutSize());
  EXPORT_VALUE(decompressInputLength, ZSTD_DStreamInSize());
  EXPORT_VALUE(decompressOutputLength, ZSTD_DStreamOutSize());
  Compressor::Init(env, exports);
  Decompressor::Init(env, exports);

  return exports;
}

NODE_API_MODULE(zstd, Init)
