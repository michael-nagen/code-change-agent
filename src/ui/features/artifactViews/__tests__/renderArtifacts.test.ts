import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AnalysisResult } from '../../../../analysis/index.js';
import type { WorkspaceCard } from '../../../types.js';
import { renderWorkspaceCards, prDescriptionToMarkdown } from '../index.js';

function baseResult(): AnalysisResult {
  return {
    sessionId: 'sess-1',
    requirementInput: { requirementText: 'Add a cache', source: 'manual' },
    changeExplanation: {
      changeStory: 'Adds a cache.',
      keyFunctionalities: ['Cache reads'],
      flow: ['read', 'store'],
      mainComponents: [{ name: 'Cache', responsibility: 'Holds values' }],
      architecturalDecisions: ['In-memory map'],
      impactAnalysis: ['Read path'],
      uncertainties: ['Tests?'],
    },
    requirementAlignment: {
      requirementSummary: 'Cache with TTL',
      satisfiedItems: ['TTL present'],
      partiallySatisfiedItems: [],
      missingItems: [],
      unclearItems: [],
      overallAssessment: 'Mostly aligned.',
      confidence: 'medium',
    },
  };
}

function fullResult(): AnalysisResult {
  const r = baseResult();
  r.gapReport = {
    readiness: 'needs_changes',
    completedWork: ['Did X'],
    remainingGaps: ['Missing Y'],
    partialItems: ['Half Z'],
    unclearItems: ['Unknown W'],
    risks: ['Risk R'],
    recommendedNextActions: ['Do Q'],
    prRecommendation: 'Hold the PR.',
  };
  r.flowArtifact = {
    title: 'My Flow',
    description: 'desc',
    steps: ['step one'],
    mermaid: 'flowchart TD\n  A --> B',
  };
  r.prDescription = {
    title: 'Add cache',
    summary: 'Summary here',
    whatChanged: ['Added cache'],
    requirementCoverage: ['TTL covered'],
    featureFlow: 'flow prose',
    testingNotes: ['Add unit tests'],
    risksAndFollowUps: ['Watch memory'],
  };
  r.videoScript = {
    title: 'Walkthrough',
    targetAudience: 'Devs',
    estimatedDuration: '~2 min',
    sections: [{ title: 'Intro', narration: 'hello', visualCue: 'show diff' }],
    keyTakeaways: ['Takeaway'],
  };
  r.dailyUpdate = {
    headline: 'Built the cache.',
    yesterdaySummary: ['Implemented cache'],
    todaySuggestions: ['Add tests'],
    blockersOrRisks: ['Memory'],
    highlightedTopic: { title: 'TTL', explanation: 'expires', whyItMatters: 'freshness' },
    spokenVersion: 'Yesterday I built the cache.',
  };
  r.dailyWorkGuidance = {
    headline: 'Planning built; next steps queued.',
    whatChanged: ['Built the planning stage.'],
    nextActions: ['Open the PR.'],
    blockersOrDecisions: [],
    loopStatus: { currentStage: 'planning', overallStatus: 'pending_user_review' },
    selfCritique: {
      issues: [
        {
          targetStepId: 'step-1',
          issue: 'The step had no validation check.',
          severity: 'medium',
          suggestion: 'Add a concrete validation step.',
        },
      ],
      revisionApplied: true,
      summary: 'Revised the plan once before showing it.',
      confidence: 'medium',
      checkedAt: '2026-07-07T12:00:00.000Z',
    },
    yesterdaySummary: 'Implemented the cache read path.',
    progressVsSpec: [
      {
        item: 'Cache with TTL',
        previousStatus: 'missing',
        whatChanged: 'Added a cache with TTL.',
        newStatus: 'partial',
        evidence: 'Change explanation adds a cache.',
        confidence: 'medium',
      },
    ],
    advancedChecklistItems: [
      {
        item: 'Cache with TTL',
        previousStatus: 'missing',
        newStatus: 'partial',
        whatAdvanced: 'Cache scaffolding landed.',
        evidence: 'Change explanation.',
      },
    ],
    blockersAndRisks: [
      {
        title: 'Memory growth',
        description: 'Unbounded cache.',
        whyItMatters: 'Could leak memory.',
        requiredAction: 'Add an eviction policy.',
        severity: 'medium',
      },
    ],
    decisionsNeedingApproval: [
      {
        decision: 'Eviction strategy',
        context: 'No eviction yet.',
        options: ['LRU', 'TTL-only'],
        recommendedOption: 'LRU',
        status: 'pending_approval',
      },
    ],
    plannedSteps: [
      {
        id: 'step-1',
        title: 'Add eviction',
        whyItMatters: 'Bounds memory.',
        expectedOutput: 'Cache evicts entries.',
        cursorPrompt: 'Implement LRU eviction in the Cache component.',
        validationChecklist: ['Cache size stays bounded.'],
        relatedSpecItems: ['Cache with TTL'],
        status: 'pending_approval',
      },
    ],
    notionDailyUpdate: {
      yesterday: 'Built the cache.',
      today: 'Add eviction.',
      blockers: 'Memory growth.',
      decisionsNeeded: 'Eviction strategy.',
      progressVsSpec: 'Cache partial.',
      nextCursorPrompt: 'Implement LRU eviction in the Cache component.',
    },
    memoryUpdate: {
      date: '2026-07-07',
      dailySummary: 'Cache scaffolding landed; eviction pending.',
      updatedChecklistStatuses: [{ item: 'Cache with TTL', status: 'partial' }],
      newDecisions: ['Eviction strategy'],
      openBlockers: ['Memory growth'],
      nextActions: ['Add eviction'],
    },
  };
  r.technicalChangeBrief = {
    executiveSummary: 'Adds an in-memory cache with a TTL.',
    dataSchemaChanges: {
      hasChanges: true,
      summary: 'A new CacheEntry shape was introduced.',
      newFields: [
        {
          name: 'expiresAt',
          filePath: 'src/cache.ts',
          description: 'Expiry timestamp.',
          evidence: 'confirmed',
        },
      ],
      changedFields: [],
      removedFields: [],
      newSchemas: [],
      changedParserContracts: [],
      newStatusValues: [],
      persistedDataImpact: 'No persisted data affected.',
      backwardCompatibility: 'compatible',
      backwardCompatibilityNote: 'Additive only.',
    },
    modelsAndTypes: [
      {
        name: 'CacheEntry',
        filePath: 'src/cache.ts',
        represents: 'A cached value with expiry.',
        whyNeeded: 'To store a TTL alongside the value.',
        importantFields: ['expiresAt: expiry time'],
        evidence: 'confirmed',
      },
    ],
    inputsApiFlags: [
      {
        name: 'includeCache',
        kind: 'includeFlag',
        description: 'Turns the cache on.',
        evidence: 'inferred',
      },
    ],
    workflowRuntimeChanges: {
      summary: 'A cache lookup runs before the read path.',
      whereItRuns: 'At the start of the read path.',
      dependsOn: ['Read path'],
      consumesArtifacts: ['None'],
      producesArtifact: 'None',
      cachedOrReused: 'Values reused until expiry.',
      behaviorWhenFlagOff: 'Reads go to the source.',
    },
    uiChanges: {
      hasChanges: false,
      summary: 'No UI changes in this diff.',
      newCardsOrViews: [],
      togglesOrButtons: [],
      copyActions: [],
      sectionsDisplayed: [],
      howToActivate: 'not visible from the provided diff/analysis',
    },
    interestingFunctionality: [
      {
        title: 'TTL expiry check',
        whatItDoes: 'Skips stale entries.',
        whyItMatters: 'Keeps data fresh.',
        howItWorks: 'Compares expiresAt to now.',
        filesInvolved: ['src/cache.ts'],
      },
    ],
    howItWorksStepByStep: [
      { actor: 'Caller', action: 'Requests a value.' },
      { action: 'Cache returns a fresh value or stores one.', detail: 'Checks expiresAt.' },
    ],
    filesWorthShowing: [
      {
        path: 'src/cache.ts',
        whyItMatters: 'Holds the cache and TTL logic.',
        whatToPointOut: 'The expiry check.',
      },
    ],
    talkingPoints: ['We added an in-memory cache with a TTL.'],
  };
  r.demoPrepLoop = {
    loopStatus: {
      currentStage: 'Initial demo plan proposed.',
      overallStatus: 'pending_user_review',
      nextRecommendedAction: 'Review the walkthrough order.',
      whatNeedsUserApproval: ['Demo story'],
    },
    demoStoryProposal: {
      problem: 'Reads were slow.',
      solution: 'An in-memory cache with a TTL.',
      technicalChange: 'A CacheEntry shape with expiry.',
      userOrProductValue: 'Faster reads without stale data.',
      proofOrDemoMoment: 'A repeated read returns instantly.',
      limitationsOrNextSteps: 'In-memory only.',
      status: 'pending_approval',
    },
    walkthroughOrder: [
      {
        order: 1,
        title: 'The CacheEntry contract',
        filePath: 'src/cache.ts',
        type: 'code',
        whyThisComesHere: 'The data contract anchors the story.',
        whatToShow: 'The CacheEntry interface.',
        whatToSay: 'Every cached value carries its own expiry.',
        whatToSkip: 'The map plumbing.',
        relatedFeatureOrConcept: 'TTL cache',
        estimatedTimeSeconds: 45,
        mustShow: true,
        evidence: 'confirmed',
        status: 'pending_approval',
      },
    ],
    codeEvidencePlan: [
      {
        filePath: 'src/cache.ts',
        evidenceType: 'schema',
        whatItProves: 'The TTL is part of the stored shape.',
        whyItMatters: 'Expiry is designed in.',
        confidence: 'high',
        evidence: 'confirmed',
        status: 'pending_approval',
      },
    ],
    screenshotPlan: [
      {
        id: 'shot-1',
        title: 'CacheEntry interface',
        type: 'code',
        filePath: 'src/cache.ts',
        whatToCapture: 'The CacheEntry interface with expiresAt.',
        whyThisMatters: 'It is the core data contract.',
        whatToSay: 'This is the cached shape.',
        whatToSkip: 'Imports.',
        relatedFeatureOrConcept: 'TTL cache',
        estimatedTimeSeconds: 30,
        mustShow: true,
        suggestedCaption: 'The new CacheEntry shape with TTL',
        evidence: 'confirmed',
        status: 'pending_approval',
      },
    ],
    approvalQuestions: [
      {
        question: 'Focus on the read path or the data contract?',
        whyItMatters: 'It changes which slides carry the story.',
        options: ['Read path', 'Data contract'],
        recommendedOption: 'Data contract',
        status: 'pending_approval',
      },
    ],
    deckPlan: [
      {
        slideNumber: 1,
        title: 'The cache entry model',
        purpose: 'Prove the schema change is real.',
        visualType: 'code_screenshot',
        screenshotIds: ['shot-1'],
        whatToShow: 'The CacheEntry screenshot.',
        onSlideText: ['One new type', 'TTL built in'],
        speakerNotes: 'Walk through each field.',
        narrationScript: 'This is the CacheEntry shape.',
        transitionToNextSlide: 'Now the read path.',
        estimatedTimeSeconds: 45,
        mustHave: true,
        status: 'draft',
      },
    ],
    draftVideoScript: {
      title: 'Adding a TTL cache',
      estimatedDuration: '5-7 minutes',
      sections: [
        {
          kind: 'opening',
          title: 'What this video covers',
          narration: 'I walk through the new TTL cache.',
          visualCue: 'Title slide.',
          estimatedTimeSeconds: 30,
        },
      ],
    },
    finalShortPitch: 'We added an in-memory TTL cache so reads are fast and never stale.',
    readinessChecklist: [
      { item: 'Run tests', why: 'Prove the change is green.', done: false },
    ],
  };
  r.weeklyReview = {
    status: {
      status: 'draft',
      confidence: 'medium',
      missingInputs: [],
      reviewPeriodLabel: 'Week ending 2026-07-07',
      generatedAt: '2026-07-07T09:00:00.000Z',
    },
    executiveSummary: 'Shipped the cache; eviction remains.',
    progressAgainstSpec: [
      {
        title: 'Cache with TTL',
        status: 'partial',
        evidence: 'Cache added; eviction missing.',
        notes: 'No conflict with memory.',
        source: 'technical_brief',
      },
    ],
    whatChangedTechnically: {
      schemaOrDataChanges: [],
      modelOrTypeChanges: [{ description: 'Added Cache type.', evidence: 'inferred' }],
      workflowOrRuntimeChanges: [],
      uiChanges: [],
      toolsOrSkillsAdded: [],
      importantFilesOrModules: ['src/cache.ts'],
    },
    keyDecisions: [
      {
        decision: 'Use an in-memory map.',
        why: 'Simplest MVP.',
        impact: 'No persistence.',
        status: 'active',
        source: 'current_run',
      },
    ],
    blockersAndRisks: [
      {
        title: 'Unbounded memory',
        whyItMatters: 'Could leak.',
        status: 'open',
        suggestedNextAction: 'Add eviction.',
      },
    ],
    demoVideoStory: {
      strongestStory: 'Reads are now fast and never stale.',
      whatToShow: ['The cache hit path'],
      whatToSay: ['Why TTL matters'],
      whatToSkip: ['Wiring'],
      recommendedStructure: [{ title: 'Intro', durationLabel: '~1 min', focus: 'The problem' }],
      keyFilesOrScreens: ['src/cache.ts'],
      strongestProductSentence: 'Fast reads, never stale.',
    },
    reviewTalkingPoints: ['I built a TTL cache.'],
    suggestedWeeklyUpdate: {
      thisWeek: 'Built the cache.',
      technicalProgress: 'Cache added.',
      demoProductProgress: 'Can demo fast reads.',
      blockers: 'Unbounded memory.',
      nextWeek: 'Add eviction.',
    },
    nextWeekPlan: ['Add LRU eviction.'],
    memoryUpdateProposal: {
      latestWeeklySummary: 'Cache shipped; eviction pending.',
      updatedChecklistStatuses: [{ item: 'Cache with TTL', status: 'partial' }],
      newDecisions: ['Use an in-memory map.'],
      updatedBlockers: ['Unbounded memory'],
      nextActions: ['Add eviction'],
      demoStorySummary: 'Fast, fresh reads.',
      filesWorthShowing: ['src/cache.ts'],
    },
  };
  return r;
}

