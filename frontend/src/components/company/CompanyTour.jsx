import { useState, useEffect, useCallback } from 'react';

const TOUR_KEY = 'ladderstep_company_tour_v1';
const PAD = 10;

const STEPS = [
    {
        target: null,
        title: 'Welcome to LadderStep 🎉',
        body: "Your company hiring portal is all set. This quick tour walks you through everything — takes about 30 seconds. Let's go!",
    },
    {
        target: '[data-tour="talent-pool"]',
        title: '👥 Talent Pool',
        body: 'Browse our pre-screened candidate database. Purchase an unlock package to reveal contact details, download resumes, and pull the best fits into your hiring pipeline.',
    },
    {
        target: '[data-tour="job-postings"]',
        title: '💼 Job Postings',
        body: 'Post your open roles here. LadderStep executives will actively source and assign matching candidates to each job description you create.',
    },
    {
        target: '[data-tour="shortlist"]',
        title: '⭐ Applications & Shortlist',
        body: 'All candidates assigned to your jobs appear here — including those sourced by our team. Unlock a profile first, then shortlist and track them through your pipeline.',
    },
    {
        target: '[data-tour="interviews"]',
        title: '🗓 Interviews',
        body: 'Request an interview for any shortlisted candidate. Our team coordinates timing, confirms the slot, and handles all communication with the candidate.',
    },
    {
        target: '[data-tour="offers"]',
        title: '📨 Offers',
        body: 'After a successful interview, raise an offer through the portal. Our executives manage acceptance, documentation, and follow-up.',
    },
    {
        target: '[data-tour="payments"]',
        title: '💳 Packages & Payments',
        body: 'Start with the 5-Resume Pack (₹3,999) to unlock 5 candidate profiles. Once active, top up with a Single (₹999) or another pack anytime. Or enquire about Platinum for unlimited access with a placement fee only at hire.',
    },
    {
        target: '[data-tour="help"]',
        title: '❓ Help & Full Guide',
        body: "Your complete step-by-step portal guide is always one click away. You can also retake this tour anytime from the Help page. That's it — happy hiring!",
    },
];

