import test from "node:test";
import assert from "node:assert/strict";
import { portfolioMessageSelection } from "./portfolioMessaging.js";

test("Edificios usa la empresa que SAP devuelve en proyecto, sin alterar Lotes", () => {
  const client = { code: "CL-1", name: "Ana", company: "SBO_BAROZZI" };
  const lot = { project: "Zobel", sapProject: "Empresa Edificio" };
  assert.deepEqual(portfolioMessageSelection({ ...client, source: "edificios" }, lot), {
    company_name: "Empresa Edificio", project_name: "Empresa Edificio", customer_code: "CL-1",
  });
  assert.deepEqual(portfolioMessageSelection({ ...client, source: "lotes" }, lot), {
    company_name: "SBO_BAROZZI", project_name: "Zobel", customer_code: "CL-1",
  });
  assert.equal(portfolioMessageSelection({ source: "edificios" }, { project: "" }), null);
});
