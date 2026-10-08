import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { COMPANY, LAST_UPDATED, LEGAL_PAGES } from './legalInfo';

// ── Small building blocks used by the three policy pages ─────────────────────
export function P({ children }) {
    return <p className="text-[15px] leading-7 text-gray-700 mb-3">{children}</p>;
}

export function H3({ children }) {
    return <h3 className="text-sm font-semibold text-gray-900 mt-5 mb-2">{children}</h3>;
}

export function UL({ items }) {
    return (
        <ul className="list-disc pl-5 mb-3 space-y-1.5 text-[15px] leading-7 text-gray-700 marker:text-gray-400">
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    );
}

// A list of "term: explanation" rows that reads well at any width (no wide tables on phones).
export function DefList({ rows }) {
    return (
        <dl className="mb-3 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/60">
            {rows.map(([term, desc]) => (
                <div key={term} className="px-4 py-3 sm:grid sm:grid-cols-[13rem_1fr] sm:gap-4">
                    <dt className="text-sm font-semibold text-gray-900">{term}</dt>
                    <dd className="mt-1 sm:mt-0 text-sm leading-6 text-gray-600">{desc}</dd>
                </div>
            ))}
        </dl>
    );
}

export function Callout({ children }) {
    return (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
            {children}
        </div>
    );
}

export function Mail() {
    return <a href={`mailto:${COMPANY.email}`} className="link">{COMPANY.email}</a>;
}

// ── Page frame ───────────────────────────────────────────────────────────────
export default function LegalLayout({ title, intro, sections }) {
    useEffect(() => {
        const previous = document.title;
        document.title = `${title} | ${COMPANY.brandName}`;
        window.scrollTo(0, 0);
        return () => { document.title = previous; };
    }, [title]);

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <Link to="/login" aria-label={`${COMPANY.brandName}, go to sign in`}>
                        <img src="/logo-full.png" alt={COMPANY.brandName} className="h-12 object-contain" />
                    </Link>
                    <Link to="/login" className="text-sm font-medium text-indigo-600 hover:underline">Sign in</Link>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
                <nav aria-label="Legal pages" className="mb-5 flex flex-wrap gap-2">
                    {LEGAL_PAGES.map((p) => (
                        <NavLink
                            key={p.to}
                            to={p.to}
                            className={({ isActive }) => `rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                                isActive ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700'
                            }`}
                        >
                            {p.label}
                        </NavLink>
                    ))}
                </nav>

                <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
                    <p className="mt-1 text-sm text-gray-500">Last updated {LAST_UPDATED}</p>
                    <p className="mt-4 text-[15px] leading-7 text-gray-700">{intro}</p>

                    <nav aria-label="Contents" className="mt-6 rounded-xl bg-gray-50 px-4 py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contents</p>
                        <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            {sections.map((s, i) => (
                                <li key={s.id}>
                                    <a href={`#${s.id}`} className="text-gray-600 hover:text-indigo-700 hover:underline">{i + 1}. {s.title}</a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <div className="mt-8 space-y-9">
                        {sections.map((s, i) => (
                            <section key={s.id} id={s.id} className="scroll-mt-6">
                                <h2 className="mb-3 text-lg font-semibold text-gray-900">{i + 1}. {s.title}</h2>
                                {s.body}
                            </section>
                        ))}
                    </div>
                </article>

                <footer className="mt-6 text-center text-xs leading-5 text-gray-400">
                    <p>&copy; {new Date().getFullYear()} {COMPANY.legalName}. Registered office: {COMPANY.state}.</p>
                    <p>Questions? Write to <a href={`mailto:${COMPANY.email}`} className="text-gray-500 underline">{COMPANY.email}</a></p>
                </footer>
            </main>
        </div>
    );
}
