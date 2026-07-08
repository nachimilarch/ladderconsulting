// Central date/time formatting — always renders in IST (Asia/Kolkata) so
// timestamps are consistent for users regardless of their browser timezone.

const IST = { timeZone: 'Asia/Kolkata' };

export const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString('en-IN', { ...IST, hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

export const fmtDateShort = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short' }) : '—';
