import DashboardLoader from './dashboard-loader';

// One collapsible glass dashboard. `source` labels where the numbers come
// from — the whole page mixes two kinds of measurement and the badge is what
// keeps them honest: 'probes' = Globalping datacenter probes on a schedule,
// 'browser' = measured by the reader's own browser, right now.
function Dash({ id, title, source, sub, open = true, children }) {
  return (
    <details className="dash" id={id} open={open}>
      <summary>
        <span className="dash-title">{title}</span>
        {source === 'probes' && <span className="badge probes">Globalping probes</span>}
        {source === 'browser' && <span className="badge browser">your browser</span>}
        <span className="chevron" aria-hidden="true" />
      </summary>
      <div className="dash-body">
        {sub && <p className="sub">{sub}</p>}
        {children}
      </div>
    </details>
  );
}

export default function Page() {
  return (
    <div className="wrap">
      <header>
        <h1>edge-bench</h1>
        <p>
          How fast do the big Next.js hosts actually answer? The same app, deployed to every
          platform from the same commit — measured two ways: by datacenter probes on six
          continents, and by your own browser while you read this. The page you are looking at
          is itself the thing being measured.
        </p>
        <p className="meta" id="meta">Loading…</p>
      </header>

      <Dash
        id="static"
        title="Static delivery"
        source="probes"
        sub="The prerendered page, served from each platform's CDN edge. TCP + TLS + server response, DNS excluded. Lower is better."
      >
        <div className="legend" id="legend-main-static"></div>
        <svg id="chart-main-static" role="img" aria-label="Median and 95th-percentile time to first byte by platform, static page"></svg>
        <h3>Where the time goes</h3>
        <div className="legend" id="legend-phase-static"></div>
        <svg id="chart-phase-static" role="img" aria-label="Median duration of each connection phase by platform, static page"></svg>
        <h3>By region</h3>
        <div id="heatmap-static"></div>
        <details className="numbers">
          <summary>Show the numbers as a table</summary>
          <table id="table-static"></table>
        </details>
      </Dash>

      <Dash
        id="function"
        title="Serverless function"
        source="probes"
        sub="A trivial dynamic route. Vercel and Netlify run it in one default region — the badge on each row, read live from the deployment — while Cloudflare runs it at every edge. Distance to that one region is part of what you see. GitHub Pages has no functions and sits this one out."
      >
        <div className="legend" id="legend-main-function"></div>
        <svg id="chart-main-function" role="img" aria-label="Median and 95th-percentile time to first byte by platform, function route"></svg>
        <h3>Where the time goes</h3>
        <div className="legend" id="legend-phase-function"></div>
        <svg id="chart-phase-function" role="img" aria-label="Median duration of each connection phase by platform, function route"></svg>
        <h3>By region</h3>
        <div id="heatmap-function"></div>
        <details className="numbers">
          <summary>Show the numbers as a table</summary>
          <table id="table-function"></table>
        </details>
      </Dash>

      <Dash
        id="live"
        title="Your connection"
        source="browser"
        sub="Measured seconds ago, from this device, on your network — not from a datacenter. Each platform gets one fresh-connection fetch (the stacked phases) and two repeats on the open connection (warm)."
      >
        <p className="live-status" id="live-status">Waiting for the page to settle…</p>
        <div className="legend" id="legend-live"></div>
        <svg id="chart-live" role="img" aria-label="Time to first byte from your browser, by platform"></svg>
      </Dash>

      <Dash
        id="timeline"
        title="Over time"
        source="probes"
        sub="Hourly median time to first byte for the static page, across the rolling window."
      >
        <div className="legend" id="legend-time"></div>
        <svg id="chart-time" role="img" aria-label="Hourly median time to first byte by platform"></svg>
      </Dash>

      <Dash id="methodology" title="Methodology &amp; caveats" open={false}>
        <div className="method" id="method"></div>
      </Dash>

      <footer>
        Raw measurements live as NDJSON in the{' '}
        <a href="https://github.com/JonathanSeriesX/edge-bench">open repo</a>, collected on a
        public Actions schedule. Probe measurements by <a href="https://globalping.io">Globalping</a>.
        No affiliation with any platform shown.
      </footer>

      <div className="tip" id="tip"></div>
      <DashboardLoader />
    </div>
  );
}
