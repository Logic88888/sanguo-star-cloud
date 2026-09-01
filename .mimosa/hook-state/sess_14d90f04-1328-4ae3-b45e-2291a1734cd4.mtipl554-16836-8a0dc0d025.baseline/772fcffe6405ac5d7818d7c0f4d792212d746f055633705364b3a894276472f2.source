#!/usr/bin/env bash
# 一键发布到 GitHub Pages：创建仓库 → 开启 Pages → 推送 → 等部署 → 输出访问地址
# 用法：bash scripts/deploy-github.sh [仓库名]   （默认仓库名 sanguo-star-cloud）
set -e
cd "$(dirname "$0")/.."

REPO_NAME=${1:-sanguo-star-cloud}
out=$(printf "protocol=https\nhost=github.com\n\n" | GIT_TERMINAL_PROMPT=0 git credential fill)
user=$(echo "$out" | grep '^username=' | cut -d= -f2)
token=$(echo "$out" | grep '^password=' | cut -d= -f2)
if [ -z "$token" ]; then
  echo "未找到 GitHub 凭据：请在任意仓库执行一次 git push 完成登录后重试。"
  exit 1
fi
auth="Authorization: token $token"

echo "== [1/4] 创建公开仓库 $user/$REPO_NAME =="
code=$(curl -s -o /tmp/sanguo_resp.json -w "%{http_code}" -X POST \
  -H "$auth" -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"三国星云 · 三国人物可漫游3D星图\",\"private\":false,\"has_wiki\":false}")
if [ "$code" = "201" ]; then
  echo "  创建成功"
elif [ "$code" = "422" ]; then
  echo "  仓库已存在，继续"
else
  echo "  创建失败($code)："; cat /tmp/sanguo_resp.json; exit 1
fi

echo "== [2/4] 开启 GitHub Pages（Actions 模式）=="
code=$(curl -s -o /tmp/sanguo_pages.json -w "%{http_code}" -X POST \
  -H "$auth" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$user/$REPO_NAME/pages" \
  -d "build_type=workflow")
if [ "$code" = "201" ]; then echo "  已开启"
elif [ "$code" = "409" ]; then echo "  已开启过，继续"
else echo "  返回 $code（若失败可稍后在仓库 Settings → Pages 手动选 GitHub Actions）"; fi

echo "== [3/4] 推送代码 =="
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$user/$REPO_NAME.git"
git push -u origin main

echo "== [4/4] 等待云端部署 =="
url=""
for i in $(seq 1 30); do
  sleep 10
  resp=$(curl -s -H "$auth" "https://api.github.com/repos/$user/$REPO_NAME/actions/runs?per_page=1")
  st=$(echo "$resp" | grep -o '"status": *"[^"]*"' | head -1 | cut -d'"' -f4)
  con=$(echo "$resp" | grep -o '"conclusion": *"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "  [$((i*10))s] status=$st conclusion=$con"
  if [ "$st" = "completed" ]; then
    if [ "$con" = "success" ]; then url="https://$user.github.io/$REPO_NAME/"; fi
    break
  fi
done

echo ""
if [ -n "$url" ]; then
  echo "✅ 上线成功：$url"
  echo "   分享示例：${url}#a=5 （直达曹操）"
else
  echo "⚠️ 部署未确认成功，请查看：https://github.com/$user/$REPO_NAME/actions"
  echo "   若失败多为 Pages 尚未生效，点 Actions 里该次运行的 Re-run jobs 重跑即可。"
fi
