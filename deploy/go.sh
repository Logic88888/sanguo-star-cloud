#!/usr/bin/env bash
# 一键初始化服务器并部署三国星云（在你自己的电脑上运行，不是在服务器上）
# 用法：bash deploy/go.sh 服务器公网IP
set -e
IP=${1:?'用法: bash deploy/go.sh 服务器公网IP'}
SSH="ssh -o StrictHostKeyChecking=accept-new root@$IP"

echo "== [1/3] 把环境安装脚本传到服务器并执行（约 3~5 分钟）=="
scp deploy/setup-server.sh root@"$IP":/root/setup-server.sh
$SSH "bash /root/setup-server.sh"

echo "== [2/3] 本地构建并上传网站 =="
npm run build
$SSH "mkdir -p /var/www/sanguo/dist"
scp -r dist/* root@"$IP":/var/www/sanguo/dist/

echo "== [3/3] 重载 Nginx =="
$SSH "nginx -t && systemctl reload nginx"

echo ""
echo "✅ 部署完成：http://$IP/"
echo "   以后更新网站只需：npm run build && scp -r dist/* root@$IP:/var/www/sanguo/dist/"
echo "   绑定域名 + 备案见 docs/DEPLOY-aliyun.md"
