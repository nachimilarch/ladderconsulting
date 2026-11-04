# nginx changes for SEO and speed (not yet applied on the server)

The pre-rendered website already works without these. They add three things:
sign-in and portal URLs return a page that tells search engines not to index it, built files are cached for a
year, and JS/CSS are compressed.

In `/etc/nginx/sites-enabled/ladderstep`, in the `server_name theladderconsulting.com;` (443) block,
replace the `location / { ... }` block with:

```nginx
    location / {
        try_files $uri $uri/ /app.html;
        add_header Cache-Control "no-cache" always;
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }
```

Create `/etc/nginx/conf.d/gzip-types.conf`:

```nginx
gzip on;
gzip_vary on;
gzip_comp_level 5;
gzip_min_length 512;
gzip_types text/plain text/css text/xml application/json application/javascript text/javascript application/xml application/xml+rss image/svg+xml;
```

Then `sudo nginx -t && sudo systemctl reload nginx`. Deploy the new `dist/` first: `app.html` must exist before nginx points at it.
To undo, restore the previous file and reload.
