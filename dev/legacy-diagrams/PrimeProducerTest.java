import java.math.BigInteger;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

public final class PrimeProducerTest {
    private PrimeProducerTest() { }

    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) throws Exception {
        try {
            new PrimeProducer(null);
            throw new AssertionError("Null queue accepted");
        } catch (NullPointerException expected) { }
        int[] primes = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31};
        for (int run = 0; run < 20; run++) {
            ArrayBlockingQueue<BigInteger> queue = new ArrayBlockingQueue<>(1);
            PrimeProducer producer = new PrimeProducer(queue);
            producer.setDaemon(true); // Failure guard, not normal cleanup.
            producer.start();
            try {
                for (int expected : primes) {
                    require(BigInteger.valueOf(expected).equals(queue.poll(5, TimeUnit.SECONDS)), "Prime order");
                }
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                while (queue.size() != 1 || producer.getState() != Thread.State.WAITING) {
                    require(System.nanoTime() < deadline, "Producer did not block on full queue");
                    Thread.sleep(1);
                }
                producer.cancel();
                producer.join(5000);
                require(!producer.isAlive(), "Cancellation did not unblock put");
                require(BigInteger.valueOf(37).equals(queue.poll()), "Preserve value already inserted");
                require(queue.isEmpty(), "Interrupted put must not insert 41");
            } finally {
                producer.cancel();
                producer.join(5000);
                require(!producer.isAlive(), "Producer cleanup");
            }
        }
        System.out.println("20 runs: prime order, full-queue interruption, join, retained queued value; null queue rejected");
    }
}
