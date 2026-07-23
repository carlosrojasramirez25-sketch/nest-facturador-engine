import { Injectable } from '@nestjs/common';
import { SunatSoapClient, SoapSendResult } from './sunat-soap.client';

/**
 * Cliente SOAP simulado para pruebas.
 *
 * Reemplaza al SunatSoapClient real en tests: no realiza ninguna
 * llamada HTTP — devuelve respuestas simuladas válidas que el
 * CdrParserService puede parsear sin tocar los servidores SUNAT.
 *
 * Uso en NestJS Test:
 *
 *   await Test.createTestingModule({
 *     imports: [SunatEngineModule.forRoot({ sunat: { ... } })],
 *   })
 *   .overrideProvider(SunatSoapClient)
 *   .useClass(FakeSunatSoapClient)
 *   .compile();
 */
@Injectable()
export class FakeSunatSoapClient extends SunatSoapClient {
  private ticketCounter = 1_000_000_000;

  override async sendBill(params: Parameters<SunatSoapClient['sendBill']>[0]): Promise<SoapSendResult> {
    const cdrZipBase64 = await this.buildFakeCdrZip(params.fileName);
    return { success: true, cdrZipBase64 };
  }

  override async sendSummary(params: Parameters<SunatSoapClient['sendSummary']>[0]): Promise<SoapSendResult> {
    return { success: true, ticket: String(++this.ticketCounter) };
  }

  override async getStatus(params: Parameters<SunatSoapClient['getStatus']>[0]): Promise<SoapSendResult> {
    const cdrZipBase64 = await this.buildFakeCdrZip(`TICKET-${params.ticket}`);
    return { success: true, cdrZipBase64 };
  }

  private async buildFakeCdrZip(refFileName: string): Promise<string> {
    const baseName = refFileName.replace(/\.zip$/i, '');
    const today = new Date().toISOString().slice(0, 10);
    const cdrXml = `<?xml version="1.0" encoding="UTF-8"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>1</cbc:ID>
  <cbc:ResponseDate>${today}</cbc:ResponseDate>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ResponseCode>0</cbc:ResponseCode>
      <cbc:Description>El Comprobante ha sido aceptado [FakeSunatSoapClient]</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ApplicationResponse>`;
    // createZip() reemplaza .zip -> .xml; el nombre R-*.xml es detectado por CdrParserService
    return this.createZip(`R-${baseName}.zip`, cdrXml);
  }
}
