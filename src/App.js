import { useState, useEffect, useRef, useCallback } from "react";

// ─── STYLE SYSTEM ────────────────────────────────────────────────────────────

const C = {
  bg: "#07090F",
  surface: "rgba(255,255,255,0.045)",
  surfaceHover: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.08)",
  borderGlow: "rgba(99,179,255,0.35)",
  accent: "#5B9FFF",
  accentPurple: "#9B7FFF",
  accentGreen: "#4FFFB0",
  accentRed: "#FF5B7A",
  accentAmber: "#FFB347",
  text: "#E8EAF4",
  textMuted: "rgba(232,234,244,0.45)",
  textDim: "rgba(232,234,244,0.25)",
};

const glassCard = (extra = {}) => ({
  background: C.surface,
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  ...extra,
});

const btn = (color = C.accent, extra = {}) => ({
  background: `linear-gradient(135deg, ${color}22, ${color}11)`,
  border: `1px solid ${color}55`,
  color: C.text,
  borderRadius: 14,
  padding: "14px 32px",
  fontSize: 15,
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.02em",
  transition: "all 0.18s ease",
  outline: "none",
  ...extra,
});

// ─── QUESTION LOGIC ENGINE ───────────────────────────────────────────────────

const MOTIVATIONAL = [
  "Stay sharp.", "Faster than before.", "You're in the zone.",
  "Trust the process.", "Numbers bend to the mind.", "Keep the streak alive.",
  "Precision is power.", "Every rep counts.", "Don't blink.",
];

function getDifficultyLevel(streak) {
  if (streak < 5) return 0;
  if (streak < 10) return 1;
  if (streak < 20) return 2;
  if (streak < 35) return 3;
  return 4;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion(streak, mode) {
  const diff = getDifficultyLevel(streak);

  const templates = [
    // Level 0 – warm-up
    () => { const a = rand(2,9), b = rand(2,9); return { q:`${a} × ${b}`, a:a*b, type:"mult" }; },
    () => { const a = rand(10,30), b = rand(2,5); return { q:`${a} × ${b}`, a:a*b, type:"mult" }; },
    () => { const a = rand(10,99); return { q:`${a} + ${a}`, a:a*2, type:"add" }; },
    () => { const a = rand(20,99), b = rand(10,30); return { q:`${a} + ${b}`, a:a+b, type:"add" }; },

    // Level 1 – building speed
    () => { const a = rand(11,25), b = rand(11,25); return { q:`${a} × ${b}`, a:a*b, type:"mult" }; },
    () => { const pcts=[5,10,15,20,25,50]; const p=pcts[rand(0,pcts.length-1)]; const base=rand(2,20)*10; return { q:`${p}% of ${base}`, a:(p/100)*base, type:"pct" }; },
    () => { const a=rand(50,200), b=rand(10,50); return { q:`${a} − ${b}`, a:a-b, type:"sub" }; },

    // Level 2 – multiplication shortcuts
    () => { const a = rand(15,50)*2; return { q:`25 × ${a}`, a:25*a, type:"mult" }; },
    () => { const a = [48,52,36,44,64,72,96][rand(0,6)]; return { q:`${a} × 12`, a:a*12, type:"mult" }; },
    () => { const pcts=[15,12,18,22,35]; const p=pcts[rand(0,pcts.length-1)]; const base=rand(4,30)*10; return { q:`${p}% of ${base}`, a:Math.round((p/100)*base), type:"pct" }; },

    // Level 3 – approximation & chains
    () => {
      const a=rand(98,102)*rand(18,22);
      const ra=rand(97,103), rb=rand(18,22);
      const exact=ra*rb;
      return { q:`${ra} × ${rb} ≈ ?`, a:Math.round(exact/5)*5, tolerance:exact*0.04, type:"approx" };
    },
    () => { const a=rand(100,500), r=rand(3,9)/100; return { q:`${a} × 1.0${r*100 < 10 ? '0'+(r*100) : r*100}`, a:Math.round(a*(1+r)), tolerance:1, type:"mult" }; },
    () => {
      const a=rand(200,900), b=rand(50,200);
      return { q:`${a} + ${b} + ${rand(10,99)}`, a:0, _compute:true,
        _val: (() => { const c=rand(10,99); return { q:`${a} + ${b} + ${c}`, a:a+b+c }; })()
      };
    },

    // Level 4 – elite
    () => {
      const a=rand(20,99), b=rand(20,99);
      const exact=a*b;
      return { q:`${a} × ${b}`, a:exact, type:"mult" };
    },
    () => {
      const base=rand(300,900), pct=rand(13,37);
      return { q:`${pct}% of ${base}`, a:Math.round(base*pct/100), tolerance:2, type:"pct" };
    },
  ];

  let pool;
  if (diff === 0) pool = templates.slice(0, 4);
  else if (diff === 1) pool = templates.slice(0, 7);
  else if (diff === 2) pool = templates.slice(2, 10);
  else if (diff === 3) pool = templates.slice(4, 13);
  else pool = templates.slice(7);

  // Mode bias
  if (mode === "accuracy") pool = pool.concat(pool); // pure accuracy, any
  
  let q = pool[rand(0, pool.length - 1)]();
  if (q._compute) q = q._val;
  if (!q.tolerance) q.tolerance = 0;
  return q;
}

function getTimerDuration(streak, timerSpeed) {
  const base = timerSpeed === "slow" ? 14 : timerSpeed === "insane" ? 5 : 9;
  const reduction = Math.min(Math.floor(streak / 5) * 0.6, 4);
  return Math.max(base - reduction, timerSpeed === "insane" ? 2.5 : 4);
}

// ─── PARTICLES BACKGROUND ────────────────────────────────────────────────────

function ParticleField({ glowIntensity }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = glowIntensity === "minimal" ? 18 : glowIntensity === "intense" ? 55 : 32;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      alpha: Math.random() * 0.4 + 0.1,
      color: Math.random() > 0.5 ? C.accent : C.accentPurple,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [glowIntensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.6 }}
    />
  );
}

