/**
 * Offline resume / JD parser — zero external dependencies, no API key.
 *
 * Public API (all synchronous):
 *   parseFullProfile(text)  → { full_name, email, phone, headline, location,
 *                               experience_years, linkedin_url, portfolio_url,
 *                               summary, education[], skills[] }
 *   parseResumeText(text)   → { skills[], experience_years, summary }
 *   extractSkills(text)     → string[]
 *   extractJobSkills(text)  → { required: string[], preferred: string[] }
 */

// ── Skill dictionary ─────────────────────────────────────────────────────────
const SKILLS = {
    // ── Languages ────────────────────────────────────────────────────────────
    'javascript': ['javascript', 'js', 'es6', 'es2015', 'ecmascript'],
    'typescript': ['typescript', 'ts'],
    'python': ['python', 'py'],
    'java': ['java'],
    'c++': ['c\\+\\+', 'cpp', 'c plus plus'],
    'c#': ['c#', 'c-sharp', 'csharp'],
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
    'dart': ['dart'],
    'sql': ['sql'],
    'bash': ['bash', 'shell scripting', 'shell script'],
    'powershell': ['powershell'],
    'vba': ['vba', 'visual basic for applications'],

    // ── Frontend ─────────────────────────────────────────────────────────────
    'react': ['react', 'react\\.js', 'reactjs', 'react js'],
    'angular': ['angular', 'angularjs', 'angular js'],
    'vue': ['vue', 'vue\\.js', 'vuejs', 'vue js'],
    'next.js': ['next\\.js', 'nextjs', 'next js'],
    'svelte': ['svelte'],
    'redux': ['redux', 'redux toolkit'],
    'html': ['html', 'html5'],
    'css': ['css', 'css3'],
    'sass': ['sass', 'scss'],
    'tailwind css': ['tailwind', 'tailwind css', 'tailwindcss'],
    'bootstrap': ['bootstrap'],
    'jquery': ['jquery'],
    'webpack': ['webpack'],

    // ── Backend / API ─────────────────────────────────────────────────────────
    'node.js': ['node\\.js', 'nodejs', 'node js'],
    'express.js': ['express\\.js', 'expressjs', 'express'],
    'django': ['django'],
    'flask': ['flask'],
    'fastapi': ['fastapi'],
    'spring boot': ['spring boot', 'spring framework', 'spring mvc'],
    'laravel': ['laravel'],
    '.net': ['\\.net', 'dotnet', 'asp\\.net', 'dot net'],
    'ruby on rails': ['ruby on rails', 'rails'],
    'graphql': ['graphql'],
    'rest api': ['rest api', 'restful api', 'restful', 'rest apis', 'api development', 'api integration'],
    'microservices': ['microservices', 'microservice', 'micro services'],
    'grpc': ['grpc', 'grpc api'],
    'websocket': ['websocket', 'web socket'],

    // ── Databases ─────────────────────────────────────────────────────────────
    'mysql': ['mysql'],
    'postgresql': ['postgresql', 'postgres', 'psql'],
    'mongodb': ['mongodb', 'mongo'],
    'redis': ['redis'],
    'sqlite': ['sqlite'],
    'oracle': ['oracle', 'oracle database', 'oracle db'],
    'sql server': ['sql server', 'mssql', 'microsoft sql server', 'ms sql'],
    'firebase': ['firebase', 'firestore'],
    'dynamodb': ['dynamodb'],
    'cassandra': ['cassandra'],
    'elasticsearch': ['elasticsearch', 'elastic search', 'elk stack'],
    'snowflake': ['snowflake'],
    'bigquery': ['bigquery', 'big query'],

    // ── Cloud / DevOps ────────────────────────────────────────────────────────
    'aws': ['aws', 'amazon web services', 'amazon aws'],
    'azure': ['azure', 'microsoft azure', 'azure cloud'],
    'gcp': ['gcp', 'google cloud', 'google cloud platform'],
    'docker': ['docker', 'dockerfile', 'docker container'],
    'kubernetes': ['kubernetes', 'k8s'],
    'jenkins': ['jenkins'],
    'ci/cd': ['ci/cd', 'cicd', 'ci cd', 'continuous integration', 'continuous deployment', 'continuous delivery'],
    'terraform': ['terraform'],
    'ansible': ['ansible'],
    'linux': ['linux', 'unix', 'ubuntu', 'centos', 'rhel'],
    'nginx': ['nginx'],
    'devops': ['devops', 'dev ops'],
    'git': ['git', 'version control'],
    'github': ['github'],
    'gitlab': ['gitlab'],
    'bitbucket': ['bitbucket'],
    'helm': ['helm'],

    // ── Data / AI / Analytics ─────────────────────────────────────────────────
    'machine learning': ['machine learning', 'ml'],
    'deep learning': ['deep learning', 'neural network', 'neural networks'],
    'tensorflow': ['tensorflow', 'tf'],
    'pytorch': ['pytorch'],
    'nlp': ['nlp', 'natural language processing'],
    'computer vision': ['computer vision', 'image processing'],
    'data science': ['data science', 'data scientist'],
    'data analysis': ['data analysis', 'data analytics', 'data analyst'],
    'pandas': ['pandas'],
    'numpy': ['numpy'],
    'power bi': ['power bi', 'powerbi', 'power-bi'],
    'tableau': ['tableau'],
    'excel': ['microsoft excel', 'ms excel', 'advanced excel', 'excel'],
    'apache spark': ['apache spark', 'pyspark', 'spark'],
    'hadoop': ['hadoop'],
    'looker': ['looker'],
    'qlik': ['qlik', 'qlikview', 'qliksense'],
    'hive': ['hive', 'apache hive'],
    'airflow': ['airflow', 'apache airflow'],
    'statistics': ['statistics', 'statistical analysis'],
    'business intelligence': ['business intelligence', 'bi', 'bi tools'],
    'hris': ['hris', 'hr information system'],
    'hr analytics': ['hr analytics', 'people analytics', 'workforce analytics'],

    // ── Mobile ────────────────────────────────────────────────────────────────
    'android': ['android', 'android development'],
    'ios': ['ios development', 'ios'],
    'react native': ['react native'],
    'flutter': ['flutter'],
    'xamarin': ['xamarin'],

    // ── Testing / QA ─────────────────────────────────────────────────────────
    'selenium': ['selenium', 'selenium webdriver'],
    'cypress': ['cypress'],
    'jest': ['jest'],
    'junit': ['junit'],
    'manual testing': ['manual testing'],
    'test automation': ['test automation', 'automation testing'],
    'jmeter': ['jmeter', 'j meter'],
    'postman': ['postman'],
    'api testing': ['api testing'],

    // ── Project / Tools ───────────────────────────────────────────────────────
    'jira': ['jira'],
    'confluence': ['confluence'],
    'trello': ['trello'],
    'asana': ['asana'],
    'ms project': ['ms project', 'microsoft project'],
    'monday.com': ['monday\\.com', 'monday com'],
    'slack': ['slack'],
    'ms office': ['ms office', 'microsoft office', 'office 365', 'microsoft 365', 'o365', 'm365', 'microsoft office suite'],
    'microsoft teams': ['microsoft teams', 'ms teams'],
    'sharepoint': ['sharepoint', 'share point'],
    'outlook': ['outlook', 'ms outlook'],
    'zoom': ['zoom'],

    // ── Design ────────────────────────────────────────────────────────────────
    'figma': ['figma'],
    'adobe photoshop': ['photoshop', 'adobe photoshop'],
    'adobe illustrator': ['illustrator', 'adobe illustrator'],
    'adobe indesign': ['indesign', 'adobe indesign'],
    'adobe creative suite': ['adobe creative suite', 'adobe creative cloud', 'creative suite', 'adobe cc'],
    'canva': ['canva'],
    'sketch': ['sketch'],
    'ui/ux': ['ui/ux', 'ui ux', 'user interface', 'user experience', 'ux design', 'ui design'],

    // ── CMS / Content ─────────────────────────────────────────────────────────
    'wordpress': ['wordpress', 'word press'],
    'sitecore': ['sitecore'],
    'contentstack': ['contentstack', 'content stack'],
    'drupal': ['drupal'],
    'contentful': ['contentful'],
    'hubspot': ['hubspot', 'hub spot'],
    'content management': ['content management', 'cms management', 'cms'],
    'content strategy': ['content strategy', 'content planning'],
    'content writing': ['content writing', 'copywriting', 'content creation', 'technical writing', 'blog writing'],
    'seo': ['seo', 'search engine optimization', 'search engine optimisation', 'on-page seo', 'off-page seo', 'aeo'],
    'sem': ['sem', 'search engine marketing', 'paid search', 'google ads', 'ppc'],
    'social media marketing': ['social media marketing', 'social media management', 'social media strategy', 'social media', 'smm'],
    'email marketing': ['email marketing', 'email campaigns', 'mailchimp', 'sendgrid'],
    'google analytics': ['google analytics', 'ga4', 'google analytics 4'],
    'digital marketing': ['digital marketing', 'online marketing', 'performance marketing'],
    'accessibility': ['wcag', 'cpacc', 'accessibility compliance', 'web accessibility', 'section 508'],

    // ── Methodology ───────────────────────────────────────────────────────────
    'agile': ['agile', 'agile methodology'],
    'scrum': ['scrum', 'scrum master'],
    'kanban': ['kanban'],
    'waterfall': ['waterfall'],
    'prince2': ['prince2'],
    'pmp': ['pmp', 'project management professional'],
    'six sigma': ['six sigma', '6 sigma', 'lean six sigma'],
    'lean': ['lean', 'lean management', 'lean methodology'],

    // ── HR / People ───────────────────────────────────────────────────────────
    'recruitment': ['recruitment', 'recruiting', 'end to end recruitment', 'end-to-end recruitment', 'e2e recruitment', 'full cycle recruiting', 'talent sourcing'],
    'talent acquisition': ['talent acquisition', 'ta'],
    'sourcing': ['sourcing', 'resume sourcing', 'candidate sourcing', 'boolean search'],
    'hr operations': ['hr operations', 'hr ops', 'core hr'],
    'payroll': ['payroll', 'payroll processing', 'salary processing', 'payroll management', 'payroll administration'],
    'onboarding': ['onboarding', 'joining formalities', 'induction', 'new hire onboarding', 'employee onboarding'],
    'offboarding': ['offboarding', 'exit formalities', 'exit management', 'separation management', 'exit process'],
    'performance management': ['performance management', 'performance appraisal', 'performance review', 'kra', 'kpi', 'pms', 'appraisal'],
    'employee relations': ['employee relations', 'employee engagement', 'grievance handling', 'grievance management', 'disciplinary'],
    'statutory compliance': ['statutory compliance', 'compliance management', 'labour law', 'labor law', 'pf', 'esic', 'esi', 'epf', 'provident fund', 'gratuity', 'pt', 'professional tax', 'tds', 'statutory'],
    'background verification': ['background verification', 'bgv', 'background check', 'background screening', 'employment verification'],
    'training & development': ['training & development', 'training and development', 'learning & development', 'l&d', 'learning and development'],
    'compensation & benefits': ['compensation & benefits', 'compensation and benefits', 'c&b', 'c and b', 'benefits administration', 'compensation management', 'salary structure'],
    'hr policies': ['hr policies', 'policy development', 'policy framing', 'sop', 'standard operating procedure'],
    'workforce planning': ['workforce planning', 'manpower planning', 'headcount planning', 'capacity planning'],
    'succession planning': ['succession planning'],
    'organizational development': ['organizational development', 'od', 'organisation development', 'change management'],
    'vendor management': ['vendor management', 'vendor coordination', 'third party management'],
    'hr documentation': ['hr documentation', 'hr admin', 'hr administration'],
    'ats': ['ats', 'applicant tracking system', 'applicant tracking'],
    'hrms': ['hrms', 'hcm', 'human capital management', 'hr system'],
    'workday': ['workday'],
    'sap': ['sap', 'sap hr', 'sap hcm', 'sap successfactors', 'sap erp'],
    'bamboohr': ['bamboohr', 'bamboo hr'],
    'greythr': ['greythr', 'greyt hr'],
    'darwinbox': ['darwinbox'],
    'keka': ['keka'],
    'zoho people': ['zoho people', 'zoho hr'],
    'oracle hrms': ['oracle hrms', 'oracle hcm', 'oracle fusion'],
    'naukri': ['naukri', 'naukri.com'],
    'linkedin recruiter': ['linkedin recruiter', 'linkedin hiring'],
    'employee lifecycle': ['employee lifecycle', 'employee life cycle'],
    'hr mis': ['hr mis', 'hr reporting', 'workforce reporting'],

    // ── Finance / Accounting ──────────────────────────────────────────────────
    'accounting': ['accounting', 'accountancy'],
    'financial analysis': ['financial analysis', 'financial modelling', 'financial modeling'],
    'financial reporting': ['financial reporting', 'financial statements', 'p&l', 'balance sheet', 'income statement'],
    'taxation': ['taxation', 'income tax', 'gst', 'indirect tax', 'direct tax', 'tax compliance'],
    'auditing': ['auditing', 'audit', 'internal audit', 'statutory audit'],
    'budgeting': ['budgeting', 'budgeting and forecasting', 'forecasting'],
    'accounts payable': ['accounts payable', 'ap'],
    'accounts receivable': ['accounts receivable', 'ar'],
    'bank reconciliation': ['bank reconciliation', 'reconciliation'],
    'tally': ['tally', 'tally erp', 'tally prime'],
    'quickbooks': ['quickbooks', 'quick books'],
    'ifrs': ['ifrs', 'international financial reporting standards'],
    'gaap': ['gaap'],
    'cost accounting': ['cost accounting', 'costing'],
    'erp': ['erp', 'enterprise resource planning'],

    // ── Marketing / Sales ─────────────────────────────────────────────────────
    'sales': ['sales', 'b2b sales', 'b2c sales', 'inside sales', 'field sales', 'retail sales'],
    'business development': ['business development', 'biz dev', 'bd'],
    'key account management': ['key account management', 'account management', 'key accounts', 'client management'],
    'crm': ['crm', 'customer relationship management'],
    'salesforce': ['salesforce', 'sfdc'],
    'customer service': ['customer service', 'customer support', 'customer success', 'customer experience'],
    'brand management': ['brand management', 'branding'],
    'market research': ['market research', 'market analysis'],
    'product marketing': ['product marketing'],
    'event management': ['event management', 'events', 'event coordination', 'event planning'],
    'public relations': ['public relations', 'pr'],

    // ── Operations / Admin ────────────────────────────────────────────────────
    'operations management': ['operations management', 'operations'],
    'supply chain': ['supply chain', 'supply chain management', 'scm'],
    'logistics': ['logistics', 'logistics management'],
    'procurement': ['procurement', 'purchasing', 'purchase management'],
    'facilities management': ['facilities management', 'facility management', 'admin', 'administration'],
    'quality management': ['quality management', 'quality assurance', 'qa', 'quality control', 'qc', 'iso'],
    'inventory management': ['inventory management', 'inventory control', 'warehouse management'],

    // ── Soft skills ───────────────────────────────────────────────────────────
    'communication': ['communication', 'verbal communication', 'written communication'],
    'leadership': ['leadership', 'team leadership', 'people management'],
    'teamwork': ['teamwork', 'team player', 'collaboration'],
    'problem solving': ['problem solving', 'problem-solving', 'analytical thinking', 'critical thinking'],
    'time management': ['time management'],
    'negotiation': ['negotiation', 'negotiation skills'],
    'presentation': ['presentation', 'presentation skills'],
    'stakeholder management': ['stakeholder management', 'stakeholder engagement'],
    'project management': ['project management', 'program management'],
    'product management': ['product management', 'product manager'],
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Compile once: canonical → [regex, ...]
const COMPILED = Object.entries(SKILLS).map(([canonical, aliases]) => ({
    canonical,
    patterns: aliases.map((alias) => {
        const body = alias.replace(/\s+/g, '\\s+');
        return new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, 'i');
    }),
}));

