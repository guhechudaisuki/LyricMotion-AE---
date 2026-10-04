# 映词 LyricMotion AE

面向 MAD / AMV 的动态歌词排版面板。生成透明合成、可编辑文字图层与字旁形状，支持遮罩进退场、关键词大小对比、高亮、歌曲风格及自建随机集合。

## 安装 1.5.4

1. 从 [Releases](https://github.com/guhechudaisuki/LyricMotion-AE---/releases) 下载 EXE 安装器。
2. 关闭映词面板并运行安装器，选择插件和 resources 的存放目录。安装器自动建立 AE 扩展入口，检查并复用本地资源，只下载缺失或损坏的文件；更换目录时也会复用原安装的资源。
3. 自行打开或重启 After Effects，在 **窗口 → 扩展 → 映词 LyricMotion** 打开面板。

环境：Windows 10 1803 / Windows 11，AE 2022 或以上；安装时需访问 GitHub，预留约 3 GB 临时磁盘空间。无需 Node.js、Git 或开发工具。安装器不会启动 AE。

插件和 resources 保存在同一个自选目录中。安装器在当前用户的 Adobe CEP 扩展目录建立目录联接，AE 通过该入口读取插件。升级会记住上次位置；若原插件直接位于标准目录，更换位置后原文件保留在本机的旧安装备份中。卸载只清理安装清单内的文件，保留用户额外添加的文件。

## 功能

- 140 个内置排版、28 种文字运动、48 种字旁元素；默认无固定风格，左右分配，避开画面中心。
- 歌曲分类与完全随机共用同一风格入口；自建风格可指定排版、文字运动、小元素、位置、字体、配色等随机范围。
- 进场、退场各至少 25%，合计不超过 100%；停留阶段文字保持静止。
- SRT / LRC 时间保留，使用 `主歌词|副标题` 指定附加文字。
- 可选大模型翻译位于设置中；按整首歌词请求，持久化缓存默认 500 首，可调整上限并按最近使用淘汰。API Key 只保留在当前面板会话中。
- 预渲染完成后自动导入当前 AE 项目并创建可调用的视频合成。
- 522 项精选资源：503 个 FFX、19 个 AEP，以及匹配预览和工程引用的 PNG 序列。支持继续扫描自己的文件夹。

使用细节见 [使用指南](docs/USER_GUIDE.md)，资源来源与限制见 [第三方资源说明](THIRD_PARTY_NOTICES.md)。

## 开发

需要 Node.js 24。

```sh
git clone --single-branch --branch main https://github.com/guhechudaisuki/LyricMotion-AE---.git
cd LyricMotion-AE---
npm ci
npm run check
npm run test:panel
```

面板检查首次需运行 `npx playwright install chromium`。资源单独版本化，源码构建不下载第三方资源；Windows 开发者可运行 `npm run resources:fetch` 获取安装器使用的同一批资源，再执行 `npm run resources:verify`。

```sh
npm run build
npm run package
```

打包需要 NSIS 3。通过 `NSIS_PATH` 指定 `makensis.exe`，或放入 PATH。输出在 `dist/`，安装器只包含插件代码和校验清单。

## 工程结构

| 目录                      | 职责                                   |
| ------------------------- | -------------------------------------- |
| `src/shared/`             | Canvas 与 AE 共用的 ES3 布局和运动逻辑 |
| `src/panel/`              | CEP 面板、桥接、预设库、字幕与翻译     |
| `src/host/`               | AE 图层、预设、工程与渲染适配          |
| `src/node/`               | 安装目录资源解析和 AEP 素材路径重建    |
| `src/data/`               | 默认演示和精选库相对路径索引           |
| `scripts/`                | 构建、检查、资源打包与安装器生成       |
| `tests/`                  | 单元回归及模拟 AE 的真实面板流程       |
| `installer/`              | NSIS 界面与下载校验脚本                |
| `resources/manifest.json` | 资源文件清单和 SHA-256                 |

详见 [架构](docs/ARCHITECTURE.md)、[贡献指南](CONTRIBUTING.md)、[发布流程](docs/RELEASING.md)。个人素材清单、参考视频、API 配置、开发工具和构建产物不进入 Git。

## 验证范围

检查覆盖 JS / ES3 语法、时间解析、布局、进退场约束、资源完整性、路径迁移、预渲染错误处理和模拟 AE 的面板流程。没有启动或控制 AE，也没有执行真实 AE 渲染。字体替代、FFX 自定义控件以及不同 AE 版本的实际表现仍需在 AE 中验收。

历史 1.0.0–1.4.2 Release 是更新记录归档：未找到可核实的旧源码快照或原安装包，不提供冒充旧版本的新二进制。
