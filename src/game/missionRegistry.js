import { validateMission } from './missionSchema.js';

import closureIncident from '../missions/chapter1/closure-incident.js';
import microtaskMayhem from '../missions/chapter2/microtask-mayhem.js';
import disappearingClick from '../missions/chapter3/disappearing-click.js';
import thirdPartyCheckout from '../missions/chapter6/third-party-checkout.js';
import silentSkimmer from '../missions/chapter7/silent-skimmer.js';
import wrapFetch from '../missions/chapter8/wrap-fetch-without-breaking-it.js';
import theFalsePositive from '../missions/chapter8/the-false-positive.js';
import securityAt200ms from '../missions/chapter10/security-at-200ms.js';

const MISSIONS = [
  closureIncident,
  microtaskMayhem,
  disappearingClick,
  thirdPartyCheckout,
  silentSkimmer,
  wrapFetch,
  theFalsePositive,
  securityAt200ms,
];

for (const mission of MISSIONS) validateMission(mission);

const byId = new Map(MISSIONS.map((m) => [m.id, m]));

export function createRegistry() {
  return {
    allMissions: () => MISSIONS,
    missionsByChapter: (chapterNumber) => MISSIONS.filter((m) => m.chapter === chapterNumber),
    getMission: (id) => byId.get(id),
    chaptersWithMissions: () => [...new Set(MISSIONS.map((m) => m.chapter))],
  };
}

export const registry = createRegistry();
