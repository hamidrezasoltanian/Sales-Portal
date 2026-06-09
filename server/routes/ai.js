'use strict';

const express = require('express');
const https = require('https');
const { requireAuth } = require('../auth');

const router = express.Router();

// All AI routes require auth
router.use(requireAuth);

// POST /api/ai/analyze — proxy to Anthropic API
router.post('/analyze', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'سرویس هوش مصنوعی در دسترس نیست. کلید API تنظیم نشده است.' });
  }

  const { messages, system, max_tokens, model } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'پارامتر messages الزامی است' });
  }

  const payload = {
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: max_tokens || 4096,
    messages,
  };
  if (system) payload.system = system;

  const bodyStr = JSON.stringify(payload);

  try {
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      };

      const reqHttp = https.request(options, (httpRes) => {
        let data = '';
        httpRes.on('data', (chunk) => { data += chunk; });
        httpRes.on('end', () => {
          try {
            resolve({ status: httpRes.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: httpRes.statusCode, body: { error: data } });
          }
        });
      });

      reqHttp.on('error', reject);
      reqHttp.write(bodyStr);
      reqHttp.end();
    });

    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error('[ai/analyze]', e.message);
    return res.status(500).json({ error: 'خطا در اتصال به سرویس هوش مصنوعی' });
  }
});

module.exports = router;
