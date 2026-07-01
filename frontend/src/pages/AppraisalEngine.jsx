import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Layout from '../components/Layout/Layout';
import {
  fetchYearlyAppraisal,
  clearAppraisal,
  setAppraisalYear,
} from '../features/intelligence/intelligenceSlice';

/* ─── Constants ────────────────────────────────────────────────────────────── */
const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];

const QUARTER_LABELS = {
  Q1: 'Q1 Jan–Mar',
  Q2: 'Q2 Apr–Jun',
  Q3: 'Q3 Jul–Sep',
  Q4: 'Q4 Oct–Dec',
};

/* ─── Avatar color palette ─────────────────────────────────────────────────── */
const AVATAR_PALETTE = [
  'from-blue-500 to-indigo-600',
  'from-teal-500 to-emerald-600',
  'from-violet-500 to-purple-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
];
const avatarGradient = (name = '') =>
  AVATAR_PALETTE[(name.charCodeAt(0) || 0) % AVATAR_PALETTE.length];

/* ─── Format helpers ────────────────────────────────────────────────────────── */
const fmtPct  = (v) => v === null || v === undefined ? 'N/A' : `${v}%`;
const fmtNum  = (v) => v === null || v === undefined ? 'N/A' : String(v);

/* ─── Custom Recharts tooltip ─────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-[#DFE1E6]/80 bg-white shadow-xl px-4 py-3 text-xs">
      <p className="font-extrabold text-[#172B4D] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-[#5E6C84] font-semibold">{p.name}:</span>
          <span className="font-extrabold text-[#172B4D]">
            {p.value === null ? 'Pending' : p.dataKey.includes('velocity') ? p.value : `${p.value}%`}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─── Metric Summary Card ──────────────────────────────────────────────────── */
