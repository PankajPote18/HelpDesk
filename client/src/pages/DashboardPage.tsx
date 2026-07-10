import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navbar } from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardData = {
  totalTickets: number;
  openTickets: number;
  aiResolvedTickets: number;
  aiResolvedRate: number;
  averageResolutionTimeMs: number | null;
  ticketsPerDay: { date: string; count: number }[];
};

async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await axios.get<DashboardData>("/api/dashboard", { withCredentials: true });
  return data;
}

function getErrorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? fallback) : fallback;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

function formatChartDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}

        {fetchError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(fetchError, "Failed to load dashboard")}
          </p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <MetricCard label="Total Tickets" value={data.totalTickets.toString()} />
              <MetricCard label="Open Tickets" value={data.openTickets.toString()} />
              <MetricCard label="Resolved by AI" value={data.aiResolvedTickets.toString()} />
              <MetricCard label="% Resolved by AI" value={`${data.aiResolvedRate.toFixed(1)}%`} />
              <MetricCard
                label="Avg. Resolution Time"
                value={formatDuration(data.averageResolutionTimeMs)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tickets per day (last 30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ticketsPerDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatChartDate}
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip labelFormatter={(label) => label as string} />
                      <Bar dataKey="count" name="Tickets" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
