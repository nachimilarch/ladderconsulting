import { useEffect } from 'react';

const FALLBACK_TITLE = 'LadderStep Human Consulting';
const SITE = 'https://theladderconsulting.com';

// Finds (or creates) one head tag and returns a function that puts it back the way it was.
function setTag(selector, make, attr, value) {
    if (!value) return () => {};
    let tag = document.head.querySelector(selector);
    const created = !tag;
    if (!tag) {
        tag = document.createElement(make.tag);
        Object.entries(make.attrs).forEach(([k, v]) => tag.setAttribute(k, v));
        document.head.appendChild(tag);
    }
    const previous = tag.getAttribute(attr);
    tag.setAttribute(attr, value);
    return () => {
        if (created) tag.remove();
        else if (previous !== null) tag.setAttribute(attr, previous);
    };
}

// Sets the browser tab title and the search/share tags for a public page, and restores them on leave.
// `title` is used exactly as given (the content document supplies each page's full title tag).
// The pre-rendered HTML already carries these for crawlers; this keeps them right after in-app navigation.
export default function usePageMeta(title, description) {
    useEffect(() => {
        document.title = title || FALLBACK_TITLE;
        const path = window.location.pathname;
        const url = SITE + (path === '/' ? '/' : path.replace(/\/?$/, '/'));
        const undo = [
            setTag('meta[name="description"]', { tag: 'meta', attrs: { name: 'description' } }, 'content', description),
            setTag('meta[name="robots"]', { tag: 'meta', attrs: { name: 'robots' } }, 'content', 'index,follow,max-image-preview:large,max-snippet:-1'),
            setTag('link[rel="canonical"]', { tag: 'link', attrs: { rel: 'canonical' } }, 'href', url),
            setTag('meta[property="og:title"]', { tag: 'meta', attrs: { property: 'og:title' } }, 'content', title),
            setTag('meta[property="og:description"]', { tag: 'meta', attrs: { property: 'og:description' } }, 'content', description),
            setTag('meta[property="og:url"]', { tag: 'meta', attrs: { property: 'og:url' } }, 'content', url),
        ];
        return () => {
            document.title = FALLBACK_TITLE;
            undo.forEach((fn) => fn());
        };
    }, [title, description]);
}
