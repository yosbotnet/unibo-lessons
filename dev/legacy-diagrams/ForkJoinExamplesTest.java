import java.util.Arrays;
import java.util.Random;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.TimeUnit;

public final class ForkJoinExamplesTest {
    private ForkJoinExamplesTest() { }
    private static int checks;
    private static int cases;
    private static void require(boolean condition, String message) {
        checks++;
        if (!condition) throw new AssertionError(message);
    }

    private static void compare(ForkJoinPool pool, int[] input, int lo, int hi, int threshold) {
        cases++;
        int[] original = input.clone();
        long expectedSum = 0;
        for (int i = lo; i < hi; i++) expectedSum += input[i];
        require(pool.invoke(new SumTask(input, lo, hi, threshold)) == expectedSum, "Sum matches sequential oracle");
        require(Arrays.equals(input, original), "Sum must not change input");
        int[] expected = input.clone();
        Arrays.sort(expected, lo, hi);
        pool.invoke(new MergeSortTask(input, lo, hi, threshold));
        require(Arrays.equals(input, expected), "Sort matches whole-array oracle, including untouched prefix/suffix");
    }

    private static void invalid() {
        for (boolean sum : new boolean[]{true,false}) {
            for (int[] range : new int[][]{{-1,1},{2,1},{0,4}}) {
                try {
                    if (sum) new SumTask(new int[3],range[0],range[1],1);
                    else new MergeSortTask(new int[3],range[0],range[1],1);
                    throw new AssertionError("Invalid range accepted");
                } catch (IndexOutOfBoundsException expected) { checks++; }
            }
            for (int threshold : new int[]{0,-1}) {
                try {
                    if (sum) new SumTask(new int[3],0,3,threshold);
                    else new MergeSortTask(new int[3],0,3,threshold);
                    throw new AssertionError("Invalid threshold accepted");
                } catch (IllegalArgumentException expected) { checks++; }
            }
            try {
                if (sum) new SumTask(null,0,0,1);
                else new MergeSortTask(null,0,0,1);
                throw new AssertionError("Null accepted");
            } catch (NullPointerException expected) { checks++; }
        }
    }

    public static void main(String[] args) throws Exception {
        invalid();
        Random random = new Random(20260907);
        for (int parallelism : new int[]{1,2,4}) {
            ForkJoinPool pool = new ForkJoinPool(parallelism);
            try {
                for (int length : new int[]{0,1,2,3,7,31,999,1000,1001,2048}) {
                    for (int threshold : new int[]{1,2,17,1000}) {
                        for (int pattern = 0; pattern < 5; pattern++) {
                            int[] array = new int[length];
                            for (int i = 0; i < length; i++) {
                                array[i] = switch (pattern) {
                                    case 0 -> i;
                                    case 1 -> length-i;
                                    case 2 -> 7;
                                    case 3 -> i%2 == 0 ? Integer.MIN_VALUE : Integer.MAX_VALUE;
                                    default -> random.nextInt();
                                };
                            }
                            compare(pool,array,0,length,threshold);
                        }
                    }
                }
                for (int i = 0; i < 200; i++) {
                    int[] array = new int[random.nextInt(4096)];
                    for (int j = 0; j < array.length; j++) array[j] = random.nextInt(101)-50;
                    int lo = random.nextInt(array.length+1);
                    int hi = lo + random.nextInt(array.length-lo+1);
                    compare(pool,array,lo,hi,1+random.nextInt(100));
                }
                compare(pool,new int[]{Integer.MAX_VALUE,Integer.MAX_VALUE},0,2,1);
                compare(pool,new int[]{Integer.MIN_VALUE,Integer.MIN_VALUE},0,2,1);
                // Independent roots may share the pool, not the same mutable array.
                int[] first = {4,3,2,1}, second = {8,7,6,5};
                MergeSortTask a = new MergeSortTask(first,0,4,1);
                MergeSortTask b = new MergeSortTask(second,0,4,1);
                pool.execute(a); pool.execute(b); a.join(); b.join();
                require(Arrays.equals(first,new int[]{1,2,3,4}) && Arrays.equals(second,new int[]{5,6,7,8}), "Independent concurrent roots");
            } finally {
                pool.shutdown();
                require(pool.awaitTermination(10,TimeUnit.SECONDS), "Owned pool terminates");
            }
        }
        System.out.println(cases + " cases; " + checks + " checks; parallelism 1, 2, 4; sequential sum/sort oracles");
    }
}
