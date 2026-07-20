import { Injectable } from '@nestjs/common';
import * as JSZip from 'jszip';
import { CdrResponse } from '../types/sunat.types';

/**
 * Parsea el CDR (Constancia de Recepcion) que devuelve SUNAT.
 * El CDR es un ZIP que contiene un XML con el resultado de la validacion.
 */
@Injectable()
export class CdrParserService {

  async parse(cdrZipBase64: string): Promise<CdrResponse> {
    try {
      const buffer = Buffer.from(cdrZipBase64, 'base64');
      const zip = await JSZip.loadAsync(buffer);

      const xmlFileName = Object.keys(zip.files).find(
        (name) => name.startsWith('R-') || name.endsWith('.xml'),
      );

      if (!xmlFileName) {
        return { code: '-1', description: 'CDR: archivo XML no encontrado en ZIP' };
      }

      const xmlContent = await zip.files[xmlFileName].async('string');
      return this.parseXml(xmlContent);
    } catch (err: any) {
      return { code: '-1', description: `Error parseando CDR: ${err.message}` };
    }
  }

  private parseXml(xml: string): CdrResponse {
    const response: CdrResponse = {};

    // ResponseCode (0 = aceptado, 2xxx = rechazado, 4xxx = aceptado con observaciones)
    const codeMatch = xml.match(/<cbc:ResponseCode[^>]*>([\s\S]*?)<\/cbc:ResponseCode>/i);
    if (codeMatch?.[1]) {
      response.code = codeMatch[1].trim();
    }

    const descMatch = xml.match(/<cbc:Description[^>]*>([\s\S]*?)<\/cbc:Description>/i);
    if (descMatch?.[1]) {
      response.description = descMatch[1].trim();
    }

    const notes: string[] = [];
    const noteRegex = /<cbc:Note[^>]*>([\s\S]*?)<\/cbc:Note>/gi;
    let match: RegExpExecArray | null;
    while ((match = noteRegex.exec(xml)) !== null) {
      if (match[1]?.trim()) notes.push(match[1].trim());
    }
    if (notes.length > 0) {
      response.notes = notes;
    }

    return response;
  }

  /**
   * Determina el estado del comprobante a partir del codigo CDR.
   * 0          -> ACEPTADA
   * 2000-3999  -> RECHAZADA
   * 4000+      -> ACEPTADA con observaciones
   */
  resolveEstado(code?: string): 'ACEPTADA' | 'RECHAZADA' | 'ACEPTADA_OBS' | 'ENVIADO' {
    if (!code) return 'ENVIADO';
    const n = parseInt(code, 10);
    if (isNaN(n)) return 'ENVIADO';
    if (n === 0) return 'ACEPTADA';
    if (n >= 2000 && n < 4000) return 'RECHAZADA';
    if (n >= 4000) return 'ACEPTADA_OBS';
    return 'ENVIADO';
  }
}
