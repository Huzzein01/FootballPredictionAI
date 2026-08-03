"use strict";

// Explicit jobs only: importing a module must never fetch data or mutate a
// database. The caller provides data collection and persistence adapters.
async function runPregameSnapshotJob({ collectSnapshots, writeSnapshots }) {
  if (typeof collectSnapshots !== "function" || typeof writeSnapshots !== "function") throw new Error("Jobs require collectSnapshots and writeSnapshots adapters");
  const snapshots = await collectSnapshots();
  await writeSnapshots(snapshots);
  return { collected: snapshots.length, writtenAt: new Date().toISOString() };
}

async function runTrainingJob({ readTrainingRows, writeModel, trainBaseballModel }) {
  if (typeof readTrainingRows !== "function" || typeof writeModel !== "function") throw new Error("Jobs require readTrainingRows and writeModel adapters");
  const model = trainBaseballModel(await readTrainingRows());
  await writeModel(model);
  return model;
}

module.exports = { runPregameSnapshotJob, runTrainingJob };
