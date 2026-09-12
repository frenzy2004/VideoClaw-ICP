---
{
  "id": "vc-manual250-c5-020",
  "campaign": "portfolio-media-platform",
  "icp": "US accelerator or VC platform lead coordinating content across portfolio companies",
  "customerTrigger": "Staff can find files by company folder but cannot find approved examples across companies, audiences or use cases.",
  "funnelStage": "consideration",
  "primaryKeyword": "digital asset management taxonomy",
  "secondaryKeywords": [
    "DAM taxonomy best practices",
    "digital asset tagging"
  ],
  "searchIntent": "commercial",
  "competitorGap": "Editorial opportunity hypothesis: Build a controlled vocabulary for cross-portfolio asset retrieval while preserving company identity. Unlike retained c5-009, the task is classification and search, not visual consistency. Competing page bodies and exact-query SERPs have not been assessed for this draft.",
  "provenance": {
    "apifyRunId": "8SjJ2NKr2HlOOh8Cv",
    "apifyDatasetId": "lKgIzTUjGuJjzIubf",
    "query": "digital asset management taxonomy",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Design Tags for a Multi-Company Media Library",
  "description": "Build a multi-company media taxonomy with a compact tag dictionary, clear field definitions and six retrieval tests based on how people actually search.",
  "slug": "portfolio-media-library-tag-taxonomy",
  "canonicalPath": "/blog/portfolio-media-library-tag-taxonomy",
  "sources": [
    {
      "label": "Bynder: Taxonomy tips",
      "url": "https://support.bynder.com/hc/en-us/articles/20331272932626-Taxonomy-Tips-for-your-DAM",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "Adobe: Tagging and taxonomy",
      "url": "https://experienceleague.adobe.com/en/docs/experience-manager-learn/assets/metadata/tagging-and-taxonomy",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Should company names be part of every tag?",
      "answer": "Keep company identity in a dedicated field and combine it with type, subject and status during search. A stable company identifier helps preserve history when the public name changes."
    },
    {
      "question": "How should synonyms be handled?",
      "answer": "Choose a preferred value and map familiar search terms to it where the system allows. Avoid creating several nearly identical preferred labels that fragment otherwise related assets."
    },
    {
      "question": "When should a new metadata field be added?",
      "answer": "Add it when repeated retrieval tasks need a distinction that existing fields cannot express reliably. Consider whether contributors can supply and maintain the information before making it required."
    }
  ],
  "productMedia": {
    "src": "/landing/full/screen-record-demo.mp4",
    "poster": "/landing/full/screen-record-demo.jpg",
    "alt": "An existing VideoClaw screen-recording demonstration",
    "caption": "An existing VideoClaw screen-recording demonstration.",
    "width": 1280,
    "height": 720
  },
  "editorialGraphic": {
    "src": "/media/blog/portfolio-media-library-tag-taxonomy.svg",
    "alt": "Eight populated media records and six retrieval tests, showing expected asset IDs, excluded near-matches and a current-release reference.",
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

A multi-company media taxonomy should let people find the right asset without knowing its filename or the person who uploaded it. Start with real retrieval questions, then define a small set of required fields and controlled labels. Keep company identity, asset type, subject and approved-use context separate so useful combinations remain searchable.

## Start with questions people actually ask

Collect examples from the people who retrieve media: platform editors, company marketers, program coordinators and reviewers. Ask them to describe the last asset they needed and the words they used to find it. A query such as “Alder's approved founder headshot” reveals more than asking whether the current folder structure is good.

[Bynder's taxonomy guidance](https://support.bynder.com/hc/en-us/articles/20331272932626-Taxonomy-Tips-for-your-DAM) recommends examining user search terms and failed searches. Use that evidence to identify which distinctions matter in your library. A taxonomy designed only around the coordinator's mental model may be difficult for everyone else to use.

Separate retrieval needs from reporting wishes. Add internal categories only when a real task requires them. Keep users' original wording as test cases and potential search synonyms.

## Give each field one job

Use company identity to say whose asset it is, asset type to say what it is and subject to say what it is about. Do not combine those ideas into a label such as “Alder-founder-social-approved.” Combined labels become difficult to maintain as the company name, channel or approval state changes.

Separate factual ownership from intended audience. An asset can belong to one company while being relevant to another company's learning task. Access and permitted reuse still need their own controls; a useful tag does not authorize sharing.

[Adobe's tagging documentation](https://experienceleague.adobe.com/en/docs/experience-manager-learn/assets/metadata/tagging-and-taxonomy) describes tags as a way to find related assets without knowing an exact filename. The practical consequence is that labels should describe distinctions a searcher can recognize, not simply reproduce the folder path.

Use a controlled list for fields that need consistency, such as asset type. Allow short free text where nuance matters, such as a scene description. A field does not become more reliable merely because it is a dropdown; the available choices must actually fit the content.

## Draft a compact tag dictionary

The following dictionary is an original example for a small portfolio media library.

| Field | Required? | Example values | Rule |
| --- | --- | --- | --- |
| Company ID | Yes | ALD-01, BCN-02 | Use a stable identifier |
| Asset type | Yes | Portrait, interview, product capture, event photo | Describe the asset itself |
| Subject | Yes | Onboarding; Lena Ortiz, founder | Use a topic or verified named subject |
| Release state | Yes | Working, company-approved, archived | Maintain through the release process |
| Intended audience | When known | Prospective customer, new hire, portfolio operator | Do not infer from format alone |
| Language | For spoken or written content | English, Spanish | Describe the actual version |
| Related asset | When applicable | Source recording or released parent | Preserve the relationship |
| Current release reference | For a versioned asset family | P1 | Copy the identifier from the existing release record |
| Description | Yes | Short account of what is visible or discussed | Use plain language |

Define what each value excludes. “Product capture” should not silently include a founder talking about the product if the visual distinction matters to retrieval. “Company-approved” should identify a recorded release state, not a general belief that the file looks finished.

Add synonyms for search without creating duplicate preferred labels. People may search for “headshot” while the controlled type is “portrait.” The dictionary can map the familiar term to the preferred value instead of forcing users to learn unfamiliar wording.

## Test six retrieval tasks

Use these filled fictional records. ALD means company ID ALD-01; BCN means BCN-02. “Approved” abbreviates the dictionary's company-approved Release state. A dash means not applicable, not unknown approval. Each Subject entry also supplies the short Description here.

| ID | Company | Asset type | Subject / Description | Release state | Intended audience | Language | Related asset | Current release reference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | ALD | Portrait | Lena Ortiz, founder | Approved | Press | — | — | P1 |
| P0 | ALD | Portrait | Lena Ortiz, founder | Archived | Press | — | P1 | P1 |
| P2 | ALD | Portrait | Omar Vale, engineer | Approved | Press | — | — | P2 |
| I1 | BCN | Interview | Onboarding | Approved | Portfolio operator | English | — | I1 |
| I2 | BCN | Interview | Onboarding | Approved | Portfolio operator | Spanish | I1 | I2 |
| S1 | BCN | Product capture | Account setup screen | Approved | Prospective customer | English | — | S1 |
| N1 | ALD | Interview | Team induction | Approved | New hire | English | — | N1 |
| E1 | BCN | Excerpt | Onboarding | Working | Portfolio operator | English | I1 | — |

The existing release record identifies P1 as current for Lena's portrait family. Taxonomy copies that reference; it does not grant release authority or decide which version should win.

| Retrieval question | Exact field/value test | Expected IDs | Excluded near-match |
| --- | --- | --- | --- |
| Find Alder founder Lena Ortiz's current headshot | Company=ALD; type=Portrait; Subject=Lena Ortiz, founder; Release state=Approved; ID=Current release reference | P1 | P0 is archived; P2 depicts an engineer |
| Find an English onboarding interview | Type=Interview; Subject=Onboarding; Language=English | I1 | I2 is Spanish; E1 is an excerpt |
| Find Beacon's product screen recording | Company=BCN; type=Product capture | S1 | I1 is an interview |
| Find approved media intended for new hires | Intended audience=New hire; Release state=Approved | N1 | I1 targets portfolio operators |
| Find E1's source | Read E1.Related asset=I1; retrieve ID=I1 | I1 | I2 is related to I1 but is not E1's recorded source |
| Find Alder's archived portrait for history | Company=ALD; type=Portrait; Release state=Archived | P0 | P1 is the active approved portrait |

Have another person replay these tests. Record unexpected matches, missing records and ambiguous field definitions. These are hand-worked expected results, not a claim that a search product has executed them. Expand the dictionary only when the retrieval job needs a distinction the existing fields cannot express.

## Handle exceptions without multiplying labels

Some assets contain multiple companies or subjects. Define whether the relevant field permits multiple values and what each value means. For an event photograph, listed companies might be featured subjects rather than every company whose employee appears in the background.

For ambiguous assets, allow a temporary review state. The uploader should not have to invent a category to complete ingestion. Give the coordinator enough description to classify it later and keep the uncertainty visible.

Decide who may add a preferred label. If every uploader can create near-duplicates, the dictionary will fragment into “customer onboarding,” “onboarding customers” and “new user setup” without an intentional relationship. A short proposal route is enough; it need not become a large committee.

When a label changes, preserve a mapping from the old term to the new one where your system supports it. Otherwise, provide a migration record and test affected searches. Renaming a field without updating stored values and saved filters can break retrieval even when the new terminology is better.

Keep company renames separate from company IDs so rebranding does not divide one company's history into disconnected groups.

## Maintain the vocabulary through use

Review the dictionary when a new asset type arrives, a repeated search fails or people create informal workarounds. These are signals that the taxonomy may no longer reflect the work. They are more informative than a general request to “clean up tags.”

Inspect a few newly uploaded assets for consistency. Ask whether another person could apply the same values from the available information. If not, clarify the definition or improve the intake description. Do not rely on repeated manual correction forever.

Keep the dictionary near the upload and search experience. A short example beside a field can be more useful than a long guide stored elsewhere. Explain why required fields matter using the retrieval tasks they enable.

Success means people can find an identifiable asset and understand its context, not that every file has the largest possible number of tags.

Continue with [setting portfolio media guidelines](/blog/portfolio-video-brand-guidelines) and [organizing a repurposing workflow](/blog/video-content-repurposing-workflow).

[Download the desktop app](/download).
