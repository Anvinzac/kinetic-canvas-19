# Workflow Preferences

- Prefers a "plan first, then implement" workflow: explicitly asks to plan effortfully before coding large changes (e.g., "plan effortfully at first", "plan to do this", "plan to do so"). Confidence: 0.95
- Commits and pushes frequently with concise messages, and expects unrelated/untracked files to be excluded from each commit. Repeatedly issues "commit push", "commit to main", "push also", plus diff-tab instructions to exclude unrelated changes. Confidence: 0.9
- When given a spec/plan file, implement it to completion (track to-dos as in_progress through the end) rather than stopping partway. Confidence: 0.8
- Expects the agent to actually run/preview the app and visually verify it (and check it against the repo state) rather than only reasoning about code. Confidence: 0.8
- Prefers substantial review/analysis deliverables (e.g., a staff/code review) be exported to a Markdown file in the repo rather than left only in chat, so they can reference the artifact and request follow-up work (like fixes) separately. Confidence: 0.7
