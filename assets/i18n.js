/* UI translations only; catalog identifiers and paper content stay unchanged. */
window.PosterI18n = (() => {
  const translations = {
    "论文主图画廊 ↗": "Figure Gallery ↗",
    顶会论文海报画廊: "Conference Poster Gallery",
    论文筛选: "Paper filters",
    "搜索标题、作者": "Search titles, authors",
    "搜索标题、作者…": "Search titles, authors…",
    会议: "Conference",
    年份: "Year",
    录用: "Acceptance",
    排版: "Layout",
    "1列": "1 col",
    "2列": "2 col",
    "3列": "3 col",
    "4列": "4 col",
    "1 列": "1 column",
    "2 列": "2 columns",
    "3 列": "3 columns",
    "4 列": "4 columns",
    形状: "Shape",
    横图: "Landscape",
    竖图: "Portrait",
    关键色: "Key color",
    颜色: "Color",
    关键色匹配: "Key color matching",
    未选择: "None selected",
    选择强调色: "Choose accent color",
    选择后自动按颜色相似度排序: "Sort by color similarity after selection",
    应用颜色并排序: "Apply color and sort",
    清除关键色: "Clear key color",
    排序: "Sort",
    展示: "View",
    列数: "Columns",
    全部: "All",
    会议筛选: "Conference filter",
    年份筛选: "Year filter",
    录用筛选: "Acceptance filter",
    排版筛选: "Layout filter",
    形状筛选: "Shape filter",
    不限会议: "Any conference",
    不限年份: "Any year",
    不限录用类型: "Any acceptance type",
    不限形状: "Any shape",
    其他: "Other",
    相关度最高: "Relevant",
    最相关: "Relevant",
    年份最新: "Newest",
    最新: "Newest",
    "Oral 优先": "Oral first",
    "标题 A–Z": "Title A–Z",
    "图像 + 文字": "Images + text",
    仅图像: "Images only",
    仅文字: "Text only",
    清空: "Clear",
    重置: "Reset",
    已选条件: "Selected filters",
    暂无匹配论文: "No matching papers",
    重置筛选: "Reset filters",
    重新加载: "Retry",
    海报列表: "Poster gallery",
    上一张海报: "Previous poster",
    下一张海报: "Next poster",
    关闭预览: "Close preview",
    顺时针旋转海报90度: "Rotate poster 90° clockwise",
    旋转海报: "Rotate poster",
    完整海报: "Full poster",
    论文原文: "Paper",
    官方页面: "Official page",
    图片: "Image",
    详情: "Details",
    未注明: "Unspecified",
    搜索: "Search",
    "正在加载…": "Loading…",
    "加载中…": "Loading…",
    "正在筛选…": "Filtering…",
    "正在更新…": "Updating…",
    更新: "Update",
    海报暂不可用: "Poster unavailable",
    "筛选失败，可重试": "Filtering failed. Please retry.",
    "正在加载论文索引…": "Loading paper index…",
    "无法读取会议索引，请检查网络后重试":
      "Unable to load the conference index. Check your connection and retry.",
    论文标题: "Paper title",
    中稿类型: "Acceptance type",
    海报图片链接: "Poster image URL",
    原文链接: "Paper URL",
    官方录用字段: "Official acceptance field",
    官方会议页面: "Official conference page",
    元数据来源: "Metadata source",
    "浏览、筛选 NeurIPS、ICML、ICLR 论文海报。离线索引，原图预览。":
      "Browse and filter NeurIPS, ICML and ICLR paper posters. Offline index and full-size previews.",
    条目ID: "Record ID",
    会议事件ID: "Conference event ID",
    来源ID: "Source ID",
    作者: "Authors",
    索引格式版本: "Index schema version",
    索引生成时间: "Index generated at",
    来源更新时间: "Source updated at",
  };
  const reverse = new Map(
    Object.entries(translations).map(([zh, en]) => [en, zh]),
  );
  // Two Chinese loading labels share one English label; normalize either to the same status.
  let language = "zh";
  try {
    language = localStorage.getItem("poster-language") === "en" ? "en" : "zh";
  } catch {}
  function english(value) {
    return translations[value] || value;
  }
  function text(value) {
    const canonical = reverse.get(value) || value;
    if (translations[canonical])
      return language === "en" ? translations[canonical] : canonical;
    let m;
    if (
      (m = value.match(/^(\d+) 项$/)) ||
      (m = value.match(/^(\d+) selected$/))
    )
      return language === "en" ? `${m[1]} selected` : `${m[1]} 项`;
    if (
      (m = value.match(/^([\d,]+ \/ [\d,]+) 张$/)) ||
      (m = value.match(/^([\d,]+ \/ [\d,]+) posters$/))
    )
      return m[1] + (language === "en" ? " posters" : " 张");
    if (
      (m = value.match(/^(\d+) 个来源更新失败$/)) ||
      (m = value.match(/^(\d+) sources failed to update$/))
    )
      return language === "en"
        ? `${m[1]} sources failed to update`
        : `${m[1]} 个来源更新失败`;
    for (const [zh, en] of [
      ["查看完整海报：", "View full poster: "],
      ["官方录用字段：", "Official acceptance: "],
      ["无法完成筛选：", "Unable to filter: "],
    ]) {
      if (value.startsWith(zh) || value.startsWith(en)) {
        const suffix = value.slice(
          value.startsWith(zh) ? zh.length : en.length,
        );
        return (language === "en" ? en : zh) + text(suffix);
      }
    }
    if (value.startsWith("移除筛选：") || value.startsWith("Remove filter: ")) {
      const parts = value
        .replace(/^(移除筛选：|Remove filter: )/, "")
        .split(/：|: /)
        .map(text);
      return (
        (language === "en" ? "Remove filter: " : "移除筛选：") +
        parts.join(language === "en" ? ": " : "：")
      );
    }
    if (value.endsWith(" ×")) return text(value.slice(0, -2)) + " ×";
    if (
      value === "Top-Conf Poster Gallery · 顶会论文海报画廊" ||
      value === "Top-Conf Poster Gallery · Conference Poster Gallery"
    )
      return "Top-Conf Poster Gallery · " + text("顶会论文海报画廊");
    return value;
  }
  const attributes = ["aria-label", "placeholder", "title", "content"];
  function translate(node) {
    if (node.nodeType === 3) {
      if (
        node.parentElement?.closest(
          "[data-i18n-literal],script,style,#cards h2,#viewer-title,.card-authors,#viewer-authors,#viewer-conference",
        )
      )
        return;
      const next = text(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== 1 || node.matches("script,style")) return;
    if (node.matches("[data-i18n-literal]")) {
      if (node.dataset.i18nLabelPrefix) {
        const label =
          text(node.dataset.i18nLabelPrefix) + node.dataset.i18nLabelValue;
        if (node.getAttribute("aria-label") !== label)
          node.setAttribute("aria-label", label);
      }
      return;
    }
    for (const attr of attributes) {
      if (attr === "content" && !node.matches("meta[name=description]"))
        continue;
      if (node.hasAttribute(attr)) {
        const value = node.getAttribute(attr),
          next = text(value);
        if (next !== value) node.setAttribute(attr, next);
      }
    }
    for (const child of node.childNodes) translate(child);
  }
  function apply() {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    translate(document.documentElement);
    const button = document.getElementById("language");
    button.textContent = language === "en" ? "中文" : "English";
    button.setAttribute(
      "aria-label",
      language === "en" ? "Switch to Chinese" : "切换为英文",
    );
  }
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.getElementById("language").addEventListener("click", () => {
      language = language === "en" ? "zh" : "en";
      try {
        localStorage.setItem("poster-language", language);
      } catch {}
      apply();
    });
    // New cards and asynchronous statuses use the current language without rebuilding images.
    new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.target.parentElement?.closest("#language") ||
          record.target.id === "language"
        )
          continue;
        if (record.type === "childList") record.addedNodes.forEach(translate);
        else translate(record.target);
      }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: attributes,
    });
  });
  return {
    text,
    english,
    get language() {
      return language;
    },
  };
})();
