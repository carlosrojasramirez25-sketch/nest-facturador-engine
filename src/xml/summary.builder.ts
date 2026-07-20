import { create } from 'xmlbuilder2';
import { SummaryPayload, SummaryDetailSunat } from '../types/sunat.types';
import { NS_SUMMARY } from './namespaces';
import { addUblExtensions, addSignatureBlock, isoDate, fmt } from './common.builder';

/**
 * Genera el XML de un Resumen Diario (RC) sin firmar.
 * Los resumenes consolidan boletas enviadas en el dia.
 */
export function buildSummaryXml(data: SummaryPayload): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('SummaryDocuments', NS_SUMMARY);

  addUblExtensions(root);

  root.ele('cbc:UBLVersionID').txt('2.1').up();
  root.ele('cbc:CustomizationID').txt('1.1').up();
  root.ele('cbc:ID').txt(`RC-${isoDate(data.fecResumen).replace(/-/g, '')}-${data.correlativo}`).up();
  root.ele('cbc:ReferenceDate').txt(isoDate(data.fecGeneracion)).up();
  root.ele('cbc:IssueDate').txt(isoDate(data.fecResumen)).up();

  addSignatureBlock(root, data.company.ruc, data.company.razonSocial);

  // Emisor
  root.ele('sac:SUNATSupplierParty')
    .ele('cbc:CustomerAssignedAccountID').txt(data.company.ruc).up()
    .ele('cac:Party')
      .ele('cac:PartyLegalEntity')
        .ele('cbc:RegistrationName').txt(data.company.razonSocial).up()
      .up()
    .up()
  .up();

  // Lineas
  data.details.forEach((d, i) => {
    const line = root.ele('sac:SummaryDocumentsLine');
    line.ele('cbc:LineID').txt(String(i + 1)).up();
    line.ele('cbc:DocumentTypeCode').txt(d.tipoDoc).up();
    line.ele('cbc:ID').txt(d.serieNro).up();
    line.ele('sac:StatusCode').txt(d.estado).up();
    line.ele('sac:TotalAmount', { currencyID: 'PEN' }).txt(fmt(d.total)).up();
    line.ele('sac:SUNATCustomerParty')
      .ele('cbc:CustomerAssignedAccountID').txt(d.clienteNro).up()
      .ele('cbc:AdditionalAccountID').txt(d.clienteTipo).up()
    .up();
    addSummaryAmounts(line, d);
  });

  return root.end({ prettyPrint: true });
}

function addSummaryAmounts(line: any, d: SummaryDetailSunat): void {
  const currency = 'PEN';

  if ((d.mtoOperGravadas ?? 0) > 0) {
    line.ele('sac:BillingPayment')
      .ele('cbc:PaidAmount', { currencyID: currency }).txt(fmt(d.mtoOperGravadas!)).up()
      .ele('cbc:InstructionID').txt('01').up()
    .up();
  }
  if ((d.mtoOperExoneradas ?? 0) > 0) {
    line.ele('sac:BillingPayment')
      .ele('cbc:PaidAmount', { currencyID: currency }).txt(fmt(d.mtoOperExoneradas!)).up()
      .ele('cbc:InstructionID').txt('02').up()
    .up();
  }
  if ((d.mtoOperInafectas ?? 0) > 0) {
    line.ele('sac:BillingPayment')
      .ele('cbc:PaidAmount', { currencyID: currency }).txt(fmt(d.mtoOperInafectas!)).up()
      .ele('cbc:InstructionID').txt('03').up()
    .up();
  }
  if ((d.mtoIGV ?? 0) > 0) {
    line.ele('sac:BillingPayment')
      .ele('cbc:PaidAmount', { currencyID: currency }).txt(fmt(d.mtoIGV!)).up()
      .ele('cbc:InstructionID').txt('04').up()
    .up();
  }

  if (d.docReferencia && d.tipDocReferencia) {
    line.ele('cac:BillingReference')
      .ele('cac:InvoiceDocumentReference')
        .ele('cbc:ID').txt(d.docReferencia).up()
        .ele('cbc:DocumentTypeCode').txt(d.tipDocReferencia).up()
      .up()
    .up();
  }

  // TaxTotal
  const taxTotal = line.ele('cac:TaxTotal');
  taxTotal.ele('cbc:TaxAmount', { currencyID: currency }).txt(fmt(d.mtoIGV ?? 0)).up();

  if ((d.mtoOperGravadas ?? 0) > 0) {
    addSummaryTaxSubtotal(taxTotal, d.mtoOperGravadas!, d.mtoIGV ?? 0, '1000', 'IGV', 'VAT', currency);
  }
  if ((d.mtoOperExoneradas ?? 0) > 0) {
    addSummaryTaxSubtotal(taxTotal, d.mtoOperExoneradas!, 0, '9997', 'EXO', 'VAT', currency);
  }
  if ((d.mtoOperInafectas ?? 0) > 0) {
    addSummaryTaxSubtotal(taxTotal, d.mtoOperInafectas!, 0, '9998', 'INA', 'FRE', currency);
  }
  if ((d.mtoOperGratuitas ?? 0) > 0) {
    addSummaryTaxSubtotal(taxTotal, d.mtoOperGratuitas!, 0, '9996', 'GRA', 'FRE', currency);
  }
}

function addSummaryTaxSubtotal(
  taxTotal: any,
  taxable: number,
  amount: number,
  id: string,
  name: string,
  typeCode: string,
  currency: string,
): void {
  const sub = taxTotal.ele('cac:TaxSubtotal');
  sub.ele('cbc:TaxableAmount', { currencyID: currency }).txt(fmt(taxable)).up();
  sub.ele('cbc:TaxAmount', { currencyID: currency }).txt(fmt(amount)).up();
  sub.ele('cac:TaxCategory')
    .ele('cac:TaxScheme')
      .ele('cbc:ID').txt(id).up()
      .ele('cbc:Name').txt(name).up()
      .ele('cbc:TaxTypeCode').txt(typeCode).up()
    .up()
  .up();
}