function firstSkillIndex(text, patterns) {
    let best = -1;
    for (const re of patterns) {
        const m = re.exec(text);
        if (m && (best === -1 || m.index < best)) best = m.index;
    }
    return best;
}

// ── Text pre-processing ───────────────────────────────────────────────────────
function normalizeText(raw) {
    let t = String(raw || '');

    // Remove PII placeholders inserted by masking layer — they confuse every extractor
    t = t.replace(/\[Contact via[^\]]*\]/gi, '');
    t = t.replace(/\[Profile via[^\]]*\]/gi, '');

    // Remove bullet/special chars that often appear at line-start
    t = t.replace(/[❖✓●►▪▸▶•◦‣⁃‐]/g, ' ');
    // Collapse tabs and non-breaking spaces to regular space
    t = t.replace(/[\t     ]/g, ' ');
    // Remove carriage returns
    t = t.replace(/\r/g, '');
    // Collapse 3+ blank lines to 2
    t = t.replace(/\n{3,}/g, '\n\n');

    return t;
}

// Detect space-less PDFs by looking for known section headers that appear fused
// (e.g. "ProfileSummary", "KeySkills", "JobExperience") — a clear sign the PDF
// had no spaces extracted. Falls back to counting long CamelCase tokens.
function tryFixSpaceless(text) {
    const FUSED_MARKERS = [
        /ProfileSummary/i, /KeySkills/i, /JobExperience/i, /WorkExperience/i,
        /CareerHighlights/i, /ProfessionalSummary/i, /PersonalInfo/i,
        /ContactInfo/i, /AcademicBackground/i, /EducationDetails/i,
        /ProfessionalBackground/i, /CareerObjective/i,
    ];
    if (FUSED_MARKERS.filter(re => re.test(text)).length >= 2) {
        return text.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    // Also handle very long mixed-case fused runs (other space-less PDF variants)
    const words = text.split(/\s+/).filter(Boolean);
    const longCamel = words.filter(w => w.length > 15 && /[a-z]/.test(w) && /[A-Z]/.test(w));
    if (longCamel.length >= 3) {
        return text.replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    return text;
}

// ── Skills ───────────────────────────────────────────────────────────────────
function extractSkills(text) {
    if (!text) return [];
    const t = normalizeText(text);
    const norm = tryFixSpaceless(t);
    const found = [];
    for (const { canonical, patterns } of COMPILED) {
        if (patterns.some((re) => re.test(norm))) found.push(canonical);
    }
    return found;
}

const PREFERRED_CUE = /(nice[ -]to[ -]have|preferred|good[ -]to[ -]have|desirable|bonus|plus point|added advantage|advantage|optional|a plus)/i;

function extractJobSkills(text) {
    if (!text) return { required: [], preferred: [] };
    const norm = normalizeText(tryFixSpaceless(text));
    const required = [], preferred = [];
    for (const { canonical, patterns } of COMPILED) {
        const idx = firstSkillIndex(norm, patterns);
        if (idx === -1) continue;
        const lead = norm.slice(Math.max(0, idx - 130), idx);
        if (PREFERRED_CUE.test(lead)) preferred.push(canonical);
        else required.push(canonical);
    }
    const reqSet = new Set(required);
    return { required, preferred: preferred.filter(s => !reqSet.has(s)) };
}

// ── Contact details & links ───────────────────────────────────────────────────
function extractEmail(text) {
    const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0].trim().toLowerCase() : '';
}

function extractPhone(text) {
    const m = text.match(/(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{3,4}/g);
    if (!m) return '';
    const cand = m.map(s => s.trim()).filter(s => s.replace(/\D/g, '').length >= 10);
    return cand.length ? cand[0] : '';
}

function extractLinkedIn(text) {
    const m = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]+(?:\/[A-Za-z0-9_%-]+)*/i);
    if (!m) return '';
    return m[0].startsWith('http') ? m[0] : `https://${m[0]}`;
}

