import { useRef } from 'react';
import toast from 'react-hot-toast';

import { MAX_ATTACH_BYTES, ATTACH_EXT, CAMPAIGN_EXT, CAMPAIGN_ACCEPT, MAX_LINK_BYTES, MEDIA_EXT, formatSize } from '../../utils/attachmentRules';

// Files chosen before the campaign/template exists. The parent uploads them after saving.
// `includedBytes` = size of files that will be added anyway (e.g. inherited from a template).
// `campaign` = email campaign mode: also video / audio / Excel / PowerPoint, files up to 25 MB.
// Documents that fit in the 2.5 MB mail budget are attached; the rest are sent as a download link.
export default function PendingFiles({ files, onChange, includedBytes = 0, disabled = false, campaign = false }) {
    const OK_EXT = campaign ? CAMPAIGN_EXT : ATTACH_EXT;
    const ref = useRef(null);
    const isLink = (f, before) => MEDIA_EXT.includes(f.name.split('.').pop().toLowerCase()) || f.size > MAX_ATTACH_BYTES || before + f.size > MAX_ATTACH_BYTES;
    // Bytes that will really be attached to the email (link files do not count against the mail budget).
    const attached = (() => { let n = includedBytes; for (const f of files) if (!isLink(f, n)) n += f.size; return n; })();
    const used = campaign ? attached : includedBytes + files.reduce((n, f) => n + f.size, 0);

    const add = (e) => {
        let total = used;
        const next = [...files];
        for (const f of Array.from(e.target.files || [])) {
            const ext = f.name.split('.').pop().toLowerCase();
            if (!OK_EXT.includes(ext)) { toast.error(campaign ? `${f.name}: not a supported file type` : `${f.name}: only PDF, images (JPG, PNG, GIF) or Word files`); continue; }
            if (campaign) {
                if (f.size > MAX_LINK_BYTES) { toast.error(`${f.name}: files can be at most ${formatSize(MAX_LINK_BYTES)}`); continue; }
                next.push(f);
                continue;
            }
            if (total + f.size > MAX_ATTACH_BYTES) { toast.error(`${f.name}: attachments are limited to ${formatSize(MAX_ATTACH_BYTES)} in total`); continue; }
            total += f.size;
            next.push(f);
        }
        onChange(next);
        e.target.value = '';
    };

    return (
        <div>
            <div className="flex items-center gap-3">
                <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
                    📎 Attach file
                </button>
                <span className="text-xs text-gray-400">
                    {campaign
                        ? 'PDF, images, Word, Excel, PowerPoint, video or audio · up to 25 MB each'
                        : `PDF, JPG, PNG, GIF or Word · ${formatSize(used)} of ${formatSize(MAX_ATTACH_BYTES)} used`}
                </span>
                <input ref={ref} type="file" multiple hidden accept={campaign ? CAMPAIGN_ACCEPT : '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx'} onChange={add} />
            </div>
            {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                            <span className="truncate">{f.name} <span className="text-xs text-gray-400">{formatSize(f.size)}</span>
                                {campaign && (() => { let before = includedBytes; for (let k = 0; k < i; k++) if (!isLink(files[k], before)) before += files[k].size; return isLink(f, before) ? <span className="ml-2 text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">sent as link</span> : null; })()}
                            </span>
                            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
                                className="text-xs text-red-500 hover:text-red-700 ml-3">Remove</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
