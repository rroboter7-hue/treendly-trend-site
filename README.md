# Trend Radar

这是一个本地趋势研究看板，前端不会保存或暴露 Treendly 账号信息。

Treendly 官方文档使用：

- Base URL: `https://treendly.com/api`
- Endpoint: `POST /quick-get`
- 认证参数：`uid` 和 `password`
- 官方文档：`https://treendly.com/docs`

## 启动

最简单：

```powershell
.\run-server.cmd
```

或者手动指定 Node：

```powershell
cd C:\Users\Admin\Documents\Codex\2026-06-30\new-chat-2\treendly-trend-site
C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe server.js
```

然后打开：

```text
http://127.0.0.1:4177
```

## 接入真实 Treendly API

Treendly API 是企业版，需要 Treendly 给你的 `uid` 和 `password`。在启动前设置：

```powershell
$env:TREENDLY_UID="你的UID"
$env:TREENDLY_PASSWORD="你的PASSWORD"
C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe server.js
```

没有设置账号时，页面会自动使用模拟数据，方便先测试搜索、趋势图、关键词表和来源跳转。
