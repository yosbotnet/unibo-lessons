/** Teaching subset: one-shot latch with untimed interruptible await. */
public final class CountDownLatchMonitor {
    private int count;

    public CountDownLatchMonitor(int count) {
        if (count < 0) {
            throw new IllegalArgumentException("Nonnegative count required");
        }
        this.count = count;
    }

    public synchronized void await() throws InterruptedException {
        if (Thread.interrupted()) throw new InterruptedException();
        while (count > 0) wait();
    }

    public synchronized void countDown() {
        if (count > 0) {
            count--;
            if (count == 0) notifyAll();
        }
    }

    public synchronized int getCount() {
        return count;
    }
}
