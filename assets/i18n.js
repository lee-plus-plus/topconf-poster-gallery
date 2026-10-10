/* UI translations only; catalog identifiers and paper content stay unchanged. */
window.PosterI18n=(()=>{
  const translations={"友链 ↗": "Links ↗", "顶会论文海报画廊": "Conference Poster Gallery", "论文筛选": "Paper filters", "搜索标题、作者、主题": "Search titles, authors, topics", "搜索标题、作者、主题…": "Search titles, authors, topics…", "会议": "Conference", "年份": "Year", "录用": "Acceptance", "主题": "Topics", "排序": "Sort", "展示": "View", "列数": "Columns", "全部": "All", "会议筛选": "Conference filter", "年份筛选": "Year filter", "录用筛选": "Acceptance filter", "主题筛选": "Topic filter", "不限会议": "Any conference", "不限年份": "Any year", "不限录用类型": "Any acceptance type", "不限主题": "Any topic", "相关度": "Relevance", "Oral 优先": "Oral first", "标题 A–Z": "Title A–Z", "图像和文字": "Images and text", "仅图像": "Images only", "仅文字": "Text only", "清空": "Clear", "重置": "Reset", "已选条件": "Selected filters", "暂无匹配论文": "No matching papers", "重置筛选": "Reset filters", "重新加载": "Retry", "海报列表": "Poster gallery", "上一张海报": "Previous poster", "下一张海报": "Next poster", "关闭预览": "Close preview", "顺时针旋转海报90度": "Rotate poster 90° clockwise", "旋转海报": "Rotate poster", "完整海报": "Full poster", "论文原文": "Paper", "官方页面": "Official page", "图片": "Image", "详情": "Details", "按此主题筛选": "Filter by this topic", "未注明": "Unspecified", "搜索": "Search", "正在加载…": "Loading…", "加载中…": "Loading…", "正在筛选…": "Filtering…", "正在更新…": "Updating…", "更新": "Update", "海报暂不可用": "Poster unavailable", "筛选失败，可重试": "Filtering failed. Please retry.", "正在加载论文索引…": "Loading paper index…", "无法读取会议索引，请检查网络后重试": "Unable to load the conference index. Check your connection and retry.", "半弱无监督学习": "Semi-supervised, weakly supervised, and unsupervised learning", "大模型应用": "LLM applications", "鲁棒可信机器学习": "Robust and trustworthy ML", "其他方向": "Other topics", "半监督学习": "Semi-supervised learning", "弱监督与标签学习": "Weak supervision and label learning", "无监督与聚类": "Unsupervised learning and clustering", "自监督与对比学习": "Self-supervised and contrastive learning", "高效推理": "Efficient inference", "KV缓存": "KV cache", "推测解码": "Speculative decoding", "量化与压缩": "Quantization and compression", "幻觉检测与缓解": "Hallucination detection and mitigation", "智能体": "Agents", "多智能体": "Multi-agent systems", "检索增强RAG": "Retrieval-augmented generation (RAG)", "推理与测试时扩展": "Reasoning and test-time scaling", "大模型安全与对齐": "LLM safety and alignment", "不确定性": "Uncertainty", "校准": "Calibration", "保形预测": "Conformal prediction", "分布外与泛化": "Out-of-distribution learning and generalization", "对抗与鲁棒性": "Adversarial learning and robustness", "隐私与公平": "Privacy and fairness", "论文标题": "Paper title", "中稿类型": "Acceptance type", "研究方向（多标签）": "Research areas (multiple labels)", "细分主题": "Topic labels", "海报图片链接": "Poster image URL", "原文链接": "Paper URL", "官方录用字段": "Official acceptance field", "官方会议页面": "Official conference page", "元数据来源": "Metadata source", "浏览、筛选 NeurIPS、ICML、ICLR 论文海报。离线索引，原图预览。": "Browse and filter NeurIPS, ICML and ICLR paper posters. Offline index and full-size previews.", "条目ID": "Record ID", "会议事件ID": "Conference event ID", "来源ID": "Source ID", "作者": "Authors", "索引格式版本": "Index schema version", "索引生成时间": "Index generated at", "来源更新时间": "Source updated at"};
  const reverse=new Map(Object.entries(translations).map(([zh,en])=>[en,zh]));
  // Two Chinese loading labels share one English label; normalize either to the same status.
  let language='zh';try{language=localStorage.getItem('poster-language')==='en'?'en':'zh';}catch{}
  function english(value){return translations[value]||value;}
  function text(value){
    const canonical=reverse.get(value)||value;
    if(translations[canonical])return language==='en'?translations[canonical]:canonical;
    let m;
    if((m=value.match(/^(\d+) 项$/))||(m=value.match(/^(\d+) selected$/)))return language==='en'?`${m[1]} selected`:`${m[1]} 项`;
    if((m=value.match(/^([\d,]+ \/ [\d,]+) 张$/))||(m=value.match(/^([\d,]+ \/ [\d,]+) posters$/)))return m[1]+(language==='en'?' posters':' 张');
    if((m=value.match(/^(\d+) 个来源更新失败$/))||(m=value.match(/^(\d+) sources failed to update$/)))return language==='en'?`${m[1]} sources failed to update`:`${m[1]} 个来源更新失败`;
    for(const [zh,en] of [['查看完整海报：','View full poster: '],['官方录用字段：','Official acceptance: '],['无法完成筛选：','Unable to filter: ']]){
      if(value.startsWith(zh)||value.startsWith(en)){const suffix=value.slice(value.startsWith(zh)?zh.length:en.length);return (language==='en'?en:zh)+text(suffix);}
    }
    if(value.startsWith('移除筛选：')||value.startsWith('Remove filter: ')){
      const parts=value.replace(/^(移除筛选：|Remove filter: )/,'').split(/：|: /).map(text);
      return (language==='en'?'Remove filter: ':'移除筛选：')+parts.join(language==='en'?': ':'：');
    }
    if(value.endsWith(' ×'))return text(value.slice(0,-2))+' ×';
    if(value==='Top-Conf Poster Gallery · 顶会论文海报画廊'||value==='Top-Conf Poster Gallery · Conference Poster Gallery')return 'Top-Conf Poster Gallery · '+text('顶会论文海报画廊');
    return value;
  }
  const attributes=['aria-label','placeholder','title','content'];
  function translate(node){
    if(node.nodeType===3){if(node.parentElement?.closest('[data-i18n-literal],script,style,#cards h2,#viewer-title,.card-authors,#viewer-authors,#viewer-conference'))return;const next=text(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;return;}
    if(node.nodeType!==1||node.matches('script,style'))return;
    if(node.matches('[data-i18n-literal]')){if(node.dataset.i18nLabelPrefix){const label=text(node.dataset.i18nLabelPrefix)+node.dataset.i18nLabelValue;if(node.getAttribute('aria-label')!==label)node.setAttribute('aria-label',label);}return;}
    for(const attr of attributes){if(attr==='content'&&!node.matches('meta[name=description]'))continue;if(node.hasAttribute(attr)){const value=node.getAttribute(attr),next=text(value);if(next!==value)node.setAttribute(attr,next);}}
    for(const child of node.childNodes)translate(child);
  }
  function apply(){
    document.documentElement.lang=language==='en'?'en':'zh-CN';translate(document.documentElement);
    const button=document.getElementById('language');button.textContent=language==='en'?'中文':'English';button.setAttribute('aria-label',language==='en'?'Switch to Chinese':'切换为英文');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    apply();document.getElementById('language').addEventListener('click',()=>{language=language==='en'?'zh':'en';try{localStorage.setItem('poster-language',language);}catch{}apply();});
    // New cards and asynchronous statuses use the current language without rebuilding images.
    new MutationObserver(records=>{for(const record of records){if(record.target.parentElement?.closest('#language')||record.target.id==='language')continue;if(record.type==='childList')record.addedNodes.forEach(translate);else translate(record.target);}}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  });
  return {text,english,get language(){return language;}};
})();
