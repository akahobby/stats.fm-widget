import {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from "discord.js";
import { formatLastUpdate, getRuntimeStatus } from "./runtimeStatus";
import { logger } from "./utils";

export const slashCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check that the bot is online")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show bot, widget, and stats.fm status")
    .toJSON(),
];

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const name = interaction.commandName;

  try {
    if (name === "ping") {
      await interaction.reply({
        content: "stats.fm widget is online",
        ephemeral: true,
      });
      return;
    }

    if (name === "status") {
      const status = getRuntimeStatus();
      const body = [
        "stats.fm widget",
        "",
        `Bot: ${status.botOnline ? "Online" : "Offline"}`,
        `Widget: ${status.widgetActive ? "Active" : "Inactive"}`,
        `stats.fm: ${status.statsfmConnected ? "Connected" : "Disconnected"}`,
        `Last Update: ${formatLastUpdate(status.lastWidgetUpdateAt)}`,
      ].join("\n");

      await interaction.reply({ content: body, ephemeral: true });
      return;
    }

    await interaction.reply({
      content: "Unknown command.",
      ephemeral: true,
    });
  } catch (error) {
    logger.error("Slash command failed", {
      command: name,
      message: error instanceof Error ? error.message : String(error),
    });

    const payload = {
      content: "Command failed.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => undefined);
    } else {
      await interaction.reply(payload).catch(() => undefined);
    }
  }
}
