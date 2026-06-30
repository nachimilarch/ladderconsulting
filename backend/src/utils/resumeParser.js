/**
 * Offline resume / JD parser — zero external dependencies, no API key.
 *
 * Replaces the OpenAI-based extraction in aiParser.js and matchingService.js.
 * Everything here is pure text heuristics: regex for contact details and links,
 * a curated skill dictionary for skills, and section/date heuristics for
 * experience, education, headline, location and summary.
 *
 * Public API (all synchronous):
 *   parseFullProfile(text)  → { full_name, email, phone, headline, location,
 *                               experience_years, linkedin_url, portfolio_url,
 *                               summary, education[], skills[] }
 *   parseResumeText(text)   → { skills[], experience_years, summary }
 *   extractSkills(text)     → string[]  (canonical lowercase skill names)
 *   extractJobSkills(text)  → { required: string[], preferred: string[] }
 */

// ── Skill dictionary ─────────────────────────────────────────────────────────
// canonical lowercase name → list of lowercase aliases to match in text.
const SKILLS = {
    // Languages
    'javascript': ['javascript', 'js', 'es6', 'ecmascript'],
    'typescript': ['typescript', 'ts'],
    'python': ['python', 'py'],
    'java': ['java'],
    'c++': ['c++', 'cpp', 'c plus plus'],
    'c#': ['c#', 'c-sharp', 'csharp'],
    'c': ['c programming', 'c language'],
    'golang': ['golang', 'go programming', 'go lang'],
    'rust': ['rust'],
    'ruby': ['ruby'],
    'php': ['php'],
    'swift': ['swift'],
    'kotlin': ['kotlin'],
    'scala': ['scala'],
    'r': ['r programming', 'r language', 'rstudio'],
    'matlab': ['matlab'],
    'perl': ['perl'],
    'objective-c': ['objective-c', 'objective c'],
    'dart': ['dart'],
    'sql': ['sql'],
    'bash': ['bash', 'shell scripting', 'shell script'],
    'powershell': ['powershell'],

    // Frontend
    'react': ['react', 'react.js', 'reactjs'],
    'angular': ['angular', 'angularjs'],
    'vue': ['vue', 'vue.js', 'vuejs'],
    'next.js': ['next.js', 'nextjs'],
    'svelte': ['svelte'],
    'redux': ['redux'],
    'html': ['html', 'html5'],
    'css': ['css', 'css3'],
    'sass': ['sass', 'scss'],
    'tailwind': ['tailwind', 'tailwind css', 'tailwindcss'],
    'bootstrap': ['bootstrap'],
    'jquery': ['jquery'],
    'webpack': ['webpack'],

    // Backend / API
    'node.js': ['node.js', 'nodejs', 'node js'],
    'express.js': ['express.js', 'expressjs', 'express'],
    'django': ['django'],
    'flask': ['flask'],
    'fastapi': ['fastapi'],
    'spring boot': ['spring boot', 'spring framework', 'spring'],
    'laravel': ['laravel'],
    '.net': ['.net', 'dotnet', 'asp.net', 'dot net'],
    'ruby on rails': ['ruby on rails', 'rails'],
    'graphql': ['graphql'],
    'rest api': ['rest api', 'restful', 'rest apis'],
    'microservices': ['microservices', 'microservice'],

    // Databases
    'mysql': ['mysql'],
    'postgresql': ['postgresql', 'postgres'],
    'mongodb': ['mongodb', 'mongo'],
    'redis': ['redis'],
    'sqlite': ['sqlite'],
    'oracle': ['oracle'],
    'sql server': ['sql server', 'mssql'],
    'firebase': ['firebase'],
    'dynamodb': ['dynamodb'],
    'cassandra': ['cassandra'],
    'elasticsearch': ['elasticsearch', 'elastic search'],

    // Cloud / DevOps
    'aws': ['aws', 'amazon web services'],
    'azure': ['azure', 'microsoft azure'],
    'gcp': ['gcp', 'google cloud'],
    'docker': ['docker'],
    'kubernetes': ['kubernetes', 'k8s'],
    'jenkins': ['jenkins'],
    'ci/cd': ['ci/cd', 'cicd', 'ci cd'],
    'terraform': ['terraform'],
    'ansible': ['ansible'],
    'linux': ['linux', 'unix'],
    'nginx': ['nginx'],
    'devops': ['devops'],
    'git': ['git'],
    'github': ['github'],
    'gitlab': ['gitlab'],

    // Data / AI
    'machine learning': ['machine learning', 'ml'],
    'deep learning': ['deep learning'],
    'tensorflow': ['tensorflow'],
    'pytorch': ['pytorch'],
    'nlp': ['nlp', 'natural language processing'],
    'computer vision': ['computer vision'],
    'data science': ['data science'],
    'data analysis': ['data analysis', 'data analytics'],
    'pandas': ['pandas'],
    'numpy': ['numpy'],
    'power bi': ['power bi', 'powerbi'],
    'tableau': ['tableau'],
    'excel': ['microsoft excel', 'ms excel', 'advanced excel', 'excel'],
    'spark': ['apache spark', 'pyspark', 'spark'],
    'hadoop': ['hadoop'],

    // Mobile
    'android': ['android'],
    'ios': ['ios development', 'ios'],
    'react native': ['react native'],
    'flutter': ['flutter'],

    // Testing / tools / design
    'selenium': ['selenium'],
    'jira': ['jira'],
    'postman': ['postman'],
    'figma': ['figma'],
    'photoshop': ['photoshop'],
    'illustrator': ['illustrator'],

    // Methodology
    'agile': ['agile'],
    'scrum': ['scrum'],
    'kanban': ['kanban'],
    'project management': ['project management'],
    'product management': ['product management'],

    // HR / People
    'recruitment': ['recruitment', 'recruiting', 'end to end recruitment'],
    'talent acquisition': ['talent acquisition'],
    'payroll': ['payroll'],
    'performance management': ['performance management'],
    'employee relations': ['employee relations'],
    'onboarding': ['onboarding'],
    'hrms': ['hrms'],
    'workday': ['workday'],
    'sap': ['sap'],

    // Finance / Accounting
    'accounting': ['accounting'],
    'financial analysis': ['financial analysis', 'financial modeling'],
    'taxation': ['taxation', 'income tax', 'gst'],
    'auditing': ['auditing', 'audit'],
    'tally': ['tally'],
    'quickbooks': ['quickbooks'],

    // Marketing / Sales
    'digital marketing': ['digital marketing'],
    'seo': ['seo', 'search engine optimization'],
    'sem': ['sem'],
    'content writing': ['content writing', 'copywriting'],
    'social media marketing': ['social media marketing', 'social media'],
    'google analytics': ['google analytics'],
    'sales': ['sales'],
    'business development': ['business development'],
    'crm': ['crm'],
    'salesforce': ['salesforce'],
    'customer service': ['customer service', 'customer support'],

    // Soft skills
    'communication': ['communication'],
    'leadership': ['leadership'],
    'teamwork': ['teamwork'],
    'problem solving': ['problem solving', 'problem-solving'],
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Compile once: canonical → [{ alias, regex }]
const COMPILED = Object.entries(SKILLS).map(([canonical, aliases]) => ({
    canonical,
    patterns: aliases.map((alias) => {
        const body = escapeRegex(alias).replace(/\s+/g, '\\s+');
        // Bound by non-alphanumerics so "java" ≠ "javascript", but allow
        // symbol neighbours so "c++," and "node.js" still match.
        return new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, 'i');
    }),
}));

