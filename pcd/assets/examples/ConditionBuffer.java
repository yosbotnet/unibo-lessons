import java.util.Objects;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/** Bounded FIFO with separate producer and consumer condition queues. */
public final class ConditionBuffer<T> {
    private final Object[] buffer;
    private int first, last, count;
    private final ReentrantLock mutex = new ReentrantLock();
    private final Condition notFull = mutex.newCondition();
    private final Condition notEmpty = mutex.newCondition();

    public ConditionBuffer(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("positive capacity required");
        buffer = new Object[capacity];
    }

    public void put(T item) throws InterruptedException {
        Objects.requireNonNull(item);
        mutex.lockInterruptibly();
        try {
            while (count == buffer.length) {
                notFull.await();
            }
            buffer[last] = item;
            last = (last + 1) % buffer.length;
            count++;
            notEmpty.signal();
        } finally {
            mutex.unlock();
        }
    }

    @SuppressWarnings("unchecked") // Only put(T) writes this private array.
    public T get() throws InterruptedException {
        mutex.lockInterruptibly();
        try {
            while (count == 0) {
                notEmpty.await();
            }
            T item = (T) buffer[first];
            buffer[first] = null;
            first = (first + 1) % buffer.length;
            count--;
            notFull.signal();
            return item;
        } finally {
            mutex.unlock();
        }
    }
}
