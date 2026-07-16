# bilibili 直播标题显示

> 以前 阿 B 的 网页端 直播间 是放有标题的（大概是在 up 主头像那里显示），但某天好像突然就消失了，所以为了让其能再次正常显示，写了这么一个插件

在 **哔哩哔哩 网页端 直播间** 头部信息区显示 **当前直播标题**

## 安装

1. 打开 `chrome://extensions`（或 Edge：`edge://extensions`）
2. 开启**「开发者模式」→「加载已解压的扩展程序」**
3. 选择 本仓库根目录（`bilibili-live-title-display`）
4. 打开 `https://live.bilibili.com/...` 直播间即可

点击 **扩展图标** 可修改标题字体大小和颜色。

## 技术说明

| 项目 | 说明 |
|------|------|
| Manifest | V3 |
| 匹配页面 | `*://live.bilibili.com/*` |
| 标题来源 | `#link-app-title`（去掉后缀与最后一段 UP 名；直播名可含 ` - `） |
| 显示位置 | `#head-info-vm` 底部（依赖 `#head-info-vm > a` / `> div`） |
| 设置存储 | `chrome.storage.sync`（字体大小、颜色） |

## 目录结构

```text
.
├── manifest.json
├── content.js / content.css
├── popup.html / popup.js / popup.css
├── icons/
└── README.md
```

## 隐私说明

- 仅在 `live.bilibili.com` 注入脚本，读取页面上的公开标题文本并显示
- 仅使用 `storage` 权限保存字体大小与颜色（浏览器同步存储）
- 不收集账号信息，不发送网络请求，不读取 Cookie / Token

## License

MIT（见 [LICENSE](./LICENSE)）