function extractPortfolio(text, linkedin) {
    const gh = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i);
    if (gh) return gh[0].startsWith('http') ? gh[0] : `https://${gh[0]}`;
    const urls = text.match(/(?:https?:\/\/)[A-Za-z0-9./?=#%_-]+/gi) || [];
    const other = urls.find(u => !/linkedin\.com/i.test(u) && u !== linkedin);
    return other || '';
}

// ── Name / headline ───────────────────────────────────────────────────────────
const SECTION_WORDS = new Set([
    'resume', 'curriculum', 'vitae', 'cv', 'profile', 'summary', 'objective',
    'contact', 'email', 'phone', 'address', 'experience', 'education', 'skills',
    'projects', 'certifications', 'achievements', 'references', 'languages',
    'synopsis', 'highlights', 'history', 'background', 'overview', 'career',
    'personal', 'details', 'information',
]);

const TITLE_WORDS = /(engineer|developer|manager|analyst|consultant|designer|specialist|lead|architect|executive|intern|administrator|officer|coordinator|accountant|recruiter|marketer|scientist|associate|head|director|programmer|tester|qa|devops|hr|sales|support|strategist|planner|supervisor|assistant|partner|professional|expert|controller|advisor|communications|copywriter|content|writer|researcher|trainer|coach|founder|ceo|cto|cfo|vp|president)/i;

function titleCase(s) {
    return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const CONJUNCTIONS = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'to', 'a', 'an', 'with', 'by']);

