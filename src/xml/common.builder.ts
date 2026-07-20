import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { CompanySunat, ClientSunat, DetailSunat, LegendSunat } from '../types/sunat.types';
import { TRIBUTOS, tipAfeToPreType, tipAfeToTributo } from './namespaces';

// ---------- Helpers de formateo ----------

export function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

export function isoDate(datetime: string): string {
  return datetime.slice(0, 10);
}

export function isoTime(datetime: string): string {
  const t = datetime.slice(11, 19);
  return t || '00:00:00';
}

// ---------- Bloque UBLExtensions (placeholder para firma) ----------

export function addUblExtensions(root: XMLBuilder): void {
  root.ele('ext:UBLExtensions')
    .ele('ext:UBLExtension')
      .ele('ext:ExtensionContent')
      .up()
    .up()
  .up();
}

// ---------- Bloque de firma (cac:Signature) ----------

export function addSignatureBlock(root: XMLBuilder, ruc: string, razonSocial: string): void {
  root.ele('cac:Signature')
    .ele('cbc:ID').txt('SignatureSP').up()
    .ele('cac:SignatoryParty')
      .ele('cac:PartyIdentification')
        .ele('cbc:ID').txt(ruc).up()
      .up()
      .ele('cac:PartyName')
        .ele('cbc:Name').txt(razonSocial).up()
      .up()
    .up()
    .ele('cac:DigitalSignatureAttachment')
      .ele('cac:ExternalReference')
        .ele('cbc:URI').txt('#SignatureSP').up()
      .up()
    .up()
  .up();
}

// ---------- Emisor (AccountingSupplierParty) ----------

export function addSupplierParty(root: XMLBuilder, company: CompanySunat): void {
  const addr = company.address ?? {};
  const party = root.ele('cac:AccountingSupplierParty')
    .ele('cac:Party');

  party.ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: '6' }).txt(company.ruc).up()
  .up();

  party.ele('cac:PartyName')
    .ele('cbc:Name').txt(company.nombreComercial ?? company.razonSocial).up()
  .up();

  party.ele('cac:PartyTaxScheme')
    .ele('cbc:RegistrationName').txt(company.razonSocial).up()
    .ele('cbc:CompanyID', { schemeID: '6' }).txt(company.ruc).up()
    .ele('cac:TaxScheme')
      .ele('cbc:ID').txt('6').up()
      .ele('cbc:Name').txt('RUC').up()
      .ele('cbc:TaxTypeCode').txt('VAT').up()
    .up()
  .up();

  const legalEntity = party.ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName').txt(company.razonSocial).up();

  const regAddr = legalEntity.ele('cac:RegistrationAddress');
  if (addr.ubigueo) regAddr.ele('cbc:ID').txt(addr.ubigueo).up();
  regAddr.ele('cbc:AddressTypeCode').txt(addr.codLocal ?? '0000').up();
  regAddr.ele('cbc:CitySubdivisionName').txt(addr.urbanizacion ?? '-').up();
  if (addr.departamento) regAddr.ele('cbc:CityName').txt(addr.departamento).up();
  if (addr.provincia) regAddr.ele('cbc:CountrySubentity').txt(addr.provincia).up();
  if (addr.distrito) regAddr.ele('cbc:District').txt(addr.distrito).up();
  if (addr.direccion) {
    regAddr.ele('cac:AddressLine')
      .ele('cbc:Line').txt(addr.direccion).up()
    .up();
  }
  regAddr.ele('cac:Country')
    .ele('cbc:IdentificationCode').txt('PE').up()
  .up();
}

// ---------- Receptor (AccountingCustomerParty) ----------

export function addCustomerParty(root: XMLBuilder, client: ClientSunat): void {
  const party = root.ele('cac:AccountingCustomerParty')
    .ele('cac:Party');

  party.ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: client.tipoDoc }).txt(client.numDoc).up()
  .up();

  party.ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName').txt(client.rznSocial).up()
  .up();

  if (client.address?.direccion) {
    party.ele('cac:PostalAddress')
      .ele('cac:AddressLine')
        .ele('cbc:Line').txt(client.address.direccion).up()
      .up()
    .up();
  }
}

