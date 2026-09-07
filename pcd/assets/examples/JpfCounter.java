/** Java 11 target for the pinned JPF example; volatile is not an atomic increment. */
public final class JpfCounter {
    private static volatile int value;
    private static boolean safe;

    private static void increment() {
        if (safe) {
            synchronized (JpfCounter.class) {
                value = value + 1;
            }
        } else {
            value = value + 1;
        }
    }

    public static void main(String[] args) throws InterruptedException {
        if (args.length != 1 || !(args[0].equals("safe") || args[0].equals("unsafe"))) {
            throw new IllegalArgumentException("Choose safe or unsafe");
        }
        safe = args[0].equals("safe");
        value = 0;
        Thread first = new Thread(JpfCounter::increment, "first");
        Thread second = new Thread(JpfCounter::increment, "second");
        first.start(); second.start();
        first.join(); second.join();
        assert value == 2 : "Lost update: value=" + value;
    }
}
