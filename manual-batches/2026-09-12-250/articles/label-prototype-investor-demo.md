---
{
  "id": "vc-manual250-c2-033",
  "campaign": "accelerator-demo-day-founder",
  "icp": "US accelerator founder preparing founder video, product-demo media or investor presentation playback",
  "customerTrigger": "An investor demo mixes working features, clickable mockups and simulated outputs",
  "funnelStage": "consideration",
  "primaryKeyword": "label prototype in investor demo video",
  "secondaryKeywords": [
    "prototype demo labels",
    "working vs simulated investor video"
  ],
  "searchIntent": "informational",
  "competitorGap": "Hypothesis: A scene status map identifies mixed implementation boundaries without relying on one vague prototype disclaimer. Competing page bodies have not been audited for this draft.",
  "provenance": {
    "apifyRunId": "UZg3FufDQruZuQbdf",
    "apifyDatasetId": "cNxnl5rZUSNeVl2DE",
    "query": "label prototype in investor demo video",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Label What Works in a Prototype Investor Demo",
  "description": "Label mixed prototype footage precisely with a scene status map that separates working builds, interactive designs, simulated responses and illustrations.",
  "slug": "label-prototype-investor-demo",
  "canonicalPath": "/blog/label-prototype-investor-demo",
  "sources": [
    {
      "label": "Figma: guide to prototyping",
      "url": "https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "a16z: from demos to deals in enterprise AI",
      "url": "https://a16z.com/insights-for-enterprise-ai-builders/",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Is a single prototype label at the start enough?",
      "answer": "Not when the clip mixes implemented behavior, design previews and simulations. Label the meaningful transitions so isolated scenes remain understandable."
    },
    {
      "question": "Does a clickable prototype prove the backend works?",
      "answer": "No. Interactive design can preview a flow without executing the corresponding product operation. Show actual implementation evidence separately."
    },
    {
      "question": "Should I use coming soon as the label?",
      "answer": "It does not identify what the current footage represents. State whether the scene is working, design-only, simulated or illustrative; discuss future plans separately."
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
    "src": "/media/blog/label-prototype-investor-demo.svg",
    "alt": "A scene map separates working capture, interactive design, simulation and illustration before the final video is assembled.",
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

Label a prototype investor demo according to what each scene actually represents: working product behavior, an interactive design, a simulated response, or an illustration. Place the label where that distinction matters and keep it readable in playback. A single “prototype” note at the beginning may not explain a mixed sequence.

## Classify the evidence before editing the video

List the scenes you intend to show and ask what is actually running in each one. A clickable design, a local application connected to a test backend, and a static result image can look equally polished on screen while establishing different things.

Use plain descriptions rather than a vague maturity score. “Interactive design; submission not connected” tells the viewer more than “version 0.8.” “Working test build with fictional data” identifies a different boundary.

[Figma describes prototypes as interactive flows for exploring designs](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma). A smooth transition between prototype screens therefore does not, by itself, show that the corresponding backend operation occurred.

Confirm each classification with the person responsible for that component. Do not infer implementation from the presence of a button or from a screen that resembles the current product. The label should describe the evidence you captured, not the team's intended next milestone.

## Use a small vocabulary with explicit meaning

Choose a few terms and define them for this recording. For example, “working test build” can identify actual implemented behavior in a test environment. “Interactive design” can identify a clickable interface preview. “Simulated response” can identify output supplied for demonstration rather than generated by the shown operation.

Avoid using “live” as a synonym for “working.” A prerecorded capture of an implemented product is still recorded media. Conversely, interacting with a design prototype live does not make its backend implemented.

Use “illustration” for an explanatory diagram or animation. It can help an investor understand the intended mechanism, but it should not resemble a captured diagnostic view without a clear distinction.

Do not imply that a “working” label establishes production readiness. [a16z's enterprise-AI guidance](https://a16z.com/insights-for-enterprise-ai-builders/) distinguishes compelling demos from the harder work of robust products. Keep environment, input, and implementation scope separate from visual polish.

## Build a scene status map

Create a map before adding labels. The following fictional example combines an implemented upload with a design-only review screen:

| Scene | What actually happens | Viewer-facing label | What it does not establish |
| --- | --- | --- | --- |
| File upload | Test backend accepts a fictional document | Working test build | Production deployment or broad file support |
| Review layout | Clickable design previews the next interaction | Interactive design | Implemented review logic |
| Suggested result | Prepared response is displayed | Simulated response | Output generated from this run |
| Final explanation | Diagram shows intended system stages | Illustration | Live processing or measured timing |

The map should not turn every frame into a disclaimer. It identifies the moments where the nature of the evidence changes and where a label prevents a wrong inference.

If a single scene contains both working and simulated components, name the boundary directly. “Upload works; analysis response simulated” is more useful than assigning one broad label to the whole screen.

## Attach labels to the transitions that change meaning

Place a readable label before or as the sequence enters a different evidence type. Keep it visible long enough to be understood at the intended playback size. If the scene is likely to be replayed alone, its status should remain understandable without the opening introduction.

Use a consistent location outside the product action. Do not cover the button, result, or caption region with the label. Test the composition in the actual player or shared view.

Let narration reinforce the distinction naturally. A founder can say, “The upload you just saw is working; this next screen is the interaction design for review.” That is clearer than a long warning detached from the scene.

Avoid labels that use optimistic shorthand. “Coming soon” describes an intention and does not tell the viewer whether the current footage is working, simulated, or illustrative. A target date may belong elsewhere, but it does not replace the evidence label.

When the video returns to a working capture, identify the transition back. Otherwise the viewer may assume that all later footage remains simulated or that the earlier design-only section was also implemented.

## Preserve continuity without creating a false operation

A mixed prototype can be useful when the transitions are explicit. Show the working input, explain where implementation stops, and then present the design or simulation as the next concept. Do not splice those scenes into a seamless action-to-result sequence that implies a completed operation.

If the simulated result is not derived from the captured input, say so. Use fictional data consistently so the visual story remains understandable, but do not let matching identifiers substitute for a genuine processing connection.

Keep the source captures and the status map together. If an editor replaces a design screen with a newer working build, update the label only after verifying what the new capture actually does. Removing a label because the footage looks more polished is not a valid update.

Ask a reviewer to identify which parts they believe are implemented after watching the cut. If they misclassify a material component, adjust the transition or wording rather than assuming the opening “prototype” note was enough.

## Deliver a current, bounded description of the prototype

Date the recording or identify the relevant build so the viewer can place it in context. The date helps distinguish versions; it does not promise availability or a release schedule.

Keep the description and thumbnail consistent with the scene labels. Do not call the whole clip an “end-to-end working demo” when a central result is simulated. A precise title can still be useful and engaging without overstating the implementation.

If the investor asks to interact with a part that is not built, explain the current boundary and show the relevant working portion. The video should have prepared that conversation, not made the limitation a surprise.

The finished artifact is a scene status map and a clearly labeled recording that separates implemented behavior from designed experience. For showing real behavior behind a nonvisual product, see [invisible product work in an investor demo](/blog/invisible-product-work-investor-demo). For correcting an existing misleading cut, use [the investor-video correction procedure](/blog/correct-investor-video-visible-claims).

[Download the desktop app](/download).
