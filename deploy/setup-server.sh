#!/usr/bin/env bash
# 在阿里云 ECS 服务器上执行一次的环境安装脚本
# 用法（在你的电脑上运行，会自动把本脚本传到服务器执行）：
#   bash deploy/go.sh 服务器公网IP
set -e

echo "== [1/4] 安装 Node.js 20 / Nginx / pm2 =="
export DEBIAN_FRONTEND=noninteractive
apt update -y
apt install -y curl nginx ca-certificates gnupg
# NodeSource 脚本先落地到临时文件再执行，不使用管道执行远程脚本
curl -fsSL https://deb.nodesource.com/setup_20.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
apt install -y nodejs
npm install -g pm2

echo "== [2/4] 创建网站目录 =="
mkdir -p /var/www/sanguo/dist

echo "== [3/4] 写入 Nginx 站点配置 =="
cat > /etc/nginx/sites-available/sanguo << 'CONF'
server {
    listen 80 default_server;
    server_name _;

    root /var/www/sanguo/dist;
    index index.html;

    # 单页应用：找不到的路径回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 以后后端接口：/api/ 转发给本机 3000 端口的 Node 服务
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
    gzip_min_length 1024;
}
CONF

# Ubuntu 自带的默认站点也占着 80 端口，移除避免冲突
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/sanguo /etc/nginx/sites-enabled/sanguo
nginx -t
systemctl reload nginx

echo "== [4/4] 完成 =="
echo "环境就绪。回到你的电脑运行上传脚本即可："
echo "  bash deploy/upload-site.sh 服务器公网IP"
