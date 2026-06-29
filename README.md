# 博弈类游戏棋

纯前端双人对弈实现，使用 HTML、CSS、原生 JavaScript。规则来自原文章，并按确认规则实现：攻城车组合必须由车兵和对应己方兵全部进入对方宫殿才获胜。

## 为什么需要本地服务

页面使用了 JavaScript ES module：

```html
<script type="module" src="./src/ui.mjs"></script>
```

很多浏览器直接用 `file://` 打开时会对模块、相对导入、资源加载有额外限制。用本地 HTTP 服务打开更稳定，也方便浏览器调试和自动化验证。

## 启动游戏

在项目根目录中运行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

然后在浏览器打开：

```text
http://127.0.0.1:8765/
```

停止服务：回到启动服务的 PowerShell 窗口，按 `Ctrl+C`。

## 如果端口被占用

把 `8765` 换成其他端口，例如：

```powershell
python -m http.server 8770 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8770/
```
