# 数据字段与研究使用

网页中的 CSV 按钮导出全部匹配记录，不限于已加载的卡片。筛选会影响导出范围；需要完整索引时先清空筛选条件。作者、标题、原始录用信息与主题标识保持原始值，表头随界面语言切换。

## CSV 字段

| 中文表头 | 英文表头 | 内部字段 | 含义 |
| --- | --- | --- | --- |
| 论文标题 | Paper title | title | 来源中的论文标题 |
| 会议 | Conference | venue | NeurIPS、ICML 或 ICLR |
| 年份 | Year | year | 会议年份 |
| 中稿类型 | Acceptance type | acceptance_type | 归一化的 Oral、Spotlight、Poster |
| 研究方向（多标签） | Research areas (multiple labels) | directions | 规则生成的宽泛方向，多个值以分号分隔 |
| 细分主题 | Topic labels | tags | 规则生成的细分主题，多个值以分号分隔 |
| 海报图片链接 | Poster image URL | poster_url | 官方远程图片链接 |
| 原文链接 | Paper URL | paper_url | 论文页面或 PDF 链接 |
| 官方录用字段 | Official acceptance field | decision_raw | 原始录用描述 |
| 官方会议页面 | Official conference page | conference_page | 该会议的论文展示页面 |
| 元数据来源 | Metadata source | metadata_source | 官方元数据地址 |
| 条目ID | Record ID | id | `source_id-event_id`，例如 `ICML-2026-12345`（格式示例） |
| 会议事件ID | Conference event ID | event_id | 官方事件 ID，仅在所属来源内使用 |
| 来源ID | Source ID | source_id | 会议与年份，例如 `ICML-2026` |
| 作者 | Authors | authors | 作者姓名，以分号分隔 |
| 索引格式版本 | Index schema version | index_version | 打包索引的数据结构版本，不是论文版本 |
| 索引生成时间 | Index generated at | index_generated_at | 当前打包索引的生成时间，UTC ISO 8601 |
| 来源更新时间 | Source updated at | source_updated_at | 该条目所属来源最近一次成功导入的时间，UTC ISO 8601 |

条目 ID 基于会议事件 ID，适合追踪同一会议条目；它不是 DOI，也不是跨会议论文去重标识。只要官方事件 ID 不变，修改标题或主题不会改变该 ID。

点击“更新”可能使部分来源比打包索引更新。此时索引生成时间仍描述基础快照，应同时保存来源更新时间；来源更新时间不是论文修改日期。建议保存原始 CSV、筛选条件及使用的 Git 提交号，保证研究过程可以追溯。时间戳本身不能还原未保存的远程历史内容。

CSV 使用 UTF-8 BOM，所有单元格使用双引号并转义内部引号。列表字段用 `; ` 连接。可能被表格软件识别为公式的值会添加前导单引号。

## 数据边界

主题是规则标注，不是人工真值；应评估任务相关的标注质量。无匹配主题的论文仍被收录。海报图片按官方 URL 读取，CSV 不包含图像像素、OCR 文本、摘要或机构字段，也不保证远程链接永久有效。数据覆盖和采集约束见 SOURCE_AUDIT.md 与 MAINTENANCE.md。第三方论文、图片及其他材料的许可不因导出清单而改变。
