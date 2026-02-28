import { getGameData } from "@warprotocol/game-data";
import { createServiceRuntime, parsePort, startRuntime } from "@warprotocol/service-runtime";

const balanceVersion = process.env.GAME_DATA_BALANCE_VERSION ?? "0.1.0-alpha";

async function bootstrap(): Promise<void> {
  const { app } = await createServiceRuntime({ serviceName: "game-data-service" });

  app.get("/game-data", async (request) => {
    const query = request.query as { balance_version?: string };
    return getGameData(query.balance_version ?? balanceVersion);
  });

  await startRuntime(app, parsePort("GAME_DATA_PORT", 4001));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
