import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public final class BoundedCounterTest {
    private BoundedCounterTest() { }
    private static void require(boolean condition) {
        if (!condition) throw new AssertionError("Bounded counter invariant or result");
    }
    private static void contenders(BoundedCounter counter, boolean increment) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        List<Thread> workers = new ArrayList<>();
        try {
            for (int i = 0; i < 20; i++) {
                Thread worker = new Thread(() -> {
                    try {
                        require(start.await(5, TimeUnit.SECONDS));
                        if (increment ? counter.tryInc() : counter.tryDec()) successes.incrementAndGet();
                    } catch (Throwable error) { failure.set(error); }
                });
                worker.setDaemon(true); workers.add(worker); worker.start();
            }
            start.countDown();
            for (Thread worker : workers) { worker.join(5000); require(!worker.isAlive()); }
            if (failure.get() != null) throw new AssertionError(failure.get());
            require(successes.get() == 1);
            require(counter.getVal() == (increment ? 1 : 0));
        } finally {
            start.countDown();
            for (Thread worker : workers) { worker.interrupt(); worker.join(5000); require(!worker.isAlive()); }
        }
    }
    public static void main(String[] args) throws Exception {
        for (int[] bad : new int[][]{{1,0,0},{0,1,-1},{0,1,2}}) {
            try { new BoundedCounter(bad[0],bad[1],bad[2]); throw new AssertionError("Invalid bounds accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        BoundedCounter counter = new BoundedCounter(0,1,0);
        require(counter.getVal() == 0);
        counter.inc();
        try { counter.inc(); throw new AssertionError("Overflow accepted"); }
        catch (BoundedCounter.OverflowException expected) { }
        require(counter.getVal() == 1);
        counter.dec();
        try { counter.dec(); throw new AssertionError("Underflow accepted"); }
        catch (BoundedCounter.UnderflowException expected) { }
        require(counter.getVal() == 0);
        contenders(counter,true); contenders(counter,false);
        // An external read does not reserve capacity for the subsequent action.
        int observed = counter.getVal();
        Thread other = new Thread(counter::inc); other.start(); other.join(5000);
        require(!other.isAlive() && observed == 0);
        try { counter.inc(); throw new AssertionError("Stale check should not allow overflow"); }
        catch (BoundedCounter.OverflowException expected) { }
        require(counter.getVal() == 1 && !counter.tryInc());
        BoundedCounter maximum = new BoundedCounter(Integer.MIN_VALUE,Integer.MAX_VALUE,Integer.MAX_VALUE);
        require(!maximum.tryInc());
        System.out.println("Bounds validation, exception preservation, 40 concurrent attempts, stale check and int boundary passed");
    }
}
