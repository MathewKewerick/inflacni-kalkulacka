import React, { useMemo, useState } from "react";

const historicalInflation = {
  1954: 3.3,
  1955: 3.3,
  1956: 3.3,
  1957: 3.3,
  1958: 3.3,
  1959: 3.3,
  1960: 3.3,
  1961: 3.3,
  1962: 3.3,
  1963: 3.3,
  1964: 3.3,
  1965: 3.3,
  1966: 3.3,
  1967: 3.3,
  1968: 3.3,
  1969: 3.3,
  1970: 3.3,
  1971: 3.3,
  1972: 3.3,
  1973: 3.3,
  1974: 3.3,
  1975: 3.3,
  1976: 3.3,
  1977: 3.3,
  1978: 3.3,
  1979: 3.3,
  1980: 3.3,
  1981: 3.3,
  1982: 3.3,
  1983: 3.3,
  1984: 3.3,
  1985: 3.3,
  1986: 3.3,
  1987: 3.3,
  1988: 3.3,
  1989: 3.3,
  1990: 10.8,
  1991: 56.6,
  1992: 11.1,
  1993: 20.8,
  1994: 10.0,
  1995: 9.1,
  1996: 8.8,
  1997: 8.5,
  1998: 10.7,
  1999: 2.1,
  2000: 3.9,
  2001: 4.7,
  2002: 1.8,
  2003: 0.1,
  2004: 2.8,
  2005: 1.9,
  2006: 2.5,
  2007: 2.8,
  2008: 6.3,
  2009: 1.0,
  2010: 1.5,
  2011: 1.9,
  2012: 3.3,
  2013: 1.4,
  2014: 0.4,
  2015: 0.3,
  2016: 0.7,
  2017: 2.5,
  2018: 2.1,
  2019: 2.8,
  2020: 3.2,
  2021: 3.8,
  2022: 15.1,
  2023: 10.7,
  2024: 2.4,
  2025: 2.5,
};

const minYear = 1954;
const lastHistoricalYear = 2025;
const currentYear = 2026;
const maxYear = 2055;
const currentInflation = 1.4;
const inflationTarget = 2.0;
const indicatorScaleMax = 4;

function formatCZK(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value) {
  return `${new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`;
}

function formatPercentAxis(value) {
  return `${new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)} %`;
}

function parseLocalizedNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;

  const normalized = value.replace(/,/g, ".").trim();
  if (normalized === "" || normalized === "." || normalized === "-" || normalized === "-.") {
    return NaN;
  }

  return Number(normalized);
}

function getRateMeta(targetYear, futureRate) {
  if (targetYear >= 1954 && targetYear <= 1989) {
    return {
      rate: historicalInflation[targetYear],
      source: "odhad pro socialistické období",
    };
  }

  if (historicalInflation[targetYear] != null) {
    return {
      rate: historicalInflation[targetYear],
      source: "historická sazba ČSÚ",
    };
  }

  return {
    rate: futureRate,
    source: "budoucí odhad",
  };
}

export function computeConversion(amount, fromYear, toYear, futureRate) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      result: 0,
      factor: 1,
      appliedYears: [],
      averageRate: 0,
    };
  }

  if (fromYear === toYear) {
    return {
      result: amount,
      factor: 1,
      appliedYears: [],
      averageRate: 0,
    };
  }

  let factor = 1;
  const appliedYears = [];

  if (toYear > fromYear) {
    for (let year = fromYear + 1; year <= toYear; year += 1) {
      const { rate, source } = getRateMeta(year, futureRate);
      factor *= 1 + rate / 100;
      appliedYears.push({ year, rate, source, direction: "forward" });
    }
  } else {
    for (let year = fromYear; year > toYear; year -= 1) {
      const { rate, source } = getRateMeta(year, futureRate);
      factor /= 1 + rate / 100;
      appliedYears.push({ year, rate, source, direction: "backward" });
    }
  }

  const result = amount * factor;
  const averageRate =
    appliedYears.length > 0
      ? appliedYears.reduce((sum, item) => sum + item.rate, 0) / appliedYears.length
      : 0;

  return { result, factor, appliedYears, averageRate };
}

