; Mathematical integers, not fixed-width machine integers.
; N is any nonnegative even integer and remains constant across a step.
(set-logic QF_LIA)
(set-option :produce-models true)
(declare-const n Int)
(declare-const x Int)
(declare-const xp Int)
(assert (and (>= n 0) (= (mod n 2) 0)))
(define-fun Inv ((v Int)) Bool
  (and (<= 0 v) (<= v n) (= (mod v 2) 0)))
(define-fun Safe ((v Int)) Bool (not (= v (+ n 1))))
(define-fun Next () Bool (= xp (ite (< x n) (+ x 2) x)))

(echo "base")
(push)
(assert (= x 0))
(assert (not (Inv x)))
(check-sat)
(pop)

(echo "preservation")
(push)
(assert (and (Inv x) Next (not (Inv xp))))
(check-sat)
(pop)

(echo "implication")
(push)
(assert (and (Inv x) (not (Safe x))))
(check-sat)
(pop)

; Safe holds on reachable states, but is not itself inductive.
(echo "safe-is-not-inductive")
(push)
(assert (and (= n 10) (= x 9) (Safe x) Next (not (Safe xp))))
(check-sat)
(get-value (n x xp))
(pop)

; Negative control: changing +2 to +3 breaks the invariant and safety.
(echo "mutant-plus-three")
(push)
(assert (and (= n 2) (= x 0) (Inv x)
             (= xp (ite (< x n) (+ x 3) x))
             (not (Inv xp)) (not (Safe xp))))
(check-sat)
(get-value (n x xp))
(pop)