// First match index of a canonical skill in text, or -1
function firstSkillIndex(text, patterns) {
    let best = -1;
    for (const re of patterns) {
        const m = re.exec(text);
        if (m && (best === -1 || m.index < best)) best = m.index;
    }
    return best;
}

// ── Skills ───────────────────────────────────────────────────────────────────
function extractSkills(text) {
    if (!text) return [];
    const found = [];
    for (const { canonical, patterns } of COMPILED) {
        if (patterns.some((re) => re.test(text))) found.push(canonical);
    }
    return found;
}

// Required vs preferred for a JD, using nearby "nice to have" cues.
const PREFERRED_CUE = /(nice[ -]to[ -]have|preferred|good[ -]to[ -]have|desirable|bonus|plus point|added advantage|advantage|optional|a plus)/i;

function extractJobSkills(text) {
    if (!text) return { required: [], preferred: [] };
    const required = [];
    const preferred = [];
    for (const { canonical, patterns } of COMPILED) {
        const idx = firstSkillIndex(text, patterns);
        if (idx === -1) continue;
        const lead = text.slice(Math.max(0, idx - 130), idx);
        if (PREFERRED_CUE.test(lead)) preferred.push(canonical);
        else required.push(canonical);
    }
    // A skill marked required anywhere wins over preferred
    const reqSet = new Set(required);
    return { required, preferred: preferred.filter((s) => !reqSet.has(s)) };
}

