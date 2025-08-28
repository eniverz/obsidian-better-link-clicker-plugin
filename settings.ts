import { App, PluginSettingTab, Setting } from "obsidian";
import BetterLinkClicker from "./main";

export interface BLCSettings {
	jumpOnlyWithModifier: boolean;
	confirmCreateFile: boolean;
	openAtNewTab: boolean;
}
export const DEFAULT_SETTINGS: BLCSettings = {
	jumpOnlyWithModifier: true,
	confirmCreateFile: true,
	openAtNewTab: false,
};

export class BLCSettingTab extends PluginSettingTab {
	plugin: BetterLinkClicker;

	constructor(app: App, plugin: BetterLinkClicker) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Link Click Behavior Settings" });

		new Setting(containerEl)
			.setName("Jump only with modifier")
			.setDesc(
				"If enabled, you need to hold Ctrl (or Cmd on Mac) while clicking a link to jump to it. Otherwise, clicking a link will open it in a new pane.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.jumpOnlyWithModifier)
					.onChange(async (value) => {
						this.plugin.settings.jumpOnlyWithModifier = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Confirm file creation")
			.setDesc(
				"If enabled, a dialog will pop up to confirm creating a new note when you Ctrl/Cmd-click a link to a non-existent note.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmCreateFile)
					.onChange(async (value) => {
						this.plugin.settings.confirmCreateFile = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Open link at new tab")
			.setDesc(
				"If enabled, the note will open in a new tab instead of the current one when you Ctrl/Cmd-click a link.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openAtNewTab)
					.onChange(async (value) => {
						this.plugin.settings.openAtNewTab = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
