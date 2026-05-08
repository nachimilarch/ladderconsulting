const axios = require('axios');

/**
 * Calls LLM API to extract structured profile data from raw resume text.
 * Returns: { skills: [], experience_years: number, summary: string }
 */
const parseResumeText = async (rawText) => {
    const prompt = `
You are a resume parser. Given the resume text below, extract:
1. skills: array of skill strings
2. experience_years: total years of experience as a number
3. summary: a 2-sentence professional summary

Respond ONLY with valid JSON matching this shape:
{ "skills": [], "experience_years": 0, "summary": "" }

Resume:
"""
${rawText.substring(0, 6000)}
"""
  `.trim();

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    return JSON.parse(response.data.choices[0].message.content);
};

module.exports = { parseResumeText };