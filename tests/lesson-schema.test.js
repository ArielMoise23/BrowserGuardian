import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateLesson, validateLab, LAB_TYPES, MENTAL_MODEL_LABELS } from '../src/game/lessonSchema.js';
import { lessonRegistry } from '../src/game/lessonRegistry.js';
import { MODULES, validateModules } from '../src/game/modules.js';
import { registry as missionRegistry } from '../src/game/missionRegistry.js';
import { SKILL_CATEGORIES } from '../src/state/persistence.js';

const lessons = lessonRegistry.allLessons();
const moduleIds = new Set(MODULES.map((m) => m.id));
const missionIds = new Set(missionRegistry.allMissions().map((m) => m.id));

function minimalLesson(overrides = {}) {
  return {
    id: 'x', moduleId: 'scope-execution-closures', title: 't', estimatedMinutes: 10, difficulty: 'foundational',
    prerequisites: [], relatedMissionIds: [], skillTags: ['fundamentals'],
    whyItMatters: { development: 'd', security: 's', sourceDefense: 'sd' },
    mentalModel: { coreIdea: 'ci', explanation: 'e', snippet: 'const x = 1;', distinctions: [{ label: 'ECMAScript spec', text: 't1' }, { label: 'Simplified model', text: 't2' }] },
    nuance: 'n',
    securityAngle: 'sa',
    runtimeSecurityAngle: 'rsa',
    keyTakeaways: ['k1', 'k2', 'k3'],
    example: { runner: 'worker', code: 'console.log(1);', predictPrompt: 'p' },
    labs: [minimalLab('a'), minimalLab('b'), minimalLab('c')],
    knowledgeCheck: [
      { id: 'q1', question: 'q', modelAnswer: 'a', skillTag: 'fundamentals' },
      { id: 'q2', question: 'q', modelAnswer: 'a', skillTag: 'fundamentals' },
    ],
    interviewQuestions: ['q1', 'q2', 'q3'],
    ...overrides,
  };
}

function minimalLab(id) {
  return {
    id, title: 't', type: 'predict', instructions: 'i', runner: 'worker', submissionMode: 'code',
    initialCode: '', validate: () => ({ passed: true, score: {} }),
    hints: ['h1', 'h2'], solution: 's', explanation: 'e',
  };
}

describe('validateLesson (unit)', () => {
  test('accepts a minimal, fully-populated lesson', () => {
    assert.doesNotThrow(() => validateLesson(minimalLesson()));
  });

  test('throws when whyItMatters is incomplete', () => {
    const bad = minimalLesson({ whyItMatters: { development: 'd' } });
    assert.throws(() => validateLesson(bad), /whyItMatters/);
  });

  test('throws with fewer than 2 mentalModel distinctions', () => {
    const bad = minimalLesson({ mentalModel: { explanation: 'e', distinctions: [{ label: 'ECMAScript spec', text: 't' }] } });
    assert.throws(() => validateLesson(bad), /distinctions/);
  });

  test('throws with an invalid distinction label', () => {
    const bad = minimalLesson({ mentalModel: { explanation: 'e', distinctions: [{ label: 'Not a real label', text: 't' }, { label: 'ECMAScript spec', text: 't' }] } });
    assert.throws(() => validateLesson(bad), /invalid label/);
  });

  test('throws with fewer than 3 labs', () => {
    const bad = minimalLesson({ labs: [minimalLab('a'), minimalLab('b')] });
    assert.throws(() => validateLesson(bad), /at least 3 labs/);
  });

  test('throws with knowledgeCheck outside the 2-4 range', () => {
    const bad = minimalLesson({ knowledgeCheck: [{ id: 'q1', question: 'q', modelAnswer: 'a', skillTag: 'fundamentals' }] });
    assert.throws(() => validateLesson(bad), /knowledgeCheck/);
  });

  test('throws unless there are exactly 3 interviewQuestions', () => {
    const bad = minimalLesson({ interviewQuestions: ['only one'] });
    assert.throws(() => validateLesson(bad), /interviewQuestions/);
  });

  test('throws when an iframe-runner example has no siteSnapshot', () => {
    const bad = minimalLesson({ example: { runner: 'iframe', code: 'x', predictPrompt: 'p' } });
    assert.throws(() => validateLesson(bad), /siteSnapshot/);
  });

  test('throws when mentalModel.coreIdea is missing', () => {
    const bad = minimalLesson({ mentalModel: { explanation: 'e', snippet: 's', distinctions: minimalLesson().mentalModel.distinctions } });
    assert.throws(() => validateLesson(bad), /coreIdea/);
  });

  test('throws when mentalModel.snippet is missing', () => {
    const bad = minimalLesson({ mentalModel: { coreIdea: 'ci', explanation: 'e', distinctions: minimalLesson().mentalModel.distinctions } });
    assert.throws(() => validateLesson(bad), /snippet/);
  });

  test('throws when nuance is missing', () => {
    const bad = minimalLesson({ nuance: '' });
    assert.throws(() => validateLesson(bad), /nuance/);
  });

  test('throws when securityAngle is missing', () => {
    const bad = minimalLesson({ securityAngle: '' });
    assert.throws(() => validateLesson(bad), /securityAngle/);
  });

  test('throws when runtimeSecurityAngle is missing', () => {
    const bad = minimalLesson({ runtimeSecurityAngle: '' });
    assert.throws(() => validateLesson(bad), /runtimeSecurityAngle/);
  });

  test('throws with fewer than 3 keyTakeaways', () => {
    const bad = minimalLesson({ keyTakeaways: ['only one'] });
    assert.throws(() => validateLesson(bad), /keyTakeaways/);
  });

  test('throws with more than 5 keyTakeaways', () => {
    const bad = minimalLesson({ keyTakeaways: ['1', '2', '3', '4', '5', '6'] });
    assert.throws(() => validateLesson(bad), /keyTakeaways/);
  });
});

