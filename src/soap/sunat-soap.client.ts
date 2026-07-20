import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import * as JSZip from 'jszip';

// Endpoints SUNAT por modo
const ENDPOINTS: Record<string, Record<string, string>> = {
  beta: {
    factura:    'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    guia:       'https://e-beta.sunat.gob.pe/ol-ti-itemision-guia-gem-beta/billService',
    percepcion: 'https://e-beta.sunat.gob.pe/ol-ti-itemision-otroscpe-gem-beta/billService',
  },
  produccion: {
    factura:    'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
    guia:       'https://e-guiaremision.sunat.gob.pe/ol-ti-itemision-guia-gem/billService',
    percepcion: 'https://e-factura.sunat.gob.pe/ol-ti-itemision-otroscpe-gem/billService',
  },
};

export type SunatEndpointType = 'factura' | 'guia' | 'percepcion';

export interface SoapSendResult {
  success: boolean;
  ticket?: string;       // para procesos asincronos (RC/RA/GRE)
  cdrZipBase64?: string; // para procesos sincronos
  error?: { code?: string; message: string };
}

/**
 * Cliente SOAP para los Web Services de SUNAT.
 *
 * SUNAT usa SOAP 1.1 con autenticacion Basic Auth:
 *   usuario = RUC + solUser (ej: "20123456789JOHNSMITH")
 *   contrasena = solPass
 *
 * Metodos:
 *   sendBill    -> sincrono  (facturas, boletas, NC, ND)
 *   sendSummary -> asincrono (RC, RA, GRE) -> retorna ticket
 *   getStatus   -> consulta estado de ticket
 */
@Injectable()
export class SunatSoapClient {
  private readonly logger = new Logger(SunatSoapClient.name);

  async sendBill(params: {
    ruc: string;
    solUser: string;
    solPass: string;
    fileName: string;
    xmlSigned: string;
    mode?: 'beta' | 'produccion';
    endpointType?: SunatEndpointType;
  }): Promise<SoapSendResult> {
    const endpoint = this.getEndpoint(params.mode ?? 'beta', params.endpointType ?? 'factura');
    const zipBase64 = await this.createZip(params.fileName, params.xmlSigned);

    const soapBody = this.buildSendBillEnvelope(params.fileName, zipBase64);
    const auth = this.buildAuth(params.ruc, params.solUser, params.solPass);

    try {
      const response = await axios.post(endpoint, soapBody, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '',
          'Authorization': `Basic ${auth}`,
        },
        timeout: 60_000,
      });

