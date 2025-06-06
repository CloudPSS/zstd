extern "C"
{
#include "zstd.c"
}
#include <napi.h>
#include <iostream>

#ifdef DEBUG
#define DEBUG_LOG(x) \
  (std::cout << x << std::endl)
#else
#define DEBUG_LOG(x)
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

class CompressWorker : public Napi::AsyncWorker
{
public:
  CompressWorker(Napi::Function &callback, Napi::Buffer<char> &inBuffer, int level)
      : Napi::AsyncWorker(callback), level(level), inBufferSize(inBuffer.Length()),
        inBufferPtr(inBuffer.Data()), inBufferRef((Napi::Persistent(inBuffer.As<Napi::Object>()))),
        outBufferSize(ZSTD_compressBound(inBufferSize)), outBuffer(std::make_unique<char[]>(outBufferSize)),
        codeOrSize(0)
  {
    DEBUG_LOG("[CompressWorker] Constructor level: " << level << ", inBufferSize: " << inBufferSize << ", outBufferSize: " << outBufferSize);
  }

  void Execute() override
  {
    DEBUG_LOG("[CompressWorker] Execute");
    auto compressCtx = ZSTD_createCCtx();
    codeOrSize = ZSTD_compressCCtx(compressCtx,
                                   outBuffer.get(), outBufferSize,
                                   inBufferPtr, inBufferSize,
                                   level);
    ZSTD_freeCCtx(compressCtx);
    DEBUG_LOG("[CompressWorker] codeOrSize: " << codeOrSize);
  }

  void OnOK() override
  {
    DEBUG_LOG("[CompressWorker] OnOK");
    Napi::HandleScope scope(Env());
    if (ZSTD_isError(codeOrSize))
    {
      Callback().Call({
          Napi::String::New(Env(), ZSTD_getErrorName(codeOrSize)),
          Env().Null(),
      });
    }
    else
    {
      Callback().Call({
          Env().Null(),
          Napi::Buffer<char>::Copy(Env(), outBuffer.get(), codeOrSize),
      });
    }
  }

  ~CompressWorker()
  {
    DEBUG_LOG("[~CompressWorker] Destructor");
  }

private:
  int level;

  size_t inBufferSize;
  char *inBufferPtr;
  Napi::ObjectReference inBufferRef;

  size_t outBufferSize;
  std::unique_ptr<char[]> outBuffer;

  size_t codeOrSize;
};

