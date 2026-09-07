import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;

/** Java 17 editorial MVC example: one sampler, not a new thread per Start. */
public final class ConcurrentStopwatch {
    private ConcurrentStopwatch() { }

    static void requireEdt() {
        if (!SwingUtilities.isEventDispatchThread()) {
            throw new IllegalStateException("This operation belongs to the EDT");
        }
    }

    static final class Controller {
        private final StopwatchModel model;
        private final Consumer<StopwatchModel.Snapshot> view;
        private final ScheduledThreadPoolExecutor sampler;
        private final AtomicBoolean refreshPending = new AtomicBoolean();
        private boolean closed; // Accessed only by the EDT.

        Controller(StopwatchModel model, Consumer<StopwatchModel.Snapshot> view,
                long refreshMillis) {
            requireEdt();
            if (refreshMillis <= 0) throw new IllegalArgumentException("Positive refresh period required");
            this.model = Objects.requireNonNull(model);
            this.view = Objects.requireNonNull(view);
            view.accept(model.snapshot());
            sampler = new ScheduledThreadPoolExecutor(1,
                    job -> new Thread(job, "stopwatch-sampler"));
            sampler.scheduleWithFixedDelay(this::sample, refreshMillis,
                    refreshMillis, TimeUnit.MILLISECONDS);
        }

        void start() {
            requireEdt();
            if (!closed) { model.start(); view.accept(model.snapshot()); }
        }

        void stop() {
            requireEdt();
            if (!closed) { model.stop(); view.accept(model.snapshot()); }
        }

        void reset() {
            requireEdt();
            if (!closed) { model.reset(); view.accept(model.snapshot()); }
        }

        void sample() {
            // Coalesce refreshes: at most one queued refresh callback.
            if (!refreshPending.compareAndSet(false, true)) return;
            final StopwatchModel.Snapshot value = model.snapshot();
            SwingUtilities.invokeLater(() -> {
                requireEdt();
                refreshPending.set(false);
                // A queued old sample must not undo Stop/Reset/Start or close.
                if (!closed && value.revision() == model.snapshot().revision()) {
                    view.accept(value);
                }
            });
        }

        void close() {
            requireEdt();
            if (!closed) {
                closed = true;
                model.stop();
                sampler.shutdownNow();
            }
        }

        boolean awaitClosed(long timeout, TimeUnit unit) throws InterruptedException {
            if (SwingUtilities.isEventDispatchThread()) {
                throw new IllegalStateException("Never await worker termination on the EDT");
            }
            return sampler.awaitTermination(timeout, unit);
        }
    }

    static final class View {
        final JPanel panel = new JPanel(new BorderLayout(12, 12));
        final JLabel display = new JLabel("0.000 s", SwingConstants.CENTER);
        final JLabel state = new JLabel("Fermo", SwingConstants.CENTER);
        final JButton start = new JButton("Start");
        final JButton stop = new JButton("Stop");
        final JButton reset = new JButton("Reset");

        View() {
            requireEdt();
            Color ivory = new Color(0xF3EFE3);
            panel.setBackground(ivory);
            panel.setBorder(BorderFactory.createEmptyBorder(24, 24, 24, 24));
            display.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 32));
            display.setForeground(new Color(0x1546B8));
            JPanel buttons = new JPanel();
            buttons.setBackground(ivory);
            buttons.add(start); buttons.add(stop); buttons.add(reset);
            panel.add(state, BorderLayout.NORTH);
            panel.add(display, BorderLayout.CENTER);
            panel.add(buttons, BorderLayout.SOUTH);
        }

        void show(StopwatchModel.Snapshot value) {
            requireEdt();
            display.setText(String.format(Locale.ROOT, "%d.%03d s",
                    value.millis() / 1000, value.millis() % 1000));
            state.setText(value.running() ? "In esecuzione" : "Fermo");
            start.setEnabled(!value.running());
            stop.setEnabled(value.running());
        }

        void bind(Controller controller) {
            requireEdt();
            start.addActionListener(event -> controller.start());
            stop.addActionListener(event -> controller.stop());
            reset.addActionListener(event -> controller.reset());
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            View view = new View();
            Controller controller = new Controller(new StopwatchModel(), view::show, 100);
            view.bind(controller);
            JFrame frame = new JFrame("Cronometro MVC · esempio editoriale");
            frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
            frame.setContentPane(view.panel);
            frame.addWindowListener(new WindowAdapter() {
                @Override public void windowClosing(WindowEvent event) { controller.close(); }
                @Override public void windowClosed(WindowEvent event) { controller.close(); }
            });
            frame.pack();
            frame.setLocationByPlatform(true);
            frame.setVisible(true);
        });
    }
}
