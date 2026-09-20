// Shared input styling for the AI Studio forms.
export const inputClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200 bg-white';

// Email HTML as plain text for a text box: paragraph breaks kept, no runs of blank lines.
export const htmlToPlain = (html) => String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
