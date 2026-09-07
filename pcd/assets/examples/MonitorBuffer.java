import java.util.Objects;

/** Bounded FIFO with one intrinsic wait set; null items are rejected. */
public final class MonitorBuffer<T> {
    private final Object[] buffer;
    private int first, last, count;

    public MonitorBuffer(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("positive capacity required");
        buffer = new Object[capacity];
    }

    public synchronized void put(T item) throws InterruptedException {
        Objects.requireNonNull(item);
        while (count == buffer.length) {
            wait();
        }
        buffer[last] = item;
        last = (last + 1) % buffer.length;
        count++;
        notifyAll();
    }

    @SuppressWarnings("unchecked") // Only put(T) writes this private array.
    public synchronized T get() throws InterruptedException {
        while (count == 0) {
            wait();
        }
        T item = (T) buffer[first];
        buffer[first] = null;
        first = (first + 1) % buffer.length;
        count--;
        notifyAll();
        return item;
    }
}
