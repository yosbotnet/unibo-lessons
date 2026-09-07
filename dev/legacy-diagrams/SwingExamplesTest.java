import java.awt.BorderLayout;
import java.awt.Robot;
import java.awt.Frame;
import java.awt.AWTEvent;
import java.awt.EventQueue;
import java.awt.Toolkit;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.awt.event.WindowEvent;
import java.awt.event.InvocationEvent;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;

public final class SwingExamplesTest {
    private SwingExamplesTest() { }
    private static final AtomicInteger checks = new AtomicInteger();
    private static final CountingEventQueue events = new CountingEventQueue();

    private static final class CountingEventQueue extends EventQueue {
        final AtomicInteger postedInvocations = new AtomicInteger();
        @Override public void postEvent(AWTEvent event) {
            if (event.getClass() == InvocationEvent.class) postedInvocations.incrementAndGet();
            super.postEvent(event);
        }
        void restore() { pop(); }
    }

    private static void require(boolean condition, String message) {
        checks.incrementAndGet();
        if (!condition) throw new AssertionError(message);
    }

    private static void edt(Runnable action) throws Exception {
        SwingUtilities.invokeAndWait(action);
    }

    private static void await(CountDownLatch latch) throws InterruptedException {
        require(latch.await(5, TimeUnit.SECONDS), "Latch timeout");
    }

    private static void model() {
        AtomicLong clock = new AtomicLong();
        StopwatchModel model = new StopwatchModel(clock::get);
        long expectedMillis = 0;
        long revision = 0;
        boolean running = false;
        Random random = new Random(20260907);
        for (int i = 0; i < 10000; i++) {
            int operation = random.nextInt(4);
            if (operation == 0) {
                long advance = random.nextInt(5000);
                clock.addAndGet(advance * 1_000_000);
                if (running) expectedMillis += advance;
            } else if (operation == 1) {
                model.start(); running = true; revision++;
            } else if (operation == 2) {
                model.stop(); running = false; revision++;
            } else {
                model.reset(); expectedMillis = 0; revision++;
            }
            StopwatchModel.Snapshot value = model.snapshot();
            require(value.millis() == expectedMillis, "Elapsed time, including repeated Start and reset");
            require(value.running() == running, "Running state");
            require(value.revision() == revision, "Command revision");
        }
        clock.set(Long.MAX_VALUE - 2_000_000);
        model.reset(); model.start(); clock.addAndGet(4_000_000);
        require(model.snapshot().millis() == 4, "nanoTime subtraction across signed wrap");
    }

