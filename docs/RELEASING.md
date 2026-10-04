# 发布流程

## 前置条件

Node.js 24、NSIS 3、Windows 系统 curl 和目标 GitHub 仓库写入权限。发布附件只允许安装器 `.exe`。资源包保存在独立资源分支，不作为 Release 附件。

## 步骤

1. 更新 `package.json`、锁文件、面板版本、CEP manifest 和宿主版本；执行 `npm run check`。
2. 如资源有变化，在维护者本地运行 `npm run bundle`，然后 `npm run resources:verify`。此步骤依赖被忽略的精选来源清单，普通贡献者使用 `npm run resources:fetch`。
3. 运行 `npm run resources:pack`。将 `artifacts/resource-upload/` 提交到独立版本资源分支。
4. 将该资源提交的完整 SHA 写入 `config/resources-lock.json` 的 `baseUrl`。禁止使用会漂移的分支 URL。
5. 在空目录运行同一 PowerShell 下载脚本，验证下载、解压、SHA-256、本地复用、损坏修复、失败路径及断点继续。
6. 运行 `npm run test:panel`、`npm run build`、`npm run package`。NSIS 只嵌入插件代码、下载器和校验清单。
7. 从不含 `.local/` 的干净源码副本执行构建。检查 `git diff --check`、文件清单、机器路径和凭据扫描。
8. 提交源码、创建版本标签、发布 Release，只附 `.exe`。将安装器 SHA-256 写入 Release 正文，并核对远端附件。

## 历史版本

1.0.0、1.1.0、1.2.0、1.3.0、1.4.0、1.4.1、1.4.2 只有已保存的更新文档。历史归档标签指向单独的文档提交，页面明确没有旧源码及旧安装包。不能将 1.5.0 源码打包改名为历史版本。

## AE 验收

自动流程不得启动 AE。真实字体、预设控件、PNG 序列、文字图层和渲染由使用者自行在 AE 中确认，结果与自动检查分开记录。