const MetricCard = ({ label, value, unit = '', icon: Icon, colorCls, trend }) => (
  <div className={`rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-3 ${colorCls || 'border-[#DFE1E6]/75'}`}>
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84]">{label}</span>
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-[#DFE1E6]/60 flex items-center justify-center">
          <Icon className="h-4 w-4 text-[#5E6C84]" />
        </div>
      )}
    </div>
    <div className="flex items-end gap-1.5">
      <span className="text-3xl font-black text-[#172B4D] leading-none">
        {value === null || value === undefined ? 'N/A' : value}
      </span>
      {unit && <span className="text-sm font-bold text-[#5E6C84] mb-0.5">{unit}</span>}
    </div>
    {trend !== undefined && trend !== null && (
      <div className={`flex items-center gap-1 text-[10px] font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>{trend >= 0 ? '+' : ''}{trend} vs team avg</span>
      </div>
    )}
  </div>
);

/* ─── Skeleton loader for chart panel ──────────────────────────────────────── */
const ChartSkeleton = () => (
  <div className="animate-pulse space-y-3">
    <div className="h-4 w-1/3 rounded-lg bg-slate-100" />
    <div className="h-52 rounded-2xl bg-slate-100" />
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   YEARLY ANALYTICAL DOSSIER — inline panel shown below the selected row
   ═══════════════════════════════════════════════════════════════════════════ */
const YearlyDossierPanel = ({ empData, teamAverages, year, onClose, pdfRef }) => {
  const { yearlyTotals, quarters, name, email, employeeId } = empData;

  // Build line-chart data: 4 quarters on X-axis.
  // EC-8: future quarters have quarters[q] === null → render null (Recharts breaks line)
  const lineData = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
    quarter: QUARTER_LABELS[q],
    velocity:    quarters[q]?.velocity ?? null,
    attendance:  quarters[q]?.ari      ?? null,
  }));

  // Build radar chart data — domain 0–100 for all axes.
  // Invert tamper and overdues so that lower is visually "better" (higher polygon)
  const invertNormalize = (val, maxVal = 20) => {
    if (val === null || val === undefined) return null;
    return Math.round(Math.max(0, Math.min(100, 100 - (val / maxVal) * 100)));
  };

  // Compute team average values across non-null quarters
  const avgTeamMetric = (key) => {
    const vals = ['Q1', 'Q2', 'Q3', 'Q4']
      .map(q => teamAverages[q]?.[key])
      .filter(v => v !== null && v !== undefined);
    return vals.length === 0 ? null : Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10;
  };

  const teamFTPR  = avgTeamMetric('ftpr');
  const teamGTP   = avgTeamMetric('gtp');
  const teamOD    = avgTeamMetric('overdueCount');

  const radarData = [
    {
      metric: 'FTPR',
      employee: yearlyTotals.ftpr     ?? 0,
      teamAvg:  teamFTPR              ?? 0,
    },
    {
      metric: 'Reliability\n(inv. Tamper)',
      employee: invertNormalize(yearlyTotals.gtp, 20)      ?? 0,
      teamAvg:  invertNormalize(teamGTP, 20)               ?? 0,
    },
    {
      metric: 'On-Time\n(inv. Overdue)',
      employee: invertNormalize(yearlyTotals.overdueCount, 20) ?? 0,
      teamAvg:  invertNormalize(teamOD, 20)                    ?? 0,
    },
  ];

  // Trend vs team for metric cards
  const teamYearlyARI      = avgTeamMetric('ari');
  const teamYearlyVelocity = avgTeamMetric('velocity');

  const trend = (empVal, teamVal) => {
    if (empVal === null || teamVal === null) return null;
    return Math.round((empVal - teamVal) * 10) / 10;
  };

  return (
    <div ref={pdfRef} className="border-t border-[#DFE1E6]/60 bg-gradient-to-b from-[#FAFBFC] to-white">
      <div className="px-6 py-6 space-y-8">

        {/* ── Panel header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${avatarGradient(name)} text-white font-extrabold text-sm shadow-md`}>
              {name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#172B4D]">{name}</h3>
              <p className="text-[11px] text-[#5E6C84]">{email} · {employeeId || '—'}</p>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#0052CC] bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 inline-block mt-1">
                Annual Dossier {year}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-[#F4F5F7] text-[#5E6C84] transition-all border border-transparent hover:border-[#DFE1E6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Charts row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Consistency Line Chart */}
          <div className="rounded-2xl border border-[#DFE1E6]/75 bg-white shadow-sm p-5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] mb-4 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-[#0A89CD]" />
              Consistency — Velocity &amp; Attendance
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" vertical={false} />
                <XAxis
                  dataKey="quarter"
                  tick={{ fill: '#5E6C84', fontSize: 9, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#97A0AF', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '8px' }}
                />
                {/* connectNulls={false}: EC-8 — future quarters show a line break, not zero */}
                <Line
                  type="monotone"
                  dataKey="velocity"
                  name="Velocity (tasks)"
                  stroke="#0A89CD"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0A89CD', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  name="Attendance %"
                  stroke="#36A15D"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#36A15D', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                  strokeDasharray="5 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quality Radar Chart — domain strictly 0–100 */}
          <div className="rounded-2xl border border-[#DFE1E6]/75 bg-white shadow-sm p-5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84] mb-4 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-[#5243AA]" />
              Quality Radar — Employee vs Team Average
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <PolarGrid stroke="#F4F5F7" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#5E6C84', fontSize: 9, fontWeight: 700 }}
                />
                {/* Domain strictly 0–100 for accurate polygon scaling */}
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: '#97A0AF', fontSize: 8 }}
                  tickCount={4}
                />
                <Radar
                  name="Employee"
                  dataKey="employee"
                  stroke="#0A89CD"
                  fill="#0A89CD"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
                <Radar
                  name="Team Avg"
                  dataKey="teamAvg"
                  stroke="#F79232"
                  fill="#F79232"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '4px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 6 Metric Summary Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Velocity"
            value={fmtNum(yearlyTotals.velocity)}
            unit="tasks"
            icon={Zap}
            colorCls="border-[#DEEBFF]"
            trend={trend(yearlyTotals.velocity, teamYearlyVelocity)}
          />
          <MetricCard
            label="Attendance"
            value={yearlyTotals.ari ?? 'N/A'}
            unit={yearlyTotals.ari !== null ? '%' : ''}
            icon={CheckCircle2}
            colorCls="border-[#E3FCEF]"
            trend={trend(yearlyTotals.ari, teamYearlyARI)}
          />
          <MetricCard
            label="FTPR"
            value={yearlyTotals.ftpr ?? 'N/A'}
            unit={yearlyTotals.ftpr !== null ? '%' : ''}
            icon={Shield}
            colorCls="border-[#EAE6FF]"
            trend={trend(yearlyTotals.ftpr, teamFTPR)}
          />
          <MetricCard
            label="Tamper Strikes"
            value={fmtNum(yearlyTotals.gtp)}
            icon={AlertTriangle}
            colorCls={yearlyTotals.gtp >= 3 ? 'border-amber-200' : 'border-[#DFE1E6]/75'}
          />
          <MetricCard
            label="Overdues"
            value={fmtNum(yearlyTotals.overdueCount)}
            icon={TrendingDown}
            colorCls={yearlyTotals.overdueCount >= 3 ? 'border-rose-200' : 'border-[#DFE1E6]/75'}
          />
          <MetricCard
            label="Feedback Ratio"
            value={yearlyTotals.feedbackRatio ?? 'N/A'}
            unit={yearlyTotals.feedbackRatio !== null ? '%' : ''}
            icon={BarChart3}
            colorCls="border-[#DFE1E6]/75"
          />
        </div>

        {/* ── Quarterly breakdown mini-table ────────────────────────────── */}
        <div className="rounded-2xl border border-[#DFE1E6]/75 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DFE1E6]/60 bg-slate-50/30">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84]">
              Quarterly Breakdown
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#DFE1E6]/50">
                  <th className="px-4 py-2.5 text-left text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Quarter</th>
                  <th className="px-4 py-2.5 text-center text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Velocity</th>
                  <th className="px-4 py-2.5 text-center text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Attendance</th>
                  <th className="px-4 py-2.5 text-center text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">FTPR</th>
                  <th className="px-4 py-2.5 text-center text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Tamper</th>
                  <th className="px-4 py-2.5 text-center text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Overdues</th>
                  <th className="px-4 py-2.5 text-center text-[9px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBECF0]">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
                  const qd = quarters[q];
                  const isFuture = qd === null;
                  return (
                    <tr key={q} className={isFuture ? 'opacity-35' : 'hover:bg-slate-50/40'}>
                      <td className="px-4 py-2.5 font-extrabold text-[#172B4D]">
                        {QUARTER_LABELS[q]}
                        {isFuture && <span className="ml-2 text-[8px] uppercase tracking-wider text-[#97A0AF] font-black">Pending</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#172B4D]">{isFuture ? '—' : (qd?.velocity ?? 0)}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#172B4D]">{isFuture ? '—' : fmtPct(qd?.ari)}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#172B4D]">{isFuture ? '—' : fmtPct(qd?.ftpr)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-bold ${!isFuture && qd?.gtp >= 3 ? 'text-amber-600' : 'text-[#172B4D]'}`}>
                          {isFuture ? '—' : (qd?.gtp ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-bold ${!isFuture && qd?.overdueCount >= 3 ? 'text-rose-600' : 'text-[#172B4D]'}`}>
                          {isFuture ? '—' : (qd?.overdueCount ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#172B4D]">{isFuture ? '—' : fmtPct(qd?.feedbackRatio)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT — Appraisal Engine (Tier 2: Yearly Strategic)
   ═══════════════════════════════════════════════════════════════════════════ */
const AppraisalEngine = () => {
  const dispatch    = useDispatch();
  const { appraisalData, isAppraisalLoading, error, appraisalYear } =
    useSelector((s) => s.intelligence);

  const [search, setSearch]               = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfReady, setPdfReady]           = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    dispatch(fetchYearlyAppraisal({ year: appraisalYear }));
    setSelectedEmpId(null);
  }, [dispatch, appraisalYear]);

  // Enable PDF button 500ms after data loads (EC-12: chart render timing)
  useEffect(() => {
    if (!isAppraisalLoading && appraisalData) {
      const timer = setTimeout(() => setPdfReady(true), 500);
      return () => clearTimeout(timer);
    }
    setPdfReady(false);
  }, [isAppraisalLoading, appraisalData]);

  const appraisals    = appraisalData?.appraisals    || [];
  const teamAverages  = appraisalData?.teamAverages  || {};
  const selectedEmp   = appraisals.find(e => e.id === selectedEmpId) || null;

  const filtered = search
    ? appraisals.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
      )
    : appraisals;

  const handleRowClick = (emp) => {
    setSelectedEmpId(prev => (prev === emp.id ? null : emp.id));
  };

  const handleYearChange = (e) => {
    dispatch(setAppraisalYear(Number(e.target.value)));
  };

  /* ── PDF Export ─────────────────────────────────────────────────────────── */
  const handleGeneratePDF = useCallback(async () => {
    if (!selectedEmp || !pdfRef.current || !pdfReady) return;
    setIsPdfGenerating(true);

    try {
      // Dynamic import to keep initial bundle lean
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF }   = jsPDFModule;

      // EC-12: scale:2 for crisp high-resolution capture
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const pageW  = pdf.internal.pageSize.getWidth();
      const pageH  = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      // Corporate header
      pdf.setFillColor(0, 82, 204);
      pdf.rect(0, 0, pageW, 18, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Yakkay Tech — Annual Performance Dossier', margin, 12);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${selectedEmp.name}  ·  ${selectedEmp.email}  ·  Year ${appraisalYear}`, margin, 17);

      // Reset text color
      pdf.setTextColor(0, 0, 0);

      // Fit captured image into remaining space
      const imgAspect  = canvas.width / canvas.height;
      const maxImgH    = usableH - 20; // 20mm header gap
      const calcH      = usableW / imgAspect;
      const finalH     = Math.min(calcH, maxImgH);
      const finalW     = finalH * imgAspect;
      const xOffset    = margin + (usableW - finalW) / 2;

      pdf.addImage(imgData, 'PNG', xOffset, 22, finalW, finalH);

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Generated ${new Date().toLocaleString('en-IN')} · Confidential — Internal Use Only`,
        margin,
        pageH - 4
      );

      const safeName = selectedEmp.name.replace(/\s+/g, '_');
      pdf.save(`Appraisal_${safeName}_${appraisalYear}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsPdfGenerating(false);
    }
  }, [selectedEmp, pdfReady, appraisalYear]);

  return (
    <Layout pageTitle="Appraisal Engine — Annual Strategic Review">
      <div className="mx-auto max-w-6xl space-y-6 px-1 py-2">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs font-semibold">
            <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0 text-red-500" />
            {error}
          </div>
        )}

        {/* ── PAGE HEADER ───────────────────────────────────────────────── */}
        <div className="relative rounded-2xl border border-[#DFE1E6]/75 bg-gradient-to-r from-violet-50/60 via-indigo-50/30 to-slate-50/50 p-6 px-8 shadow-sm overflow-hidden">
          <div className="absolute -top-14 -right-14 w-52 h-52 rounded-full bg-violet-100/40 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 left-1/4 w-40 h-40 rounded-full bg-indigo-100/30 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex-shrink-0 bg-gradient-to-br from-violet-500/15 to-indigo-600/15 ring-1 ring-violet-500/10 shadow-sm flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-[#5243AA]" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-[#172B4D] tracking-tight leading-none">
                    Appraisal Engine
                  </h1>
                  <span className="text-[9px] font-black tracking-widest text-[#5243AA] uppercase bg-[#EAE6FF] border border-[#C0B6F2]/40 px-2 py-0.5 rounded-md">
                    Yearly Strategic
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5E6C84] font-medium">
                  {appraisals.length} employee profiles · Annual appraisal data for {appraisalYear}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Year selector */}
              <div className="flex items-center gap-2 bg-white/60 border border-[#DFE1E6]/80 rounded-xl px-3 py-1.5 shadow-sm">
                <ChevronDown className="h-3 w-3 text-[#5E6C84]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5E6C84]">Year</span>
                <div className="relative">
                  <select
                    id="appraisal-year"
                    value={appraisalYear}
                    onChange={handleYearChange}
                    className="appearance-none rounded-xl border border-[#DFE1E6] bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-[#172B4D] focus:border-[#5243AA] focus:ring-2 focus:ring-violet-100 outline-none transition-all cursor-pointer"
                    style={{ minWidth: '72px' }}
                  >
                    {AVAILABLE_YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#5E6C84]" />
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#97A0AF]" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-[#DFE1E6] bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-[#172B4D] placeholder-[#97A0AF] focus:border-[#5243AA] focus:ring-2 focus:ring-violet-100 outline-none transition-all"
                  style={{ minWidth: '180px' }}
                />
              </div>

              {/* PDF Export button */}
              {selectedEmp && (
                <button
                  id="generate-pdf-btn"
                  onClick={handleGeneratePDF}
                  disabled={!pdfReady || isPdfGenerating}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0052CC] hover:bg-[#0747A6] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 text-xs font-extrabold shadow-sm transition-all active:scale-95"
                >
                  {isPdfGenerating
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />}
                  {isPdfGenerating ? 'Generating...' : 'Generate Annual Dossier'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── EMPLOYEE TABLE ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#DFE1E6]/75 bg-white shadow-sm overflow-hidden">
          {isAppraisalLoading ? (
            <div className="p-8 space-y-5">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-[#DFE1E6]/60 shadow-sm text-slate-400 mb-3">
                <Users className="h-5 w-5 opacity-60" />
              </div>
              <p className="text-xs font-extrabold text-[#172B4D]">No Appraisal Data</p>
              <p className="text-[11px] text-[#6B778C] mt-1 max-w-xs leading-normal">
                No employees found matching your search.
              </p>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#DFE1E6]/70 bg-slate-50/20">
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider">Employee</th>
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider text-center">Velocity</th>
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider text-center">Attendance</th>
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider text-center">FTPR</th>
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider text-center">Tamper</th>
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider text-center">Overdues</th>
                    <th className="p-4 px-6 text-[10px] font-extrabold text-[#5E6C84] uppercase tracking-wider text-right">Expand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBECF0]">
                  {filtered.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    const t = emp.yearlyTotals;
                    return (
                      <React.Fragment key={emp.id}>
                        <tr
                          onClick={() => handleRowClick(emp)}
                          className={`cursor-pointer transition-colors duration-150 ${
                            isSelected ? 'bg-violet-50/30' : 'hover:bg-slate-50/60'
                          }`}
                        >
                          <td className="p-4 px-6">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${avatarGradient(emp.name)} text-xs font-extrabold text-white shadow-sm`}
                              >
                                {emp.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-extrabold text-[#172B4D] text-xs leading-none">{emp.name}</p>
                                <p className="text-[11px] text-[#5E6C84] mt-1">{emp.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <span className="inline-flex items-center justify-center min-w-[36px] rounded-full bg-blue-50 text-[#0052CC] border border-blue-100 px-2.5 py-0.5 text-[10px] font-black">
                              {t.velocity ?? '—'}
                            </span>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[44px] rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                              t.ari === null ? 'bg-slate-50 text-[#5E6C84] border-[#DFE1E6]' :
                              t.ari >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              t.ari >= 70 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {fmtPct(t.ari)}
                            </span>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[44px] rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                              t.ftpr === null ? 'bg-slate-50 text-[#5E6C84] border-[#DFE1E6]' :
                              t.ftpr >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              t.ftpr >= 70 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {fmtPct(t.ftpr)}
                            </span>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[32px] rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                              t.gtp >= 3 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-[#42526E] border-[#DFE1E6]'
                            }`}>
                              {t.gtp ?? 0}
                            </span>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[32px] rounded-full px-2.5 py-0.5 text-[10px] font-black border ${
                              t.overdueCount >= 3 ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-[#42526E] border-[#DFE1E6]'
                            }`}>
                              {t.overdueCount ?? 0}
                            </span>
                          </td>
                          <td className="p-4 px-6 text-right">
                            <div className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border shadow-sm transition-all duration-200 ${
                              isSelected
                                ? 'bg-[#5243AA] text-white border-[#5243AA]'
                                : 'bg-slate-50 text-slate-400 border-[#DFE1E6]/50 hover:bg-[#5243AA] hover:text-white hover:border-[#5243AA]'
                            }`}>
                              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`} />
                            </div>
                          </td>
                        </tr>

                        {/* Inline expanded dossier panel */}
                        {isSelected && (
                          <tr key={`${emp.id}-panel`}>
                            <td colSpan={7} className="p-0">
                              <YearlyDossierPanel
                                empData={emp}
                                teamAverages={teamAverages}
                                year={appraisalYear}
                                onClose={() => setSelectedEmpId(null)}
                                pdfRef={pdfRef}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AppraisalEngine;