function byId(cards: WorkspaceCard[], id: string): WorkspaceCard {
  const card = cards.find((c) => c.id === id);
  assert.ok(card, `expected card ${id}`);
  return card;
}

test('workspace exposes understanding, actions, and debug cards with friendly labels', () => {
  const cards = renderWorkspaceCards(fullResult());
  assert.equal(byId(cards, 'changeExplanation').label, 'What Changed');
  assert.equal(byId(cards, 'requirementAlignment').label, 'Requirement Check');
  assert.equal(byId(cards, 'gapReport').label, 'PR Readiness');
  assert.equal(byId(cards, 'flowArtifact').label, 'Feature Flow');
  assert.equal(byId(cards, 'prDescription').label, 'PR Draft');
  assert.equal(byId(cards, 'videoScript').label, 'Walkthrough Script');
  assert.equal(byId(cards, 'dailyUpdate').label, 'Daily Prep');

  assert.equal(byId(cards, 'changeExplanation').group, 'understanding');
  assert.equal(byId(cards, 'prDescription').group, 'actions');
  assert.equal(byId(cards, 'rawJson').group, 'debug');
});

test('present artifacts are marked generated and render content', () => {
  const cards = renderWorkspaceCards(fullResult());
  assert.equal(byId(cards, 'changeExplanation').state, 'generated');
  assert.match(byId(cards, 'changeExplanation').html, /Adds a cache\./);
  assert.equal(byId(cards, 'gapReport').state, 'generated');
  assert.match(byId(cards, 'gapReport').html, /needs_changes/);
  assert.match(byId(cards, 'gapReport').html, /Hold the PR\./);
});

