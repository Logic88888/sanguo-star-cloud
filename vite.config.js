import { defineConfig } from 'vite';

// base 用相对路径：无论部署在域名根目录还是子路径（如 username.github.io/仓库名/）都能直接跑
export default defineConfig({
  base: './',
});
