'use strict';

/**
 * Shared Faradis (MS-SQL) connection config — reads only from environment variables.
 * Used by server integrations and CLI inspection scripts.
 */
function getFaradisConfig() {
  const server = process.env.FARADIS_SERVER;
  const password = process.env.FARADIS_PASSWORD;
  if (!server || !password) {
    return null;
  }
  return {
    server,
    port: parseInt(process.env.FARADIS_PORT || '50727', 10),
    database: process.env.FARADIS_DATABASE || 'faradissoftatenazist',
    user: process.env.FARADIS_USER || 'ma',
    password,
    instanceName: process.env.FARADIS_INSTANCE || 'FARADISSOFT',
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 10000,
      requestTimeout: 30000,
    },
  };
}

function requireFaradisConfig() {
  const cfg = getFaradisConfig();
  if (!cfg) {
    throw new Error(
      'Faradis not configured. Set FARADIS_SERVER and FARADIS_PASSWORD in .env'
    );
  }
  return cfg;
}

module.exports = { getFaradisConfig, requireFaradisConfig };
