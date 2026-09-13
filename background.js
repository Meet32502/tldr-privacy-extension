// background.js — TL;DR Privacy Extension
// Service worker: handles Groq API calls for fast, accurate legal text summarization

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'openai/gpt-oss-120b';

/**
 * Normalizes verdict into exactly 3 concise bullet points under 20 words each
 */
function normalizeVerdict(verdictRaw) {
  let bullets = [];

  if (Array.isArray(verdictRaw)) {
    bullets = verdictRaw.map(b => String(b).trim()).filter(Boolean);
  } else if (typeof verdictRaw === 'string') {
    bullets = verdictRaw
      .split(/\r?\n|\. /)
      .map(b => b.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
  }

  // Ensure exactly 3 bullets
  if (bullets.length === 0) {
    bullets = ['Summary unavailable for this document.'];
  }

  while (bullets.length < 3) {
    if (bullets.length === 1) bullets.push('Review specific category risk clauses below.');
    else if (bullets.length === 2) bullets.push('Check user data rights and arbitration terms.');
  }

  // Truncate to first 3 bullets and cap each at 20 words max
  return bullets.slice(0, 3).map(bullet => {
    const words = bullet.split(/\s+/);
    if (words.length > 20) {
      return words.slice(0, 20).join(' ') + '…';
    }
    return bullet;
  });
}

/**
 * Builds the prompt messages for Groq API
 */
function buildMessages(tosText, pageTitle, pageUrl) {
  const systemPrompt = `You are an expert privacy lawyer and consumer rights advocate. Your job is to analyze Terms of Service and Privacy Policy documents and identify the most important clauses that affect users.

CRITICAL INSTRUCTION:
First, check if the provided document text is actually a Terms of Service, Privacy Policy, End User License Agreement (EULA), Cookie Policy, or legal terms agreement document.

If the provided text is NOT a Terms of Service, Privacy Policy, or legal agreement document (for example: it is a general website home page, news article, e-commerce product page, search results, blog post, or non-legal content), return ONLY this JSON structure:
{
  "isLegalDocument": false,
  "verdict": ["This page does not contain a Terms of Service or Privacy Policy document."]
}

If the text IS a legal document, set "isLegalDocument": true and return:
{
  "isLegalDocument": true,
  "score": <integer 0-100, where 0=extremely privacy-invasive, 100=very user-friendly>,
  "verdict": [
    "<concise bullet point 1, max 15 words>",
    "<concise bullet point 2, max 15 words>",
    "<concise bullet point 3, max 15 words>"
  ],
  "clauses": [
    {
      "risk": "<high|medium|low>",
      "title": "<short title of the clause, max 8 words>",
      "detail": "<clear explanation of what this means for the user, max 2 sentences>"
    }
  ]
}

STRICT SUMMARY & SCORING RULES:
- "verdict": Return EXACTLY 3 concise bullet points. No more, no less, no sub-explanations. Each bullet must be short and under 15 words.
- Calculate score deterministically starting from 100 points: deduct 15 points per high-risk clause, deduct 8 points per medium-risk clause, deduct 0 for low-risk clauses. Clamp final score between 0 and 100.
- Score 0-30: Red zone (dangerous to privacy)
- Score 31-55: Yellow zone (concerning, mixed)
- Score 56-75: Blue zone (fair terms)
- Score 76-100: Green zone (user-friendly)
- Include 5 to 8 clauses, ordered from most dangerous to least
- Focus on: data collection, data selling, AI training on user data, account deletion, arbitration clauses, data retention, third-party sharing, location tracking, right to change terms without notice
- Use plain English, not legal jargon`;

  const userPrompt = `Analyze the following document text from "${pageTitle}" (${pageUrl}):

---
${tosText}
---`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

/**
 * Calls Groq Cloud API with the ToS text using deterministic temperature = 0.0
 */
async function callGroqAPI(tosText, pageTitle, pageUrl, apiKey) {
  const messages = buildMessages(tosText, pageTitle, pageUrl);

  const requestBody = {
    model: MODEL_NAME,
    messages: messages,
    temperature: 0.0,
    response_format: { type: "json_object" }
  };

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;

    if (response.status === 401) throw new Error('Invalid API key. Please check your Groq API key in extension settings.');
    if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    throw new Error(`Groq API error: ${errorMessage}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content;

  if (!rawText) throw new Error('Empty response from Groq AI. Please try again.');

  const cleanedText = rawText
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/gi, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (e) {
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not parse AI response. Please try again.');
    }
  }

  if (parsed.isLegalDocument === false) {
    return {
      isLegalDocument: false,
      verdict: normalizeVerdict(parsed.verdict)
    };
  }

  if (typeof parsed.score !== 'number' || !Array.isArray(parsed.clauses)) {
    throw new Error('Unexpected response format from AI. Please try again.');
  }

  parsed.isLegalDocument = true;
  parsed.verdict = normalizeVerdict(parsed.verdict);
  return parsed;
}

// Listen for messages from popup.js or content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ANALYZE_TOS') {
    const { tosText, pageTitle, pageUrl, apiKey } = message;

    callGroqAPI(tosText, pageTitle, pageUrl, apiKey)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }
});
