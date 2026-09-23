# Communication Preferences

- Likes clear Markdown instruction docs written for handoff to external AI tools (e.g., Lovable), specifying exactly what goes where. Confidence: 0.85
- When requesting diff/code reviews (e.g., "staff reviewer"), expects a structured analysis covering: hidden invariants broken (with file:line), downstream ripple effects, tech debt (duplication, stale abstraction, coupling), and real-world failure simulation (high load, retry, race condition, missing index). Wants each finding in the format `[SEVERITY] file:line - why it will fail in prod`. Confidence: 0.85
