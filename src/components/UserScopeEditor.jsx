export default function UserScopeEditor({ areas, subareas, value, onChange, disabled }) {
  return <fieldset className="sm:col-span-2 space-y-3">
    <legend className="mb-2 text-sm font-medium text-gray-700">Áreas y subáreas autorizadas</legend>
    {areas.map(area => {
      const scope = value.find(item => item.area_id === area.id);
      const children = subareas.filter(item => item.area_id === area.id || (item.area_id == null && item.area === area.area));
      const update = next => onChange(value.map(item => item.area_id === area.id ? next : item));
      return <div key={area.id} className="rounded-lg border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={disabled} checked={Boolean(scope)} onChange={event => onChange(event.target.checked ? [...value, { area_id: area.id, subarea_ids: null }] : value.filter(item => item.area_id !== area.id))} />{area.area}</label>
        {scope && children.length > 0 && <div className="mt-2 space-y-2 pl-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={scope.subarea_ids == null} onChange={event => update({ ...scope, subarea_ids: event.target.checked ? null : [] })} />Área completa</label>
          {scope.subarea_ids != null && children.map(subarea => <label key={subarea.id} className="flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={scope.subarea_ids.includes(subarea.id)} onChange={event => update({ ...scope, subarea_ids: event.target.checked ? [...scope.subarea_ids, subarea.id] : scope.subarea_ids.filter(id => id !== subarea.id) })} />{subarea.name}</label>)}
        </div>}
      </div>;
    })}
  </fieldset>;
}
