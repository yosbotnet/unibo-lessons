import java.awt.Color;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongSupplier;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.Timer;

/** Worker-owned simulation; the EDT sees immutable snapshots, not mutable balls. */
public final class BouncingBallsDemo {
    private BouncingBallsDemo() { }
    static final double WORLD_WIDTH = 100, WORLD_HEIGHT = 60;
    record Frame(List<ParticleModel.State> balls, double time, double discarded) {
        Frame { balls = List.copyOf(balls); }
    }

    static final class Engine {
        private final List<ParticleModel> balls = List.of(
                new ParticleModel(WORLD_WIDTH, WORLD_HEIGHT, 3, 20, 20, 34, 17, 0.12),
                new ParticleModel(WORLD_WIDTH, WORLD_HEIGHT, 4, 70, 40, -27, -24, 0.12),
                new ParticleModel(WORLD_WIDTH, WORLD_HEIGHT, 2, 50, 30, 21, -35, 0.12));
        private final LongSupplier clock;
        private final ScheduledThreadPoolExecutor worker;
        final AtomicReference<Frame> latest;
        private long previous;
        private double time, discarded;
        private volatile boolean closed;

        Engine(LongSupplier clock, boolean automatic) {
            this.clock = clock;
            previous = clock.getAsLong();
            latest = new AtomicReference<>(capture());
            worker = new ScheduledThreadPoolExecutor(1,
                    task -> new Thread(task, "balls-simulation"));
            if (automatic) worker.scheduleWithFixedDelay(this::pulse,
                    20, 20, TimeUnit.MILLISECONDS);
        }

        private Frame capture() {
            return new Frame(balls.stream().map(ParticleModel::snapshot).toList(),
                    time, discarded);
        }

        // Called only by the worker, or sequentially by tests in manual mode.
        void pulse() {
            if (closed) return;
            long now = clock.getAsLong();
            double elapsed = Math.max(0, (now - previous) / 1e9);
            previous = now;
            // Explicit animation policy: report time discarded after long stalls.
            double dt = Math.min(elapsed, 0.25);
            discarded += elapsed - dt;
            for (ParticleModel ball : balls) ball.update(dt);
            time += dt;
            latest.set(capture());
        }

        void close() { closed = true; worker.shutdownNow(); }
        boolean awaitClosed() throws InterruptedException {
            if (SwingUtilities.isEventDispatchThread()) {
                throw new IllegalStateException("Do not wait for a worker on EDT");
            }
            return worker.awaitTermination(5, TimeUnit.SECONDS);
        }
    }

    // Uniform scale keeps logical circles circular, with letterboxing on resize.
    record Viewport(double scale, double left, double top) {
        static Viewport of(int width, int height) {
            double scale = Math.max(0,
                    Math.min((width - 32) / WORLD_WIDTH, (height - 64) / WORLD_HEIGHT));
            return new Viewport(scale, (width - WORLD_WIDTH * scale) / 2,
                    16 + (height - 64 - WORLD_HEIGHT * scale) / 2);
        }
    }

    static final class View extends JPanel {
        private static final long serialVersionUID = 1L;
        private Frame frame;
        View(Frame initial) {
            requireEdt(); frame = initial;
            setPreferredSize(new Dimension(720, 470));
            setBackground(new Color(0xF3EFE3));
        }
        void show(Frame value) { requireEdt(); frame = value; repaint(); }
        @Override protected void paintComponent(Graphics graphics) {
            super.paintComponent(graphics);
            Graphics2D g = (Graphics2D) graphics.create();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                        RenderingHints.VALUE_ANTIALIAS_ON);
                Viewport v = Viewport.of(getWidth(), getHeight());
                g.translate(v.left(), v.top()); g.scale(v.scale(), v.scale());
                g.setStroke(new java.awt.BasicStroke((float) (1.5 / Math.max(v.scale(), 1e-6))));
                g.setColor(new Color(0xC9C3B6));
                g.draw(new java.awt.geom.Rectangle2D.Double(0, 0, WORLD_WIDTH, WORLD_HEIGHT));
                int index = 0;
                for (ParticleModel.State s : frame.balls()) {
                    g.setColor(new Color(index++ == 1 ? 0xB83D2D : 0x1546B8));
                    g.fill(new java.awt.geom.Ellipse2D.Double(s.x() - s.radius(),
                            s.y() - s.radius(), 2 * s.radius(), 2 * s.radius()));
                }
            } finally { g.dispose(); }
            graphics.setColor(new Color(0x171813));
            graphics.drawString(String.format(Locale.ROOT,
                    "t simulato %.2f s · tempo scartato %.2f s",
                    frame.time(), frame.discarded()), 16, getHeight() - 12);
        }
    }

    static final class Controller {
        final Engine engine;
        final View view;
        final Timer refresh;
        private boolean closed;
        Controller() {
            requireEdt(); engine = new Engine(System::nanoTime, true);
            view = new View(engine.latest.get());
            refresh = new Timer(20, event -> {
                if (!closed) view.show(engine.latest.get());
            });
            refresh.setCoalesce(true); refresh.start();
        }
        void close() {
            requireEdt(); closed = true; refresh.stop(); engine.close();
        }
    }
    static void requireEdt() {
        if (!SwingUtilities.isEventDispatchThread()) {
            throw new IllegalStateException("View/controller belong to EDT");
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            Controller controller = new Controller();
            JFrame frame = new JFrame("Moto e bordi · esempio editoriale");
            frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
            frame.setContentPane(controller.view);
            frame.addWindowListener(new WindowAdapter() {
                @Override public void windowClosing(WindowEvent event) {
                    controller.close();
                }
                @Override public void windowClosed(WindowEvent event) {
                    controller.close();
                }
            });
            frame.pack(); frame.setLocationByPlatform(true); frame.setVisible(true);
        });
    }
}
