const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many requests, please try again later.' },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── API Routes (uncomment as each module is built) ───
 app.use('/api/auth',       require('./modules/auth/auth.routes'));       // Module 1
 app.use('/api/hr',         require('./modules/hr/hr.routes'));           // Module 2
// app.use('/api/candidates', require('./modules/candidate/candidate.routes')); // Module 3
// app.use('/api/companies',  require('./modules/company/company.routes')); // Module 4
// app.use('/api/ai',         require('./modules/ai/ai.routes'));           // Module 5
// app.use('/api/interviews', require('./modules/interview/interview.routes')); // Module 6
// app.use('/api/training',   require('./modules/training/training.routes')); // Module 7
// app.use('/api/admin',      require('./modules/admin/admin.routes'));     // Module 8

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use(errorHandler);

module.exports = app;