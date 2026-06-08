import { useState, useCallback, useRef } from 'react';

/* HAMMING CODE ALGORITHM CORE */

function numParityBits(m) {
  let r = 0;
  while ((1 << r) < m + r + 1) r++;
  return r;
}

const parityPos   = (r) => Array.from({ length: r }, (_, i) => 1 << i);
const dataPos     = (n, r) => { const ps = new Set(parityPos(r)); return Array.from({ length: n }, (_, i) => i + 1).filter(p => !ps.has(p)); };
const coveredBy   = (p, n, self) => Array.from({ length: n }, (_, j) => j + 1).filter(j => (j & p) !== 0 && (self || j !== p));
const xorBits     = (arr, pos) => pos.reduce((acc, p) => acc ^ arr[p], 0);

function hammingEncode(dataBits, m) {
  const r = numParityBits(m), n = m + r;
  const cw = new Array(n + 1).fill(0);
  const pp = parityPos(r), dp = dataPos(n, r);
  dp.forEach((pos, i) => { cw[pos] = parseInt(dataBits[i] ?? '0', 10); });
  const pv = {};
  pp.forEach(p => { const val = xorBits(cw, coveredBy(p, n, false)); cw[p] = val; pv[p] = val; });
  return { codeword: cw.slice(1).join(''), pp, dp, pv, n, r };
}

const flipBit = (cw, pos) => { const b = [...cw]; b[pos - 1] = b[pos - 1] === '0' ? '1' : '0'; return b.join(''); };

function calcSyndrome(received, m) {
  const r = numParityBits(m), n = received.length;
  const arr = [0, ...received.split('').map(Number)];
  const pp = parityPos(r), checks = {};
  let s = 0;
  pp.forEach(p => { const val = xorBits(arr, coveredBy(p, n, true)); checks[p] = val; if (val) s += p; });
  return { s, errPos: s || null, checks };
}

const fixError   = (cw, s)  => (!s || s > cw.length ? cw : flipBit(cw, s));
const extractData = (cw, m) => { const ps = new Set(parityPos(numParityBits(m))); return cw.split('').filter((_, i) => !ps.has(i + 1)).join(''); };

/* 
     FIGURE 5.7 — FLOW DIAGRAM (SVG)
    */

const FLOW_BOXES = [
  { lbl: 'Data In',     sub: 'Giriş',       minStep: 0 },
  { lbl: 'Hamming f()', sub: 'Encode',       minStep: 1 },
  { lbl: 'Memory',      sub: 'Depolama',     minStep: 1 },
  { lbl: 'Hamming f()', sub: 'Decode',       minStep: 3 },
  { lbl: 'Compare',     sub: 'Karşılaştır', minStep: 3 },
  { lbl: 'Corrector',   sub: 'Düzeltici',   minStep: 4 },
  { lbl: 'Data Out',    sub: 'Çıkış',       minStep: 4 },
];

function FlowDiagram({ step }) {
  const BW = 84, BH = 52, G = 30, BY = 13;
  const TW = FLOW_BOXES.length * BW + (FLOW_BOXES.length - 1) * G + 8;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${TW} 80`} style={{ minWidth: 560, height: 80 }} aria-label="Hamming Code akış diyagramı">
        <defs>
          <marker id="mn" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0,7 3.5,0 7" fill="#1e293b" /></marker>
          <marker id="mv" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0,7 3.5,0 7" fill="#6d28d9" /></marker>
          <marker id="me" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><polygon points="0 0,7 3.5,0 7" fill="#d97706" /></marker>
        </defs>

        {FLOW_BOXES.map((box, i) => {
          const bx = 4 + i * (BW + G), cy = BY + BH / 2;
          const active   = step >= box.minStep;
          const errArrow = i === 3 && step === 2;
          const aColor   = errArrow ? '#d97706' : active ? '#6d28d9' : '#1e293b';
          const mid      = errArrow ? 'me' : active ? 'mv' : 'mn';

          return (
            <g key={i}>
              {i > 0 && (
                <g>
                  <line x1={4+(i-1)*(BW+G)+BW} y1={cy} x2={bx-2} y2={cy}
                    stroke={aColor} strokeWidth={active ? 1.6 : 1} markerEnd={`url(#${mid})`} />
                  {errArrow && (
                    <text x={4+(i-1)*(BW+G)+BW+G/2} y={cy-7} textAnchor="middle"
                      fill="#d97706" fontSize="7" fontFamily="monospace" fontWeight="700">⚡ERR</text>
                  )}
                </g>
              )}
              <rect x={bx} y={BY} width={BW} height={BH} rx={7}
                fill={active ? 'rgba(109,40,217,0.13)' : 'rgba(5,10,20,0.75)'}
                stroke={active ? '#6d28d9' : '#0f172a'} strokeWidth={active ? 1.6 : 1} />
              <text x={bx+BW/2} y={BY+BH/2-2} textAnchor="middle"
                fill={active ? '#a78bfa' : '#1e293b'} fontSize="8.5"
                fontFamily="'JetBrains Mono',monospace" fontWeight="700">{box.lbl}</text>
              <text x={bx+BW/2} y={BY+BH-7} textAnchor="middle"
                fill={active ? '#5b21b6' : '#0a0f1e'} fontSize="6.5">{box.sub}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* 
     BIT GRID — CSS tooltip, hover efekti, codeword özeti
    */

