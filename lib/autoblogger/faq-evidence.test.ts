import { describe, expect, it } from 'vitest';
import { faqBodyMatches, faqQuestionKey, planFaqEvidence } from './faq-evidence';
import type { SourceFact } from './content-bundle';

const source: SourceFact = {
  id: 's1', label: 'Fixture publisher', url: 'https://example.com/guide', checkedAt: '2026-09-08T00:00:00.000Z',
  facts: [
    { id: 'definition', text: 'Video marketing is the use of video to promote a product or service.', evidenceKind: 'body' },
    { id: 'cost', text: 'Video marketing costs depend on crew, editing time and distribution budget.', evidenceKind: 'body' },
    { id: 'duration', text: 'A founder pitch video should last one minute for this specific application.', evidenceKind: 'body' },
  ],
};

// Minimal exact body sentences from saved source-3-fact-13. Keep page-sized
// private replay data out of fixtures; these exercise the production matcher.
const explainerCost = 'According to a 2024 Wyzowl research, the average cost of an explainer video is $5,400.';
const explainerTypes = 'You can use any type of explainer video, including animations, live actions, and AI-generated content.';

describe('FAQ question intent keys', () => {
  it('deduplicates make/create cost intent while retaining the full subject and other question wording', () => {
    expect(faqQuestionKey).toBeTypeOf('function');
    const cases = [
      ['How much does it cost to make an explainer video?', 'cost:explainer video'],
      ['How much does it cost to create an explainer video?', 'cost:explainer video'],
      ['How much does an explainer video cost?', 'cost:explainer video'],
      ['  HOW much  does it cost to create the explainer video??  ', 'cost:explainer video'],
      ['How much do explainer videos cost?', 'cost:explainer video'],
      ['How much does it cost to create an AI explainer video?', 'cost:ai explainer video'],
      ['How much does an artificial intelligence explainer video cost?', 'cost:ai explainer video'],
      ['How much does it cost to create a 1-minute explainer video?', 'cost:1-minute explainer video'],
      ['How much does it cost to create a 1.5-minute explainer video?', 'cost:1.5-minute explainer video'],
      ['How much does it cost to create a 1-5-minute explainer video?', 'cost:1-5-minute explainer video'],
      ['How much does it cost to create an explainer video for children?', 'cost:explainer video for children'],
      ['How much does it cost to make an explainer video without audio?', 'cost:explainer video without audio'],
      ['How much does it cost to make an explainer video with audio?', 'cost:explainer video with audio'],
      ['How much does it cost to make a video for you?', 'cost:video for you'],
      ['How much does it cost to make a video for me?', 'cost:video for me'],
      ['How much does it cost to make the best explainer video?', 'cost:best explainer video'],
      ['  What are the different types of explainer videos? ', 'what are the different types of explainer videos'],
      ['How can I make an explainer video?', 'how can i make an explainer video'],
      ['How can I create an explainer video?', 'how can i create an explainer video'],
      ['How much does it cost to build an explainer video?', 'how much does it cost to build an explainer video'],
      ['How much does it cost to create?', 'how much does it cost to create'],
      ['How much does it cost?', 'how much does it cost'],
      ['', ''],
    ];
    for (const [question, expected] of cases) expect(faqQuestionKey(question)).toBe(expected);
  });
});

