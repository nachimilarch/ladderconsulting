// Production PM2 config — backend only. The frontend is a static build served
// directly by Nginx (see deploy/nginx.conf), not a running Node process.
// Run from the repo root: pm2 start deploy/ecosystem.production.config.cjs

module.exports = {
    apps: [
        {
            name        : 'ladderstep-backend',
            script      : 'src/server.js',
            cwd         : __dirname + '/../backend',
            env         : { NODE_ENV: 'production' },
            instances   : 1,
            autorestart : true,
            restart_delay: 3000,
            max_restarts : 10,
            error_file  : '/var/log/ladderstep/backend-error.log',
            out_file    : '/var/log/ladderstep/backend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};
