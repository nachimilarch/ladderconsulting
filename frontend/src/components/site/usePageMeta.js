import { useEffect } from 'react';

const BRAND = 'LadderStep Human Consulting';

// Sets the browser tab title and meta description for a public page, and restores them on leave.
export default function usePageMeta(title, description) {
    useEffect(() => {
        document.title = title ? `${title} | ${BRAND}` : `${BRAND} - Business Consulting for SMBs`;
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
            document.title = BRAND;
            if (created) tag.remove();
            else if (previous !== null) tag.setAttribute('content', previous);
        };
    }, [title, description]);
}
