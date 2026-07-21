"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Range = "24h" | "7d" | "30d" | "90d";

interface AnalyticsData {
  summary: {
    totalVisitors: number;
    totalPageViews: number;
    totalSessions: number;
    totalEvents: number;
    averageSessionDuration: number;
    activeUsers: number;
  };

  dailyVisitors: {
    date: string;
    visitors: number;
    pageViews: number;
  }[];

  topPages: {
    page: string;
    views: number;
    visitors: number;
  }[];

  deviceBreakdown: {
    device: string;
    count: number;
  }[];

  topEvents: {
    event: string;
    count: number;
  }[];
}

const DEVICE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("7d");

  const [data, setData] = useState<AnalyticsData | null>(
    null
  );

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(
    null
  );

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/analytics/overview?range=${range}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Failed to load analytics"
        );
      }

      setData(result.data);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  function formatDuration(seconds: number) {
    if (!seconds) return "0s";

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
      return `${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  }

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">
          Loading analytics...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="analytics-page">
        <div className="analytics-error">
          <h2>Unable to load analytics</h2>

          <p>{error}</p>

          <button onClick={fetchAnalytics}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="analytics-page">
      {/* HEADER */}

      <div className="analytics-header">
        <div>
          <h1>Analytics</h1>

          <p>
            Understand how visitors interact with your
            website.
          </p>
        </div>

        <div className="analytics-actions">
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value as Range)
            }
          >
            <option value="24h">
              Last 24 hours
            </option>

            <option value="7d">
              Last 7 days
            </option>

            <option value="30d">
              Last 30 days
            </option>

            <option value="90d">
              Last 90 days
            </option>
          </select>

          <button
            className="refresh-button"
            onClick={fetchAnalytics}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI CARDS */}

      <div className="analytics-kpi-grid">
        <AnalyticsCard
          title="Total Visitors"
          value={summary.totalVisitors.toLocaleString()}
          description="Unique visitors"
        />

        <AnalyticsCard
          title="Page Views"
          value={summary.totalPageViews.toLocaleString()}
          description="Total pages viewed"
        />

        <AnalyticsCard
          title="Active Now"
          value={summary.activeUsers.toLocaleString()}
          description="Active in last 5 minutes"
          live
        />

        <AnalyticsCard
          title="Avg. Session"
          value={formatDuration(
            summary.averageSessionDuration
          )}
          description="Average time on website"
        />

        <AnalyticsCard
          title="Sessions"
          value={summary.totalSessions.toLocaleString()}
          description="Total sessions"
        />

        <AnalyticsCard
          title="Events"
          value={summary.totalEvents.toLocaleString()}
          description="Tracked interactions"
        />
      </div>

      {/* VISITOR CHART */}

      <div className="analytics-card analytics-chart-card">
        <div className="analytics-card-header">
          <div>
            <h2>Visitors & Page Views</h2>

            <p>
              Website traffic over the selected period.
            </p>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer
            width="100%"
            height={360}
          >
            <LineChart
              data={data.dailyVisitors}
            >
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="date"
              />

              <YAxis />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="visitors"
                name="Visitors"
                stroke="#2563eb"
                strokeWidth={3}
                dot={false}
              />

              <Line
                type="monotone"
                dataKey="pageViews"
                name="Page Views"
                stroke="#16a34a"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TWO COLUMN SECTION */}

      <div className="analytics-two-column">
        {/* TOP PAGES */}

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <h2>Top Pages</h2>

              <p>
                Pages receiving the most traffic.
              </p>
            </div>
          </div>

          <div className="top-pages-list">
            {data.topPages.length === 0 ? (
              <div className="empty-state">
                No page data yet.
              </div>
            ) : (
              data.topPages.map((page, index) => (
                <div
                  className="top-page-row"
                  key={page.page}
                >
                  <div className="page-rank">
                    {index + 1}
                  </div>

                  <div className="page-info">
                    <strong>
                      {page.page || "/"}
                    </strong>

                    <span>
                      {page.visitors.toLocaleString()}{" "}
                      visitors
                    </span>
                  </div>

                  <div className="page-views">
                    {page.views.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DEVICE BREAKDOWN */}

        <div className="analytics-card">
          <div className="analytics-card-header">
            <div>
              <h2>Devices</h2>

              <p>
                How visitors access your website.
              </p>
            </div>
          </div>

          <div className="device-chart">
            {data.deviceBreakdown.length === 0 ? (
              <div className="empty-state">
                No device data yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer
                  width="100%"
                  height={240}
                >
                  <PieChart>
                    <Pie
                      data={data.deviceBreakdown}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={50}
                    >
                      {data.deviceBreakdown.map(
                        (_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              DEVICE_COLORS[
                                index %
                                  DEVICE_COLORS.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>

      {/* EVENTS */}

      <div className="analytics-card">
        <div className="analytics-card-header">
          <div>
            <h2>Tracked Events</h2>

            <p>
              User interactions recorded on the website.
            </p>
          </div>
        </div>

        <div className="events-chart">
          {data.topEvents.length === 0 ? (
            <div className="empty-state">
              No event data yet.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={320}
            >
              <BarChart
                data={data.topEvents}
                layout="vertical"
                margin={{
                  left: 30,
                  right: 30,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis type="number" />

                <YAxis
                  type="category"
                  dataKey="event"
                  width={120}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  name="Events"
                  fill="#2563eb"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({
  title,
  value,
  description,
  live = false,
}: {
  title: string;
  value: string;
  description: string;
  live?: boolean;
}) {
  return (
    <div className="analytics-kpi-card">
      <div className="analytics-kpi-title">
        {live && (
          <span className="live-indicator" />
        )}

        {title}
      </div>

      <div className="analytics-kpi-value">
        {value}
      </div>

      <div className="analytics-kpi-description">
        {description}
      </div>
    </div>
  );
}