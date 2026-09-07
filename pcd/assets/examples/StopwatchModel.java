import java.util.Objects;
import java.util.function.LongSupplier;

/** Short monitor operations; no GUI calls, sleeping, I/O or callbacks to the EDT. */
public final class StopwatchModel {
    public record Snapshot(long millis, boolean running, long revision) { }

    private final LongSupplier nanoClock;
    private long accumulated;
    private long startedAt;
    private long revision;
    private boolean running;

    public StopwatchModel() {
        this(System::nanoTime);
    }

    public StopwatchModel(LongSupplier nanoClock) {
        this.nanoClock = Objects.requireNonNull(nanoClock);
    }

    public synchronized void start() {
        if (!running) {
            startedAt = nanoClock.getAsLong();
            running = true;
        }
        revision++;
    }

    public synchronized void stop() {
        if (running) {
            accumulated += nanoClock.getAsLong() - startedAt;
            running = false;
        }
        revision++;
    }

    /** Reset to zero; preserve whether the stopwatch is running. */
    public synchronized void reset() {
        accumulated = 0;
        if (running) startedAt = nanoClock.getAsLong();
        revision++;
    }

    public synchronized Snapshot snapshot() {
        long elapsed = accumulated + (running ? nanoClock.getAsLong() - startedAt : 0);
        return new Snapshot(elapsed / 1_000_000, running, revision);
    }
}
