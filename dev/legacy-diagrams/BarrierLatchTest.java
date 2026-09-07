import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicIntegerArray;

public final class BarrierLatchTest {
    private BarrierLatchTest() { }
    private static final AtomicInteger checks = new AtomicInteger();
    @FunctionalInterface private interface Task { void run() throws Exception; }
    private static final class Worker extends Thread {
        private final Task task;
        volatile Throwable failure;
        Worker(Task task) { this.task = task; setDaemon(true); }
        @Override public void run() {
            try { task.run(); } catch (Throwable error) { failure = error; }
        }
    }
    private static void require(boolean condition, String message) {
        checks.incrementAndGet();
        if (!condition) throw new AssertionError(message);
    }
    private static Worker start(Task task) { Worker worker = new Worker(task); worker.start(); return worker; }
    private static void finish(Worker worker) throws Exception {
        worker.join(5000);
        require(!worker.isAlive(), "Worker deadline");
        if (worker.failure != null) throw new AssertionError(worker.failure);
    }
    private static void waiting(Worker worker) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (worker.getState() != Thread.State.WAITING) {
            if (worker.failure != null) throw new AssertionError(worker.failure);
            require(worker.isAlive() && System.nanoTime() < deadline, "Expected actual monitor wait");
            Thread.sleep(1);
        }
    }
    private static void clean(Worker... workers) throws Exception {
        for (Worker worker : workers) if (worker != null) worker.interrupt();
        for (Worker worker : workers) if (worker != null) finish(worker);
    }

    private static final class OriginalBarrier {
        private int arrived;
        synchronized void await() throws InterruptedException {
            arrived++;
            while (arrived < 2) wait();
            notifyAll();
        }
    }

    private static void reproduceOriginal() throws Exception {
        OriginalBarrier original = new OriginalBarrier();
        Worker first = start(original::await);
        try {
            waiting(first); original.await(); finish(first);
            original.await(); // No second participant for this new round.
            require(original.arrived == 3, "Old barrier leaks on second round");
        } finally { clean(first); }
        System.out.println("original: second round returned with only one participant");
    }

    private static void fastReentry() throws Exception {
        CyclicBarrierMonitor barrier = new CyclicBarrierMonitor(2);
        List<String> trace = new ArrayList<>(); // All writes under barrier monitor.
        Worker a = start(() -> {
            synchronized (barrier) {
                trace.add("A waits in g");
                require(barrier.await() == 1, "A first in g");
                trace.add("A returns from g");
                require(barrier.await() == 0, "A last in next generation");
                trace.add("A completes g+1");
            }
        });
        Worker b = null;
        try {
            waiting(a);
            b = start(() -> {
                synchronized (barrier) {
                    require(barrier.await() == 0, "B last in g");
                    trace.add("B completes g");
                    trace.add("B waits in g+1");
                    // Outer monitor forces B to reenter before A can return.
                    require(barrier.await() == 1, "B first in next generation");
                    trace.add("B returns from g+1");
                }
            });
            finish(a); finish(b);
            require(trace.equals(List.of("A waits in g", "B completes g", "B waits in g+1",
                    "A returns from g", "A completes g+1", "B returns from g+1")), "Generation trace order");
            for (String event : trace) System.out.println("trace\t" + event);
        } finally { clean(a,b); }
    }

    private static void manyRounds(int parties) throws Exception {
        CyclicBarrierMonitor barrier = new CyclicBarrierMonitor(parties);
        int rounds = 200;
        AtomicIntegerArray arrived = new AtomicIntegerArray(rounds);
        AtomicIntegerArray indices = new AtomicIntegerArray(rounds * parties);
        List<Worker> workers = new ArrayList<>();
        // Separate cells per generation avoid races with next-round writes.
        int[][] published = new int[rounds][parties];
        try {
            for (int id = 0; id < parties; id++) {
                final int participant = id;
                workers.add(start(() -> {
                    for (int round = 0; round < rounds; round++) {
                        published[round][participant] = participant + 1;
                        arrived.incrementAndGet(round);
                        int index = barrier.await();
                        for (int value : published[round]) require(value > 0, "Published writes visible after barrier");
                        require(arrived.get(round) == parties, "No successful exit before all arrivals");
                        require(index >= 0 && index < parties, "Arrival index range");
                        indices.incrementAndGet(round * parties + index);
                    }
                }));
            }
            for (Worker worker : workers) finish(worker);
            for (int i = 0; i < indices.length(); i++) require(indices.get(i) == 1, "Each arrival index once per generation");
            require(!barrier.isBroken(), "Normal rounds do not break barrier");
        } finally { clean(workers.toArray(Worker[]::new)); }
    }

    private static void breakAndReset() throws Exception {
        CyclicBarrierMonitor barrier = new CyclicBarrierMonitor(3);
        Worker interrupted = start(() -> {
            try { barrier.await(); throw new AssertionError("Expected interruption"); }
            catch (InterruptedException expected) { require(!Thread.currentThread().isInterrupted(), "Interrupt flag cleared"); }
        });
        Worker peer = null;
        try {
            waiting(interrupted);
            peer = start(() -> {
                try { barrier.await(); throw new AssertionError("Expected peer break"); }
                catch (BrokenBarrierException expected) { }
            });
            waiting(peer); interrupted.interrupt(); finish(interrupted); finish(peer);
            require(barrier.isBroken(), "Interrupted generation stays broken");
            try { barrier.await(); throw new AssertionError("New caller must fail on broken generation"); }
            catch (BrokenBarrierException expected) { }
            barrier.reset(); require(!barrier.isBroken(), "Reset creates unbroken generation");
            Worker resetWaiter = start(() -> {
                try { barrier.await(); throw new AssertionError("Reset must fail existing waiter"); }
                catch (BrokenBarrierException expected) { }
            });
            try { waiting(resetWaiter); barrier.reset(); finish(resetWaiter); }
            finally { clean(resetWaiter); }
            Worker one = start(() -> barrier.await()), two = start(() -> barrier.await());
            try { barrier.await(); finish(one); finish(two); }
            finally { clean(one,two); }
        } finally { barrier.reset(); clean(interrupted,peer); }
    }

    private static void completionBeforeInterrupt() throws Exception {
        CyclicBarrierMonitor barrier = new CyclicBarrierMonitor(2);
        Worker waiter = start(() -> {
            require(barrier.await() == 1, "Completed generation returns normally");
            require(Thread.currentThread().isInterrupted(), "Late interrupt preserved");
            Thread.interrupted();
        });
        try {
            waiting(waiter);
            synchronized (barrier) {
                require(barrier.await() == 0, "Main completes generation");
                waiter.interrupt(); // Old waiter cannot reacquire until this block exits.
            }
            finish(waiter); require(!barrier.isBroken(), "Late interrupt does not break new generation");
        } finally { clean(waiter); }
        CyclicBarrierMonitor single = new CyclicBarrierMonitor(1);
        Worker alreadyInterrupted = start(() -> {
            Thread.currentThread().interrupt();
            try { single.await(); throw new AssertionError("Pre-interrupted arrival must not trip"); }
            catch (InterruptedException expected) { require(!Thread.currentThread().isInterrupted(), "Entry interruption cleared"); }
        });
        try { finish(alreadyInterrupted); require(single.isBroken(), "Pre-interrupted generation broken"); }
        finally { clean(alreadyInterrupted); }
    }

    private static void latch() throws Exception {
        CountDownLatchMonitor latch = new CountDownLatchMonitor(2);
        AtomicInteger passed = new AtomicInteger();
        Worker a = start(() -> { latch.await(); passed.incrementAndGet(); });
        Worker b = start(() -> { latch.await(); passed.incrementAndGet(); });
        try {
            waiting(a); waiting(b);
            synchronized (latch) { latch.notifyAll(); }
            waiting(a); waiting(b); require(passed.get() == 0, "Notification does not open latch");
            latch.countDown(); require(latch.getCount() == 1 && passed.get() == 0, "Partial countdown remains closed");
            latch.countDown(); finish(a); finish(b);
            require(passed.get() == 2, "All waiters pass after zero");
            for (int i = 0; i < 100; i++) { latch.countDown(); latch.await(); }
            require(latch.getCount() == 0, "Open latch never goes negative or closes again");
        } finally { while (latch.getCount() > 0) latch.countDown(); clean(a,b); }
        CountDownLatchMonitor closed = new CountDownLatchMonitor(1);
        Worker cancelled = start(() -> {
            try { closed.await(); throw new AssertionError("Expected interrupted latch waiter"); }
            catch (InterruptedException expected) { require(!Thread.currentThread().isInterrupted(), "Latch interrupt cleared"); }
        });
        try {
            waiting(cancelled); cancelled.interrupt(); finish(cancelled);
            require(closed.getCount() == 1, "Interruption neither decrements nor breaks latch");
            closed.countDown(); closed.await();
        } finally { closed.countDown(); clean(cancelled); }
        Worker openButInterrupted = start(() -> {
            Thread.currentThread().interrupt();
            try { new CountDownLatchMonitor(0).await(); throw new AssertionError("Open latch still checks interruption"); }
            catch (InterruptedException expected) { require(!Thread.currentThread().isInterrupted(), "Open latch interruption cleared"); }
        });
        try { finish(openButInterrupted); } finally { clean(openButInterrupted); }
    }

    public static void main(String[] args) throws Exception {
        for (int n : new int[]{0,-1}) {
            try { new CyclicBarrierMonitor(n); throw new AssertionError("Invalid parties accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        try { new CountDownLatchMonitor(-1); throw new AssertionError("Negative latch accepted"); }
        catch (IllegalArgumentException expected) { }
        new CountDownLatchMonitor(0).await();
        reproduceOriginal(); fastReentry();
        for (int parties : new int[]{1,2,3,5}) manyRounds(parties);
        breakAndReset(); completionBeforeInterrupt(); latch();
        System.out.println("checks\t" + checks.get());
    }
}