function BitGrid({ cw, pp, errPos, fixPos, m }) {
  if (!cw) return null;
  const parSet = new Set(pp);
  const sz  = m >= 32 ? 'w-7 h-7'    : m >= 16 ? 'w-8 h-8'   : 'w-10 h-10';
  const fs  = m >= 32 ? 'text-[11px]' : 'text-sm';
  const gap = m >= 32 ? 'gap-1'       : 'gap-1.5';

  return (
    <div className={`flex flex-wrap ${gap} justify-center`} role="list" aria-label="Codeword bit ızgarası">
      {[...cw].map((bit, idx) => {
        const pos   = idx + 1;
        const isPar = parSet.has(pos);
        const isErr = pos === errPos;
        const isFix = pos === fixPos;

        /* Renk önceliği: Düzeltilmiş > Hatalı > Parity > Data */
        let boxCls = 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300';
        let lblCls = 'text-cyan-800';
        let extra  = '';
        let tipBg  = 'bg-slate-800 border-slate-600/50';

        if (isFix) {
          boxCls = 'bg-emerald-500/15 border-emerald-400 text-emerald-200';
          lblCls = 'text-emerald-500';
          extra  = 'scale-110 shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/30';
          tipBg  = 'bg-emerald-900/90 border-emerald-500/40';
        } else if (isErr) {
          boxCls = 'bg-amber-500/15 border-amber-400 text-amber-200';
          lblCls = 'text-amber-500';
          extra  = 'scale-110 shadow-md shadow-amber-500/25 ring-1 ring-amber-400/30';
          tipBg  = 'bg-amber-900/90 border-amber-500/40';
        } else if (isPar) {
          boxCls = 'bg-rose-500/10 border-rose-500/50 text-rose-300';
          lblCls = 'text-rose-700';
          tipBg  = 'bg-rose-900/90 border-rose-500/40';
        }

        const tipLabel = isFix
          ? `✓ Düzeltildi`
          : isErr
          ? `⚡ Hata`
          : isPar
          ? `Parity P${pos}`
          : `Veri D`;

        return (
          <div key={pos} className="relative group flex flex-col items-center gap-0.5" role="listitem">
            {/* ── CSS-only Tooltip ── */}
            <div
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
              aria-hidden="true"
            >
              <div className={`border text-[9px] font-mono text-slate-100 px-2 py-1 rounded-lg whitespace-nowrap shadow-xl ${tipBg}`}>
                <span className="font-bold">Pos {pos}</span>
                <span className="text-slate-400 mx-1">·</span>
                <span>{tipLabel}</span>
                <span className="text-slate-400 mx-1">·</span>
                <span className="font-bold">{bit}</span>
              </div>
              {/* Triangle pointer */}
              <div className="w-2 h-2 mx-auto mt-[-4px] rotate-45 border-b border-r border-slate-600/50 bg-slate-800" />
            </div>

            {/* ── Bit hücre ── */}
            <div
              className={`${sz} ${fs} flex items-center justify-center rounded-lg border-2 font-mono font-bold cursor-default transition-all duration-300 ${boxCls} ${extra}`}
            >
              {bit}
            </div>

            {/* ── Pozisyon etiketi ── */}
            <span className={`text-[8px] font-mono font-semibold ${lblCls}`}>{pos}</span>
          </div>
        );
      })}
    </div>
  );
}

