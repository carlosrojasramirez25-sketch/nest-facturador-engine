import { Injectable, Logger, Inject } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';
import * as JSZip from 'jszip';
import { SUNAT_ENGINE_OPTIONS } from '../constants';
import { SunatEngineOptions } from '../sunat-engine.module';

/**
 * Cliente REST para la Guia de Remision Electronica (GRE) 2022.
 *
 * SUNAT usa OAuth 2.0 con grant_type=password (Resource Owner Password).
 *
 * Flujo:
 *  1. POST {authUrl}/clientessol/{clientId}/oauth2/token/
 *       → access_token
 *
 *  2. POST {apiUrl}/contribuyente/gem/comprobantes/{fileName}
 *       → numTicket
 *
 *  3. GET  {apiUrl}/contribuyente/gem/comprobantes/envios/{ticket}
 *       → codRespuesta, arcCdr
 *
 * Test (Nubefact/Greenter):
 *   authUrl = https://gre-test.nubefact.com/v1
 *   apiUrl  = https://gre-test.nubefact.com/v1
 */
@Injectable()
export class SunatGreClient {
  private readonly logger = new Logger(SunatGreClient.name);

  private readonly defaultAuthUrl: string;
  private readonly defaultApiUrl: string;
  private readonly defaultClientId: string;
  private readonly defaultClientSecret: string;
  private readonly defaultGreRuc: string;
  private readonly defaultGreSolUser: string;
  private readonly defaultGreSolPass: string;
  private readonly defaultScope: string;

  constructor(@Inject(SUNAT_ENGINE_OPTIONS) options: SunatEngineOptions) {
    const gre = options.gre ?? {};
    this.defaultAuthUrl      = gre.authUrl      ?? 'https://gre-test.nubefact.com/v1';
    this.defaultApiUrl       = gre.apiUrl        ?? 'https://gre-test.nubefact.com/v1';
    this.defaultClientId     = gre.clientId      ?? 'test-85e5b0ae-255c-4891-a595-0b98c65c9854';
    this.defaultClientSecret = gre.clientSecret  ?? 'test-Hty/M6QshYvPgItX2P0+Kw==';
    this.defaultGreRuc       = gre.solRuc        ?? '';
    this.defaultGreSolUser   = gre.solUser       ?? '';
    this.defaultGreSolPass   = gre.solPass       ?? '';
    this.defaultScope        = gre.scope         ?? 'https://api-cpe.sunat.gob.pe';
  }

