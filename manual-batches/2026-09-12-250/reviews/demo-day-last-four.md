# Demo Day: supplemental last-four review

2026-09-12 · finite scope: vc-manual250-c2-047–050

## Outcome and actual coverage

No blocking factual defect identified in the four reviewed articles. The warnings below concern source-mapping precision and optional procedural improvements; they are not publication blockers established by this review.

Read all four complete author-draft bodies and all four complete JSON sidecars, including all 12 FAQ answers, their evidence mappings, source notes and review notes. Subsequently read the integrated frontmatter and complete editorial notes for all four articles, and verified that each integrated article contains the previously read draft body byte for byte. Independently inspected the relevant live body passages of all eight cited primary sources. No article or cited source in this four-item scope remains unreviewed.

This is a supplemental review, not another first-ten review, publication approval or an independent certification of the products. The report is the only file written during this review. Existing drafts remain frozen; no Git, runtime, production, credential, publishing or external-state changes were made.

## Reviewed articles and useful work products

| ID | Article and metadata | Specific reader job and work product | Finding |
| --- | --- | --- | --- |
| c2-047 | [Make Demo Subtitles Survive Event Playback](../articles/demo-subtitles-event-playback-delivery.md) · [editorial notes](../editorial-notes/demo-subtitles-event-playback-delivery.json) | Trace caption packaging, supported insertion, track selection and audience-visible playback. Three-route delivery matrix distinguishes selectable tracks, inserted sidecars and burned-in fallback. | No factual blocker identified. Version/platform qualifications are appropriate. |
| c2-048 | [Balance Narration and Product Sound in an Investor Demo](../articles/investor-demo-narration-product-sound-mix.md) · [editorial notes](../editorial-notes/investor-demo-narration-product-sound-mix.json) | Mix an existing recording around changes in evidentiary sound priority. Four-interval timeline protects actual product audio from narration and optional music. | No factual blocker identified. See W1 and optional refinement W2. |
| c2-049 | [Capture a Voice Product Demo From Command to Result](../articles/voice-product-investor-demo-recording.md) · [editorial notes](../editorial-notes/voice-product-investor-demo-recording.json) | Capture and attribute user speech, product output and founder explanation from one run. RUN-03 sheet preserves clarification, synchronization and the visible result. | No factual blocker identified. See W1 and optional refinement W2. |
| c2-050 | [Fix Flicker When Filming a Prototype for Investors](../articles/prototype-display-flicker-investor-demo.md) · [editorial notes](../editorial-notes/prototype-display-flicker-investor-demo.json) | Compare supported camera and lighting conditions without hiding real indicator behavior. Four-test fictional matrix changes one planned factor at a time and requires a complete-action check. | No factual blocker identified. See W1 for an upstream FAQ mapping. |

The jobs are materially different: caption delivery, prerecorded mixing, voice-interaction evidence and physically filmed display sampling. This was not a new whole-corpus overlap audit.

## Blocking corrections

None established from the reviewed text and inspected primary passages.

In particular, newer SRT support is real and version-dependent; PowerPoint documents selecting supported caption tracks in Slide Show; both cited editors document the bounded ducking mechanics described; Zoom's computer-audio sharing is distinct from microphone sound; Apple's synchronization page discusses same-take sources; and Canon's cited page includes movie-recording settings and a warning about preview-versus-recorded results. These are not unsupported citations merely because some article procedures are original editorial synthesis.

## W1 — Keep source authority and editorial inference distinct

The most concrete mismatch is in the original c2-050 author sidecar: the FAQ asking whether the live preview proves flicker is fixed points to the iPhone guide. The directly relevant warning is on the already-cited Canon page, under the manual-setting cautions. The answer and article attribution are sound; align that upstream evidence mapping if those mappings are reused.

Important scope distinction: the integrated [c2-050 editorial notes](../editorial-notes/prototype-display-flicker-investor-demo.json) retain the FAQ as editorial and do not carry the sidecar's individual evidence URL. Therefore this is not a claim that the integrated article currently publishes an incorrect FAQ link.

Two further precision points:

- In [c2-048](../articles/investor-demo-narration-product-sound-mix.md), the first source label says “Adjust volume in iMovie for Mac,” while the actual page is titled “Add audio effects in iMovie on Mac.” Its relevant subsection does support lowering other clips. Matching the actual title would improve identification; the URL itself is not wrong.
- The original c2-048 distortion FAQ points to that ducking page, and c2-049's speaker-labeling and clarification-retention FAQs point to Zoom's sharing page. Those pages do not directly establish the editorial preservation rules. The integrated [c2-048 notes](../editorial-notes/investor-demo-narration-product-sound-mix.json) and [c2-049 notes](../editorial-notes/voice-product-investor-demo-recording.json) already mark FAQs and work products as editorial. Retain that distinction; do not recast those answers as publisher instructions or observed PAA.

These are provenance refinements, not evidence that the underlying recommendations are false.

## W2 — Optional improvements to the completed procedures

