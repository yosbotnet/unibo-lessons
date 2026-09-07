import java.util.Arrays;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.TimeUnit;

/** Java 17 entry point for the two canonical task classes. */
public final class ForkJoinExamples {
    private ForkJoinExamples() { }

    public static void main(String[] args) throws InterruptedException {
        int[] values = {8, 3, 7, 1, 9, 2, 6, 4};
        ForkJoinPool pool = new ForkJoinPool(2);
        try {
            long sum = pool.invoke(new SumTask(values, 0, values.length, 2));
            System.out.println("sum = " + sum);
            pool.invoke(new MergeSortTask(values, 0, values.length, 2));
            System.out.println("sorted = " + Arrays.toString(values));
        } finally {
            pool.shutdown(); // This method owns the pool, not the common pool.
        }
        if (!pool.awaitTermination(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Pool did not terminate within test deadline");
        }
    }
}
