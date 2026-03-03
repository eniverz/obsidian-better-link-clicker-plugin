import {
	Plugin,
	MarkdownView,
	EditorPosition,
	TFile,
	Platform,
	Keymap,
	Editor,
	Vault,
	PaneType,
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

type CachePos = {
	line: number;
	col: number;
};

type ClickedLinkCache = {
	link: string;
	original: string;
	position: {
		start: CachePos;
		end: CachePos;
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

		const linkCaches: ClickedLinkCache[] = [
			...((fileCache.links || []) as ClickedLinkCache[]),
			...((fileCache.embeds || []) as ClickedLinkCache[]),
		];

		for (const linkCache of linkCaches) {
			const start = linkCache.position.start;
			const end = linkCache.position.end;

			const isSameLine = pos.line === start.line;
			if (
				(pos.line > start.line && pos.line < end.line) ||
				(isSameLine && pos.ch >= start.col && pos.ch <= end.col)
			) {
				const state = view.getState();
				const isLivePreview = state.mode === "source" && !state.source;
				await this.processLink(
					evt,
					linkCache,
					view.file.path,
					view.editor,
					isLivePreview,
				);
				return;
			}
		}
	}

	private async processLink(
		evt: MouseEvent,
		clickedLink: ClickedLinkCache,
		filepath: string,
		editor: Editor,
		isLivePreview: boolean,
	) {
		const modEvent = Keymap.isModEvent(evt);
		const paneType =
			typeof modEvent === "string" ? (modEvent as PaneType) : undefined;
		const openTarget = paneType ?? this.settings.openAtNewTab;
		const forceJumpForWindow = paneType === "window";
		const canJump =
			forceJumpForWindow ||
			!this.settings.jumpOnlyWithModifier !==
			(Platform.isMacOS ? evt.metaKey : evt.ctrlKey);

		evt.preventDefault();
		evt.stopPropagation();

		if (isLivePreview && this.isCursorInsideLink(editor, clickedLink)) {
			// this.moveCursorToLinkStart(editor, clickedLink);
			return;
		}

		if (!canJump) {
			this.moveCursorToLinkStart(editor, clickedLink);
			return;
		}

		const linkTarget = clickedLink.link.split("|")[0].split("#")[0];

		const targetFile: TFile | null =
			this.app.metadataCache.getFirstLinkpathDest(linkTarget, filepath);

		if (targetFile) {
			await this.app.workspace.openLinkText(
				clickedLink.link,
				filepath,
				openTarget,
			);
			return;
		}

		const createPath = this.buildNewFilePath(filepath, linkTarget);
		if (!createPath) {
			return;
		}

		if (this.settings.confirmCreateFile) {
			new ConfirmationModal(this.app, createPath, () => {
				void this.createAndOpenFile(createPath, paneType);
			}).open();
			return;
		}

		await this.createAndOpenFile(createPath, paneType);
	}

	private buildNewFilePath(filepath: string, linkTarget: string): string | null {
		const vault = this.app.vault;
		if (!hasVaultConfig(vault)) {
			return null;
		}

		let newFileLocation = "";
		const config = vault.config;
		switch (config.newFileLocation) {
			case "root":
				newFileLocation = "";
				break;
			case "current":
				newFileLocation = filepath.split("/").slice(0, -1).join("/") + "/";
				break;
			case "folder":
				newFileLocation = config.newFileFolderPath
					? `${config.newFileFolderPath}/`
					: "";
				break;
			default:
				break;
		}

		return `${newFileLocation}${linkTarget}.md`;
	}

	private async createAndOpenFile(path: string, paneType?: PaneType) {
		const leafTypeForNewFile = paneType ?? "tab";
		try {
			const newFile = await this.app.vault.create(path, "");
			const newLeaf = this.app.workspace.getLeaf(leafTypeForNewFile);
			await newLeaf.openFile(newFile);
		} catch (error) {
			console.error(`Error creating or opening note at path: ${path}`, error);
		}
	}

	private isCursorInsideLink(editor: Editor, clickedLink: ClickedLinkCache): boolean {
		const cursor = editor.getCursor();
		const start = clickedLink.position.start;
		const end = clickedLink.position.end;

		if (cursor.line < start.line || cursor.line > end.line) {
			console.log("Cursor is outside the link (line mismatch)")
			return false;
		}

		if (start.line === end.line) {
			let isInside = cursor.line === start.line && cursor.ch >= start.col && cursor.ch <= end.col;
			console.log("Cursor is inside the link (same line):", isInside);
			return isInside;
		}

		if (cursor.line === start.line) {
			let isInside = cursor.ch >= start.col;
			console.log("Cursor is inside the link (start line):", isInside);
			return isInside;
		}

		if (cursor.line === end.line) {
			let isInside = cursor.ch <= end.col;
			console.log("Cursor is inside the link (end line):", isInside);
			return isInside;
		}

		return true;
	}

	private moveCursorToLinkStart(editor: Editor, clickedLink: ClickedLinkCache) {
		const cursorColOffset = clickedLink.original.startsWith("![[") ? 3 : 2;
		editor.setCursor({
			line: clickedLink.position.start.line,
			ch: clickedLink.position.start.col + cursorColOffset,
		});
		editor.focus();
	}
}
