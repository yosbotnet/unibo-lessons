--------------------------- MODULE Peterson ---------------------------
EXTENDS Integers

Not(i) == 1 - i

(* --algorithm Peterson {
  variables flag = [i \in {0,1} |-> FALSE], turn = 0;
  process (proc \in {0,1}) {
    a0: while (TRUE) {
      a1: flag[self] := TRUE;
      a2: turn := Not(self);
      a3a: if (flag[Not(self)]) { goto a3b } else { goto cs };
      a3b: if (turn = Not(self)) { goto a3a } else { goto cs };
      cs: skip;
      a4: flag[self] := FALSE;
    }
  }
} *)

\* Run the PlusCal translator before TLC. It inserts the TLA+ translation here.

TypeOK == /\ flag \in [{0,1} -> BOOLEAN]
          /\ turn \in {0,1}
          /\ pc \in [{0,1} -> {"a0","a1","a2","a3a","a3b","cs","a4"}]
MutualExclusion == ~(pc[0] = "cs" /\ pc[1] = "cs")
StarvationFreedom == \A i \in {0,1} : (pc[i] = "a1") ~> (pc[i] = "cs")
FairSpec == Spec /\ (\A i \in {0,1} : WF_vars(proc(i)))
=======================================================================
