<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Auto-Push Rule
每當完成程式碼修改與驗證後，必須自動執行 Git Commit 與 Git Push（如 `git add .`, `git commit -m "..."`, `git push`），將程式碼寫入版本控制並同步至遠端。

