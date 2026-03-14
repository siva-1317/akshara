import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/Card";
import DonutChart from "../../components/charts/DonutChart";
import RadialProgress from "../../components/charts/RadialProgress";
import TimeSeriesChart from "../../components/charts/TimeSeriesChart";

const numberOrZero = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const prettyKey = (key) => {
  const cleaned = String(key || "").trim();
  if (!cleaned) {
    return "Unknown";
  }
  return cleaned
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function AdminDashboard({ analytics, requests, coinRequests, notifications }) {
  const [creationView, setCreationView] = useState("monthly");

  const pendingCount =
    (requests || []).filter((item) => item.status === "pending").length +
    (coinRequests || []).filter((item) => item.status === "pending").length;

  const usersTotal = numberOrZero(analytics?.users?.total);
  const usersBlocked = numberOrZero(analytics?.users?.blocked);
  const professionCounts = analytics?.users?.byProfession || {};
  const roleCounts = analytics?.users?.byRole || {};

  const studentsCount = numberOrZero(professionCounts.student || professionCounts.students);
  const employeesCount = numberOrZero(
    professionCounts.employee || professionCounts.employees || professionCounts.staff
  );

  const testsTotal = analytics?.tests?.total;
  const testsByDifficulty = analytics?.tests?.byDifficulty || null;

  const difficultySegments = useMemo(() => {
    if (!testsByDifficulty) {
      return [];
    }

    const segments = [
      { key: "easy", label: "Easy", color: "var(--ak-chart-green)" },
      { key: "medium", label: "Medium", color: "var(--ak-chart-amber)" },
      { key: "hard", label: "Hard", color: "var(--ak-chart-red)" },
      { key: "other", label: "Other", color: "var(--ak-chart-slate)" }
    ]
      .map((segment) => ({
        ...segment,
        value: numberOrZero(testsByDifficulty?.[segment.key])
      }))
      .filter((segment) => segment.value > 0);

    return segments;
  }, [testsByDifficulty]);

  const difficultyLegend = useMemo(
    () =>
      difficultySegments.map((segment) => ({
        ...segment,
        pct: testsTotal ? Math.round((segment.value / numberOrZero(testsTotal)) * 100) : 0
      })),
    [difficultySegments, testsTotal]
  );

  const creationSeries = analytics?.users?.createdSeries?.[creationView] || [];

  const professionRows = useMemo(() => {
    const entries = Object.entries(professionCounts || {})
      .map(([key, value]) => ({ key, label: prettyKey(key), value: numberOrZero(value) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
    return entries.slice(0, 8);
  }, [professionCounts]);

  const roleRows = useMemo(() => {
    const entries = Object.entries(roleCounts || {})
      .map(([key, value]) => ({ key, label: prettyKey(key), value: numberOrZero(value) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
    return entries;
  }, [roleCounts]);

  const accuracyPercent = analytics?.answers?.accuracyPercent;
  const passRatePercent = analytics?.tests?.passRatePercent;
  const activeOffersTotal = analytics?.offers?.activeTotal;
  const activeOfferUsers = analytics?.offers?.activeUsers;
  const offersByType = analytics?.offers?.byType || null;
  const certificatesTotal = analytics?.certificates?.total;
  const certificatesUniqueUsers = analytics?.certificates?.uniqueUsers;
  const certificatesSeries = analytics?.certificates?.issuedSeries?.monthly || [];

  const offerTypeSegments = useMemo(() => {
    if (!offersByType) {
      return [];
    }

    const palette = {
      time: "var(--ak-chart-indigo)",
      days: "var(--ak-chart-amber)",
      lifetime: "var(--ak-chart-green)",
      unknown: "var(--ak-chart-slate)"
    };

    return Object.entries(offersByType)
      .map(([key, value]) => ({
        key,
        label: prettyKey(key),
        value: numberOrZero(value),
        color: palette[String(key || "").toLowerCase()] || "var(--ak-chart-slate)"
      }))
      .filter((segment) => segment.value > 0);
  }, [offersByType]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">Admin Dashboard</h2>
          <p className="text-muted mb-0">Analytics overview with totals, graphs, and breakdown tables.</p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-3 col-sm-6">
          <Card title="Total Users">
            <div className="metric-value">{usersTotal}</div>
            <p className="text-muted mb-0">All registered accounts</p>
          </Card>
        </div>
        <div className="col-lg-3 col-sm-6">
          <Card title="Students">
            <div className="metric-value">{studentsCount}</div>
            <p className="text-muted mb-0">Profession = student</p>
          </Card>
        </div>
        <div className="col-lg-3 col-sm-6">
          <Card title="Employees">
            <div className="metric-value">{employeesCount}</div>
            <p className="text-muted mb-0">Profession = employee</p>
          </Card>
        </div>
        <div className="col-lg-3 col-sm-6">
          <Card title="Pending Requests">
            <div className="metric-value">{pendingCount}</div>
            <p className="text-muted mb-0">Awaiting admin review</p>
          </Card>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-5">
          <Card title="Tests Attended by Level" subtitle="Difficulty breakdown">
            {testsTotal == null ? (
              <p className="text-muted mb-0">Analytics unavailable (tests table not configured).</p>
            ) : (
              <div className="ak-analytics-split">
                <DonutChart
                  size={180}
                  thickness={18}
                  segments={difficultySegments}
                  centerLabelTop={String(numberOrZero(testsTotal))}
                  centerLabelBottom="Total Tests"
                />
                <div className="ak-analytics-legend">
                  {difficultyLegend.length ? (
                    difficultyLegend.map((segment) => (
                      <div key={segment.key} className="ak-analytics-legend-row">
                        <span className="ak-analytics-dot" style={{ background: segment.color }} />
                        <span className="ak-analytics-legend-label">{segment.label}</span>
                        <span className="ak-analytics-legend-metric">
                          {segment.value} <span className="text-muted">({segment.pct}%)</span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0">No test attempts yet.</p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="col-xl-3 col-md-6">
          <Card title="Accuracy" subtitle="Correct answers / total questions">
            <div className="d-flex justify-content-center py-2">
              <RadialProgress
                size={170}
                thickness={16}
                value={accuracyPercent == null ? null : accuracyPercent / 100}
                label={accuracyPercent == null ? "—" : `${accuracyPercent}%`}
                sublabel="Correct rate"
                color="var(--ak-chart-indigo)"
              />
            </div>
            <div className="d-flex justify-content-between text-muted small">
              <span>Total: {analytics?.answers?.total ?? "—"}</span>
              <span>Correct: {analytics?.answers?.correct ?? "—"}</span>
            </div>
          </Card>
        </div>
        <div className="col-xl-4 col-md-6">
          <Card title="Pass Rate" subtitle={`Tests passed (score ≥ 60%)`}>
            <div className="d-flex justify-content-center py-2">
              <RadialProgress
                size={170}
                thickness={16}
                value={passRatePercent == null ? null : passRatePercent / 100}
                label={passRatePercent == null ? "—" : `${passRatePercent}%`}
                sublabel="Pass rate"
                color="var(--ak-chart-green)"
              />
            </div>
            <div className="d-flex justify-content-between text-muted small">
              <span>Total: {analytics?.tests?.total ?? "—"}</span>
              <span>Passed: {analytics?.tests?.passed ?? "—"}</span>
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-8">
          <Card
            title="Account Creation Trend"
            subtitle="Hover points to see the count"
            className="ak-analytics-card"
          >
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div className="text-muted small">
                {creationView === "monthly" ? "Last 12 months" : "Last 5 years"}
              </div>
              <div className="btn-group btn-group-sm" role="group" aria-label="Creation range">
                <button
                  type="button"
                  className={`btn ${creationView === "monthly" ? "btn-ak-primary" : "btn-outline-secondary"}`}
                  onClick={() => setCreationView("monthly")}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`btn ${creationView === "yearly" ? "btn-ak-primary" : "btn-outline-secondary"}`}
                  onClick={() => setCreationView("yearly")}
                >
                  Year
                </button>
              </div>
            </div>

            {analytics?.users?.createdSeries ? (
              <TimeSeriesChart data={creationSeries} height={220} />
            ) : (
              <p className="text-muted mb-0">Analytics unavailable (users.created_at not available).</p>
            )}
          </Card>
        </div>

        <div className="col-xl-4">
          <Card title="System Totals" subtitle="Quick snapshot">
            <div className="ak-analytics-totals">
              <div className="ak-analytics-total-row">
                <span className="text-muted">Notifications</span>
                <strong>{numberOrZero(notifications?.length)}</strong>
              </div>
              <div className="ak-analytics-total-row">
                <span className="text-muted">Blocked Users</span>
                <strong>{usersBlocked}</strong>
              </div>
              <div className="ak-analytics-total-row">
                <span className="text-muted">Active Offers</span>
                <strong>{activeOffersTotal == null ? "—" : numberOrZero(activeOffersTotal)}</strong>
              </div>
              <div className="ak-analytics-total-row">
                <span className="text-muted">Offer Users</span>
                <strong>{activeOfferUsers == null ? "—" : numberOrZero(activeOfferUsers)}</strong>
              </div>
              <div className="ak-analytics-total-row">
                <span className="text-muted">Certificates Issued</span>
                <strong>{certificatesTotal == null ? "—" : numberOrZero(certificatesTotal)}</strong>
              </div>
              <div className="ak-analytics-total-row">
                <span className="text-muted">Roles</span>
                <strong>{roleRows.length || "—"}</strong>
              </div>
              <div className="ak-analytics-total-row">
                <span className="text-muted">Top Professions</span>
                <strong>{professionRows.length || "—"}</strong>
              </div>
            </div>
            <div className="mt-3 d-grid gap-2">
              <Link className="btn btn-sm btn-outline-ak w-100" to="/admin/offers">
                Open Offers
              </Link>
              <Link className="btn btn-sm btn-ak-primary w-100" to="/admin/certificates">
                Open Certificates
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-4">
          <Card title="Active Offer Types" subtitle="Current active offers">
            {offerTypeSegments.length ? (
              <div className="ak-analytics-split">
                <div className="d-flex justify-content-center">
                  <DonutChart
                    size={190}
                    thickness={18}
                    segments={offerTypeSegments}
                    centerLabelTop={activeOffersTotal == null ? "—" : numberOrZero(activeOffersTotal)}
                    centerLabelBottom="Active"
                  />
                </div>
                <div className="ak-analytics-legend">
                  {offerTypeSegments.map((segment) => (
                    <div key={segment.key} className="ak-analytics-legend-row">
                      <span className="ak-analytics-dot" style={{ background: segment.color }} aria-hidden="true" />
                      <span className="ak-analytics-legend-label">{segment.label}</span>
                      <span className="ak-analytics-legend-metric">{segment.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted mb-0">No active offer data yet.</p>
            )}
          </Card>
        </div>

        <div className="col-xl-8">
          <Card title="Certificates Issued" subtitle="Last 12 months">
            {analytics?.certificates?.issuedSeries ? (
              <>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div className="text-muted small">
                    Total: {certificatesTotal == null ? "—" : numberOrZero(certificatesTotal)} • Unique users:{" "}
                    {certificatesUniqueUsers == null ? "—" : numberOrZero(certificatesUniqueUsers)}
                  </div>
                </div>
                <TimeSeriesChart data={certificatesSeries} height={220} />
              </>
            ) : (
              <p className="text-muted mb-0">Certificates analytics unavailable (schema not applied).</p>
            )}
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-xl-6">
          <Card title="Users by Profession" subtitle="Top categories">
            {professionRows.length ? (
              <div className="table-responsive">
                <table className="table table-ak align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Profession</th>
                      <th className="text-end">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {professionRows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="text-end">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted mb-0">No profession data yet.</p>
            )}
          </Card>
        </div>

        <div className="col-xl-6">
          <Card title="Users by Role" subtitle="Account types">
            {roleRows.length ? (
              <div className="table-responsive">
                <table className="table table-ak align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th className="text-end">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleRows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="text-end">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted mb-0">No role data yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
