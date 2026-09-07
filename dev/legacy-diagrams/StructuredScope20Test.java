import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import jdk.incubator.concurrent.StructuredTaskScope;

public final class StructuredScope20Test {
    private StructuredScope20Test() { }
    private static int checks;
    private static void require(boolean value, String message) {
        checks++;
        if (!value) throw new AssertionError(message);
    }
    private static void await(CountDownLatch latch) throws InterruptedException {
        if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("Latch deadline");
    }
    private static void finish(Thread thread) throws InterruptedException {
        thread.join(5000);
        require(!thread.isAlive(), "Owner exits after children");
    }
    private static Thread owner(Runnable action) {
        Thread thread = new Thread(action, "scope-test-owner");
        thread.setDaemon(true); // A failed test must not keep the JVM alive.
        thread.start();
        return thread;
    }
    private static boolean insideClose(Thread thread) {
        for (StackTraceElement frame : thread.getStackTrace()) {
            if (frame.getClassName().equals("jdk.incubator.concurrent.StructuredTaskScope")
                    && frame.getMethodName().equals("close")) return true;
        }
        return false;
    }
    private static void awaitClose(Thread thread) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!insideClose(thread) && thread.isAlive() && System.nanoTime() < deadline) {
            Thread.yield();
        }
        require(insideClose(thread), "Owner demonstrably waiting inside real close");
    }

    private static void success() throws Exception {
        CountDownLatch bothStarted = new CountDownLatch(2);
        List<Thread> children = Collections.synchronizedList(new ArrayList<>());
        Callable<String> user = () -> {
            children.add(Thread.currentThread());
            bothStarted.countDown(); await(bothStarted); return "Ada";
        };
        Callable<Integer> order = () -> {
            children.add(Thread.currentThread());
            bothStarted.countDown(); await(bothStarted); return 17;
        };
        require(StructuredFetch20.handle(user, order).equals(
                new StructuredFetch20.Response("Ada", 17)), "Both successful results");
        require(children.size() == 2, "Both children actually ran");
        for (Thread child : children) {
            require(child.isVirtual(), "Default scope uses virtual threads");
            require(!child.isAlive(), "Successful handle returns after child exit");
        }
    }

    private static void failure(boolean userFails) throws Exception {
        CountDownLatch slowStarted = new CountDownLatch(1);
        CountDownLatch neverReleased = new CountDownLatch(1);
        AtomicBoolean interrupted = new AtomicBoolean(), exited = new AtomicBoolean();
        IOException expected = new IOException("Controlled service failure");
        Callable<Object> slow = () -> {
            slowStarted.countDown();
            try { neverReleased.await(); return null; }
            catch (InterruptedException e) { interrupted.set(true); throw e; }
            finally { exited.set(true); }
        };
        Callable<Object> fail = () -> { await(slowStarted); throw expected; };
        try {
            StructuredFetch20.handle(
                    () -> (String) (userFails ? fail : slow).call(),
                    () -> (Integer) (userFails ? slow : fail).call());
            throw new AssertionError("Failure was not propagated");
        } catch (ExecutionException e) {
            require(e.getCause() == expected, "Original failure retained");
        } finally { neverReleased.countDown(); }
        require(interrupted.get() && exited.get(), "Sibling interrupted and exited");
    }

    private static void ownerInterruption() throws Exception {
        CountDownLatch bothStarted = new CountDownLatch(2), hold = new CountDownLatch(1);
        CountDownLatch bothExited = new CountDownLatch(2);
        AtomicReference<Throwable> outcome = new AtomicReference<>();
        Callable<Object> task = () -> {
            bothStarted.countDown();
            try { hold.await(); return null; } finally { bothExited.countDown(); }
        };
        Thread parent = owner(() -> {
            try { StructuredFetch20.handle(() -> (String) task.call(), () -> (Integer) task.call()); }
            catch (Throwable e) { outcome.set(e); }
        });
        try { await(bothStarted); parent.interrupt(); finish(parent); }
        finally { hold.countDown(); parent.interrupt(); parent.join(5000); }
        require(outcome.get() instanceof InterruptedException, "Owner join interruption propagates");
        require(bothExited.getCount() == 0, "Both children leave before caller catches interruption");
    }

    private static void canonicalSlowCleanup() throws Exception {
        CountDownLatch started = new CountDownLatch(1), interrupted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicReference<Throwable> outcome = new AtomicReference<>();
        AtomicBoolean childExited = new AtomicBoolean(), returned = new AtomicBoolean();
        Thread parent = owner(() -> {
            try {
                StructuredFetch20.handle(() -> {
                    started.countDown();
                    for (;;) {
                        try { release.await(); break; }
                        catch (InterruptedException e) { interrupted.countDown(); }
                    }
                    childExited.set(true); return "late";
                }, () -> { await(started); throw new IOException("fail"); });
            } catch (Throwable e) { outcome.set(e); }
            finally { returned.set(true); }
        });
        try {
            await(interrupted); awaitClose(parent);
            require(!returned.get() && !childExited.get(), "Canonical handle waits for stubborn child");
        } finally { release.countDown(); finish(parent); }
        require(outcome.get() instanceof ExecutionException && childExited.get(), "Failure exits only after cleanup");
    }

    // API experiment: distinguish join's return, cancelled Future and thread exit.
    private static List<String> lifecycle(boolean timeout) throws Exception {
        List<String> trace = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        CountDownLatch beforeClose = new CountDownLatch(1);
        AtomicReference<Throwable> problem = new AtomicReference<>();
        AtomicBoolean exited = new AtomicBoolean(), interruptRestored = new AtomicBoolean();
        Thread parent = owner(() -> {
            try {
                try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
                    Future<String> slow = scope.fork(() -> {
                        trace.add("child started"); started.countDown();
                        for (;;) {
                            try { release.await(); break; }
                            catch (InterruptedException ignored) { /* controlled slow cleanup */ }
                        }
                        trace.add("child exited"); exited.set(true); return "late";
                    });
                    await(started);
                    if (timeout) {
                        try { scope.joinUntil(Instant.EPOCH); throw new AssertionError("Missing timeout"); }
                        catch (TimeoutException expected) { trace.add("deadline observed"); }
                    } else {
                        scope.fork(() -> { trace.add("sibling failed"); throw new IOException("fail"); });
                        scope.join(); trace.add("join returned");
                        if (!slow.isDone() || !slow.isCancelled() || exited.get()) {
                            throw new AssertionError("Cancelled future differs from thread exit");
                        }
                        try { scope.throwIfFailed(); throw new AssertionError("Missing failure"); }
                        catch (ExecutionException expected) { /* checked separately above */ }
                    }
                    trace.add("close begins"); beforeClose.countDown();
                }
                trace.add("close returned");
                interruptRestored.set(Thread.currentThread().isInterrupted());
            } catch (Throwable e) { problem.set(e); beforeClose.countDown(); }
        });
        try {
            await(beforeClose); awaitClose(parent);
            require(!exited.get() && !trace.contains("close returned"), "close is not forced termination");
            parent.interrupt(); // Interrupting close does not make it abandon its children.
            trace.add("child released");
        } finally { release.countDown(); finish(parent); }
        require(problem.get() == null, "Lifecycle experiment: " + problem.get());
        require(interruptRestored.get(), "close restores interrupted status on return");
        List<String> expected = timeout
                ? List.of("child started", "deadline observed", "close begins", "child released", "child exited", "close returned")
                : List.of("child started", "sibling failed", "join returned", "close begins", "child released", "child exited", "close returned");
        require(trace.equals(expected), "Controlled lifecycle order: " + trace);
        return trace;
    }

    public static void main(String[] args) throws Exception {
        List<String> trace = List.of();
        for (int repeat = 0; repeat < 10; repeat++) {
            success(); failure(true); failure(false); ownerInterruption();
            canonicalSlowCleanup(); trace = lifecycle(false); lifecycle(true);
        }
        System.out.println("checks=" + checks + "; repetitions=10; scenarios=70");
        System.out.println(String.join(" | ", trace));
    }
}