// ---------- Tax subtotal (TaxSubtotal) ----------

function addTaxSubtotal(
  taxTotal: XMLBuilder,
  taxableAmount: number,
  taxAmount: number,
  taxKey: string,
  percent?: number,
  exemptionCode?: string,
  currency?: string,
): void {
  const tributo = TRIBUTOS[taxKey] ?? TRIBUTOS.IGV;
  const cur = currency ?? 'PEN';
  const sub = taxTotal.ele('cac:TaxSubtotal');
  sub.ele('cbc:TaxableAmount', { currencyID: cur }).txt(fmt(taxableAmount)).up();
  sub.ele('cbc:TaxAmount', { currencyID: cur }).txt(fmt(taxAmount)).up();
  const cat = sub.ele('cac:TaxCategory');
  cat.ele('cbc:ID', { schemeAgencyName: 'PE:SUNAT', schemeName: 'Codigo de tributos' }).txt(tributo.id).up();
  if (percent != null) cat.ele('cbc:Percent').txt(String(percent)).up();
  if (exemptionCode) cat.ele('cbc:TaxExemptionReasonCode').txt(exemptionCode).up();
  cat.ele('cac:TaxScheme')
    .ele('cbc:ID').txt(tributo.id).up()
    .ele('cbc:Name').txt(tributo.name).up()
    .ele('cbc:TaxTypeCode').txt(tributo.typeCode).up()
  .up();
}

// ---------- TaxTotal a nivel de documento ----------

export function addDocumentTaxTotal(
  root: XMLBuilder,
  data: {
    mtoOperGravadas?: number;
    mtoOperExoneradas?: number;
    mtoOperInafectas?: number;
    mtoOperExportacion?: number;
    mtoOperGratuitas?: number;
    mtoIGV: number;
    mtoIGVGratuitas?: number;
    mtoISC?: number;
    icbper?: number;
    totalImpuestos: number;
    tipoMoneda: string;
  },
): void {
  const cur = data.tipoMoneda;
  const taxTotal = root.ele('cac:TaxTotal');
  taxTotal.ele('cbc:TaxAmount', { currencyID: cur }).txt(fmt(data.totalImpuestos)).up();

  if ((data.mtoOperGravadas ?? 0) > 0) {
    addTaxSubtotal(taxTotal, data.mtoOperGravadas!, data.mtoIGV, 'IGV', 18, undefined, cur);
  }
  if ((data.mtoIGVGratuitas ?? 0) > 0) {
    addTaxSubtotal(taxTotal, data.mtoOperGratuitas ?? 0, data.mtoIGVGratuitas!, 'GRA', 18, undefined, cur);
  }
  if ((data.mtoISC ?? 0) > 0) {
    addTaxSubtotal(taxTotal, data.mtoOperGravadas ?? 0, data.mtoISC!, 'ISC', undefined, undefined, cur);
  }
  if ((data.mtoOperExoneradas ?? 0) > 0) {
    addTaxSubtotal(taxTotal, data.mtoOperExoneradas!, 0, 'EXO', 0, undefined, cur);
  }
  if ((data.mtoOperInafectas ?? 0) > 0) {
    addTaxSubtotal(taxTotal, data.mtoOperInafectas!, 0, 'INA', 0, undefined, cur);
  }
  if ((data.mtoOperExportacion ?? 0) > 0) {
    addTaxSubtotal(taxTotal, data.mtoOperExportacion!, 0, 'EXP', 0, undefined, cur);
  }
  if ((data.icbper ?? 0) > 0) {
    addTaxSubtotal(taxTotal, 0, data.icbper!, 'ICBPER', undefined, undefined, cur);
  }
}

// ---------- LegalMonetaryTotal ----------

