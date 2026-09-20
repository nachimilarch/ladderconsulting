// One colour scale for every "% match" shown in the app:
// strong = green, moderate = brand violet, weak = neutral grey. Amber and red are
// kept for real warnings and errors, so a low match never looks like a fault.
export const matchBadgeCls = (s) =>
    s >= 70 ? 'bg-success-100 text-success-700' : s >= 40 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600';

export const matchBoxCls = (s) =>
    s >= 70 ? 'text-success-700 bg-success-50 border-success-200'
        : s >= 40 ? 'text-brand-700 bg-brand-50 border-brand-200'
        : 'text-gray-600 bg-gray-50 border-gray-200';

export const matchTextCls = (s) =>
    !s ? 'text-gray-400' : s >= 70 ? 'text-success-600' : s >= 40 ? 'text-brand-600' : 'text-gray-500';
