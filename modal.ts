import { App, Modal, Setting } from "obsidian";

export class ConfirmationModal extends Modal {
	fileName: string;
	onSubmit: () => void;

	constructor(app: App, fileName: string, onSubmit: () => void) {
		super(app);
		this.fileName = fileName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "Create new note?" });

		contentEl.createEl("p", {
			text: `The note "${this.fileName}" does not exist. Would you like to create it?`,
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Create")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit();
					}),
			);
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}
