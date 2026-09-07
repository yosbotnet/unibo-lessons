import java.util.Objects;
import java.util.concurrent.RecursiveTask;

/** Sum [lo, hi). The caller must not mutate the array until the task completes. */
public final class SumTask extends RecursiveTask<Long> {
    private static final long serialVersionUID = 1L;
    private final int[] array;
    private final int lo;
    private final int hi;
    private final int threshold;

    public SumTask(int[] array, int lo, int hi, int threshold) {
        this.array = Objects.requireNonNull(array);
        Objects.checkFromToIndex(lo, hi, array.length);
        if (threshold < 1) throw new IllegalArgumentException("Positive threshold required");
        this.lo = lo;
        this.hi = hi;
        this.threshold = threshold;
    }

    @Override
    protected Long compute() {
        if (hi - lo <= threshold) {
            long sum = 0;
            for (int i = lo; i < hi; i++) sum += array[i];
            return sum;
        }
        int mid = lo + (hi - lo) / 2;
        SumTask left = new SumTask(array, lo, mid, threshold);
        SumTask right = new SumTask(array, mid, hi, threshold);
        left.fork(); // Schedule work, not necessarily on a different worker.
        long rightResult = right.compute();
        return left.join() + rightResult;
    }
}
