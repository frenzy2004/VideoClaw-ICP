---
{
  "id": "vc-manual250-c2-020",
  "campaign": "accelerator-demo-day-founder",
  "icp": "US accelerator founder preparing founder video, product-demo media or investor presentation playback",
  "customerTrigger": "Fine interface labels become unreadable when the demo is projected or shared remotely",
  "funnelStage": "consideration",
  "primaryKeyword": "screen recording text too small",
  "secondaryKeywords": [
    "product demo text too small",
    "readable investor screen recording"
  ],
  "searchIntent": "informational",
  "competitorGap": "Hypothesis: A critical-detail map ties framing and recipient tests to the precise screen evidence investors need to inspect. Competing page bodies have not been audited for this draft.",
  "provenance": {
    "apifyRunId": "UZg3FufDQruZuQbdf",
    "apifyDatasetId": "cNxnl5rZUSNeVl2DE",
    "query": "screen recording text too small",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Make Product Screens Readable in an Investor Demo",
  "description": "Make investor-demo screens legible with a critical-detail map, capture-first framing and real recipient playback tests for the action and result.",
  "slug": "investor-demo-screen-readability",
  "canonicalPath": "/blog/investor-demo-screen-readability",
  "sources": [
    {
      "label": "YC: how to design a better pitch deck",
      "url": "https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck/",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "Zoom: optimizing a shared video in full screen",
      "url": "https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068426",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Will exporting at a higher resolution fix tiny interface text?",
      "answer": "Not necessarily. The important detail must occupy enough of the delivered picture, and the source must contain readable detail. Reframe or recapture before relying on a larger export."
    },
    {
      "question": "Should I zoom in on every click?",
      "answer": "No. Plan close views around decisive actions and retain wider context when it connects the action to its result. Constant motion can make the sequence harder to follow."
    },
    {
      "question": "How do I test readability on a video call?",
      "answer": "Use the intended sharing path and ask a recipient to read the critical fields without prompting. Inspect the received image rather than relying on the presenter's local preview."
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
    "src": "/media/blog/investor-demo-screen-readability.svg",
    "alt": "Identify essential details, frame them in the source, test the recipient image and repair any unreadable step.",
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

Make an investor demo readable by identifying the few screen details that prove the action and result, then framing those details for the actual viewing size. Test the exported or shared image on a recipient device. A sharp full-desktop recording can still be useless when the important text occupies a tiny area.

## Identify the details that carry the proof

Watch your planned workflow and name the information a viewer must read. Usually it is not the whole interface. It may be an input value, an action label, a changed status, or the identifier connecting two screens.

Create a critical-detail list before recording. For a fictional dispatch demo, the list might contain the selected job, the new assignee, and the delivered status. The navigation sidebar and unrelated rows provide context but do not need equal visual emphasis.

[YC's presentation-design guidance](https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck/) stresses legibility and warns that interface screenshots can bury the point. Apply that concern to the actual evidence in your recording rather than replacing the product with a decorative mockup.

For each detail, ask what the investor must conclude from seeing it. “Read the new assignee” is concrete. “See the dashboard” is too broad to guide framing. Keep the list short enough that you can evaluate every item in the delivery test.

## Work backward from the viewer's picture size

Identify where the clip will appear: a video-call share, a window inside a deck, a laptop player, or an event screen. Do not assume that the investor will maximize it or move closer to inspect small text.

Estimate the available picture area and test that area directly. Put a draft in a player window resembling the intended delivery. If the key status cannot be read comfortably, the source needs different framing even if the recording resolution is high.

A simple fictional calculation illustrates the issue. If a 1,920-pixel-wide recording is displayed at 960 pixels wide, every captured detail occupies half as many display pixels across. A label that was only 20 pixels tall becomes roughly 10 pixels tall before other scaling effects. This is geometry, not a universal readability threshold.

Use the calculation to spot risk, then make an actual visual check. Viewing distance, contrast, font shape, motion, and the delivery system all affect the outcome. There is no single export resolution that guarantees an investor can read the important field.

## Change the capture before enlarging the finished movie

First, make the product's useful region larger during capture where the application supports it. Adjust window size, application zoom, or layout while confirming that the workflow still behaves normally. A narrower browser window may move a control into a menu, so rehearse after changing it.

Remove unrelated windows and unnecessary browser chrome from the capture area. Keep enough context to show which product and task the viewer is seeing. The goal is a focused view, not a crop so tight that a button click appears disconnected from its result.

Use a close view for a decisive action, then return to a wider view when relationships matter. Avoid constant zooming that makes the viewer chase the cursor. Plan the few framing changes around meaningful steps.

If the only available source is a wide recording with tiny text, test a crop but inspect the result honestly. Enlarging already indistinct pixels does not recreate lost detail. A fresh capture is often the cleaner solution when the key evidence was too small at the source.

## Build a critical-detail map for the sequence

Use a scene map to decide what stays readable and when. The following fictional example keeps the same task visible through three different screen states.

| Scene | Must-read detail | Framing decision | Playback test |
| --- | --- | --- | --- |
| Select the job | Fictional job label | Show the relevant list region | Viewer identifies the chosen row |
| Change assignment | New technician name and confirm action | Tighten around the assignment panel | Viewer names the selected assignee |
| Show receipt | Same job label and delivered status | Show the recipient result with context | Viewer connects result to the original job |
| Explain the boundary | Test-account label | Keep a readable label outside the action | Viewer knows this is demonstration data |

Add a proposed hold after each decisive state. Determine its duration by testing comprehension, not by applying a fixed number to every scene.

Do not rely on narration to rescue unreadable evidence. Naming a status aloud can guide attention, but the viewer should still be able to inspect the status if it is central to your claim.

## Test the delivery path, not just the local export

For a remote meeting, join from a second permitted device or ask a colleague to watch as a participant. Play or share through the actual route you will use. Compare the recipient image with the local source and note which details degrade.

[Zoom advises disabling video optimization when sharing nonvideo content](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068426), because static text and images can distort. Distinguish a live application share from playback of a movie, and test the settings appropriate to each.

Ask the recipient to read the critical details aloud without hints. If they cannot, change one variable at a time: capture framing, player size, sharing mode, or the amount of information on screen. That makes it easier to identify the actual cause.

For an event, inspect the actual screen from a realistic audience position when access is available. A screenshot of the projection does not replace standing where a viewer will sit. Keep unresolved venue conditions explicit rather than declaring the clip universally readable.

## Preserve context while making the final repair

When a field remains too small, first remove competing information. Then enlarge or recapture the relevant region. A large arrow pointing at illegible text does not make the text legible; it simply announces where the problem is.

Use a short explanatory label only when it adds meaning beyond the interface. Keep it outside the area that contains the action or result. If you restate a value, ensure it matches the actual product screen and is not mistaken for a live element.

Recheck every later scene after changing the framing. A crop that fixes the assignment panel may hide the recipient's result. Also inspect captions and any founder-camera overlay, since they consume the same finite picture area.

The finished work product is a critical-detail map plus a delivery-tested recording. Keep the map so a later edit does not shrink the proof while making room for branding. For the capture sequence, see [recording a product demo for a pitch](/blog/record-product-demo-for-pitch). To evaluate meaning beyond legibility, use [the investor-demo comprehension test](/blog/investor-demo-video-comprehension-test).

[Download the desktop app](/download).
