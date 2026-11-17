import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingCompanyKey, buildingProjectsByCompany } from './buildingProjectMatch.js';

test('usa la única configuración activa para mostrar el edificio de Consulta SAP', () => {
  const projects = buildingProjectsByCompany([
    { active: true, company_name: 'BAROZZI', project_name: 'Zona AX' },
    { active: false, company_name: 'Barozzi', project_name: 'Otro' },
    { active: true, company_name: 'Otra', project_name: 'Edificio A' },
    { active: true, company_name: 'Otra', project_name: 'Edificio B' },
  ]);
  assert.equal(projects.get(buildingCompanyKey(' Barózzi ')), 'Zona AX');
  assert.equal(projects.has(buildingCompanyKey('Otra')), false);
});
