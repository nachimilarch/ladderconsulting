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

    // ── Engineering / CAD / Infrastructure ────────────────────────────────────
    'autocad': ['autocad', 'auto cad'],
    'revit': ['revit', 'revit architecture', 'revit structure', 'revit mep', 'autodesk revit'],
    'staad pro': ['staad\\.pro', 'staad pro', 'staadpro'],
    'etabs': ['etabs'],
    'bim': ['bim', 'building information model', 'building information modelling'],
    'structural engineering': ['structural engineering', 'structural design', 'structural analysis', 'structural detailing'],
    'civil engineering': ['civil engineering', 'civil construction', 'civil works'],
    'site management': ['site management', 'site supervision', 'site engineering', 'site execution'],
    'quantity surveying': ['quantity survey', 'quantity estimation', 'bill of quantities', 'boq', 'quantity takeoff', 'bar bending schedule'],
    'mep engineering': ['mep engineering', 'mechanical electrical plumbing'],
    'autocad civil 3d': ['civil 3d', 'autocad civil 3d'],

    // ── Embedded / Firmware / Hardware ────────────────────────────────────────
    'embedded c': ['embedded c', 'embedded-c', 'embedded c programming'],
    'embedded systems': ['embedded systems', 'embedded system', 'embedded programming', 'embedded software', 'embedded development', 'embedded firmware'],
    'embedded linux': ['embedded linux'],
    'firmware': ['firmware', 'firmware development', 'firmware programming'],
    'autosar': ['autosar'],
    'rtos': ['rtos', 'real-time os', 'real-time operating system', 'real time os'],
    'freertos': ['freertos', 'free rtos'],
    'arm': ['arm cortex', 'arm microcontroller', 'arm processor'],
    'microcontroller': ['microcontroller', 'microcontrollers'],
    'iot': ['iot', 'internet of things', 'iot development', 'iot solutions'],
    'mqtt': ['mqtt'],
    'can bus': ['can bus', 'can protocol', 'controller area network'],
    'uart': ['uart'],
    'iso 26262': ['iso.26262', 'iso26262', 'automotive functional safety', 'asil'],
    'pcb design': ['pcb design', 'pcb layout', 'eagle pcb', 'altium designer', 'kicad'],
    'fpga': ['fpga', 'vhdl', 'verilog'],
    'plc': ['plc programming', 'plc', 'scada', 'hmi'],

    // ── Java / JVM Ecosystem ──────────────────────────────────────────────────
    'hibernate': ['hibernate', 'hibernate orm'],
    'jpa': ['java persistence api', 'spring data jpa', 'jakarta persistence'],
    'jdbc': ['jdbc', 'java database connectivity'],
    'maven': ['maven', 'apache maven'],
    'gradle': ['gradle'],
    'testng': ['testng'],
    'mockito': ['mockito'],
    'j2ee': ['j2ee', 'java ee', 'jakarta ee', 'jsp', 'servlets', 'java servlets'],
    'spring mvc': ['spring mvc', 'spring framework'],
    'spring security': ['spring security'],
    'spring cloud': ['spring cloud', 'microservices spring'],
    'intellij': ['intellij', 'intellij idea'],

    // ── Sales & Business Development ──────────────────────────────────────────
    'lead generation': ['lead generation', 'lead gen', 'lead sourcing', 'generating leads'],
    'cold calling': ['cold calling', 'cold call', 'outbound calling', 'outbound dialing', 'outbound sales'],
    'upselling': ['upselling', 'up-selling', 'upsell'],
    'cross-selling': ['cross-selling', 'cross selling', 'cross-sell'],
    'territory management': ['territory management', 'territory development', 'territory planning'],
    'telesales': ['telesales', 'tele-sales', 'telephone sales', 'telecalling', 'tele-calling'],
    'customer acquisition': ['customer acquisition', 'client acquisition', 'new client development'],
    'target achievement': ['target achievement', 'revenue achievement', 'sales target', 'quota achievement', 'target oriented'],
    'funnel management': ['funnel management', 'pipeline management', 'sales funnel'],
    'product demonstration': ['product demonstration', 'product demo', 'product presentations'],
    'channel sales': ['channel sales', 'dealer management', 'distributor management', 'channel management'],
    'retail management': ['retail management', 'store management', 'retail operations'],

    // ── Collections / Recovery / BFSI ─────────────────────────────────────────
    'debt recovery': ['debt recovery', 'debt collection', 'dra certif', 'dra certified', 'recovery agent', 'loan recovery', 'financial recovery', 'outstanding recovery', 'overdue recovery'],
    'collections': ['collections executive', 'collections team', 'collection target', 'loan collections', 'emi collections'],
    'banking': ['banking', 'retail banking', 'corporate banking', 'banking operations', 'branch banking'],
    'insurance': ['insurance', 'life insurance', 'general insurance', 'insurance sales', 'insurance operations', 'underwriting'],
    'credit management': ['credit management', 'credit control', 'credit analysis', 'credit appraisal', 'credit underwriting'],
    'nbfc': ['nbfc', 'non-banking financial', 'non banking finance'],
    'rbi compliance': ['rbi compliance', 'rbi guidelines', 'rbi regulations', 'banking compliance', 'sebi compliance', 'regulatory compliance'],
    'mutual funds': ['mutual funds', 'ams', 'portfolio management', 'wealth management', 'investment advisory'],
    'stock market': ['stock market', 'equity research', 'capital markets', 'equity trading', 'derivatives'],

    // ── BPO / Contact Centre / Support ────────────────────────────────────────
    'bpo': ['bpo', 'business process outsourcing', 'call centre', 'call center', 'contact centre', 'contact center'],
    'kpo': ['kpo', 'knowledge process outsourcing'],
    'voice process': ['voice process', 'voice support', 'inbound process', 'inbound calling', 'blended process'],
    'non-voice process': ['non-voice process', 'non voice', 'backend process', 'back office process'],
    'data entry': ['data entry', 'data processing', 'data management'],
    'chat support': ['chat support', 'email support', 'ticket management', 'helpdesk'],
    'technical support': ['technical support', 'tech support', 'it helpdesk', 'l1 support', 'l2 support'],

    // ── Digital Marketing — Additional ────────────────────────────────────────
    'meta ads': ['meta ads', 'facebook ads', 'instagram ads', 'fb ads', 'meta advertising'],
    'affiliate marketing': ['affiliate marketing', 'affiliate program', 'affiliate campaigns'],
    'influencer marketing': ['influencer marketing', 'influencer management', 'creator marketing'],
    'google tag manager': ['google tag manager', 'gtm'],
    'marketing automation': ['marketing automation', 'marketo', 'pardot', 'crm automation'],
    'conversion rate optimization': ['conversion rate optim', 'landing page optim', 'cro specialist'],
    'video editing': ['video editing', 'video production', 'adobe premiere', 'final cut pro', 'davinci resolve'],
    'e-commerce': ['e-commerce', 'ecommerce', 'shopify', 'woocommerce', 'amazon seller', 'flipkart seller', 'd2c'],

    // ── HR — Additional ───────────────────────────────────────────────────────
    'campus hiring': ['campus hiring', 'campus recruitment', 'campus placement'],
    'lateral hiring': ['lateral hiring', 'lateral recruitment'],
    'executive search': ['executive search', 'headhunting', 'head hunting'],
    'bulk hiring': ['bulk hiring', 'mass hiring', 'volume hiring'],
    'contract staffing': ['contract staffing', 'staffing solutions', 'contract hiring', 'temp staffing'],
    'hr generalist': ['hr generalist', 'generalist hr', 'hr generalist role'],
    'hrbp': ['hrbp', 'hr business partner'],
    'job portals': ['naukri', 'monster jobs', 'indeed', 'shine\\.com', 'timesjobs', 'job portals'],
    'posh compliance': ['posh', 'posh compliance', 'prevention of sexual harassment'],
    'labour law': ['labour law', 'labor law', 'employment law', 'industrial relations', 'ir'],
    'expatriate management': ['expatriate management', 'expat management', 'global mobility'],

    // ── Finance / Accounting — Additional ─────────────────────────────────────
    'direct tax': ['direct tax', 'itr filing', 'income tax filing', 'tax returns'],
    'indirect tax': ['indirect tax', 'gst filing', 'gst compliance', 'gst returns', 'gst reconciliation'],
    'zoho books': ['zoho books', 'zoho accounting'],
    'accounts management': ['account management', 'accounts management', 'client account management'],
    'mis reporting': ['mis reporting', 'mis report', 'management information system report'],
    'internal control': ['internal control', 'internal controls', 'sox compliance', 'sox'],
    'cash flow': ['cash flow', 'cash flow management', 'treasury'],
    'fund accounting': ['fund accounting', 'hedge fund', 'private equity accounting'],

    // ── Design — Additional ───────────────────────────────────────────────────
    'adobe xd': ['adobe xd'],
    'zeplin': ['zeplin'],
    'invision': ['invision'],
    'prototyping': ['prototyping', 'wireframing', 'wireframe', 'lo-fi prototype', 'hi-fi prototype'],
    'motion graphics': ['motion graphics', 'after effects', 'adobe after effects', 'animation'],
    '3d modeling': ['3d modeling', '3ds max', '3d max', 'blender', 'cinema 4d', 'zbrush'],
    'brand design': ['brand design', 'brand identity', 'visual identity', 'logo design'],

    // ── Data / Analytics — Additional ────────────────────────────────────────
    'alteryx': ['alteryx'],
    'dbt': ['dbt', 'data build tool'],
    'databricks': ['databricks'],
    'azure synapse': ['azure synapse', 'synapse analytics'],
    'aws redshift': ['redshift', 'amazon redshift'],
    'metabase': ['metabase'],
    'grafana': ['grafana'],
    'matplotlib': ['matplotlib', 'seaborn', 'plotly'],
    'scikit-learn': ['scikit-learn', 'sklearn'],
    'data warehousing': ['data warehousing', 'data warehouse', 'data lake', 'lakehouse'],
    'etl': ['etl', 'elt', 'data pipeline', 'data ingestion'],
    'a/b testing': ['a/b testing', 'ab testing', 'hypothesis testing', 'statistical testing'],
    'sql server reporting': ['ssrs', 'ssas', 'ssis', 'sql server reporting'],

    // ── Project / Collaboration Tools — Additional ────────────────────────────
    'notion': ['notion'],
    'clickup': ['clickup', 'click up'],
    'smartsheet': ['smartsheet'],
    'ms visio': ['ms visio', 'microsoft visio', 'visio'],
    'g suite': ['g suite', 'google workspace', 'google docs', 'google sheets', 'google slides'],

    // ── Cloud / DevOps — Additional ───────────────────────────────────────────
    'azure devops': ['azure devops', 'azure boards', 'azure pipelines'],
    'aws lambda': ['aws lambda', 'serverless', 'serverless framework'],
    'github actions': ['github actions', 'ci github actions'],
    'sonarqube': ['sonarqube', 'sonar'],
    'prometheus': ['prometheus'],
    'elk stack': ['elk stack', 'logstash', 'kibana'],
    'vault': ['hashicorp vault', 'secrets management'],

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
    'mentoring': ['mentoring', 'coaching', 'mentorship', 'training delivery'],
    'conflict resolution': ['conflict resolution', 'dispute resolution', 'grievance resolution'],
    'multitasking': ['multitasking', 'multi-tasking'],
    'attention to detail': ['attention to detail'],
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
    // common section-header starters that appear after space-less PDF fixing
    'job', 'work', 'key', 'professional', 'academic', 'core', 'technical',
]);

