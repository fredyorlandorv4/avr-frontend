export function resolveAreaSelection(scopes, requestedId, primaryId) {
  return scopes.find(item => item.area_id === requestedId)?.area_id
    ?? scopes.find(item => item.area_id === primaryId)?.area_id
    ?? scopes[0]?.area_id
    ?? null;
}

export function permittedSubareas(subareas, areaId, scope, isAdmin) {
  return subareas.filter(item => item.area_id === areaId &&
    (isAdmin || (scope && (scope.subarea_ids == null || scope.subarea_ids.includes(item.id)))));
}

export function portfolioClientId(client, fallback) {
  return JSON.stringify([client.tipo_cartera || 'lotes', client.empresa || client.company || '',
    client.id ?? client.cliente_id ?? client.codigo_cliente ?? fallback]);
}
