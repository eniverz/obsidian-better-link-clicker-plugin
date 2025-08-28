import { Plugin, MarkdownView, EditorPosition, TFile, Platform } from "obsidian";
import { BLCSettings, DEFAULT_SETTINGS, BLCSettingTab } from "./settings";
import { ConfirmationModal } from "./modal";

export default class BetterLinkClicker extends Plugin {
	settings: BLCSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new BLCSettingTab(this.app, this));

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

	private async handleLinkClick(evt: MouseEvent) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) {
			return;
		}

		const editor = view.editor;

		const cm = (editor as any).cm;
		if (!cm) return;

		const offset = cm.posAtCoords({ x: evt.clientX, y: evt.clientY });
		if (offset === null) {
			return;
		}

		const pos: EditorPosition = editor.offsetToPos(offset);

		const fileCache = this.app.metadataCache.getFileCache(view.file);
		if (!fileCache?.links && !fileCache?.embeds) {
			return;
		}

		for (const linkCache of [
			...(fileCache.links || []),
			...(fileCache.embeds || []),
		]) {
			const start = linkCache.position.start;
			const end = linkCache.position.end;

			const isSameLine = pos.line === start.line;
			if (
				(pos.line > start.line && pos.line < end.line) ||
				(isSameLine && pos.ch >= start.col && pos.ch <= end.col)
			) {
				this.processLink(evt, linkCache.link, view.file.path);
				return;
			}
		}

		if (!(evt.target as HTMLElement).hasClass("internal-embed")) {
			return;
		}
		const div = evt.target as HTMLDivElement;
		const src = div.getAttribute("src");
		if (src) {
			this.processLink(evt, src, view.file.path, true);
		}
	}

	private async processLink(
		evt: MouseEvent,
		link: string,
		filepath: string,
		isEmbed: boolean = false,
	) {
		const linkTarget = link.split("|")[0].split("#")[0];

		const targetFile: TFile | null =
			this.app.metadataCache.getFirstLinkpathDest(linkTarget, filepath);
		const isUnresolved = targetFile === null;
		const canJump =
			!this.settings.jumpOnlyWithModifier !==
			(Platform.isMacOS ? evt.metaKey : evt.ctrlKey);

		if (isUnresolved) {
			if (canJump) {
				if (this.settings.confirmCreateFile) {
					evt.preventDefault();
					evt.stopPropagation();

					const path = `${linkTarget}.md`;
					new ConfirmationModal(this.app, path, async () => {
						try {
							const newFile = await this.app.vault.create(
								path,
								"",
							);
							const newLeaf = this.app.workspace.getLeaf("tab");
							await newLeaf.openFile(newFile);
						} catch (error) {
							console.error(
								`Error creating or opening note at path: ${path}`,
								error,
							);
						}
					}).open();
				}
			} else {
				evt.preventDefault();
				evt.stopPropagation();

				if (isEmbed) {
					const view =
						this.app.workspace.getActiveViewOfType(MarkdownView);
					if (!view || !view.file) {
						return;
					}
					const state = view.getState();
					const liveMode = state.mode === "source" && !state.source;
					if (!liveMode) {
						return;
					}
					const embed = this.app.metadataCache
						.getFileCache(view.file)
						?.embeds?.find((e) => {
							return (
								e.link.split("|")[0].split("#")[0] ===
								linkTarget
							);
						});
					if (embed) {
						view.editor.setCursor({
							line: embed.position.start.line,
							ch: embed.position.start.col + 3,
						});
						view.editor.focus();
					}
				}
			}
			return;
		} else {
			if (!canJump) {
				evt.preventDefault();
				evt.stopPropagation();
			}
		}
	}
}
