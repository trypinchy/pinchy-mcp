# First-time host setup

```sh
useradd --system --no-create-home --home-dir /opt/pinchy-mcp --shell /usr/sbin/nologin pinchy-mcp
install -d -o pinchy-mcp -g pinchy-mcp /opt/pinchy-mcp
sudo -H -u pinchy-mcp git clone https://github.com/trypinchy/pinchy-mcp.git /opt/pinchy-mcp
printf 'PINCHY_API_URL=%s\n' '<api base url>' > /opt/pinchy-mcp/.env && chown pinchy-mcp: /opt/pinchy-mcp/.env
cp /opt/pinchy-mcp/deploy/nginx.conf /etc/nginx/sites-available/mcp.trypinchy.com
ln -s /etc/nginx/sites-available/mcp.trypinchy.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
/opt/pinchy-mcp/deploy/deploy.sh
```

Port 80 must only be reachable from Cloudflare: the rate limits key on `CF-Connecting-IP`.
