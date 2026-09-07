/* Editorial two-process Dekker model. SPIN 6.5.1.
 * Shared reads/writes are sequentially consistent atomic statements.
 * No atomic block encloses the entry protocol or the critical section.
 * in_cs is an observer, not a lock used by the algorithm.
 */
bool want[2];
byte turn = 0;
byte in_cs = 0;

active [2] proctype Dekker() {
    byte me = _pid;
    byte other = 1 - _pid;
    do
    :: true ->
request:
        want[me] = true;
        do
        :: want[other] ->
            if
            :: turn == other ->
                want[me] = false;
                (turn == me);
                want[me] = true
            :: else -> skip
            fi
        :: else -> break
        od;
cs:
        in_cs++;
        assert(in_cs == 1);
        in_cs--;
        turn = other;
        want[me] = false
    od
}

/* Each property requires a separate verifier run (-N). */
ltl response_p { [] (Dekker[0]@request -> <> Dekker[0]@cs) }
ltl response_q { [] (Dekker[1]@request -> <> Dekker[1]@cs) }
