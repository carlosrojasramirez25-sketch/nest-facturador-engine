// ---------- Empresa / Emisor ----------

export interface AddressSunat {
  ubigueo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  urbanizacion?: string;
  direccion?: string;
  codLocal?: string;
}

export interface CompanySunat {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  address?: AddressSunat;
}

// ---------- Cliente ----------

export interface ClientSunat {
  tipoDoc: string;   // Catalogo 06: 1=DNI, 6=RUC, 4=CE, 7=Pasaporte, 0=-
  numDoc: string;
  rznSocial: string;
  address?: AddressSunat;
}

// ---------- Detalle de linea ----------

export interface DetailSunat {
  codProducto?: string;
  codProdSunat?: string; // UNSPSC (Catalogo 25)
  unidad: string;        // Catalogo UOM (NIU, ZZ, KGM...)
  cantidad: number;
  descripcion: string;
  mtoValorUnitario: number;
  mtoValorVenta: number;  // sin impuesto
  mtoBaseIgv: number;
  porcentajeIgv: number;  // 18 / 0
  igv: number;
  tipAfeIgv: string;      // Catalogo 07: 10 gravado, 20 exonerado, 30 inafecto...
  totalImpuestos: number;
  mtoPrecioUnitario: number; // precio de venta (con IGV)
  mtoValorGratuito?: number;
  // ISC
  isc?: number;
  porcentajeIsc?: number;
  tipSisIsc?: string; // Catalogo 08
  // ICBPER (bolsas plasticas)
  icbper?: number;
  factorIcbper?: number;
}

// ---------- Leyenda ----------

export interface LegendSunat {
  code: string; // 1000 = monto en letras, 1002 = gratuita, 2006 = detraccion
  value: string;
}

// ---------- Cuota (credito) ----------

export interface CuotaSunat {
  moneda: string;
  monto: number;
  fechaPago: string; // ISO datetime
}

// ---------- Descuento global ----------

export interface DescuentoSunat {
  codTipo: string; // Catalogo 53
  montoBase: number;
  factor: number;
  monto: number;
}

// ---------- Detraccion ----------

export interface DetraccionSunat {
  codBienDetraccion: string; // Catalogo 54
  codMedioPago: string;      // Catalogo 59 (001 = deposito en cuenta)
  ctaBanco?: string;
  percent: number;
  mount: number;
}

// ---------- Percepcion ----------

export interface PercepcionSunat {
  codReg: string; // Catalogo 53 (01 venta interna, 02 adquisicion combustible...)
  porcentaje: number;
  mtoBase: number;
  mto: number;
  mtoTotal: number;
}

// ---------- INVOICE PAYLOAD ----------

export interface InvoicePayload {
  ublVersion?: string;
  tipoOperacion: string; // Catalogo 51 (0101, 0200...)
  tipoDoc: '01' | '03'; // 01=Factura, 03=Boleta
  serie: string;
  correlativo: string;
  fechaEmision: string; // ISO datetime con timezone -05:00
  tipoMoneda: string;   // PEN, USD, EUR
  company: CompanySunat;
  client: ClientSunat;
  details: DetailSunat[];
  legends: LegendSunat[];
  // Totales
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
  valorVenta: number;
  subTotal: number;
  mtoImpVenta: number;
  redondeo?: number;
  // Forma de pago
  formaPago?: { tipo: 'Contado' | 'Credito'; moneda?: string; monto?: number };
  cuotas?: CuotaSunat[];
  // Opcionales
  fechaVencimiento?: string;
  descuentos?: DescuentoSunat[];
  mtoDescuentos?: number;
  detraccion?: DetraccionSunat;
  perception?: PercepcionSunat;
}

// ---------- NOTE PAYLOAD ----------

export interface NotePayload {
  ublVersion?: string;
  tipoDoc: '07' | '08'; // 07=NC, 08=ND
  serie: string;
  correlativo: string;
  fechaEmision: string;
  tipoMoneda: string;
  tipDocAfectado: string;  // tipo del comprobante afectado (01, 03)
  numDocfectado?: string;  // alias Greenter
  numDocAfectado: string;  // serie-correlativo del comprobante afectado
  codMotivo: string;       // Catalogo 09 (NC) / Catalogo 10 (ND)
  desMotivo: string;
  company: CompanySunat;
  client: ClientSunat;
  details: DetailSunat[];
  legends: LegendSunat[];
  mtoOperGravadas?: number;
  mtoOperExoneradas?: number;
  mtoOperInafectas?: number;
  mtoIGV: number;
  totalImpuestos: number;
  mtoImpVenta: number;
  valorVenta: number;
  subTotal: number;
}

