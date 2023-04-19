#include <malloc.h>
#include <unistd.h>

// @see https://github.com/emscripten-core/emscripten/blob/9bb322f8a7ee89d6ac67e828b9c7a7022ddf8de2/tests/mallinfo.cpp

unsigned int usedmem()
{
  struct mallinfo i = mallinfo();
  unsigned int dynamicTop = (unsigned int)sbrk(0);
  return dynamicTop - i.fordblks;
}

#include "zstd.c"
