// local/mockRunner.ts
// Run with: npx ts-node local/mockRunner.ts
import {
  AssignmentStats,
  SelectionParams,
  selectFromOrderedStreams,
  arrayToUnderKStream,
  arrayToOverKStream,
  validateParams,
  applySelectionInMemory,
} from "../convex/lib/assignmentCore";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function print(title: string, obj: any) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function runScenario(
  name: string,
  data: AssignmentStats[],
  params: SelectionParams & { expectedUsers: number }
) {
  const warnings = validateParams({
    expectedUsers: params.expectedUsers,
    minAssignmentsK: params.minAssignmentsK,
    perUserCapM: params.perUserCapM,
    sequenceSize: params.sequenceSize,
  }).map((w) => w.message);

  const under = arrayToUnderKStream(data, params.minAssignmentsK);
  const over = params.allowOverAssign
    ? arrayToOverKStream(data, params.minAssignmentsK)
    : undefined;

  const sel = await selectFromOrderedStreams(params, under, over);
  const after = applySelectionInMemory(
    clone(sel.selectedDocs),
    params.targetUserId,
    params.perUserCapM
  );

  print(name, {
    params,
    warnings,
    selectedIds: sel.selectedIds,
    overAssignedCount: sel.overAssignedCount,
    generated: sel.selectedIds.length,
    truncated: sel.selectedIds.length < params.sequenceSize,
    sampleUpdatedDoc: after[0],
  });
}

function makeDataA(): AssignmentStats[] {
  // 12 galaxies, numericId == index; varying totalAssigned and perUser
  const docs: AssignmentStats[] = [];
  for (let i = 1; i <= 12; i++) {
    docs.push({
      galaxyExternalId: `g${i}`,
      numericId: i,
      totalAssigned: 0,
      perUser: {},
    });
  }
  // Raise some totals
  docs[0].totalAssigned = 2;
  docs[1].totalAssigned = 1;
  docs[2].totalAssigned = 3;
  docs[3].totalAssigned = 3;
  docs[4].totalAssigned = 5;
  // Some already assigned to user u1 at cap=1
  docs[5].perUser = { u1: 1 };
  docs[5].totalAssigned = 1;
  return docs;
}

function makeDataAllAtOrAboveK(K: number, n = 10): AssignmentStats[] {
  const docs: AssignmentStats[] = [];
  for (let i = 1; i <= n; i++) {
    docs.push({
      galaxyExternalId: `h${i}`,
      numericId: i,
      totalAssigned: K + (i % 3), // >= K
      perUser: {},
    });
  }
  return docs;
}

function makeDataLimited(n = 5): AssignmentStats[] {
  const docs: AssignmentStats[] = [];
  for (let i = 1; i <= n; i++) {
    docs.push({
      galaxyExternalId: `s${i}`,
      numericId: i,
      totalAssigned: 0,
      perUser: {},
    });
  }
  return docs;
}

(async () => {
  const u1 = "u1";

  // Scenario 1: Plenty under-K, expect full fill from under-K only.
  await runScenario(
    "Scenario 1: Fill from under-K",
    makeDataA(),
    {
      targetUserId: u1,
      expectedUsers: 10,
      minAssignmentsK: 3,
      perUserCapM: 1,
      allowOverAssign: false,
      sequenceSize: 6,
    }
  );

//   // Scenario 2: Not enough under-K, over-assign disabled -> truncated.
//   await runScenario(
//     "Scenario 2: Truncated, over-assign disabled",
//     makeDataAllAtOrAboveK(3, 8),
//     {
//       targetUserId: u1,
//       expectedUsers: 10,
//       minAssignmentsK: 3,
//       perUserCapM: 1,
//       allowOverAssign: false,
//       sequenceSize: 5,
//     }
//   );

//   // Scenario 3: Not enough under-K, over-assign enabled -> fill from >=K.
//   await runScenario(
//     "Scenario 3: Over-assign fills remainder",
//     makeDataAllAtOrAboveK(3, 8),
//     {
//       targetUserId: u1,
//       expectedUsers: 10,
//       minAssignmentsK: 3,
//       perUserCapM: 1,
//       allowOverAssign: true,
//       sequenceSize: 5,
//     }
//   );

//   // Scenario 4: Sequence longer than available galaxies -> truncated.
//   await runScenario(
//     "Scenario 4: Oversized sequence, truncated to available",
//     makeDataLimited(7),
//     {
//       targetUserId: u1,
//       expectedUsers: 10,
//       minAssignmentsK: 2,
//       perUserCapM: 1,
//       allowOverAssign: true,
//       sequenceSize: 20,
//     }
//   );

//   // Scenario 5: Per-user cap excludes some items for this user.
//   const dataCap = makeDataA();
//   // Mark a couple at cap for u1:
//   dataCap[0].perUser = { ...(dataCap[0].perUser ?? {}), u1: 1 };
//   dataCap[1].perUser = { ...(dataCap[1].perUser ?? {}), u1: 1 };
//   await runScenario(
//     "Scenario 5: Per-user cap skips capped items",
//     dataCap,
//     {
//       targetUserId: u1,
//       expectedUsers: 10,
//       minAssignmentsK: 3,
//       perUserCapM: 1,
//       allowOverAssign: true,
//       sequenceSize: 6,
//     }
//   );

//   // Scenario 6: Infeasible K > N*M -> warning + behavior as usual.
//   await runScenario(
//     "Scenario 6: Infeasible K, expect warning",
//     makeDataA(),
//     {
//       targetUserId: u1,
//       expectedUsers: 2,
//       minAssignmentsK: 3, // K > N*M (3 > 2*1)
//       perUserCapM: 1,
//       allowOverAssign: true,
//       sequenceSize: 5,
//     }
//   );
})();