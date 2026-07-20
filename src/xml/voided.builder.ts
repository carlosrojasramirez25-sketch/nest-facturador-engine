import { create } from 'xmlbuilder2';
import { VoidedPayload } from '../types/sunat.types';
import { NS_VOIDED } from './namespaces';
import { addUblExtensions, addSignatureBlock, isoDate } from './common.builder';

/**
 * Genera el XML de una Comunicacion de Baja (RA) sin firmar.
 * Se usa para dar de baja facturas/boletas ya enviadas.
 */
export function buildVoidedXml(data: VoidedPayload): string {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('VoidedDocuments', NS_VOIDED);

  addUblExtensions(root);

  root.ele('cbc:UBLVersionID').txt('2.1').up();
  root.ele('cbc:CustomizationID').txt('1.0').up();
  root.ele('cbc:ID').txt(`RA-${isoDate(data.fecGeneracion).replace(/-/g, '')}-${data.correlativo}`).up();
  root.ele('cbc:ReferenceDate').txt(isoDate(data.fecGeneracion)).up();
  root.ele('cbc:IssueDate').txt(isoDate(data.fecGeneracion)).up();

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

  // Lineas (documentos a dar de baja)
  data.details.forEach((d, i) => {
    root.ele('sac:VoidedDocumentsLine')
      .ele('cbc:LineID').txt(String(i + 1)).up()
      .ele('cbc:DocumentTypeCode').txt(d.tipoDoc).up()
      .ele('cbc:DocumentSerialID').txt(d.serie).up()
      .ele('cbc:DocumentNumberID').txt(d.correlativo).up()
      .ele('cbc:VoidReasonDescription').txt(d.descripcion ?? 'ERROR EN EMISION').up()
    .up();
  });

  return root.end({ prettyPrint: true });
}
