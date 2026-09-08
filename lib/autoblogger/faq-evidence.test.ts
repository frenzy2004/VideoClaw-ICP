import { describe, expect, it } from 'vitest';
import { faqBodyMatches, planFaqEvidence } from './faq-evidence';
import type { SourceFact } from './content-bundle';

const source: SourceFact = {
  id: 's1', label: 'Fixture publisher', url: 'https://example.com/guide', checkedAt: '2026-09-08T00:00:00.000Z',
  facts: [
    { id: 'definition', text: 'Video marketing is the use of video to promote a product or service.', evidenceKind: 'body' },
    { id: 'cost', text: 'Video marketing costs depend on crew, editing time and distribution budget.', evidenceKind: 'body' },
    { id: 'duration', text: 'A founder pitch video should last one minute for this specific application.', evidenceKind: 'body' },
  ],
};

describe('FAQ evidence preflight', () => {
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
