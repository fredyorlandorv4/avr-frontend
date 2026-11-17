function dateText(value) {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildBuildingStatementPdf(statement) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const issuer = statement.issuer;
  const customer = statement.customer;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const right = pageWidth - margin;
  let y = 18;

  const header = (unit, contractNumber) => {
    doc.setTextColor(15, 35, 52);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(issuer.company, pageWidth / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(issuer.address, pageWidth / 2, 24, { align: 'center' });
    doc.text(`NIT: ${issuer.nit}`, pageWidth / 2, 29, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Estado de Cuenta', pageWidth / 2, 42, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emitido: ${dateText(statement.generated_at)}`, right, 48, { align: 'right' });
    doc.setDrawColor(100, 113, 127);
    doc.rect(margin, 52, pageWidth - margin * 2, 27);
    doc.text(`Código cliente: ${customer.code}`, margin + 3, 59);
    doc.text(`No. contrato: ${contractNumber || 'No disponible en SAP'}`, 115, 59);
    const name = doc.splitTextToSize(`Nombre cliente: ${customer.name}`, 95);
    doc.text(name.slice(0, 2), margin + 3, 67);
    doc.text(`No. apartamento: ${unit}`, 115, 67);
    doc.text(`Proyecto: ${customer.project}`, margin + 3, 76);
    y = 84;
  };

  const columns = [
    ['No. cuota', 14], ['Fecha pactada', 38], ['Monto cuota', 67],
    ['Fecha pago', 96], ['Monto pagado', 124], ['Saldo', 154],
    ['No. recibo', 176],
  ];
  const tableHeader = () => {
    doc.setFillColor(5, 62, 104);
    doc.rect(margin, y, pageWidth - margin * 2, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    for (const [label, x] of columns) doc.text(label, x + 1, y + 5.7);
    doc.setTextColor(25, 39, 52);
    doc.setFont('helvetica', 'normal');
    y += 9;
  };

  const byUnit = new Map();
  for (const row of statement.installments) {
    const unit = String(row.unit || 'Sin unidad');
    if (!byUnit.has(unit)) byUnit.set(unit, []);
    byUnit.get(unit).push(row);
  }
  for (const [unitIndex, [unit, rows]] of [...byUnit].entries()) {
    if (unitIndex) doc.addPage();
    const contractNumber = rows.find((row) => row.contract_number)?.contract_number
      || (byUnit.size === 1 ? customer.contract_number : null);
    header(unit, contractNumber);
    tableHeader();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const values = [row.installment_number ?? '—', dateText(row.due_date),
        money(row.installment_amount), dateText(row.payment_date), money(row.amount_paid),
        money(row.balance)];
      doc.setFontSize(7);
      const receipts = String(row.receipt_number || '').split(',').map((value) => value.trim()).filter(Boolean);
      const receiptLines = (receipts.length ? receipts : ['—']).flatMap((value) =>
        doc.splitTextToSize(value, right - columns[6][1] - 2));
      let remaining = receiptLines;
      let firstPart = true;
      while (remaining.length) {
        if (y > 268) {
          doc.addPage();
          header(unit, contractNumber);
          tableHeader();
        }
        const lineCount = Math.min(remaining.length, Math.max(1, Math.floor((276 - y - 4) / 3.2)));
        const part = remaining.slice(0, lineCount);
        remaining = remaining.slice(lineCount);
        const height = Math.max(8, 4 + part.length * 3.2);
        if (index % 2 === 0) {
          doc.setFillColor(245, 248, 250);
          doc.rect(margin, y, pageWidth - margin * 2, height, 'F');
        }
        doc.setFontSize(7);
        if (firstPart) values.forEach((value, column) => {
          const maxWidth = columns[column + 1][1] - columns[column][1] - 2;
          const line = doc.splitTextToSize(String(value), maxWidth)[0] || '—';
          doc.text(line, columns[column][1] + 1, y + 5.2);
        });
        part.forEach((line, lineIndex) => doc.text(line, columns[6][1] + 1, y + 5.2 + lineIndex * 3.2));
        y += height;
        firstPart = false;
      }
    }
    if (y > 257) {
      doc.addPage();
      header(unit, contractNumber);
    }
    const unitBalance = rows.reduce((total, row) => total + Math.round(Number(row.balance || 0) * 100), 0) / 100;
    doc.setDrawColor(80, 95, 110);
    doc.line(margin, y + 2, right, y + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Saldo unidad (USD): $${money(unitBalance)}`, right, y + 9, { align: 'right' });
    y += 17;
    const missing = [];
    if (!statement.sap_fields.receipt_number) missing.push('No. recibo');
    if (!statement.sap_fields.payment_date) missing.push('Fecha pago');
    if (!statement.sap_fields.contract_number) missing.push('No. contrato');
    if (missing.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Campos no disponibles en la consulta SAP: ${missing.join(', ')}.`, margin, y);
    }
  }
  return doc;
}

export async function downloadBuildingStatement(statement) {
  const doc = await buildBuildingStatementPdf(statement);
  const filename = `Estado_Cuenta_${statement.customer.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(filename);
}
