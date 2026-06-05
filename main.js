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

				const jsonUrl = `https://nimble.nexus/api/monsters/${encodeURIComponent(monsterId)}`;
				const nexusUrl = `https://nimble.nexus/monsters/${monsterId}`;

				const response = await fetch(jsonUrl, {
					headers: {
						Accept: "application/vnd.api+json"
					}
				});

				if (!response.ok) {
					throw new Error(`Could not fetch monster JSON: ${response.status}`);
				}

				const payload = await response.json();
				const data = normalizeMonsterPayload(payload);

				renderStatblock(data, el, nexusUrl);
			} catch (err) {
				el.createEl("pre", {
					text: "Errore nel caricamento/rendering dello statblock: " + err.message
				});
			}
		});
	}
};

function normalizeMonsterPayload(payload) {
	if (!payload || !payload.data || !payload.data.attributes) {
		return payload;
	}

	const attributes = payload.data.attributes;
	const actions = normalizeNamedDescriptions(attributes.actions);
	const passives = [
		...normalizeNamedDescriptions(attributes.abilities),
		...normalizeNamedDescriptions(attributes.effects)
	];

	return {
		name: attributes.name,
		CR: formatMonsterType(attributes),
		hp: attributes.hp,
		armor: formatArmor(attributes.armor),
		saves: formatSaves(attributes.saves),
		speed: formatMovement(attributes.movement),
		passives,
		actions: attributes.actionsInstructions
			? [{ type: "multi", name: attributes.actionsInstructions, actions }]
			: actions,
		bloodied: getDescription(attributes.bloodied),
		laststand: getDescription(attributes.lastStand),
		theme: {}
	};
}

function normalizeNamedDescriptions(items) {
	if (!Array.isArray(items)) {
		return [];
	}

	return items
		.map((item) => ({
			name: item && item.name ? item.name : "",
			desc: getDescription(item)
		}))
		.filter((item) => item.name || item.desc);
}

function getDescription(value) {
	if (!value) {
		return "";
	}

	if (typeof value === "string") {
		return value;
	}

	return value.description || value.desc || "";
}

function formatMonsterType(attributes) {
	const level = attributes.level === 0 || attributes.level
		? `Lvl ${attributes.level}`
		: "";
	const sizeAndKind = [attributes.size, attributes.kind]
		.filter(Boolean)
		.join(" ");
	const subtype = attributes.subtype && attributes.subtype !== "standard"
		? attributes.subtype
		: attributes.legendary
			? "legendary"
			: attributes.minion
				? "minion"
				: "";

	return [level, sizeAndKind, subtype]
		.filter(Boolean)
		.join(" - ");
}

function formatArmor(armor) {
	if (!armor || armor === "none") {
		return "";
	}

	return titleCase(String(armor).replace(/_/g, " "));
}

function formatMovement(movement) {
	if (!Array.isArray(movement) || !movement.length) {
		return "";
	}

	return movement
		.map((entry) => {
			if (!entry || entry.speed === undefined || entry.speed === null) {
				return "";
			}

			return entry.mode ? `${entry.mode} ${entry.speed}` : String(entry.speed);
		})
		.filter(Boolean)
		.join(", ");
}

function formatSaves(saves) {
	if (!saves || typeof saves !== "object") {
		return "";
	}

	return ["str", "dex", "wil"]
		.filter((key) => saves[key] !== undefined && saves[key] !== null)
		.map((key) => `${key.toUpperCase()} ${formatModifier(saves[key])}`)
		.join(", ");
}

function formatModifier(value) {
	const number = Number(value);

	if (!Number.isFinite(number)) {
		return String(value);
	}

	return number > 0 ? `+${number}` : String(number);
}

function titleCase(value) {
	return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
