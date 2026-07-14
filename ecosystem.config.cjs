module.exports = {
  apps: [{
    name: 'click-crm',
    cwd: '/home/hamidreza/Click Pro',
    script: 'server/index.js',
    interpreter: '/home/hamidreza/.nvm/versions/node/v20.19.6/bin/node',
    env: {
      NODE_ENV: 'production',
    },
    autorestart: true,
    max_restarts: 50,
    restart_delay: 5000,
    max_memory_restart: '600M',
    merge_logs: true,
    time: true,
  }],
};
