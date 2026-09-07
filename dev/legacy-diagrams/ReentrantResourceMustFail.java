import java.util.concurrent.locks.ReentrantLock;

// Negative compiler fixture, not a downloadable working example.
final class ReentrantResourceMustFail {
    void example() {
        try (var lock = new ReentrantLock()) {
            lock.lock();
        }
    }
}
