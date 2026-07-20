import { create } from 'xmlbuilder2';
import { DespatchPayload } from '../types/sunat.types';
import { NS_DESPATCH, CATALOGO_61_GRE } from './namespaces';
import { addUblExtensions, addSignatureBlock, isoDate, isoTime, fmt } from './common.builder';

/**
 * Genera el XML UBL 2.1 de una Guia de Remision Electronica (GRE) sin firmar.
 * Version 2022 segun SUNAT (DespatchAdvice).
 */
export function buildDespatchXml(data: DespatchPayload): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('DespatchAdvice', NS_DESPATCH);

  addUblExtensions(root);

  root.ele('cbc:UBLVersionID').txt('2.1').up();
  root.ele('cbc:CustomizationID').txt('2.0').up();
  root.ele('cbc:ID').txt(`${data.serie}-${data.correlativo}`).up();
  root.ele('cbc:IssueDate').txt(isoDate(data.fechaEmision)).up();
  root.ele('cbc:IssueTime').txt(isoTime(data.fechaEmision)).up();
  root.ele('cbc:DespatchAdviceTypeCode').txt('09').up(); // GRE

  // Documentos relacionados (Catálogo 61) — van ANTES de cac:Signature (UBL spec)
  for (const doc of data.docReferencias ?? []) {
    const ref = root.ele('cac:AdditionalDocumentReference');
    ref.ele('cbc:ID').txt(doc.id).up();
    if (doc.descripcion) ref.ele('cbc:DocumentType').txt(doc.descripcion).up();
    ref.ele('cbc:DocumentTypeCode', {
      listAgencyName: 'PE:SUNAT',
      listName:       'Documento relacionado al transporte',
      listURI:        'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo61',
    }).txt(doc.codigo).up();
    if (doc.rucEmisor) {
      ref.ele('cac:IssuerParty')
        .ele('cac:PartyIdentification')
          .ele('cbc:ID', {
            schemeID:          '6',
            schemeName:        'Documento de Identidad',
            schemeAgencyName:  'PE:SUNAT',
            schemeURI:         'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
          }).txt(doc.rucEmisor).up()
        .up()
      .up();
    }
  }

  addSignatureBlock(root, data.company.ruc, data.company.razonSocial);

  // Emisor (DespatchSupplierParty)
  root.ele('cac:DespatchSupplierParty')
    .ele('cac:Party')
      .ele('cac:PartyIdentification')
        .ele('cbc:ID', { schemeID: '6' }).txt(data.company.ruc).up()
      .up()
      .ele('cac:PartyLegalEntity')
        .ele('cbc:RegistrationName').txt(data.company.razonSocial).up()
      .up()
    .up()
  .up();

  // Destinatario (DeliveryCustomerParty)
  root.ele('cac:DeliveryCustomerParty')
    .ele('cac:Party')
      .ele('cac:PartyIdentification')
        .ele('cbc:ID', { schemeID: data.destinatario.tipoDoc }).txt(data.destinatario.numDoc).up()
      .up()
      .ele('cac:PartyLegalEntity')
        .ele('cbc:RegistrationName').txt(data.destinatario.rznSocial).up()
      .up()
    .up()
  .up();

  // Envio (Shipment)
  const envio = data.envio;
  const shipment = root.ele('cac:Shipment');

  shipment.ele('cbc:ID').txt('ENVIO').up();
  shipment.ele('cbc:HandlingCode').txt(envio.codTraslado).up();
  shipment.ele('cbc:HandlingInstructions').txt(envio.desTraslado).up();
  shipment.ele('cbc:GrossWeightMeasure', { unitCode: envio.undPesoTotal }).txt(fmt(envio.pesoTotal, 3)).up();
  if (envio.numBultos) {
    shipment.ele('cbc:TotalTransportHandlingUnitQuantity').txt(String(envio.numBultos)).up();
  }

  // Indicadores especiales
  for (const ind of envio.indicadores ?? []) {
    shipment.ele('cbc:SpecialInstructions').txt(ind).up();
  }
  if (envio.indicadorVehiculoConductoresTransp) {
    shipment.ele('cbc:SpecialInstructions').txt('SUNAT_Envio_IndicadorVehiculoConductoresTransp').up();
  }

  // GoodsItem
  shipment.ele('cac:GoodsItem')
    .ele('cbc:ID').txt('1').up()
  .up();

  // ShipmentStage - modalidad de traslado
  const stage = shipment.ele('cac:ShipmentStage');
  stage.ele('cbc:ID').txt('1').up();
  stage.ele('cbc:TransportModeCode').txt(envio.modTraslado).up();

  stage.ele('cac:TransitPeriod')
    .ele('cbc:StartDate').txt(isoDate(envio.fecTraslado)).up()
  .up();

  // Transportista (solo modalidad publica 01)
  if (envio.transportista) {
    const t = envio.transportista;
    const carrier = stage.ele('cac:CarrierParty');
    carrier.ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: t.tipoDoc }).txt(t.numDoc).up()
    .up();
    const carrierLegal = carrier.ele('cac:PartyLegalEntity');
    carrierLegal.ele('cbc:RegistrationName').txt(t.rznSocial).up();
    if (t.nroMtc) {
      carrierLegal.ele('cbc:CompanyID').txt(t.nroMtc).up();
    }
  }

  // Choferes
  for (const c of envio.choferes ?? []) {
    const driver = stage.ele('cac:DriverPerson');
    driver.ele('cbc:ID', { schemeID: c.tipoDoc }).txt(c.nroDoc).up();
    driver.ele('cbc:FirstName').txt(c.nombres ?? '').up();
    driver.ele('cbc:FamilyName').txt(c.apellidos ?? '').up();
    driver.ele('cbc:JobTitle').txt(c.tipo === '02' ? 'Secundario' : 'Principal').up();
    driver.ele('cac:IdentityDocumentReference')
      .ele('cbc:ID').txt(c.licencia).up()
    .up();
  }

  if (envio.fecEntregaBienes) {
    stage.ele('cac:LoadingTransportEvent')
      .ele('cbc:OccurrenceDate').txt(isoDate(envio.fecEntregaBienes)).up()
    .up();
  }

  // Delivery: DeliveryAddress (llegada) + Despatch/DespatchAddress (partida)
  const delivery = shipment.ele('cac:Delivery');

  delivery.ele('cac:DeliveryAddress')
    .ele('cbc:ID').txt(envio.llegada.ubigueo ?? '').up()
    .ele('cac:AddressLine')
      .ele('cbc:Line').txt(envio.llegada.direccion).up()
    .up()
  .up();

  const despatch = delivery.ele('cac:Despatch');
  despatch.ele('cac:DespatchAddress')
    .ele('cbc:ID').txt(envio.partida.ubigueo ?? '').up()
    .ele('cac:AddressLine')
      .ele('cbc:Line').txt(envio.partida.direccion).up()
    .up()
  .up();

  // Vehiculo (modalidad privada 02)
  if (envio.vehiculo) {
    const placa = envio.vehiculo.placa.replace(/-/g, '');
    shipment.ele('cac:TransportHandlingUnit')
      .ele('cbc:ID').txt('1').up()
      .ele('cac:TransportEquipment')
        .ele('cbc:ID').txt(placa).up()
      .up()
    .up();
  }

  // Lineas de detalle
  data.details.forEach((d, i) => {
    const line = root.ele('cac:DespatchLine');
    line.ele('cbc:ID').txt(String(i + 1)).up();
    line.ele('cbc:DeliveredQuantity', { unitCode: d.unidad }).txt(fmt(d.cantidad, 3)).up();
    line.ele('cac:OrderLineReference')
      .ele('cbc:LineID').txt(String(i + 1)).up()
    .up();
    line.ele('cac:Item')
      .ele('cbc:Description').txt(d.descripcion).up()
      .ele('cac:SellersItemIdentification')
        .ele('cbc:ID').txt(d.codigo ?? String(i + 1)).up()
      .up()
    .up();
  });

  return root.end({ prettyPrint: true });
}
