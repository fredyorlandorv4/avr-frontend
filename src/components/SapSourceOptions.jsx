export default function SapSourceOptions({ value = [], onChange, disabled }) {
  return <fieldset className="space-y-2 rounded-lg border border-gray-200 p-3">
    <legend className="px-1 text-sm font-medium text-gray-700">Acceso a carteras SAP</legend>
    {[['lotes', 'Lotes'], ['edificios', 'Edificios']].map(([id, label]) => <label key={id} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={(value || []).includes(id)} onChange={event => onChange(event.target.checked ? [...(value || []), id] : (value || []).filter(item => item !== id))} />{label}</label>)}
    <p className="text-xs text-gray-500">Se concede a los usuarios asignados a este ámbito.</p>
  </fieldset>;
}
