import Link from "next/link";

const PIPELINE = [
  {
    stage: "Event",
    what: "The CRM syncs a customer email, a field change or a pilot reading. The forecast picks it up on its own; nobody types it in. Each one is stored once, matched by Message-ID or content hash.",
    example: "Feb 24: an email from Luca Bianchi, CISO at National Bank, syncs into the CRM.",
  },
  {
    stage: "Evidence",
    what: "A claim about one step of the deal, with the exact quote and a grade: direct, stated by the customer, or claimed by us.",
    example: "“The risk committee sitting has moved to March 16.” Stated by the customer.",
  },
  {
    stage: "Step state",
    what: "Each step of the Signature Path is done, in progress, blocked or not started, from its evidence alone.",
    example: "Security approval: blocked until Mar 16.",
  },
  {
    stage: "Timing",
    what: "Remaining days per step at fast, standard and slow pace, from approved planning standards and the order steps must run in.",
    example: "Standard pace now signs Apr 16, after the quarter.",
  },
  {
    stage: "Group",
    what: "Commitment and timing together place the deal: Firm, Core, Stretch, Late, Uncommitted. Firm and Core count.",
    example: "Late. Not counted.",
  },
  {
    stage: "Forecast",
    what: "The system forecast, its range, the managers' moves on top, and a frozen run each week to compare against.",
    example: "System forecast down $20M, explained line by line.",
  },
];

const GUARANTEES = [
  {
    claim: "The same data on the same day gives the same number.",
    how: "The forecast engine is pure functions. A test fails the build if any engine file reads the clock, random numbers, storage, the network or the environment, or imports anything outside the engine.",
  },
  {
    claim: "Amounts never drift.",
    how: "Money is whole cents in a branded type. Anything that is not an integer is rejected when it enters, and display rounding happens only at the edge.",
  },
  {
    claim: "Nothing is rewritten after the fact.",
    how: "Runs, evidence, decisions and the change log are append-only. A property test throws random write sequences at the store and checks every frozen run still hashes the same.",
  },
  {
    claim: "Every number can be traced to a sentence.",
    how: "A step changes state only through evidence that carries its quote and source. Claims from emails wait for approval before they count.",
  },
  {
    claim: "Managers can disagree, visibly.",
    how: "A manager's move sits on top of the system forecast, never inside it, with a reason and a bet the system re-checks every day.",
  },
  {
    claim: "The spec is the test plan.",
    how: "All 61 acceptance tests in the spec are traced to automated tests. Unit, integration and property tests run on every change, and a browser run clicks through the app end to end.",
  },
];

const LAYERS = [
  {
    name: "Screens",
    path: "src/app, src/features",
    role: "Next.js pages and components. They ask the application layer for data and render it. No forecast logic lives here.",
  },
  {
    name: "Application",
    path: "src/application",
    role: "Use cases: load the forecast, raise a dispute, read new CRM activity, approve evidence, move to next week. They talk to storage only through ports.",
  },
  {
    name: "Engine",
    path: "src/domain",
    role: "Classification, timing, step states, disputes, the bridge, money. Pure TypeScript with no dependencies, tested in isolation.",
    core: true,
  },
  {
    name: "Storage",
    path: "src/infrastructure",
    role: "IndexedDB in the browser and an in-memory store for tests, both behind the same repository contract, which one shared test suite checks.",
  },
];

export default function HowItWorks() {
  return (
    <section className="hiw">
      <div className="page-head">
        <div>
          <h1>How it works</h1>
          <p className="muted subtitle">
            The forecast is computed from the CRM, not entered. This page follows one customer email from National Bank, synced into the CRM, all the way to the number.
          </p>
        </div>
      </div>

      <h2>From an email to the number</h2>
      <ol className="hiw-pipe">
        {PIPELINE.map((p, i) => (
          <li key={p.stage} className="hiw-stage">
            <span className="hiw-node" aria-hidden>
              {i + 1}
            </span>
            <strong>{p.stage}</strong>
            <p className="hiw-what">{p.what}</p>
            <p className="hiw-example">{p.example}</p>
          </li>
        ))}
      </ol>
      <p className="muted small">
        See it live: <Link href="/forecast/deals/opp-natbank">National Bank&apos;s deal page</Link> shows the blocked step on its Signature
        Path, and <Link href="/forecast">the forecast</Link> lists the slip under What changed.
      </p>

      <h2>What you can rely on</h2>
      <div className="hiw-guarantees">
        {GUARANTEES.map((g) => (
          <div key={g.claim} className="hiw-g">
            <strong>{g.claim}</strong>
            <p>{g.how}</p>
          </div>
        ))}
      </div>

      <h2>How the code is laid out</h2>
      <p className="muted section-intro">Dependencies point inward: everything depends on the engine, and the engine depends on nothing.</p>
      <div className="hiw-layers">
        {LAYERS.map((l) => (
          <div key={l.name} className={l.core ? "hiw-layer core" : "hiw-layer"}>
            <div>
              <strong>{l.name}</strong>
              <code>{l.path}</code>
            </div>
            <p>{l.role}</p>
          </div>
        ))}
      </div>
      <p className="muted small">
        Built with Next.js 15, React 19 and TypeScript in strict mode. Tests: Vitest with fast-check for properties, Playwright in the browser.
      </p>
    </section>
  );
}