// ---------- DESPATCH PAYLOAD (GRE) ----------

export interface DespatchDocReferencia {
  id: string;           // número del documento relacionado
  codigo: string;       // catálogo 61 (ej: '09'=GRE Remitente, '92'=Terminal Portuario)
  descripcion?: string; // descripción libre del tipo de documento
  rucEmisor?: string;   // RUC del emisor del documento relacionado
}

export interface DespatchPayload {
  version?: string;
  tipoDoc: '09';
  serie: string;
  correlativo: string;
  fechaEmision: string;
  company: CompanySunat;
  destinatario: { tipoDoc: string; numDoc: string; rznSocial: string };
  envio: {
    codTraslado: string;  // Catalogo 20
    modTraslado: string;  // 01=publico, 02=privado
    desTraslado: string;
    fecTraslado: string;
    fecEntregaBienes?: string;
    pesoTotal: number;
    undPesoTotal: string; // KGM
    numBultos?: number;
    indicadores?: string[];
    indicadorVehiculoConductoresTransp?: boolean;
    partida: { ubigueo?: string; direccion: string };
    llegada: { ubigueo?: string; direccion: string };
    transportista?: { tipoDoc: string; numDoc: string; rznSocial: string; nroMtc?: string };
    choferes?: { tipo?: string; tipoDoc: string; nroDoc: string; licencia: string; nombres?: string; apellidos?: string }[];
    vehiculo?: { placa: string };
  };
  docReferencias?: DespatchDocReferencia[];
  details: { cantidad: number; unidad: string; descripcion: string; codigo?: string }[];
}

// ---------- SUMMARY PAYLOAD (RC) ----------

export interface SummaryDetailSunat {
  tipoDoc: string;
  serieNro: string;
  estado: '1' | '3'; // 1=adicionar, 3=anular
  clienteTipo: string;
  clienteNro: string;
  total: number;
  mtoOperGravadas?: number;
  mtoOperExoneradas?: number;
  mtoOperInafectas?: number;
  mtoOperGratuitas?: number;
  mtoIGV?: number;
  docReferencia?: string;
  tipDocReferencia?: string;
}

export interface SummaryPayload {
  correlativo: string;
  fecGeneracion: string;
  fecResumen: string;
  company: CompanySunat;
  details: SummaryDetailSunat[];
}

// ---------- VOIDED PAYLOAD (RA) ----------

export interface VoidedDetailSunat {
  tipoDoc: string;
  serie: string;
  correlativo: string;
  descripcion?: string;
}

export interface VoidedPayload {
  correlativo: string;
  fecGeneracion: string;
  company: CompanySunat;
  details: VoidedDetailSunat[];
}

// ---------- RESPUESTA MOTOR ----------

export interface CdrResponse {
  code?: string;
  description?: string;
  notes?: string[];
}

export interface SunatResponse {
  success?: boolean;
  ticket?: string;    // para procesos asincronos (RC/RA/GRE)
  cdrZip?: string;   // base64 del ZIP CDR (procesos sincronos)
  cdrResponse?: CdrResponse;
  error?: { code?: string | number; message?: string };
}

export interface EngineResponse {
  xml?: string;       // XML firmado (base64 o texto)
  hash?: string;
  sunatResponse?: SunatResponse;
}

// ---------- CREDENCIALES ----------

export interface CompanyCredentials {
  ruc: string;
  solUser: string;
  solPass: string;
  certPem: string;      // Certificado PEM (texto) o .p12 en base64
  certKey?: string;     // Clave privada PEM (si va separada del cert)
  endpointMode?: 'beta' | 'produccion';
  // GRE 2022 REST/OAuth (opcional — usa defaults del modulo si no se configura)
  greClientId?: string;
  greClientSecret?: string;
  greAuthUrl?: string;
  greApiUrl?: string;
}
