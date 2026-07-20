// Modulo principal
export { SunatEngineModule, SUNAT_ENGINE_OPTIONS } from './sunat-engine.module';
export type { SunatEngineOptions, SunatEngineAsyncOptions, SunatEngineGreOptions } from './sunat-engine.module';

// Servicio orquestador
export { SunatEngineService } from './sunat-engine.service';

// Servicios individuales (por si el consumidor necesita inyectarlos directamente)
export { XmlSignerService } from './signer/xml-signer.service';
export { SunatSoapClient } from './soap/sunat-soap.client';
export type { SoapSendResult, SunatEndpointType } from './soap/sunat-soap.client';
export { SunatGreClient } from './gre/sunat-gre.client';
export { CdrParserService } from './cdr/cdr-parser.service';
export { DocumentPdfService } from './pdf/document-pdf.service';
export type { PdfFormat } from './pdf/document-pdf.service';

// Builders XML (por si el consumidor quiere generar el XML sin enviarlo)
export { buildInvoiceXml } from './xml/invoice.builder';
export { buildNoteXml } from './xml/note.builder';
export { buildDespatchXml } from './xml/despatch.builder';
export { buildSummaryXml } from './xml/summary.builder';
export { buildVoidedXml } from './xml/voided.builder';

// Tipos / interfaces SUNAT
export type {
  // Entidades
  AddressSunat,
  CompanySunat,
  ClientSunat,
  DetailSunat,
  LegendSunat,
  CuotaSunat,
  DescuentoSunat,
  DetraccionSunat,
  PercepcionSunat,
  // Payloads
  InvoicePayload,
  NotePayload,
  DespatchPayload,
  DespatchDocReferencia,
  SummaryPayload,
  SummaryDetailSunat,
  VoidedPayload,
  VoidedDetailSunat,
  // Credenciales
  CompanyCredentials,
  // Respuestas
  EngineResponse,
  SunatResponse,
  CdrResponse,
} from './types/sunat.types';
