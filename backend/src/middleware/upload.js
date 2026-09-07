const multer = require('multer');
const path = require('path');
const fs = require('fs');

const resumeDir = path.join(process.cwd(), 'uploads', 'resumes');
if (!fs.existsSync(resumeDir)) fs.mkdirSync(resumeDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, resumeDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const rand = Math.random().toString(36).slice(2, 8);
        cb(null, `resume_${req.user.id}_${Date.now()}_${rand}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files are allowed'), false);
};

const uploadResume = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Document uploads (offer letters, ID proofs, certificates, etc.) ──────────
const docDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(docDir)) fs.mkdirSync(docDir, { recursive: true });

const docStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, docDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `doc_${req.user.id}_${Date.now()}${ext}`);
    },
});

const docFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, JPG, PNG files are allowed'), false);
};

const uploadDocument = multer({
    storage: docStorage,
    fileFilter: docFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Campaign attachment uploads (PDF + images, 10MB) ──────────────────────────
const attachDir = path.join(process.cwd(), 'uploads', 'campaign-attachments');
if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });

const attachStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, attachDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const attachFilter = (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, images (JPG, PNG, GIF), and Word documents are allowed'), false);
};

const uploadCampaignAttachment = multer({
    storage: attachStorage,
    fileFilter: attachFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { uploadResume, uploadDocument, uploadCampaignAttachment };
