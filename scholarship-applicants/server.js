const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Anthropic client
const client = new Anthropic(
  process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY } : {}
);

// Store conversations in memory (would be database in production)
const conversations = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const scholarshipsPath = path.join(__dirname, 'data', 'scholarships.json');
const scholarships = JSON.parse(fs.readFileSync(scholarshipsPath, 'utf-8'));

// Original endpoints
app.get('/api/scholarships', (req, res) => {
  res.json(scholarships);
});

app.get('/api/scholarships/:id', (req, res) => {
  const scholarship = scholarships.find(s => s.id === req.params.id);
  if (!scholarship) {
    return res.status(404).json({ error: 'Scholarship not found' });
  }
  res.json(scholarship);
});

// NEW: Chat endpoint for Claude API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const id = conversationId || Date.now().toString();

    // Get or create conversation history
    if (!conversations.has(id)) {
      conversations.set(id, []);
    }

    const history = conversations.get(id);

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-opus-4-5-20250805',
      max_tokens: 1024,
      system: `You are an AI scholarship assistant helping students find and apply for scholarships.
You are conversational and helpful. Your goal is to:
1. Help them enter a college URL (like https://ncsu.edu)
2. Ask clarifying questions about their profile (GPA, major, first-generation status, financial need)
3. Once you have their profile, tell them you've found scholarships and ranked them

Keep responses concise and conversational. Use emojis occasionally to be friendly.`,
      messages: history
    });

    const assistantMessage = response.content[0].text;

    // Add assistant response to history
    history.push({ role: 'assistant', content: assistantMessage });

    // Store updated conversation
    conversations.set(id, history);

    res.json({
      conversationId: id,
      message: assistantMessage,
      messageCount: history.length
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// NEW: Web crawler endpoint
app.post('/api/crawl', async (req, res) => {
  try {
    const { collegeUrl } = req.body;

    if (!collegeUrl) {
      return res.status(400).json({ error: 'College URL is required' });
    }

    console.log(`Starting crawl for: ${collegeUrl}`);

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(collegeUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Get page HTML
    const html = await page.content();
    await browser.close();

    // Parse and extract scholarship links (simplified version)
    const scholarshipLinks = extractScholarshipLinks(html, collegeUrl);

    console.log(`Found ${scholarshipLinks.length} potential scholarship pages`);

    res.json({
      status: 'success',
      collegeUrl,
      scholarshipLinksFound: scholarshipLinks.length,
      scholarshipLinks: scholarshipLinks.slice(0, 10) // Return first 10
    });
  } catch (error) {
    console.error('Crawl error:', error);
    res.status(500).json({
      error: 'Failed to crawl website',
      details: error.message
    });
  }
});

// NEW: LLM Parser endpoint - Extract scholarships from HTML
app.post('/api/parse-scholarships', async (req, res) => {
  try {
    const { html, collegeUrl } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    console.log('Parsing scholarships from HTML...');

    // Use Claude to extract scholarships from messy HTML
    const response = await client.messages.create({
      model: 'claude-opus-4-5-20250805',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Extract scholarship information from this HTML. Return a JSON array of scholarships with these fields:
- name (scholarship name)
- amount (award amount, e.g. "5000")
- minGPA (minimum GPA requirement, e.g. 3.5)
- acceptedMajors (array of majors or ["Any"])
- deadline (application deadline)
- requirementText (full requirement text)
- applicationUrl (URL to apply)

Only return valid JSON array, no other text.

HTML:
${html.substring(0, 8000)}`
        }
      ]
    });

    const parsedText = response.content[0].text;

    // Try to extract JSON from response
    const jsonMatch = parsedText.match(/\[\s*{[\s\S]*}\s*\]/);
    const scholarships = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    console.log(`Parsed ${scholarships.length} scholarships`);

    res.json({
      status: 'success',
      collegeUrl,
      scholarshipsFound: scholarships.length,
      scholarships: scholarships
    });
  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({
      error: 'Failed to parse scholarships',
      details: error.message
    });
  }
});

// Helper: Extract scholarship links from HTML
function extractScholarshipLinks(html, collegeUrl) {
  const $ = cheerio.load(html);
  const links = new Set();

  // Look for common scholarship page patterns
  $('a').each((i, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text().toLowerCase();

    if (href && (
      text.includes('scholarship') ||
      text.includes('financial aid') ||
      text.includes('grants') ||
      href.includes('scholarship') ||
      href.includes('financial') ||
      href.includes('aid')
    )) {
      try {
        const url = new URL(href, collegeUrl).toString();
        links.add(url);
      } catch (e) {
        // Invalid URL, skip
      }
    }
  });

  return Array.from(links);
}

app.listen(PORT, () => {
  console.log(`Scholarship server running at http://localhost:${PORT}`);
  console.log(`Using Claude API key: ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗'}`);
});
