'use strict';

require('./pg-config');
const dgram = require('dgram');
const { requireFaradisConfig } = require('../../server/lib/faradis-config');

const cfg = requireFaradisConfig();

function resolveSqlPort() {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    const message = Buffer.from([0x02]);
    let resolved = false;
    const instanceName = cfg.instanceName || 'FARADISSOFT';

    client.on('message', (msg) => {
      const response = msg.toString('ascii');
      const parts = response.split(';');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].toLowerCase() === 'instancename' && parts[i + 1] && parts[i + 1].toLowerCase() === instanceName.toLowerCase()) {
          for (let j = i; j < parts.length; j++) {
            if (parts[j].toLowerCase() === 'tcp' && parts[j + 1]) {
              const port = parseInt(parts[j + 1], 10);
              resolved = true;
              client.close();
              resolve(port);
              return;
            }
          }
        }
      }
      client.close();
      resolve(null);
    });

    client.on('error', () => {
      client.close();
      resolve(null);
    });

    client.send(message, 0, message.length, 1434, cfg.server, (err) => {
      if (err) {
        client.close();
        resolve(null);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        client.close();
        resolve(null);
      }
    }, 2000);
  });
}

module.exports = { resolveSqlPort, cfg };
