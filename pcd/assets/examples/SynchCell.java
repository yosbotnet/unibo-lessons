/** Persistent latest-value cell, not a consuming one-slot buffer. */
public final class SynchCell {
    private int value;
    private boolean available;

    public synchronized void set(int v) {
        value = v;
        available = true;
        notifyAll();
    }

    public synchronized int get() throws InterruptedException {
        while (!available) {
            wait();
        }
        return value;
    }
}
