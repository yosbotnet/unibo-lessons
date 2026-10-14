# sass-count.awk - for every kernel in `cuobjdump -sass` output, count the
# instructions lab 4b is about. Each throughput loop runs 64 steps per
# iteration, so its kernel should show 64 (or a multiple) of exactly one of
# them, plus a few others for the loop, the stamps and the stores. If the count
# of the instruction under test is missing or much smaller, the compiler has
# simplified the loop and the measurement means nothing.
BEGIN { n = split("FFMA HFMA2 IMAD LOP3 SHFL MUFU.EX2 MUFU.RSQ POPC DFMA DMUL F2F", ops, " ") }
function flush(   i, s) {
    if (name == "") return
    s = ""
    for (i = 1; i <= n; i++) if (c[ops[i]]) s = s sprintf("  %s %d", ops[i], c[ops[i]])
    print name ":" s
    split("", c)
}
/Function :/ { flush(); name = $0; sub(/.*Function : /, "", name); next }
{ for (i = 1; i <= n; i++) if (index($0, " " ops[i] " ") || index($0, " " ops[i] ".")) c[ops[i]]++ }
END { flush() }