function buildPurchasingPowerSeries(amount, fromYear, toYear, futureRate, yieldRate) {
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const step = toYear >= fromYear ? 1 : -1;
  const series = [{ year: fromYear, value: amount }];
  let currentValue = amount;

  for (let year = fromYear; year !== toYear; year += step) {
    const nextYear = year + step;
    const { rate } = getRateMeta(step === 1 ? nextYear : year, futureRate);
    const yieldFactor = 1 + yieldRate / 100;
    const inflationFactor = 1 + rate / 100;

    if (step === 1) {
      currentValue = (currentValue * yieldFactor) / inflationFactor;
    } else {
      currentValue = (currentValue / yieldFactor) * inflationFactor;
    }

    series.push({ year: nextYear, value: currentValue });
  }

  return series;
}

function buildSmoothPath(points) {
  if (points.length < 2) return "";

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

const sanityTestCases = [
  {
    name: "stejný rok vrací stejnou částku",
    run: () => {
      const result = computeConversion(1000, 2020, 2020, 3.5);
      return result.result === 1000 && result.factor === 1;
    },
  },
  {
    name: "nulová částka vrací nulu",
    run: () => {
      const result = computeConversion(0, 2020, 2026, 3.5);
      return result.result === 0 && result.appliedYears.length === 0;
    },
  },
  {
    name: "zpětný a dopředný přepočet jsou přibližně konzistentní",
    run: () => {
      const forward = computeConversion(1000, 2020, 2026, 3.5);
      const backward = computeConversion(forward.result, 2026, 2020, 3.5);
      return Math.abs(backward.result - 1000) < 0.01;
    },
  },
  {
    name: "budoucí roky používají zadaný odhad",
    run: () => {
      const result = computeConversion(1000, 2025, 2026, 3.5);
      return result.appliedYears.length === 1 && Math.abs(result.appliedYears[0].rate - 3.5) < 0.0001;
    },
  },
  {
    name: "historické roky používají známou sazbu",
    run: () => {
      const result = computeConversion(1000, 2024, 2025, 3.5);
      return result.appliedYears.length === 1 && Math.abs(result.appliedYears[0].rate - 2.5) < 0.0001;
    },
  },
  {
    name: "čárka i tečka se parsují stejně",
    run: () => parseLocalizedNumber("3,5") === 3.5 && parseLocalizedNumber("3.5") === 3.5,
  },
  {
    name: "bez výnosu je nominální výsledek vyšší při kladné inflaci",
    run: () => computeConversion(10000, 2015, 2025, 3.5).result > 10000,
  },
  {
    name: "kladný výnos snižuje potřebnou cílovou hodnotu oproti čisté inflaci",
    run: () => {
      const amount = 10000;
      const inflOnly = computeConversion(amount, 2015, 2025, 3.5).result;
      const withYield = inflOnly / Math.pow(1.01, 10);
      return withYield < inflOnly && withYield > amount;
    },
  },
  {
    name: "výchozí hodnota bez výnosu odráží ztrátu kupní síly",
    run: () => {
      const series = buildPurchasingPowerSeries(10000, 2015, 2026, 3.5, 0);
      return series.at(-1).value < 10000;
    },
  },
];

if (typeof window !== "undefined") {
  sanityTestCases.forEach((testCase) => {
    console.assert(testCase.run(), `Sanity check failed: ${testCase.name}`);
  });
}

function SimpleLineChart({ data, delta }) {
  const width = 640;
  const height = 240;
  const paddingLeft = 80;
  const paddingRight = 20;
  const paddingTop = 16;
  const paddingBottom = 42;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) return null;

  const baseValue = data[0]?.value || 1;
  const percentData = data.map((item) => ({
    ...item,
    percent: baseValue === 0 ? 0 : (item.value / baseValue) * 100,
  }));

  const percents = percentData.map((item) => item.percent);
  const minPercent = Math.min(...percents);
  const maxPercent = Math.max(...percents);
  const lowerBound = Math.max(0, Math.floor(minPercent / 5) * 5);
  const upperBound = Math.max(100, Math.ceil(maxPercent / 5) * 5);
  const middleBound = Math.round((upperBound + lowerBound) / 2);
  const axisValues = [upperBound, middleBound, lowerBound]
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort((a, b) => b - a);

  const chartMin = Math.min(...axisValues);
  const chartMaxValue = Math.max(...axisValues);
  const range = Math.max(1, chartMaxValue - chartMin);

  let lineColor = "#0f172a";
  let glowColor = "rgba(15,23,42,0.04)";
  let pulseColor = "rgba(15,23,42,0.22)";

  if (delta < 0) {
    lineColor = "#dc2626";
    glowColor = "rgba(220,38,38,0.04)";
    pulseColor = "rgba(220,38,38,0.35)";
  } else if (delta > 0) {
    lineColor = "#16a34a";
    glowColor = "rgba(22,163,74,0.04)";
    pulseColor = "rgba(22,163,74,0.35)";
  }

  const spacingFactor = percentData.length <= 4 ? 0.7 : percentData.length <= 8 ? 0.82 : 1;
  const effectiveChartWidth = chartWidth * spacingFactor;
  const offsetX = paddingLeft + 12 + (chartWidth - effectiveChartWidth) / 2;

  const points = percentData.map((item, index) => {
    const x =
      offsetX +
      (percentData.length === 1 ? effectiveChartWidth / 2 : (index / (percentData.length - 1)) * effectiveChartWidth);
    const y = paddingTop + ((chartMaxValue - item.percent) / range) * chartHeight;
    return { ...item, x, y };
  });

  const linePath = buildSmoothPath(points);
  const midIndex = Math.floor((percentData.length - 1) / 2);
  const axisYears = [percentData[0]?.year, percentData[midIndex]?.year, percentData[percentData.length - 1]?.year].filter(
    (value, index, array) => value != null && array.indexOf(value) === index
  );
  const yearPointMap = axisYears.map((year) => points.find((point) => point.year === year)).filter(Boolean);
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="mt-5 rounded-[28px] border border-white/60 bg-white/55 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-600">Vývoj kupní síly v čase</div>
          <div className="text-xs text-slate-500">Na počítači přejeďte myší, na telefonu klepněte na graf.</div>
        </div>
      </div>

      <div
        className="relative"
        onMouseLeave={() => setHoveredIndex(null)}
        onPointerDown={() => setHoveredIndex(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full overflow-visible sm:h-60">
          <defs>
            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="14" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {axisValues.map((axisValue) => {
            const y = paddingTop + ((chartMaxValue - axisValue) / range) * chartHeight;
            return (
              <g key={axisValue}>
                <text x={paddingLeft - 28} y={y + 5} textAnchor="end" fontSize="18" fontWeight="400" fill="#64748b">
                  {formatPercentAxis(axisValue)}
                </text>
              </g>
            );
          })}

          {(() => {
            const baselineY = paddingTop + ((chartMaxValue - 100) / range) * chartHeight;
            return (
              <line
                x1={offsetX}
                y1={baselineY}
                x2={offsetX + effectiveChartWidth}
                y2={baselineY}
                stroke="rgba(15,23,42,0.18)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })()}

          <path d={linePath} fill="none" stroke={glowColor} strokeWidth="14" strokeLinecap="round" filter="url(#softGlow)" />
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((point, index) => {
            const leftEdge = index === 0 ? offsetX : (points[index - 1].x + point.x) / 2;
            const rightEdge = index === points.length - 1 ? offsetX + effectiveChartWidth : (point.x + points[index + 1].x) / 2;
            return (
              <g key={point.year}>
                <rect
                  x={leftEdge}
                  y={0}
                  width={Math.max(18, rightEdge - leftEdge)}
                  height={height}
                  fill="transparent"
                  pointerEvents="all"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseMove={() => setHoveredIndex(index)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setHoveredIndex((current) => (current === index ? null : index));
                  }}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setHoveredIndex((current) => (current === index ? null : index));
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  style={{ cursor: "pointer", touchAction: "manipulation" }}
                />
              </g>
            );
          })}

          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={height - paddingBottom + 2}
                stroke="rgba(100,116,139,0.18)"
                strokeDasharray="4 6"
              />
              <g
                transform={`translate(${Math.min(width - 172, hoveredPoint.x + 12)}, ${Math.max(10, hoveredPoint.y - 72)})`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <rect width="160" height="62" rx="16" fill="rgba(15,23,42,0.94)" />
                <text x="14" y="21" fontSize="18" fill="rgba(255,255,255,0.72)" dominantBaseline="middle">
                  {hoveredPoint.year}
                </text>
                <text x="14" y="45" fontSize="18" fill="#ffffff" dominantBaseline="middle">
                  {formatCZK(hoveredPoint.value)}
                </text>
              </g>
            </g>
          )}

          {points.length > 0 && (
            <g>
              <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="26" fill={pulseColor}>
                <animate attributeName="r" values="12;26;12" dur="1.7s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.65;0.05;0.65" dur="1.7s" repeatCount="indefinite" />
              </circle>
              <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="10" fill={lineColor} />
            </g>
          )}

          {yearPointMap.map((point) => (
            <text key={`year-${point.year}`} x={point.x} y={height - 12} textAnchor="middle" fontSize="16" fontWeight="400" fill="#64748b">
              {point.year}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function InflacniKalkulacka() {
  const [amount, setAmount] = useState(10000);
  const [fromYear, setFromYear] = useState(2015);
  const [toYear, setToYear] = useState(currentYear);
  const [futureRateInput, setFutureRateInput] = useState("3,5");
  const [yieldRateInput, setYieldRateInput] = useState("0");
  const [yieldExact, setYieldExact] = useState(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const years = useMemo(() => {
    const items = [];
    for (let year = minYear; year <= maxYear; year += 1) {
      items.push(year);
    }
    return items;
  }, []);

  const safeFromYear = Math.max(minYear, Math.min(maxYear, Number(fromYear) || minYear));
  const safeToYear = Math.max(minYear, Math.min(maxYear, Number(toYear) || minYear));
  const safeAmount = Math.max(0, Number(amount) || 0);
  const parsedFutureRate = parseLocalizedNumber(futureRateInput);
  const parsedYieldRate = parseLocalizedNumber(yieldRateInput);
  const safeFutureRate = Number.isFinite(parsedFutureRate) ? parsedFutureRate : 0;
  const safeYieldRate = yieldExact !== null ? yieldExact : Number.isFinite(parsedYieldRate) ? parsedYieldRate : 0;

  const calc = useMemo(() => {
    return computeConversion(safeAmount, safeFromYear, safeToYear, safeFutureRate);
  }, [safeAmount, safeFromYear, safeToYear, safeFutureRate]);

  const yearsDiff = Math.abs(safeToYear - safeFromYear);
  const hasYield = safeYieldRate !== 0;
  const yieldFactor = Math.pow(1 + safeYieldRate / 100, yearsDiff);
  const displayedResult = hasYield ? calc.result / yieldFactor : calc.result;

  const breakEvenYield = yearsDiff > 0 ? (Math.pow(calc.factor, 1 / yearsDiff) - 1) * 100 : 0;
  const breakEvenYieldDisplay = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(breakEvenYield);
  const breakEvenYieldChip = `${breakEvenYieldDisplay} %`;

  const rawDisplayedDelta = safeAmount - displayedResult;
  const displayedDelta = Math.abs(rawDisplayedDelta) < 0.5 ? 0 : rawDisplayedDelta;
  const displayedDeltaLabel = hasYield ? "Změna kupní síly" : "Změna hodnoty";

  const chartSeries = useMemo(() => {
    return buildPurchasingPowerSeries(safeAmount, safeFromYear, safeToYear, safeFutureRate, safeYieldRate);
  }, [safeAmount, safeFromYear, safeToYear, safeFutureRate, safeYieldRate]);

  const inflationGap = currentInflation - inflationTarget;
  let inflationStatus = "na cíli";
  if (inflationGap > 0.05) {
    inflationStatus = "nad cílem";
  } else if (inflationGap < -0.05) {
    inflationStatus = "pod cílem";
  }

  const indicatorPosition = Math.max(0, Math.min(100, (currentInflation / indicatorScaleMax) * 100));
  const targetPosition = Math.max(0, Math.min(100, (inflationTarget / indicatorScaleMax) * 100));

  let indicatorColor = "#0f172a";
  let indicatorPing = "rgba(15,23,42,0.22)";
  if (inflationGap > 0.05) {
    indicatorColor = "#dc2626";
    indicatorPing = "rgba(220,38,38,0.28)";
  } else if (inflationGap < -0.05) {
    indicatorColor = "#16a34a";
    indicatorPing = "rgba(22,163,74,0.28)";
  }

  let displayedDeltaColor = "text-slate-900";
  if (displayedDelta > 0) {
    displayedDeltaColor = "text-green-600";
  } else if (displayedDelta < 0) {
    displayedDeltaColor = "text-red-600";
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-6">
        <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">📊 Inflační kalkulačka</h1>
              <p className="mx-auto mt-2 max-w-3xl text-slate-600 md:mx-0">
                Zadejte hodnotu, původní rok a cílový rok. Kalkulačka následně přepočítá hodnotu do zvoleného období se započtením inflace, a to jak zpětně, tak i do budoucna. Pro budoucí roky využívá vámi zadaný odhad průměrné roční inflace.
              </p>
            </div>

            <div className="w-full max-w-[320px] px-0 py-2 md:min-w-[280px] md:max-w-[340px] md:px-4 md:py-4 md:ml-auto">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Inflace vs. cíl ČNB</span>
                <span className="font-semibold text-slate-800">{formatPct(currentInflation)}</span>
              </div>

              <div className="relative mt-3">
                <div className="h-[3px] rounded-full bg-slate-200/80" />
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${targetPosition}%` }}
                >
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                </div>
                <div
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${indicatorPosition}%` }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" className="overflow-visible">
                    <circle cx="6" cy="6" r="4.5" fill={indicatorPing}>
                      <animate attributeName="r" values="4.5;9;4.5" dur="1.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.75;0.08;0.75" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="6" cy="6" r="4.5" fill={indicatorColor} />
                  </svg>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 sm:text-xs">
                <span>0 %</span>
                <span>Cíl ČNB 2 %</span>
                <span>4 %</span>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                Aktuálně je inflace <span className="font-semibold text-slate-800">{inflationStatus}</span>
                {inflationStatus === "na cíli" ? "" : ` o ${formatPct(Math.abs(inflationGap))}`}
                .
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-5 text-xl font-semibold">Vstupy</h2>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Hodnota</span>
                <div className="relative mt-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-2xl border px-4 py-3 pr-12 text-lg outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">Kč</span>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Původní rok</span>
                <select
                  value={fromYear}
                  onChange={(e) => setFromYear(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {years.map((year) => (
                    <option key={`from-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Cílový rok</span>
                <select
                  value={toYear}
                  onChange={(e) => setToYear(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-slate-300"
                >
                  {years.map((year) => (
                    <option key={`to-${year}`} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Odhad budoucí průměrné inflace</span>
                <div className="relative mt-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={futureRateInput}
                    onChange={(e) => setFutureRateInput(e.target.value)}
                    className="w-full rounded-2xl border px-4 py-3 pr-12 text-lg outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Výnos (např. spořicí účet nebo investice) – pokud nechcete počítat, ponechte 0 %</span>
                <div className="relative mt-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={yieldRateInput}
                    onChange={(e) => {
                      setYieldExact(null);
                      setYieldRateInput(e.target.value);
                    }}
                    className="w-full rounded-2xl border px-4 py-3 pr-32 text-lg outline-none focus:ring-2 focus:ring-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setYieldExact(breakEvenYield);
                      setYieldRateInput(breakEvenYieldDisplay.replace(".", ","));
                    }}
                    className="group absolute right-12 top-1/2 -translate-y-1/2 rounded-xl bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    {breakEvenYieldChip}
                    <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-56 rounded-lg bg-slate-900 p-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
                      Nastaví výnos na přesnou hodnotu, která vyrovná inflaci a zachová kupní sílu.
                    </div>
                  </button>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setAmount(10000);
                  setFromYear(2015);
                  setToYear(currentYear);
                  setFutureRateInput("3,5");
                  setYieldRateInput("0");
                  setYieldExact(null);
                }}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-white transition hover:opacity-90"
              >
                Výchozí hodnoty
              </button>
              <button
                onClick={() => setShowBreakdown((value) => !value)}
                className="rounded-2xl border px-4 py-2.5 transition hover:bg-slate-50"
              >
                {showBreakdown ? "Skrýt rozpis" : "Zobrazit rozpis po letech"}
              </button>
            </div>

            <div className="mt-6 space-y-2 rounded-2xl border bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p>Ukazatel v horní části zobrazuje aktuální meziroční inflaci a její odchylku od 2% cíle ČNB.</p>
              <p>Historická data jsou předvyplněná. Pro roky po {lastHistoricalYear} se automaticky použije odhad 3,5 %, který lze upravit dle potřeby.</p>
              <p>Pokud necháte výnos na 0 %, kalkulačka počítá jen s inflací. Když zadáte výnos, ukáže vám, o kolik méně peněz budete potřebovat díky zhodnocení.</p>
              <p>Pro roky 1954 až 1989 je použit jednotný odhad inflace ve výši 3,3 % ročně. Od roku 1990 kalkulačka vychází z historických ročních sazeb inflace.</p>
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-5 text-xl font-semibold">Výsledek</h2>

            <div className="rounded-3xl border bg-slate-900 p-6 text-white">
              <div className="text-sm text-slate-300">Přepočtená hodnota</div>
              <div className="mt-2 text-3xl font-bold md:text-4xl">{formatCZK(displayedResult)}</div>
              <div className="mt-3 text-slate-300">
                {hasYield
                  ? `Na co vám v roce ${safeFromYear} stačilo ${formatCZK(safeAmount)}, na to vám při zhodnocení prostředků o ${formatPct(safeYieldRate)} stačí v roce ${safeToYear} ${formatCZK(displayedResult)}.`
                  : `Na co vám v roce ${safeFromYear} stačilo ${formatCZK(safeAmount)}, na to byste v roce ${safeToYear} potřebovali ${formatCZK(displayedResult)}.`}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border p-4">
                <div className="text-sm text-slate-500">{displayedDeltaLabel}</div>
                <div className={`mt-1 text-2xl font-semibold ${displayedDeltaColor}`}>
                  {displayedDelta === 0 ? formatCZK(0) : formatCZK(displayedDelta)}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm text-slate-500">Kumulovaná inflace</div>
                <div className="mt-1 text-2xl font-semibold">{formatPct((calc.factor - 1) * 100)}</div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm text-slate-500">Průměrná inflace</div>
                <div className="mt-1 text-2xl font-semibold">{formatPct(calc.averageRate)}</div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm text-slate-500">Počet roků</div>
                <div className="mt-1 text-2xl font-semibold">{yearsDiff}</div>
              </div>
            </div>

            <SimpleLineChart data={chartSeries} delta={displayedDelta} />
          </div>
        </div>

        {showBreakdown && (
          <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Rozpis použitých let</h2>
              <div className="text-sm text-slate-500">
                Zobrazeno: {calc.appliedYears.length}{" "}
                {calc.appliedYears.length === 1 ? "rok" : calc.appliedYears.length < 5 ? "roky" : "let"}
              </div>
            </div>

            {calc.appliedYears.length === 0 ? (
              <div className="text-slate-600">Původní a cílový rok jsou stejné, takže se nic nepřepočítává.</div>
            ) : (
              <div className="overflow-auto rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Rok</th>
                      <th className="px-4 py-3 text-left font-medium">Použitá inflace</th>
                      <th className="px-4 py-3 text-left font-medium">Zdroj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.appliedYears.map((item) => (
                      <tr key={`${item.direction}-${item.year}`} className="border-t">
                        <td className="px-4 py-3">{item.year}</td>
                        <td className="px-4 py-3">{formatPct(item.rate)}</td>
                        <td className="px-4 py-3 text-slate-600">{item.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
