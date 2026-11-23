import { sapSourcesForScopes } from '../utils/accessScopes.js';

export default function UserScopeEditor({ areas, subareas, value, onChange, disabled, isAdmin }) {
  const sourceNames = item => (item.sap_sources || []).map(source => source === 'lotes' ? 'Lotes' : 'Edificios').join(' y ');
  return <fieldset className="sm:col-span-2 space-y-3">
    <legend className="mb-2 text-sm font-medium text-gray-700">Áreas y subáreas autorizadas</legend>
    <p className="text-xs text-gray-500">Selecciona las áreas, subáreas y carteras SAP autorizadas para cada área.</p>
    <p className="text-xs text-gray-500">El acceso efectivo reúne las carteras autorizadas en todas las áreas asignadas.</p>
    {areas.map(area => {
      const scope = value.find(item => item.area_id === area.id);
      const children = subareas.filter(item => item.area_id === area.id || (item.area_id == null && item.area === area.area));
      const update = next => onChange(value.map(item => item.area_id === area.id ? next : item));
      const available = scope ? sapSourcesForScopes([{ ...scope, sap_sources: null }], areas, subareas) : [];
      const selected = scope ? sapSourcesForScopes([scope], areas, subareas) : [];
      return <div key={area.id} className="rounded-lg border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={disabled} checked={Boolean(scope)} onChange={event => onChange(event.target.checked ? [...value, { area_id: area.id, subarea_ids: null }] : value.filter(item => item.area_id !== area.id))} />{area.area}{sourceNames(area) && <span className="text-xs font-normal text-[#0B5F8F]">{sourceNames(area)}</span>}</label>
        {scope && children.length > 0 && <div className="mt-2 space-y-2 pl-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={scope.subarea_ids == null} onChange={event => update({ ...scope, subarea_ids: event.target.checked ? null : [] })} />Área completa</label>
          {scope.subarea_ids != null && children.map(subarea => <label key={subarea.id} className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={scope.subarea_ids.includes(subarea.id)} onChange={event => update({ ...scope, subarea_ids: event.target.checked ? [...scope.subarea_ids, subarea.id] : scope.subarea_ids.filter(id => id !== subarea.id) })} />{subarea.name}{sourceNames(subarea) && <span className="text-xs text-[#0B5F8F]">{sourceNames(subarea)}</span>}</label>)}
        </div>}
        {scope && !isAdmin && available.length > 0 && <fieldset className="mt-3 border-t border-gray-100 pt-2 pl-6">
          <legend className="text-xs font-medium text-gray-600">Carteras SAP de {area.area}</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {available.map(source => <label key={source} className="inline-flex items-center gap-2">
              <input type="checkbox" disabled={disabled} checked={selected.includes(source)} onChange={event => update({ ...scope, sap_sources: event.target.checked ? [...selected, source] : selected.filter(item => item !== source) })} />
              {source === 'lotes' ? 'Lotes' : 'Edificios'}
            </label>)}
          </div>
        </fieldset>}
      </div>;
    })}
  </fieldset>;
}
