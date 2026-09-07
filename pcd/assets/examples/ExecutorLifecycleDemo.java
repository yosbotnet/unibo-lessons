import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Java 17. A controlled experiment, not a production cancellation policy. */
public final class ExecutorLifecycleDemo {
    private ExecutorLifecycleDemo() { }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void await(CountDownLatch latch) throws InterruptedException {
        require(latch.await(5, TimeUnit.SECONDS), "Latch deadline exceeded");
    }

    private static final class HeldTask implements Callable<Integer> {
        final CountDownLatch started = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        final CountDownLatch interrupted = new CountDownLatch(1);
        final CountDownLatch exited = new CountDownLatch(1);

        @Override
        public Integer call() {
            started.countDown();
            try {
                for (;;) {
                    try {
                        release.await();
                        return 42;
                    } catch (InterruptedException observed) {
                        interrupted.countDown();
                        // DELIBERATE for this experiment: do not exit yet.
                        // The driver always opens release in finally.
                    }
                }
            } finally {
                exited.countDown();
            }
        }
    }

    private static ThreadPoolExecutor pool() {
        return new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(), job -> {
                    Thread worker = new Thread(job, "executor-experiment");
                    // Failure guard only; normal completion is joined below.
                    worker.setDaemon(true);
                    return worker;
                });
    }

    private static void runCase(String mode) throws Exception {
        ThreadPoolExecutor executor = pool();
        HeldTask task = new HeldTask();
        AtomicBoolean queuedRan = new AtomicBoolean();
        Future<Integer> active = null;
        Future<Integer> queued = null;
        try {
            active = executor.submit(task);
            await(task.started);
            queued = executor.submit(() -> {
                queuedRan.set(true);
                return 7;
            });
            require(executor.getQueue().size() == 1, "Second task must be queued");
            List<Runnable> removed = List.of();
            boolean cancel = mode.startsWith("cancel");
            boolean interrupt = mode.equals("shutdownNow") || mode.equals("cancel(true)");
            if (cancel) {
                require(active.cancel(interrupt), "Concrete running FutureTask accepts cancellation");
                executor.shutdown();
            } else if (mode.equals("shutdownNow")) {
                removed = executor.shutdownNow();
            } else {
                executor.shutdown();
            }
            if (interrupt) await(task.interrupted);
            require(executor.isShutdown(), "Shutdown initiated");
            require(!executor.isTerminated(), "Held task body has not exited");
            require(!executor.awaitTermination(1, TimeUnit.MILLISECONDS), "Timeout is not termination");
            require(task.exited.getCount() == 1, "Body still held");
            require(active.isDone() == cancel && active.isCancelled() == cancel, "Future state");
            require(!queued.isDone() && !queuedRan.get(), "Queued task not run or cancelled");
            require((task.interrupted.getCount() == 0) == interrupt, "Interrupt observation");
            require(removed.size() == (mode.equals("shutdownNow") ? 1 : 0), "Removed count");
            if (!removed.isEmpty()) require(removed.get(0) == queued, "Returned queued FutureTask");
            try {
                executor.submit(() -> 99);
                throw new AssertionError("Must reject new submissions");
            } catch (RejectedExecutionException expected) {
                // All four cases have initiated shutdown.
            }
            if (cancel) {
                try {
                    active.get();
                    throw new AssertionError("Cancelled Future must not return a value");
                } catch (CancellationException expected) {
                    // This says nothing about the task body's exit.
                }
            }
            System.out.println(String.join("\t", mode,
                    Boolean.toString(active.isDone()),
                    Boolean.toString(active.isCancelled()),
                    Boolean.toString(task.exited.getCount() == 0),
                    Boolean.toString(executor.isTerminated()),
                    Integer.toString(removed.size()),
                    Boolean.toString(queued.isDone()),
                    Boolean.toString(task.interrupted.getCount() == 0)));

            // shutdownNow returned this pending Future without cancelling it.
            if (!removed.isEmpty()) require(queued.cancel(false), "Explicit pending Future cleanup");
            task.release.countDown();
            await(task.exited);
            if (!cancel) require(active.get(5, TimeUnit.SECONDS) == 42, "Active result");
            if (removed.isEmpty()) require(queued.get(5, TimeUnit.SECONDS) == 7, "Accepted queue drained");
            require(executor.awaitTermination(5, TimeUnit.SECONDS), "Termination after release");
            require(queuedRan.get() == removed.isEmpty(), "Queue execution matches shutdown mode");
        } finally {
            task.release.countDown();
            if (active != null) active.cancel(true);
            if (queued != null) queued.cancel(false);
            executor.shutdownNow();
            require(executor.awaitTermination(5, TimeUnit.SECONDS), "Cleanup terminated pool");
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("case\tfutureDone\tfutureCancelled\tbodyExited\tpoolTerminated\treturnedQueued\tqueuedFutureDone\tinterruptObserved");
        for (String mode : List.of("shutdown", "shutdownNow", "cancel(true)", "cancel(false)")) {
            runCase(mode);
        }
    }
}
