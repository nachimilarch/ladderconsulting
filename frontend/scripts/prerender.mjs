// Pre-renders the public marketing pages into dist/<route>/index.html so search engines and link
// previews see real content without running JavaScript. The browser still loads the normal app on top.
//
// Runs after `vite build` (see the "build" script). If anything goes wrong it prints a warning and leaves
// the regular single-page build untouched, so a prerender problem can never break a deploy.
//
// Nginx must serve these folders, for example:  try_files $uri $uri/ /index.html;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SITE = process.env.SITE_URL || 'https://theladderconsulting.com';

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function main() {
    const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    const vite = await createServer({ root, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
    try {
        const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');
        const content = await vite.ssrLoadModule('/src/components/site/siteContent.js');
        const { home, about, whoWeWorkWith, contact, pillars } = content;

        const pages = [
            { url: '/', meta: home.meta },
            { url: '/about', meta: about.meta },
            ...pillars.map((p) => ({ url: `/${p.slug}`, meta: p.meta })),
            { url: '/who-we-work-with', meta: whoWeWorkWith.meta },
            { url: '/contact', meta: contact.meta },
        ];

        for (const { url, meta } of pages) {
            const html = render(url);
            const canonical = SITE + (url === '/' ? '/' : url);
            const head = [
                `<title>${esc(meta.title)}</title>`,
                `<meta name="description" content="${esc(meta.description)}" />`,
                `<link rel="canonical" href="${canonical}" />`,
                `<meta property="og:type" content="website" />`,
                `<meta property="og:site_name" content="LadderStep Consulting" />`,
                `<meta property="og:title" content="${esc(meta.title)}" />`,
                `<meta property="og:description" content="${esc(meta.description)}" />`,
                `<meta property="og:url" content="${canonical}" />`,
                `<meta property="og:image" content="${SITE}/logo-full.png" />`,
                `<meta name="twitter:card" content="summary" />`,
            ].join('\n    ');
            const out = template
                .replace(/<title>[^<]*<\/title>/, head)
                .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
            const file = url === '/' ? path.join(dist, 'index.html') : path.join(dist, url, 'index.html');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, out);
            console.log(`prerendered ${url}`);
        }

        const today = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(path.join(dist, 'sitemap.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            pages.map((p) => `  <url><loc>${SITE}${p.url === '/' ? '/' : p.url}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
            `\n</urlset>\n`);
        fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nSitemap: ${SITE}/sitemap.xml\n`);
        console.log('wrote sitemap.xml and robots.txt');
    } finally {
        await vite.close();
    }
}

main().catch((err) => {
    console.warn('\n[prerender] skipped: ' + (err && err.message ? err.message : err));
    console.warn('[prerender] the normal single-page build in dist/ is unchanged.\n');
});
