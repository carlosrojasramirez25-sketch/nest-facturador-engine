import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import * as JSZip from 'jszip';
import { SoapSendResult } from '../soap/sunat-soap.client';

export interface OseClientOptions {
  url: string;
  token?: string;
  username?: string;
  password?: string;
}

/**
 * Cliente REST genérico para OSE (Operador de Servicios Electrónicos).
 *
 * Compatible con los OSE autorizados por SUNAT que aceptan el estándar:
 *   POST {url}
 *   Authorization: Bearer {token}  |  Basic {base64(user:pass)}
 *   Body: { fileName, contentFile }  (contentFile = ZIP en base64)
 *
 * Proveedores compatibles: Nubefact, EFACT, DigiFlow, Bizlinks, entre otros.
 */
@Injectable()
export class OseClient {
  private readonly logger = new Logger(OseClient.name);

  async sendBill(params: {
    fileName: string;
    xmlSigned: string;
    ose: OseClientOptions;
  }): Promise<SoapSendResult> {
    const contentFile = await this.createZip(params.fileName, params.xmlSigned);

    try {
      const response = await axios.post(
        params.ose.url,
        { fileName: params.fileName.replace(/\.zip$/i, ''), contentFile },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.buildAuth(params.ose),
          },
          timeout: 60_000,
        },
      );

      return this.parseResponse(response.data);
    } catch (err) {
      return this.handleError(err as AxiosError);
    }
  }

  async sendSummary(params: {
    fileName: string;
    xmlSigned: string;
    ose: OseClientOptions;
  }): Promise<SoapSendResult> {
    const contentFile = await this.createZip(params.fileName, params.xmlSigned);

    try {
      const response = await axios.post(
        params.ose.url,
        { fileName: params.fileName.replace(/\.zip$/i, ''), contentFile },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.buildAuth(params.ose),
          },
          timeout: 60_000,
        },
      );

      return this.parseResponse(response.data);
    } catch (err) {
      return this.handleError(err as AxiosError);
    }
  }

  private parseResponse(data: any): SoapSendResult {
    if (!data) {
      return { success: false, error: { code: 'EMPTY_RESPONSE', message: 'El OSE no devolvió respuesta' } };
    }

    const cdrZip: string | undefined = data.cdrZip || data.cdr || data.applicationResponse || data.contentFile || undefined;
    const ticket: string | undefined = data.ticket ?? data.numTicket;

    const codeRaw = data.cdrResponse?.code ?? data.code ?? data.codigoRespuesta;
    const code = codeRaw !== undefined ? String(codeRaw) : undefined;
    const description: string | undefined = data.cdrResponse?.description ?? data.description ?? data.descripcion;
    const success: boolean = data.success !== undefined ? Boolean(data.success) : code === '0';

    if (!success) {
      return {
        success: false,
        error: {
          code: code ?? 'OSE_ERROR',
          message: description ?? 'Error devuelto por el OSE',
        },
      };
    }

    return { success: true, cdrZipBase64: cdrZip, ticket };
  }

  private buildAuth(ose: OseClientOptions): string {
    if (ose.token) return `Bearer ${ose.token}`;
    if (ose.username && ose.password) {
      return `Basic ${Buffer.from(`${ose.username}:${ose.password}`).toString('base64')}`;
    }
    return '';
  }

  private handleError(err: AxiosError): SoapSendResult {
    const data = err.response?.data as any;
    if (data) {
      const msg: string = data.message ?? data.description ?? data.descripcion ?? JSON.stringify(data);
      const code: string = String(data.code ?? data.codigoRespuesta ?? err.response?.status ?? 'OSE_ERROR');
      return { success: false, error: { code, message: msg } };
    }
    this.logger.error(`Error OSE: ${err.message}`);
    return { success: false, error: { code: 'NETWORK_ERROR', message: err.message } };
  }

  private async createZip(fileName: string, xmlContent: string): Promise<string> {
    const zip = new JSZip();
    const xmlFileName = fileName.replace(/\.zip$/i, '.xml');
    zip.file(xmlFileName, xmlContent, { compression: 'DEFLATE' });
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return zipBuffer.toString('base64');
  }
}