describe('complete cost predicates', () => {
  const questions = [
    'How much does it cost to make an explainer video?',
    'How much does it cost to create an explainer video?',
    'How much does an explainer video cost?',
  ];
  // Catch prefix-only price checks and dependencies with no named drivers.
  // These are literal counterexamples, not mock responses or private helpers.
  const unsupported = [
    'According to a made-up example, an explainer video costs $500.',
    'According to an illustrative scenario, explainer video costs depend on crew.',
    'According to a simulated estimate, an explainer video costs $500.',
    'According to an invented price guide, an explainer video costs $500.',
    'An explainer video costs $500, but this is a made-up example.',
    'An explainer video costs $500; this is illustrative.',
    'An explainer video costs $500 as a placeholder.',
    'An explainer video costs $500 as discussed below.',
    'The cost of an explainer video is $500, an invented figure.',
    'Explainer video costs range from $500 to $900, for illustration.',
    'An explainer video costs $5,40.',
    'An explainer video costs $500ish.',
    'Explainer video costs range from $500 to a figure revealed below.',
    'Explainer video costs range from one placeholder to another.',
    'Explainer video costs depend on several factors explained below.',
    'Explainer video costs depend on several factors.',
    'The cost of an explainer video varies with many things.',
    'Explainer video costs depend on crew described below.',
    'Explainer video costs depend on crew, editing time and distribution budget, but this is a made-up example.',
    'Explainer video costs depend on crew and other factors.',
    'Explainer video costs depend on recording time and editing work required, as an illustrative example.',
  ];

  it.each(unsupported)('rejects the complete unsupported predicate in the retrieval screen: %s', text => {
    for (const question of questions) expect(faqBodyMatches(question, text)).toBe(false);
  });

  it.each(unsupported)('does not bind a body fact containing an unsupported cost predicate: %s', text => {
    const heading = 'Explainer video costs ';
    const input: SourceFact[] = [{...source, facts: [
      {id: 'unsupported-cost', text: heading + text, bodyStart: heading.length, evidenceKind: 'body'},
    ]}];
    expect(planFaqEvidence(questions, input)).toEqual([
      {question: questions[0], sourceFactIds: []},
      {question: questions[1], sourceFactIds: []},
      {question: questions[2], sourceFactIds: []},
    ]);
  });

  it.each([
    explainerCost,
    'An explainer video costs $500.',
    'An explainer video costs $5,400.50.',
    'An explainer video costs €500.',
    'The cost of an explainer video is £1,200.',
    'Explainer video costs range from $500 to $900.',
    'The cost of an explainer video varies with length, video type, and complexity.',
    'Explainer video costs vary by production scope.',
    'Explainer video costs depend on the crew and editing time.',
    'Explainer video costs depend on production crew and editing budget.',
    'Explainer video costs depend on recording time and the editing work required.',
  ])('retains a complete price, numeric range or named-driver assertion: %s', text => {
    for (const question of questions) expect(faqBodyMatches(question, text)).toBe(true);
  });

  it('binds the saved 2024 PlayPlay price and named drivers while excluding disclaimers and teasers', () => {
    const input: SourceFact[] = [{...source, facts: [
      {id: 'saved-price', text: explainerCost, evidenceKind: 'body'},
      {id: 'named-drivers', text: 'Explainer video costs depend on crew, editing time and distribution budget.', evidenceKind: 'body'},
      {id: 'disclaimer', text: 'An explainer video costs $500, but this is a made-up example.', evidenceKind: 'body'},
      {id: 'teaser', text: 'Explainer video costs depend on several factors explained below.', evidenceKind: 'body'},
    ]}];
    expect(planFaqEvidence(questions, input)).toEqual([
      {question: questions[0], sourceFactIds: ['saved-price', 'named-drivers']},
      {question: questions[1], sourceFactIds: ['saved-price', 'named-drivers']},
      {question: questions[2], sourceFactIds: ['saved-price', 'named-drivers']},
    ]);
  });
});

