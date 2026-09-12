---
{
  "id": "vc-manual250-c5-017",
  "campaign": "portfolio-media-platform",
  "icp": "US accelerator or VC platform lead coordinating content across portfolio companies",
  "customerTrigger": "A shared folder is convenient for staff but exposes one company's working media to unrelated portfolio users.",
  "funnelStage": "decision",
  "primaryKeyword": "digital asset management permissions",
  "secondaryKeywords": [
    "digital asset access control",
    "shared media library permissions"
  ],
  "searchIntent": "informational",
  "competitorGap": "Editorial opportunity hypothesis: Design and verify company-specific access boundaries in a shared library. This is information separation across independent companies, not a production handoff checklist or visual brand guideline. Competing page bodies and exact-query SERPs have not been assessed for this draft.",
  "provenance": {
    "apifyRunId": "8SjJ2NKr2HlOOh8Cv",
    "apifyDatasetId": "lKgIzTUjGuJjzIubf",
    "query": "digital asset management permissions",
    "locale": "en-US",
    "capturedAt": "2026-09-12"
  },
  "title": "Separate Company Access in a Shared Portfolio Media Library",
  "description": "Separate company media with a role-by-space access table and practical tests for inherited permissions, direct links and shared portfolio resources.",
  "slug": "separate-company-access-media-library",
  "canonicalPath": "/blog/separate-company-access-media-library",
  "sources": [
    {
      "label": "Google: Shared-drive file access",
      "url": "https://support.google.com/a/users/answer/12380484?hl=en",
      "checkedAt": "2026-09-12"
    },
    {
      "label": "Bynder: Digital asset management practices",
      "url": "https://support.bynder.com/hc/en-us/articles/360013931739-Best-Practices-for-Digital-Asset-Management",
      "checkedAt": "2026-09-12"
    }
  ],
  "faqs": [
    {
      "question": "Is a separate company folder enough to protect working files?",
      "answer": "No. The folder must have the intended access behavior. Test memberships, direct links, search visibility and sharing actions rather than relying on the name or location of the folder."
    },
    {
      "question": "Should all final assets be visible to the whole portfolio?",
      "answer": "Only when the intended use allows that sharing. A company release can remain company-specific; approval for one publication does not establish permission for another company to reuse the asset."
    },
    {
      "question": "How should temporary reviewer access end?",
      "answer": "Tie it to a defined event such as review completion or project closure, then verify the relevant access routes. The exact removal behavior depends on how the system granted access."
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
    "src": "/media/blog/separate-company-access-media-library.svg",
    "alt": "Role-by-space access matrix for shared resources and separate company libraries, checked with allowed, denied and direct-link sample tests.",
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

Separate portfolio media access by company, asset status and user role, then test what each person can actually see. Keep shared learning resources apart from company working material. A folder name is not an access boundary: inherited membership, direct file grants and public links can expose material beyond the people a coordinator intended.

## Define the spaces before granting access

List the different purposes your media library serves. A company may need to submit working files, review a draft, retrieve its released assets and browse general resources. Those activities do not all require the same visibility.

Create a company-private working area, a company release area and a separate shared resource area where appropriate. The shared area should contain material explicitly intended for portfolio-wide use. Do not treat every final asset as a shared resource merely because it has been approved for one company's publication.

[Bynder's asset-management guidance](https://support.bynder.com/hc/en-us/articles/360013931739-Best-Practices-for-Digital-Asset-Management) distinguishes user roles and permissions as controls over asset access. Your operating model should make the reason for each role clear before translating it into application settings.

Write down the expected users for each space. Include platform editors, company contributors, company reviewers and resource-only users. Avoid a broad “portfolio member” role that unintentionally grants access to every company's work.

Choose the smallest set of spaces that expresses these differences clearly. An elaborate folder tree with identical permissions adds complexity without creating useful separation.

## Map roles to actual actions

For each role, specify whether the user may view, upload, edit metadata, comment, approve or share. Some applications combine these actions; document the closest available role and any limitations. Do not assume that a familiar label such as “contributor” behaves identically across systems.

The [Google shared-drive access guide](https://support.google.com/a/users/answer/12380484?hl=en) explains that access can depend on memberships, direct grants and restrictions. It also describes cases where a temporary sharing restriction leaves underlying permissions in place. That is why changing one setting is not enough evidence that an unwanted grant has been removed.

Distinguish the power to review from the power to release. A company contact might be able to comment on a draft without being the person who approves its use. Record the business role alongside the application role so staff do not mistake technical access for decision authority.

Keep sharing privileges limited to people who understand the boundaries. If every contributor can create public links, your carefully separated working areas may still be bypassed through individual assets.

## Build a two-company access table

The following table is a fictional design exercise. Translate it into your chosen system only after checking that the application supports the intended boundaries.

| Role | Alder working media | Beacon working media | Own released assets | Shared resources |
| --- | --- | --- | --- | --- |
| Platform editor | Edit for assigned work | Edit for assigned work | Maintain | Maintain |
| Alder contributor | Upload and edit assigned files | No access | View | View |
| Alder reviewer | Review assigned versions | No access | View | View |
| Beacon contributor | No access | Upload and edit assigned files | View | View |
| Resource-only member | No access | No access | No company access | View |

The table does not imply that every platform editor needs every company file. If assignments require additional separation, create narrower editor groups or grant access for the actual project. Keep the operating model understandable enough that staff can explain why a person is included.

Treat release areas as company-specific unless broader use is documented. Alder's permission to publish its own customer interview does not establish that Beacon may use it in a campaign. Technical access and permission to reuse remain different questions.

Add an exception column in your working copy when a project needs unusual access. Record the reason and review trigger so exceptions do not become permanent default memberships.

## Test expected access and expected denial

Use harmless sample files to test the design before placing real working material in it. Create clearly labeled Alder and Beacon examples and a shared resource. Test with representative accounts or an approved method for checking each role.

A positive test confirms a permitted action: Alder's contributor can upload to the correct working area. A negative test confirms a prohibited action: that contributor cannot discover or open Beacon's sample. Both matter. A design that blocks everyone is private but unusable.

Test several routes, including navigation, search, a direct asset link and a previously shared link. A person might fail to browse a folder while still opening a file through a direct grant. Record the route used in the test rather than only a general pass or fail.

Also test whether users can invite others, change sharing or download where those actions matter to your workflow. Do not promise controls the application does not provide. If a download cannot be restricted reliably for the use case, explain the limitation and choose a different way to share the material.

Save the test result with the role design, including the date and configuration context.

## Handle common changes deliberately

Company contacts change. Projects move from working to released status. Platform staff take new assignments. Each event can alter who should see an asset.

When changing a user's access, check the routes through which it was granted. Removing a group membership may not address a direct grant, depending on the system and the particular access path. Verify the result through the same routes tested during setup.

When moving an asset, inspect how destination permissions affect it. Do not assume that moving a file into a better-named folder gives it the intended access. Keep its identity and release record intact so people can distinguish the move from a new version.

For a temporary reviewer, define the ending event: the review is completed, the project closes or the reviewer leaves the company. Avoid leaving temporary access open simply because there was no calendar date attached to it.

If you discover cross-company exposure, stop further sharing of the affected material, preserve enough information to understand the scope and use the organization's established incident route. Do not quietly rearrange files and assume the issue is resolved.

## Make the model maintainable

Keep a compact access register that maps company spaces, user groups, sharing owners and the latest test. The register should help the coordinator answer who can see an area and why without reconstructing every historical invitation.

Review a sample after meaningful changes rather than relying only on a distant annual exercise. A new folder template, migration or change in default sharing can affect many companies at once. Test the pattern before repeating it.

Give company contacts simple instructions for requesting access and reporting an unexpected view. A user who can see another company's material should know whom to contact without forwarding the file to demonstrate the problem.

The aim is a media library that supports collaboration within agreed boundaries. Keep those boundaries visible in the structure, the permissions and the tests. When the three disagree, the tested behavior is what matters.

Continue with [preparing an editing handoff](/blog/outsourcing-video-editing-checklist) and [maintaining portfolio media guidelines](/blog/portfolio-video-brand-guidelines).

[Download the desktop app](/download).
