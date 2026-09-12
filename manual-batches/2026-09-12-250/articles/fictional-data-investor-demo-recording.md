---
{
  "id": "vc-manual250-c2-032",
  "campaign": "accelerator-demo-day-founder",
  "icp": "US accelerator founder preparing founder video, product-demo media or investor presentation playback",
  "customerTrigger": "A software demo needs plausible records without revealing real customer information",
  "funnelStage": "consideration",
  "primaryKeyword": "sample data for investor product demo",
  "secondaryKeywords": [
    "fictional product demo data",
    "sample investor demo dataset"
  ],
  "searchIntent": "commercial",
  "competitorGap": "Hypothesis: A relational filming-data recipe preserves cross-screen meaning while separating fictional props from customer evidence. Competing page bodies have not been audited for this draft.",
  "provenance": {
    "apifyRunId": "UZg3FufDQruZuQbdf",
    "apifyDatasetId": "cNxnl5rZUSNeVl2DE",
    "query": "sample data for investor product demo",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Build Fictional Data for an Investor Demo Recording",
  "description": "Create a small fictional dataset for an investor demo with consistent record relationships, safe test delivery and clear labels that avoid implied traction.",
  "slug": "fictional-data-investor-demo-recording",
  "canonicalPath": "/blog/fictional-data-investor-demo-recording",
  "sources": [
    {
      "label": "NIST SP 800-188: de-identification techniques and governance",
      "url": "https://csrc.nist.gov/pubs/sp/800/188/final",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "IANA: example domains",
      "url": "https://www.iana.org/help/example-domains",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Is changing customer names enough to create fictional data?",
      "answer": "No. Copied records can retain identifying or confidential context. For a fictional filming scenario, build from the workflow requirements rather than assuming renamed production data is safe."
    },
    {
      "question": "Can I use example.org in a demo?",
      "answer": "IANA reserves example domains for illustrative documentation. Do not rely on them as functioning application services or as a substitute for controlling outbound actions."
    },
    {
      "question": "Should I fill the dashboard with invented customers?",
      "answer": "Only include data needed to explain the task, and label it clearly as fictional. Do not present populated demo screens as evidence of real customers or traction."
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
    "src": "/media/blog/fictional-data-investor-demo-recording.svg",
    "alt": "One task determines a small set of related records, which are tested safely and labeled as demonstration data.",
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

Build fictional demo data around the one product task investors need to inspect, with consistent relationships between people, records, and results. Keep it visibly separate from production and prevent unintended outbound actions. The dataset should make the workflow understandable without implying real customers, traction, or a privacy guarantee it cannot support.

## Start with the action, not a random-data generator

Choose the task you will record and list the minimum records it needs. A dispatch demonstration may need one customer, one job, two technicians, and an assignment. It does not need hundreds of invented customers just to make a dashboard look busy.

Identify the relationships the viewer must follow. The job should belong to the same fictional customer throughout the clip. The assigned technician should match the recipient screen. A result record should refer back to the input that created it.

Write down which fields carry meaning. A status, date, or selected option may be essential. A long address or elaborate company biography may only add reading work. Use realistic structure without filling the screen with unnecessary detail.

Decide which conditions the example should include: a normal starting state, the action to demonstrate, and the resulting state. Keep unrelated edge cases in a different dataset rather than making one short investor clip explain every possibility.

## Construct a small relational recipe

Use a recipe that can be recreated after the demo changes state. The following example is fictional and designed only to illustrate a scheduling workflow.

| Record | Fictional value | Relationship | Purpose in the recording |
| --- | --- | --- | --- |
| Customer | Example Workshop | Owns job J-17 | Gives the task a recognizable context |
| Job | J-17, equipment inspection | Initially unassigned | Provides the input to the action |
| Technician A | Demo Technician A | Available for assignment | Shows one selectable option |
| Technician B | Demo Technician B | Receives the assignment | Connects action to recipient result |
| Status | Unassigned, then assigned | Changes on job J-17 | Makes the outcome inspectable |
| Contact display | contact@example.org | Display-only fictional address | Avoids using a real person's address |

Use the same identifiers across desktop, phone, captions, and any explanatory graphic. A mismatch can make the demonstration look as if it switched scenarios midstream.

Keep the recipe small enough that someone can inspect it by eye. Randomized data can be useful for testing, but a filmed example benefits from recognizable continuity. Do not confuse the two jobs.

## Use reserved examples without relying on them as services

[IANA reserves example domains for documentation](https://www.iana.org/help/example-domains) and says their web services are not intended as production dependencies. They are useful for clearly illustrative text, not as working endpoints for your demo.

Do not assume a fictional-looking email address prevents an outbound message. Configure the demonstration environment's supported test delivery or disable the outbound action through an approved method. The safety comes from the environment, not from hoping the address will fail.

Similarly, do not invent a phone number or physical address and assume nobody uses it. Prefer clearly labeled display values where the field permits them, or use your product team's approved test fixtures.

If the product requires a functioning integration, use an authorized test account or sandbox appropriate to that service. Keep its operational details separate from the visible fictional story. Do not put tokens, session material, or private account information in the dataset recipe or recording.

## Distinguish invented records from transformed customer data

A hand-authored fictional scenario is different from a copy of production data with names changed. The latter may retain identifying combinations, confidential content, or distinctive patterns.

[NIST's de-identification guidance](https://csrc.nist.gov/pubs/sp/800/188/final) treats disclosure risk as more than removal of direct identifiers. Do not call a dataset anonymous simply because a generator or masking tool produced it.

For this media task, start from the workflow requirements where practical rather than importing customer records. If you need a realistic document, write a short fictional one with the fields required to demonstrate the action. Do not paste an actual customer's text and merely replace its heading.

When production-derived material is genuinely necessary, use your organization's approved process and appropriate expertise. This article's recipe is an editorial aid, not a de-identification standard or a legal determination.

Label the visible dataset as fictional or demonstration data. The label should be readable but need not interrupt every scene. It tells the investor how to interpret the evidence without making the entire video about privacy preparation.

## Validate the scenario in the actual product

Load the recipe into the dedicated demo environment through the supported method. Check that the records appear as intended and that the relationships are valid. A dataset that looks coherent in a spreadsheet may violate application rules or trigger a different UI state.

Run the task once and inspect the result. Confirm that the same job, recipient, and status appear across views. Check for unexpected emails, notifications, billing actions, or external changes in the permitted test setup.

Then restore the starting state and leave it ready for capture. Do not film from the already-completed result unless the sequence clearly identifies it as a preview. The viewer needs to see what the product changed.

Review incidental surfaces too. Search suggestions, recent records, account menus, and notifications may still expose unrelated real data even if the selected job is fictional. A dedicated dataset does not automatically clean the whole recording environment.

## Make the evidence useful without implying traction

Use the fictional records to demonstrate behavior, not to create the appearance of customer adoption. A list of invented company names is not a customer list, and a populated chart is not evidence of business performance.

If a summary screen appears, make its fictional nature clear and avoid narrating its values as company metrics. Crop or omit irrelevant dashboard totals when they distract from the actual product action.

Keep the recipe with the source recording and record which version produced the clip. When a product change adds a required field, update the recipe coherently rather than patching a value only on one screen. Recheck the resulting relationship after each meaningful revision.

The finished dataset should let a viewer understand one complete task with minimal explanation: this fictional record entered the workflow, this action occurred, and this related result appeared. It is a set of filming props with consistent logic, not a substitute for customer evidence.

For restoring the scene between runs, see [resetting an investor-demo account](/blog/reset-investor-demo-account-state). If you must work with existing real footage, use [the customer-footage exposure procedure](/blog/anonymize-customer-footage-investor-demo).

[Download the desktop app](/download).
