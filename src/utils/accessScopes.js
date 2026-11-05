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

// Refleja los permisos SAP del backend para mostrarlos antes de guardar un usuario.
export function sapSourcesForScopes(scopes, areas, subareas, isAdmin = false) {
  if (isAdmin) return ['lotes', 'edificios'];
  const sources = new Set();
  for (const scope of scopes || []) {
    const scopeSources = new Set();
    if (scope.subarea_ids == null) {
      const area = areas.find(item => item.id === scope.area_id);
      for (const source of area?.sap_sources || []) scopeSources.add(source);
    }
    for (const subarea of subareas) {
      if (subarea.area_id === scope.area_id &&
          (scope.subarea_ids == null || scope.subarea_ids.includes(subarea.id))) {
        for (const source of subarea.sap_sources || []) scopeSources.add(source);
      }
    }
    for (const source of scopeSources) {
      if (scope.sap_sources == null || scope.sap_sources.includes(source)) sources.add(source);
    }
  }
  return ['lotes', 'edificios'].filter(source => sources.has(source));
}
