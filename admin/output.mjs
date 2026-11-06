export const escape = value => String(value ?? '').replace(/[&<>"']/g, character => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
));

export const money = (value, currency) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(value);

export function download(name, body, mime) {
  const blob = body instanceof Blob ? body : new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function toCsv(headers, rows) {
  const encode = value => {
    const cell = String(value ?? '');
    const safe = /^[\s]*[=+@\-]|^[\t\r\n]/.test(cell) ? "'" + cell : cell;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return [headers, ...rows].map(row => row.map(encode).join(',')).join('\r\n');
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index++; }
      else if (quoted || !cell) quoted = !quoted;
      else throw Error('Invalid quote in the CSV file.');
    } else if (!quoted && (character === ',' || character === '\n')) {
      row.push(cell);
      cell = '';
      if (character === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else {
      cell += character;
    }
  }
  if (quoted) throw Error('A quoted CSV value is incomplete.');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (!headers || headers.some(item => !item.trim()) || new Set(headers).size !== headers.length) throw Error('The CSV needs unique column headers.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw Error('CSV row ' + (index + 2) + ' has an incorrect number of columns.');
    return Object.fromEntries(headers.map((header, i) => [header.trim(), values[i]]));
  });
}

export function exportTable(name, headers, rows, format) {
  if (format === 'pdf') {
    return downloadPdf(name, [headers.join(' | '), ...rows.map(row => row.join(' | '))]);
  }
  if (format === 'excel') {
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Confety report"><Table>${[headers, ...rows].map(row => `<Row>${row.map(cell =>
        `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escape(cell)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
    return download(name + '.xml', xml, 'application/vnd.ms-excel');
  }
  return download(name + '.csv', '\uFEFF' + toCsv(headers, rows), 'text/csv;charset=utf-8');
}

function ascii(text) {
  return String(text).replaceAll('₦', 'NGN ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[^\x20-\x7e]/g, ' ');
}

function pdfText(text) {
  return ascii(text).replace(/[\\()]/g, character => '\\' + character);
}

export function downloadPdf(title, lines) {
  const wrap = line => ascii(line).match(/.{1,90}(?:\s|$)|.{1,90}/g) || [''];
  const content = lines.flatMap(wrap);
  const pages = [];
  for (let index = 0; index < content.length || index === 0; index += 43) pages.push(content.slice(index, index + 43));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => (4 + index * 2) + ' 0 R').join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (const [index, lines] of pages.entries()) {
    const stream = `BT /F1 17 Tf 45 790 Td (${pdfText(title)}) Tj /F1 10 Tf 0 -25 Td (Confety demo | Page ${index + 1}) Tj 0 -22 Td 15 TL ` +
      lines.map(line => `(${pdfText(line)}) Tj T*`).join('\n') + '\nET';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` +
    offsets.slice(1).map(value => String(value).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  download(title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf', pdf, 'application/pdf');
}
