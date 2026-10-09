# 索引维护

python scripts/audit_sources.py 审计候选来源和原始缓存，缺少缓存时抓取官方元数据；python scripts/build_index.py 从已审计缓存重建 data/index-data.js，不下载海报。配置位于 data/sources.json，共 17 届。刷新缓存后必须重新审计，低于门槛的可选字段不会进入索引。

首次浏览直接读取 index-data.js，无需本地 API；IndexedDB 可以保留点击“更新”后取得的较新数据。清除站点存储可恢复打包快照。

会议和年份来自官方源；录用类型从官方 decision 字段归一化。方向和主题由标题、关键词与官方主题的词规则标注，属于检索辅助，不是人工学术评价。Oral / Spotlight 不等于引用影响力排名。

图像按需加载。离线时仍可筛选索引，但未缓存图像无法显示。方向识别低置信度时保留原图，也可手动旋转。

公开部署只发布 index.html、assets/、data/；不要上传 _legacy。目前未执行远程发布。

重新抓取公开官方元数据：python scripts/audit_sources.py --refresh；然后运行 python scripts/build_index.py。浏览器刷新遇到核心字段完整度低于 90% 时保留已有索引。

批量采集说明：三家会议当前 robots.txt 禁止自动抓取 /static，元数据更新接口位于该路径。已有离线索引可正常浏览；重新批量抓取前应核对站点规则并确认访问许可。图片 /media 路径未被通用规则禁止，不代表不限量下载许可。
