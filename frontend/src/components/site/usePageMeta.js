import { useEffect } from 'react';

const FALLBACK_TITLE = 'LadderStep Human Consulting';

// Sets the browser tab title and meta description for a public page, and restores them on leave.
// `title` is used exactly as given (the content document supplies each page's full title tag).
export default function usePageMeta(title, description) {
    useEffect(() => {
        document.title = title || FALLBACK_TITLE;
        let tag = document.querySelector('meta[name="description"]');
        const created = !tag;
        if (!tag) {
            tag = document.createElement('meta');
            tag.name = 'description';
            document.head.appendChild(tag);
        }
        const previous = tag.getAttribute('content');
        if (description) tag.setAttribute('content', description);
        return () => {
            document.title = FALLBACK_TITLE;
            if (created) tag.remove();
            else if (previous !== null) tag.setAttribute('content', previous);
        };
    }, [title, description]);
}