describe('explainer FAQ cost and taxonomy evidence', () => {
  // Catch extraction that leaves "cost to make/create" in the requested subject.
  it.each([
    'How much does it cost to make an explainer video?',
    'How much does it cost to create an explainer video?',
    'How much does an explainer video cost?',
  ])('matches a saved direct cost assertion for %s', question => {
    expect(faqBodyMatches(question, explainerCost)).toBe(true);
  });

  it.each([
    ['How much does it cost to create an AI explainer video?', 'AI explainer video costs depend on production scope and editing time.'],
    ['How much does it cost to make an explainer video for children?', 'An explainer video for children costs $500.'],
    ['How much does it cost to make an explainer video without audio?', 'An explainer video without audio costs $500.'],
    ['How much does it cost to create a 1-minute explainer video?', 'The cost of a 1-minute explainer video ranges from $500 to $900.'],
  ])('matches cost evidence with the full requested subject: %s', (question, text) => {
    expect(faqBodyMatches(question, text)).toBe(true);
  });

  // Catch word pooling, subject broadening, and treating a denial/teaser as a price.
  it.each([
    ['wrong subject', 'A product demo costs $500.'],
    ['longer subject', 'An explainer video course costs $500.'],
    ['cooccurring subject', 'An explainer video discusses how a product demo costs $500.'],
    ['unrelated price', 'An explainer video uses footage from a camera that costs $500.'],
    ['negated price', 'An explainer video does not cost $500.'],
    ['negated dependency', 'Explainer video costs never depend on editing time.'],
    ['hypothetical', 'If an explainer video costs $500, choose a shorter script.'],
    ['conditional price', 'An explainer video costs $500 if the sponsor agrees.'],
    ['speculation', 'An explainer video could cost $500.'],
    ['unstated conditions', 'An explainer video costs $500 under certain conditions.'],
    ['theoretical price', 'An explainer video costs $500 in theory.'],
    ['example price', 'An explainer video costs $500 as an example.'],
    ['fictional price', 'An explainer video costs $500 in a fictional scenario.'],
    ['question', 'Does an explainer video cost $500?'],
    ['later answer', 'We will explain how the cost of an explainer video depends on editing time later.'],
    ['teaser', 'Discover how explainer video costs depend on production scope.'],
    ['heading-like fragment', 'Explainer video costs from $500'],
  ])('rejects %s cost evidence for both cost question forms', (_reason, text) => {
    for (const question of ['How much does it cost to create an explainer video?', 'How much does an explainer video cost?']) {
      expect(faqBodyMatches(question, text)).toBe(false);
    }
  });

  it.each([
    ['How much does it cost to make an AI explainer video?', explainerCost],
    ['How much does an AI explainer video cost?', 'An explainer video costs $500 including AI tools.'],
    ['How much does it cost to create a 1-minute explainer video?', explainerCost],
    ['How much does it cost to make an explainer video for children?', explainerCost],
    ['How much does it cost to make an explainer video without audio?', explainerCost],
    ['How much does it cost to make an explainer video?', 'An AI explainer video costs $500.'],
  ])('does not borrow, drop or broaden a cost subject qualifier: %s', (question, text) => {
    expect(faqBodyMatches(question, text)).toBe(false);
  });

  // Catch taxonomy questions routed to definitions, while requiring an explicit
  // subject and at least two bounded labels in the same body assertion.
  it.each([
    ['What are the different types of explainer videos?', explainerTypes],
    ['What are the types of explainer videos?', 'Types of explainer videos include animation, live action, and motion graphics.'],
    ['What are the main types of explainer videos?', 'The main types of explainer videos are animation and live action.'],
    ['What are the different types of AI explainer videos?', 'Types of AI explainer videos include avatars and generated animation.'],
  ])('accepts an explicit body taxonomy for %s', (question, text) => {
    expect(faqBodyMatches(question, text)).toBe(true);
  });

  it.each([
    ['heading-shaped fragment', 'Types of explainer videos: animation, live action, and motion graphics.'],
    ['unbound subject', 'The three main types are animated, live action, and crowdfunding.'],
    ['wrong subject', 'Types of product demos include animation and live action.'],
    ['longer subject', 'Types of explainer video software include editors and generators.'],
    ['cooccurring keywords', 'Use an explainer video to discuss animation, live action, and other video types.'],
    ['count without labels', 'Explainer videos fall into three categories.'],
    ['one label', 'Types of explainer videos include animation.'],
    ['negated taxonomy', 'Types of explainer videos do not include animation and live action.'],
    ['negated use', 'You cannot use any type of explainer video, including animations and live actions.'],
    ['conditional taxonomy', 'If types of explainer videos include animation and live action, use either.'],
    ['conditional use', 'You can use any type of explainer video, including animations and live actions, if the client agrees.'],
    ['hypothetical taxonomy', 'Types of explainer videos might include animation and live action.'],
    ['theoretical taxonomy', 'Types of explainer videos include animation and live action in theory.'],
    ['excluded labels', 'Types of explainer videos include everything except animation and live action.'],
    ['later answer', 'We will explain the different types of explainer videos, including animation and live action, later.'],
    ['teaser', 'Discover the types of explainer videos, including animation and live action.'],
    ['placeholder list', 'Types of explainer videos include something we explain later and something we discuss next.'],
    ['question', 'Types of explainer videos include animation and live action?'],
    ['separate assertions', 'Types of explainer videos include animation. Product demo types include live action.'],
  ])('rejects %s as taxonomy evidence', (_reason, text) => {
    expect(faqBodyMatches('What are the different types of explainer videos?', text)).toBe(false);
  });

  it('requires every taxonomy qualifier in the grammatical subject', () => {
    expect(faqBodyMatches('What are the different types of AI explainer videos?', explainerTypes)).toBe(false);
    expect(faqBodyMatches('What are the different types of explainer videos?', 'Types of AI explainer videos include avatars and generated animation.')).toBe(false);
  });

  it.each([
    ['What is the best explainer video?', 'The best explainer video is a short animation with a clear message.'],
    ['What is the best AI explainer video?', 'The best AI explainer video is a short animation with a clear message.'],
    ['What is the cheapest explainer video?', 'The cheapest explainer video is a short animation with a clear message.'],
    ['What is the most effective explainer video?', 'The most effective explainer video is a short animation with a clear message.'],
  ])('does not turn an unsupported superlative into evidence: %s', (question, text) => {
    expect(faqBodyMatches(question, text)).toBe(false);
  });

  it('selects original body fact IDs and excludes snippets, headings and separate-fact subject pooling', () => {
    const costQuestion = 'How much does it cost to make an explainer video?';
    const typeQuestion = 'What are the different types of explainer videos?';
    const costHeading = `${explainerCost} `;
    const typeHeading = `${explainerTypes} `;
    const questionHeading = `${typeQuestion} `;
    const input: SourceFact[] = [{...source, facts: [
      {id: 'saved-cost', text: 'Explainer videos FAQs ' + explainerCost, bodyStart: 'Explainer videos FAQs '.length, evidenceKind: 'body'},
      {id: 'saved-types', text: explainerTypes, evidenceKind: 'body'},
      {id: 'cost-snippet', text: explainerCost, evidenceKind: 'serp_snippet'},
      {id: 'type-snippet', text: explainerTypes, evidenceKind: 'serp_snippet'},
      {id: 'cost-heading', text: costHeading + 'Read the guide.', bodyStart: costHeading.length, evidenceKind: 'body'},
      {id: 'type-heading', text: typeHeading + 'Read the guide.', bodyStart: typeHeading.length, evidenceKind: 'body'},
      {id: 'question-heading', text: questionHeading + 'The three main types are animated, live action, and crowdfunding.', bodyStart: questionHeading.length, evidenceKind: 'body'},
      {id: 'subject-only', text: 'An explainer video explains a product.', evidenceKind: 'body'},
      {id: 'unscoped-types', text: 'The types include animation and live action.', evidenceKind: 'body'},
    ]}];
    const before = JSON.stringify(input);
    expect(planFaqEvidence([costQuestion, typeQuestion], input)).toEqual([
      {question: costQuestion, sourceFactIds: ['saved-cost']},
      {question: typeQuestion, sourceFactIds: ['saved-types']},
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('FAQ evidence preflight', () => {
  it.each([
    ['What is a tutorial video called?', 'A tutorial video is also called an instructional video.'],
    ['What are tutorial videos called?', 'Tutorial videos are known as instructional videos.'],
    ['What is an instructional video called?', 'An instructional video is referred to as a how-to video.'],
    ['What are tutorial videos called?', 'Tutorial videos, also known as instructional videos, teach a task step by step.'],
  ])('recognises an explicit naming assertion about the exact subject: %s', (question, text) => {
    expect(faqBodyMatches(question, text)).toBe(true);
  });
  it.each([
    'A tutorial video is a video that teaches a task step by step.',
    'If a tutorial video is a screencast, use screen recording software.',
    'A tutorial video is not called an instructional video.',
    'A tutorial video might be called an instructional video.',
    'A tutorial video is called an instructional video only when it covers a task.',
    'Some tutorial videos are called screencasts.',
    'A tutorial video editor is called a video editor.',
    'We will explain what a tutorial video is called in the next section.',
    'Is a tutorial video called an instructional video?',
    'A tutorial video is called an instructional video?',
    'Record a tutorial video. A screen capture is also called a screencast.',
    'A tutorial video is called into question by viewers.',
    'A tutorial video is called neither an instructional video nor a screencast.',
    'A tutorial video is called a screencast provided it records screens.',
    'A tutorial video is called something we explain next.',
    'A tutorial video is called an instructional video under certain conditions.',
    'A tutorial video is called by another name.',
  ])('does not turn a definition, subset, qualification or different subject into a naming answer: %s', text => {
    expect(faqBodyMatches('What is a tutorial video called?', text)).toBe(false);
  });
  it('requires naming evidence in the body, with every subject qualifier and the original fact ID', () => {
    const text = 'A tutorial video is also called an instructional video.';
    const input = [{...source, facts: [
      {id: 'name', text, evidenceKind: 'body' as const},
      {id: 'snippet', text, evidenceKind: 'serp_snippet' as const},
      {id: 'heading', text: text + ' Read the manual for recording instructions.', bodyStart: text.length + 1, evidenceKind: 'body' as const},
    ]}];
    expect(planFaqEvidence(['What is a tutorial video called?', 'What is an AI tutorial video called?'], input)).toEqual([
      {question: 'What is a tutorial video called?', sourceFactIds: ['name']},
      {question: 'What is an AI tutorial video called?', sourceFactIds: []},
    ]);
  });
  it.each([
    ['How do I record my screen for a tutorial video?', 'Step 7. Record your tutorial video ', 'Open the capture panel. Click Screen Recording. Select a window to capture.'],
    ['How can I edit audio for a founder pitch video?', 'Edit your founder pitch video ', 'Open the editor. Use Audio Editing. Trim the selected track.'],
    ['How do I export captions for a product demo?', 'Export your product demo ', 'Open the output panel. Select caption export. Save the subtitle file.'],
    ['How do I record my screen for a tutorial video?', 'Record your tutorial video ', 'Record your screen.'],
  ])('retains procedure-heading context for a concrete body instruction: %s', (question, heading, body) => {
    expect(faqBodyMatches(question, heading + body, heading.length)).toBe(true);
  });

  it.each([
    ['', 'Click Screen Recording.'],
    ['Record your tutorial video ', ''],
    ['Record your tutorial video ', 'This guide will explain screen recording in a later section.'],
    ['Record your tutorial video ', 'Screen recording is available in many applications.'],
    ['Record your tutorial video ', 'Do not record your screen.'],
    ['Record your tutorial video ', 'Never click Screen Recording.'],
    ['Record your tutorial video ', 'Select a screen layout. Record your webcam instead.'],
    ['Record your tutorial video ', 'Click Screen Recording?'],
    ['Record your tutorial video ', 'Select the latest monthly invoice.'],
    ['Record your tutorial video ', 'Record your screen for a music video.'],
    ['Record your tutorial video ', 'Learn how to click Screen Recording.'],
    ['Record your tutorial video ', 'Click Help to learn how to record your screen.'],
    ['Record your tutorial video ', 'Use the guide to find out how to record your screen.'],
    ['Record your tutorial video ', 'Select a screen layout and record your webcam.'],
    ['Record your tutorial video ', 'Select a screen layout Record your webcam'],
    ['Record your tutorial video ', 'Open the capture panel. Turn off Screen Recording.'],
    ['Record your tutorial video ', 'Select Disable Screen Recording.'],
    ['Record your tutorial video ', 'Click Screen Recording to disable it.'],
    ['Record your tutorial video ', 'Click the picture of the Screen Recording button.'],
    ['Record your tutorial video ', 'Recording your screen is currently unsupported.'],
    ['Record your tutorial video ', 'Record your screen resolution in the project notes.'],
    ['Record your tutorial video ', 'Click Screen Recording Help to read the instructions.'],
    ['Record your tutorial video ', 'Click Screen; recording your webcam starts automatically.'],
    ['Record your tutorial video ', 'Click Screen: recording your webcam starts automatically.'],
    ['Record your tutorial video ', 'Click Screen, recording your webcam starts automatically.'],
    ['How do I record my screen for a tutorial video? ', 'Click Screen Recording.'],
    ['Do not record your tutorial video ', 'Click Screen Recording.'],
    ['Record your product demo ', 'Click Screen Recording.'],
    ['Tutorial video costs ', 'Click Screen Recording.'],
  ])('does not turn unrelated or non-instructional prose into a procedure answer: %s / %s', (heading, body) => {
    expect(faqBodyMatches('How do I record my screen for a tutorial video?', heading + body, heading.length)).toBe(false);
  });

  it.each([
    ['How can I edit audio for a founder pitch video?', 'Edit your founder pitch video ', 'Use Audio Editing to trim the selected track.'],
    ['How do I export captions for a product demo?', 'Export your product demo ', 'Select caption export to save the subtitle file.'],
  ])('declines compound instructions outside the bounded heading-context grammar: %s', (question, heading, body) => {
    // These can be useful prose, but this lexical fallback cannot establish
    // the full relationship safely. It only admits complete simple steps.
    expect(faqBodyMatches(question, heading + body, heading.length)).toBe(false);
  });

  it('does not borrow a missing requested operation or modifier from the heading', () => {
    const heading = 'Record your tutorial video ';
    const text = heading + 'Click Screen Recording. Select the desired window.';
    expect(faqBodyMatches('How do I automatically record my screen for a tutorial video?', text, heading.length)).toBe(false);
    expect(faqBodyMatches('How do I record my screen using AI for a tutorial video?', text, heading.length)).toBe(false);
    expect(faqBodyMatches('How do I record my screen without audio for a tutorial video?', text, heading.length)).toBe(false);
  });

  it('maps a complete procedural body fact without pooling separate facts or relabelling a naming gap', () => {
    const heading = 'Record your tutorial video ';
    const facts: SourceFact['facts'] = [
      {id: 'procedure', text: heading + 'Open the capture panel. Click Screen Recording.', bodyStart: heading.length, evidenceKind: 'body'},
      {id: 'heading-only', text: heading, bodyStart: heading.length, evidenceKind: 'body'},
      {id: 'unscoped-body', text: 'Click Screen Recording.', evidenceKind: 'body'},
      {id: 'snippet', text: heading + 'Click Screen Recording.', bodyStart: heading.length, evidenceKind: 'serp_snippet'},
    ];
    const input = [{...source, facts}];
    const before = JSON.stringify(input);
    expect(planFaqEvidence(['How do I record my screen for a tutorial video?', 'What is a tutorial video called?'], input)).toEqual([
      {question: 'How do I record my screen for a tutorial video?', sourceFactIds: ['procedure']},
      {question: 'What is a tutorial video called?', sourceFactIds: []},
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('maps answer-shaped body passages without treating topic overlap as AI support', () => {
    expect(planFaqEvidence(['What is video marketing?', 'What is AI video marketing?', 'How much does video marketing cost?'], [source]))
      .toEqual([
        { question: 'What is video marketing?', sourceFactIds: ['definition'] },
        { question: 'What is AI video marketing?', sourceFactIds: [] },
        { question: 'How much does video marketing cost?', sourceFactIds: ['cost'] },
      ]);
  });
  it('never promotes search snippets or heading-only question repeats to answer support', () => {
    const heading = 'What is AI video marketing? ';
    const body = 'This guide covers video marketing for startup teams.';
    expect(faqBodyMatches('What is AI video marketing?', heading + body, heading.length)).toBe(false);
    expect(planFaqEvidence(['What is video marketing?'], [{ ...source, facts: source.facts.map(f => ({ ...f, evidenceKind: 'serp_snippet' })) }])[0].sourceFactIds).toEqual([]);
  });
  it('requires a duration answer for a how-long question, not unrelated numbers', () => {
    expect(planFaqEvidence(['How long should a founder pitch video be?'], [source])[0].sourceFactIds).toEqual(['duration']);
    expect(faqBodyMatches('How long should a founder pitch video be?', 'A founder pitch video can include 3 examples of the product.')).toBe(false);
  });
  it('supports explicit AI definitions but not a question, a denial of coverage, or disjoint topic tokens', () => {
    expect(faqBodyMatches('What is AI video marketing?', 'AI video marketing refers to using artificial intelligence to create or adapt marketing videos.')).toBe(true);
    expect(faqBodyMatches('What is AI video marketing?', 'What is AI video marketing? Read more.')).toBe(false);
    expect(faqBodyMatches('What is AI video marketing?', 'AI video marketing is not defined in this guide.')).toBe(false);
    expect(faqBodyMatches('What is AI video marketing?', 'AI is discussed elsewhere. Video marketing is a promotional technique.')).toBe(false);
    expect(faqBodyMatches('What is video marketing?', 'Video marketing statistics are interesting for several different reasons.')).toBe(false);
    expect(faqBodyMatches('What is video marketing?', 'Video marketing is important for every business in this article.')).toBe(false);
  });
  it('requires all qualifiers and preserves exact observed questions and fact IDs without mutating input', () => {
    const before = JSON.stringify(source);
    expect(faqBodyMatches('What is AI video marketing?', 'Video marketing is a promotional technique.')).toBe(false);
    expect(faqBodyMatches('What is AI video marketing?', 'Artificial intelligence video marketing means applying AI to marketing videos.')).toBe(true);
    expect(planFaqEvidence([' What is video marketing? '], [source])[0].question).toBe(' What is video marketing? ');
    expect(JSON.stringify(source)).toBe(before);
  });
  it('fails closed for invalid body offsets, unanchored generic questions and unsupported types', () => {
    for (const offset of [-1, 0.5, Infinity, 1000]) expect(faqBodyMatches('What is video marketing?', source.facts[0].text, offset)).toBe(false);
    expect(faqBodyMatches('What is it?', source.facts[0].text)).toBe(false);
    expect(faqBodyMatches('Is video marketing guaranteed to work?', 'Video marketing is a promotional technique.')).toBe(false);
  });

  it.each([
    ['How much does video marketing cost?', 'Learn how much video marketing costs and plan your budget.'],
    ['How much does video marketing cost?', 'Video marketing production costs and editing budget.'],
    ['How do you record a founder pitch video?', 'This guide will explain how to record a founder pitch video.'],
    ['How do you record a founder pitch video?', 'This guide explains how to record a founder pitch video.'],
    ['How do you plan a founder pitch video?', 'How do you plan a founder pitch video.'],
    ['Why does video marketing matter?', 'You will learn why video marketing helps explain products.'],
  ])('does not map a teaser or question repeat to FAQ evidence: %s / %s', (question, text) => {
    expect(planFaqEvidence([question], [{ ...source, facts: [{ id: 'teaser', text, evidenceKind: 'body' }] }]))
      .toEqual([{ question, sourceFactIds: [] }]);
  });

  it.each([
    ['What is a video marketing plan?', 'Video marketing is the use of video to promote a product or service.', false],
    ['What is a video marketing plan?', 'A video marketing plan is a document describing goals, audiences and production tasks.', true],
    ['What is an AI video marketing plan?', 'A video marketing plan is a document describing goals, audiences and production tasks.', false],
    ['What is an AI video marketing plan?', 'An AI video marketing plan is a document describing goals, audiences and automated production tasks.', true],
    ['How do you plan an AI video marketing campaign?', 'To plan a video marketing campaign, choose an audience and prepare a production schedule.', false],
    ['How do you plan an AI video marketing campaign?', 'To plan an AI video marketing campaign, choose an audience and prepare a production schedule.', true],
    ['How do you plan a video marketing plan?', 'Video marketing campaigns should start with choosing an audience and preparing a production schedule.', false],
    ['How much does an AI video marketing plan cost?', 'AI video marketing plan costs depend on the campaign scope and production budget.', true],
    ['How much does an AI video marketing plan cost?', 'AI video marketing costs depend on the campaign scope and production budget.', false],
  ])('strips question grammar while retaining subject qualifiers: %s / %s', (question, text, expected) => {
    expect(faqBodyMatches(question, text)).toBe(expected);
  });

  it.each([
    ['A founder pitch video should last 1.5 minutes for this application.', true],
    ['A founder pitch video should last 1.5–2.5 minutes for this application.', true],
    ['A founder pitch video should be concise. The introduction lasts 1.5 minutes.', false],
    ['A founder pitch video can include 1.5 examples of the product.', false],
  ])('keeps decimal durations in their own sentence: %s', (text, expected) => {
    expect(faqBodyMatches('How long should a founder pitch video be?', text)).toBe(expected);
  });

  it.each([
    ['What are the benefits of video marketing?', 'Video marketing benefits include explaining products visually and helping buyers understand features.', true],
    ['What are the benefits of AI video marketing plans?', 'Benefits of AI video marketing plans include coordinating production tasks and tracking campaign goals.', true],
    ['What are the benefits of AI video marketing plans?', 'Video marketing benefits include explaining products visually and helping buyers understand features.', false],
    ['What are the benefits of video marketing?', 'Video marketing is a technique for explaining products visually to prospective buyers.', false],
    ['What are the benefits of video marketing?', 'This guide will explain video marketing benefits and include examples in a later update.', false],
    ['What are video marketing plans?', 'Video marketing plans include production schedules and campaign budgets for each audience.', false],
    ['What are video marketing plans?', 'Video marketing plans are important for every business in this article.', false],
  ])('uses explicit benefits enumeration without widening every what-are question: %s / %s', (question, text, expected) => {
    expect(faqBodyMatches(question, text)).toBe(expected);
  });
});
