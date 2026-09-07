import gov.nasa.jpf.Config;
import gov.nasa.jpf.JPF;
import gov.nasa.jpf.ListenerAdapter;
import gov.nasa.jpf.search.Search;

/** Host-side evidence: process exit code or 'no errors' alone is insufficient. */
public final class JpfEvidence extends ListenerAdapter {
    private boolean started, finished;
    private int constraints, violations, advanced;

    @Override public void searchStarted(Search search) { started = true; }
    @Override public void searchFinished(Search search) { finished = true; }
    @Override public void searchConstraintHit(Search search) { constraints++; }
    @Override public void propertyViolated(Search search) { violations++; }
    @Override public void stateAdvanced(Search search) { advanced++; }

    public static void main(String[] args) {
        JpfEvidence evidence = new JpfEvidence();
        try {
            Config config = JPF.createConfig(args);
            JPF jpf = new JPF(config);
            jpf.addListener(evidence);
            jpf.run();
            String outcome = evidence.violations > 0 ? "counterexample"
                    : evidence.started && evidence.finished && evidence.constraints == 0
                    ? "complete-within-model" : "incomplete";
            // Valid only for the pinned DFSearch configurations exercised here:
            // no external termination, no ignored-state assumptions or heuristic search.
            System.out.println("NOTES_EVIDENCE " + outcome
                    + " started=" + evidence.started + " finished=" + evidence.finished
                    + " constraints=" + evidence.constraints
                    + " violations=" + evidence.violations + " advanced=" + evidence.advanced);
        } catch (RuntimeException e) {
            System.out.println("NOTES_EVIDENCE tool-error started=" + evidence.started
                    + " " + e.getClass().getName());
            throw e;
        }
    }
}
