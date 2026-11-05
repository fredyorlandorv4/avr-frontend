const normalize = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ');

export function buildMessagingDashboard(clients, deliveries, configs) {
  const projectsByCompany = new Map();
  for (const config of configs || []) {
    if (!config.active || !config.company_name || !config.project_name) continue;
    const key = normalize(config.company_name);
    const projects = projectsByCompany.get(key) || new Set();
    projects.add(config.project_name);
    projectsByCompany.set(key, projects);
  }
  const buildingProject = company => {
    const matches = projectsByCompany.get(normalize(company));
    return matches?.size === 1 ? [...matches][0] : company;
  };
  const groups = new Map();
  const groupFor = (source, company, project) => {
    const key = JSON.stringify([source, normalize(company), normalize(project)]);
    if (!groups.has(key)) groups.set(key, { key, source, company: company || 'Sin empresa', project: project || 'Sin proyecto', cents: 0, sent: 0 });
    return groups.get(key);
  };
  for (const client of clients || []) {
    const source = client.tipo_cartera || 'lotes';
    for (const lot of client.lotes || []) {
      const company = source === 'edificios' ? lot.proyecto : client.empresa;
      const project = source === 'edificios' ? buildingProject(company) : lot.proyecto;
      groupFor(source, company, project).cents += Math.round((Number(lot.total_pendiente_lote) || 0) * 100);
    }
  }
  for (const delivery of deliveries || []) {
    const source = delivery.tipo_cartera || 'lotes';
    const company = delivery.empresa || (source === 'edificios' ? delivery.proyecto : '');
    const project = source === 'edificios' ? buildingProject(company) : delivery.proyecto;
    groupFor(source, company, project).sent += Number(delivery.enviados) || 0;
  }
  const rows = [...groups.values()].sort((a, b) => b.sent - a.sent || a.project.localeCompare(b.project, 'es'));
  const totals = { sent: 0, GTQ: 0, USD: 0 };
  for (const row of rows) {
    totals.sent += row.sent;
    totals[row.source === 'edificios' ? 'USD' : 'GTQ'] += row.cents;
  }
  return { rows, totals };
}
