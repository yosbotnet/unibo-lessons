import java.util.concurrent.BrokenBarrierException;

/** Teaching subset: fixed parties, interruptible await and reset; no timeout/action. */
public final class CyclicBarrierMonitor {
    private static final class Generation {
        boolean broken;
    }

    private final int parties;
    private int remaining;
    private Generation generation = new Generation();

    public CyclicBarrierMonitor(int parties) {
        if (parties <= 0) {
            throw new IllegalArgumentException("Positive parties required");
        }
        this.parties = parties;
        remaining = parties;
    }

    private void breakGeneration() {
        generation.broken = true;
        remaining = parties;
        notifyAll(); // Called only while this monitor is owned.
    }

    public synchronized int await()
            throws InterruptedException, BrokenBarrierException {
        final Generation joined = generation;
        if (joined.broken) throw new BrokenBarrierException();
        if (Thread.interrupted()) {
            breakGeneration();
            throw new InterruptedException();
        }
        final int index = --remaining;
        if (index == 0) {
            remaining = parties;
            generation = new Generation();
            notifyAll();
            return 0;
        }
        for (;;) {
            try {
                wait();
            } catch (InterruptedException interrupted) {
                if (joined == generation && !joined.broken) {
                    breakGeneration();
                    throw interrupted;
                }
                // Completion or a previous break won the race. Preserve the flag.
                Thread.currentThread().interrupt();
            }
            if (joined.broken) throw new BrokenBarrierException();
            if (joined != generation) return index;
            // Notification alone (including a spurious wake) is not completion.
        }
    }

    public synchronized boolean isBroken() {
        return generation.broken;
    }

    /** Existing waiters fail; coordinate participating threads before reuse. */
    public synchronized void reset() {
        breakGeneration();
        generation = new Generation();
        remaining = parties;
    }
}
