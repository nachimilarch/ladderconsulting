// Renders the small subset of markdown the assistant actually produces (bold,
// inline code, bullet and numbered lists, headings, paragraphs) as real elements.
// Built from React nodes rather than dangerouslySetInnerHTML, so model output
// can never inject markup.

const inline = (text, keyBase) =>
    text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={`${keyBase}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={`${keyBase}-${i}`} className="px-1 py-0.5 rounded bg-black/5 text-[0.85em]">{part.slice(1, -1)}</code>;
        }
        return part;
    });

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^#{1,4}\s+/;

// Walk the lines once, grouping consecutive lines of the same kind.
const toBlocks = (text) => {
    const blocks = [];
    let cur = null;
    const push = (type, line) => {
        if (cur && cur.type === type) cur.lines.push(line);
        else { cur = { type, lines: [line] }; blocks.push(cur); }
    };
    for (const raw of text.replace(/\r/g, '').split('\n')) {
        const line = raw.trimEnd();
        if (!line.trim()) { cur = null; continue; }
        if (HEADING.test(line)) { cur = null; blocks.push({ type: 'h', lines: [line.replace(HEADING, '')] }); }
        else if (BULLET.test(line)) push('ul', line.replace(BULLET, ''));
        else if (NUMBERED.test(line)) push('ol', line.replace(NUMBERED, ''));
        else push('p', line);
    }
    return blocks;
};

export default function ChatMarkdown({ text }) {
    if (!text) return null;
    return (
        <div className="space-y-2 leading-relaxed">
            {toBlocks(text).map((b, bi) => {
                if (b.type === 'h') {
                    return <p key={bi} className="font-semibold">{inline(b.lines[0], bi)}</p>;
                }
                if (b.type === 'ul' || b.type === 'ol') {
                    const List = b.type === 'ul' ? 'ul' : 'ol';
                    return (
                        <List key={bi} className={`pl-5 space-y-1 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
                            {b.lines.map((l, li) => <li key={li}>{inline(l, `${bi}-${li}`)}</li>)}
                        </List>
                    );
                }
                return (
                    <p key={bi}>
                        {b.lines.map((l, li) => (
                            <span key={li}>{li > 0 && <br />}{inline(l, `${bi}-${li}`)}</span>
                        ))}
                    </p>
                );
            })}
        </div>
    );
}
