import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  CompanyCredentials,
  EngineResponse,
  InvoicePayload,
  NotePayload,
  DespatchPayload,
  SummaryPayload,
  VoidedPayload,
} from './types/sunat.types';
import { buildInvoiceXml } from './xml/invoice.builder';
import { buildNoteXml } from './xml/note.builder';
import { buildDespatchXml } from './xml/despatch.builder';
import { buildSummaryXml } from './xml/summary.builder';
import { buildVoidedXml } from './xml/voided.builder';
import { XmlSignerService } from './signer/xml-signer.service';
import { SunatSoapClient } from './soap/sunat-soap.client';
import { SunatGreClient } from './gre/sunat-gre.client';
import { CdrParserService } from './cdr/cdr-parser.service';
import { SUNAT_ENGINE_OPTIONS, SunatEngineOptions } from './sunat-engine.module';

@Injectable()
export class SunatEngineService {
  private readonly logger = new Logger(SunatEngineService.name);

  constructor(
    private readonly signer: XmlSignerService,
    private readonly soap: SunatSoapClient,
    private readonly gre: SunatGreClient,
    private readonly cdrParser: CdrParserService,
    @Inject(SUNAT_ENGINE_OPTIONS) private readonly options: SunatEngineOptions,
  ) {}

  private resolveCredentials(perCall?: Partial<CompanyCredentials>): CompanyCredentials {
    const global = this.options.sunat ?? {};
    const merged = { ...global, ...perCall };
    if (!merged.ruc || !merged.solUser || !merged.solPass || !merged.certPem) {
      throw new Error(
        'Credenciales incompletas: proporciona ruc, solUser, solPass y certPem en sunat:{} del módulo o en cada llamada',
      );
    }
    return merged as CompanyCredentials;
  }

  // -----------------------------------------------------------------
  // FACTURA (01) / BOLETA (03)
  // -----------------------------------------------------------------

  async sendInvoice(payload: InvoicePayload, credentials?: Partial<CompanyCredentials>): Promise<EngineResponse> {
    const creds = this.resolveCredentials(credentials);
    const xmlUnsigned = buildInvoiceXml(payload);
    const { signedXml, hash } = this.signDocument(xmlUnsigned, creds);

    const fileName = this.soap.buildZipFileName(
      creds.ruc,
      payload.tipoDoc,
      payload.serie,
      payload.correlativo,
    );

    const result = await this.soap.sendBill({
      ruc: creds.ruc,
      solUser: creds.solUser,
      solPass: creds.solPass,
      fileName,
      xmlSigned: signedXml,
      mode: creds.endpointMode ?? 'beta',
    });

    if (!result.success) {
      return { xml: Buffer.from(signedXml).toString('base64'), hash, sunatResponse: { success: false, error: result.error } };
    }

    const cdrResponse = result.cdrZipBase64
      ? await this.cdrParser.parse(result.cdrZipBase64)
      : undefined;

    return {
      xml: Buffer.from(signedXml).toString('base64'),
      hash,
      sunatResponse: {
        success: cdrResponse?.code === '0' || !result.error,
        cdrZip: result.cdrZipBase64,
        cdrResponse,
      },
    };
  }

  // -----------------------------------------------------------------
  // NOTA DE CREDITO (07) / DEBITO (08)
  // -----------------------------------------------------------------

  async sendNote(payload: NotePayload, credentials?: Partial<CompanyCredentials>): Promise<EngineResponse> {
    const creds = this.resolveCredentials(credentials);
    const xmlUnsigned = buildNoteXml(payload);
    const { signedXml, hash } = this.signDocument(xmlUnsigned, creds);

    const fileName = this.soap.buildZipFileName(
      creds.ruc,
      payload.tipoDoc,
      payload.serie,
      payload.correlativo,
    );

    const result = await this.soap.sendBill({
      ruc: creds.ruc,
      solUser: creds.solUser,
      solPass: creds.solPass,
      fileName,
      xmlSigned: signedXml,
      mode: creds.endpointMode ?? 'beta',
    });

    const cdrResponse = result.cdrZipBase64
      ? await this.cdrParser.parse(result.cdrZipBase64)
      : undefined;

    return {
      xml: Buffer.from(signedXml).toString('base64'),
      hash,
      sunatResponse: {
        success: result.success,
        cdrZip: result.cdrZipBase64,
        cdrResponse,
        error: result.error,
      },
    };
  }

  // -----------------------------------------------------------------
  // GUIA DE REMISION (GRE) - REST API con OAuth (no SOAP)
  // -----------------------------------------------------------------

  async sendDespatch(payload: DespatchPayload, credentials?: Partial<CompanyCredentials>): Promise<EngineResponse> {
    const creds = this.resolveCredentials(credentials);
    const xmlUnsigned = buildDespatchXml(payload);
    const { signedXml, hash } = this.signDocument(xmlUnsigned, creds);

    const result = await this.gre.sendGRE({
      ruc:          creds.ruc,
      solUser:      creds.solUser,
      solPass:      creds.solPass,
      serie:        payload.serie,
      correlativo:  payload.correlativo,
      signedXml,
      clientId:     creds.greClientId,
      clientSecret: creds.greClientSecret,
      authUrl:      creds.greAuthUrl,
      apiUrl:       creds.greApiUrl,
    });

    return {
      xml: Buffer.from(signedXml).toString('base64'),
      hash,
      sunatResponse: {
        success: result.success,
        ticket: result.ticket,
        error: result.error,
      },
    };
  }

