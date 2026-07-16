# bilibili 直播标题显示

> 以前 阿 B 的 网页端 直播间 是放有标题的（大概是在 up 主头像那里显示），但某天好像突然就消失了，而如果某主播直播的前端页面被替换（比如有活动之类的，标签那里就不显示标题了）所以为了让其能再次正常显示，写了这么一个插件

在 **哔哩哔哩 网页端 直播间** 头部信息区显示 **当前直播标题**

## 安装

1. 打开 `chrome://extensions`（或 Edge：`edge://extensions`）
2. 开启**「开发者模式」→「加载已解压的扩展程序」**
3. 选择 本仓库根目录（`Bilibili-Live-Title-Display`）
4. 打开 `https://live.bilibili.com/...` 直播间即可 

点击 **扩展图标** 可修改标题字体大小和颜色。

## 目录结构

```text
.
├── manifest.json
├── content.js / content.css
├── popup.html / popup.js / popup.css
├── icons/
└── README.md
```

## License

MIT
