import java.awt.GraphicsEnvironment;
import java.awt.Window;
import java.awt.event.WindowEvent;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.Arrays;
import java.util.Random;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import javax.imageio.ImageIO;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;

public final class PhysicsExamplesTest {
    private PhysicsExamplesTest() { }
    private static int checks;
    private static void require(boolean valid, String message) {
        checks++;
        if (!valid) throw new AssertionError(message);
    }
    private static void near(double a, double b) {
        require(Math.abs(a-b) <= 2e-8 * Math.max(1, Math.abs(b)), a+" != "+b);
    }
    // Independent oracle: advance to each collision time, then reflect velocity.
    private static double[] events(double p, double v, double lo, double hi,
            double k, double dt) {
        int hits = 0;
        while (dt > 0 && v != 0) {
            double distance = v > 0 ? hi-p : p-lo;
            double ratio = k * distance / Math.abs(v);
            double hitTime = k == 0 ? distance / Math.abs(v)
                    : ratio >= 1 ? Double.POSITIVE_INFINITY : -Math.log1p(-ratio)/k;
            if (hitTime > dt) {
                p += k == 0 ? v*dt : v*(-Math.expm1(-k*dt))/k;
                v *= Math.exp(-k*dt); break;
            }
            p = v > 0 ? hi : lo;
            v = -v * Math.exp(-k*hitTime);
            dt -= hitTime;
            if (++hits > 10000) throw new AssertionError("Oracle hit bound");
        }
        return new double[]{p,v};
    }
    private static void model() {
        Random random = new Random(20260907);
        for (int i = 0; i < 2000; i++) {
            double x = 1+random.nextDouble()*8, y = 1+random.nextDouble()*8;
            double vx = random.nextDouble()*200-100, vy = random.nextDouble()*200-100;
            double k = i%3 == 0 ? 0 : random.nextDouble()*2, dt = random.nextDouble()*5;
            ParticleModel m = new ParticleModel(10,10,1,x,y,vx,vy,k);
            ParticleModel divided = new ParticleModel(10,10,1,x,y,vx,vy,k);
            m.update(dt);
            for (int j = 0; j < 10; j++) divided.update(dt/10);
            var s = m.snapshot(); var d = divided.snapshot();
            double[] a = events(x,vx,1,9,k,dt), b = events(y,vy,1,9,k,dt);
            near(s.x(),a[0]); near(s.vx(),a[1]); near(s.y(),b[0]); near(s.vy(),b[1]);
            near(s.x(),d.x()); near(s.y(),d.y()); near(s.vx(),d.vx()); near(s.vy(),d.vy());
            require(s.x() >= 1 && s.x() <= 9 && s.y() >= 1 && s.y() <= 9,"Radius bounds");
            require(Math.hypot(s.vx(),s.vy()) <= Math.hypot(vx,vy)+1e-9,"No energy gain");
        }
        ParticleModel m = new ParticleModel(10,10,1,8,3,5,2,0);
        var before = m.snapshot(); m.update(0); require(before.equals(m.snapshot()),"dt=0 unchanged");
        m.update(0.2); var hit = m.snapshot(); near(hit.x(),9); near(hit.y(),3.4); near(hit.vx(),-5); near(hit.vy(),2);
        m.update(0.8); var after = m.snapshot(); near(after.x(),5); near(after.y(),5);
        near(after.vx(),-5); near(after.vy(),2);
        System.out.println("trace="+Arrays.toString(new double[]{before.x(),before.y(),hit.x(),hit.y(),after.x(),after.y(),after.vx(),after.vy()}));
        ParticleModel tiny = new ParticleModel(10,10,1,2,2,1,1,Double.MIN_VALUE);
        tiny.update(0.01); near(tiny.snapshot().x(),2.01);
        ParticleModel corner = new ParticleModel(10,10,1,8,8,1,1,0);
        corner.update(1); near(corner.snapshot().vx(),-1); near(corner.snapshot().vy(),-1);
        ParticleModel high = new ParticleModel(10,10,1,1,1,1e6,-1e6,0);
        high.update(60); near(high.snapshot().x(),1); near(high.snapshot().vx(),1e6);
        for (double bad : new double[]{-1,61,Double.NaN,Double.POSITIVE_INFINITY}) {
            var saved=m.snapshot();
            try { m.update(bad); throw new AssertionError("Invalid dt accepted"); }
            catch (IllegalArgumentException expected) { require(m.snapshot().equals(saved),"Invalid step is atomic"); }
        }
        for (double bad : new double[]{-1,Double.NaN,Double.POSITIVE_INFINITY,101}) {
            try { new ParticleModel(10,10,1,2,2,1,1,bad); throw new AssertionError("Invalid drag"); }
            catch (IllegalArgumentException expected) { checks++; }
        }
        // Original fixed factor loses different speed at different update counts.
        require(Math.abs(Math.pow(.98,60)-Math.pow(.98,120)) > .1,"Original timestep dependence reproduced");
    }

