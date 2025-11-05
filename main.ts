import {
	Plugin,
	MarkdownView,
	EditorPosition,
	TFile,
	Platform,
	Editor,
	Vault,
} from "obsidian";
import { BLCSettings, DEFAULT_SETTINGS, BLCSettingTab } from "./settings";
import { ConfirmationModal } from "./modal";

type PosAtCoordsFn = (
	coords: { x: number; y: number },
	bias?: number,
) => number | null;

type EditorWithPosAtCoords = Editor & {
	cm?: {
		posAtCoords: PosAtCoordsFn;
	};
};

const hasPosAtCoords = (
	editor: Editor,
): editor is EditorWithPosAtCoords => {
	const cm = (editor as EditorWithPosAtCoords).cm;
	return typeof cm?.posAtCoords === "function";
};

type VaultWithConfig = Vault & {
	config: {
		newFileLocation?: string;
		newFileFolderPath?: string;
	};
};

const hasVaultConfig = (vault: Vault): vault is VaultWithConfig => {
	const config = (vault as VaultWithConfig).config;
	return typeof config === "object" && config !== null;
};

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
		console.debug("Better Link Clicker loaded");
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

		if (!hasPosAtCoords(editor)) {
			return;
		}

		const cm = editor.cm;
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
				await this.processLink(evt, linkCache.link, view.file.path);
				return;
			}
		}

		if (!(evt.target as HTMLElement).hasClass("internal-embed")) {
			return;
		}
		const div = evt.target as HTMLDivElement;
		const src = div.getAttribute("src");
		if (src) {
			await this.processLink(evt, src, view.file.path, true);
		}
	}

	private async processLink(
		evt: MouseEvent,
		link: string,
		filepath: string,
		isEmbed: boolean = false,
	) {
		evt.preventDefault();
		evt.stopPropagation();
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
					let newFileLocation = "";
					const vault = this.app.vault;
					if (!hasVaultConfig(vault)) {
						return;
					}
					const config = vault.config;
					switch (config.newFileLocation) {
						case "root":
							newFileLocation = "";
							break;
						case "current":
							newFileLocation = filepath.split("/").slice(0, -1).join("/") + "/";
							break;
						case "folder":
							newFileLocation = config.newFileFolderPath + "/";
							break;
						default:
							break;
					}
					const path = `${newFileLocation}${linkTarget}.md`;
					new ConfirmationModal(this.app, path, () => {
						this.app.vault.create(
							path,
							"",
						).then(async (newFile) => {
							const newLeaf = this.app.workspace.getLeaf("tab");
							await newLeaf.openFile(newFile);
						}).catch((error) => {
							console.error(
								`Error creating or opening note at path: ${path}`,
								error,
							);
						});
					}).open();
				}
			} else {
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
		} else {
			if (canJump) {
				await this.app.workspace.openLinkText(link, filepath, this.settings.openAtNewTab);
			}
		}
	}
}
