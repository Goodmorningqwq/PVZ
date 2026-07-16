export function normalizeEntities(entities) {
  if (!Array.isArray(entities)) {
    return [];
  }

  return entities
    .map((entity) => {
      if (!entity || typeof entity !== 'object') {
        return null;
      }

      return {
        ...entity,
        id: String(entity.id ?? ''),
        x: Number(entity.x),
        y: Number(entity.y),
      };
    })
    .filter((entity) => entity && entity.id && Number.isFinite(entity.x) && Number.isFinite(entity.y));
}

export function normalizeSun(sun) {
  if (!sun || typeof sun !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(sun)
      .filter(([playerId]) => typeof playerId === 'string' && playerId.length > 0)
      .map(([playerId, value]) => [playerId, Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  );
}

export function toStringId(value) {
  return String(value ?? '');
}

export function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
