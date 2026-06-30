const NODE = '/opt/homebrew/opt/node@22/bin/node';
const NPM  = '/opt/homebrew/opt/node@22/bin/npm';

module.exports = {
  apps: [
    {
      name        : 'ladder-backend',
      script      : 'src/server.js',
      cwd         : '/Users/nachikethdesai/ladder-consulting/backend',
      interpreter : NODE,
      watch       : false,
      env: {
        NODE_ENV : 'development',
        PORT     : 5001,
      },
      error_file  : '/Users/nachikethdesai/.pm2/logs/ladder-backend-error.log',
      out_file    : '/Users/nachikethdesai/.pm2/logs/ladder-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay   : 3000,
      max_restarts    : 10,
    },
    {
      name        : 'caffeinate',
      script      : '/usr/bin/caffeinate',
      args        : '-d -i -s',
      interpreter : 'none',
      watch       : false,
      autorestart : true,
      restart_delay   : 1000,
      max_restarts    : 99,
      error_file  : '/Users/nachikethdesai/.pm2/logs/caffeinate-error.log',
      out_file    : '/Users/nachikethdesai/.pm2/logs/caffeinate-out.log',
    },
    {
      name        : 'ladder-frontend',
      script      : NPM,
      args        : 'run dev',
      cwd         : '/Users/nachikethdesai/ladder-consulting/frontend',
      interpreter : NODE,
      watch       : false,
      env: {
        NODE_ENV : 'development',
      },
      error_file  : '/Users/nachikethdesai/.pm2/logs/ladder-frontend-error.log',
      out_file    : '/Users/nachikethdesai/.pm2/logs/ladder-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay   : 3000,
      max_restarts    : 10,
    },
  ],
};
