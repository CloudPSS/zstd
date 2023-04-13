{
    "targets": [
        {
            "target_name": "binding",
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
            "sources": ["lib/binding.cc"],
            "include_dirs": ["<!(node -p \"require('node-addon-api').include_dir\")"],
            "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
        }
    ]
}
