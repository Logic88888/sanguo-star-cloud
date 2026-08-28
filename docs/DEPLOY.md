# 推送上线指南

构建产物在 `dist/`（约 2.1MB，数据已打包在内），**任何静态托管都能跑**。三种路线按需选择：

## 路线 A：GitHub Pages（免费，国际访问，国内时好时坏）

仓库已配好自动部署工作流（`.github/workflows/deploy.yml`），推送即上线：

```bash
# 1. 在 https://github.com/new 建一个空仓库（如 sanguo），不要勾选 README
# 2. 本地执行（把 用户名/仓库名 换成你的）：
git remote add origin https://github.com/用户名/仓库名.git
git push -u origin main
# 3. 到仓库 Settings → Pages → Source 选「GitHub Actions」
# 4. 等 Actions 跑完（约 1 分钟），访问：
#    https://用户名.github.io/仓库名/
```

以后每次 `git push` 自动重新部署；分享链接是 `https://…/#a=人物id`，别人打开直达该人物。

## 路线 B：Vercel / Netlify / Cloudflare Pages（免费，全球 CDN，最省事）

任选一家注册（可用 GitHub 登录）：

- **Vercel**：控制台 Import Git Repository → 选中仓库 → Framework 选 Vite → Deploy。或本地一条命令：`npx vercel --prod`
- **Cloudflare Pages**：连接仓库，构建命令 `npm run build`，输出目录 `dist`

国内外访问速度视网络而定，可绑定自有域名改善。

## 路线 C：国内访问优先

- **腾讯 EdgeOne Pages**：免费额度、无需备案（用默认域名），控制台直接导入 Git 仓库或上传 `dist/`
- **自有服务器 / 云主机**：把 `dist/` 整个目录上传到站点根目录即可（nginx 示例：`root /var/www/sanguo;`），绑定国内域名需完成 ICP 备案
- 注意：不能用 `file://` 双击打开（浏览器禁止 ES 模块本地加载），必须走 HTTP

## 部署清单

- [x] `vite.config.js` 已设 `base: './'`（子路径部署无需改动）
- [x] 数据（人物/关系/简介）已打包进构建产物，无需后端
- [x] GitHub Actions 工作流就绪（路线 A 推送即部署）
- [ ] 选定平台并完成账号侧操作
