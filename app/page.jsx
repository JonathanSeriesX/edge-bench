import DashboardLoader from './dashboard-loader';

export default function Page() {
  return (
    <div className="wrap">
      <header>
        <h1>edge-bench</h1>
        <p>
          How fast do the big static hosts actually answer? This page measures the same
          request against every platform from the same machines, on six continents — and
          the page you are reading is itself the thing being measured.
        </p>
        <p className="meta" id="meta">Loading…</p>
      </header>

      <div className="tabs" id="tabs" role="tablist"></div>
      <p className="sub" id="scenario-note" style={{ marginTop: 10 }}></p>

      <section className="card">
        <h2>Time to first byte</h2>
        <p className="sub">TCP + TLS + server response, DNS excluded. Lower is better.</p>
        <div className="legend" id="legend-main"></div>
        <svg id="chart-main" role="img" aria-label="Median and 95th-percentile time to first byte by platform"></svg>
      </section>

      <section className="card">
        <h2>Where the time goes</h2>
        <p className="sub">Median milliseconds per connection phase.</p>
        <div className="legend" id="legend-phase"></div>
        <svg id="chart-phase" role="img" aria-label="Median duration of each connection phase by platform"></svg>
      </section>

      <section className="card">
        <h2>By region</h2>
        <p className="sub">Median time to first byte, in milliseconds, per continent.</p>
        <div id="heatmap"></div>
      </section>

      <section className="card" id="timeline-card">
        <h2>Over time</h2>
        <p className="sub">Hourly median time to first byte.</p>
        <div className="legend" id="legend-time"></div>
        <svg id="chart-time" role="img" aria-label="Hourly median time to first byte by platform"></svg>
      </section>

      <details>
        <summary>Show the numbers as a table</summary>
        <div className="card"><table id="table"></table></div>
      </details>

      <details open>
        <summary>Methodology &amp; caveats</summary>
        <div className="card method" id="method"></div>
      </details>

      <footer>
        Raw measurements live as NDJSON in the{' '}
        <a href="https://github.com/JonathanSeriesX/edge-bench">open repo</a>, collected on a
        public Actions schedule. Measured with <a href="https://globalping.io">Globalping</a>.
        No affiliation with any platform shown.
      </footer>

      <div className="tip" id="tip"></div>
      <DashboardLoader />
    </div>
  );
}
