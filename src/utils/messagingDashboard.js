import { portfolioClientId } from './accessScopes.js';
import { overdueInstallmentTotal } from './overdueInstallments.js';

const normalize = value => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ');

export function buildMessagingDashboard(clients, deliveries, configs, today, customerDeliveries = [], projectStatus = []) {
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
  const pendingClients = new Set();
  const pendingProjects = new Set();
  const groupFor = (source, company, project) => {
    const key = JSON.stringify([source, normalize(company), normalize(project)]);
    if (!groups.has(key)) groups.set(key, { key, source, company: company || 'Sin empresa', project: project || 'Sin proyecto', cents: 0, sent: 0, customers: new Map() });
    return groups.get(key);
  };
  for (const [index, client] of (clients || []).entries()) {
    const source = client.tipo_cartera || 'lotes';
    let clientHasPending = Number(client.total_pendiente ?? client.saldo_total) > 0;
    for (const lot of client.lotes || []) {
      const company = source === 'edificios' ? lot.proyecto : client.empresa;
      const project = source === 'edificios' ? buildingProject(company) : lot.proyecto;
      const installments = lot.cuotas_atrasadas ?? lot.cuotas ?? lot.installments ?? [];
      const overdue = installments.filter(item => Number(item.total_a_pagar ?? item.saldo ?? item.monto_pendiente) > 0);
      const group = groupFor(source, company, project);
      const overdueCents = Math.round(overdueInstallmentTotal(overdue, today) * 100);
      group.cents += overdueCents;
      if (overdueCents > 0) {
        const customerKey = normalize(client.codigo_cliente || client.nombre_cliente);
        const customer = group.customers.get(customerKey) || { key: customerKey, code: client.codigo_cliente, name: client.nombre_cliente, cents: 0, installments: 0, sent: 0 };
        customer.cents += overdueCents;
        customer.installments += new Set(overdue.filter(item => {
          const date = String(item.fecha_compromiso || item.fecha_vencimiento || '').slice(0, 10);
          return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
        }).map(item => String(item.fecha_compromiso || item.fecha_vencimiento).slice(0, 7))).size;
        group.customers.set(customerKey, customer);
      }
      const hasPending = Number(lot.total_pendiente_lote ?? lot.total_pendiente ?? lot.subtotal) > 0 ||
        (Array.isArray(installments) && installments.some(item => Number(item.total_a_pagar ?? item.saldo ?? item.monto_pendiente) > 0));
      if (hasPending) {
        clientHasPending = true;
        if (company && project) pendingProjects.add(JSON.stringify([source, normalize(company), normalize(project)]));
      }
    }
    if (clientHasPending) pendingClients.add(portfolioClientId(client, index));
  }
  for (const delivery of deliveries || []) {
    const source = delivery.tipo_cartera || 'lotes';
    const company = delivery.empresa || (source === 'edificios' ? delivery.proyecto : '');
    const project = source === 'edificios' ? buildingProject(company) : delivery.proyecto;
    groupFor(source, company, project).sent += Number(delivery.enviados) || 0;
  }
  for (const delivery of customerDeliveries) {
    const source = delivery.tipo_cartera || 'lotes';
    const company = delivery.empresa || (source === 'edificios' ? delivery.proyecto : '');
    const project = source === 'edificios' ? buildingProject(company) : delivery.proyecto;
    const group = groupFor(source, company, project);
    const customer = group.customers.get(normalize(delivery.codigo_cliente || delivery.nombre_cliente));
    if (customer) customer.sent += Number(delivery.enviados) || 0;
  }
  const statusByProject = new Map();
  for (const status of projectStatus) {
    const source = status.tipo_cartera || 'lotes';
    const project = source === 'edificios' ? buildingProject(status.empresa) : status.proyecto;
    const key = JSON.stringify([source, normalize(status.empresa), normalize(project)]);
    statusByProject.set(key, Boolean(status.saldo_pendiente) || Boolean(statusByProject.get(key)));
  }
  const rows = [...groups.values()].sort((a, b) => b.sent - a.sent || a.project.localeCompare(b.project, 'es'));
  const totals = { sent: 0, GTQ: 0, USD: 0 };
  for (const row of rows) {
    totals.sent += row.sent;
    totals[row.source === 'edificios' ? 'USD' : 'GTQ'] += row.cents;
  }
  return { rows, totals, pendingClientCount: pendingClients.size, pendingProjectCount: statusByProject.size ? [...statusByProject.values()].filter(Boolean).length : pendingProjects.size,
    currentProjectCount: [...statusByProject.values()].filter(pending => !pending).length };
}
