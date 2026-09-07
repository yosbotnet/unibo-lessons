import java.util.Objects;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import jdk.incubator.concurrent.StructuredTaskScope;

/** Historical JDK 20 incubator example; not a Java 17 or generic 20+ API. */
public final class StructuredFetch20 {
    private StructuredFetch20() { }

    public record Response(String user, int order) { }

    public static Response handle(
            Callable<String> findUser, Callable<Integer> fetchOrder)
            throws ExecutionException, InterruptedException {
        Objects.requireNonNull(findUser);
        Objects.requireNonNull(fetchOrder);
        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            Future<String> user = scope.fork(findUser);
            Future<Integer> order = scope.fork(fetchOrder);
            // All finished OR scope shutdown, not always both exited.
            scope.join();
            scope.throwIfFailed();
            // These two results are available only on the successful path.
            return new Response(user.resultNow(), order.resultNow());
        } // close waits for remaining threads, even on exceptional exit.
    }

    public static void main(String[] args)
            throws ExecutionException, InterruptedException {
        // Local stand-ins: no network or external service needed.
        System.out.println(handle(() -> "Ada", () -> 17));
    }
}
