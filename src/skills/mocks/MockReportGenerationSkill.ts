import type { ChangeUnderstanding, ReportGenerationSkill } from '../../types/index.js';

/**
 * Mock generator for the V1 Code Understanding Report. Produces fake text from
 * the structured understanding. Validates the generator registration flow only.
 */
export class MockReportGenerationSkill implements ReportGenerationSkill {
  readonly name = 'mock-report-generation';
  readonly outputKey = 'codeUnderstandingReport' as const;

  async execute(input: ChangeUnderstanding): Promise<string> {
    return [
      '# Code Understanding Report (mock)',
      '',
      `Summary: ${input.requirementSummary}`,
      '',
      'What changed:',
      ...input.whatChanged.map((c) => `- ${c}`),
      '',
      `Key functionality: ${input.keyFunctionality}`,
      `Goal alignment: ${input.goalAlignment}`,
      `Main components: ${input.mainComponents.join(', ')}`,
    ].join('\n');
  }
}
