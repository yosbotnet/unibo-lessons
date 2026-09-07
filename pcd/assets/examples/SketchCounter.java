import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.Timer;

/** Small alternative to the active-agent example: everything is EDT-confined. */
public final class SketchCounter {
    private SketchCounter() { }

    static final class Controller {
        private long count; // No other thread reads or writes this model.
        private boolean closed;
        final JPanel panel = new JPanel(new BorderLayout(12, 12));
        final JLabel display = new JLabel("0", SwingConstants.CENTER);
        final JButton increment = new JButton("+1 (I)");
        final JButton reset = new JButton("Reset (R)");
        final Timer timer;

        Controller(int delayMillis) {
            requireEdt();
            if (delayMillis <= 0) throw new IllegalArgumentException("Positive timer delay required");
            panel.setBackground(new Color(0xF3EFE3));
            panel.setBorder(BorderFactory.createEmptyBorder(24, 24, 24, 24));
            display.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 32));
            display.setForeground(new Color(0x1546B8));
            JPanel buttons = new JPanel();
            buttons.setBackground(panel.getBackground());
            buttons.add(increment); buttons.add(reset);
            panel.add(display, BorderLayout.CENTER);
            panel.add(buttons, BorderLayout.SOUTH);
            increment.addActionListener(event -> increment());
            reset.addActionListener(event -> reset());
            bind(KeyEvent.VK_I, "increment", this::increment);
            bind(KeyEvent.VK_R, "reset", this::reset);
            timer = new Timer(delayMillis, event -> increment());
            timer.start();
        }

        private void bind(int key, String name, Runnable action) {
            panel.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                    .put(KeyStroke.getKeyStroke(key, 0), name);
            panel.getActionMap().put(name, new AbstractAction() {
                private static final long serialVersionUID = 1L;
                @Override public void actionPerformed(ActionEvent event) { action.run(); }
            });
        }

        void increment() {
            requireEdt();
            if (!closed) { count++; display.setText(Long.toString(count)); }
        }

        void reset() {
            requireEdt();
            if (!closed) { count = 0; display.setText("0"); }
        }

        void close() {
            requireEdt();
            closed = true;
            timer.stop();
        }
    }

    static void requireEdt() {
        if (!SwingUtilities.isEventDispatchThread()) {
            throw new IllegalStateException("This model and view belong to the EDT");
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            Controller controller = new Controller(1000);
            JFrame frame = new JFrame("Input e timer · esempio editoriale");
            frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
            frame.setContentPane(controller.panel);
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
