# 数据来源与字段审计

审计日期：2026-10-10。测试三大会议 2020 年及之后的官方公开元数据，纳入 17 届有完整海报链接的来源，共 35,884 条；其中 Oral / Spotlight 5,987 条。

门槛按每届会议分别判断：可选字段必须在所有纳入来源中均达到 90%，不能以总平均掩盖某一届缺失。分母为该届有非缩略图海报链接的记录；机构要求论文全部列名作者都有非空机构。海报数量不代表全部录用论文覆盖率，也不意味着已逐一验证所有远程图片可访问。

可靠核心字段：会议、年份、事件 ID、标题、作者、官方录用字段与归一化类型、完整海报链接、原文链接、会议详情链接。研究方向和细分标签是派生检索标签，不是作者原始关键词。

| 字段 | 各来源最低完整度 | 总体完整度 | 进入索引 |
|---|---:|---:|---|
| title | 100.00% | 100.00% | 是 |
| authors | 99.91% | 99.99% | 是 |
| decision_raw | 97.48% | 99.68% | 是 |
| paper_url | 97.48% | 99.27% | 是 |
| conference_page | 100.00% | 100.00% | 是 |
| keywords | 0.00% | 25.72% | 否 |
| official_topic | 0.00% | 65.58% | 否 |
| abstract | 0.00% | 81.86% | 否 |
| institutions | 78.39% | 90.41% | 否 |
| paper_pdf_url | 0.00% | 11.00% | 否 |
| author_profile_urls | 100.00% | 100.00% | 否 |

作者个人链接即使非空率高，也包含内部 API 路由和 testserver 地址，不作为可靠作者主页。机构虽然总体完整度超过 90%，但部分来源不达标，未加入。关键词、官方主题和摘要也未加入打包索引。

| 来源 | 完整海报记录 | 海报链接/Poster 条目 | 关键词 | 官方主题 | 全作者机构 |
|---|---:|---:|---:|---:|---:|
| [NeurIPS-2025](https://neurips.cc/static/virtual/data/neurips-2025-orals-posters.json) | 4,233 | 72.26% | 0.00% | 96.39% | 92.09% |
| [NeurIPS-2024](https://neurips.cc/static/virtual/data/neurips-2024-orals-posters.json) | 3,146 | 69.33% | 0.00% | 93.74% | 90.08% |
| [NeurIPS-2023](https://neurips.cc/static/virtual/data/neurips-2023-orals-posters.json) | 2,733 | 76.26% | 0.00% | 97.18% | 92.72% |
| [NeurIPS-2022](https://neurips.cc/static/virtual/data/neurips-2022-orals-posters.json) | 2,261 | 77.83% | 91.69% | 0.00% | 89.56% |
| [NeurIPS-2021](https://neurips.cc/static/virtual/data/neurips-2021-orals-posters.json) | 2,319 | 99.36% | 100.00% | 0.00% | 94.18% |
| [ICML-2026](https://icml.cc/static/virtual/data/icml-2026-orals-posters.json) | 3,153 | 47.57% | 0.00% | 96.64% | 89.79% |
| [ICML-2025](https://icml.cc/static/virtual/data/icml-2025-orals-posters.json) | 2,031 | 60.83% | 0.00% | 99.95% | 88.38% |
| [ICML-2024](https://icml.cc/static/virtual/data/icml-2024-orals-posters.json) | 1,938 | 73.58% | 0.00% | 94.53% | 90.25% |
| [ICML-2023](https://icml.cc/static/virtual/data/icml-2023-orals-posters.json) | 1,509 | 80.91% | 0.00% | 0.00% | 87.14% |
| [ICML-2022](https://icml.cc/static/virtual/data/icml-2022-orals-posters.json) | 1,072 | 86.94% | 99.63% | 0.00% | 97.20% |
| [ICML-2021](https://icml.cc/static/virtual/data/icml-2021-orals-posters.json) | 1,169 | 98.82% | 100.00% | 0.00% | 98.80% |
| [ICLR-2026](https://iclr.cc/static/virtual/data/iclr-2026-orals-posters.json) | 3,349 | 61.25% | 0.00% | 92.54% | 89.94% |
| [ICLR-2025](https://iclr.cc/static/virtual/data/iclr-2025-orals-posters.json) | 2,546 | 66.53% | 0.00% | 93.75% | 89.00% |
| [ICLR-2024](https://iclr.cc/static/virtual/data/iclr-2024-orals-posters.json) | 1,561 | 67.99% | 0.00% | 92.95% | 89.30% |
| [ICLR-2023](https://iclr.cc/static/virtual/data/iclr-2023-orals-posters.json) | 952 | 60.10% | 99.47% | 0.00% | 89.39% |
| [ICLR-2022](https://iclr.cc/static/virtual/data/iclr-2022-orals-posters.json) | 1,056 | 96.44% | 80.87% | 0.00% | 83.81% |
| [ICLR-2021](https://iclr.cc/static/virtual/data/iclr-2021-orals-posters.json) | 856 | 99.53% | 93.46% | 0.00% | 78.39% |

2020 年：NeurIPS、ICLR 的官方数据没有可用完整海报图；ICML 仅有缩略图，因此不加入页面来源。没有以缩略图、论文 PDF 或幻灯片冒充海报。

ICML 2023 原始原文链接完整度为 89.73%。使用 [PMLR 202 官方目录](https://proceedings.mlr.press/v202/) 做完整标题精确匹配（HTML 实体解码、Unicode 规范化、大小写和空白规范化），只接受唯一匹配，不做模糊匹配。补充映射在 data/paper-link-supplement.json。旧年份会议详情链接按已核验的 /virtual/{year}/poster/{id} 路径恢复。

候选字段的全部非空统计与每届分母见 data/source-audit.json。当前索引仅保存过门槛的核心字段和派生标签；浏览器刷新沿用相同字段规则。

维护：python scripts/audit_sources.py 审计缓存（缺少缓存时抓取）；python scripts/build_index.py 由审计结果和原始缓存重建索引。若要重新抓取某届，用已配置官方 URL 更新 data/raw/对应 JSON 后重新审计。原始缓存不发布，也不纳入 Git。

重新抓取公开官方元数据：python scripts/audit_sources.py --refresh；然后运行 python scripts/build_index.py。浏览器刷新遇到核心字段完整度低于 90% 时保留已有索引。

录用类型映射：ICLR 2023 的 notable-top-5% → Oral，notable-top-25% → Spotlight；ICML 2022 的 Long Presentation → Oral，Short Presentation → Spotlight。ICML 对应关系已通过官方日程核对：https://icml.cc/virtual/2022/session/20078 。原始 decision_raw 保留，映射仅作用于对应会议年份；NeurIPS 2022 的 Accept 无等级信息，仍为 Poster。浏览器已有元数据缓存也按新规则重新归类。
