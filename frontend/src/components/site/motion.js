import { useEffect, useRef, useState } from 'react';

// Small motion helpers shared by the marketing site. Everything here degrades to "no motion":
// when the visitor prefers reduced motion (or the browser lacks the API) things simply show their end state.

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches);
    useEffect(() => {
        if (!window.matchMedia) return undefined;
        const mq = window.matchMedia(QUERY);
        const on = () => setReduced(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return reduced;
}

// True once the element has been at least `threshold` visible. With `once: false` it follows visibility both ways.
export function useInView({ threshold = 0.25, once = true, rootMargin = '0px' } = {}) {
    const ref = useRef(null);
    const reduced = usePrefersReducedMotion();
    const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return undefined;
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                if (once) io.disconnect();
            } else if (!once) {
                setInView(false);
            }
        }, { threshold, rootMargin });
        io.observe(el);
        return () => io.disconnect();
    }, [threshold, once, rootMargin]);
    return [ref, inView || reduced];
}

// 0..1 through the page, for the scroll progress bar.
export function useScrollProgress() {
    const [p, setP] = useState(0);
    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = 0;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            setP(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);
    return p;
}

// Pointer position inside an element as -1..1 on each axis, for gentle parallax. Stays at 0,0 when motion is reduced.
export function usePointerParallax() {
    const ref = useRef(null);
    const reduced = usePrefersReducedMotion();
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const el = ref.current;
        if (!el || reduced) return undefined;
        const move = (e) => {
            const r = el.getBoundingClientRect();
            setPos({
                x: ((e.clientX - r.left) / r.width - 0.5) * 2,
                y: ((e.clientY - r.top) / r.height - 0.5) * 2,
            });
        };
        const leave = () => setPos({ x: 0, y: 0 });
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        return () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerleave', leave);
        };
    }, [reduced]);
    return [ref, pos];
}
