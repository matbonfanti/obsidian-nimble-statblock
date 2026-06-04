const { Plugin } = require("obsidian");

module.exports = class NimbleStatblockPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor("nimble-statblock", async (source, el) => {
			el.empty();

			try {
				const monsterId = source.trim();

				if (!monsterId) {
					throw new Error("Missing monster id.");
				}

				const jsonUrl = `https://nimble.monster/monsters/${monsterId}/nimbrew.json`;
				const nexusUrl = `https://nimble.nexus/monsters/${monsterId}`;

				const response = await fetch(jsonUrl);

				if (!response.ok) {
					throw new Error(`Could not fetch monster JSON: ${response.status}`);
				}

				const data = await response.json();

				renderStatblock(data, el, nexusUrl);
			} catch (err) {
				el.createEl("pre", {
					text: "Errore nel caricamento/rendering dello statblock: " + err.message
				});
			}
		});
	}
};

function renderStatblock(data, el, nexusUrl) {
	const theme = data.theme || {};

	const root = el.createDiv({ cls: "nimble-nexus-card" });

	root.style.setProperty("--nimble-bg", theme.BGColor || "#f2ebda");
	root.style.setProperty("--nimble-passive-bg", theme.passiveBGColor || "#d8d2c2");
	root.style.setProperty("--nimble-text", theme.textColor || "#000000");

	const header = root.createDiv({ cls: "nimble-nexus-header" });

	const titleBlock = header.createDiv({ cls: "nimble-nexus-title-block" });

	titleBlock.createDiv({
		cls: "nimble-nexus-cr",
		text: data.CR || ""
	});

	const nameLink = titleBlock.createEl("a", {
		cls: "nimble-nexus-name",
		text: data.name || "Unnamed"
	});

	nameLink.href = nexusUrl;
	nameLink.target = "_blank";
	nameLink.rel = "noopener noreferrer";

	const meta = header.createDiv({ cls: "nimble-nexus-meta" });

	addMeta(meta, "heart", data.hp);
	addMeta(meta, "shield", data.armor);
	addMeta(meta, "star", data.saves);
	addMeta(meta, "speed", data.speed);

	if (data.passives && data.passives.length) {
		const ribbon = root.createDiv({ cls: "nimble-nexus-ribbon" });

		for (const passive of data.passives) {
			const p = ribbon.createDiv({ cls: "nimble-nexus-passive" });
			p.createEl("strong", { text: passive.name || "" });
			p.appendText(" " + (passive.desc || ""));
		}
	}

	if (data.actions && data.actions.length) {
		const actions = root.createDiv({ cls: "nimble-nexus-actions" });

		for (const group of data.actions) {
			if (group.type === "multi") {
				if (group.name) {
					actions.createDiv({
						cls: "nimble-nexus-actions-intro",
						text: group.name
					});
				}

				for (const action of group.actions || []) {
					renderAction(actions, action);
				}
			} else {
				renderAction(actions, group);
			}
		}
	}

	if (data.bloodied || data.laststand) {
		root.createDiv({ cls: "nimble-nexus-divider" });

		const footer = root.createDiv({ cls: "nimble-nexus-footer" });

		if (data.bloodied) {
			const row = footer.createDiv({ cls: "nimble-nexus-footer-row" });
			row.createEl("strong", { text: "BLOODIED: " });
			row.appendText(data.bloodied);
		}

		if (data.laststand) {
			const row = footer.createDiv({ cls: "nimble-nexus-footer-row" });
			row.createEl("strong", { text: "LAST STAND: " });
			row.appendText(data.laststand);
		}
	}
}

function addMeta(parent, type, value) {
	if (!value) return;

	const item = parent.createDiv({ cls: "nimble-nexus-meta-item" });
	item.createSpan({ cls: "nimble-nexus-icon " + type });
	item.createSpan({ cls: "nimble-nexus-meta-value", text: String(value) });
}

function renderAction(parent, action) {
	const row = parent.createDiv({ cls: "nimble-nexus-action" });
	row.createSpan({ cls: "nimble-nexus-bullet", text: "●" });

	const text = row.createSpan({ cls: "nimble-nexus-action-text" });
	text.createEl("strong", { text: action.name || "" });
	text.appendText(" " + (action.desc || ""));
}