#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { internal } from "../convex/_generated/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {
    env: ".env.local",
    mode: "auto",
    expectedUsers: 10,
    targetClassificationCount: 3,
    minAssignmentsPerEntry: 3,
    maxAssignmentsPerUserPerEntry: 1,
    sequenceSize: 3,
    additionalSize: 3,
    allowOverAssign: false,
    listOnly: false,
    userId: undefined,
    out: undefined,
    paperFilter: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--mode":
        options.mode = next;
        index += 1;
        break;
      case "--env":
        options.env = next;
        index += 1;
        break;
      case "--list":
        options.listOnly = true;
        break;
      case "--user":
        options.userId = next;
        index += 1;
        break;
      case "--expectedUsers":
        options.expectedUsers = Number(next);
        index += 1;
        break;
      case "--targetClassificationCount":
        options.targetClassificationCount = Number(next);
        index += 1;
        break;
      case "--minAssignmentsPerEntry":
        options.minAssignmentsPerEntry = Number(next);
        index += 1;
        break;
      case "--maxAssignmentsPerUserPerEntry":
        options.maxAssignmentsPerUserPerEntry = Number(next);
        index += 1;
        break;
      case "--sequenceSize":
        options.sequenceSize = Number(next);
        index += 1;
        break;
      case "--additionalSize":
        options.additionalSize = Number(next);
        index += 1;
        break;
      case "--allowOverAssign":
        options.allowOverAssign = true;
        break;
      case "--paperFilter":
        options.paperFilter = next
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);
        index += 1;
        break;
      case "--out":
        options.out = next;
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function loadEnv(envPath) {
  const resolvedPath = path.isAbsolute(envPath) ? envPath : path.resolve(repoRoot, envPath);
  dotenv.config({ path: resolvedPath });
}

function buildClient() {
  const deploymentUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  const adminKey = process.env.CONVEX_DEPLOY_KEY;

  if (!deploymentUrl) {
    throw new Error("Missing CONVEX_URL or VITE_CONVEX_URL in the selected env file.");
  }

  if (!adminKey) {
    throw new Error("Missing CONVEX_DEPLOY_KEY in the selected env file.");
  }

  const client = new ConvexHttpClient(deploymentUrl);
  client.setAdminAuth(adminKey);
  return client;
}

function printTargets(targets) {
  console.log("Users without sequences:");
  if (targets.usersWithoutSequences.length === 0) {
    console.log("  (none)");
  } else {
    for (const entry of targets.usersWithoutSequences) {
      console.log(
        `  ${entry.userId} | ${entry.name ?? "(no name)"} | ${entry.email ?? "(no email)"} | role=${entry.role}`
      );
    }
  }

  console.log("\nUsers with sequences:");
  if (targets.usersWithSequences.length === 0) {
    console.log("  (none)");
  } else {
    for (const entry of targets.usersWithSequences) {
      console.log(
        `  ${entry.userId} | ${entry.name ?? "(no name)"} | ${entry.email ?? "(no email)"} | role=${entry.role} | sequenceSize=${entry.sequenceSize} | classified=${entry.numClassified}`
      );
    }
  }
}

function printTraceSummary(trace) {
  console.log("\nTrace summary:");
  console.log(`  mode: ${trace.mode}`);
  console.log(`  targetUserId: ${trace.targetUserId}`);
  console.log(`  requested: ${trace.plan.requested}`);
  console.log(`  generated: ${trace.plan.generated}`);
  console.log(`  sequence size before: ${trace.before?.sequenceSize ?? 0}`);
  console.log(`  sequence size after: ${trace.after?.sequenceSize ?? 0}`);

  if (trace.plan.warnings?.length) {
    console.log("  warnings:");
    for (const warning of trace.plan.warnings) {
      console.log(`    - ${warning}`);
    }
  }

  if (trace.plan.errors?.length) {
    console.log("  errors:");
    for (const error of trace.plan.errors) {
      console.log(`    - ${error}`);
    }
  }

  console.log("\nChanged galaxies:");
  for (const galaxy of trace.changedGalaxies) {
    console.log(
      `  ${galaxy.galaxyExternalId} | totalAssigned ${galaxy.before.totalAssigned} -> ${galaxy.after.totalAssigned} | targetUserAssigned ${galaxy.before.targetUserAssigned} -> ${galaxy.after.targetUserAssigned} | inSequence ${galaxy.before.inTargetSequence} -> ${galaxy.after.inTargetSequence}`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnv(options.env);
  const client = buildClient();

  const targets = await client.action(internal.classificationBasedAssignment.listAssignmentTraceTargetsDev, {});

  if (options.listOnly) {
    printTargets(targets);
    return;
  }

  const selectedMode =
    options.mode === "auto"
      ? targets.usersWithoutSequences.length > 0
        ? "generate"
        : "extend"
      : options.mode;

  let chosenUserId = options.userId;
  if (!chosenUserId && selectedMode === "generate") {
    chosenUserId = targets.usersWithoutSequences[0]?.userId;
  }
  if (!chosenUserId && selectedMode === "extend") {
    chosenUserId = targets.usersWithSequences
      .filter((entry) => entry.sequenceSize < 8192)
      .sort((left, right) => left.sequenceSize - right.sequenceSize)[0]?.userId;
  }

  if (!chosenUserId) {
    throw new Error(`No suitable user found for mode=${selectedMode}. Run with --list to inspect current targets.`);
  }

  const trace =
    selectedMode === "generate"
      ? await client.action(internal.classificationBasedAssignment.traceGenerateClassificationBasedAssignmentDev, {
          targetUserId: chosenUserId,
          expectedUsers: options.expectedUsers,
          targetClassificationCount: options.targetClassificationCount,
          minAssignmentsPerEntry: options.minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry: options.maxAssignmentsPerUserPerEntry,
          sequenceSize: options.sequenceSize,
          allowOverAssign: options.allowOverAssign,
          paperFilter: options.paperFilter,
        })
      : await client.action(internal.classificationBasedAssignment.traceExtendClassificationBasedAssignmentDev, {
          targetUserId: chosenUserId,
          expectedUsers: options.expectedUsers,
          targetClassificationCount: options.targetClassificationCount,
          minAssignmentsPerEntry: options.minAssignmentsPerEntry,
          maxAssignmentsPerUserPerEntry: options.maxAssignmentsPerUserPerEntry,
          additionalSize: options.additionalSize,
          allowOverAssign: options.allowOverAssign,
          paperFilter: options.paperFilter,
        });

  printTraceSummary(trace);

  const serialized = JSON.stringify(trace, null, 2);
  if (options.out) {
    const outPath = path.isAbsolute(options.out) ? options.out : path.resolve(repoRoot, options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, serialized);
    console.log(`\nSaved full trace to ${outPath}`);
  } else {
    console.log("\nFull trace JSON:");
    console.log(serialized);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});