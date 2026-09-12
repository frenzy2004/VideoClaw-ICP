---
{
  "id": "vc-manual250-c2-047",
  "campaign": "accelerator-demo-day-founder",
  "icp": "US accelerator founder preparing founder video, product-demo media or investor presentation playback",
  "customerTrigger": "Subtitles exist in the edit but disappear when the investor video is played from the event deck",
  "funnelStage": "consideration",
  "primaryKeyword": "PowerPoint video subtitles not showing",
  "secondaryKeywords": [
    "PowerPoint video subtitles not showing",
    "event subtitle delivery",
    "demo caption playback"
  ],
  "searchIntent": "informational",
  "competitorGap": "Editorial opportunity hypothesis: Deliver captions through the actual event player and confirm they appear in presentation mode. Unlike c4's general caption review and the translation topic, this solves subtitle packaging and activation. Competing page bodies and exact-query SERPs have not been assessed for this draft.",
  "provenance": {
    "apifyRunId": "UZg3FufDQruZuQbdf",
    "apifyDatasetId": "cNxnl5rZUSNeVl2DE",
    "query": "PowerPoint video subtitles not showing",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Make Demo Subtitles Survive Event Playback",
  "description": "Deliver investor-demo subtitles through the actual event player with a caption-package matrix, track-selection test and a checked fallback copy.",
  "slug": "demo-subtitles-event-playback-delivery",
  "canonicalPath": "/blog/demo-subtitles-event-playback-delivery",
  "sources": [
    {
      "label": "Microsoft: Add captions or subtitles to media in PowerPoint",
      "url": "https://support.microsoft.com/en-us/PowerPoint/add-closed-captions-or-subtitles-to-media-in-powerpoint",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "Microsoft: Accessible media playback in PowerPoint",
      "url": "https://support.microsoft.com/en-us/powerpoint/accessibility-features-in-video-and-audio-playback-on-powerpoint",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Why can captions appear in the editor but not at the event?",
      "answer": "They may exist only in the project, be missing from the delivered package, use an unsupported format or remain unselected in the receiving player. Trace the exact file and playback path."
    },
    {
      "question": "Where should the caption track be checked?",
      "answer": "Check the intended track in the actual slideshow and audience display, including the first line, full-screen behavior and the final caption."
    },
    {
      "question": "Is placing a caption file next to the movie enough?",
      "answer": "Not necessarily. Use the receiving application's supported insertion or association process, then reopen and test the prepared presentation."
    }
  ],
  "productMedia": {
    "src": "/landing/full/founder-product.mp4",
    "poster": "/landing/full/founder-product.jpg",
    "alt": "A founder presenting alongside a VideoClaw product walkthrough",
    "caption": "An existing VideoClaw founder-led product demonstration.",
    "width": 1280,
    "height": 720
  },
  "editorialGraphic": {
    "src": "/media/blog/demo-subtitles-event-playback-delivery.svg",
    "alt": "Make Demo Subtitles Survive Event Playback: Trace the package; Match the player; Test activation; Freeze delivery.",
    "width": 1200,
    "height": 675
  },
  "cta": {
    "label": "Download the desktop app",
    "href": "/download"
  },
  "status": "review",
  "approvals": {
    "copy": false,
    "factual": false,
    "legal": false,
    "visual": false
  },
  "createdAt": "2026-09-12",
  "updatedAt": "2026-09-12",
  "searchMetrics": {
    "volume": "provider-pending",
    "keywordDifficulty": "provider-pending",
    "cpc": "provider-pending"
  }
}
---

Make demo subtitles survive event playback by delivering them in a form the receiving player supports, selecting the intended track and testing the actual slideshow from a fresh start. Captions visible in an editing preview are not proof of delivery. Keep a tested captioned fallback when the venue cannot reliably activate a separate track.

## Find where the subtitles disappeared

Trace the path from the approved edit to the event screen. The captions may exist only in the editing project, in a separate file, inside the movie or as text already rendered into the picture. Those are different delivery states.

Open the exact movie sent to the event, not the master in the editor. Check whether the player offers a caption track. Then inspect the copy inserted into the event deck. A working standalone movie does not establish that the presentation uses the same file or exposes the same controls.

Ask the operator which computer, application and presentation mode will be used. Record that setup with the caption language and the filename of the expected video. Avoid treating “PowerPoint” as a complete compatibility description when versions and platforms differ.

Keep this diagnosis separate from caption writing. The words may already be accurate and well timed; the immediate problem is whether the event playback path receives and displays them.

## Match the caption package to the player

[Microsoft documents inserting caption files into PowerPoint media](https://support.microsoft.com/en-us/PowerPoint/add-closed-captions-or-subtitles-to-media-in-powerpoint), with format support depending on the version. Check the instructions for the receiving installation. Do not assume that a newer SRT workflow works in every older copy of PowerPoint.

If the intended route uses a separate caption file, insert or associate it through the player's supported process. Merely placing a similarly named text file beside the movie does not establish that the presentation will load it. Preserve the original caption file so it can be reinserted if the media is replaced.

An embedded selectable track also needs player support. The word “embedded” should identify a real media track, not just an editor project containing captions. Inspect the delivered file and then verify the receiving application.

A burned-in copy renders the text into the video image. It avoids a separate track-selection step, but the viewer cannot turn that text off or choose a different language from it. Keep the clean master and editable caption source separately rather than replacing them with the fallback.

## Use a subtitle delivery matrix

The following original matrix compares packaging choices for one investor demo. It does not declare that every player supports all three routes.

| Delivery choice | What the operator receives | Default visibility | Language choice | Required receiving-computer check |
| --- | --- | --- | --- | --- |
| Supported embedded track | Movie containing a verified selectable caption track | Observe after opening; do not assume enabled | Available tracks, if the player exposes them | Select the intended track in slideshow and full-screen playback |
| Inserted sidecar captions | Exact movie plus caption file inserted through the supported workflow | Observe in the prepared deck | Tracks actually inserted and selectable | Reopen the deck and confirm the file is associated with the correct movie |
| Burned-in fallback | Separate movie with reviewed text rendered into the picture | Visible whenever that picture is displayed correctly | Fixed to that rendered copy | Check text size, crop, timing and absence of a second caption layer |

For a fictional demo, the event operator finds that the sidecar captions work in the preparation view but are not selected after reopening the slideshow. The team first tests an explicit track-selection step. If the event workflow cannot reliably perform it, they agree to use the checked burned-in copy for that presentation.

That is a delivery decision based on a specific test, not evidence that selectable captions are generally unreliable. The preferred route should preserve useful viewer controls when the receiving setup supports them.

## Activate the intended track in presentation mode

[Microsoft's playback guidance](https://support.microsoft.com/en-us/powerpoint/accessibility-features-in-video-and-audio-playback-on-powerpoint) describes an Audio and Subtitles control in Slide Show for supported tracks. Use the documented control for the actual platform, select the intended language and confirm the result on the audience display.

Do not confuse live presentation subtitles with the prerecorded video's reviewed captions. A control that transcribes the presenter's speech serves a different purpose. It should not be assumed to reproduce the exact caption file prepared for the product recording.

Test from the preceding slide or the operator's real start cue. Check the first spoken line, a meaningful product sound caption if included, and the final line. A successful check halfway through the movie can miss a caption that begins late or disappears at the end.

Enter and leave full-screen playback if that is part of the event sequence. Watch the audience output, not only the presenter's controls. Confirm that captions remain visible without covering the decisive product result or falling outside the displayed picture.

## Recheck after replacing or converting media

A late video correction can invalidate the caption association or timing. Give the revised movie and its matching caption file a clear shared revision reference. Do not pair new footage with the earlier sidecar because the words appear similar.

After replacing a movie in the deck, repeat the insertion and playback checks required by the application. Verify the caption track, language selection and timing rather than assuming the previous configuration carried over.

If the deck itself is exported as a movie, treat that output as a new delivery candidate. Open it independently and inspect whether the intended text actually appears. Do not infer that every presentation feature survives every export path.

For a burned-in copy, make sure a selectable caption track is not also turned on over the same text. Double captions can obscure the interface and make both layers difficult to read. The operator's instruction should name the chosen copy and intended caption state explicitly.

## Hand off a tested caption state

Send one clearly identified primary playback package with the movie, deck and caption source required for that route. Include the exact filename, language, tested application and the action needed to display captions. Label any fallback separately.

Ask the operator to confirm the audience-visible result, not simply receipt of the files. A useful note says: “English captions appeared from the opening line through the result in slideshow mode on the event computer.” Avoid a vague “subtitles included” label.

Keep a short failure route. If the approved selectable track cannot be activated during rehearsal, the operator should know which tested fallback to use and whether it requires a different launch action. Do not leave several untested captioned versions for an on-stage choice.

The completed work product is a delivery matrix and a confirmed playback state for one demo in one event setup. It preserves the reviewed subtitles through packaging and activation while leaving broader caption quality, translation and accessibility review as their own necessary tasks.

Continue with [caption quality and accessibility review](/blog/video-captions-accessibility) and [broader Demo Day preparation](/blog/demo-day-preparation-checklist).

[Download the desktop app](/download).
