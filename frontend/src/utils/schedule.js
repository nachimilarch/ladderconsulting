// Schedules are exchanged with the server as real instants (ISO strings, UTC). The browser's
// date-time input works in the person's own clock, so these convert between the two.
const pad = (n) => String(n).padStart(2, '0');

// ISO instant -> value for <input type="datetime-local"> in the local time zone.
export const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// datetime-local value -> ISO instant.
export const toIso = (local) => (local ? new Date(local).toISOString() : '');

// How a scheduled time is shown to staff: India time, whatever their browser says.
export const fmtIst = (iso) => (iso
    ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) + ' IST'
    : '');
