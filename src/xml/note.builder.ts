import { create } from 'xmlbuilder2';
import { NotePayload } from '../types/sunat.types';
import { NS_CREDIT_NOTE, NS_DEBIT_NOTE } from './namespaces';
import {
  addUblExtensions,
  addSignatureBlock,
  addSupplierParty,
  addCustomerParty,
  addDocumentTaxTotal,
  addMonetaryTotal,
  addInvoiceLine,
  addLegends,
  isoDate,
  isoTime,
} from './common.builder';

/**
 * Genera el XML UBL 2.1 de una Nota de Credito (07) o Debito (08) sin firmar.
 */
export function buildNoteXml(data: NotePayload): string {
  const isNC = data.tipoDoc === '07';
  const rootTag = isNC ? 'CreditNote' : 'DebitNote';
  const ns = isNC ? NS_CREDIT_NOTE : NS_DEBIT_NOTE;
  const lineTag = isNC ? 'cac:CreditNoteLine' : 'cac:DebitNoteLine';

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(rootTag, ns);

  addUblExtensions(root);

  // Orden UBL 2.1 estricto para CreditNote / DebitNote
  root.ele('cbc:UBLVersionID').txt(data.ublVersion ?? '2.1').up();
  root.ele('cbc:CustomizationID').txt('2.0').up();
  root.ele('cbc:ID').txt(`${data.serie}-${data.correlativo}`).up();
  root.ele('cbc:IssueDate').txt(isoDate(data.fechaEmision)).up();
  root.ele('cbc:IssueTime').txt(isoTime(data.fechaEmision)).up();
  addLegends(root, data.legends ?? []);
  root.ele('cbc:DocumentCurrencyCode').txt(data.tipoMoneda).up();

  root.ele('cac:DiscrepancyResponse')
    .ele('cbc:ReferenceID').txt(data.numDocAfectado).up()
    .ele('cbc:ResponseCode').txt(data.codMotivo).up()
    .ele('cbc:Description').txt(data.desMotivo).up()
  .up();

  // Referencia al comprobante afectado
  root.ele('cac:BillingReference')
    .ele('cac:InvoiceDocumentReference')
      .ele('cbc:ID').txt(data.numDocAfectado).up()
      .ele('cbc:DocumentTypeCode').txt(data.tipDocAfectado).up()
    .up()
  .up();

  addSignatureBlock(root, data.company.ruc, data.company.razonSocial);
  addSupplierParty(root, data.company);
  addCustomerParty(root, data.client);

  addDocumentTaxTotal(root, {
    mtoOperGravadas: data.mtoOperGravadas,
    mtoOperExoneradas: data.mtoOperExoneradas,
    mtoOperInafectas: data.mtoOperInafectas,
    mtoIGV: data.mtoIGV,
    totalImpuestos: data.totalImpuestos,
    tipoMoneda: data.tipoMoneda,
  });

  addMonetaryTotal(root, {
    valorVenta: data.valorVenta,
    subTotal: data.subTotal,
    mtoImpVenta: data.mtoImpVenta,
    tipoMoneda: data.tipoMoneda,
    elementName: isNC ? 'cac:LegalMonetaryTotal' : 'cac:RequestedMonetaryTotal',
  });

  data.details.forEach((detail, i) => {
    addInvoiceLine(root, detail, i + 1, data.tipoMoneda, lineTag);
  });

  return root.end({ prettyPrint: true });
}
