#!/usr/bin/env bash
# 把三国星云构建并上传到阿里云服务器（每次更新网站后重新运行即可）
# 用法：bash deploy/upload-site.sh 服务器公网IP
set -e
IP=${1:?'用法: bash deploy/upload-site.sh 服务器公网IP'}

echo "== [1/3] 本地构建生产版本 =="
npm run build

echo "== [2/3] 上传到服务器 =="
ssh root@"$IP" "mkdir -p /var/www/sanguo"
scp -r dist/* root@"$IP":/var/www/sanguo/dist/

echo "== [3/3] 重载 Nginx =="
ssh root@"$IP" "nginx -t && systemctl reload nginx"

echo ""
echo "✅ 部署完成：http://$IP/"
echo "   备案并绑定域名后，用 https://你的域名 访问。"
