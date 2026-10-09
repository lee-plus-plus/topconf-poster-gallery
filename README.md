# Top-Conf Poster Gallery

顶会海报静态画廊。双击根目录 index.html 即可浏览、筛选和导出 CSV，无需启动服务。

assets/ 是页面样式与交互；data/ 是官方海报元数据索引；scripts/ 是索引更新工具；docs/ 是维护说明和参考项目许可；_legacy/ 是原有 300 张海报、清单、旧页面及历史脚本，新页面不依赖它。

扩展索引共 35,884 条有完整海报链接的记录，覆盖 NeurIPS 2021–2025、ICML 2021–2026、ICLR 2021–2026，共 17 届；默认 Oral / Spotlight 共 5,987 条。该数值不代表会议全部论文的海报覆盖率。

筛选和导出在浏览器本地完成；海报从官方源按需加载，需要网络。MathJax 和自动旋转识别组件使用 CDN。点击“更新”刷新官方元数据，失败时保留已有索引。

界面参考 https://github.com/lee-plus-plus/topconf-paper-figure-gallery 。参见 NOTICE.md。

维护：python scripts/build_index.py 更新索引；python scripts/validate.py 校验目录和索引。python scripts/preview.py 提供可选调试预览。
筛选逻辑回归检查：node scripts/validate_catalog.cjs。界面检查记录见 docs/DESIGN_QA.md。
展示统一采用瀑布流，可选图像和文字、仅图像、仅文字。主题筛选统一包含研究方向和细分主题，以分割线区分，两组可混合多选。默认两列，可选 2–5 列；手机端自适应单列。仅文字模式首次加载不请求海报图片。

字段以每届 90% 为门槛。详细覆盖率与排除原因见 docs/SOURCE_AUDIT.md。先运行 python scripts/audit_sources.py，再运行 python scripts/build_index.py 重建索引。

重新抓取公开官方元数据：python scripts/audit_sources.py --refresh；然后运行 python scripts/build_index.py。浏览器刷新遇到核心字段完整度低于 90% 时保留已有索引。

无限滚动，首次加载及每次追加最多 24 条；剩余约 8 条时自动预加载下一批，变更筛选或排序重新加载。CSV 导出仍包含所有匹配记录。

浏览器使用 IndexedDB 缓存近期海报原图，最多 64 张且总量不超过 192 MiB，超限优先淘汰最久未访问的图片。刷新和预览优先读取本地缓存；跨域限制或浏览器存储不可用时回退到原图链接。仅文字模式不请求图片。

批量采集说明：三家会议当前 robots.txt 禁止自动抓取 /static，元数据更新接口位于该路径。已有离线索引可正常浏览；重新批量抓取前应核对站点规则并确认访问许可。图片 /media 路径未被通用规则禁止，不代表不限量下载许可。

本地开发使用 Python 3.8+ 和 Node.js，无需额外依赖。验证：

```text
python -B scripts/validate.py
node scripts/validate_catalog.cjs
node --check assets/app.js
```

Git 跟踪页面、工具、文档和可直接使用的离线索引。_legacy/ 历史海报归档及 data/raw/ 原始缓存保留在本地，但不进入版本库；Git 不能代替这两个目录的独立备份。参考项目许可保留在 docs/，论文和海报的权利说明见 NOTICE.md。

界面支持中文 / English，右上角切换并保存语言偏好。主题的中英文名称均可搜索；切换语言不改变筛选标识或论文原文。CSV 表头随界面语言切换，数据保留原始值。

项目代码采用 MIT License，完整条款见 LICENSE。参考项目的版权与许可声明保留在 NOTICE.md 和 docs/REFERENCE_LICENSE.txt。论文、海报及其他第三方材料的权利归原作者或相应权利人所有，MIT License 不适用于这些材料。