function looksLikeName(line) {
    if (!line || line.length > 50) return false;
    if (/[@\d]/.test(line)) return false;
    if (/https?:|www\./i.test(line)) return false;
    if (/contact via|profile via/i.test(line)) return false;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 2 || tokens.length > 5) return false;
    for (const t of tokens) {
        if (!/^[A-Za-z][A-Za-z.'-]*$/.test(t)) return false;
        if (SECTION_WORDS.has(t.toLowerCase())) return false;
        // Names don't contain conjunctions like "and", "or", "of"
        if (CONJUNCTIONS.has(t.toLowerCase())) return false;
    }
    return true;
}

function isAllCaps(s) {
    return s === s.toUpperCase() && /[A-Z]{2,}/.test(s);
}

function extractName(lines, email) {
    // 1. All-caps name split across TWO consecutive short lines — checked first
    //    to prevent headline phrases from being picked up (e.g. MALLIKA / CHANDRASEKHAR)
    for (let i = 0; i < Math.min(lines.length - 1, 8); i++) {
        const a = lines[i].trim();
        const b = lines[i + 1].trim();
        if (isAllCaps(a) && isAllCaps(b) && a.length <= 25 && b.length <= 25
            && /^[A-Z][A-Z. ]+$/.test(a) && /^[A-Z][A-Z. ]+$/.test(b)
            && !SECTION_WORDS.has(a.toLowerCase()) && !SECTION_WORDS.has(b.toLowerCase())) {
            const combined = `${titleCase(a)} ${titleCase(b)}`.trim();
            if (combined.split(/\s+/).length >= 2) return combined;
        }
    }

    // 2. Standard single-line name (2–5 tokens, no digits/@, no section words, no conjunctions)
    for (const line of lines.slice(0, 8)) {
        if (looksLikeName(line)) {
            return /[a-z]/.test(line) && /[A-Z]/.test(line) ? line : titleCase(line);
        }
    }

    // 3. Space-less PDF: look for a CamelCase compound in first 5 lines that isn't a section header
    const FUSED_SECTION_STARTS = new Set([
        'profile', 'summary', 'experience', 'education', 'skills', 'resume',
        'contact', 'career', 'work', 'job', 'personal', 'professional',
        'academic', 'key', 'core',
    ]);
    for (const line of lines.slice(0, 5)) {
        const m = line.match(/^[A-Z][a-z]+(?:[A-Z][a-z]+){1,3}$/);
        if (!m) continue;
        const firstWord = m[0].match(/^[A-Z][a-z]+/)?.[0]?.toLowerCase();
        if (firstWord && FUSED_SECTION_STARTS.has(firstWord)) continue;
        return m[0].replace(/([A-Z])/g, ' $1').trim();
    }

    // 4. Fallback: first short ALL-CAPS line; strip "RESUME" prefix if fused
    for (const line of lines.slice(0, 10)) {
        let candidate = line.trim();
        if (/^RESUME[A-Z]{3,}/.test(candidate)) candidate = candidate.slice(6);
        if (isAllCaps(candidate) && candidate.length >= 4 && candidate.length <= 30
            && !SECTION_WORDS.has(candidate.toLowerCase())) {
            return titleCase(candidate);
        }
    }

    // 5. Email local-part
    if (email) {
        const local = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
        if (local) return titleCase(local);
    }
    return '';
}

function extractHeadline(lines, name) {
    // Find where the name ends in the lines array
    // Handle single-line name AND split all-caps names (e.g. MALLIKA / CHANDRASEKHAR)
    let nameIdx = lines.findIndex(l =>
        l === name || titleCase(l) === name ||
        l.replace(/\s+/g, ' ').trim() === name.trim()
    );
    if (nameIdx === -1 && name) {
        // Name may be split across two ALL-CAPS lines — find the last name part
        const parts = name.split(/\s+/);
        const lastPart = parts[parts.length - 1].toUpperCase();
        const firstPart = parts[0].toUpperCase();
        const lastIdx = lines.findIndex(l => l.trim().toUpperCase() === lastPart);
        const firstIdx = lines.findIndex(l => l.trim().toUpperCase() === firstPart);
        // Ensure first and last parts are on consecutive lines (true split-name case)
        if (lastIdx !== -1 && firstIdx !== -1 && lastIdx - firstIdx <= 2) {
            nameIdx = lastIdx;
        }
    }
    if (nameIdx !== -1) {
        for (let i = nameIdx + 1; i < Math.min(nameIdx + 5, lines.length); i++) {
            const l = lines[i];
            if (l && TITLE_WORDS.test(l) && l.length <= 100 && !/[@]/.test(l)
                && !SECTION_WORDS.has(l.split(/\s+/)[0].toLowerCase())) {
                return l.trim();
            }
        }
    }
    // Fallback: first title-like line in top 15 that isn't the name itself
    const nameLower = name.toLowerCase();
    for (const line of lines.slice(0, 15)) {
        if (line.toLowerCase() === nameLower) continue;
        if (name.split(/\s+/).some(p => line.trim().toUpperCase() === p.toUpperCase())) continue;
        if (line.length <= 100 && TITLE_WORDS.test(line) && !/[@]/.test(line)
            && !SECTION_WORDS.has(line.split(/\s+/)[0].toLowerCase())
            && !line.endsWith(',')) {
            return line.trim();
        }
    }
    return '';
}

// ── Location ──────────────────────────────────────────────────────────────────
const CITIES = [
    'mumbai', 'delhi', 'new delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai',
    'kolkata', 'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur', 'nagpur',
    'indore', 'thane', 'bhopal', 'visakhapatnam', 'vizag', 'patna', 'vadodara', 'noida',
    'gurgaon', 'gurugram', 'coimbatore', 'kochi', 'cochin', 'chandigarh', 'mysore', 'mysuru',
    'navi mumbai', 'pimpri', 'nashik', 'faridabad', 'meerut', 'rajkot', 'aurangabad',
    'jodhpur', 'madurai', 'ranchi', 'raipur', 'agra', 'amritsar', 'bhubaneswar',
    'dehradun', 'guwahati', 'thiruvananthapuram', 'trivandrum', 'mangalore', 'hubli',
    'london', 'new york', 'san francisco', 'singapore', 'dubai', 'toronto', 'sydney',
    'berlin', 'paris', 'tokyo', 'remote', 'work from home', 'wfh',
];
const CITY_RE = new RegExp(`(?<![A-Za-z])(${CITIES.map(escapeRegex).join('|')})(?![A-Za-z])`, 'i');

function extractLocation(text) {
    // 1. Explicit "Location:" label
    const lm = text.match(/(?:location|city|address)\s*[:\-–]\s*([^\n,]{3,60})/i);
    if (lm) {
        const loc = lm[1].trim().replace(/,.*$/, '').trim();
        if (loc.length > 2 && loc.length < 60) return titleCase(loc);
    }
    // 2. City name anywhere in text
    const m = text.match(CITY_RE);
    return m ? titleCase(m[1]) : '';
}

// ── Experience (years) ────────────────────────────────────────────────────────
const EXP_HEADER = /^(work\s+experience|professional\s+experience|professional\s+synopsis|employment(\s+history)?|experience|work\s+history|career\s+history|career\s+highlights?|job\s+experience|professional\s+background|relevant\s+experience|key\s+responsibilities|work\s+summary)\b/i;
const EXP_STOP = /^(education|academic(s)?|qualifications?|skills|technical\s+skills|core\s+skills|key\s+skills|projects?|certifications?|achievements|awards|publications|languages|interests|hobbies|references|summary|profile|objective|personal\s+details|personal\s+information|about(\s+me)?)\b/i;

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

function extractExperienceYears(rawText) {
    const t = rawText.toLowerCase();

    // 1a. Explicit "X years Y months" form — "5 years 6 months" = 5.5
    const ymMatch = t.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s*(?:and\s+)?(\d{1,2})\s*(?:months?|mnths?)/i);
    if (ymMatch) {
        const yrs = parseFloat(ymMatch[1]);
        const mos = parseFloat(ymMatch[2]);
        const total = yrs + mos / 12;
        if (total > 0 && total <= 50) return Math.round(total * 2) / 2;
    }

    // 1b. Explicit "X years" (with experience context)
    let explicit = 0;
    const re = /(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)/g;
    let m;
    while ((m = re.exec(t)) !== null) {
        const val = parseFloat(m[1]);
        if (val <= 0 || val > 50) continue;
        const around = t.slice(Math.max(0, m.index - 40), m.index + 40);
        if (/experien|exp\b|work|industry|professional|career|relevant|overall|total/.test(around)) {
            explicit = Math.max(explicit, val);
        }
    }
    if (explicit > 0) return explicit;

    // 2. Sum date ranges in experience section
    //    Handle approximate prefix ~, en-dash –, em-dash —
    const nowYear = new Date().getFullYear();
    const section = experienceSection(rawText.split('\n').map(l => l.trim()));
    const haystack = section || rawText;
    const ranges = [...haystack.matchAll(/~?\s*((?:19|20)\d{2})\s*[-–—to]+\s*~?\s*((?:19|20)\d{2}|present|current|now|till\s+date|ongoing|date)/gi)];
    let total = 0;
    for (const r of ranges) {
        const start = parseInt(r[1], 10);
        const end = /^(?:19|20)\d{2}$/.test(r[2].trim()) ? parseInt(r[2].trim(), 10) : nowYear;
        if (end >= start && end - start <= 40) total += (end - start);
    }
    if (total > 0) return Math.min(total, 50);

    return 0;
}