  async sendGRE(params: {
    ruc: string;
    solUser: string;
    solPass: string;
    serie: string;
    correlativo: string;
    signedXml: string;
    clientId?: string;
    clientSecret?: string;
    authUrl?: string;
    apiUrl?: string;
  }): Promise<{ success: boolean; ticket?: string; error?: { code?: string; message: string } }> {
    const clientId     = params.clientId     ?? this.defaultClientId;
    const clientSecret = params.clientSecret ?? this.defaultClientSecret;
    const authUrl      = (params.authUrl     ?? this.defaultAuthUrl).replace(/\/$/, '');
    const apiUrl       = (params.apiUrl      ?? this.defaultApiUrl).replace(/\/$/, '');

    const greRuc     = this.defaultGreRuc     || params.ruc;
    const greSolUser = this.defaultGreSolUser || params.solUser;
    const greSolPass = this.defaultGreSolPass || params.solPass;

    const token = await this.getToken({ authUrl, clientId, clientSecret, ruc: greRuc, solUser: greSolUser, solPass: greSolPass });
    if (!token) {
      return { success: false, error: { code: 'AUTH_ERROR', message: 'No se pudo obtener token OAuth para GRE' } };
    }

    const fileName = `${params.ruc}-09-${params.serie}-${params.correlativo}`;
    const zipBase64 = await this.createZip(`${fileName}.xml`, params.signedXml);
    const hashZip   = crypto.createHash('sha256').update(Buffer.from(zipBase64, 'base64')).digest('hex');

    try {
      const res = await axios.post(
        `${apiUrl}/contribuyente/gem/comprobantes/${fileName}`,
        {
          archivo: {
            nomArchivo: `${fileName}.zip`,
            arcGreZip:  zipBase64,
            hashZip,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 60_000,
        },
      );

      const ticket = res.data?.numTicket ?? res.data?.ticket;
      if (ticket) {
        this.logger.log(`GRE enviada → ticket: ${ticket}`);
        return { success: true, ticket: String(ticket) };
      }

      this.logger.warn('GRE sin ticket:', JSON.stringify(res.data));
      return { success: false, error: { message: JSON.stringify(res.data) } };

    } catch (err) {
      return this.handleError(err as AxiosError, 'sendGRE');
    }
  }

  async getStatus(params: {
    ruc: string;
    solUser: string;
    solPass: string;
    ticket: string;
    clientId?: string;
    clientSecret?: string;
    authUrl?: string;
    apiUrl?: string;
  }): Promise<{ success: boolean; code?: string; cdrZipBase64?: string; error?: { code?: string; message: string } }> {
    const clientId     = params.clientId     ?? this.defaultClientId;
    const clientSecret = params.clientSecret ?? this.defaultClientSecret;
    const authUrl      = (params.authUrl     ?? this.defaultAuthUrl).replace(/\/$/, '');
    const apiUrl       = (params.apiUrl      ?? this.defaultApiUrl).replace(/\/$/, '');

    const greRuc2     = this.defaultGreRuc     || params.ruc;
    const greSolUser2 = this.defaultGreSolUser || params.solUser;
    const greSolPass2 = this.defaultGreSolPass || params.solPass;
    const token = await this.getToken({ authUrl, clientId, clientSecret, ruc: greRuc2, solUser: greSolUser2, solPass: greSolPass2 });
    if (!token) return { success: false, error: { code: 'AUTH_ERROR', message: 'No se pudo obtener token GRE' } };

    try {
      const res = await axios.get(
        `${apiUrl}/contribuyente/gem/comprobantes/envios/${params.ticket}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 },
      );

      const data = res.data;
      const code = data?.codRespuesta;

      if (code === '98') {
        return { success: false, error: { code: '98', message: 'GRE en proceso por SUNAT' } };
      }

      if (data?.error?.numError && !data?.arcCdr) {
        return {
          success: false,
          error: {
            code: String(data.error.numError),
            message: data.error.desError ?? `SUNAT error ${data.error.numError}`,
          },
        };
      }

      const cdrZipBase64 = data?.arcCdr ?? undefined;
      return { success: true, code, cdrZipBase64 };

    } catch (err) {
      return this.handleError(err as AxiosError, 'getStatus');
    }
  }

  // ---------- OAuth token ----------

  private async getToken(p: {
    authUrl: string;
    clientId: string;
    clientSecret: string;
    ruc: string;
    solUser: string;
    solPass: string;
  }): Promise<string | null> {
    const tokenUrl = `${p.authUrl}/clientessol/${p.clientId}/oauth2/token/`;

    const body = new URLSearchParams({
      grant_type:    'password',
      scope:         this.defaultScope,
      client_id:     p.clientId,
      client_secret: p.clientSecret,
      username:      `${p.ruc}${p.solUser}`,
      password:      p.solPass,
    });

    try {
      const res = await axios.post(tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15_000,
      });
      const token = res.data?.access_token;
      if (token) this.logger.log('Token GRE obtenido');
      return token ?? null;
    } catch (err: any) {
      this.logger.error(`GRE OAuth [${p.authUrl}]: ${err.response?.status} ${err.message}`);
      return null;
    }
  }

  // ---------- Helpers ----------

  private async createZip(xmlFileName: string, xmlContent: string): Promise<string> {
    const zip = new JSZip();
    zip.file(xmlFileName, xmlContent, { compression: 'DEFLATE' });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    return buf.toString('base64');
  }

  private handleError(err: AxiosError, method: string) {
    const data = err.response?.data as any;
    const code = data?.cod ?? data?.errors?.[0]?.cod ?? String(err.response?.status ?? 'NET');
    const msg  = data?.msg ?? data?.errors?.[0]?.msg ?? data?.message ?? err.message;
    this.logger.error(`GRE ${method} [${err.response?.status}]: ${msg}`, data);
    return { success: false as const, error: { code, message: msg } };
  }
}
