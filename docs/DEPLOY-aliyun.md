# 阿里云 ECS 部署手册（三国星云）

> 前置：已购买 ECS（Ubuntu 22.04，≥3 个月才有备案资格），控制台已重置 root 密码。

## 首次部署（3 条命令）

在本机项目目录打开 Git Bash：

```bash
# 1. 放行端口：阿里云控制台 → ECS → 安全组 → 配置规则 → 入方向添加 80、443（来源 0.0.0.0/0）
# 2. 一键初始化 + 部署（会要你输两次服务器密码）：
bash deploy/go.sh 服务器公网IP
# 3. 浏览器打开 http://服务器公网IP/
```

看到三国星云星空即成功。以后每次更新网站：

```bash
bash deploy/go.sh 服务器公网IP   # 或只更新内容：npm run build && scp -r dist/* root@IP:/var/www/sanguo/dist/
```

## 服务器上有什么

| 路径 | 内容 |
|---|---|
| `/var/www/sanguo/dist/` | 网站静态文件（构建产物） |
| `/etc/nginx/sites-available/sanguo` | Nginx 站点配置（含 /api/ 预留转发） |
| `/root/setup-server.sh` | 环境安装脚本（Node20/Nginx/pm2） |

## 常用运维命令（ssh root@IP 后执行）

```bash
systemctl status nginx     # 看 Nginx 状态
tail -f /var/log/nginx/error.log   # 看报错日志
pm2 list                   # 以后后端进程列表（pm2 启动后才有）
df -h && free -m           # 磁盘和内存余量
```

## 绑定域名 + 备案

1. 买域名并完成域名实名（1~3 天）
2. 阿里云控制台 → ICP 备案 → 按引导提交（身份证 + 人脸），1~4 周
3. 备案通过后：云解析 DNS → 添加 **A 记录**：主机记录 `@`、记录值 = 服务器公网 IP
4. 改 nginx：`server_name 你的域名;`（`nano /etc/nginx/sites-available/sanguo`，改完 `systemctl reload nginx`）
5. HTTPS：控制台搜"SSL 证书"→ 免费 DV 证书 → 按引导部署；或服务器上用 certbot：
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d 你的域名
   ```

## 安全清单（买完就做）

- [ ] 控制台重置 root 密码为强密码（公网会被扫描爆破弱密码）
- [ ] 安全组只放行 22/80/443，其他全关
- [ ] 别把公网 IP 发到公开群组
- [ ] 以后跑后端用 pm2 守护，别直接 node 裸跑