      return this.parseSendBillResponse(response.data);
    } catch (err) {
      return this.handleSoapError(err as AxiosError, 'sendBill');
    }
  }

  async sendSummary(params: {
    ruc: string;
    solUser: string;
    solPass: string;
    fileName: string;
    xmlSigned: string;
    mode?: 'beta' | 'produccion';
    endpointType?: SunatEndpointType;
  }): Promise<SoapSendResult> {
    const endpoint = this.getEndpoint(params.mode ?? 'beta', params.endpointType ?? 'factura');
    const zipBase64 = await this.createZip(params.fileName, params.xmlSigned);

    const soapBody = this.buildSendSummaryEnvelope(params.fileName, zipBase64);
    const auth = this.buildAuth(params.ruc, params.solUser, params.solPass);

    try {
      const response = await axios.post(endpoint, soapBody, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '',
          'Authorization': `Basic ${auth}`,
        },
        timeout: 60_000,
      });

      return this.parseSendSummaryResponse(response.data);
    } catch (err) {
      return this.handleSoapError(err as AxiosError, 'sendSummary');
    }
  }

  async getStatus(params: {
    ruc: string;
    solUser: string;
    solPass: string;
    ticket: string;
    mode?: 'beta' | 'produccion';
    endpointType?: SunatEndpointType;
  }): Promise<SoapSendResult> {
    const endpoint = this.getEndpoint(params.mode ?? 'beta', params.endpointType ?? 'factura');
    const soapBody = this.buildGetStatusEnvelope(params.ticket);
    const auth = this.buildAuth(params.ruc, params.solUser, params.solPass);

    try {
      const response = await axios.post(endpoint, soapBody, {
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '',
          'Authorization': `Basic ${auth}`,
        },
        timeout: 30_000,
      });

      return this.parseGetStatusResponse(response.data);
    } catch (err) {
      return this.handleSoapError(err as AxiosError, 'getStatus');
    }
  }

  // ---------- Builders de envelopes SOAP ----------

  private buildSendBillEnvelope(fileName: string, contentBase64: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ser:sendBill>
      <fileName>${this.escapeXml(fileName)}</fileName>
      <contentFile>${contentBase64}</contentFile>
    </ser:sendBill>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  private buildSendSummaryEnvelope(fileName: string, contentBase64: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ser:sendSummary>
      <fileName>${this.escapeXml(fileName)}</fileName>
      <contentFile>${contentBase64}</contentFile>
    </ser:sendSummary>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  private buildGetStatusEnvelope(ticket: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope
  xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <ser:getStatus>
      <ticket>${this.escapeXml(ticket)}</ticket>
    </ser:getStatus>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  // ---------- Parsers de respuesta SOAP ----------

  private parseSendBillResponse(soapXml: string): SoapSendResult {
    const cdrMatch = soapXml.match(/<applicationResponse[^>]*>([\s\S]*?)<\/applicationResponse>/i);
    if (cdrMatch?.[1]) {
      return { success: true, cdrZipBase64: cdrMatch[1].trim() };
    }
    return this.parseSoapFault(soapXml);
  }

  private parseSendSummaryResponse(soapXml: string): SoapSendResult {
    const ticketMatch = soapXml.match(/<ticket[^>]*>([\s\S]*?)<\/ticket>/i);
    if (ticketMatch?.[1]) {
      return { success: true, ticket: ticketMatch[1].trim() };
    }
    return this.parseSoapFault(soapXml);
  }

  private parseGetStatusResponse(soapXml: string): SoapSendResult {
    const statusCodeMatch = soapXml.match(/<statusCode[^>]*>([\s\S]*?)<\/statusCode>/i);
    const contentMatch = soapXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i);

    if (statusCodeMatch?.[1] === '0' && contentMatch?.[1]) {
      return { success: true, cdrZipBase64: contentMatch[1].trim() };
    }
    if (statusCodeMatch?.[1] === '98') {
      return { success: false, error: { code: '98', message: 'Ticket en proceso, vuelva a intentar' } };
    }
    return this.parseSoapFault(soapXml);
  }

  private parseSoapFault(soapXml: string): SoapSendResult {
    const faultString = soapXml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)?.[1];
    const faultCode = soapXml.match(/<faultcode[^>]*>([\s\S]*?)<\/faultcode>/i)?.[1];
    return {
      success: false,
      error: {
        code: faultCode ?? 'SOAP_FAULT',
        message: faultString ?? 'Error SOAP desconocido',
      },
    };
  }

  private handleSoapError(err: AxiosError, method: string): SoapSendResult {
    if (err.response?.data) {
      const data = err.response.data as string;
      if (typeof data === 'string' && data.includes('faultstring')) {
        return this.parseSoapFault(data);
      }
    }
    this.logger.error(`Error ${method}: ${err.message}`);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: err.message },
    };
  }

  // ---------- Helpers ----------

  private getEndpoint(mode: 'beta' | 'produccion', type: SunatEndpointType): string {
    return ENDPOINTS[mode][type] ?? ENDPOINTS[mode].factura;
  }

  private buildAuth(ruc: string, solUser: string, solPass: string): string {
    return Buffer.from(`${ruc}${solUser}:${solPass}`).toString('base64');
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async createZip(zipFileName: string, xmlContent: string): Promise<string> {
    const zip = new JSZip();
    const xmlFileName = zipFileName.replace(/\.zip$/i, '.xml');
    zip.file(xmlFileName, xmlContent, { compression: 'DEFLATE' });
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return zipBuffer.toString('base64');
  }

  buildZipFileName(ruc: string, tipoDoc: string, serie: string, correlativo: string): string {
    return `${ruc}-${tipoDoc}-${serie}-${correlativo}.zip`;
  }

  buildSummaryFileName(ruc: string, tipo: 'RC' | 'RA', fecha: string, correlativo: string): string {
    const dateStr = fecha.slice(0, 10).replace(/-/g, '');
    return `${ruc}-${tipo}-${dateStr}-${correlativo}.zip`;
  }

  buildDespatchFileName(ruc: string, serie: string, correlativo: string): string {
    return `${ruc}-09-${serie}-${correlativo}.zip`;
  }
}