// ── Education ─────────────────────────────────────────────────────────────────
const DEGREES = [
    [/ph\.?\s?d|doctorate/i, 'PhD'],
    [/m\.?\s?tech|master\s+of\s+technology/i, 'M.Tech'],
    [/b\.?\s?tech|bachelor\s+of\s+technology/i, 'B.Tech'],
    [/m\.?\s?b\.?a|master\s+of\s+business\s+administration/i, 'MBA'],
    [/b\.?\s?b\.?a|bachelor\s+of\s+business/i, 'BBA'],
    [/m\.?\s?c\.?a|master\s+of\s+computer\s+applications/i, 'MCA'],
    [/b\.?\s?c\.?a|bachelor\s+of\s+computer\s+applications/i, 'BCA'],
    [/m\.?\s?sc|master\s+of\s+science/i, 'M.Sc'],
    [/b\.?\s?sc|bachelor\s+of\s+science/i, 'B.Sc'],
    [/m\.?\s?com|master\s+of\s+commerce/i, 'M.Com'],
    [/b\.?\s?com|bachelor\s+of\s+commerce/i, 'B.Com'],
    [/m\.?\s?e\b|master\s+of\s+engineering/i, 'M.E'],
    [/b\.?\s?e\b|bachelor\s+of\s+engineering/i, 'B.E'],
    [/m\.?\s?a\b|master\s+of\s+arts/i, 'M.A'],
    [/b\.?\s?a\b|bachelor\s+of\s+arts/i, 'B.A'],
    [/pgd|post\s*graduate\s+diploma/i, 'PGD'],
    [/diploma/i, 'Diploma'],
    [/10\+2|intermediate|hsc|higher\s+secondary/i, 'HSC'],
    [/10th|ssc|matriculation\b|secondary\s+school/i, 'SSC'],
];

