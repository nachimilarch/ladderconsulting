import { useCallback, useEffect, useState } from 'react';
import { reportAPI } from '../../api/hr';
import { hrPremiumAPI } from '../../api/hrPremium';
import { premiumCandidateReviewAPI } from '../../api/premiumCandidateReview';

const POLL_MS = 60000;

// What the hiring portal needs to know everywhere: the sidebar and tab-bar badges and
// the dashboard all read from this one fetch, so they can never disagree.
export default function useHrData(pathname) {
    const [hiring, setHiring] = useState(null);
    const [premium, setPremium] = useState({ company: 0, candidate: 0 });
    const [loaded, setLoaded] = useState(false);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [tick, setTick] = useState(0);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    // Refetch on every page change and whenever refresh() is called, so approving something
    // clears its badge as soon as you move on.
    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([
            reportAPI.hiring(),
            hrPremiumAPI.list(),
            premiumCandidateReviewAPI.list('pending'),
        ]).then(([h, c, p]) => {
            if (cancelled) return;
            if (h.status === 'fulfilled') setHiring(h.value.data?.data || null);
            setPremium({
                company: c.status === 'fulfilled' ? (c.value.data?.data || []).filter((r) => !r.is_read).length : 0,
                candidate: p.status === 'fulfilled' ? (p.value.data?.data || []).length : 0,
            });
            setUpdatedAt(new Date());
            setLoaded(true);
        });
        return () => { cancelled = true; };
    }, [pathname, tick]);

    useEffect(() => {
        const timer = setInterval(refresh, POLL_MS);
        const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [refresh]);

    // Count what can actually be opened and acted on (the lists), not the raw KPI, which
    // also counts old request types that have no approval screen.
    const pending = hiring?.pending_actions || {};
    const counts = {
        interviews: (pending.interview_requests || []).length,
        offers: (pending.offer_requests || []).length,
        companyPremium: premium.company,
        candidatePremium: premium.candidate,
    };

    return { hiring, premium, counts, loaded, updatedAt, refresh };
}
