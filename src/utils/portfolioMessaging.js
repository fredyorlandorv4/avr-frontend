export function portfolioMessageSelection(client, lot) {
  // En Edificios, el campo proyecto de SAP identifica la empresa configurada.
  const company = client.source === "edificios" ? lot.sapProject || lot.project : client.company;
  const sapProject = client.source === "edificios" ? lot.sapProject || lot.project : lot.project;
  if (!company || !sapProject || (!client.code && !client.name)) return null;
  return {
    company_name: company,
    project_name: sapProject,
    ...(client.code ? { customer_code: client.code } : { customer_name: client.name }),
  };
}