For [c2-049's capture sheet](../articles/voice-product-investor-demo-recording.md), add one clearly fictional completed row connecting an actual-style source filename, command-end position, response-onset position and corresponding visible state. The existing table is useful planning material and tells the reader to add time positions later, but does not demonstrate a completed timing reference. An explicit interruption-result row would also make the assigned capture job easier to execute. Such positions should remain edit references, not advertised latency measurements.

For [c2-048's ducking section](../articles/investor-demo-narration-product-sound-mix.md), consider one practical caution after the manual-adjustment advice: Adobe says generating keyframes again overwrites manual changes. The article does not instruct the reader to regenerate them, so its existing advice is not false. This is a useful protection against a plausible later editing mistake.

Neither improvement requires generic additional content or a change to the approved reader job.

## Primary-source body receipts

All checked live on 2026-09-12. These receipts describe relevant passages inspected, not a claim to have read every navigation item or linked page.

| Source | Inspected support and limits |
| --- | --- |
| [Microsoft: Add closed captions or subtitles to media in PowerPoint](https://support.microsoft.com/en-us/powerpoint/add-closed-captions-or-subtitles-to-media-in-powerpoint) | Windows and Mac insertion sections describe WebVTT, version-dependent SRT support and checking playback. Supports c2-047's conditional packaging guidance, not universal support across every release. |
| [Microsoft: Accessibility features in video and audio playback](https://support.microsoft.com/en-us/powerpoint/accessibility-features-in-video-and-audio-playback-on-powerpoint) | Opening and track-selection sections cover supported embedded/inserted captions and the Audio and Subtitles control in Slide Show. Supports c2-047's activation distinction. |
| [Apple: Add audio effects in iMovie on Mac](https://support.apple.com/en-ae/guide/imovie/mov84788882d/mac) | “Lower the volume of other clips that play at the same time” describes a selected foreground clip and relative level control. Supports c2-048's narrow software claim, not a distortion-restoration procedure. |
| [Adobe: Automatically duck audio](https://helpx.adobe.com/uk/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html) | Essential Sound type assignments, generated Amplify-effect keyframes and manual adjustment are documented. The final note warns that regeneration overwrites manual adjustments. |
| [Zoom: Sharing background music or computer audio](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0063608) | Share Sound and Computer Audio sections support c2-049's separate output path. The phone/computer note addresses feedback. This page does not certify what every recording configuration saves. |
| [Apple: Sync audio and video in Final Cut Pro](https://support.apple.com/en-ie/guide/final-cut-pro/verc1fabc30/mac) | Same-take examples and synchronization controls discuss audio, timecode and marker references. Supports c2-049's alignment mechanics, not an inference that different executions become one real interaction. |
| [Canon EOS R3: High-Frequency Anti-Flicker Shooting](https://cam.start.canon/en/C010/manual/html/UG-03_Shooting-1_0110.html) | Automatic/manual sections include movie-recording ranges; manual-setting cautions distinguish display simulation from recorded results. Supports c2-050's model-specific testing rationale, not universal shutter values. |
| [Apple: Record a video with your iPhone camera](https://support.apple.com/en-nz/guide/iphone/iph61f49e4bb/ios) | “Change video recording formats” makes available formats and frame rates model-dependent. Supports c2-050's control-availability limitation, not its preview warning. |

## Mechanical checks and review limits

Fresh read-only checks at 2026-09-12T03:46:53.948Z found all eight author-draft files unchanged from the snapshots read, with no checked structural errors.

| ID | Body words, Markdown formatting removed | Lead words | Main H2s | FAQs | Cited primary sources |
| --- | --- | --- | --- | --- | --- |
| c2-047 | 1,146 | 54 | 6 | 3 | 2 |
| c2-048 | 1,112 | 54 | 6 | 3 | 2 |
| c2-049 | 1,134 | 55 | 6 | 3 | 2 |
| c2-050 | 1,170 | 51 | 6 | 3 | 2 |

Each body has the required download CTA and two distinct exact retained-topic links. Description and graphic-brief lengths passed the scoped checks. No identical normalized prose paragraph of at least 16 words was found across these four bodies; this is not a comprehensive plagiarism assessment.

All 12 FAQs remain editorial. Integrated notes contain main's SERP receipts, but those receipts and external search results were not independently re-collected or validated here. No search-volume, difficulty, CPC, admissions, fundraising, latency or reliability result is established by this review.

Unreviewed and outside this finite scope: actual event computers, editor/camera operation, audio/video exports, rendered pages, the supplied product-media file and poster, rendered SVGs, native application contract execution, competitor-page bodies and a whole-campaign overlap audit. Metadata references to those assets are not visual or runtime verification.

## Integrated snapshots

The complete integrated bodies matched the author text already read; their frontmatter and editorial notes were then inspected. Findings apply to these snapshots, not to later edits.

| ID | Article SHA-256 | Editorial-notes SHA-256 |
| --- | --- | --- |
| c2-047 | `513b91fe4321e896eaabd0e2fd7067b8895b3ade624739b9d53f5fc90f7b47e6` | `b52be52ffd310e3daa98aaedaab8a77a7d2680fb58e3ba96c724e4efea77a29c` |
| c2-048 | `c9747d0cd5ded1b00ad8565f7ddd2644ad26f76a7fe1f0292a261ec68d2f3255` | `ff711633aae433b80d2f061a2f2b955d221850a1275c05ecc950204b50365e21` |
| c2-049 | `c5ed75ece7cbdf54ed28826df8ccf75ec28d28d7531133d51513fa0dc5974ae8` | `250ae03b98ba896e3af58dbad5111a26ff9437345ba22e41db5a7f00185f595d` |
| c2-050 | `b177968be0b34c55b525304c05ff804d2d438b324207e029c34d0440d27f734c` | `ceb8032a292e7201bd646064fe5c9523eb98710fe7afe4007b41cdaff8d8caa5` |

Supplemental review ends here. No further research, draft edits or monitoring are scheduled.
