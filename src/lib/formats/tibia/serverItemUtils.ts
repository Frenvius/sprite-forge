import type { XmlAttr, ServerItem, ServerItemData } from './otb';

function cloneXmlAttr(attr: XmlAttr): XmlAttr {
	const clone: XmlAttr = { ...attr };
	if (attr.children) clone.children = attr.children.map(cloneXmlAttr);
	if (attr.extra) clone.extra = attr.extra.map(([key, value]) => [key, value]);
	return clone;
}

export function cloneServerItemForClient(source: ServerItem, serverId: number, clientId: number): ServerItem {
	return {
		...source,
		serverId,
		clientId,
		spriteHash: [...source.spriteHash],
		xmlAttributes: source.xmlAttributes?.map(cloneXmlAttr)
	};
}

export function duplicateServerItemsForClient(
	serverItems: ServerItemData,
	sourceClientId: number,
	targetClientId: number
): number[] {
	if (sourceClientId === targetClientId) return [];

	const existingTargetIds = serverItems.byClientId.get(targetClientId);
	if (existingTargetIds && existingTargetIds.length > 0) return [];

	const sourceServerIds = serverItems.byClientId.get(sourceClientId) ?? [];
	if (sourceServerIds.length === 0) return [];

	let maxServerId = 0;
	for (const id of serverItems.items.keys()) {
		if (id > maxServerId) maxServerId = id;
	}

	const newServerIds: number[] = [];
	for (const sourceServerId of sourceServerIds) {
		const source = serverItems.items.get(sourceServerId);
		if (!source) continue;

		const duplicate = cloneServerItemForClient(source, ++maxServerId, targetClientId);
		serverItems.items.set(duplicate.serverId, duplicate);
		newServerIds.push(duplicate.serverId);
	}

	if (newServerIds.length > 0) {
		serverItems.byClientId.set(targetClientId, newServerIds);
	}

	return newServerIds;
}
