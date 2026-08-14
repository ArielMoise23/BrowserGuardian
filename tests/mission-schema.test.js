import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateMission, MISSION_TYPES, RUNNERS } from '../src/game/missionSchema.js';
import { registry } from '../src/game/missionRegistry.js';
import { CHAPTERS } from '../src/game/chapters.js';
import { SKILL_CATEGORIES } from '../src/state/persistence.js';

const missions = registry.allMissions();
const chapterNumbers = new Set(CHAPTERS.map((c) => c.number));

describe('validateMission (unit)', () => {
  test('throws when required fields are missing', () => {
    assert.throws(() => validateMission({ id: 'x' }), /missing required string field/);
  });

  test('accepts a minimal, fully-populated mission', () => {
    const minimal = {
      id: 'x', chapter: 1, title: 't', type: 'code-repair', difficulty: 'foundational',
      xp: 10, estimatedMinutes: 5, runner: 'none', submissionMode: 'code',
      objective: 'o', prerequisites: 'p', scenario: 's', task: 't2', expectedBehavior: 'e',
      initialCode: '', solution: 'sol', explanation: 'exp',
      securityImpact: 'si', runtimeExplanation: 're', sourceDefenseConnection: 'sdc', followUp: 'fu',
      hints: ['a', 'b', 'c'], commonWrongAnswers: [{ description: 'd', why: 'w' }],
      skillTags: ['fundamentals'], validate: () => ({ passed: true, score: {} }),
    };
    assert.doesNotThrow(() => validateMission(minimal));
  });
});

describe('mission registry: every real mission', () => {
  test('has at least 8 missions', () => {
    assert.ok(missions.length >= 8, `expected >= 8 missions, found ${missions.length}`);
  });

  test('all mission ids are unique', () => {
    const ids = missions.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  for (const mission of missions) {
    describe(`mission "${mission.id}"`, () => {
      test('passes schema validation', () => {
        assert.doesNotThrow(() => validateMission(mission));
      });

      test('has a valid type and runner', () => {
        assert.ok(MISSION_TYPES.includes(mission.type));
        assert.ok(RUNNERS.includes(mission.runner));
      });

      test('belongs to a real chapter', () => {
        assert.ok(chapterNumbers.has(mission.chapter), `chapter ${mission.chapter} is not in CHAPTERS`);
      });

      test('has at least 3 non-empty hints, increasing in specificity (non-empty strings)', () => {
        assert.ok(mission.hints.length >= 3);
        mission.hints.forEach((h) => assert.ok(h.trim().length > 10, 'hint should be a real sentence, not a placeholder'));
      });

      test('every skillTag is a real skill category', () => {
        mission.skillTags.forEach((tag) => assert.ok(SKILL_CATEGORIES.includes(tag), `unknown skill tag "${tag}"`));
      });

      test('commonWrongAnswers entries have both a description and a why', () => {
        mission.commonWrongAnswers.forEach((w) => {
          assert.ok(w.description && w.description.length > 5);
          assert.ok(w.why && w.why.length > 5);
        });
      });

      test('iframe-runner missions ship a siteSnapshot', () => {
        if (mission.runner === 'iframe') assert.ok(typeof mission.siteSnapshot === 'string' && mission.siteSnapshot.length > 0);
      });

      test('answer-mode missions have a well-formed answerSchema', () => {
        if (mission.submissionMode !== 'answer') return;
        assert.ok(Array.isArray(mission.answerSchema) && mission.answerSchema.length > 0);
        for (const q of mission.answerSchema) {
          assert.ok(q.id && q.prompt && q.type);
          assert.ok(['boolean', 'select', 'multiselect', 'text'].includes(q.type));
          if (q.type === 'select' || q.type === 'multiselect') {
            assert.ok(Array.isArray(q.options) && q.options.length > 1);
          }
        }
      });

      test('xp and estimatedMinutes are positive', () => {
        assert.ok(mission.xp > 0);
        assert.ok(mission.estimatedMinutes > 0);
      });
    });
  }
});
