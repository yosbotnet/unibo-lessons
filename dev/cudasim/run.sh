#!/bin/sh
# Compile a lab .cu for the CPU with cudasim and run it.
#   dev/cudasim/run.sh path/to/file.cu [args...]
# Extra g++ flags: CUDASIM_CXXFLAGS="-DFOO -O0 -g" dev/cudasim/run.sh ...
set -e
here=$(cd "$(dirname "$0")" && pwd)
src=$1; shift
dir=$(cd "$(dirname "$src")" && pwd)
base=$(basename "$src" .cu)
out=${TMPDIR:-/tmp}/cudasim-$base
python3 "$here/launch2cpp.py" "$src" > "$out.cpp"
g++ -std=c++20 -O2 -pthread -w -x c++ -I"$here" -I"$dir" -I"$dir/../common" $CUDASIM_CXXFLAGS -o "$out" "$out.cpp"
exec "$out" "$@"
