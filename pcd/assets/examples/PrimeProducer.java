import java.math.BigInteger;
import java.util.Objects;
import java.util.concurrent.BlockingQueue;

/** One producer thread; cancellation does not discard values already queued. */
public final class PrimeProducer extends Thread {
    private final BlockingQueue<BigInteger> queue;

    public PrimeProducer(BlockingQueue<BigInteger> queue) {
        this.queue = Objects.requireNonNull(queue);
    }

    @Override
    public void run() {
        BigInteger p = BigInteger.ONE;
        try {
            while (!isInterrupted()) {
                p = p.nextProbablePrime();
                queue.put(p);
            }
        } catch (InterruptedException cancelled) {
            // This thread owns the cancellation policy: exit, do not retry put.
        }
    }

    public void cancel() {
        interrupt();
    }
}