/* 
     TOAST NOTIFICATION (auto-dismiss)
    */

function Toast({ toast }) {
  if (!toast) return null;
  const styles = {
    warn:    'bg-amber-500/15 border-amber-500/40 text-amber-300',
    error:   'bg-rose-500/15 border-rose-500/40 text-rose-300',
    success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  };
  return (
    <div className="fixed top-20 inset-x-0 flex justify-center z-50 pointer-events-none px-4" aria-live="assertive">
      <div className={`border rounded-xl px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur-sm flex items-center gap-2 transition-all duration-300 ${styles[toast.type] ?? styles.warn}`}>
        {toast.type === 'warn' && <span>⚠</span>}
        {toast.type === 'error' && <span>✕</span>}
        {toast.type === 'success' && <span>✓</span>}
        {toast.msg}
      </div>
    </div>
  );
}

/* 
     SECTION CARD
    */

function Card({ n, title, sub, done, children }) {
  return (
    <section className="bg-[#0d1526] border border-slate-800/60 rounded-2xl p-6 transition-all duration-300">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
          done ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400' : 'border-violet-500 bg-violet-500/15 text-violet-400'
        }`}>
          {done ? '✓' : n}
        </div>
        <div>
          <h2 className="font-semibold text-slate-100 leading-none text-base">{title}</h2>
          {sub && <p className="text-xs text-slate-700 mt-0.5 font-mono">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* 
     MAIN APP
    */

export default function App() {
  /* ── State ─────────────────────────────────────────────────────────────── */
  const [m, setM]             = useState(8);
  const [input, setInput]     = useState('');
  const [enc, setEnc]         = useState(null);
  const [ePos, setEPos]       = useState(1);
  const [corrupt, setCorrupt] = useState(null);
  const [syn, setSyn]         = useState(null);
  const [fixed, setFixed]     = useState(null);
  const [step, setStep]       = useState(0);
  const [toast, setToast]     = useState(null);  // { msg, type }
  const toastTimer            = useRef(null);

  /* ── Toast helper ──────────────────────────────────────────────────────── */
  const showToast = useCallback((msg, type = 'warn') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Reset ─────────────────────────────────────────────────────────────── */
  const fullReset = useCallback(() => {
    setEnc(null); setCorrupt(null); setSyn(null); setFixed(null);
    setStep(0); setEPos(1);
  }, []);

  const newSimulation = useCallback(() => {
    fullReset();
    setInput('');
  }, [fullReset]);

  /* ── Handlers ──────────────────────────────────────────────────────────── */
  const handleMode = (v) => { setM(v); setInput(''); fullReset(); };

  /* Sadece 0 ve 1 kabul et — keydown seviyesinde engelle */
  const handleKeyDown = (e) => {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'];
    if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (e.key !== '0' && e.key !== '1') {
      e.preventDefault();
      showToast(`'${e.key}' geçersiz karakter — yalnızca 0 ve 1 girilir`, 'warn');
    }
  };

  const handleInput = (e) => {
    const v = e.target.value.replace(/[^01]/g, '').slice(0, m);
    setInput(v);
    if (step > 0) fullReset();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/[^01]/g, '').slice(0, m);
    setInput(pasted);
    if (step > 0) fullReset();
  };

  const handleRandom = () => {
    setInput(Array.from({ length: m }, () => `${Math.round(Math.random())}`).join(''));
    fullReset();
  };

  const handleEncode = () => {
    if (input.length === 0) {
      showToast('Önce binary veri girin (0 ve 1)', 'warn');
      return;
    }
    if (input.length !== m) {
      showToast(`${m} bit gerekli — şu an ${input.length} bit girildi (${m - input.length} bit eksik)`, 'warn');
      return;
    }
    const r = hammingEncode(input, m);
    setEnc(r); setEPos(1);
    setCorrupt(null); setSyn(null); setFixed(null);
    setStep(1);
    showToast(`${m}-bit veri ${r.n}-bit Hamming codeword'e dönüştürüldü`, 'success');
  };

  const handleInject = () => {
    if (!enc) {
      showToast('Önce veriyi "Belleğe Yaz" ile kaydedin!', 'error');
      return;
    }
    setCorrupt(flipBit(enc.codeword, ePos));
    setSyn(null); setFixed(null);
    setStep(2);
    showToast(`Pozisyon ${ePos}'deki bit flip edildi (hata enjekte edildi)`, 'warn');
  };

  const handleSyndrome = () => {
    if (!corrupt) {
      showToast('Önce hata enjekte edin ("Hata Oluştur" butonunu kullanın)!', 'error');
      return;
    }
    const result = calcSyndrome(corrupt, m);
    setSyn(result); setFixed(null);
    setStep(3);
    if (result.errPos) {
      showToast(`Sendrom = ${result.s} → Hatalı bit pozisyon ${result.errPos}`, 'warn');
    } else {
      showToast('Sendrom = 0 → Hata yok, codeword sağlıklı', 'success');
    }
  };

  const handleFix = () => {
    if (!syn) return;
    const corrected = fixError(corrupt, syn.s);
    setFixed(corrected);
    setStep(4);
    showToast(`Pozisyon ${syn.errPos} düzeltildi — veri kurtarıldı!`, 'success');
  };

  /* ── Derived display values ─────────────────────────────────────────────── */
  const displayCW = fixed || corrupt || enc?.codeword || '';
  const showErr   = step >= 2 && step < 4 ? ePos : null;
  const showFix   = step >= 4 ? syn?.errPos : null;

  /* ── Input validation message ───────────────────────────────────────────── */
  const inputWarn = input.length > 0 && input.length < m
    ? `${m} bit gerekli — ${input.length} girildi, ${m - input.length} bit eksik`
    : null;

  /* 
     RENDER
      */
  return (
    <div className="min-h-screen bg-[#060b16] text-slate-100">
      {/* ── GLOBAL TOAST ─────────────────────────────────────────────────── */}
      <Toast toast={toast} />

      {/* ══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 bg-[#060b16]/96 backdrop-blur-sm border-b border-slate-900" role="banner">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
              ⬡ Hamming Code Simülatörü
            </h1>
            <p className="text-xs text-slate-700 font-mono mt-0.5">SEC · Single Error Correction · R.W. Hamming, 1950</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bit Mode butonları */}
            <div className="flex gap-1.5" role="group" aria-label="Bit modu seçimi">
              {[8, 16, 32].map((v) => (
                <button key={v} id={`bit-mode-${v}`} onClick={() => handleMode(v)} aria-pressed={m === v}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold font-mono border-2 transition-all duration-200 ${
                    m === v
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300 shadow-lg shadow-violet-900/20'
                      : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                  }`}>
                  {v}b
                </button>
              ))}
            </div>

            {/* Yeni Simülasyon butonu */}
            <button
              id="btn-new-simulation"
              onClick={newSimulation}
              title="Her şeyi sıfırla ve yeni simülasyon başlat"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-500 hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/5 transition-all duration-200"
            >
              <span className="text-base leading-none">↺</span>
              <span>Yeni Simülasyon</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">

        {/* ══ FIGURE 5.7 FLOW DIAGRAM ═══════════════════════════════════════ */}
        <div className="bg-[#0d1526] border border-slate-800/60 rounded-2xl p-5">
          <p className="text-xs font-mono text-slate-700 uppercase tracking-widest mb-3">
            ▸ Figure 5.7 — Hamming Error-Correcting Code Akış Diyagramı
          </p>
          <FlowDiagram step={step} />

          <div className="mt-3 flex flex-wrap gap-2 justify-center" role="status" aria-live="polite">
            {['Başlangıç', 'Kodlandı', 'Hata Enjekte', 'Sendrom', 'Düzeltildi'].map((lbl, i) => (
              <span key={i} className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border transition-all duration-200 ${
                step === i ? 'border-violet-500/60 bg-violet-500/15 text-violet-400'
                : step > i ? 'border-emerald-800/50 text-emerald-800'
                : 'border-slate-900 text-slate-800'
              }`}>
                {step > i ? '✓' : step === i ? '▶' : '○'} {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* ══ §1: VERİ GİRİŞİ ══════════════════════════════════════════════ */}
        <Card n="1" title="Veri Girişi" sub={`${m}-bit binary string — yalnızca 0 ve 1`} done={step >= 1}>
          <div className="space-y-3">
            {/* Input alanı */}
            <div className="relative">
              <input
                id="data-input"
                type="text"
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                maxLength={m}
                inputMode="numeric"
                placeholder={`${m} adet 0 veya 1 girin…`}
                aria-label={`${m}-bit binary veri girişi`}
                aria-describedby={inputWarn ? 'input-warn' : undefined}
                className={`w-full bg-slate-900/60 border rounded-xl px-4 py-3 pr-20 font-mono text-sm tracking-widest text-slate-100 placeholder-slate-800 focus:outline-none focus:ring-2 transition-all duration-200 ${
                  inputWarn
                    ? 'border-amber-500/50 focus:border-amber-500/70 focus:ring-amber-500/20'
                    : input.length === m
                    ? 'border-emerald-500/40 focus:border-emerald-500/60 focus:ring-emerald-500/20'
                    : 'border-slate-700/60 focus:border-violet-500/60 focus:ring-violet-500/20'
                }`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono px-2 py-0.5 rounded-md transition-all duration-200 ${
                input.length === m ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-700'
              }`}>
                {input.length}/{m}
              </span>
            </div>

            {/* Input uyarı mesajı */}
            {inputWarn && (
              <div id="input-warn" role="alert" className="flex items-center gap-2 text-xs text-amber-400 font-mono bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                <span className="text-amber-400 shrink-0">⚠</span>
                <span>{inputWarn}</span>
              </div>
            )}

            {/* Butonlar */}
            <div className="flex gap-2">
              <button id="btn-random" onClick={handleRandom}
                className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/40 text-slate-400 text-sm hover:border-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-all duration-200">
                🎲 Rastgele
              </button>

              <button id="btn-encode" onClick={handleEncode} disabled={input.length !== m}
                className="flex-1 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-700 to-cyan-600 text-white hover:from-violet-600 hover:to-cyan-500 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-violet-900/20">
                💾 Hamming Kodla &amp; Belleğe Yaz
              </button>
            </div>

            {/* m / r / n istatistikleri */}
            {enc && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  ['m', m,     'Veri Biti',   'text-cyan-400'],
                  ['r', enc.r, 'Parity Biti', 'text-rose-400'],
                  ['n', enc.n, 'Codeword',    'text-violet-400'],
                ].map(([k, v, lbl, col]) => (
                  <div key={k} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/50 text-center">
                    <span className="text-[10px] text-slate-700 font-mono block">{k} =</span>
                    <span className={`text-2xl font-bold font-mono ${col}`}>{v}</span>
                    <span className="text-[10px] text-slate-700 block mt-0.5">{lbl}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ══ §2: HAMMING CODE GÖRSELİ ════════════════════════════════════ */}
        {enc && (
          <Card n="2" title="Hamming Code Görselleştirme"
            sub={`${enc.n}-bit codeword = ${enc.r} parity + ${m} data biti`} done={step >= 2}>
            {/* Renk açıklaması */}
            <div className="flex flex-wrap gap-3 mb-4">
              {[
                ['bg-cyan-500/10 border-cyan-500/40',    '◆ Veri Biti (D)'],
                ['bg-rose-500/10 border-rose-500/50',    '⬡ Parity Biti (P — 2ᵏ)'],
                ['bg-amber-500/10 border-amber-400',     '⚡ Hatalı Bit'],
                ['bg-emerald-500/10 border-emerald-400', '✓ Düzeltilmiş'],
              ].map(([cls, lbl]) => (
                <div key={lbl} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded border-2 ${cls}`} />
                  <span className="text-xs text-slate-600">{lbl}</span>
                </div>
              ))}
            </div>

            {/* Bit ızgarası */}
            <BitGrid cw={displayCW} pp={enc.pp} errPos={showErr} fixPos={showFix} m={m} />

            {/* ── Codeword özeti ── */}
            <div className="mt-3 text-center text-[11px] font-mono space-x-2 text-slate-700">
              <span>Toplam: <span className="text-violet-400 font-bold">{enc.n}</span> bit</span>
              <span>·</span>
              <span><span className="text-cyan-400 font-bold">{m}</span> data</span>
              <span>+</span>
              <span><span className="text-rose-400 font-bold">{enc.r}</span> parity</span>
              {showErr && (
                <>
                  <span>·</span>
                  <span className="text-amber-500">⚡ Hata @pos{showErr}</span>
                </>
              )}
              {showFix && (
                <>
                  <span>·</span>
                  <span className="text-emerald-500">✓ Düzeltildi @pos{showFix}</span>
                </>
              )}
            </div>

            {/* Parity bit değerleri */}
            <div className="mt-3 bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
              <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider mb-2.5">Parity Bit Değerleri</p>
              <div className="flex flex-wrap gap-2">
                {enc.pp.map((p) => (
                  <div key={p} className="flex items-center gap-1.5 bg-rose-500/5 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] text-rose-600 font-mono">P{p}</span>
                    <span className="text-sm font-bold font-mono text-rose-400">{enc.pv[p]}</span>
                    <span className="text-[10px] text-slate-700">@pos{p}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-800 font-mono">
                2^{enc.r} = {1 << enc.r} ≥ m+r+1 = {m + enc.r + 1} ✓ &nbsp;·&nbsp; Parity pozisyonları: [{enc.pp.join(', ')}]
              </p>
            </div>
          </Card>
        )}

        {/* ══ §3: HATA ENJEKSİYONU ════════════════════════════════════════ */}
        {enc && step >= 1 && (
          <Card n="3" title="Hata Enjeksiyonu"
            sub="Herhangi bir biti 0→1 veya 1→0 flip et (tek bitlik hata simülasyonu)" done={step >= 2}>
            <div className="space-y-3">
              {/* Slider + değer göstergesi */}
              <div className="flex items-center gap-4">
                <input id="error-pos-slider" type="range" min={1} max={enc.n} value={ePos}
                  onChange={(e) => setEPos(+e.target.value)}
                  aria-label="Hata bit pozisyonu seçici"
                  className="flex-1 cursor-pointer" />
                <div className="shrink-0 text-center w-16">
                  <div className="font-mono font-bold text-2xl text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl py-1 leading-none">{ePos}</div>
                  <div className="text-[9px] text-slate-700 mt-1 font-mono">{enc.pp.includes(ePos) ? 'Parity' : 'Data'}</div>
                </div>
              </div>

              {/* Önizleme */}
              <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-3 border border-slate-800/50">
                <div className="text-xs text-slate-600 font-mono">Pozisyon {ePos}:</div>
                <div className="font-mono font-bold text-slate-400 bg-slate-800/60 rounded-lg px-2.5 py-1 text-sm">{displayCW[ePos - 1]}</div>
                <div className="text-slate-600">→</div>
                <div className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1 text-sm">
                  {displayCW[ePos - 1] === '0' ? '1' : '0'}
                </div>
                <div className="text-xs text-slate-700 font-mono">(XOR 1)</div>
                <div className="ml-auto text-xs text-slate-600 font-mono">{enc.pp.includes(ePos) ? '⬡ Parity biti' : '◆ Veri biti'}</div>
              </div>

              <button id="btn-inject" onClick={handleInject}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 transition-all duration-200 shadow-lg shadow-amber-900/20">
                ⚡ Pozisyon {ePos}'de Hata Oluştur
              </button>
            </div>
          </Card>
        )}

        {/* ══ §4 & 5: SENDROM & DÜZELTME ══════════════════════════════════ */}
        {step >= 2 && (
          <Card n="4" title="Sendrom Hesaplama &amp; Hata Düzeltme"
            sub="Parity bitleri yeniden hesapla → XOR → sendrom → hata pozisyonu" done={step >= 4}>

            {step < 3 ? (
              <button id="btn-syndrome" onClick={handleSyndrome}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-700 to-violet-600 text-white hover:from-purple-600 hover:to-violet-500 transition-all duration-200">
                🔍 Sendromu Hesapla
              </button>
            ) : (
              <div className="space-y-4">

                {/* Sendrom & Hatalı Bit özet kartları */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                    <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider mb-2">Sendrom</p>
                    <div className={`text-4xl font-bold font-mono leading-none ${syn.s === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {syn.s}
                    </div>
                    <p className="text-xs text-slate-700 font-mono mt-2">
                      {syn.s.toString(2).padStart(enc.r, '0')}<span className="text-slate-800">₂</span>
                    </p>
                  </div>

                  <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-800/60">
                    <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider mb-2">
                      {syn.errPos ? 'Hatalı Bit' : 'Durum'}
                    </p>
                    {syn.errPos ? (
                      <>
                        <div className="text-4xl font-bold font-mono text-amber-400 leading-none">#{syn.errPos}</div>
                        <p className="text-xs text-slate-700 mt-2">pozisyon {syn.errPos} bozulmuş</p>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold font-mono text-emerald-400 mt-2 leading-none">Hata Yok</div>
                        <p className="text-xs text-emerald-800 mt-2">Sendrom = 0</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Parity Kontrol Matrisi tablosu */}
                <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-900/80">
                    <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider">
                      Parity Kontrol Matrisi — S_k = XOR(kapsanan tüm pozisyonlar)
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full" role="table" aria-label="Sendrom parity kontrol tablosu">
                      <thead>
                        <tr className="border-b border-slate-900">
                          {enc.pp.map((p) => (
                            <th key={p} scope="col" className="px-3 py-2 text-[10px] font-mono text-slate-700 font-normal text-center">S{p}</th>
                          ))}
                          <th scope="col" className="px-3 py-2 text-[10px] font-mono text-slate-700 font-normal text-center border-l border-slate-900">Binary</th>
                          <th scope="col" className="px-3 py-2 text-[10px] font-mono text-slate-700 font-normal text-center">= Sendrom</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {enc.pp.map((p) => (
                            <td key={p} className={`px-3 py-3 text-center font-mono font-bold text-xl transition-colors duration-200 ${
                              syn.checks[p] ? 'text-rose-400' : 'text-emerald-600/60'
                            }`}>
                              {syn.checks[p]}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center font-mono text-violet-400 text-sm border-l border-slate-900">
                            {syn.s.toString(2).padStart(enc.r, '0')}
                          </td>
                          <td className={`px-3 py-3 text-center font-mono font-bold text-xl ${syn.s ? 'text-amber-400' : 'text-emerald-600/60'}`}>
                            {syn.s}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Düzelt butonu */}
                {syn.errPos && !fixed && (
                  <button id="btn-fix" onClick={handleFix}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-700 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-500 transition-all duration-200 shadow-lg shadow-emerald-900/20">
                    ✨ Pozisyon {syn.errPos}'deki Biti Düzelt
                  </button>
                )}

                {/* Hata yok mesajı */}
                {!syn.errPos && (
                  <div className="flex items-center gap-3 p-4 border border-emerald-800/30 rounded-xl bg-emerald-500/5">
                    <span className="text-2xl text-emerald-400">✓</span>
                    <div>
                      <p className="text-emerald-400 font-semibold text-sm">Codeword Sağlıklı</p>
                      <p className="text-xs text-slate-700">Sendrom = 0, tüm parity kontrolleri geçti</p>
                    </div>
                  </div>
                )}

                {/* Düzeltme sonucu */}
                {fixed && (
                  <div className="border border-emerald-500/20 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-base">✓</span>
                      <span className="text-emerald-400 font-semibold text-sm">Hata Düzeltildi — Veri Kurtarıldı</span>
                    </div>
                    <div className="p-4 space-y-2.5">
                      {[
                        ['Orijinal Giriş',  input,                 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25'],
                        ['Kurtarılan Veri', extractData(fixed, m), 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'],
                      ].map(([lbl, val, cls]) => (
                        <div key={lbl} className="flex flex-wrap items-center gap-3">
                          <span className="text-xs text-slate-600 w-28 shrink-0">{lbl}:</span>
                          <code className={`font-mono text-sm px-3 py-1 rounded-lg border tracking-widest ${cls}`}>{val}</code>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-slate-800/50" role="status">
                        {extractData(fixed, m) === input
                          ? <p className="text-emerald-400 text-sm font-semibold">✓ Tam eşleşme — {m}-bit veri eksiksiz kurtarıldı</p>
                          : <p className="text-rose-400 text-sm font-semibold">✗ Eşleşmiyor</p>
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
        <footer className="text-center py-5 text-[10px] text-slate-800 font-mono border-t border-slate-900">
          Hamming Error-Correcting Code Simülatörü · SEC · 8 / 16 / 32-bit · R.W. Hamming (1950)
        </footer>
      </main>
    </div>
  );
}
