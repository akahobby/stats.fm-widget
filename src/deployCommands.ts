import { Client, REST, Routes } from "discord.js";
import { config } from "./config";
import { slashCommands } from "./commands";
import { logger } from "./utils";

export async function deploySlashCommands(client: Client): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discordBotToken);
  const appId = config.discordAppId;

  if (config.commandsGlobal) {
    logger.info("Deploying global commands", {
      count: slashCommands.length,
    });

    await rest.put(Routes.applicationCommands(appId), { body: slashCommands });

    logger.info("Global slash commands registered", {
      commands: slashCommands.map((command) => command.name),
    });
    return;
  }

  const guildId = resolveGuildId(client);
  if (!guildId) {
    logger.warn(
      "No guild for slash commands. Set COMMANDS_GUILD_ID or invite the bot to a server.",
    );
    return;
  }

  logger.info("Deploying guild commands", {
    guildId,
    count: slashCommands.length,
  });

  await rest.put(Routes.applicationGuildCommands(appId, guildId), {
    body: slashCommands,
  });

  logger.info("Guild slash commands registered", {
    guildId,
    commands: slashCommands.map((command) => command.name),
  });
}

function resolveGuildId(client: Client): string | undefined {
  if (config.commandsGuildId) return config.commandsGuildId;

  const first = client.guilds.cache.first();
  if (first) {
    logger.info("COMMANDS_GUILD_ID not set; using first mutual guild", {
      guildId: first.id,
      name: first.name,
    });
    return first.id;
  }

  return undefined;
}
