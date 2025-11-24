// PM2 Configuration for SPA Digital Kiosk Backend

module.exports = {
  apps: [
    {
      name: 'kiosk-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Restart daily at 4 AM to prevent memory leaks
      cron_restart: '0 4 * * *',
    },
  ],
};
