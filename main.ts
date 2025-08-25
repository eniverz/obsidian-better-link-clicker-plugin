import { Plugin } from "obsidian";
import { BLCSettings, DEFAULT_SETTINGS, MySettingTab } from "./settings";
import { ConfirmationModal } from "./modal";

export default class MyPlugin extends Plugin {
	settings: BLCSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new MySettingTab(this.app, this));

		this.registerDomEvent(
			document,
			"click",
			this.handleLinkClick.bind(this),
			{ capture: true },
		);
		console.log("Better Link Clicker loaded");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async createConfirm(evt: MouseEvent, unresolved: HTMLSpanElement) {
		evt.preventDefault();
		evt.stopPropagation();

		const path = `${unresolved.innerText.split("#")[0]}.md`;
		new ConfirmationModal(this.app, path, () => {
			this.createAndOpenNote(path);
		}).open();
	}

	private async handleLinkClick(evt: MouseEvent) {
		const linkSpan = (evt.target as HTMLElement).closest(
			"span.cm-hmd-internal-link",
		);

		if (!linkSpan) {
			return;
		}

		const unresolved = linkSpan.querySelector("span.is-unresolved");
		const isMacOS = process.platform === "darwin";
		const isModifier = isMacOS ? evt.metaKey : evt.ctrlKey;

		if (!this.settings.jumpOnlyWithModifier) {
			if (unresolved && this.settings.confirmCreateFile) {
				await this.createConfirm(evt, unresolved as HTMLSpanElement);
				return;
			}
			return;
		}

		if (unresolved && isModifier) {
			if (this.settings.confirmCreateFile) {
				await this.createConfirm(evt, unresolved as HTMLSpanElement);
			}
			return;
		}

		const targetLink = linkSpan.querySelector("a");

		if (!targetLink) {
			return;
		}

		if (!isModifier) {
			evt.preventDefault();
			evt.stopPropagation();
			return;
		}
	}

	private async createAndOpenNote(path: string) {
		try {
			const newFile = await this.app.vault.create(path, "");

			const newLeaf = this.app.workspace.getLeaf("tab");
			await newLeaf.openFile(newFile);
		} catch (error) {
			console.error(
				`Error creating or opening note at path: ${path}`,
				error,
			);
		}
	}
}
