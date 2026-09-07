import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** Java 17 platform thread: a direct call and a started thread are different. */
public final class ThreadStartDemo {
    private ThreadStartDemo() { }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) throws InterruptedException {
        Thread caller = Thread.currentThread();
        AtomicReference<Thread> executedBy = new AtomicReference<>();
        AtomicInteger executions = new AtomicInteger();
        Runnable task = () -> {
            executedBy.set(Thread.currentThread());
            executions.incrementAndGet();
        };
        Thread t = new Thread(task, "demo-worker");

        t.run(); // Deliberate direct call: still on the caller.
        require(executedBy.get() == caller, "Direct run must use caller thread");
        require(t.getState() == Thread.State.NEW, "Direct run does not start t");
        System.out.println("run: caller thread; t is NEW");

        t.start(); // The same task now executes on t.
        t.join(); // Wait for t to finish; do not infer completion from start.
        require(executedBy.get() == t, "Started task must execute on t");
        require(t.getState() == Thread.State.TERMINATED, "Join returned after termination");
        require(executions.get() == 2, "The task executed twice in this experiment");
        System.out.println("start + join: worker thread; t is TERMINATED; executions = 2");

        try {
            t.start();
            throw new AssertionError("A Thread cannot be started twice");
        } catch (IllegalThreadStateException expected) {
            System.out.println("second start: IllegalThreadStateException");
        }
    }
}