// DebitNote usa RequestedMonetaryTotal; Invoice y CreditNote usan LegalMonetaryTotal
export function addMonetaryTotal(
  root: XMLBuilder,
  data: {
    mtoOperGravadas?: number;
    mtoOperExoneradas?: number;
    mtoOperInafectas?: number;
    mtoOperExportacion?: number;
    mtoOperGratuitas?: number;
    valorVenta: number;
    subTotal: number;
    mtoImpVenta: number;
    mtoDescuentos?: number;
    redondeo?: number;
    tipoMoneda: string;
    elementName?: string; // 'cac:LegalMonetaryTotal' | 'cac:RequestedMonetaryTotal'
  },
): void {
  const cur = data.tipoMoneda;
  const total = root.ele(data.elementName ?? 'cac:LegalMonetaryTotal');
  total.ele('cbc:LineExtensionAmount', { currencyID: cur }).txt(fmt(data.valorVenta)).up();
  total.ele('cbc:TaxExclusiveAmount', { currencyID: cur }).txt(fmt(data.subTotal)).up();
  total.ele('cbc:TaxInclusiveAmount', { currencyID: cur }).txt(fmt(data.mtoImpVenta)).up();
  if ((data.mtoDescuentos ?? 0) > 0) {
    total.ele('cbc:AllowanceTotalAmount', { currencyID: cur }).txt(fmt(data.mtoDescuentos!)).up();
  }
  if (data.redondeo != null) {
    total.ele('cbc:PayableRoundingAmount', { currencyID: cur }).txt(fmt(data.redondeo)).up();
  }
  total.ele('cbc:PayableAmount', { currencyID: cur }).txt(fmt(data.mtoImpVenta)).up();
}

// ---------- InvoiceLine (linea de detalle) ----------