describe('validateLab (unit)', () => {
  test('returns no errors for a minimal, valid lab', () => {
    assert.deepEqual(validateLab(minimalLab('a'), 'lesson "x"'), []);
  });

  test('flags an invalid lab type', () => {
    const errors = validateLab({ ...minimalLab('a'), type: 'not-a-type' }, 'lesson "x"');
    assert.ok(errors.some((e) => e.includes('invalid type')));
  });

  test('flags fewer than 2 hints', () => {
    const errors = validateLab({ ...minimalLab('a'), hints: ['only one'] }, 'lesson "x"');
    assert.ok(errors.some((e) => e.includes('2 progressive hints')));
  });

  test('flags an iframe-runner lab with no siteSnapshot', () => {
    const errors = validateLab({ ...minimalLab('a'), runner: 'iframe' }, 'lesson "x"');
    assert.ok(errors.some((e) => e.includes('siteSnapshot')));
  });
});

describe('validateModules (unit)', () => {
  test('accepts a minimal, valid module list', () => {
    assert.doesNotThrow(() => validateModules([{ number: 1, id: 'a', title: 't', summary: 's' }]));
  });

  test('throws on a duplicate module id', () => {
    const dup = [{ number: 1, id: 'a', title: 't1', summary: 's1' }, { number: 2, id: 'a', title: 't2', summary: 's2' }];
    assert.throws(() => validateModules(dup), /duplicate module id/);
  });

  test('throws when a required field is missing', () => {
    assert.throws(() => validateModules([{ number: 1, id: 'a', title: 't' }]), /summary/);
  });

  test('the real MODULES list is internally valid', () => {
    assert.doesNotThrow(() => validateModules(MODULES));
  });

  test('every real module id is unique', () => {
    const ids = MODULES.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('lesson registry: every real lesson', () => {
  test('has at least 10 lessons (the first milestone)', () => {
    assert.ok(lessons.length >= 10, `expected >= 10 lessons, found ${lessons.length}`);
  });

  test('all lesson ids are unique', () => {
    const ids = lessons.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('all lab ids are unique WITHIN their own lesson', () => {
    for (const lesson of lessons) {
      const ids = lesson.labs.map((l) => l.id);
      assert.equal(new Set(ids).size, ids.length, `duplicate lab id in lesson "${lesson.id}"`);
    }
  });

  for (const lesson of lessons) {
    describe(`lesson "${lesson.id}"`, () => {
      test('passes schema validation', () => {
        assert.doesNotThrow(() => validateLesson(lesson));
      });

      test('belongs to a real module', () => {
        assert.ok(moduleIds.has(lesson.moduleId), `moduleId "${lesson.moduleId}" is not in MODULES`);
      });

      test('every skillTag is a real skill category', () => {
        lesson.skillTags.forEach((tag) => assert.ok(SKILL_CATEGORIES.includes(tag), `unknown skill tag "${tag}"`));
      });

      test('every prerequisite references a real lesson id', () => {
        lesson.prerequisites.forEach((id) => assert.ok(lessons.some((l) => l.id === id), `prerequisite "${id}" does not exist`));
      });

      test('every relatedMissionId references a real mission', () => {
        lesson.relatedMissionIds.forEach((id) => assert.ok(missionIds.has(id), `related mission "${id}" does not exist`));
      });

      test('has at least 3 labs, each with a valid type', () => {
        assert.ok(lesson.labs.length >= 3);
        lesson.labs.forEach((lab) => assert.ok(LAB_TYPES.includes(lab.type)));
      });

      test('mentalModel distinctions use only the four defined labels', () => {
        lesson.mentalModel.distinctions.forEach((d) => assert.ok(MENTAL_MODEL_LABELS.includes(d.label)));
      });

      test('knowledgeCheck questions reference real skill categories', () => {
        lesson.knowledgeCheck.forEach((q) => assert.ok(SKILL_CATEGORIES.includes(q.skillTag), `unknown skillTag "${q.skillTag}" on ${q.id}`));
      });
    });
  }
});
