# Changelog

This file records user-visible features, data changes, and maintenance revisions.

## [1.0.0] - 2026-10-17

### Changed

- Removed the topic filter, keyword chips, derived topic labels, and keyword-label fields from the browser index and CSV export.
- Renamed the layout control to “Layout” / “排版” and made its option labels distinguish between `3 columns` and the compact selected value `3 col`.
- Hid the sort selector and kept the default relevance ordering.
- Unified dropdown wording, acceptance multi-selection counts, view labels, control heights, hover states, and responsive control sizing.
- Moved Reset into the search row in the responsive grid layout while keeping it at the end of the filter row in the ordinary layout.
- Tightened poster-card spacing and normalized the color control width and appearance with the other controls.

### Removed

- Removed generated topic-classification rules and derived `directions` / `tags` fields from the index pipeline.
- Removed rebuildable analysis outputs and downloader state files from the working tree; local archives remain ignored by Git.

### Maintenance

- Formatted the maintained HTML, CSS, JavaScript, CommonJS, and Python source files.
- Updated README, data schema, maintenance, source-audit, and design-QA documentation.
- Fixed the reliability-test fixture so it tracks the current filter state model.

## [7402f88]

### Maintenance

- Saved the formatted cleanup and documentation revision as Git commit `7402f88`.
- Added explicit ignore rules for local poster archives, generated analysis outputs, and promotion materials.