test('absent optional artifacts show a friendly not-generated state (never an error)', () => {
  const cards = renderWorkspaceCards(baseResult());
  for (const id of [
    'gapReport',
    'flowArtifact',
    'prDescription',
    'videoScript',
    'dailyUpdate',
    'demoPrepLoop',
  ]) {
    const card = byId(cards, id);
    assert.equal(card.state, 'not_generated', `${id} should be not_generated`);
    assert.match(card.html, /hasn't been generated yet/);
    assert.doesNotMatch(card.html, /error|unexpected/i);
  }
  // Required artifacts are always generated.
  assert.equal(byId(cards, 'changeExplanation').state, 'generated');
  assert.equal(byId(cards, 'requirementAlignment').state, 'generated');
});

test('PR Draft card carries copyable markdown text (and only it)', () => {
  const cards = renderWorkspaceCards(fullResult());
  const pr = byId(cards, 'prDescription');
  assert.ok(pr.copyText, 'PR Draft should have copyText');
  assert.match(pr.copyText, /^# Add cache/);
  assert.match(pr.copyText, /## Testing notes/);

  // No other card offers copy.
  for (const id of ['changeExplanation', 'gapReport', 'videoScript', 'dailyUpdate', 'rawJson']) {
    assert.equal(byId(cards, id).copyText, undefined, `${id} must not have copyText`);
  }
});

test('Daily Work Guidance card carries its label, group, and generated state', () => {
  const cards = renderWorkspaceCards(fullResult());
  const g = byId(cards, 'dailyWorkGuidance');
  assert.equal(g.label, 'Daily Work Guidance');
  assert.equal(g.group, 'actions');
  assert.equal(g.state, 'generated');
});

test('Daily Work Guidance renders a lean checkpoint', () => {
  const cards = renderWorkspaceCards(fullResult());
  const g = byId(cards, 'dailyWorkGuidance');
  assert.match(g.html, /Where things stand/);
  assert.match(g.html, /What we did/);
  assert.match(g.html, /What to do next/);
  assert.match(g.html, /Blockers \/ decisions/);
  assert.match(g.html, /Planning built; next steps queued\./);
  assert.match(g.html, /Built the planning stage\./);
  assert.match(g.html, /Open the PR\./);
});

test('Daily Work Guidance has no per-section copy or decision controls', () => {
  const cards = renderWorkspaceCards(fullResult());
  const g = byId(cards, 'dailyWorkGuidance');
  // Edited through the companion chat; footer offers Save to memory / Notion.
  assert.equal(g.copyText, undefined);
  assert.equal(g.copyActions, undefined);
  assert.equal(g.html.includes('data-decision-item'), false);
  assert.equal(g.html.includes('Loop Status'), false);
  assert.equal(g.html.includes('Plan Self-Review'), false);
});

test('Technical Change Brief renders all ten sections', () => {
  const cards = renderWorkspaceCards(fullResult());
  const b = byId(cards, 'technicalChangeBrief');
  assert.equal(b.label, 'Technical Change Brief');
  assert.equal(b.group, 'actions');
  assert.equal(b.state, 'generated');
  assert.match(b.html, /Executive Summary/);
  assert.match(b.html, /Data \/ Schema Changes/);
  assert.match(b.html, /Models &amp; Types/);
  assert.match(b.html, /Inputs \/ API \/ Flags/);
  assert.match(b.html, /Workflow \/ Runtime Changes/);
  assert.match(b.html, /UI Changes/);
  assert.match(b.html, /Interesting Functionality Deep Dive/);
  assert.match(b.html, /How It Works Step-by-Step/);
  assert.match(b.html, /Files Worth Showing/);
  assert.match(b.html, /Talking Points/);
  assert.match(b.html, /CacheEntry/);
});

test('Technical Change Brief offers full + talking-points + files copy targets', () => {
  const cards = renderWorkspaceCards(fullResult());
  const b = byId(cards, 'technicalChangeBrief');
  assert.ok(b.copyText, 'should have full-artifact copyText');
  assert.match(b.copyText, /# Technical Change Brief/);
  assert.ok(b.copyActions, 'should have extra copy targets');
  const labels = b.copyActions.map((a) => a.label);
  assert.ok(labels.includes('Talking points'));
  assert.ok(labels.includes('Files worth showing'));
  const talking = b.copyActions.find((a) => a.label === 'Talking points');
  assert.ok(talking);
  assert.match(talking.text, /## Talking points/);
});

test('Demo Prep Loop renders all ten sections and the manual-screenshot notice', () => {
  const cards = renderWorkspaceCards(fullResult());
  const d = byId(cards, 'demoPrepLoop');
  assert.equal(d.label, 'Demo Prep Loop');
  assert.equal(d.group, 'actions');
  assert.equal(d.state, 'generated');
  assert.match(d.html, /Loop Status/);
  assert.match(d.html, /Demo Story Proposal/);
  assert.match(d.html, /Recommended Walkthrough Order/);
  assert.match(d.html, /Code Evidence Plan/);
  assert.match(d.html, /Screenshot \/ Slide Plan/);
  assert.match(d.html, /Approval Questions/);
  assert.match(d.html, /Presentation Deck Plan/);
  assert.match(d.html, /Draft Video Script/);
  assert.match(d.html, /Final Short Pitch/);
  assert.match(d.html, /Demo Readiness Checklist/);
  // Major decisions stay pending and screenshots are planned, not captured.
  assert.match(d.html, /Pending approval/);
  assert.match(d.html, /planned, not captured/);
  // Slide content is clearly separated from what the presenter says.
  assert.match(d.html, /On slide:/);
  assert.match(d.html, /Speaker notes:/);
  assert.match(d.html, /Narration script:/);
});

test('Demo Prep Loop offers script-focused copy targets and keeps deck downloads', () => {
  const cards = renderWorkspaceCards(fullResult());
  const d = byId(cards, 'demoPrepLoop');
  assert.ok(d.copyText, 'should have full-artifact copyText');
  assert.match(d.copyText, /^# Demo Prep Loop/);
  assert.ok(d.copyActions, 'should have script-focused copy targets');
  const labels = d.copyActions.map((a) => a.label);
  // Demo Prep is a 7-minute script, not a deck generator: keep only the
  // script-focused copy targets and drop the deck/slide/screenshot copy noise.
  assert.deepEqual(labels, ['Walkthrough order', 'Narration script', 'Short pitch']);
  for (const label of ['Screenshot plan', 'Deck plan', 'Speaker notes', 'Markdown deck']) {
    assert.ok(!labels.includes(label), `deck-centric copy target should be gone: ${label}`);
  }

  // The deck stays available (not broken), just via downloads rather than copy.
  assert.ok(d.downloadActions, 'should offer the deck as downloads');
  assert.equal(d.downloadActions.length, 2);

  const md = d.downloadActions.find((a) => a.filename === 'demo-deck.md');
  assert.ok(md, 'missing markdown deck download');
  assert.equal(md.label, 'Download deck (.md)');
  assert.equal(md.mimeType, 'text/markdown');
  assert.ok(md.text, 'markdown deck download should carry text');
  assert.match(md.text, /^# Demo Deck/);
  assert.match(md.text, /## Slide 1 — The cache entry model/);
  assert.match(md.text, /Screenshot placeholder: shot-1/);

  const pptx = d.downloadActions.find((a) => a.filename === 'demo-deck.pptx');
  assert.ok(pptx, 'missing PPTX deck download');
  assert.equal(pptx.label, 'Download PPTX deck');
  assert.equal(
    pptx.mimeType,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  assert.ok(pptx.base64, 'PPTX must travel as base64');
  const bytes = Buffer.from(pptx.base64, 'base64');
  assert.equal(bytes[0], 0x50); // 'P' — a ZIP archive
  assert.equal(bytes[1], 0x4b); // 'K'
  assert.ok(bytes.toString('utf8').includes('ppt/slides/slide1.xml'));
});

test('Weekly Review renders its major sections', () => {
  const cards = renderWorkspaceCards(fullResult());
  const r = byId(cards, 'weeklyReview');
  assert.equal(r.label, 'Weekly Review');
  assert.equal(r.group, 'actions');
  assert.equal(r.state, 'generated');
  assert.match(r.html, /Weekly Review Status/);
  assert.match(r.html, /Executive Summary/);
  assert.match(r.html, /Progress Against Spec/);
  assert.match(r.html, /What Changed Technically/);
  assert.match(r.html, /Demo \/ Video Story/);
  assert.match(r.html, /Suggested Weekly Update/);
  assert.match(r.html, /Next Week Plan/);
  assert.match(r.html, /Memory Update Proposal/);
});

test('Weekly Review offers full + scoped copy targets', () => {
  const cards = renderWorkspaceCards(fullResult());
  const r = byId(cards, 'weeklyReview');
  assert.ok(r.copyText);
  assert.match(r.copyText, /# Weekly Review/);
  assert.ok(r.copyActions);
  const labels = r.copyActions.map((a) => a.label);
  for (const expected of [
    'Weekly update',
    'Demo / video story',
    'Talking points',
    'Next week plan',
    'Memory update proposal',
  ]) {
    assert.ok(labels.includes(expected), `missing copy action ${expected}`);
  }
  const update = r.copyActions.find((a) => a.label === 'Weekly update');
  assert.ok(update);
  assert.match(update.text, /## Weekly Update —/);
});

test('Feature Flow shows steps and Mermaid as code (no rendering library)', () => {
  const cards = renderWorkspaceCards(fullResult());
  const flow = byId(cards, 'flowArtifact');
  assert.match(flow.html, /step one/);
  assert.match(flow.html, /flowchart TD/);
  assert.match(flow.html, /<pre/);
});

test('Raw JSON card always present and contains the serialized result', () => {
  const cards = renderWorkspaceCards(baseResult());
  const raw = byId(cards, 'rawJson');
  assert.equal(raw.state, 'generated');
  assert.match(raw.html, /sess-1/);
});

test('html is escaped to avoid injection', () => {
  const r = baseResult();
  r.changeExplanation.changeStory = '<script>alert(1)</script>';
  const cards = renderWorkspaceCards(r);
  const html = byId(cards, 'changeExplanation').html;
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('prDescriptionToMarkdown produces a clean document', () => {
  const md = prDescriptionToMarkdown(fullResult().prDescription!);
  assert.match(md, /^# Add cache/);
  assert.match(md, /## What changed/);
  assert.match(md, /## Risks and follow-ups/);
});