    private static void engineAndView() throws Exception {
        AtomicLong clock = new AtomicLong();
        BouncingBallsDemo.Engine engine = new BouncingBallsDemo.Engine(clock::get,false);
        var first = engine.latest.get();
        try {
            clock.addAndGet(100_000_000); engine.pulse(); near(engine.latest.get().time(),.1);
            clock.addAndGet(10_000_000_000L); engine.pulse();
            near(engine.latest.get().time(),.35); near(engine.latest.get().discarded(),9.75);
            require(first.time()==0 && !first.balls().equals(engine.latest.get().balls()),"Old snapshot stays unchanged");
            try { first.balls().clear(); throw new AssertionError("Mutable snapshot list"); }
            catch (UnsupportedOperationException expected) { checks++; }
            SwingUtilities.invokeAndWait(() -> {
                BouncingBallsDemo.View view = new BouncingBallsDemo.View(first);
                for (int[] size : new int[][]{{720,470},{390,600},{900,250}}) {
                    view.setSize(size[0],size[1]);
                    BufferedImage image = new BufferedImage(size[0],size[1],BufferedImage.TYPE_INT_RGB);
                    var graphics = image.createGraphics(); view.paint(graphics); graphics.dispose();
                    var v = BouncingBallsDemo.Viewport.of(size[0],size[1]);
                    require(v.left() >= 16 && v.top() >= 16,"Viewport margins");
                    var ball = first.balls().get(0);
                    int cx=(int)Math.round(v.left()+ball.x()*v.scale());
                    int cy=(int)Math.round(v.top()+ball.y()*v.scale());
                    require((image.getRGB(cx,cy)&0xffffff)==0x1546B8,"Mapped ball center painted cobalt");
                    int edgeX=(int)Math.round(v.left()+50*v.scale());
                    int edgeY=(int)Math.round(v.top());
                    require((image.getRGB(edgeX,edgeY)&0xffffff)!=0xF3EFE3,
                            "Full-width arena edge painted, not inherited WIDTH/HEIGHT flags");
                }
                try { engine.awaitClosed(); throw new AssertionError("EDT wait accepted"); }
                catch (IllegalStateException expected) { checks++; }
                catch (InterruptedException e) { throw new AssertionError(e); }
            });
        } finally { engine.close(); require(engine.awaitClosed(),"Manual engine cleanup"); }
        var stopped=engine.latest.get(); clock.addAndGet(1_000_000_000); engine.pulse();
        require(engine.latest.get()==stopped,"No update after closure");
        AtomicReference<BouncingBallsDemo.Controller> reference = new AtomicReference<>();
        SwingUtilities.invokeAndWait(() -> reference.set(new BouncingBallsDemo.Controller()));
        var controller=reference.get();
        try {
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while (controller.engine.latest.get().time()==0 && System.nanoTime()<deadline) Thread.yield();
            require(controller.engine.latest.get().time()>0,"Actual worker advances model");
        } finally {
            SwingUtilities.invokeAndWait(controller::close);
            require(controller.engine.awaitClosed(),"Actual worker terminates");
        }
        SwingUtilities.invokeAndWait(() -> require(!controller.refresh.isRunning(),"EDT timer stopped"));
    }

    private static void window(String out) throws Exception {
        BouncingBallsDemo.main(new String[0]);
        SwingUtilities.invokeAndWait(() -> {
            int found = 0;
            for (Window window : Window.getWindows()) {
                if (window instanceof JFrame frame && frame.getTitle().startsWith("Moto e bordi")) {
                    found++;
                    try {
                        BufferedImage image=new BufferedImage(frame.getWidth(),frame.getHeight(),BufferedImage.TYPE_INT_RGB);
                        var g=image.createGraphics(); frame.paint(g); g.dispose();
                        ImageIO.write(image,"png",new File(out,"physics-java-window.png"));
                    } catch (java.io.IOException e) { throw new AssertionError(e); }
                    require(frame.isShowing(),"Real demo main window");
                    frame.dispatchEvent(new WindowEvent(frame,WindowEvent.WINDOW_CLOSING));
                    require(!frame.isDisplayable(),"Native close disposes frame");
                }
            }
            require(found == 1,"Exactly one demo main window inspected");
        });
    }
    public static void main(String[] args) throws Exception {
        model(); engineAndView();
        if (!GraphicsEnvironment.isHeadless()) window(args[0]);
        System.out.println("checks="+checks+"; oracle cases=2000; headless="+GraphicsEnvironment.isHeadless());
    }
}
