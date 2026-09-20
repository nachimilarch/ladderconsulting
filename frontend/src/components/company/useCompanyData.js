import { useCallback, useEffect, useState } from 'react';
import { companyAPI } from '../../api/company';
import { companyInvoiceAPI } from '../../api/payments';
import { buildCompanyWorkflow } from './companyWorkflow';

const POLL_MS = 60000;

// One fetch for everything the company layout and dashboard share: the sidebar and
// tab-bar badges and the dashboard read the same numbers, so they can never disagree.
export default function useCompanyData(pathname) {
    const [dash, setDash] = useState(null);
    const [fees, setFees] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [tick, setTick] = useState(0);

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    // Refetch on every page change and whenever refresh() is called, so finishing something
    // clears its badge as soon as you move on.
    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([
            companyAPI.getDashboard(),
            companyInvoiceAPI.placementFeeSummary(),
        ]).then(([d, f]) => {
            if (cancelled) return;
            if (d.status === 'fulfilled') setDash(d.value.data || null);
            if (f.status === 'fulfilled') setFees(f.value.data?.data || f.value.data || null);
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

    const workflow = buildCompanyWorkflow({ dash, fees });
    return { dash, fees, loaded, refresh, workflow, counts: workflow.counts };
}
