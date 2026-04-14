import cron from "node-cron";
import { runAgentWorkflow } from "../orchestrator/agentOrchestrator";
import { User } from "../models/User";

async function runForAllUsers() {
  const users = await User.find({}).select("email name").lean();

  for (const user of users) {
    try {
      await runAgentWorkflow({
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error(`Agent workflow failed for ${user.email}`, error);
    }
  }
}

export function startAgentRunner() {
  cron.schedule("0 * * * *", () => {
    void runForAllUsers();
  });

  console.log("Agent runner scheduled: every hour");
}

export async function triggerAgentRunnerNow() {
  await runForAllUsers();
}
