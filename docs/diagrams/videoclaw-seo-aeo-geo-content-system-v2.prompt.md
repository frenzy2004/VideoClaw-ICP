# Diagram generation prompt

Tool: built-in ImageGen. Edit reference: `videoclaw-seo-aeo-geo-content-system.png`.
Output: `videoclaw-seo-aeo-geo-content-system-v2.png`.

```text
Use case: infographic-diagram. Asset type: repository architecture diagram, landscape high-resolution, approximately 16:10.
Input image 1 is the old diagram EDIT TARGET. Keep its VideoClaw visual language (warm paper, dark ink, mint, magenta, restrained halftone) but REPLACE its outdated workflow and all content with this clean new layout. Prioritize legible exact text and abundant whitespace. No people, no screenshots, no decorative arrows.

TITLE: "VIDEOCLAW CONTENT SYSTEM"
SUBTITLE: "Review-only checkpoint • 06 September 2026"

Three wide horizontal panels stacked vertically. All arrows point left to right BETWEEN ADJACENT BOXES ONLY. Absolutely no arrows connecting panels, no return arrows, no crossing arrows, no arrows passing behind or through boxes.

TOP PANEL label: "1. WORKER PIPELINE • VideoClaw-ICP • PR #1"
Six equal aligned boxes in one row:
"UP TO 50" / "Candidate searches" / "5 ICPs + new discovery"
"VALIDATE" / "Apify US/en SERPs" / "Suggestions + paid metrics*"
"TOP 10" / "Deep evidence checks" / "Sources + gaps + 3 FAQs"
"UP TO 3" / "Draft + critique" / "One bounded repair"
"QA" / "Markdown + real media" / "Native lander checks"
"DRAFT PRs" / "One per article" / "Future gated mode"
One straight arrow between each neighboring pair. Under this row one clear footer sentence: "*Paid metrics remain pending. Weekly schedule OFF. No automatic publishing."

MIDDLE PANEL label: "2. FIRST LIVE PILOT • APPROVED TO RUN, NOT YET RUN"
Four boxes in a straight row:
"APIFY ONLY" / "Volume / KD / CPC pending"
"ONE ARTICLE" / "Generate + critique + QA"
"ARTIFACT ONLY" / "Markdown + SVG + report"
"STOP" / "No lander branch or PR"
Straight adjacent arrows only. Footer: "Blocked by missing OPENAI_API_KEY and LANDER_READ_TOKEN."

BOTTOM PANEL label: "3. SITE REVIEW • videoclaw-lander • PR #55"
Three boxes in a straight row with arrows only between adjacent:
"3 MARKDOWN POSTS" / "Local /blog review" / "VideoClaw style + media"
"TEAM APPROVAL" / "Copy + sources + design" / "All approval flags remain false"
"FUTURE RELEASE" / "Human merge + indexing" / "NOT AUTHORIZED NOW"
The last box has a muted/dashed border and magenta label, making it unmistakably future work, not a completed action.

Bottommost full-width caption, no arrows: "TRACEABILITY: Campaign / ICP / intent / keyword / SERP evidence / source / article"
Small note beneath: "Worker state stores IDs, decisions and hashes. Raw SERPs stay in Apify. Secrets never enter Git."

Constraints: maximum readability, professional technical diagram, only the specified text, no invented progress percentages, no claim that Apify supplies measured search volume or difficulty, no statement that the pilot or production launch has happened. NO CROSSING ARROWS.
```
