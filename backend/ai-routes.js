/**
 * AI Routes — Express Router for Grok API Integration
 *
 * All AI requests are proxied through this backend to keep the API key server-side.
 * Supports both standard JSON responses and SSE streaming.
 *
 * Grok uses an OpenAI-compatible REST API at https://api.x.ai/v1/chat/completions
 */

const express = require('express');
const router = express.Router();

// ─── Configuration ─────────────────────────────────────────────────────────────

const AI_PROVIDER = process.env.AI_PROVIDER || 'grok';

let API_URL = 'https://api.x.ai/v1/chat/completions';
let API_KEY = process.env.GROK_API_KEY;
let MODEL = process.env.GROK_MODEL || 'grok-3-mini';

if (AI_PROVIDER === 'gemini') {
  API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  API_KEY = process.env.GEMINI_API_KEY;
  MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

const MAX_DOCUMENT_CHARS = 12000; // Truncate large documents to manage tokens
const RATE_LIMIT_MS = 1000; // 1-second debounce per user

// Per-user rate limit tracking
const lastRequestTime = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Truncate document content to avoid exceeding token limits.
 * Keeps the beginning and end of the document for context.
 */
function truncateDocument(content, maxChars = MAX_DOCUMENT_CHARS) {
  if (!content || content.length <= maxChars) return content || '';
  const half = Math.floor(maxChars / 2);
  return (
    content.slice(0, half) +
    '\n\n... [document truncated for brevity] ...\n\n' +
    content.slice(-half)
  );
}

/**
 * Check per-user rate limiting.
 * Returns true if the request should be throttled.
 */
function isRateLimited(userId) {
  const now = Date.now();
  const last = lastRequestTime.get(userId);
  if (last && now - last < RATE_LIMIT_MS) {
    return true;
  }
  lastRequestTime.set(userId, now);
  return false;
}

/**
 * Build the system prompt from document context.
 */
function buildSystemPrompt(context) {
  const parts = [
    'You are an intelligent AI assistant embedded in a Markdown editor application called "Readme.md".',
    'You help users write, edit, understand, and enhance their Markdown documents.',
    'Always preserve Markdown formatting in your responses (headings, lists, tables, code blocks, links, images, math, mermaid diagrams).',
    'Be concise, helpful, and accurate.',
    `IMPORTANT: The user's current document content is provided below. You MUST use this content to answer any questions the user asks about "this document" or "the file". Do NOT ask the user to provide the document, as it is already provided here.`
  ];

  if (context) {
    if (context.fileName) {
      parts.push(`The user is currently editing a file named "${context.fileName}".`);
    }
    if (context.workspaceName) {
      parts.push(`The workspace is named "${context.workspaceName}".`);
    }
    if (context.currentHeading) {
      parts.push(`The cursor is currently under the heading: "${context.currentHeading}".`);
    }
    if (context.currentMarkdown) {
      parts.push(
        `\n--- CURRENT DOCUMENT ---\n${truncateDocument(context.currentMarkdown)}\n--- END DOCUMENT ---`
      );
    }
    if (context.selectedText) {
      parts.push(`\n--- SELECTED TEXT ---\n${context.selectedText}\n--- END SELECTED TEXT ---`);
    }
  }

  return parts.join('\n');
}

/**
 * Map an action-specific prompt into user messages.
 */
function buildUserPrompt(action, body) {
  switch (action) {
    case 'chat':
      return body.message || 'Hello';

    case 'summary': {
      const mode = body.mode || 'medium';
      const lengths = { short: '2-3 sentences', medium: '1-2 paragraphs', detailed: 'comprehensive multi-paragraph' };
      return `Summarize this document in a ${lengths[mode] || lengths.medium} summary. Return only the summary in Markdown format.`;
    }

    case 'explain': {
      const level = body.level || 'simplified';
      const explanations = {
        simplified: 'Explain the following text in simple, easy-to-understand language.',
        technical: 'Provide a detailed technical explanation of the following text.',
        beginner: 'Explain the following text as if I am a complete beginner with no prior knowledge.',
      };
      return `${explanations[level] || explanations.simplified}\n\nText to explain:\n"${body.text || ''}"`;
    }

    case 'improve': {
      const tone = body.tone || 'professional';
      return `Rewrite the following Markdown text in a ${tone} tone. Preserve all Markdown syntax (headings, lists, code blocks, links, images, tables, math, mermaid). Only change the prose, not the structure.\n\nText to improve:\n"${body.text || ''}"`;
    }

    case 'grammar':
      return `Fix all grammar, spelling, and punctuation errors in the following Markdown text. Preserve all Markdown formatting exactly. Return only the corrected text.\n\nText:\n"${body.text || ''}"`;

    case 'translate': {
      const lang = body.targetLanguage || 'spanish';
      return `Translate the following Markdown text to ${lang}. Preserve all Markdown formatting (headings, lists, code blocks, links, images, tables). Only translate the prose text.\n\nText:\n"${body.text || ''}"`;
    }

    case 'toc':
      return 'Generate a Table of Contents for this document based on its headings. Return it as a Markdown list with proper indentation and anchor links.';

    case 'mermaid':
      return `Generate a Mermaid diagram based on the following description. Return ONLY a valid Mermaid code block (wrapped in \`\`\`mermaid ... \`\`\`).\n\nDescription: "${body.description || 'Create a flowchart based on the document content'}"`;

    case 'markdown':
      return `Convert the following plain text notes into properly formatted Markdown. Generate appropriate headings, bullet lists, tables, and code blocks where applicable.\n\nNotes:\n"${body.text || ''}"`;

    case 'faq':
      return 'Generate a FAQ section based on this document. Return 5-8 questions and answers in Markdown format. Use ## for the FAQ heading and ### for each question.';

    case 'flashcards':
      return 'Create study flashcards based on this document. Return them as a Markdown table with two columns: "Question" and "Answer". Generate 8-12 flashcards covering the key concepts.';

    case 'interview': {
      const diff = body.difficulty || 'medium';
      return `Generate interview questions based on this document at the ${diff} difficulty level. Return 5-8 questions organized by difficulty. Use Markdown formatting with numbered lists.`;
    }

    case 'insights':
      return `Analyze this document and return insights in the following Markdown format:

## Document Insights

- **Reading Time**: (estimate in minutes)
- **Difficulty Level**: (beginner / intermediate / advanced)
- **Main Topics**: (comma-separated list)
- **Keywords**: (comma-separated list of important keywords)
- **Missing Sections**: (suggest any sections that might be missing)
- **Suggestions**: (2-3 actionable suggestions to improve the document)`;

    case 'titles':
      return 'Generate 5 compelling, descriptive title suggestions for this document. Return them as a numbered Markdown list.';

    default:
      return body.message || 'Hello, how can you help me with this document?';
  }
}

/**
 * Call the configured AI API and return the full response (non-streaming).
 */
async function callAI(systemPrompt, userPrompt, conversationHistory = []) {
  if (!API_KEY) {
    throw { status: 500, message: `${AI_PROVIDER.toUpperCase()}_API_KEY is not configured on the server.` };
  }

  // Build messages array with conversation history
  const messages = [{ role: 'system', content: systemPrompt }];

  // Add conversation history (limited to last 20 messages to manage tokens)
  const recentHistory = conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  // Add the current user prompt
  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw {
      status: response.status,
      message: `${AI_PROVIDER.toUpperCase()} API error (${response.status}): ${errorBody || response.statusText}`,
    };
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call the configured AI API with streaming and pipe SSE events to the Express response.
 */
async function callAIStreaming(systemPrompt, userPrompt, conversationHistory = [], res) {
  if (!API_KEY) {
    throw { status: 500, message: `${AI_PROVIDER.toUpperCase()}_API_KEY is not configured on the server.` };
  }

  const messages = [{ role: 'system', content: systemPrompt }];

  const recentHistory = conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  messages.push({ role: 'user', content: userPrompt });

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw {
      status: response.status,
      message: `${AI_PROVIDER.toUpperCase()} API error (${response.status}): ${errorBody || response.statusText}`,
    };
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }

        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (_parseErr) {
          // Skip malformed chunks
        }
      }
    }
  } catch (streamErr) {
    res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
  } finally {
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

// ─── Error Handler ─────────────────────────────────────────────────────────────

function mapErrorResponse(err) {
  const status = err.status || 500;
  const errorMap = {
    401: { message: 'Authentication failed with AI provider. Check API key.', retryable: false },
    403: { message: 'Access denied by AI provider.', retryable: false },
    404: { message: 'AI endpoint not found. Check model configuration.', retryable: false },
    429: { message: 'Rate limit exceeded. Please wait a moment and try again.', retryable: true },
    500: { message: err.message || 'Internal server error.', retryable: true },
  };

  const mapped = errorMap[status] || { message: err.message || 'An unexpected error occurred.', retryable: true };
  return { status, ...mapped };
}

// ─── Routes ────────────────────────────────────────────────────────────────────

/**
 * Generic AI action handler.
 * Supports both streaming (Accept: text/event-stream) and non-streaming requests.
 */
function createActionHandler(action) {
  return async (req, res) => {
    // Rate limiting
    if (isRateLimited(req.userId)) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment.',
        code: 429,
        retryable: true,
      });
    }

    try {
      const { context, ...rest } = req.body;
      const systemPrompt = buildSystemPrompt(context);
      const userPrompt = buildUserPrompt(action, { ...rest, text: rest.text || context?.selectedText });

      const wantsStream = req.headers.accept === 'text/event-stream';

      if (wantsStream) {
        await callAIStreaming(
          systemPrompt,
          userPrompt,
          context?.conversationHistory || [],
          res
        );
      } else {
        const content = await callAI(
          systemPrompt,
          userPrompt,
          context?.conversationHistory || []
        );
        res.json({ success: true, content });
      }
    } catch (err) {
      const mapped = mapErrorResponse(err);
      // If headers already sent (streaming), we can't send JSON error
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: mapped.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.status(mapped.status).json({
          success: false,
          error: mapped.message,
          code: mapped.status,
          retryable: mapped.retryable,
        });
      }
    }
  };
}

// Register all AI action routes
const actions = [
  'chat',
  'summary',
  'explain',
  'improve',
  'grammar',
  'translate',
  'toc',
  'mermaid',
  'markdown',
  'faq',
  'flashcards',
  'interview',
  'insights',
  'titles',
];

actions.forEach((action) => {
  router.post(`/${action}`, createActionHandler(action));
});

module.exports = router;
