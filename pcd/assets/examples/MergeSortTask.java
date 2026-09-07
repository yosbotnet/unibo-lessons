import java.util.Arrays;
import java.util.Objects;
import java.util.concurrent.RecursiveAction;

/** Sort [lo, hi); caller must not access this range until completion. */
public final class MergeSortTask extends RecursiveAction {
    private static final long serialVersionUID = 1L;
    private final int[] array;
    private final int[] scratch;
    private final int lo;
    private final int hi;
    private final int threshold;

    public MergeSortTask(int[] array, int lo, int hi, int threshold) {
        this.array = Objects.requireNonNull(array);
        Objects.checkFromToIndex(lo, hi, array.length);
        if (threshold < 1) throw new IllegalArgumentException("Positive threshold required");
        this.scratch = new int[array.length]; // One buffer shared by disjoint tasks.
        this.lo = lo;
        this.hi = hi;
        this.threshold = threshold;
    }

    private MergeSortTask(int[] array, int[] scratch, int lo, int hi, int threshold) {
        this.array = array;
        this.scratch = scratch;
        this.lo = lo;
        this.hi = hi;
        this.threshold = threshold;
    }

    @Override
    protected void compute() {
        if (hi - lo <= threshold) {
            Arrays.sort(array, lo, hi);
            return;
        }
        int mid = lo + (hi - lo) / 2;
        MergeSortTask left = new MergeSortTask(array, scratch, lo, mid, threshold);
        MergeSortTask right = new MergeSortTask(array, scratch, mid, hi, threshold);
        left.fork();
        right.compute();
        left.join(); // Both child ranges are sorted before merging.
        merge(mid);
    }

    private void merge(int mid) {
        int left = lo;
        int right = mid;
        for (int out = lo; out < hi; out++) {
            if (right == hi || (left < mid && array[left] <= array[right])) {
                scratch[out] = array[left++];
            } else {
                scratch[out] = array[right++];
            }
        }
        System.arraycopy(scratch, lo, array, lo, hi - lo);
    }
}
