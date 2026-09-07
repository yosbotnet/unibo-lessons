import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/** Same latest-value semantics as SynchCell, using an explicit lock. */
public final class SynchCell2 {
    private final ReentrantLock mutex = new ReentrantLock();
    private final Condition isAvail = mutex.newCondition();
    private int value;
    private boolean available;

    public void set(int v) {
        mutex.lock();
        try {
            value = v;
            available = true;
            isAvail.signalAll();
        } finally {
            mutex.unlock();
        }
    }

    public int get() throws InterruptedException {
        mutex.lockInterruptibly();
        try {
            while (!available) {
                isAvail.await();
            }
            return value;
        } finally {
            mutex.unlock();
        }
    }
}
