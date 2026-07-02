const { sendGraphMail } = require('./graphMail');

const sendEmail = async ({ to, cc, subject, html }) => {
    const from = process.env.EMAIL_FROM
        || `"LadderStep Human Consulting" <${process.env.SMTP_USER}>`;
    await sendGraphMail({ from, to, cc, subject, html, saveToSent: true });
};

module.exports = { sendEmail };