// ─── STREAK CELEBRATION ──────────────────────────────────────────────────────

function CelebrationBurst({ show }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!visible) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        const colors = [C.accent, C.accentPurple, C.accentGreen, C.accentAmber];
        return (
          <div key={i} style={{
            position: "absolute",
            width: 8, height: 8,
            borderRadius: "50%",
            background: colors[i % colors.length],
            animation: `burst-${i} 1.1s ease-out forwards`,
            transform: `rotate(${angle}deg)`,
          }} />
        );
      })}
      <div style={{ fontSize: 40, animation: "pop 0.6s ease-out" }}>🔥</div>
    </div>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({ onStart, settings, setSettings, stats }) {
  const [hovered, setHovered] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const motiveIdx = useRef(Math.floor(Math.random() * MOTIVATIONAL.length));

  const modes = [
    { id: "speed", label: "Speed", icon: "⚡", desc: "Race against the clock" },
    { id: "accuracy", label: "Accuracy", icon: "🎯", desc: "Precision over pace" },
    { id: "mixed", label: "Mixed", icon: "🌀", desc: "Adaptive challenge" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", position: "relative", zIndex: 1 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.3em", color: C.accent, textTransform: "uppercase", marginBottom: 14, fontWeight: 600 }}>
          Mental Math
        </div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(44px,8vw,72px)", fontWeight: 400, margin: 0, background: `linear-gradient(135deg, ${C.text} 0%, ${C.accentPurple} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1 }}>
          Sharpen
        </h1>
        <div style={{ color: C.textMuted, fontSize: 15, marginTop: 10, fontStyle: "italic" }}>
          {MOTIVATIONAL[motiveIdx.current]}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
        {[
          { label: "Best Streak", value: stats.bestStreak, icon: "🔥" },
          { label: "Accuracy", value: stats.totalAttempts > 0 ? `${Math.round((stats.totalCorrect / stats.totalAttempts) * 100)}%` : "—", icon: "🎯" },
          { label: "Solved", value: stats.totalAttempts, icon: "✓" },
        ].map((s) => (
          <div key={s.label} style={{ ...glassCard({ padding: "16px 22px", textAlign: "center", minWidth: 90 }) }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'DM Serif Display', serif" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.05em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mode Selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 36, flexWrap: "wrap", justifyContent: "center" }}>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setSettings((s) => ({ ...s, mode: m.id }))}
            onMouseEnter={() => setHovered(m.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              ...glassCard({
                padding: "14px 22px",
                cursor: "pointer",
                border: settings.mode === m.id ? `1px solid ${C.accent}88` : `1px solid ${C.border}`,
                background: settings.mode === m.id ? `${C.accent}15` : C.surface,
                transform: hovered === m.id ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
                transition: "all 0.18s ease",
                outline: "none",
              }),
              textAlign: "center",
              minWidth: 110,
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: settings.mode === m.id ? C.accent : C.text }}>{m.label}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Start Button */}
      <button
        onClick={onStart}
        onMouseEnter={() => setHovered("start")}
        onMouseLeave={() => setHovered(null)}
        style={{
          ...btn(C.accent, {
            padding: "18px 64px",
            fontSize: 17,
            borderRadius: 18,
            background: hovered === "start" ? `linear-gradient(135deg, ${C.accent}33, ${C.accentPurple}22)` : `linear-gradient(135deg, ${C.accent}22, ${C.accent}11)`,
            boxShadow: hovered === "start" ? `0 0 40px ${C.accent}44, 0 8px 32px rgba(0,0,0,0.4)` : `0 4px 20px rgba(0,0,0,0.3)`,
            transform: hovered === "start" ? "scale(1.03)" : "scale(1)",
            transition: "all 0.2s ease",
          }),
          marginBottom: 28,
        }}
      >
        Start Training
      </button>

      {/* Settings Toggle */}
      <button
        onClick={() => setSettingsOpen((v) => !v)}
        style={{ ...btn(C.textDim, { padding: "10px 24px", fontSize: 13, color: C.textMuted, background: "transparent", border: `1px solid ${C.border}` }) }}
      >
        {settingsOpen ? "Hide Settings ↑" : "Settings ↓"}
      </button>

      {/* Settings Panel */}
      <div style={{
        ...glassCard({ padding: settingsOpen ? "28px 32px" : "0 32px", marginTop: 16, width: "100%", maxWidth: 420, overflow: "hidden" }),
        maxHeight: settingsOpen ? 300 : 0,
        opacity: settingsOpen ? 1 : 0,
        transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <SettingsPanel settings={settings} setSettings={setSettings} />
      </div>
    </div>
  );
}

function SettingsPanel({ settings, setSettings }) {
  const Row = ({ label, children }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <span style={{ fontSize: 14, color: C.textMuted }}>{label}</span>
      <div style={{ display: "flex", gap: 8 }}>{children}</div>
    </div>
  );

  const Chip = ({ value, current, field, label }) => (
    <button
      onClick={() => setSettings((s) => ({ ...s, [field]: value }))}
      style={{
        ...btn(current === value ? C.accent : C.textDim, {
          padding: "7px 16px", fontSize: 12, borderRadius: 10,
          background: current === value ? `${C.accent}20` : "transparent",
          border: current === value ? `1px solid ${C.accent}55` : `1px solid ${C.border}`,
          color: current === value ? C.accent : C.textMuted,
        }),
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <Row label="Timer Speed">
        <Chip value="slow" current={settings.timerSpeed} field="timerSpeed" label="Slow" />
        <Chip value="normal" current={settings.timerSpeed} field="timerSpeed" label="Normal" />
        <Chip value="insane" current={settings.timerSpeed} field="timerSpeed" label="Insane" />
      </Row>
      <Row label="Glow">
        <Chip value="minimal" current={settings.glowIntensity} field="glowIntensity" label="Minimal" />
        <Chip value="normal" current={settings.glowIntensity} field="glowIntensity" label="Normal" />
        <Chip value="intense" current={settings.glowIntensity} field="glowIntensity" label="Intense" />
      </Row>
      <Row label="Sound">
        <Chip value={true} current={settings.sound} field="sound" label="On" />
        <Chip value={false} current={settings.sound} field="sound" label="Off" />
      </Row>
    </div>
  );
}

// ─── GAME SCREEN ─────────────────────────────────────────────────────────────

function GameScreen({ settings, onEnd, stats, setStats }) {
  const [question, setQuestion] = useState(() => generateQuestion(0, settings.mode));
  const [input, setInput] = useState("");
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | "almost"
  const [timerProgress, setTimerProgress] = useState(1);
  const [timerDuration, setTimerDuration] = useState(() => getTimerDuration(0, settings.timerSpeed));
  const [celebration, setCelebration] = useState(false);
  const [questionAnim, setQuestionAnim] = useState("in");
  const [motiveLine, setMotiveLine] = useState(MOTIVATIONAL[0]);

  const timerRef = useRef(null);
  const timerStartRef = useRef(Date.now());
  const inputRef = useRef(null);
  const streakRef = useRef(0);
  const attemptsRef = useRef({ total: stats.totalAttempts, correct: stats.totalCorrect });

  // Sound helpers
  const playTone = useCallback((freq, dur, type = "sine", vol = 0.12) => {
    if (!settings.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch {}
  }, [settings.sound]);

  const startTimer = useCallback((duration) => {
    clearInterval(timerRef.current);
    timerStartRef.current = Date.now();
    setTimerProgress(1);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - timerStartRef.current) / 1000;
      const progress = Math.max(0, 1 - elapsed / duration);
      setTimerProgress(progress);
      if (progress <= 0) {
        clearInterval(timerRef.current);
        handleTimeout();
      }
    }, 30);
  }, []);

  const loadNextQuestion = useCallback((newStreak) => {
    setQuestionAnim("out");
    setTimeout(() => {
      const next = generateQuestion(newStreak, settings.mode);
      const dur = getTimerDuration(newStreak, settings.timerSpeed);
      setQuestion(next);
      setInput("");
      setFeedback(null);
      setTimerDuration(dur);
      setMotiveLine(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
      setQuestionAnim("in");
      startTimer(dur);
      if (inputRef.current) inputRef.current.focus();
    }, 220);
  }, [settings, startTimer]);

  const handleTimeout = useCallback(() => {
    playTone(180, 0.4, "sawtooth");
    setFeedback("wrong");
    attemptsRef.current.total++;
    setStats((s) => ({ ...s, totalAttempts: attemptsRef.current.total }));
    streakRef.current = 0;
    setStreak(0);
    setTimeout(() => loadNextQuestion(0), 700);
  }, [playTone, loadNextQuestion, setStats]);

  useEffect(() => {
    const dur = getTimerDuration(0, settings.timerSpeed);
    setTimerDuration(dur);
    startTimer(dur);
    if (inputRef.current) inputRef.current.focus();
    return () => clearInterval(timerRef.current);
  }, []);

  const handleSubmit = useCallback(() => {
    const val = parseFloat(input);
    if (isNaN(val)) return;

    clearInterval(timerRef.current);
    attemptsRef.current.total++;

    const diff = Math.abs(val - question.a);
    const isCorrect = diff <= question.tolerance;
    const isAlmost = !isCorrect && diff <= Math.max(question.tolerance + 2, question.a * 0.05);

    if (isCorrect) {
      playTone(520, 0.18);
      setTimeout(() => playTone(680, 0.15), 90);
      attemptsRef.current.correct++;
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      setStreak(newStreak);
      setFeedback("correct");

      const newBest = Math.max(newStreak, stats.bestStreak);
      setStats((s) => ({
        ...s,
        bestStreak: newBest,
        totalAttempts: attemptsRef.current.total,
        totalCorrect: attemptsRef.current.correct,
      }));

      if (newStreak > 0 && newStreak % 10 === 0) {
        setCelebration(true);
        setTimeout(() => setCelebration(false), 1300);
        playTone(880, 0.3);
        setTimeout(() => playTone(1100, 0.25), 120);
      }

      setTimeout(() => loadNextQuestion(newStreak), 400);
    } else if (isAlmost) {
      playTone(260, 0.25, "triangle");
      setFeedback("almost");
      streakRef.current = 0;
      setStreak(0);
      setStats((s) => ({ ...s, totalAttempts: attemptsRef.current.total }));
      setTimeout(() => loadNextQuestion(0), 900);
    } else {
      playTone(180, 0.4, "sawtooth");
      setFeedback("wrong");
      streakRef.current = 0;
      setStreak(0);
      setStats((s) => ({ ...s, totalAttempts: attemptsRef.current.total }));
      setTimeout(() => loadNextQuestion(0), 700);
    }
  }, [input, question, playTone, stats, setStats, loadNextQuestion]);

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const timerColor = timerProgress > 0.5 ? C.accent : timerProgress > 0.25 ? C.accentAmber : C.accentRed;
  const diff = getDifficultyLevel(streak);
  const diffLabels = ["Warm Up", "Building", "Sharp", "Elite", "God Mode"];
  const diffColors = [C.textMuted, C.accent, C.accentGreen, C.accentAmber, C.accentRed];

  const cardStyle = {
    ...glassCard({ padding: "48px 52px", maxWidth: 520, width: "100%", position: "relative" }),
    boxShadow: feedback === "correct"
      ? `0 0 60px ${C.accentGreen}33, 0 16px 48px rgba(0,0,0,0.5)`
      : feedback === "wrong"
      ? `0 0 60px ${C.accentRed}33, 0 16px 48px rgba(0,0,0,0.5)`
      : `0 16px 48px rgba(0,0,0,0.45)`,
    animation: feedback === "wrong" ? "shake 0.35s ease" : "none",
    transform: questionAnim === "out" ? "translateY(10px)" : "translateY(0)",
    opacity: questionAnim === "out" ? 0 : 1,
    transition: "opacity 0.2s ease, transform 0.2s ease, box-shadow 0.3s ease",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24, position: "relative", zIndex: 1 }}>
      <CelebrationBurst show={celebration} />

      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 520, marginBottom: 20 }}>
        <button onClick={onEnd} style={{ ...btn(C.textDim, { padding: "8px 16px", fontSize: 13, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted }) }}>
          ← Exit
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: diffColors[diff], fontWeight: 600, letterSpacing: "0.05em" }}>{diffLabels[diff]}</span>
          <div style={{ ...glassCard({ padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }) }}>
            <span style={{ fontSize: 16 }}>🔥</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: streak > 0 ? C.accentAmber : C.textMuted, fontFamily: "'DM Serif Display', serif", minWidth: 28, textAlign: "center" }}>
              {streak}
            </span>
          </div>
        </div>
      </div>

      {/* Timer Bar */}
      <div style={{ width: "100%", maxWidth: 520, height: 3, background: C.surface, borderRadius: 3, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${timerProgress * 100}%`,
          background: `linear-gradient(90deg, ${timerColor}, ${timerColor}88)`,
          borderRadius: 3,
          transition: "width 0.03s linear, background 0.3s ease",
          boxShadow: timerProgress > 0.1 ? `0 0 8px ${timerColor}88` : "none",
        }} />
      </div>

      {/* Main Card */}
      <div style={cardStyle}>
        {/* Motivational line */}
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: C.textDim, textTransform: "uppercase", textAlign: "center", marginBottom: 32 }}>
          {motiveLine}
        </div>

        {/* Question */}
        <div style={{
          textAlign: "center",
          fontSize: "clamp(36px,8vw,58px)",
          fontFamily: "'DM Serif Display', serif",
          fontWeight: 400,
          color: feedback === "correct" ? C.accentGreen : feedback === "wrong" ? C.accentRed : C.text,
          marginBottom: 40,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          transition: "color 0.2s ease",
          minHeight: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {question.q}
        </div>

        {/* Input */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <input
            ref={inputRef}
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="?"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${feedback === "correct" ? C.accentGreen + "88" : feedback === "wrong" ? C.accentRed + "88" : C.border}`,
              borderRadius: 14,
              padding: "18px 24px",
              fontSize: 28,
              fontFamily: "'DM Serif Display', serif",
              color: C.text,
              outline: "none",
              textAlign: "center",
              letterSpacing: "0.05em",
              boxSizing: "border-box",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              boxShadow: feedback === "correct" ? `0 0 20px ${C.accentGreen}33` : "none",
              MozAppearance: "textfield",
            }}
            disabled={!!feedback}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!input || !!feedback}
          style={{
            ...btn(C.accent, {
              width: "100%",
              padding: "16px",
              fontSize: 16,
              borderRadius: 14,
              background: input && !feedback ? `linear-gradient(135deg, ${C.accent}28, ${C.accentPurple}18)` : "transparent",
              border: input && !feedback ? `1px solid ${C.accent}55` : `1px solid ${C.border}`,
              color: input && !feedback ? C.text : C.textDim,
              transition: "all 0.15s ease",
            }),
          }}
        >
          Confirm →
        </button>

        {/* Feedback hint */}
        {feedback === "almost" && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.accentAmber }}>
            Close! Answer was {question.a}
          </div>
        )}
        {feedback === "wrong" && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.accentRed }}>
            Answer: {question.a}
          </div>
        )}
      </div>

      {/* Bottom stats */}
      <div style={{ display: "flex", gap: 20, marginTop: 20, fontSize: 12, color: C.textDim }}>
        <span>Best: {stats.bestStreak}🔥</span>
        <span>Solved: {stats.totalAttempts}</span>
        {stats.totalAttempts > 0 && <span>Accuracy: {Math.round((stats.totalCorrect / stats.totalAttempts) * 100)}%</span>}
      </div>
    </div>
  );
}