Napi::Value compress_async(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  THROW_TYPE_ERROR_IF_FAILED(info.Length() == 3, "Wrong number of arguments");
  THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
  THROW_TYPE_ERROR_IF_FAILED(info[1].IsNumber(), "Wrong argument 1");
  THROW_TYPE_ERROR_IF_FAILED(info[2].IsFunction(), "Wrong argument 2");
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto level = info[1].As<Napi::Number>().Int32Value();
  auto callback = info[2].As<Napi::Function>();
  DEBUG_LOG("[compress_async] args checked");
  auto worker = new CompressWorker(callback, inBuffer, level);
  worker->Queue();
  return env.Undefined();
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

class DecompressWorker : public Napi::AsyncWorker
{
public:
  DecompressWorker(Napi::Function &callback, Napi::Buffer<char> &inBuffer, size_t outSize)
      : Napi::AsyncWorker(callback),
        inBufferSize(inBuffer.Length()), inBufferPtr(inBuffer.Data()), inBufferRef((Napi::Persistent(inBuffer.As<Napi::Object>()))),
        outBufferSize(outSize), outBuffer(std::make_unique<char[]>(outBufferSize)),
        codeOrSize(0)
  {
    DEBUG_LOG("[DecompressWorker] Constructor inBufferSize: " << inBufferSize << ", outBufferSize: " << outBufferSize);
  }

  void Execute() override
  {
    DEBUG_LOG("[DecompressWorker] Execute");
    auto decompressCtx = ZSTD_createDCtx();
    codeOrSize = ZSTD_decompressDCtx(decompressCtx,
                                     outBuffer.get(), outBufferSize,
                                     inBufferPtr, inBufferSize);
    ZSTD_freeDCtx(decompressCtx);
    DEBUG_LOG("[DecompressWorker] codeOrSize: " << codeOrSize);
  }

  void OnOK() override
  {
    DEBUG_LOG("[DecompressWorker] OnOK");
    Napi::HandleScope scope(Env());
    if (ZSTD_isError(codeOrSize))
    {
      Callback().Call({
          Napi::String::New(Env(), ZSTD_getErrorName(codeOrSize)),
          Env().Null(),
      });
    }
    else
    {
      Callback().Call({
          Env().Null(),
          Napi::Buffer<char>::Copy(Env(), outBuffer.get(), codeOrSize),
      });
    }
  }

  ~DecompressWorker()
  {
    DEBUG_LOG("[~DecompressWorker] Destructor");
  }

private:
  size_t inBufferSize;
  char *inBufferPtr;
  Napi::ObjectReference inBufferRef;

  size_t outBufferSize;
  std::unique_ptr<char[]> outBuffer;

  size_t codeOrSize;
};

Napi::Value decompress_async(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();
  THROW_TYPE_ERROR_IF_FAILED(info.Length() == 3, "Wrong number of arguments");
  THROW_TYPE_ERROR_IF_FAILED(info[0].IsBuffer(), "Wrong argument 0");
  THROW_TYPE_ERROR_IF_FAILED(info[1].IsNumber(), "Wrong argument 1");
  THROW_TYPE_ERROR_IF_FAILED(info[2].IsFunction(), "Wrong argument 2");
  auto inBuffer = info[0].As<Napi::Buffer<char>>();
  auto maxSize = info[1].As<Napi::Number>().Int64Value();
  auto callback = info[2].As<Napi::Function>();
  auto outSize = ZSTD_decompressBound(inBuffer.Data(), inBuffer.Length());
  THROW_IF_FAILED(outSize != ZSTD_CONTENTSIZE_ERROR,
                  "Invalid compressed data");
  THROW_IF_FAILED(outSize < (uint64_t)maxSize, "Content size is too large");
  DEBUG_LOG("[decompress_async] args checked");
  auto worker = new DecompressWorker(callback, inBuffer, outSize);
  worker->Queue();
  return env.Undefined();
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

  explicit Compressor(const Napi::CallbackInfo &info) : Napi::ObjectWrap<Compressor>(info), ctx(nullptr)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED_VOID(info.Length() == 1, "Wrong number of arguments");
    THROW_TYPE_ERROR_IF_FAILED_VOID(info[0].IsNumber(), "Wrong argument 0");
    auto level = info[0].As<Napi::Number>().Int32Value();

    ctx = ZSTD_createCStream();
    THROW_IF_FAILED_VOID(ctx != NULL, "Failed to create compression context");
    auto code = ZSTD_initCStream(ctx, level);
    THROW_IF_FAILED_VOID(!ZSTD_isError(code), ZSTD_getErrorName(code));
    DEBUG_LOG("[Compressor]");
  }

  ~Compressor()
  {
    ZSTD_freeCStream(ctx);
    ctx = nullptr;
    DEBUG_LOG("[~Compressor]");
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
      DEBUG_LOG("[Compress] code: " << code << ", in.pos: " << in.pos << ", in.size: " << in.size << ", out.pos: " << out.pos << ", out.size: " << out.size);
      THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
      if (out.pos == out.size)
      {
        DEBUG_LOG("[Compress] send chunk: " << out.pos);
        callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.size)});
        out.pos = 0;
      }
    }
    if (out.pos > 0)
    {
      DEBUG_LOG("[Compress] send chunk final: " << out.pos);
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
      DEBUG_LOG("[End] code: " << code << ", out.pos: " << out.pos << ", out.size: " << out.size);
      THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
      if (out.pos == out.size)
      {
        DEBUG_LOG("[End] send chunk: " << out.pos);
        callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.size)});
        out.pos = 0;
      }
      if (code == 0)
        break;
    }
    if (out.pos > 0)
    {
      DEBUG_LOG("[End] send chunk final: " << out.pos);
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

  explicit Decompressor(const Napi::CallbackInfo &info) : Napi::ObjectWrap<Decompressor>(info), ctx(nullptr)
  {
    Napi::Env env = info.Env();
    THROW_TYPE_ERROR_IF_FAILED_VOID(info.Length() == 0, "Wrong number of arguments");

    ctx = ZSTD_createDStream();
    THROW_IF_FAILED_VOID(ctx != NULL, "Failed to create decompression context");
    auto code = ZSTD_initDStream(ctx);
    THROW_IF_FAILED_VOID(!ZSTD_isError(code), ZSTD_getErrorName(code));
    DEBUG_LOG("[Decompressor]");
  }

  ~Decompressor()
  {
    ZSTD_freeDStream(ctx);
    ctx = nullptr;
    DEBUG_LOG("[~Decompressor]");
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
      DEBUG_LOG("[Decompress] code: " << code << ", in.pos: " << in.pos << ", in.size: " << in.size << ", out.pos: " << out.pos << ", out.size: " << out.size);
      THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));
      if (out.pos == out.size)
      {
        DEBUG_LOG("[Decompress] send chunk: " << out.pos);
        callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.size)});
        out.pos = 0;
      }
    }
    if (out.pos > 0)
    {
      DEBUG_LOG("[Decompress] send chunk final: " << out.pos);
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
    DEBUG_LOG("[End] code: " << code << ", out.pos: " << out.pos << ", out.size: " << out.size);
    THROW_IF_FAILED(!ZSTD_isError(code), ZSTD_getErrorName(code));

    if (out.pos > 0)
    {
      DEBUG_LOG("[End] send chunk: " << out.pos);
      callback.Call({Napi::Buffer<char>::Copy(env, outBuffer.Data(), out.pos)});
      // Frame not complete
      THROW_IF_FAILED(code == 0, "Incomplete compressed data");
    }
    return env.Undefined();
  }
};

#define EXPORT_FUNCTION(name) \
  exports.Set(#name, Napi::Function::New(env, name, #name))

#define EXPORT_VALUE(name, value) \
  exports.Set(#name, value)

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  EXPORT_FUNCTION(compress);
  EXPORT_FUNCTION(compress_async);
  EXPORT_FUNCTION(decompress);
  EXPORT_FUNCTION(decompress_async);

  EXPORT_VALUE(version, Napi::Number::New(env, ZSTD_versionNumber()));
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
