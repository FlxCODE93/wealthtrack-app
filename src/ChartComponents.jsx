import React from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ComposedChart,
} from "recharts";
import { C } from "./theme.js";

/* ─────────────────────────────────────────────────────────────── */
/* Tooltip personnalisé — fintech-friendly                          */
/* ─────────────────────────────────────────────────────────────── */

const CustomTooltip = ({ active, payload, label, format = (v) => v }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="wt-glass rounded-lg p-3 shadow-lg border border-white/10">
      {label && (
        <p className="text-xs font-semibold text-white/70 mb-1">{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {format(entry.value)}
        </p>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────── */
/* Line Chart — fintech primary (growth, trends)                    */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechLineChart = ({
  data,
  lines = [],
  format = (v) => v,
  title,
  ariaLabel,
  margin = { top: 8, right: 60, left: 0, bottom: 0 },
}) => (
  <div role="figure" aria-label={ariaLabel || title}>
    {title && <h3 className="text-headline mb-4">{title}</h3>}
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={margin}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
          tickFormatter={format}
        />
        <Tooltip content={<CustomTooltip format={format} />} />
        {lines.map((lineConfig, idx) => (
          <Line
            key={idx}
            type="monotone"
            dataKey={lineConfig.dataKey}
            stroke={lineConfig.stroke || C.amber}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            name={lineConfig.name || lineConfig.dataKey}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */
/* Area Chart — composition, stacked values                         */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechAreaChart = ({
  data,
  areas = [],
  format = (v) => v,
  title,
  ariaLabel,
  stacked = true,
  margin = { top: 8, right: 60, left: 0, bottom: 0 },
}) => (
  <div role="figure" aria-label={ariaLabel || title}>
    {title && <h3 className="text-headline mb-4">{title}</h3>}
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={margin}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
          tickFormatter={format}
        />
        <Tooltip content={<CustomTooltip format={format} />} />
        {areas.map((areaConfig, idx) => (
          <Area
            key={idx}
            type="monotone"
            dataKey={areaConfig.dataKey}
            fill={areaConfig.fill || C.violet}
            fillOpacity={0.3}
            stroke={areaConfig.stroke || C.violet}
            strokeWidth={2}
            isAnimationActive={false}
            stackId={stacked ? "area" : undefined}
            name={areaConfig.name || areaConfig.dataKey}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */
/* Bar Chart — comparisons, discrete values                         */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechBarChart = ({
  data,
  bars = [],
  format = (v) => v,
  title,
  ariaLabel,
  margin = { top: 8, right: 16, left: 0, bottom: 0 },
}) => (
  <div role="figure" aria-label={ariaLabel || title}>
    {title && <h3 className="text-headline mb-4">{title}</h3>}
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={margin}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
          tickFormatter={format}
        />
        <Tooltip content={<CustomTooltip format={format} />} />
        {bars.map((barConfig, idx) => (
          <Bar
            key={idx}
            dataKey={barConfig.dataKey}
            fill={barConfig.fill || C.amber}
            isAnimationActive={false}
            name={barConfig.name || barConfig.dataKey}
            radius={[6, 6, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */
/* Pie/Donut Chart — allocation, distribution                      */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechPieChart = ({
  data,
  colors = [],
  title,
  ariaLabel,
  innerRadius = 0,
}) => (
  <div role="figure" aria-label={ariaLabel || title}>
    {title && <h3 className="text-headline mb-4">{title}</h3>}
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive={false}
        >
          {data.map((entry, idx) => (
            <Cell
              key={`cell-${idx}`}
              fill={colors[idx % colors.length] || C.amber}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */
/* Scatter Chart — risk/return correlation                          */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechScatterChart = ({
  data,
  xKey = "x",
  yKey = "y",
  format = (v) => v,
  title,
  ariaLabel,
  color = C.cyan,
}) => (
  <div role="figure" aria-label={ariaLabel || title}>
    {title && <h3 className="text-headline mb-4">{title}</h3>}
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 60, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
          tickFormatter={format}
        />
        <YAxis
          dataKey={yKey}
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
          tickFormatter={format}
        />
        <Tooltip content={<CustomTooltip format={format} />} />
        <Scatter
          name="Data"
          data={data}
          fill={color}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */
/* Composed Chart — multi-axis comparison (bars + lines)            */
/* ─────────────────────────────────────────────────────────────── */

export const FinTechComposedChart = ({
  data,
  bars = [],
  lines = [],
  format = (v) => v,
  title,
  ariaLabel,
  margin = { top: 8, right: 60, left: 0, bottom: 0 },
}) => (
  <div role="figure" aria-label={ariaLabel || title}>
    {title && <h3 className="text-headline mb-4">{title}</h3>}
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={margin}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          style={{ fontSize: "12px" }}
          tickFormatter={format}
        />
        <Tooltip content={<CustomTooltip format={format} />} />
        {bars.map((barConfig, idx) => (
          <Bar
            key={`bar-${idx}`}
            dataKey={barConfig.dataKey}
            fill={barConfig.fill || C.amber}
            isAnimationActive={false}
            name={barConfig.name || barConfig.dataKey}
            radius={[6, 6, 0, 0]}
          />
        ))}
        {lines.map((lineConfig, idx) => (
          <Line
            key={`line-${idx}`}
            type="monotone"
            dataKey={lineConfig.dataKey}
            stroke={lineConfig.stroke || C.cyan}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            name={lineConfig.name || lineConfig.dataKey}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);
