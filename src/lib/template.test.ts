import { describe, expect, it } from 'vitest';
import { describeTemplateHabit, normalizeTemplate, summarizeTemplate } from './template';

describe('normalizeTemplate', () => {
  it('keeps valid habits and cleans their fields', () => {
    expect(normalizeTemplate([
      { name: '  Drink 3L water ', type: 'daily', target: 4, steps: [] },
      { name: 'Run', type: 'weekly', target: 9, steps: [' warm up ', '', 'run'] },
    ])).toEqual([
      { name: 'Drink 3L water', type: 'daily', target: 1, steps: [] },
      { name: 'Run', type: 'weekly', target: 7, steps: ['warm up', 'run'] },
    ]);
  });

  it('drops malformed entries instead of failing', () => {
    expect(normalizeTemplate([null, 3, { type: 'daily' }, { name: '' }, { name: 'Read', steps: 'nope' }]))
      .toEqual([{ name: 'Read', type: 'daily', target: 1, steps: [] }]);
    expect(normalizeTemplate('not a list')).toEqual([]);
  });
});

describe('summaries', () => {
  it('describes each habit and the whole list', () => {
    const list = normalizeTemplate([
      { name: 'Water', type: 'daily' },
      { name: 'Morning', type: 'daily', steps: ['bed', 'stretch'] },
      { name: 'Run', type: 'weekly', target: 3 },
    ]);
    expect(list.map(describeTemplateHabit)).toEqual(['every day', 'every day · 2 steps', '3× a week']);
    expect(summarizeTemplate(list)).toBe('2 daily habits and 1 weekly target');
    expect(summarizeTemplate([])).toBe('no habits yet');
  });
});
