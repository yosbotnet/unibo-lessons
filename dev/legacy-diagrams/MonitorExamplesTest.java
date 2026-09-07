import java.lang.reflect.Field;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

public final class MonitorExamplesTest {
    interface Action { void run() throws Exception; }
    interface Cell { void set(int v); int get() throws InterruptedException; }
    interface Buffer { void put(int v) throws InterruptedException; int get() throws InterruptedException; }
    static final AtomicInteger checks = new AtomicInteger();
    static void check(boolean value, String message) { checks.incrementAndGet(); if (!value) throw new AssertionError(message); }
    static final class Task extends Thread {
        final Action action;
        volatile Throwable failure;
        Task(Action action) { this.action=action; setDaemon(true); start(); }
        public void run() { try { action.run(); } catch (Throwable e) { failure=e; } }
        void finish() throws Exception { join(5000); check(!isAlive(), "task terminates"); if(failure!=null)throw new AssertionError(failure); }
    }
    static void state(Thread t, Thread.State expected) throws Exception {
        long end=System.nanoTime()+5_000_000_000L;
        while(t.getState()!=expected && System.nanoTime()<end && t.isAlive())Thread.sleep(1);
        check(t.getState()==expected,"thread reaches "+expected+", got "+t.getState());
    }
    static Object field(Object o,String name) throws Exception { Field f=o.getClass().getDeclaredField(name); f.setAccessible(true); return f.get(o); }
    static void cells(boolean explicit) throws Exception {
        SynchCell intrinsic=new SynchCell(); SynchCell2 locked=new SynchCell2();
        Cell c=explicit?new Cell(){public void set(int v){locked.set(v);}public int get()throws InterruptedException{return locked.get();}}:new Cell(){public void set(int v){intrinsic.set(v);}public int get()throws InterruptedException{return intrinsic.get();}};
        AtomicInteger sum=new AtomicInteger(); Task a=new Task(()->sum.addAndGet(c.get())), b=new Task(()->sum.addAndGet(c.get()));
        state(a,Thread.State.WAITING); state(b,Thread.State.WAITING);
        if(!explicit){ synchronized(intrinsic){intrinsic.notifyAll(); state(a,Thread.State.BLOCKED); state(b,Thread.State.BLOCKED);check(sum.get()==0,"notification retains monitor");}state(a,Thread.State.WAITING);state(b,Thread.State.WAITING); }
        else { ReentrantLock lock=(ReentrantLock)field(locked,"mutex");lock.lock();try{((Condition)field(locked,"isAvail")).signalAll();check(sum.get()==0,"signal retains lock");}finally{lock.unlock();} }
        c.set(21);a.finish();b.finish();check(sum.get()==42,"all existing readers released");check(c.get()==21&&c.get()==21,"reads do not consume");c.set(7);check(c.get()==7,"latest value");
        SynchCell fresh=new SynchCell();SynchCell2 fresh2=new SynchCell2();AtomicBoolean interrupted=new AtomicBoolean();Task cancel=new Task(()->{try{if(explicit)fresh2.get();else fresh.get();throw new AssertionError("cancel must throw");}catch(InterruptedException expected){interrupted.set(true);check(!Thread.currentThread().isInterrupted(),"exception clears interrupt flag");}});
        state(cancel,Thread.State.WAITING);cancel.interrupt();cancel.finish();check(interrupted.get(),"interruption propagated");if(explicit){fresh2.set(9);check(fresh2.get()==9,"explicit lock released after interruption");}else{fresh.set(9);check(fresh.get()==9,"intrinsic lock released after interruption");}
    }
    static Buffer adapter(Object o){return o instanceof MonitorBuffer<?>?new Buffer(){public void put(int v)throws InterruptedException{castMonitor(o).put(v);}public int get()throws InterruptedException{return castMonitor(o).get();}}:new Buffer(){public void put(int v)throws InterruptedException{castCondition(o).put(v);}public int get()throws InterruptedException{return castCondition(o).get();}};}
    @SuppressWarnings("unchecked") static MonitorBuffer<Integer> castMonitor(Object o){return (MonitorBuffer<Integer>)o;}
    @SuppressWarnings("unchecked") static ConditionBuffer<Integer> castCondition(Object o){return (ConditionBuffer<Integer>)o;}
    static Object create(boolean explicit,int size){return explicit?new ConditionBuffer<Integer>(size):new MonitorBuffer<Integer>(size);}
    static void buffers(boolean explicit) throws Exception {
        for(int capacity=1;capacity<=4;capacity++){Object object=create(explicit,capacity);Buffer b=adapter(object);for(int cycle=0;cycle<50;cycle++){for(int i=0;i<capacity;i++)b.put(cycle*capacity+i);for(int i=0;i<capacity;i++)check(b.get()==cycle*capacity+i,"FIFO wraparound");}for(Object item:(Object[])field(object,"buffer"))check(item==null,"consumed reference cleared");}
        for(int n:new int[]{0,-1}){try{create(explicit,n);throw new AssertionError("bad capacity accepted");}catch(IllegalArgumentException expected){checks.incrementAndGet();}}
        Object object=create(explicit,1);Buffer b=adapter(object);try{if(explicit)castCondition(object).put(null);else castMonitor(object).put(null);throw new AssertionError("null accepted");}catch(NullPointerException expected){checks.incrementAndGet();}
        AtomicBoolean interrupted=new AtomicBoolean();Task empty=new Task(()->{try{b.get();throw new AssertionError("empty get returned");}catch(InterruptedException expected){interrupted.set(true);}});state(empty,Thread.State.WAITING);empty.interrupt();empty.finish();check(interrupted.get(),"empty get is interruptible");
        b.put(1);interrupted.set(false);Task full=new Task(()->{try{b.put(2);throw new AssertionError("full put returned");}catch(InterruptedException expected){interrupted.set(true);}});state(full,Thread.State.WAITING);full.interrupt();full.finish();check(interrupted.get(),"full put is interruptible");check(b.get()==1,"cancelled put did not mutate data");
        AtomicInteger received=new AtomicInteger();Task get=new Task(()->received.set(b.get()));state(get,Thread.State.WAITING);b.put(23);get.finish();check(received.get()==23,"put wakes consumer");
        b.put(31);Task put=new Task(()->b.put(32));state(put,Thread.State.WAITING);check(b.get()==31,"get creates space");put.finish();check(b.get()==32,"get wakes producer");
        Buffer stress=adapter(create(explicit,3));Set<Integer> seen=ConcurrentHashMap.newKeySet();Task[] tasks={new Task(()->{for(int i=0;i<1000;i++)stress.put(i);}),new Task(()->{for(int i=1000;i<2000;i++)stress.put(i);}),new Task(()->{for(int i=0;i<1000;i++)if(!seen.add(stress.get()))throw new AssertionError("duplicate");}),new Task(()->{for(int i=0;i<1000;i++)if(!seen.add(stress.get()))throw new AssertionError("duplicate");})};for(Task task:tasks)task.finish();check(seen.size()==2000,"all concurrent items delivered");for(int i=0;i<2000;i++)check(seen.contains(i),"no lost item");
    }
    public static void main(String[] args) throws Exception {
        cells(false);cells(true);buffers(false);buffers(true);
        SynchCell cell=new SynchCell();Task nested=new Task(()->{synchronized(cell){synchronized(cell){check(cell.get()==99,"nested wait result");check(Thread.holdsLock(cell),"reentrant monitor restored");}}});state(nested,Thread.State.WAITING);Task setter=new Task(()->cell.set(99));setter.finish();nested.finish();
        System.out.println("PASS: "+checks+" assertions; four Java examples; FIFO, contention, interruption, notify/reentry and reentrant wait");
    }
}