// ── Contact details & links ──────────────────────────────────────────────────
function extractEmail(text) {
    const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0].trim().toLowerCase() : '';
}

function extractPhone(text) {
    // +country, spaces, dashes, parens; 10–13 digits overall
    const m = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g);
    if (!m) return '';
    const cand = m.map((s) => s.trim()).filter((s) => (s.replace(/\D/g, '').length >= 10));
    return cand.length ? cand[0] : '';
}

function extractLinkedIn(text) {
    const m = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+/i);
    if (!m) return '';
    return m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
}

function extractPortfolio(text, linkedin) {
    const gh = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i);
    if (gh) return gh[0].startsWith('http') ? gh[0] : `https://${gh[0]}`;
    const urls = text.match(/(?:https?:\/\/)[A-Za-z0-9./?=#%_-]+/gi) || [];
    const other = urls.find((u) => !/linkedin\.com/i.test(u) && u !== linkedin);
    return other || '';
}

// ── Name / headline ──────────────────────────────────────────────────────────
const SECTION_WORDS = new Set([
    'resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary', 'objective',
    'contact', 'email', 'phone', 'address', 'experience', 'education', 'skills',
    'projects', 'certifications', 'achievements', 'references', 'languages',
]);

const TITLE_WORDS = /(engineer|developer|manager|analyst|consultant|designer|specialist|lead|architect|executive|intern|administrator|officer|coordinator|accountant|recruiter|marketer|scientist|associate|head|director|programmer|tester|qa|devops|hr|sales|support)/i;

function titleCase(s) {
    return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function looksLikeName(line) {
    if (!line || line.length > 40) return false;
    if (/[@\d]/.test(line) || /https?:|www\./i.test(line)) return false;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) return false;
    for (const t of tokens) {
        if (!/^[A-Za-z][A-Za-z.'-]*$/.test(t)) return false;
        if (SECTION_WORDS.has(t.toLowerCase())) return false;
    }
    return true;
}

function extractName(lines, email) {
    for (const line of lines.slice(0, 6)) {
        if (looksLikeName(line)) {
            return /[a-z]/.test(line) && /[A-Z]/.test(line) ? line : titleCase(line);
        }
    }
    // Fall back to the email local part (john.doe@ → John Doe)
    if (email) {
        const local = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
        if (local) return titleCase(local);
    }
    return '';
}

function extractHeadline(lines, name) {
    const nameIdx = lines.findIndex((l) => l === name || titleCase(l) === name);
    // Prefer the line just after the name
    if (nameIdx !== -1 && lines[nameIdx + 1] && TITLE_WORDS.test(lines[nameIdx + 1]) && lines[nameIdx + 1].length < 60) {
        return lines[nameIdx + 1].trim();
    }
    // Otherwise the first short line near the top that reads like a title
    for (const line of lines.slice(0, 10)) {
        if (line !== name && line.length <= 60 && TITLE_WORDS.test(line) && !/[@]/.test(line)) {
            return line.trim();
        }
    }
    return '';
}

// ── Location ─────────────────────────────────────────────────────────────────
const CITIES = [
    'mumbai', 'delhi', 'new delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai',
    'kolkata', 'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur', 'nagpur',
    'indore', 'thane', 'bhopal', 'visakhapatnam', 'vizag', 'patna', 'vadodara', 'noida',
    'gurgaon', 'gurugram', 'coimbatore', 'kochi', 'chandigarh', 'mysore', 'mysuru',
    'london', 'new york', 'san francisco', 'singapore', 'dubai', 'toronto', 'sydney',
    'berlin', 'paris', 'tokyo', 'remote',
];
const CITY_RE = new RegExp(`(?<![A-Za-z])(${CITIES.map(escapeRegex).join('|')})(?![A-Za-z])`, 'i');

function extractLocation(text) {
    const m = text.match(CITY_RE);
    return m ? titleCase(m[1]) : '';
}

// ── Experience (years) ───────────────────────────────────────────────────────
const EXP_HEADER = /^(work\s+experience|professional\s+experience|employment(\s+history)?|experience|work\s+history|career\s+history)\b/i;
const EXP_STOP = /^(education|academic|skills|technical\s+skills|projects|certifications?|achievements|awards|publications|languages|interests|hobbies|references|summary|profile|objective|personal\s+details)\b/i;

// Text of the work-experience section only (so schooling years don't inflate it)
function experienceSection(lines) {
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (EXP_HEADER.test(lines[i])) { start = i; break; }
    }
    if (start === -1) return '';
    const buf = [];
    for (let j = start + 1; j < lines.length; j++) {
        if (EXP_STOP.test(lines[j])) break;
        buf.push(lines[j]);
    }
    return buf.join('\n');
}

function extractExperienceYears(text) {
    const t = text.toLowerCase();

    // 1. Explicit statement — the most reliable signal
    //    "5 years", "5+ yrs", "5.5 years of experience", "experience: 6 years"
    let explicit = 0;
    const re = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
        const val = parseFloat(m[1]);
        if (val <= 0 || val > 50) continue;
        const around = t.slice(Math.max(0, m.index - 30), m.index + 30);
        if (/experien|exp\b|work|industry|professional|career|relevant|overall|total/.test(around)) {
            explicit = Math.max(explicit, val);
        }
    }
    if (explicit > 0) return explicit;

    // 2. Sum the durations of date ranges inside the work-experience section only
    const nowYear = new Date().getFullYear();
    const section = experienceSection(text.split('\n').map((l) => l.trim()));
    if (section) {
        const ranges = [...section.matchAll(/((?:19|20)\d\d)\s*[-–—to]+\s*((?:19|20)\d\d|present|current|now|till date|ongoing)/gi)];
        let total = 0;
        for (const r of ranges) {
            const start = parseInt(r[1], 10);
            const end = /^(?:19|20)\d\d$/.test(r[2]) ? parseInt(r[2], 10) : nowYear;
            if (end >= start && end - start <= 50) total += (end - start);
        }
        if (total > 0) return Math.min(total, 50);
    }
    return 0;
}

// ── Education ────────────────────────────────────────────────────────────────
const DEGREES = [
    [/ph\.?\s?d|doctorate/i, 'PhD'],
    [/m\.?\s?tech|master of technology/i, 'M.Tech'],
    [/b\.?\s?tech|bachelor of technology/i, 'B.Tech'],
    [/m\.?\s?b\.?a|master of business/i, 'MBA'],
    [/b\.?\s?b\.?a/i, 'BBA'],
    [/m\.?\s?c\.?a|master of computer/i, 'MCA'],
    [/b\.?\s?c\.?a/i, 'BCA'],
    [/m\.?\s?sc|master of science/i, 'M.Sc'],
    [/b\.?\s?sc|bachelor of science/i, 'B.Sc'],
    [/m\.?\s?com/i, 'M.Com'],
    [/b\.?\s?com/i, 'B.Com'],
    [/m\.?\s?e\b|master of engineering/i, 'M.E'],
    [/b\.?\s?e\b|bachelor of engineering/i, 'B.E'],
    [/m\.?\s?a\b|master of arts/i, 'M.A'],
    [/b\.?\s?a\b|bachelor of arts/i, 'B.A'],
    [/diploma/i, 'Diploma'],
];
const INSTITUTION_RE = /(university|institute|college|school|academy|polytechnic|iit|nit|iiit|bits)/i;

function extractEducation(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const deg = DEGREES.find(([re]) => re.test(line));
        if (!deg) continue;
        const years = (line.match(/(?:19|20)\d\d/g) || []).map((y) => parseInt(y, 10));
        // institution on same line, else the next line
        let institution = INSTITUTION_RE.test(line) ? line
            : (lines[i + 1] && INSTITUTION_RE.test(lines[i + 1]) ? lines[i + 1] : '');
        institution = institution.replace(/(?:19|20)\d\d/g, '').replace(/[|,;].*$/, '').trim().slice(0, 120);
        const fieldM = line.match(/(?:in|of)\s+([A-Za-z &]{3,40})/i);
        const key = `${deg[1]}|${years[0] || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
            degree: deg[1],
            institution: institution || '',
            field: fieldM ? fieldM[1].trim() : '',
            start_year: years.length >= 2 ? years[0] : null,
            end_year: years.length >= 2 ? years[1] : (years[0] || null),
            grade: '',
        });
    }
    return out;
}

// ── Summary ──────────────────────────────────────────────────────────────────
const SUMMARY_START = /^\s*(professional\s+summary|summary|profile|objective|career\s+objective|about(\s+me)?)\s*:?\s*$/i;
const SECTION_STOP = /^\s*(work\s+experience|experience|employment|education|academic|skills|technical\s+skills|projects|certifications|achievements|awards|languages|interests|hobbies|references|contact)\s*:?\s*$/i;

function extractSummary(text) {
    const lines = text.split('\n').map((l) => l.trim());

    // 1. Explicit summary/objective section
    for (let i = 0; i < lines.length; i++) {
        if (SUMMARY_START.test(lines[i])) {
            const buf = [];
            for (let j = i + 1; j < lines.length && buf.join(' ').length < 600; j++) {
                if (!lines[j]) { if (buf.length) break; else continue; }
                if (SECTION_STOP.test(lines[j])) break;
                buf.push(lines[j]);
            }
            const s = buf.join(' ').trim();
            if (s.length > 30) return s.slice(0, 600);
        }
    }

    // 2. Inline "Summary: ...." on one line
    const inline = text.match(/(?:summary|objective|profile)\s*[:\-]\s*(.{40,600})/i);
    if (inline) return inline[1].split('\n')[0].trim().slice(0, 600);

    // 3. First substantial paragraph that isn't contact info
    for (const line of lines.slice(1, 25)) {
        if (line.length > 80 && !/[@]|https?:|www\./i.test(line) && !SECTION_STOP.test(line)) {
            return line.slice(0, 600);
        }
    }
    return '';
}

// ── Public composite parsers ─────────────────────────────────────────────────
function parseFullProfile(text) {
    const raw = String(text || '');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

    const email = extractEmail(raw);
    const linkedin = extractLinkedIn(raw);
    const name = extractName(lines, email);

    return {
        full_name: name,
        email,
        phone: extractPhone(raw),
        headline: extractHeadline(lines, name),
        location: extractLocation(raw),
        experience_years: extractExperienceYears(raw),
        linkedin_url: linkedin,
        portfolio_url: extractPortfolio(raw, linkedin),
        summary: extractSummary(raw),
        education: extractEducation(raw),
        skills: extractSkills(raw),
    };
}

function parseResumeText(text) {
    const raw = String(text || '');
    return {
        skills: extractSkills(raw),
        experience_years: extractExperienceYears(raw),
        summary: extractSummary(raw),
    };
}

module.exports = {
    parseFullProfile,
    parseResumeText,
    extractSkills,
    extractJobSkills,
};
