import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

/** Controlled Java 17 lock experiment. Deadlines are test guards, not benchmarks. */
public final class LockSemanticsDemo {
    private LockSemanticsDemo() { }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void joined(Thread worker) throws InterruptedException {
        worker.join(5000);
        require(!worker.isAlive(), "Worker deadline exceeded");
    }

    private static void runCase(String mode) throws Exception {
        ReentrantLock lock = new ReentrantLock();
        CountDownLatch ready = new CountDownLatch(1);
        AtomicBoolean acquired = new AtomicBoolean();
        AtomicBoolean caught = new AtomicBoolean();
        AtomicBoolean interruptStatus = new AtomicBoolean();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread worker = new Thread(() -> {
            ready.countDown();
            try {
                boolean owns;
                switch (mode) {
                    case "lock": lock.lock(); owns = true; break;
                    case "interruptible": lock.lockInterruptibly(); owns = true; break;
                    case "try": owns = lock.tryLock(); break;
                    case "timeout": owns = lock.tryLock(10, TimeUnit.MILLISECONDS); break;
                    case "timed-interrupt": owns = lock.tryLock(1, TimeUnit.DAYS); break;
                    default: throw new AssertionError(mode);
                }
                if (owns) {
                    try {
                        acquired.set(true);
                        interruptStatus.set(Thread.currentThread().isInterrupted());
                    } finally { lock.unlock(); }
                }
            } catch (InterruptedException expected) {
                caught.set(true);
                interruptStatus.set(Thread.currentThread().isInterrupted());
            } catch (Throwable error) { failure.set(error); }
        }, "lock-experiment");
        worker.setDaemon(true); // Failure guard only: every successful run joins.
        lock.lock();
        try {
            worker.start();
            require(ready.await(5, TimeUnit.SECONDS), "Worker did not start");
            if (!mode.equals("try") && !mode.equals("timeout")) {
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                while (!lock.hasQueuedThread(worker)) {
                    require(System.nanoTime() < deadline, "Worker did not queue for lock");
                    Thread.sleep(1);
                }
                worker.interrupt();
            }
            if (mode.equals("lock")) {
                require(!acquired.get(), "Main still owns lock");
                lock.unlock();
            }
            joined(worker);
            if (failure.get() != null) throw new AssertionError(failure.get());
            require(acquired.get() == mode.equals("lock"), "Acquisition outcome");
            require(caught.get() == (mode.equals("interruptible") || mode.equals("timed-interrupt")), "Exception outcome");
            require(interruptStatus.get() == mode.equals("lock"), "Interrupt status after acquisition/exception");
            System.out.println(mode + "\t" + acquired + "\t" + caught + "\t" + interruptStatus);
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
            worker.interrupt();
            joined(worker);
        }
    }

    public static void main(String[] args) throws Exception {
        require(!AutoCloseable.class.isAssignableFrom(ReentrantLock.class), "Standard ReentrantLock is not AutoCloseable");
        ReentrantLock reentrant = new ReentrantLock();
        reentrant.lock();
        try {
            require(reentrant.tryLock(), "Current owner may acquire again");
            try { require(reentrant.getHoldCount() == 2, "Two holds require two releases"); }
            finally { reentrant.unlock(); }
            require(reentrant.getHoldCount() == 1, "One remaining hold");
        } finally { reentrant.unlock(); }
        require(!reentrant.isLocked(), "All holds released");
        System.out.println("method\tacquired\tInterruptedException\tinterruptStatus");
        for (String mode : List.of("lock", "interruptible", "try", "timeout", "timed-interrupt")) runCase(mode);
    }
}