  // -----------------------------------------------------------------
  // RESUMEN DIARIO (RC) - asincrono
  // -----------------------------------------------------------------

  async sendSummary(payload: SummaryPayload, credentials?: Partial<CompanyCredentials>): Promise<EngineResponse> {
    const creds = this.resolveCredentials(credentials);
    const xmlUnsigned = buildSummaryXml(payload);
    const { signedXml, hash } = this.signDocument(xmlUnsigned, creds);

    const fecha = payload.fecResumen.slice(0, 10);
    const fileName = this.soap.buildSummaryFileName(creds.ruc, 'RC', fecha, payload.correlativo);

    const result = await this.soap.sendSummary({
      ruc: creds.ruc,
      solUser: creds.solUser,
      solPass: creds.solPass,
      fileName,
      xmlSigned: signedXml,
      mode: creds.endpointMode ?? 'beta',
    });

    return {
      xml: Buffer.from(signedXml).toString('base64'),
      hash,
      sunatResponse: {
        success: result.success,
        ticket: result.ticket,
        error: result.error,
      },
    };
  }

  // -----------------------------------------------------------------
  // COMUNICACION DE BAJA (RA) - asincrono
  // -----------------------------------------------------------------

  async sendVoided(payload: VoidedPayload, credentials?: Partial<CompanyCredentials>): Promise<EngineResponse> {
    const creds = this.resolveCredentials(credentials);
    const xmlUnsigned = buildVoidedXml(payload);
    const { signedXml, hash } = this.signDocument(xmlUnsigned, creds);

    const fecha = payload.fecGeneracion.slice(0, 10);
    const fileName = this.soap.buildSummaryFileName(creds.ruc, 'RA', fecha, payload.correlativo);

    const result = await this.soap.sendSummary({
      ruc: creds.ruc,
      solUser: creds.solUser,
      solPass: creds.solPass,
      fileName,
      xmlSigned: signedXml,
      mode: creds.endpointMode ?? 'beta',
    });

    return {
      xml: Buffer.from(signedXml).toString('base64'),
      hash,
      sunatResponse: {
        success: result.success,
        ticket: result.ticket,
        error: result.error,
      },
    };
  }

  // -----------------------------------------------------------------
  // CONSULTA DE TICKET (RC/RA via SOAP | GRE via REST)
  // -----------------------------------------------------------------

  async getTicketStatus(
    ticket: string,
    credentials?: Partial<CompanyCredentials>,
    endpointType: 'factura' | 'guia' = 'factura',
  ): Promise<EngineResponse> {
    const creds = this.resolveCredentials(credentials);

    if (endpointType === 'guia') {
      const result = await this.gre.getStatus({
        ruc: creds.ruc,
        solUser: creds.solUser,
        solPass: creds.solPass,
        ticket,
        clientId:     creds.greClientId,
        clientSecret: creds.greClientSecret,
        authUrl:      creds.greAuthUrl,
        apiUrl:       creds.greApiUrl,
      });

      const cdrResponse = result.cdrZipBase64
        ? await this.cdrParser.parse(result.cdrZipBase64)
        : undefined;

      return {
        sunatResponse: {
          success: result.success,
          cdrZip: result.cdrZipBase64,
          cdrResponse,
          error: result.error,
        },
      };
    }

    const result = await this.soap.getStatus({
      ruc: creds.ruc,
      solUser: creds.solUser,
      solPass: creds.solPass,
      ticket,
      mode: creds.endpointMode ?? 'beta',
      endpointType,
    });

    const cdrResponse = result.cdrZipBase64
      ? await this.cdrParser.parse(result.cdrZipBase64)
      : undefined;

    return {
      sunatResponse: {
        success: result.success,
        cdrZip: result.cdrZipBase64,
        cdrResponse,
        error: result.error,
      },
    };
  }

  // -----------------------------------------------------------------
  // Helpers internos
  // -----------------------------------------------------------------

  private signDocument(
    xmlUnsigned: string,
    credentials: CompanyCredentials,
  ): { signedXml: string; hash: string } {
    let privateKeyPem = credentials.certKey ?? '';
    let certPem = credentials.certPem;

    if (!certPem.includes('-----BEGIN')) {
      const extracted = this.signer.loadP12(certPem);
      privateKeyPem = extracted.privateKeyPem;
      certPem = extracted.certPem;
    } else {
      certPem = this.signer.normalizeCertPem(certPem);
      if (!privateKeyPem) {
        throw new Error('certKey (clave privada PEM) requerida cuando certPem es PEM y no p12');
      }
    }

    const signedXml = this.signer.sign(xmlUnsigned, privateKeyPem, certPem);
    const hash = this.signer.hashXml(signedXml);

    return { signedXml, hash };
  }
}