    private static void dispatch() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch later = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        SwingUtilities.invokeLater(() -> {
            try {
                JLabel display = new JLabel("before");
                display.setText("after");
                require(display.getText().equals("after"), "setText changes component state in this call");
                JTextField field = new JTextField("before");
                field.setText("after");
                require(field.getText().equals("after"), "Text-field document changes during setText too");
                SwingUtilities.invokeLater(later::countDown);
                entered.countDown();
                // Bounded test only: deliberately hold the EDT to observe queuing.
                await(release);
            } catch (Throwable error) { failure.set(error); entered.countDown(); }
        });
        try {
            await(entered);
            require(later.getCount() == 1, "invokeLater callback cannot run inside held EDT task");
        } finally { release.countDown(); }
        await(later); edt(() -> { });
        if (failure.get() != null) throw new AssertionError(failure.get());
    }

    private static void stopwatch() throws Exception {
        AtomicLong clock = new AtomicLong();
        StopwatchModel model = new StopwatchModel(clock::get);
        AtomicReference<ConcurrentStopwatch.Controller> ref = new AtomicReference<>();
        List<StopwatchModel.Snapshot> shown = new ArrayList<>();
        edt(() -> ref.set(new ConcurrentStopwatch.Controller(model, value -> {
            require(SwingUtilities.isEventDispatchThread(), "All view callbacks on EDT");
            shown.add(value);
        }, 60000)));
        ConcurrentStopwatch.Controller controller = ref.get();
        try {
            try { controller.start(); throw new AssertionError("Off-EDT control accepted"); }
            catch (IllegalStateException expected) { checks.incrementAndGet(); }
            edt(controller::start);
            clock.set(2_000_000_000L);
            controller.sample(); edt(() -> { });
            edt(() -> require(shown.get(shown.size() - 1).millis() == 2000, "Captured worker sample"));

            CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
            AtomicReference<Throwable> failure = new AtomicReference<>();
            // This event enters before the worker posts a sample, then resets.
            SwingUtilities.invokeLater(() -> {
                try {
                    entered.countDown(); await(release); controller.reset();
                } catch (Throwable error) { failure.set(error); }
            });
            try {
                await(entered);
                int postedBefore = events.postedInvocations.get();
                for (int i = 0; i < 1000; i++) controller.sample();
                require(events.postedInvocations.get() - postedBefore == 1, "Exactly one actual InvocationEvent posted for 1000 held-EDT samples");
            } finally { release.countDown(); }
            edt(() -> { });
            if (failure.get() != null) throw new AssertionError(failure.get());
            edt(() -> {
                require(shown.size() == 4, "1000 pending refresh requests coalesced and stale sample discarded");
                require(shown.get(3).millis() == 0, "Old sample did not undo Reset");
                controller.start(); // Repeated Start does not reset elapsed time.
                try { controller.awaitClosed(1, TimeUnit.MILLISECONDS); throw new AssertionError("EDT allowed to wait"); }
                catch (IllegalStateException expected) { checks.incrementAndGet(); }
                catch (InterruptedException impossible) { throw new AssertionError(impossible); }
                controller.close(); controller.close();
            });
            require(controller.awaitClosed(5, TimeUnit.SECONDS), "Sampler stops on close");
            int before = shown.size();
            controller.sample(); edt(controller::start); edt(() -> { });
            require(shown.size() == before, "No view update after close");
        } finally {
            edt(controller::close);
            require(controller.awaitClosed(5, TimeUnit.SECONDS), "Stopwatch cleanup");
        }

        CountDownLatch refreshed = new CountDownLatch(2);
        edt(() -> ref.set(new ConcurrentStopwatch.Controller(new StopwatchModel(), value -> {
            require(SwingUtilities.isEventDispatchThread(), "Scheduled refresh on EDT");
            refreshed.countDown();
        }, 10)));
        try { await(refreshed); }
        finally { edt(ref.get()::close); require(ref.get().awaitClosed(5, TimeUnit.SECONDS), "Real scheduled sampler cleanup"); }
    }

    private static void counter() throws Exception {
        AtomicReference<SketchCounter.Controller> ref = new AtomicReference<>();
        edt(() -> ref.set(new SketchCounter.Controller(60000)));
        SketchCounter.Controller counter = ref.get();
        try {
            try { counter.increment(); throw new AssertionError("Off-EDT counter accepted"); }
            catch (IllegalStateException expected) { checks.incrementAndGet(); }
            edt(() -> {
                for (int i = 0; i < 10; i++) counter.increment.doClick(0);
                require(counter.display.getText().equals("10"), "Increment button");
                Object key = counter.panel.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                        .get(KeyStroke.getKeyStroke(KeyEvent.VK_I, 0));
                require(key.equals("increment"), "Window-level I binding");
                counter.panel.getActionMap().get(key).actionPerformed(new ActionEvent(counter, 0, "I"));
                require(counter.display.getText().equals("11"), "Key action");
                counter.reset.doClick(0);
                require(counter.display.getText().equals("0"), "Reset button");
                counter.timer.getActionListeners()[0].actionPerformed(new ActionEvent(counter, 0, "tick"));
                require(counter.display.getText().equals("1"), "Timer callback");
                counter.close(); counter.increment(); counter.reset();
                require(!counter.timer.isRunning() && counter.display.getText().equals("1"), "Closed controller ignores queued actions");
            });
        } finally { edt(counter::close); }
        CountDownLatch fired = new CountDownLatch(1);
        edt(() -> {
            ref.set(new SketchCounter.Controller(10));
            ref.get().timer.addActionListener(event -> fired.countDown());
        });
        try { await(fired); }
        finally { edt(ref.get()::close); }
    }

    private static void windows(String directory) throws Exception {
        AtomicReference<JFrame> frame = new AtomicReference<>();
        AtomicReference<SketchCounter.Controller> counter = new AtomicReference<>();
        AtomicReference<ConcurrentStopwatch.Controller> stopwatch = new AtomicReference<>();
        AtomicReference<ConcurrentStopwatch.View> view = new AtomicReference<>();
        edt(() -> {
            JFrame window = new JFrame("Esempi Swing verificati");
            ConcurrentStopwatch.View clockView = new ConcurrentStopwatch.View();
            ConcurrentStopwatch.Controller clock = new ConcurrentStopwatch.Controller(new StopwatchModel(), clockView::show, 100);
            clockView.bind(clock);
            SketchCounter.Controller keys = new SketchCounter.Controller(60000);
            window.add(clockView.panel, BorderLayout.NORTH); window.add(keys.panel, BorderLayout.SOUTH);
            window.pack(); window.setLocation(0, 0); window.setVisible(true);
            frame.set(window); counter.set(keys); stopwatch.set(clock); view.set(clockView);
        });
        try {
            Robot robot = new Robot(); robot.waitForIdle();
            edt(() -> { frame.get().toFront(); counter.get().reset.requestFocusInWindow(); });
            robot.waitForIdle();
            robot.keyPress(KeyEvent.VK_I); robot.keyRelease(KeyEvent.VK_I); robot.waitForIdle();
            edt(() -> require(counter.get().display.getText().equals("1"), "Physical I key while Reset button has focus"));
            robot.keyPress(KeyEvent.VK_R); robot.keyRelease(KeyEvent.VK_R); robot.waitForIdle();
            edt(() -> {
                require(counter.get().display.getText().equals("0"), "Physical R key");
                view.get().start.doClick(0);
                require(!view.get().start.isEnabled() && view.get().stop.isEnabled(), "Start control states");
                view.get().stop.doClick(0);
                require(view.get().start.isEnabled() && !view.get().stop.isEnabled(), "Stop control states");
                view.get().reset.doClick(0);
                require(view.get().display.getText().equals("0.000 s"), "Stopwatch reset display");
            });
            robot.waitForIdle();
            AtomicReference<BufferedImage> shot = new AtomicReference<>();
            edt(() -> shot.set(robot.createScreenCapture(frame.get().getBounds())));
            ImageIO.write(shot.get(), "png", new File(directory, "swing-java-windows.png"));
        } finally {
            edt(() -> { stopwatch.get().close(); counter.get().close(); frame.get().dispose(); });
            require(stopwatch.get().awaitClosed(5, TimeUnit.SECONDS), "Window test worker cleanup");
        }
    }

    public static void main(String[] args) throws Exception {
        Toolkit.getDefaultToolkit().getSystemEventQueue().push(events);
        try {
            model(); dispatch(); stopwatch(); counter();
            if (args.length == 1) { windows(args[0]); launchers(); }
        } finally { edt(events::restore); }
        System.out.println(checks.get() + " checks: clock, EDT dispatch, coalescing, stale snapshots, controls, timers, cleanup" + (args.length == 1 ? ", physical keyboard and windows" : " (headless)"));
    }

    private static void launchers() throws Exception {
        ConcurrentStopwatch.main(new String[0]);
        SketchCounter.main(new String[0]);
        edt(() -> {
            int open = 0;
            for (Frame frame : Frame.getFrames()) if (frame.isDisplayable()) {
                open++;
                frame.dispatchEvent(new WindowEvent(frame, WindowEvent.WINDOW_CLOSING));
                require(!frame.isDisplayable(), "Actual main window closes");
            }
            require(open == 2, "Both real launchers constructed their windows");
        });
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (Thread.getAllStackTraces().keySet().stream()
                .anyMatch(thread -> thread.isAlive() && thread.getName().equals("stopwatch-sampler"))) {
            require(System.nanoTime() < deadline, "Actual close listener did not stop sampler");
            Thread.sleep(10);
        }
    }
}
