# screen-live-html（羽毛球直播大屏）

公开仓库：<https://github.com/Facefall/screen-live-html>

用于羽毛球直播 HUD：顶栏、**记分牌**、主画面区、右侧三场预告、页脚等。场上文案与配图由 **`config/display.json`** 提供，保存后通过 SSE 推送到打开的页面，无需手工刷新。

## 开发与本地预览

- 环境：**Node.js ≥ 18**
- 安装依赖：`npm install`
- 启动服务：`npm run dev`（默认端口 **5173**）
- 浏览器打开：<http://localhost:5173/badminton.html>

可选 URL 参数：`?qa=1` 叠加参考图；`?copy=1` 显示文案调试层。全屏快捷键：**Alt + Enter**。

## 业务人员如何改字

请阅读 **[《业务使用说明》](./业务使用说明.md)**（改哪些键、注意什么、不配第三局比分时怎么显示等）。

## 技术备忘

- `public/display-live.js`：消费 `/events` SSE，把 `display.json` 的 `copy` / `images` 写到带 `data-live-text`、`data-live-img`、`data-live-bg` 的节点上。
- `scripts/server.mjs`：静态资源 + 监视 `config/display.json` 变更并广播。
