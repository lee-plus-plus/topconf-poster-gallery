# 索引维护

python scripts/audit_sources.py 审计候选来源和原始缓存，缺少缓存时抓取官方元数据；python scripts/build_index.py 从已审计缓存重建 data/index-data.js，不下载海报。配置位于 data/sources.json，共 17 届。刷新缓存后必须重新审计，低于门槛的可选字段不会进入索引。

首次浏览直接读取 index-data.js，无需本地 API；IndexedDB 可以保留点击“更新”后取得的较新数据。清除站点存储可恢复打包快照。

会议和年份来自官方源；录用类型从官方 decision 字段归一化。方向和主题由标题、关键词与官方主题的词规则标注，属于检索辅助，不是人工学术评价。Oral / Spotlight 不等于引用影响力排名。

图像按需加载。离线时仍可筛选索引，但未缓存图像无法显示。方向识别低置信度时保留原图，也可手动旋转。

静态网站部署只需 index.html、assets/ 和发布用 data/ 文件；不要上传 _legacy/ 或 data/raw/。源代码已同步到 GitHub，网站托管需单独配置。

重新抓取公开官方元数据：python scripts/audit_sources.py --refresh；然后运行 python scripts/build_index.py。浏览器刷新遇到核心字段完整度低于 90% 时保留已有索引。

批量采集说明：三家会议当前 robots.txt 禁止自动抓取 /static，元数据更新接口位于该路径。已有离线索引可正常浏览；重新批量抓取前应核对站点规则并确认访问许可。图片 /media 路径未被通用规则禁止，不代表不限量下载许可。

## 本地开发与校验

浏览页面无需安装依赖。运行维护工具需要 Python 3.8+；筛选回归检查需要 Node.js。

```text
python -B scripts/validate.py
node scripts/validate_catalog.cjs
node scripts/validate_reliability.cjs
node --check assets/app.js
node --check assets/images.js
node --check assets/catalog.js
node --check assets/i18n.js
```

可选本地预览：`python scripts/preview.py`，随后打开 `http://127.0.0.1:8876/`。首次使用仓库时，直接打开根目录的 `index.html` 也可浏览。

## 文件组织与本地归档

- `assets/`：界面、筛选交互、翻译与图片缓存。
- `data/index-data.js`：浏览器直接读取的离线索引。
- `data/sources.json`：会议来源配置。
- `scripts/`：来源审计、索引构建和校验工具。
- `docs/`：来源审计说明、维护指南及参考项目许可。
- `_legacy/`：原有 300 张本地海报及历史清单，仅在维护者本地保留，不进入 Git。
- `data/raw/`：来源原始缓存，不进入 Git；新克隆的仓库不包含它，重建索引前需要准备原始缓存并重新审计。

Git 只备份已跟踪文件；本地归档与原始缓存需要单独备份。

## 图片缓存与加载

首次展示及每次追加最多 24 条记录。仅文字模式首次加载不请求海报图片；CSV 导出包含全部匹配记录，不受当前已展示数量限制。

浏览器通过 IndexedDB 缓存近期海报原图，最多 64 张、合计不超过 192 MiB；单张超过 32 MiB 时不写入该缓存。空间超限时淘汰最久未访问的图片。浏览器存储或跨域读取不可用时，回退到原图链接。浏览器可能自行清理缓存，缓存不能代替本地归档。

图片加载并发上限为 6；每个已启动任务最多等待 30 秒（包含缓存读取、网络请求及原生图片回退）。切换筛选或关闭预览会取消相应任务；等待图片不超过 8 张时可预加载下一批，避免单张慢图阻塞，也限制待加载积压。CSV 的字段与版本含义见 DATA_SCHEMA.md。
