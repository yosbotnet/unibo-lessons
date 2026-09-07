/** Each operation is atomic; separate getVal + inc calls are not one operation. */
public final class BoundedCounter {
    public static final class OverflowException extends IllegalStateException {
        private static final long serialVersionUID = 1L;
    }
    public static final class UnderflowException extends IllegalStateException {
        private static final long serialVersionUID = 1L;
    }

    private int val;
    private final int min;
    private final int max;

    public BoundedCounter(int min, int max, int initial) {
        if (min > max || initial < min || initial > max) {
            throw new IllegalArgumentException("Require min <= initial <= max");
        }
        this.min = min;
        this.max = max;
        this.val = initial;
    }

    public synchronized void inc() {
        if (val >= max) throw new OverflowException();
        val++;
    }

    public synchronized void dec() {
        if (val <= min) throw new UnderflowException();
        val--;
    }

    public synchronized boolean tryInc() {
        if (val >= max) return false;
        val++;
        return true;
    }

    public synchronized boolean tryDec() {
        if (val <= min) return false;
        val--;
        return true;
    }

    public synchronized int getVal() {
        return val;
    }
}
