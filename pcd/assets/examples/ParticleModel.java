/** Java 17: linear drag and elastic wall reflections; no ball-ball collisions. */
public final class ParticleModel {
    public record State(double x, double y, double vx, double vy, double radius) { }
    private final double width, height, radius, drag;
    private double x, y, vx, vy;

    public ParticleModel(double width, double height, double radius,
            double x, double y, double vx, double vy, double drag) {
        require(Double.isFinite(width) && width >= 1 && width <= 1e6);
        require(Double.isFinite(height) && height >= 1 && height <= 1e6);
        require(Double.isFinite(radius) && radius > 0);
        require(width - 2 * radius >= 1 && height - 2 * radius >= 1);
        require(Double.isFinite(x) && x >= radius && x <= width - radius);
        require(Double.isFinite(y) && y >= radius && y <= height - radius);
        require(Double.isFinite(vx) && Math.abs(vx) <= 1e6);
        require(Double.isFinite(vy) && Math.abs(vy) <= 1e6);
        require(Double.isFinite(drag) && drag >= 0 && drag <= 100);
        this.width = width; this.height = height; this.radius = radius;
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.drag = drag;
    }

    private static void require(boolean valid) {
        if (!valid) throw new IllegalArgumentException("Outside demo domain");
    }

    /** Seconds, not milliseconds. Only the simulation owner may call this. */
    public void update(double dt) {
        require(Double.isFinite(dt) && dt >= 0 && dt <= 60);
        if (dt == 0) return;
        double decay = drag * dt;
        double attenuation = Math.exp(-decay);
        double travelTime = decay == 0 ? dt : dt * (-Math.expm1(-decay) / decay);
        double[] horizontal = reflect(x - radius, vx, width - 2 * radius,
                travelTime, attenuation);
        double[] vertical = reflect(y - radius, vy, height - 2 * radius,
                travelTime, attenuation);
        x = radius + horizontal[0]; vx = horizontal[1];
        y = radius + vertical[0]; vy = vertical[1];
    }

    // Unfold the path, then fold it into [0,length], including multiple hits.
    private static double[] reflect(double position, double velocity,
            double length, double travelTime, double attenuation) {
        double period = 2 * length;
        double folded = (position + velocity * travelTime) % period;
        if (folded < 0) folded += period;
        double speed = velocity * attenuation;
        if (folded == 0) return new double[]{0, Math.abs(speed)};
        if (folded == length) return new double[]{length, -Math.abs(speed)};
        if (folded < length) return new double[]{folded, speed};
        return new double[]{period - folded, -speed};
    }

    /** Immutable value. The mutable model itself is not thread-safe. */
    public State snapshot() { return new State(x, y, vx, vy, radius); }
}