// ─── CSS INJECTOR ─────────────────────────────────────────────────────────────

function injectStyles() {
  const id = "sharpen-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #07090F; color: #E8EAF4; font-family: 'DM Sans', sans-serif; overflow-x: hidden; }
    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-5px); }
      80% { transform: translateX(5px); }
    }
    @keyframes pop {
      0% { transform: scale(0.5); opacity: 0; }
      60% { transform: scale(1.3); }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("home");
  const [settings, setSettings] = useState({
    mode: "mixed",
    timerSpeed: "normal",
    glowIntensity: "normal",
    sound: true,
  });
  const [stats, setStats] = useState(() => {
    try {
      return {
        bestStreak: parseInt(localStorage.getItem("sharpen_bestStreak") || "0"),
        totalAttempts: parseInt(localStorage.getItem("sharpen_totalAttempts") || "0"),
        totalCorrect: parseInt(localStorage.getItem("sharpen_totalCorrect") || "0"),
      };
    } catch {
      return { bestStreak: 0, totalAttempts: 0, totalCorrect: 0 };
    }
  });

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sharpen_bestStreak", stats.bestStreak);
      localStorage.setItem("sharpen_totalAttempts", stats.totalAttempts);
      localStorage.setItem("sharpen_totalCorrect", stats.totalCorrect);
    } catch {}
  }, [stats]);

  const bgStyle = {
    minHeight: "100vh",
    background: `radial-gradient(ellipse at 20% 20%, ${C.accentPurple}0F 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, ${C.accent}0A 0%, transparent 55%), ${C.bg}`,
    position: "relative",
  };

  return (
    <div style={bgStyle}>
      <ParticleField glowIntensity={settings.glowIntensity} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {screen === "home" && (
          <HomeScreen
            onStart={() => setScreen("game")}
            settings={settings}
            setSettings={setSettings}
            stats={stats}
          />
        )}
        {screen === "game" && (
          <GameScreen
            settings={settings}
            onEnd={() => setScreen("home")}
            stats={stats}
            setStats={setStats}
          />
        )}
      </div>
    </div>
  );
}