import { create } from 'xmlbuilder2';
import { InvoicePayload } from '../types/sunat.types';
import { NS_INVOICE } from './namespaces';
import {
  addUblExtensions,
  addSignatureBlock,
  addSupplierParty,
  addCustomerParty,
  addDocumentTaxTotal,
  addMonetaryTotal,
  addInvoiceLine,
  addLegends,
  fmt,
  isoDate,
  isoTime,
} from './common.builder';

/**
 * Genera el XML UBL 2.1 de una Factura (01) o Boleta (03) sin firmar.
 * La firma se inserta despues por XmlSignerService en ext:ExtensionContent.
 */
export function buildInvoiceXml(data: InvoicePayload): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', NS_INVOICE);

  addUblExtensions(root);

  root.ele('cbc:UBLVersionID').txt(data.ublVersion ?? '2.1').up();
  root.ele('cbc:CustomizationID').txt('2.0').up();
  root.ele('cbc:ID').txt(`${data.serie}-${data.correlativo}`).up();
  root.ele('cbc:IssueDate').txt(isoDate(data.fechaEmision)).up();
  root.ele('cbc:IssueTime').txt(isoTime(data.fechaEmision)).up();
  // listID = tipo de operacion (Catalogo 51)
  root.ele('cbc:InvoiceTypeCode', { listID: data.tipoOperacion }).txt(data.tipoDoc).up();

  addLegends(root, data.legends ?? []);

  root.ele('cbc:DocumentCurrencyCode').txt(data.tipoMoneda).up();

  // Fecha de vencimiento
  if (data.fechaVencimiento) {
    root.ele('cac:InvoicePeriod')
      .ele('cbc:DueDate').txt(isoDate(data.fechaVencimiento)).up()
    .up();
  }

  // Detraccion (informacion adicional en ext -> sac:AdditionalInformation)
  if (data.detraccion) {
    addDetraccionExtension(root, data);
  }

  addSignatureBlock(root, data.company.ruc, data.company.razonSocial);
  addSupplierParty(root, data.company);
  addCustomerParty(root, data.client);

  // PaymentTerms — SUNAT usa cac:PaymentTerms/cbc:PaymentMeansID, NO cac:PaymentMeans
  const tipoPago = data.formaPago?.tipo ?? 'Contado';

  if (tipoPago === 'Contado') {
    root.ele('cac:PaymentTerms')
      .ele('cbc:ID').txt('FormaPago').up()
      .ele('cbc:PaymentMeansID').txt('Contado').up()
    .up();
  } else if (tipoPago === 'Credito' && data.formaPago) {
    root.ele('cac:PaymentTerms')
      .ele('cbc:ID').txt('FormaPago').up()
      .ele('cbc:PaymentMeansID').txt('Credito').up()
      .ele('cbc:Amount', { currencyID: data.tipoMoneda }).txt(fmt(data.formaPago.monto ?? data.mtoImpVenta)).up()
    .up();
    for (const cuota of data.cuotas ?? []) {
      root.ele('cac:PaymentTerms')
        .ele('cbc:ID').txt('FormaPago').up()
        .ele('cbc:PaymentMeansID').txt('Cuota').up()
        .ele('cbc:Amount', { currencyID: cuota.moneda }).txt(fmt(cuota.monto)).up()
        .ele('cbc:PaymentDueDate').txt(isoDate(cuota.fechaPago)).up()
      .up();
    }
  }

  // Descuentos globales (AllowanceCharge)
  for (const d of data.descuentos ?? []) {
    root.ele('cac:AllowanceCharge')
      .ele('cbc:ChargeIndicator').txt('false').up()
      .ele('cbc:AllowanceChargeReasonCode').txt(d.codTipo).up()
      .ele('cbc:MultiplierFactorNumeric').txt(fmt(d.factor, 5)).up()
      .ele('cbc:Amount', { currencyID: data.tipoMoneda }).txt(fmt(d.monto)).up()
      .ele('cbc:BaseAmount', { currencyID: data.tipoMoneda }).txt(fmt(d.montoBase)).up()
    .up();
  }

  // Percepcion (sac:SUNATTransaction via AllowanceCharge con code 45)
  if (data.perception) {
    const p = data.perception;
    root.ele('cac:AllowanceCharge')
      .ele('cbc:ChargeIndicator').txt('true').up()
      .ele('cbc:AllowanceChargeReasonCode').txt('45').up()
      .ele('cbc:MultiplierFactorNumeric').txt(fmt(p.porcentaje / 100, 5)).up()
      .ele('cbc:Amount', { currencyID: data.tipoMoneda }).txt(fmt(p.mto)).up()
      .ele('cbc:BaseAmount', { currencyID: data.tipoMoneda }).txt(fmt(p.mtoBase)).up()
    .up();
  }

  addDocumentTaxTotal(root, {
    mtoOperGravadas: data.mtoOperGravadas,
    mtoOperExoneradas: data.mtoOperExoneradas,
    mtoOperInafectas: data.mtoOperInafectas,
    mtoOperExportacion: data.mtoOperExportacion,
    mtoOperGratuitas: data.mtoOperGratuitas,
    mtoIGV: data.mtoIGV,
    mtoIGVGratuitas: data.mtoIGVGratuitas,
    mtoISC: data.mtoISC,
    icbper: data.icbper,
    totalImpuestos: data.totalImpuestos,
    tipoMoneda: data.tipoMoneda,
  });

  addMonetaryTotal(root, {
    mtoOperGravadas: data.mtoOperGravadas,
    mtoOperExoneradas: data.mtoOperExoneradas,
    mtoOperInafectas: data.mtoOperInafectas,
    mtoOperExportacion: data.mtoOperExportacion,
    mtoOperGratuitas: data.mtoOperGratuitas,
    valorVenta: data.valorVenta,
    subTotal: data.subTotal,
    mtoImpVenta: data.mtoImpVenta,
    mtoDescuentos: data.mtoDescuentos,
    redondeo: data.redondeo,
    tipoMoneda: data.tipoMoneda,
  });

  // Lineas de detalle
  data.details.forEach((detail, i) => {
    addInvoiceLine(root, detail, i + 1, data.tipoMoneda, 'cac:InvoiceLine');
  });

  return root.end({ prettyPrint: true });
}

function addDetraccionExtension(root: any, data: InvoicePayload): void {
  const d = data.detraccion!;
  root.ele('cac:AdditionalDocumentReference')
    .ele('cbc:ID').txt('detraccion').up()
    .ele('cac:Attachment')
      .ele('cac:ExternalReference')
        .ele('cbc:URI').txt(
          `#detraccion|${d.codBienDetraccion}|${d.codMedioPago}|${d.ctaBanco ?? ''}|${fmt(d.percent)}|${fmt(d.mount)}`
        ).up()
      .up()
    .up()
  .up();
}