export default function CompanyTour() {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(false);
    const [rect, setRect] = useState(null);
    const [fadeIn, setFadeIn] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem(TOUR_KEY)) {
            // Small delay so the layout fully renders before we measure elements
            const t = setTimeout(() => setVisible(true), 600);
            return () => clearTimeout(t);
        }
    }, []);

    useEffect(() => {
        const handler = () => {
            localStorage.removeItem(TOUR_KEY);
            setStep(0);
            setVisible(true);
        };
        window.addEventListener('company-tour-restart', handler);
        return () => window.removeEventListener('company-tour-restart', handler);
    }, []);

    // Remeasure the spotlight target on each step change
    useEffect(() => {
        if (!visible) return;
        setFadeIn(false);
        const tid = setTimeout(() => setFadeIn(true), 30);

        const target = STEPS[step]?.target;
        if (!target) { setRect(null); return () => clearTimeout(tid); }

        const measure = () => {
            const el = document.querySelector(target);
            if (el) {
                const r = el.getBoundingClientRect();
                setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
            } else {
                setRect(null);
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => { clearTimeout(tid); window.removeEventListener('resize', measure); };
    }, [step, visible]);

    const finish = useCallback(() => {
        localStorage.setItem(TOUR_KEY, '1');
        setVisible(false);
    }, []);

    const goNext = useCallback(() => {
        if (step < STEPS.length - 1) setStep(s => s + 1);
        else finish();
    }, [step, finish]);

    const goPrev = useCallback(() => {
        if (step > 0) setStep(s => s - 1);
    }, [step]);

    if (!visible) return null;

    const current = STEPS[step];
    const isFirst = step === 0;
    const isLast = step === STEPS.length - 1;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const sp = rect && !isMobile ? {
        top:    Math.max(0, rect.top - PAD),
        left:   Math.max(0, rect.left - PAD),
        right:  Math.min(window.innerWidth,  rect.left + rect.width  + PAD),
        bottom: Math.min(window.innerHeight, rect.top  + rect.height + PAD),
    } : null;

    // Tooltip: to the right of the sidebar spotlight; fall back to centered
    const TOOLTIP_W = 300;
    let tooltipStyle;
    if (!sp) {
        tooltipStyle = {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: Math.min(340, window.innerWidth - 32),
        };
    } else {
        const leftCandidate = sp.right + 20;
        const fitsRight = leftCandidate + TOOLTIP_W < window.innerWidth - 16;
        tooltipStyle = fitsRight
            ? { position: 'fixed', top: Math.max(16, sp.top - 4), left: leftCandidate, width: TOOLTIP_W }
            : { position: 'fixed', top: sp.bottom + 16, left: Math.max(16, sp.left), width: TOOLTIP_W };
    }

    const overlayColor = 'rgba(10,10,20,0.74)';
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <>
            {/* Dark overlay — four panels around the spotlight */}
            {sp ? (
                <>
                    <div style={{ position:'fixed', top:0, left:0, right:0, height:sp.top, background:overlayColor, zIndex:9990, pointerEvents:'none' }} />
                    <div style={{ position:'fixed', top:sp.bottom, left:0, right:0, bottom:0, background:overlayColor, zIndex:9990, pointerEvents:'none' }} />
                    <div style={{ position:'fixed', top:sp.top, left:0, width:sp.left, height:sp.bottom-sp.top, background:overlayColor, zIndex:9990, pointerEvents:'none' }} />
                    <div style={{ position:'fixed', top:sp.top, left:sp.right, right:0, height:sp.bottom-sp.top, background:overlayColor, zIndex:9990, pointerEvents:'none' }} />
                    {/* Spotlight ring */}
                    <div style={{
                        position:'fixed', top:sp.top, left:sp.left,
                        width:sp.right-sp.left, height:sp.bottom-sp.top,
                        borderRadius:10,
                        border:'2px solid rgba(99,102,241,0.85)',
                        boxShadow:'0 0 0 4px rgba(99,102,241,0.18)',
                        zIndex:9991, pointerEvents:'none',
                        transition:'all 0.25s cubic-bezier(.4,0,.2,1)',
                    }} />
                </>
            ) : (
                <div style={{ position:'fixed', inset:0, background:overlayColor, zIndex:9990, pointerEvents:'none' }} />
            )}

            {/* Backdrop click to dismiss */}
            <div style={{ position:'fixed', inset:0, zIndex:9992 }} onClick={finish} />

            {/* Tooltip card */}
            <div
                style={{
                    ...tooltipStyle,
                    zIndex: 9993,
                    opacity: fadeIn ? 1 : 0,
                    transform: (tooltipStyle.transform || '') + (fadeIn ? ' translateY(0)' : ' translateY(6px)'),
                    transition: 'opacity 0.18s ease, transform 0.18s ease',
                }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Progress bar */}
                <div className="h-1 bg-gray-100">
                    <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${progress}%`, transition: 'width 0.3s ease' }}
                    />
                </div>

                <div className="p-5">
                    {/* Step dots */}
                    <div className="flex gap-1.5 mb-4">
                        {STEPS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setStep(i)}
                                className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                                    i === step ? 'bg-indigo-600 w-5' :
                                    i < step   ? 'bg-indigo-200 w-1.5' :
                                                 'bg-gray-200 w-1.5'
                                }`}
                            />
                        ))}
                    </div>

                    <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest mb-1.5">
                        Step {step + 1} of {STEPS.length}
                    </p>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{current.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-5">{current.body}</p>

                    <div className="flex items-center justify-between">
                        <button onClick={finish} className="text-xs text-gray-300 hover:text-gray-500 transition">
                            Skip tour
                        </button>
                        <div className="flex gap-2">
                            {!isFirst && (
                                <button
                                    onClick={goPrev}
                                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                                >
                                    ← Back
                                </button>
                            )}
                            <button
                                onClick={goNext}
                                className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                            >
                                {isLast ? 'Finish ✓' : 'Next →'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
