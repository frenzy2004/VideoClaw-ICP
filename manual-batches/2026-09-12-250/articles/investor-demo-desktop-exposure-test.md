---
{
  "id": "vc-manual250-c2-044",
  "campaign": "accelerator-demo-day-founder",
  "icp": "US accelerator founder preparing founder video, product-demo media or investor presentation playback",
  "customerTrigger": "Live product demonstration risks exposing notifications, account switchers or unrelated browser windows",
  "funnelStage": "consideration",
  "primaryKeyword": "hide notifications when screen sharing",
  "secondaryKeywords": [
    "investor demo notification privacy",
    "screen sharing desktop exposure"
  ],
  "searchIntent": "informational",
  "competitorGap": "Hypothesis: Notification advice may omit the actual navigation path through autocomplete, account menus and file pickers outside the intended product evidence. Competing page bodies have not been audited for this draft.",
  "provenance": {
    "apifyRunId": "UZg3FufDQruZuQbdf",
    "apifyDatasetId": "cNxnl5rZUSNeVl2DE",
    "query": "hide notifications when screen sharing",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Keep Private Desktop Content Out of an Investor Demo",
  "description": "Rehearse an investor demo's notifications, autocomplete, account menus, file pickers and window switches from the recipient view before sharing live.",
  "slug": "investor-demo-desktop-exposure-test",
  "canonicalPath": "/blog/investor-demo-desktop-exposure-test",
  "sources": [
    {
      "label": "Zoom: Share a screen or desktop",
      "url": "https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060596",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "Apple: Set up a Focus on Mac",
      "url": "https://support.apple.com/en-lamr/guide/mac-help/mchl613dc43f/mac",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Is turning on Focus enough to hide every interruption?",
      "answer": "Do not assume so. Inspect allowed notifications and schedules, then test the actual picture and sound received during the demo."
    },
    {
      "question": "Does sharing one window prevent every kind of exposure?",
      "answer": "No. Test menus, additional windows and the separate audio path. The selected sharing surface must fit the demonstrated workflow."
    },
    {
      "question": "Should I test with real private messages or files?",
      "answer": "No. Use harmless rehearsal markers and authorized test accounts. Discover exposure behavior without deliberately distributing sensitive content."
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
    "src": "/media/blog/investor-demo-desktop-exposure-test.svg",
    "alt": "Follow a demo through typing, file selection, notifications and window changes while observing the recipient's picture and sound.",
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

Keep private desktop content out of an investor demo by rehearsing the exact navigation path, including notifications, menus and window changes. A clean starting screen is not enough. Test what the recipient can see and hear when you type, open a file, switch accounts or leave the product window.

## Trace the route the demonstration actually takes

Write the sequence of surfaces you expect to use: opening slide, product browser window, file picker, result panel and return slide. Include small transitions that are easy to omit from a rehearsal plan, such as typing into the address bar or opening a recent-file menu.

Separate product data from incidental desktop content. A fictional demo dataset can be appropriate while the browser profile still displays a personal account or an unrelated tab title. This article concerns those surrounding surfaces, not the anonymization of customer records inside a prerecorded clip.

Choose a demonstration account and workspace you are authorized to use. Prepare the necessary fictional files in a dedicated, understandable location. Do not reorganize or delete unrelated personal material merely to make a recording setup look tidy.

For a fictional document-import product, the risky moment might be selecting the sample document. The product page is clean, but the file picker opens a recent folder containing private filenames. That transition belongs in the rehearsal because it is part of the action the investor will see.

## Reduce the exposed surface before relying on settings

[Zoom’s screen-sharing documentation](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060596) distinguishes whole-screen and application-window sharing. Choose the narrowest available surface that supports the actual demonstration, then test its behavior when menus or additional windows open.

Close unrelated windows and tabs that are not needed for the task. If you use a separate browser profile for the demo, inspect its visible identity, saved suggestions and starting pages. “Separate” does not automatically mean free of private content.

Prepare the exact sample file and destination before sharing. Use a neutral filename that makes the workflow understandable without referencing a real customer. If the product requires a picker, rehearse that picker rather than replacing the interaction with an unexplained jump.

Keep the share boundary distinct from the audio boundary. A narrow picture does not necessarily imply narrow sound capture. If computer audio is enabled, listen for unrelated notifications, media or application sounds during the receiving-side test.

## Configure notification quieting with exceptions in mind

[Apple’s Focus guidance](https://support.apple.com/en-lamr/guide/mac-help/mchl613dc43f/mac) describes allowed notifications and scheduled behavior. Inspect the relevant exceptions rather than assuming a Focus icon means every possible interruption is suppressed.

Choose an appropriate quieting setup for the demonstration and verify that it remains active through application switches. Consider phone calls, calendar reminders and any permitted urgent notifications. Do not change important personal communication settings casually; make a deliberate temporary arrangement and remember to restore it afterward.

Run a harmless notification test using your own account or a cooperating colleague. Use neutral content such as “rehearsal notification,” not an actual confidential message. Observe both the founder screen and the recipient view.

Record whether the interruption was visible, audible, both or neither. An alert sound can reveal that another application is active even when its banner is hidden. If the product does not need computer audio, confirm that the selected sharing arrangement does not send unnecessary system sound.

## Complete an exposure rehearsal map

Use this original map to inspect each transition in the real route. Replace the example surfaces with those your product demonstration actually opens.

| Trigger | Possible incidental exposure | Containment action | Recipient-side observation |
| --- | --- | --- | --- |
| Notification arrives | Sender, preview or alert sound | Quiet appropriate apps and test exceptions | Record picture and sound |
| Address bar receives text | History or autocomplete suggestions | Use the prepared demo profile and route | Read visible suggestions |
| Account menu opens | Personal identity or other workspaces | Keep the intended demo identity selected | Inspect menu contents |
| File picker opens | Recent filenames and folder paths | Start in the prepared sample location | Inspect the whole picker |
| Window switch occurs | Unrelated titles or application content | Close unnecessary surfaces before sharing | Follow the actual switch |
| Product share ends | Desktop, notes or another browser window | Stop sharing at the planned boundary | Confirm the final received view |

The observation column is the work product. “Notification setting enabled” is a configuration note; “test banner absent and alert inaudible in recipient recording” is an observed result. Keep both when useful, but do not confuse them.

If a problematic surface cannot be contained within the planned live route, reconsider that segment. An approved prerecorded example or a different prepared interaction may be more appropriate than exposing private material while trying to troubleshoot in front of investors.

## Rehearse ordinary mistakes, not only the ideal path

Type an incomplete sample filename and see what suggestions appear. Open and close the intended menu. Switch to the wrong harmless test window and back. These small exercises reveal surfaces that a perfect memorized run may never expose.

Do not deliberately open actual secrets or sensitive records during the test. Use neutral rehearsal markers wherever possible. The goal is to discover exposure behavior without creating a new exposure incident.

Ask the recipient to describe what appeared, including short-lived overlays. If recording the rehearsal is appropriate, inspect the transitions afterward. A transient panel can disappear before a live observer finishes mentioning it.

When a test fails, stop the share, correct the setup and repeat the affected route from its beginning. Avoid fixing only the still frame where the exposure was noticed. The cause may be a preceding action, such as a profile switch that changed later autocomplete suggestions.

## Carry the tested route into the actual meeting

Keep a short setup note with the intended account, starting page, sample location, quieting state and selected share surface. This is a reconstruction aid for one demo, not an organization-wide device policy.

Before starting, confirm the initial recipient view and audio behavior. If the meeting software, display arrangement or product route changes, repeat the relevant checks. A tested configuration is tied to the conditions you actually observed.

End the share before opening private follow-up notes or returning to normal desktop work. Restore temporary notification settings afterward so the demonstration arrangement does not unintentionally persist into the rest of your day.

Use [private presenter-view planning](/blog/investor-demo-private-presenter-view) for the notes display and [fictional demo-data preparation](/blog/fictional-data-investor-demo-recording) for the product records themselves. Together with this exposure map, those choices let the investor follow the intended task without receiving unrelated desktop content. [Download the desktop app](/download).
