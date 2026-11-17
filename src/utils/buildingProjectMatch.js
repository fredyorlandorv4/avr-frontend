export const buildingCompanyKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, ' ');

export function buildingProjectsByCompany(configs) {
  const byCompany = new Map();
  for (const config of configs || []) {
    if (!config.active || !config.company_name || !config.project_name) continue;
    const key = buildingCompanyKey(config.company_name);
    const projects = byCompany.get(key) || [];
    projects.push(config.project_name);
    byCompany.set(key, projects);
  }
  return new Map([...byCompany].filter(([, projects]) => projects.length === 1)
    .map(([key, projects]) => [key, projects[0]]));
}
