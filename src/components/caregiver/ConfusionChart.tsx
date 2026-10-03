"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated with the dataviz palette checker against the white card surface
// (lightness band, chroma ≥ 0.10, contrast ≥ 3:1).
const BAR = "#008aa0";

type Point = { day: string; n: number };

function label(day: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-md">
      <p className="text-ink-soft">{label(p.day, { weekday: "short", month: "short", day: "numeric" })}</p>
      <p className="font-semibold text-ink">
        {p.n} {p.n === 1 ? "press" : "presses"}
      </p>
    </div>
  );
}

/** Daily "I feel confused" presses (single series → no legend; the title names it). */
export function ConfusionChart({ daily }: { daily: Point[] }) {
  const max = Math.max(1, ...daily.map((d) => d.n));
  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label={`Daily presses over ${daily.length} days, most recent ${daily.at(-1)?.n ?? 0} today`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="#ece4d6" />
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => label(d, { month: "numeric", day: "numeric" })}
              tick={{ fill: "#5c4a3a", fontSize: 12 }}
              axisLine={{ stroke: "#e2d5c1" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis allowDecimals={false} domain={[0, max]} tick={{ fill: "#5c4a3a", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,138,160,0.08)" }} />
            <Bar dataKey="n" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm text-ink-soft">
        <summary className="cursor-pointer">Show as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr>
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 font-semibold">Presses</th>
            </tr>
          </thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.day}>
                <td className="py-0.5">{label(d.day, { weekday: "short", month: "short", day: "numeric" })}</td>
                <td className="py-0.5">{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
