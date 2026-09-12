---
{
  "id": "vc-manual250-c2-037",
  "campaign": "accelerator-demo-day-founder",
  "icp": "US accelerator founder preparing founder video, product-demo media or investor presentation playback",
  "customerTrigger": "A prospective investor needs subtitles in another language for an existing demo",
  "funnelStage": "consideration",
  "primaryKeyword": "demo website with screen reader",
  "secondaryKeywords": [
    "screen reader investor demo",
    "keyboard product demo recording"
  ],
  "searchIntent": "commercial",
  "competitorGap": "Hypothesis: Screen-reader guidance may omit an investor-facing capture script that distinguishes expected announcements from the actual product output. Competing page bodies have not been audited for this draft.",
  "provenance": {
    "apifyRunId": "UZg3FufDQruZuQbdf",
    "apifyDatasetId": "cNxnl5rZUSNeVl2DE",
    "query": "demo website with screen reader",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Demonstrate a Product With a Screen Reader",
  "description": "Record a screen-reader product demo with real keyboard actions, focus movement and announcements, then state exactly what the investor can verify.",
  "slug": "investor-demo-product-screen-reader",
  "canonicalPath": "/blog/investor-demo-product-screen-reader",
  "sources": [
    {
      "label": "Apple: Navigate webpages with VoiceOver",
      "url": "https://support.apple.com/guide/voiceover/by-dom-or-group-mode-vo2711/mac",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "W3C WAI: Easy Checks",
      "url": "https://www.w3.org/WAI/test-evaluate/preliminary/",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Does one successful screen-reader demo prove accessibility?",
      "answer": "No. It demonstrates the recorded task in its stated environment. Broader evaluation is needed for broader conclusions."
    },
    {
      "question": "Should the founder speak over the screen reader?",
      "answer": "Leave the actual announcements audible. Introduce the task before the interaction or explain it after the announcement finishes."
    },
    {
      "question": "What if the operator needs a mouse or another person's help?",
      "answer": "Keep the intervention visible or audible and describe it. Do not present assisted completion as an independent keyboard-only result."
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
    "src": "/media/blog/investor-demo-product-screen-reader.svg",
    "alt": "Match the recorded keyboard action to actual focus movement, announcement and final task result.",
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

A screen-reader product demo should let an investor hear the interface, follow keyboard actions and understand whether the task actually completed. Record a bounded interaction in a named environment. Preserve the assistive technology’s real output, separate it from your explanation, and avoid presenting one successful recording as proof of overall accessibility.

## Choose a task that can succeed or fail visibly

Start with a user outcome rather than a tour of accessibility settings. For a fictional document service, the task might be: open a draft, change its title and confirm that the saved document has the new name. That gives the viewer a beginning, an action and an inspectable result.

Select a task that matters to the product you are demonstrating. Do not choose an irrelevant control simply because it produces a pleasing announcement. If the value proposition includes completing work without sight, show the work rather than merely switching a screen reader on.

Write the completion criterion before rehearsing. “The renamed document appears in the document list and its name is announced” is testable within the recording. “The application is accessible” is a much broader statement that this clip cannot establish.

Identify any excluded steps, such as authentication already completed before capture. Show a truthful starting card if the account is preconfigured. The viewer should understand where the demonstration begins and which parts of the workflow remain outside its scope.

## Name the assistive-technology environment

Record the operating system, browser, product build, screen reader and relevant navigation settings in your private capture notes. Show a concise version in the video introduction or accompanying description. A reproducible example needs more than “tested with a screen reader.”

Navigation behavior depends on the selected mode. [Apple documents DOM-order and grouped-item navigation in VoiceOver](https://support.apple.com/guide/voiceover/by-dom-or-group-mode-vo2711/mac). If you use VoiceOver, establish the chosen mode before rehearsal and keep it consistent through the recorded task.

Do not invent universal keyboard instructions for every assistive technology. Put the actual commands used in your environment into the capture script. Have a competent operator perform the interaction, and explain any customized command that would otherwise confuse someone reviewing the take.

Keep the claim appropriately narrow. [W3C’s preliminary accessibility checks](https://www.w3.org/WAI/test-evaluate/preliminary/) explicitly distinguish limited checks from comprehensive evaluation. A founder’s task recording is useful product evidence, but it is not an accessibility certification or a substitute for broader evaluation with relevant users.

## Build a focus-and-announcement script

Use this original script to plan the capture. Fill the expected announcement with what the interface should communicate, then record the actual output separately. Do not silently edit the expected column to match whatever happened during the take.

| Task moment | Starting focus | Keyboard action to record | Expected information | Actual result |
| --- | --- | --- | --- | --- |
| Find document | Document-list region | Operator's navigation command | Draft name and control role | Transcribe observed output |
| Open draft | Selected document | Actual activation command | Editor context | Record focus destination |
| Rename | Title control | Edit and enter the new title | New value identifiable | Record spoken text and screen |
| Save | Relevant action control | Actual save command | Completion or saved state | Record announcement, if any |
| Confirm | Document list after return | Navigate to changed item | New document title | Record observed final state |

The command column should contain the keys actually used, not a generic word such as “click.” If the operator touches the mouse, retain that action and explain why. A mouse-assisted completion is different evidence from a keyboard-only completion.

Add a place for unexpected focus movement, repeated navigation and missing announcements. These observations can reveal why a task feels confusing even when the final screen looks correct. Keep them in the source take instead of trimming directly from a control to a successful result.

## Capture the screen reader as product evidence

Record a short technical sample before the full task. Play it back through the delivery path and confirm that the assistive technology’s speech is audible, not only the founder’s microphone. A visible moving focus indicator cannot replace missing announcements.

Establish who is speaking. Begin with a brief founder introduction, then leave space for the screen reader. Avoid narrating over each announcement; that forces the investor to choose between your explanation and the interface’s actual output.

If explanation is necessary, pause before the action or after the announcement finishes. Say what the user is trying to accomplish, then let the interaction provide the evidence. Do not overdub an expected announcement onto a take where the product did not produce it.

Capture a continuous task sequence with enough surrounding context to show focus changes. A close view can make the relevant control clearer, but a crop should not hide where focus unexpectedly moved. Keep the original capture so a reviewer can inspect an ambiguous moment without relying on the edited framing.

## Show problems without turning the clip into a diagnosis

If the screen reader announces an unnamed control, record the actual output and what the operator does next. Do not immediately claim a root cause from the recording alone. The clip establishes observed behavior; investigating markup, application state or compatibility is a separate engineering task.

If the operator needs help, distinguish that assistance from the product interaction. A colleague saying where to navigate changes the evidence. Keep the intervention audible or label it in the presentation cut, and avoid calling the resulting take independent task completion.

Repeat the task after a correction when appropriate, but preserve the earlier observation privately. Label the new build and date. An investor can then understand what changed without mistaking a corrected recording for the original result.

Use a second permitted reviewer to compare the final clip with the script. Ask them to identify the starting focus, decisive command, actual announcement and completion evidence. If any element requires an off-camera explanation, repair the presentation or narrow the conclusion.

## Deliver a bounded demonstration and its result note

Finish with a result statement tied to the recorded task: “In this environment, the operator renamed the draft using the recorded keyboard sequence, and the updated name was announced in the list.” Use your actual observations rather than the fictional example’s outcome.

State relevant limitations plainly. Perhaps a save confirmation was visible but not announced, or the operator needed an extra navigation step. Those details help the investor interpret the product’s current behavior without inflating a successful ending into a universal claim.

Keep any transcript faithful to the distinction between founder speech and assistive-technology output. Check technical terms and control names manually. Accessibility of the delivered video also deserves attention, but it is a separate question from whether the product interaction shown in the video worked.

For the audio path, use [remote demo computer-audio testing](/blog/remote-investor-demo-computer-audio). For the picture, apply [screen-readability checks](/blog/investor-demo-screen-readability) without obscuring focus movement. Deliver the task script, observed result and exact recording together. [Download the desktop app](/download).