export function addInvoiceLine(
  root: XMLBuilder,
  detail: DetailSunat,
  index: number,
  currency: string,
  elementName = 'cac:InvoiceLine',
): void {
  const qtyTag =
    elementName === 'cac:CreditNoteLine' ? 'cbc:CreditedQuantity' :
    elementName === 'cac:DebitNoteLine'  ? 'cbc:DebitedQuantity'  :
    'cbc:InvoicedQuantity';

  const line = root.ele(elementName);
  line.ele('cbc:ID').txt(String(index)).up();
  line.ele(qtyTag, { unitCode: detail.unidad }).txt(fmt(detail.cantidad, 10)).up();
  line.ele('cbc:LineExtensionAmount', { currencyID: currency }).txt(fmt(detail.mtoValorVenta)).up();

  // PricingReference (precio de venta al publico)
  const priceTypeCode = tipAfeToPreType(detail.tipAfeIgv);
  const precioRef = priceTypeCode === '02' ? detail.mtoValorGratuito ?? 0 : detail.mtoPrecioUnitario;
  line.ele('cac:PricingReference')
    .ele('cac:AlternativeConditionPrice')
      .ele('cbc:PriceAmount', { currencyID: currency }).txt(fmt(precioRef)).up()
      .ele('cbc:PriceTypeCode').txt(priceTypeCode).up()
    .up()
  .up();

  // TaxTotal de la linea
  const lineTax = line.ele('cac:TaxTotal');
  lineTax.ele('cbc:TaxAmount', { currencyID: currency }).txt(fmt(detail.totalImpuestos)).up();

  // IGV (o exonerado/inafecto/exportacion)
  const tributo = tipAfeToTributo(detail.tipAfeIgv);
  const lineSub = lineTax.ele('cac:TaxSubtotal');
  lineSub.ele('cbc:TaxableAmount', { currencyID: currency }).txt(fmt(detail.mtoBaseIgv)).up();
  lineSub.ele('cbc:TaxAmount', { currencyID: currency }).txt(fmt(detail.igv)).up();
  const lineCat = lineSub.ele('cac:TaxCategory');
  lineCat.ele('cbc:ID', { schemeAgencyName: 'PE:SUNAT', schemeName: 'Codigo de tributos' }).txt(tributo.id).up();
  lineCat.ele('cbc:Percent').txt(fmt(detail.porcentajeIgv, 2)).up();
  lineCat.ele('cbc:TaxExemptionReasonCode').txt(detail.tipAfeIgv).up();
  lineCat.ele('cac:TaxScheme')
    .ele('cbc:ID').txt(tributo.id).up()
    .ele('cbc:Name').txt(tributo.name).up()
    .ele('cbc:TaxTypeCode').txt(tributo.typeCode).up()
  .up();

  // ISC
  if ((detail.isc ?? 0) > 0) {
    const iscSub = lineTax.ele('cac:TaxSubtotal');
    iscSub.ele('cbc:TaxableAmount', { currencyID: currency }).txt(fmt(detail.mtoBaseIgv)).up();
    iscSub.ele('cbc:TaxAmount', { currencyID: currency }).txt(fmt(detail.isc!)).up();
    const iscCat = iscSub.ele('cac:TaxCategory');
    iscCat.ele('cbc:ID', { schemeAgencyName: 'PE:SUNAT', schemeName: 'Codigo de tributos' }).txt(TRIBUTOS.ISC.id).up();
    iscCat.ele('cbc:Percent').txt(fmt(detail.porcentajeIsc ?? 0)).up();
    if (detail.tipSisIsc) iscCat.ele('cbc:TierRange').txt(detail.tipSisIsc).up();
    iscCat.ele('cac:TaxScheme')
      .ele('cbc:ID').txt(TRIBUTOS.ISC.id).up()
      .ele('cbc:Name').txt(TRIBUTOS.ISC.name).up()
      .ele('cbc:TaxTypeCode').txt(TRIBUTOS.ISC.typeCode).up()
    .up();
  }

  // ICBPER
  if ((detail.icbper ?? 0) > 0) {
    const icbSub = lineTax.ele('cac:TaxSubtotal');
    icbSub.ele('cbc:TaxableAmount', { currencyID: currency }).txt(fmt(detail.cantidad, 2)).up();
    icbSub.ele('cbc:TaxAmount', { currencyID: currency }).txt(fmt(detail.icbper!)).up();
    const icbCat = icbSub.ele('cac:TaxCategory');
    icbCat.ele('cbc:ID', { schemeAgencyName: 'PE:SUNAT', schemeName: 'Codigo de tributos' }).txt(TRIBUTOS.ICBPER.id).up();
    icbCat.ele('cbc:Percent').txt(fmt(detail.factorIcbper ?? 0.3)).up();
    icbCat.ele('cac:TaxScheme')
      .ele('cbc:ID').txt(TRIBUTOS.ICBPER.id).up()
      .ele('cbc:Name').txt(TRIBUTOS.ICBPER.name).up()
      .ele('cbc:TaxTypeCode').txt(TRIBUTOS.ICBPER.typeCode).up()
    .up();
  }

  // Item
  const item = line.ele('cac:Item');
  item.ele('cbc:Description').txt(detail.descripcion).up();
  if (detail.codProducto) {
    item.ele('cac:SellersItemIdentification')
      .ele('cbc:ID').txt(String(detail.codProducto)).up()
    .up();
  }
  if (detail.codProdSunat) {
    item.ele('cac:CommodityClassification')
      .ele('cbc:ItemClassificationCode', {
        listID: 'UNSPSC',
        listAgencyName: 'GS1 US',
        listName: 'Item Classification',
      }).txt(detail.codProdSunat).up()
    .up();
  }

  // Price (valor unitario sin IGV)
  line.ele('cac:Price')
    .ele('cbc:PriceAmount', { currencyID: currency }).txt(fmt(detail.mtoValorUnitario)).up()
  .up();
}

// ---------- Leyendas ----------

export function addLegends(root: XMLBuilder, legends: LegendSunat[]): void {
  for (const l of legends) {
    root.ele('cbc:Note', { languageLocaleID: l.code }).txt(l.value).up();
  }
}
