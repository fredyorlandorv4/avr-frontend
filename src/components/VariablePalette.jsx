// Paleta lateral de variables clicables agrupadas por categoría

const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});

export default function VariablePalette({ variables, onInsert }) {
  const grupos = groupBy(variables, 'grupo');

  return (
    <div style={{
      width: 240, overflowY: 'auto', background: '#fafafa',
      border: '1px solid #e0e0e0', borderRadius: 8, padding: 16,
    }}>
      <h4 style={{ margin: '0 0 4px' }}>Variables</h4>
      <p style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
        Clic en una variable para insertarla donde esté el cursor.
      </p>

      {Object.entries(grupos).map(([grupo, vars]) => (
        <div key={grupo} style={{ marginBottom: 14 }}>
          <div style={{
            fontWeight: 600, fontSize: 11,
            color: '#555', textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 6,
          }}>
            {grupo}
          </div>

          {vars.map(v => (
            <button
              key={v.key}
              onClick={() => onInsert(v.key)}
              title={`Insertar ${v.key}`}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                marginBottom: 4, padding: '5px 8px',
                background: '#fff', border: '1px solid #ddd',
                borderRadius: 4, cursor: 'pointer', fontSize: 12,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <code style={{ color: '#0055cc', fontSize: 11 }}>{v.key}</code>
              <span style={{ color: '#888', marginLeft: 6 }}>{v.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