const INSTITUTION_RE = /(university|institution|institute|college|school|academy|polytechnic|iit|nit|iiit|bits|management|business\s+school)/i;

// strip leading junk chars and parentheses wrapping from education lines
function cleanEduLine(s) {
    return s.replace(/^[\s(❖✓●►▪•\-–]+/, '').replace(/[)]+$/, '').trim();
}

function extractEducation(text) {
    // Work on cleaned text
    const cleaned = text.replace(/[❖✓●►▪▸▶•◦‣⁃‐]/g, ' ');
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    const out = [];
    const seen = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = cleanEduLine(lines[i]);
        const deg = DEGREES.find(([re]) => re.test(line));
        if (!deg) continue;

        const years = (line.match(/(?:19|20)\d{2}/g) || []).map(y => parseInt(y, 10));

        // Field + institution extraction
        let institution = '';
        let field = '';

        // Try to parse "DEGREE, FIELD – INSTITUTION, Location" pattern on same line
        // e.g. "MBA, HR – Vivekananda Group Of Institutions, Hyderabad"
        //      "B.Tech, ECE - Vardhaman College Of Engineering, Hyderabad"
        // Use negative lookahead/behind to avoid matching year-range dashes (2014-2016)
        const stripped = line.replace(deg[0], '').replace(/^[\s,.]+/, '').trim();
        const sepMatch = stripped.match(/(?<!\d)\s*([-–|])\s*(?!\d)/);
        const sepIdx = sepMatch ? sepMatch.index : -1;
        if (sepIdx !== -1) {
            const beforeSep = stripped.slice(0, sepIdx).trim();
            const afterSep = stripped.slice(sepIdx).replace(/^\s*[-–|]\s*/, '').trim();
            if (!field && beforeSep && beforeSep.length < 50
                && !/\d/.test(beforeSep)
                && !INSTITUTION_RE.test(beforeSep)) {
                field = beforeSep.split(/,/)[0].trim();
            }
            if (INSTITUTION_RE.test(afterSep)) {
                institution = afterSep.split(/,/)[0].trim();
            } else if (INSTITUTION_RE.test(line)) {
                institution = afterSep || stripped;
            }
        } else if (INSTITUTION_RE.test(line)) {
            // No word-based separator; institution IS embedded in this line
            institution = stripped.split(/,/)[0].trim() || stripped;
        }

        // Fallback: handle "FIELD YEAR(s) INSTITUTION" pattern
        // e.g. "Applied Psychology 2014-2016 Annamalai University" (after degree stripped)
        // Run regardless to improve institution accuracy when years are present on the same line
        if (years.length > 0 || !field) {
            const cleanStripped = stripped.replace(/^[.\s]+/, '').trim();
            const firstYearM = cleanStripped.match(/(?:19|20)\d{2}/);
            if (firstYearM) {
                const fyIdx = cleanStripped.indexOf(firstYearM[0]);
                if (!field && fyIdx > 1) {
                    const bf = cleanStripped.slice(0, fyIdx).trim().replace(/[,\-]+$/, '').trim();
                    if (bf && bf.length < 60 && !/\d/.test(bf) && !INSTITUTION_RE.test(bf)) {
                        field = bf;
                    }
                }
                // Extract institution from after all year tokens — always overrides messy same-line extraction
                const afterYears = cleanStripped
                    .slice(fyIdx)
                    .replace(/^[\s\d\-–]+/, '')
                    .trim();
                if (INSTITUTION_RE.test(afterYears)) {
                    institution = afterYears.split(/,/)[0].trim();
                }
            }
        }

        // Look at next 2 lines if institution still not found
        if (!institution) {
            for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
                const nl = cleanEduLine(lines[k]);
                if (INSTITUTION_RE.test(nl)) { institution = nl.split(/,/)[0].trim(); break; }
            }
        }

        institution = institution
            .replace(/(?:19|20)\d{2}/g, '')
            .replace(/[|,;()\-–]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .slice(0, 150);

        // Field fallback: "(MBA, HR)" parenthetical or "in/of X" pattern
        if (!field) {
            const parenField = line.match(/\((?:[A-Z]{2,5}),\s*([A-Za-z &]+)\)/);
            if (parenField) {
                field = parenField[1].trim();
            } else {
                const fieldM = line.match(/(?:\bin\b|\bof\b)\s+([A-Za-z ,&]{3,40})/i);
                if (fieldM) field = fieldM[1].trim().replace(/,.*$/, '').trim();
                // Don't capture institution names as field
                if (field && INSTITUTION_RE.test(field)) field = '';
            }
        }

        const key = `${deg[1]}|${years[0] || field.slice(0, 10)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
            degree: deg[1],
            institution: institution || '',
            field: field || '',
            start_year: years.length >= 2 ? years[0] : null,
            end_year: years.length >= 2 ? years[1] : (years[0] || null),
            grade: '',
        });
    }
    return out;
}

// ── Summary ───────────────────────────────────────────────────────────────────
const SUMMARY_START = /^\s*(professional\s+summary|profile\s+summary|executive\s+summary|career\s+summary|career\s+profile|career\s+objective|professional\s+profile|professional\s+synopsis|professional\s+background|summary|profile|objective|about(\s+me)?|overview|background)\s*[:\-]?\s*$/i;
const SECTION_STOP_SUMMARY = /^\s*(work\s+experience|professional\s+experience|employment|experience|education|academic|skills|technical\s+skills|core\s+skills|key\s+skills|projects?|certifications?|achievements|awards|languages|interests|hobbies|references|contact|career\s+highlights?)\s*[:\-]?\s*$/i;

function extractSummary(text) {
    const lines = text.split('\n').map(l => l.trim());

    for (let i = 0; i < lines.length; i++) {
        if (SUMMARY_START.test(lines[i])) {
            const buf = [];
            for (let j = i + 1; j < lines.length && buf.join(' ').length < 800; j++) {
                if (!lines[j]) { if (buf.length) break; continue; }
                if (SECTION_STOP_SUMMARY.test(lines[j])) break;
                buf.push(lines[j]);
            }
            const s = buf.join(' ').trim();
            if (s.length > 30) return s.slice(0, 800);
        }
    }

    // Inline "Summary: ...." on one line
    const inline = text.match(/(?:summary|objective|profile|synopsis)\s*[:\-]\s*(.{40,800})/i);
    if (inline) return inline[1].split('\n')[0].trim().slice(0, 800);

    // First substantial paragraph that isn't contact info or a header
    for (const line of lines.slice(1, 30)) {
        if (line.length > 80
            && !/[@]|https?:|www\./i.test(line)
            && !SECTION_STOP_SUMMARY.test(line)
            && !SUMMARY_START.test(line)) {
            return line.slice(0, 800);
        }
    }
    return '';
}

// ── Public composite parsers ──────────────────────────────────────────────────
function parseFullProfile(text) {
    const raw = normalizeText(String(text || ''));
    const norm = tryFixSpaceless(raw);
    const lines = norm.split('\n').map(l => l.trim()).filter(Boolean);

    const email = extractEmail(norm);
    const linkedin = extractLinkedIn(norm);
    const name = extractName(lines, email);

    return {
        full_name:        name,
        email,
        phone:            extractPhone(norm),
        headline:         extractHeadline(lines, name),
        location:         extractLocation(norm),
        experience_years: extractExperienceYears(norm),
        linkedin_url:     linkedin,
        portfolio_url:    extractPortfolio(norm, linkedin),
        summary:          extractSummary(norm),
        education:        extractEducation(norm),
        skills:           extractSkills(norm),
    };
}

function parseResumeText(text) {
    const norm = normalizeText(tryFixSpaceless(String(text || '')));
    return {
        skills:           extractSkills(norm),
        experience_years: extractExperienceYears(norm),
        summary:          extractSummary(norm),
    };
}

module.exports = {
    parseFullProfile,
    parseResumeText,
    extractSkills,
    extractJobSkills,
};