const TITLE_WORDS = /(engineer|developer|manager|analyst|consultant|designer|specialist|lead|architect|executive|intern|administrator|officer|coordinator|accountant|recruiter|marketer|scientist|associate|head|director|programmer|tester|qa|devops|hr|sales|support|strategist|planner|supervisor|assistant|partner|professional|expert|controller|advisor|communications|copywriter|content|writer|researcher|trainer|coach|founder|ceo|cto|cfo|vp|president)/i;

function titleCase(s) {
    return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const CONJUNCTIONS = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'to', 'a', 'an', 'with', 'by']);

// Words that never appear inside a real person's name but DO appear in the
// 2–4 word phrases that leak through (section labels, addresses, boilerplate).
const NON_NAME_WORDS = new Set([
    'skills', 'skill', 'letter', 'covering', 'cover', 'organization', 'organizations',
    'organisation', 'organisations', 'location', 'current', 'permanent', 'activities',
    'activity', 'results', 'result', 'institute', 'institution', 'year', 'course',
    'cource', 'soft', 'across', 'resources', 'resource', 'declaration', 'objective',
    'objectives', 'summary', 'profile', 'synopsis', 'apercu', 'details', 'detail',
    'reference', 'references', 'experience', 'education', 'qualification', 'qualifications',
    'project', 'projects', 'company', 'designation', 'department', 'present', 'address',
    'nationality', 'gender', 'marital', 'status', 'hobbies', 'interests', 'languages',
    'strengths', 'achievements', 'certification', 'certifications', 'training',
    // address / geography tokens
    'nagar', 'district', 'road', 'street', 'colony', 'pradesh', 'telangana', 'andhra',
    'karnataka', 'maharashtra', 'tamil', 'nadu', 'kerala', 'state', 'city', 'india',
    'mandal', 'village', 'post', 'dist', 'pin', 'plot', 'flat', 'house',
]);

