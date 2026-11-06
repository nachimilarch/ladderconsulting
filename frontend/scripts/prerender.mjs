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
        const { home, about, whoWeWorkWith, contact, pillars, companyInfo, contactEmail } = content;

        const pages = [
            { url: '/', meta: home.meta, type: 'WebPage' },
            { url: '/about', meta: about.meta, type: 'AboutPage', name: 'About Us' },
            ...pillars.map((p) => ({ url: `/${p.slug}`, meta: p.meta, type: 'WebPage', name: p.word, pillar: p })),
            { url: '/who-we-work-with', meta: whoWeWorkWith.meta, type: 'WebPage', name: 'Who We Work With' },
            { url: '/contact', meta: contact.meta, type: 'ContactPage', name: 'Contact' },
            { url: '/privacy-policy', type: 'WebPage', name: 'Privacy Policy', legal: true, meta: { title: 'Privacy Policy | LadderStep Consulting', description: 'How LadderStep Consulting collects, uses and protects personal information on its website and hiring platform.' } },
            { url: '/terms-of-service', type: 'WebPage', name: 'Terms of Service', legal: true, meta: { title: 'Terms of Service | LadderStep Consulting', description: 'The terms that apply when you use the LadderStep Consulting website, hiring platform and services.' } },
            { url: '/refund-and-cancellation', type: 'WebPage', name: 'Refund and Cancellation', legal: true, meta: { title: 'Refund and Cancellation Policy | LadderStep Consulting', description: 'When refunds and cancellations apply to LadderStep Consulting services, packages and placement fees.' } },
        ];

        // Real URLs end in a slash (nginx redirects /about to /about/), so canonical and sitemap say the same.
        const abs = (url) => SITE + (url === '/' ? '/' : `${url}/`);
        const IMAGE = `${SITE}/og-image-1200x630.png`;
        const ORG_ID = `${SITE}/#organization`;
        const SITE_ID = `${SITE}/#website`;

        const organization = {
            '@type': 'ProfessionalService',
            '@id': ORG_ID,
            name: companyInfo.name,
            url: `${SITE}/`,
            logo: { '@type': 'ImageObject', url: `${SITE}/logo-icon.png`, width: 512, height: 512 },
            image: IMAGE,
            description: companyInfo.short,
            telephone: companyInfo.phone,
            email: contactEmail,
            address: {
                '@type': 'PostalAddress',
                streetAddress: 'AltF, Begumpet',
                addressLocality: 'Hyderabad',
                addressRegion: 'Telangana',
                addressCountry: 'IN',
            },
            areaServed: { '@type': 'Country', name: 'India' },
            knowsAbout: pillars.map((p) => p.word),
            contactPoint: { '@type': 'ContactPoint', telephone: companyInfo.phone, email: contactEmail, contactType: 'customer service', areaServed: 'IN', availableLanguage: ['English'] },
        };
        const website = { '@type': 'WebSite', '@id': SITE_ID, url: `${SITE}/`, name: companyInfo.name, inLanguage: 'en-IN', publisher: { '@id': ORG_ID } };

        const graphFor = ({ url, meta, type, name, pillar }) => {
            const pageId = `${abs(url)}#webpage`;
            const graph = [];
            if (url === '/') graph.push(organization, website);
            else graph.push({ '@type': 'Organization', '@id': ORG_ID, name: companyInfo.name, url: `${SITE}/` });
            graph.push({
                '@type': type, '@id': pageId, url: abs(url), name: meta.title, description: meta.description,
                inLanguage: 'en-IN', isPartOf: { '@id': SITE_ID }, about: { '@id': ORG_ID },
                primaryImageOfPage: { '@type': 'ImageObject', url: IMAGE },
                ...(url !== '/' ? { breadcrumb: { '@id': `${abs(url)}#breadcrumb` } } : {}),
            });
            if (url !== '/') {
                graph.push({
                    '@type': 'BreadcrumbList', '@id': `${abs(url)}#breadcrumb`,
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
                        { '@type': 'ListItem', position: 2, name, item: abs(url) },
                    ],
                });
            }
            if (pillar) {
                graph.push({
                    '@type': 'Service', '@id': `${abs(url)}#service`, name: `${pillar.word}: ${pillar.lead}`,
                    serviceType: pillar.word, description: pillar.summary, url: abs(url),
                    provider: { '@id': ORG_ID }, areaServed: { '@type': 'Country', name: 'India' },
                    hasOfferCatalog: {
                        '@type': 'OfferCatalog', name: `${pillar.word} services`,
                        itemListElement: pillar.offerings.map((o) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: o } })),
                    },
                });
            }
            return { '@context': 'https://schema.org', '@graph': graph };
        };
        // "<" is escaped so no text can ever close the script tag early.
        const ldJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

        for (const page of pages) {
            const { url, meta } = page;
            const html = render(url);
            const canonical = abs(url);
            const head = [
                `<title>${esc(meta.title)}</title>`,
                `<meta name="description" content="${esc(meta.description)}" />`,
                `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" />`,
                `<link rel="canonical" href="${canonical}" />`,
                `<meta property="og:type" content="website" />`,
                `<meta property="og:site_name" content="${esc(companyInfo.name)}" />`,
                `<meta property="og:locale" content="en_IN" />`,
                `<meta property="og:title" content="${esc(meta.title)}" />`,
                `<meta property="og:description" content="${esc(meta.description)}" />`,
                `<meta property="og:url" content="${canonical}" />`,
                `<meta property="og:image" content="${IMAGE}" />`,
                `<meta property="og:image:width" content="1200" />`,
                `<meta property="og:image:height" content="630" />`,
                `<meta property="og:image:alt" content="${esc(companyInfo.name + ': strategy, talent, protection and growth for Indian MSMEs')}" />`,
                `<meta name="twitter:card" content="summary_large_image" />`,
                `<meta name="twitter:title" content="${esc(meta.title)}" />`,
                `<meta name="twitter:description" content="${esc(meta.description)}" />`,
                `<meta name="twitter:image" content="${IMAGE}" />`,
                `<script type="application/ld+json">${ldJson(graphFor(page))}</script>`,
            ].join('\n    ');
            const out = template
                .replace(/<title>[^<]*<\/title>/, head)
                .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
            const file = url === '/' ? path.join(dist, 'index.html') : path.join(dist, url, 'index.html');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, out);
            console.log(`prerendered ${url}`);
        }

        // app.html: the plain app shell for everything that is not a marketing page (sign-in, portals, unknown paths).
        // Search engines are told to leave it out. Nginx falls back to it instead of the home page.
        fs.writeFileSync(path.join(dist, 'app.html'),
            template.replace('<title>', '<meta name="robots" content="noindex,nofollow" />\n    <title>'));

        fs.writeFileSync(path.join(dist, 'sitemap.xml'),
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            pages.map((p) => `  <url><loc>${abs(p.url)}</loc><changefreq>${p.url === '/' ? 'weekly' : p.legal ? 'yearly' : 'monthly'}</changefreq><priority>${p.url === '/' ? '1.0' : p.pillar ? '0.9' : p.legal ? '0.3' : '0.7'}</priority></url>`).join('\n') +
            `\n</urlset>\n`);
        const blocked = ['/admin', '/dashboard', '/hr', '/candidate', '/company', '/outreach', '/notifications', '/unauthorized', '/login', '/register', '/ladder', '/verify-email', '/forgot-password', '/reset-password', '/maintenance', '/api/'];
        fs.writeFileSync(path.join(dist, 'robots.txt'),
            `User-agent: *\nAllow: /\n${blocked.map((b) => `Disallow: ${b}`).join('\n')}\n\nSitemap: ${SITE}/sitemap.xml\n`);
        console.log('wrote sitemap.xml, robots.txt and app.html');
    } finally {
        await vite.close();
    }
}

main().catch((err) => {
    console.warn('\n[prerender] skipped: ' + (err && err.message ? err.message : err));
    console.warn('[prerender] the normal single-page build in dist/ is unchanged.\n');
});
