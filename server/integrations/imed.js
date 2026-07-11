'use strict';

function isConfigured() {
  return !!(process.env.IMED_API_URL && process.env.IMED_API_TOKEN);
}

async function pushTransactions(transactions) {
  if (!isConfigured()) throw new Error('IMED_API_URL / IMED_API_TOKEN تنظیم نشده');
  const base = process.env.IMED_API_URL.replace(/\/+$/, '');
  const endpoint = process.env.IMED_TRANSACTIONS_PATH || '/transactions/bulk';
  const response = await fetch(base + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.IMED_API_TOKEN,
    },
    body: JSON.stringify({ transactions }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(body.error || body.message || ('IMED HTTP ' + response.status));
  return body;
}

module.exports = { isConfigured, pushTransactions };