function looksLikeName(line) {
    if (!line || line.length > 50) return false;
    if (/[@\d]/.test(line)) return false;
    if (/https?:|www\./i.test(line)) return false;
    if (/contact via|profile via/i.test(line)) return false;
    if (isNoiseName(line)) return false;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 2 || tokens.length > 5) return false;
    for (const t of tokens) {
        if (!/^[A-Za-z][A-Za-z.'-]*$/.test(t)) return false;
        const lower = t.toLowerCase().replace(/[.'-]/g, '');
        if (SECTION_WORDS.has(lower)) return false;
        if (NON_NAME_WORDS.has(lower)) return false;
        // Names don't contain conjunctions like "and", "or", "of"
        if (CONJUNCTIONS.has(t.toLowerCase())) return false;
    }
    return true;
}

function isAllCaps(s) {
    return s === s.toUpperCase() && /[A-Z]{2,}/.test(s);
}

const TITLE_TOKEN = /\b(manager|executive|officer|engineer|developer|analyst|consultant|designer|specialist|architect|administrator|coordinator|accountant|recruiter|director|president|associate|assistant|expertise|professional|admin|synopsis|apercu)\b/i;

// Reject a candidate name string that is really a section header, job title,
// address fragment, or contains digits — used to gate the all-caps/camelCase
// fallback passes that don't run through looksLikeName().
function isNoiseName(str) {
    if (!str || /\d/.test(str)) return true;
    if (TITLE_TOKEN.test(str)) return true;
    const toks = str.toLowerCase().replace(/[.'-]/g, '').split(/\s+/).filter(Boolean);
    return toks.some(t => NON_NAME_WORDS.has(t) || SECTION_WORDS.has(t));
}

// A line that is nothing but a "Curriculum Vitae" / "Resume" / "Bio Data" banner.
// Uses loose curric*/vit* matching to tolerate the common "Curriculam Vitea" typos.
function isCvHeaderLine(line) {
    const squashed = line.replace(/[\s._-]+/g, '').toLowerCase();
    return /^(curric\w*vit\w*|cv|resume|biodata|bio|personalprofile|profile|myprofile)$/.test(squashed);
}

// A line that is a section header (not a name) — objective, summary, synopsis, etc.
const HEADER_LINE_RE = /^\s*(career\s+(objective|apercu|summary|profile|synopsis)s?|professional\s+(work\s+)?(summary|synopsis|profile|experience|background)|work\s+experience|objective|summary|profile|synopsis|about\s*(me)?|introduction|personal\s+(details|information|profile)|experience|education)\s*[:\-]?\s*$/i;

// Strip a leading "Curriculum Vitae" / "Resume" / "Bio Data" prefix that some
// resumes fuse onto the same line as the actual name (typo-tolerant).
function stripCvPrefix(line) {
    return line
        .replace(/^\s*(curric\w*\s+vit\w*|bio\s*-?\s*data|biodata|resume|c\.?\s*v\.?)\s*[:\-]?\s*/i, '')
        .trim();
}

// When a name is fused with the first contact label ("D.SHRIDHAREMAIL:...",
// "SAI DURGA PRASAD.PMobile: ..."), keep only the part before that label.
function stripFusedContact(line) {
    return line
        .replace(/(e-?mail|email\s*id|mobile|phone|contact|mob\b|tel\b|cell\b|linkedin|address|d\.?o\.?b).*$/i, '')
        .trim();
}

// Pull the name out of a "Name : Raghu Babu.k" style labelled line.
function extractLabelledName(lines) {
    for (const line of lines.slice(0, 12)) {
        const m = line.match(/^\s*(?:candidate\s+)?name\s*[:\-]\s*(.+)$/i);
        if (!m) continue;
        let val = stripFusedContact(m[1]).replace(/[.,\s]+$/, '').trim();
        // Reject if what follows the label is itself a section word or empty
        const tokens = val.split(/\s+/).filter(Boolean);
        if (tokens.length >= 1 && tokens.length <= 5
            && /^[A-Za-z][A-Za-z.'-]*$/.test(tokens[0])
            && !SECTION_WORDS.has(tokens[0].toLowerCase())) {
            return /[a-z]/.test(val) && /[A-Z]/.test(val) ? val : titleCase(val);
        }
    }
    return '';
}

function extractName(lines, email) {
    const allLines = lines; // keep the full document for the contact-adjacency pass

    // 0. Labelled "Name: X" — most reliable when present
    const labelled = extractLabelledName(lines);
    if (labelled) return labelled;

    // Build a cleaned view of the top lines: drop pure CV/section-header banners,
    // strip "Curriculum Vitae" prefixes and fused contact labels off the rest.
    const cleaned = [];
    for (const raw of lines.slice(0, 14)) {
        if (isCvHeaderLine(raw) || HEADER_LINE_RE.test(raw)) continue;
        let l = stripCvPrefix(raw);
        if (isCvHeaderLine(l) || !l) continue;
        cleaned.push(l);
    }
    lines = cleaned.length ? cleaned : lines;
    // 1. All-caps name split across TWO consecutive short lines — checked first
    //    to prevent headline phrases from being picked up (e.g. MALLIKA / CHANDRASEKHAR)
    for (let i = 0; i < Math.min(lines.length - 1, 8); i++) {
        const a = lines[i].trim();
        const b = lines[i + 1].trim();
        if (isAllCaps(a) && isAllCaps(b) && a.length <= 25 && b.length <= 25
            && /^[A-Z][A-Z. ]+$/.test(a) && /^[A-Z][A-Z. ]+$/.test(b)
            && !isNoiseName(a) && !isNoiseName(b)) {
            const combined = `${titleCase(a)} ${titleCase(b)}`.trim();
            if (combined.split(/\s+/).length >= 2 && !isNoiseName(combined)) return combined;
        }
    }

    // 2. Standard single-line name (2–5 tokens, no digits/@, no section words).
    //    Strip a fused trailing contact label first ("... PRASAD.PMobile: +91").
    for (const line of lines.slice(0, 8)) {
        const cand = stripFusedContact(line).replace(/[.,\s]+$/, '').trim();
        if (looksLikeName(cand)) {
            return /[a-z]/.test(cand) && /[A-Z]/.test(cand) ? cand : titleCase(cand);
        }
    }

    // 2b. "Name Title" on one line — e.g. "T RAMANUJA CHARY HR professional".
    //     Take the leading 2–4 capitalised tokens before a job-title word.
    for (const line of lines.slice(0, 6)) {
        const tm = line.match(/^((?:[A-Z][A-Za-z.'-]*\s+){1,3}[A-Z][A-Za-z.'-]*)\s+(?=[A-Za-z])/);
        if (!tm) continue;
        const head = tm[1].trim();
        const rest = line.slice(tm[0].length);
        if (TITLE_WORDS.test(rest) && looksLikeName(head)) {
            return /[a-z]/.test(head) && /[A-Z]/.test(head) ? head : titleCase(head);
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
        const split = m[0].replace(/([A-Z])/g, ' $1').trim();
        if (isNoiseName(split)) continue;
        return split;
    }

    // 4. Fallback: first short ALL-CAPS line; strip "RESUME" prefix if fused
    for (const line of lines.slice(0, 10)) {
        let candidate = line.trim();
        if (/^RESUME[A-Z]{3,}/.test(candidate)) candidate = candidate.slice(6);
        if (isAllCaps(candidate) && candidate.length >= 4 && candidate.length <= 30
            && !isNoiseName(candidate)) {
            return titleCase(candidate);
        }
    }

    // 4.5. Name buried near contact info — scan the FULL document for a name-like
    //      line sitting within one line of a phone/email/"contact" line. Handles
    //      resumes that lead with an objective and put the name beside contacts.
    const CONTACT_LINE = /(\+?\d[\d\s().-]{8,}|@|e-?mail|mobile|phone|contact\s*[:#])/i;
    for (let i = 0; i < allLines.length; i++) {
        if (!CONTACT_LINE.test(allLines[i])) continue;
        for (const j of [i - 1, i + 1, i - 2, i + 2]) {
            if (j < 0 || j >= allLines.length) continue;
            const cand = stripFusedContact(allLines[j]).replace(/[.,\s]+$/, '').trim();
            if (looksLikeName(cand) && !TITLE_WORDS.test(cand)) {
                return /[a-z]/.test(cand) && /[A-Z]/.test(cand) ? cand : titleCase(cand);
            }
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
    // 1. Explicit "Location:"/"City:" label. Prefer a known city inside the value;
    //    reject street-address fragments (door/house/plot numbers, digits).
    const lm = text.match(/(?:location|current\s+location|city|address)\s*[:\-–]\s*([^\n]{3,80})/i);
    if (lm) {
        const val = lm[1].trim();
        const cityInVal = val.match(CITY_RE);
        if (cityInVal) return titleCase(cityInVal[1]);
        const loc = val.replace(/,.*$/, '').trim();
        // A real city label has no digits and isn't a door/plot/flat number.
        const isAddress = /\d/.test(loc) || /\b(h\.?\s*no|d\.?\s*no|door|flat|plot|street|road|lane|colony)\b/i.test(loc);
        if (!isAddress && loc.length > 2 && loc.length < 40) return titleCase(loc);
    }
    // 2. City name anywhere in text
    const m = text.match(CITY_RE);
    return m ? titleCase(m[1]) : '';
}

// ── Experience (years) ────────────────────────────────────────────────────────
const EXP_HEADER = /^(work\s+experience|professional\s+experience|professional\s+synopsis|employment(\s+history)?|experience|work\s+history|career\s+history|career\s+highlights?|job\s+experience|professional\s+background|relevant\s+experience|work\s+summary|organizational\s+experience|professional\s+work\s+experience)\b/i;
const EXP_STOP = /^(education|academic(s)?|qualifications?|educational\s+qualif|skills|technical\s+skills|core\s+skills|key\s+skills|projects?|certifications?|achievements|awards|publications|languages|interests|hobbies|references|personal\s+details|personal\s+information|declaration|about(\s+me)?)\b/i;

// Month names (full + abbreviated) and "present/current" cues, for date-range parsing
const MONTHS_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const PRESENT_RE = 'present|current(?:ly)?|till\\s*date|to\\s*date|till\\s*now|ongoing|now|date';
const DOB_LINE = /date\s*of\s*birth|d\.?\s*o\.?\s*b\b|\bdob\b|\bborn\b|birth\s*date|birthday/i;

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

// Career span from employment dates — robust to month-year formats, ranges split
// across lines, "till date"/"present", and date-of-birth contamination.
function spanFromDates(haystack, nowYear) {
    const starts = [], ends = [];
    let sawPresent = false;

    // Complete ranges: (Month? YYYY) sep (Month? YYYY | present)
    const rangeRe = new RegExp(
        `(?:${MONTHS_RE})?[\\s,.'’-]*((?:19|20)\\d{2})\\s*(?:[-–—]|to|till|until|through)\\s*` +
        `(?:(?:${MONTHS_RE})?[\\s,.'’-]*)?((?:19|20)\\d{2}|${PRESENT_RE})`,
        'gi'
    );
    let m;
    while ((m = rangeRe.exec(haystack)) !== null) {
        const s = parseInt(m[1], 10);
        if (s < 1970 || s > nowYear) continue;
        starts.push(s);
        if (/^(?:19|20)\d{2}$/.test(m[2])) {
            const e = parseInt(m[2], 10);
            if (e >= s && e <= nowYear + 1) ends.push(Math.min(e, nowYear));
        } else {
            sawPresent = true;
        }
    }

    // Standalone month-anchored years (e.g. "Jan 2024", "April 2016") — these are
    // almost always employment start/end dates; education uses bare years.
    const monthYearRe = new RegExp(`(?:${MONTHS_RE})[\\s,.'’-]+((?:19|20)\\d{2})`, 'gi');
    while ((m = monthYearRe.exec(haystack)) !== null) {
        const y = parseInt(m[1], 10);
        if (y >= 1970 && y <= nowYear) { starts.push(y); ends.push(y); }
    }
    if (new RegExp(`\\b(?:${PRESENT_RE})\\b`, 'i').test(haystack)) sawPresent = true;

    if (!starts.length) return 0;
    const minStart = Math.min(...starts);
    let maxEnd = ends.length ? Math.max(...ends) : minStart;
    if (sawPresent) maxEnd = Math.max(maxEnd, nowYear);
    const span = maxEnd - minStart;
    return (span > 0 && span <= 45) ? span : 0;
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
        const around = t.slice(Math.max(0, m.index - 45), m.index + 45);
        if (/experien|exp\b|work|industry|professional|career|relevant|overall|total/.test(around)) {
            explicit = Math.max(explicit, val);
        }
    }
    if (explicit > 0) return explicit;

    // 2. Career span from employment date ranges, computed ONLY within the
    //    isolated experience section. Scanning the whole document catches stray
    //    project/certification/graduation dates and wildly over-counts, so a
    //    missing section header means we skip this step rather than guess high.
    //    Strip DOB lines first so a birth year can't drag the earliest start back.
    const nowYear = new Date().getFullYear();
    const cleanLines = rawText.split('\n').filter(l => !DOB_LINE.test(l)).map(l => l.trim());
    const section = experienceSection(cleanLines);
    if (section) {
        const span = spanFromDates(section.toLowerCase(), nowYear);
        if (span > 0) return span;
    }

    // 3. Last resort: a single open-ended "since/from <Month?> YYYY"
    const since = t.match(new RegExp(`(?:since|from|w\\.e\\.f\\.?)\\s+(?:${MONTHS_RE})?[\\s,.'’-]*((?:19|20)\\d{2})`, 'i'));
    if (since) {
        const s = parseInt(since[1], 10);
        if (s >= 1970 && s <= nowYear) return Math.min(nowYear - s, 45);
    }

    return 0;
}

// ── Education ─────────────────────────────────────────────────────────────────
const DEGREES = [
    [/\bph\.?\s?d\b|doctorate/i, 'PhD'],
    [/\bm\.?[-\s]*tech\b|master\s+of\s+technology/i, 'M.Tech'],
    [/\bb\.?[-\s]*tech\b|bachelor\s+of\s+technology/i, 'B.Tech'],
    [/\bmba\b|\bm\.b\.a\.?\b|master\s+of\s+business\s+administration/i, 'MBA'],
    [/\bbba\b|\bb\.b\.a\.?\b|bachelor\s+of\s+business/i, 'BBA'],
    [/\bmca\b|\bm\.c\.a\.?\b|master\s+of\s+computer\s+applications/i, 'MCA'],
    [/\bbca\b|\bb\.c\.a\.?\b|bachelor\s+of\s+computer\s+applications/i, 'BCA'],
    [/\bm\.?\s?sc\b|\bmsc\b|master\s+of\s+science/i, 'M.Sc'],
    [/\bb\.?\s?sc\b|\bbsc\b|bachelor\s+of\s+science/i, 'B.Sc'],
    [/\bm\.?\s?com\b|\bmcom\b|master\s+of\s+commerce/i, 'M.Com'],
    [/\bb\.?\s?com\b|\bbcom\b|bachelor\s+of\s+commerce/i, 'B.Com'],
    [/\bm\.e\b|master\s+of\s+engineering/i, 'M.E'],
    [/\bb\.e\b|bachelor\s+of\s+engineering/i, 'B.E'],
    [/\bm\.a\b|master\s+of\s+arts/i, 'M.A'],
    [/\bb\.a\b|bachelor\s+of\s+arts/i, 'B.A'],
    [/\bpgd(m|ba)?\b|post\s*graduate\s+diploma/i, 'PGD'],
    [/\bdiploma\b/i, 'Diploma'],
    [/10\+2|\bintermediate\b|\bhsc\b|higher\s+secondary/i, 'HSC'],
    [/\b10th\b|\bssc\b|matriculation\b|secondary\s+school/i, 'SSC'],
    // Generic written-out degrees — kept LAST so specific ones above win first.
    // Handles "Master's Degree in Business Administration", "Bachelor's Degree in Commerce".
    [/master(?:['’]s)?\s+degree|post[\s-]*graduat(?:e|ion)|\bpost\s*grad\b/i, "Master's Degree"],
    [/bachelor(?:['’]s)?\s+degree|under[\s-]*graduat(?:e|ion)|\bgraduation\b/i, "Bachelor's Degree"],
];

const INSTITUTION_RE = /(university|institution|institute|college|school|academy|polytechnic|iit|iim|nit|iiit|bits|management|business\s+school)/i;

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
                    const bfFirstWord = bf.split(/\s+/)[0]?.toLowerCase();
                    if (bf && bf.length < 60 && !/\d/.test(bf) && !INSTITUTION_RE.test(bf)
                        && !SECTION_WORDS.has(bfFirstWord)) {
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
        // Skip lines that are themselves degree entries (they'll be parsed on their own iteration)
        if (!institution) {
            for (let k = i + 1; k <= i + 2 && k < lines.length; k++) {
                const nl = cleanEduLine(lines[k]);
                if (DEGREES.some(([re]) => re.test(nl))) break;
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

// ── Recruiter filename parser ─────────────────────────────────────────────────
// Executive-sourced resumes follow the convention
//   "NN_-_First_last_-_Designation_-_X_Yrs_Y_Month.pdf"
// where the recruiter has hand-verified both the candidate's name and their total
// years of experience. That is a far more reliable signal than anything we can
// scrape out of wildly-formatted resume bodies, so we trust it when present.
function parseRecruiterFilename(fileName = '') {
    const out = { name: '', experienceYears: null };
    if (!fileName) return out;
    const base = String(fileName)
        .replace(/\.(pdf|docx?|doc)$/i, '')
        .replace(/\s*\(\d+\)\s*$/, '')     // drop " (1)" dedupe suffixes
        .trim();

    // Experience: "17 Yrs 0 Month" / "11 Yrs 6 Months" (underscores or spaces)
    const em = base.match(/(\d{1,2})[\s_]*Yrs?[\s_]*(\d{1,2})?[\s_]*Month/i);
    if (em) {
        const yrs = parseInt(em[1], 10);
        const mos = em[2] ? parseInt(em[2], 10) : 0;
        if (yrs >= 0 && yrs <= 50) out.experienceYears = Math.round((yrs + mos / 12) * 100) / 100;
    }

    // Name: the segment between the leading serial number and the designation,
    // delimited by "_-_" / " - ". Falls back gracefully for non-convention names.
    const parts = base.split(/_-_|\s+-\s+|_-|-_/).map(s => s.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (parts.length >= 2) {
        // parts[0] is usually the serial ("93"); the name is the first non-numeric segment
        let seg = /^\d+$/.test(parts[0]) ? parts[1] : parts[0].replace(/^\d+\s*/, '').trim();
        if (seg && seg.length >= 3 && seg.length <= 45 && !/\d|@/.test(seg) && !isNoiseName(seg)) {
            out.name = titleCase(seg);
        }
    }
    return out;
}

// Choose the better of the body-parsed name and the recruiter-filename name.
// Rules (in order): if there's no filename name, keep the parse; if the parse is
// empty/noise, take the filename; if they share a token they agree (parse is
// usually better-formatted, keep it); if the parse looks like a phrase (>3 tokens
// that don't match the filename) it's garbage → take the filename; otherwise
// prefer whichever is more complete, tie-breaking to the recruiter's filename.
function chooseName(parsedName, filenameName) {
    const parsed = (parsedName || '').trim();
    const ff = (filenameName || '').trim();
    if (!ff) return parsed;
    if (!parsed || isNoiseName(parsed)) return ff;
    const pt = parsed.toLowerCase().split(/\s+/).filter(Boolean);
    const ftok = new Set(ff.toLowerCase().split(/\s+/).filter(Boolean));
    if (pt.some(t => ftok.has(t))) return parsed;   // agree on a token
    if (pt.length > 3) return ff;                   // parse looks like a phrase
    if (ftok.size > pt.length) return ff;           // filename is more complete
    return parsed;
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

// ── Seniority hierarchy extraction ────────────────────────────────────────────
// Returns a level 0–5 representing where a job title sits in the org hierarchy.
// Tiers are checked highest→lowest; the title is space-padded so that short
// abbreviations like " cto " cannot match inside longer words like "director".
const SENIORITY_TIERS = [
    { level: 5, keywords: ['chief executive', 'chief financial', 'chief technology', 'chief operating', 'chief information', 'chief ', ' ceo ', ' cto ', ' coo ', ' cfo ', ' ciso ', 'managing director', 'managing partner', ' president', 'founder', 'co-founder', 'co founder', 'proprietor'] },
    { level: 4, keywords: ['senior manager', 'sr. manager', 'sr manager', 'associate director', 'assistant vice president', 'asstt vice president', 'deputy general manager', 'deputy director', 'general manager', 'director', 'vice president', ' vp ', ' avp ', ' svp ', ' evp ', ' dgm ', ' agm ', ' nsm ', 'national head', 'business head', 'practice head'] },
    { level: 3, keywords: ['area manager', 'branch manager', 'regional manager', 'zonal manager', 'territory manager', 'key account manager', 'department head', 'section head', 'head of ', 'team manager', ' bdm ', ' kam ', ' rsm ', ' zsm ', ' tsm ', 'asst. manager', 'asst manager', 'assistant manager', 'manager', ' head ', 'supervisor', 'superintendent', 'incharge', 'in-charge', 'plant head', 'project head', 'site head'] },
    { level: 2, keywords: ['team lead', 'tech lead', 'technical lead', 'senior specialist', 'senior consultant', 'senior analyst', 'senior associate', 'senior executive', 'senior officer', 'senior engineer', 'senior developer', 'senior ', ' sr.', 'lead ', 'principal', 'specialist', 'consultant', 'subject matter expert', ' sme '] },
    { level: 1, keywords: ['executive', 'associate', 'junior', ' jr.', ' jr ', 'coordinator', 'representative', 'officer', 'analyst', 'agent', 'advisor', 'assistant', 'technician', 'developer', 'engineer', 'programmer', 'designer', 'writer', 'recruiter', 'researcher', 'accountant', 'support', ' kae ', ' bde ', ' asm '] },
    { level: 0, keywords: ['management trainee', 'graduate trainee', 'executive trainee', 'trainee', 'internship', 'intern ', 'apprentice', 'fresher', 'entry level', 'entry-level', 'campus hire'] },
];

function extractSeniority(titleText) {
    if (!titleText) return 1;
    // Pad with spaces so leading/trailing space-padded keywords match correctly
    const t = ' ' + titleText.toLowerCase().trim() + ' ';
    for (const { level, keywords } of SENIORITY_TIERS) {
        if (keywords.some(kw => t.includes(kw))) return level;
    }
    return 1;
}

module.exports = {
    parseFullProfile,
    parseResumeText,
    extractSkills,
    extractJobSkills,
    parseRecruiterFilename,
    isNoiseName,
    chooseName,
    extractSeniority,
};
