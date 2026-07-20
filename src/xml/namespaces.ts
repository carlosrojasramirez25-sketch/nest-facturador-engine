// Namespaces UBL 2.1 usados por SUNAT Peru

export const NS_INVOICE = {
  xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
};

export const NS_CREDIT_NOTE = {
  xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
};

export const NS_DEBIT_NOTE = {
  xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
};

export const NS_DESPATCH = {
  xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
};

export const NS_SUMMARY = {
  xmlns: 'urn:sunat:names:specification:ubl:peru:schema:xsd:SummaryDocuments-1',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
};

export const NS_VOIDED = {
  xmlns: 'urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1',
  'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
  'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  'xmlns:sac': 'urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1',
  'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
};

// Catalogos de tributos (taxScheme)
export const TRIBUTOS: Record<string, { id: string; name: string; typeCode: string }> = {
  IGV:    { id: '1000', name: 'IGV',    typeCode: 'VAT' },
  IVAP:   { id: '1016', name: 'IVAP',   typeCode: 'VAT' },
  ISC:    { id: '2000', name: 'ISC',    typeCode: 'EXC' },
  ICBPER: { id: '7152', name: 'ICBPER', typeCode: 'OTH' },
  EXP:    { id: '9995', name: 'EXP',    typeCode: 'FRE' }, // Exportacion
  GRA:    { id: '9996', name: 'GRA',    typeCode: 'FRE' }, // Gratuita
  EXO:    { id: '9997', name: 'EXO',    typeCode: 'VAT' }, // Exonerado
  INA:    { id: '9998', name: 'INA',    typeCode: 'FRE' }, // Inafecto
};

// tipAfeIgv (Catalogo 07) -> nombre de tributo
export const TIPO_AFE_IGV_TRIBUTO: Record<string, string> = {
  '10': 'IGV', '11': 'IGV', '12': 'IGV', '13': 'IGV', '14': 'IGV', '15': 'IGV', '16': 'IGV', '17': 'IGV',
  '20': 'EXO',
  '30': 'INA', '31': 'INA', '32': 'INA', '33': 'INA', '34': 'INA', '35': 'INA', '36': 'INA',
  '40': 'EXP',
  '21': 'EXO',
};

export function tipAfeToTributo(tipAfe: string) {
  const name = TIPO_AFE_IGV_TRIBUTO[tipAfe] ?? 'IGV';
  return TRIBUTOS[name] ?? TRIBUTOS.IGV;
}

// Catálogo 61 - Documentos relacionados al transporte (GRE)
export const CATALOGO_61_GRE: Record<string, string> = {
  '01': 'Factura',
  '03': 'Boleta de Venta',
  '07': 'Nota de Crédito',
  '08': 'Nota de Débito',
  '09': 'Guía de Remisión - Remitente',
  '31': 'Guía de Remisión - Transportista',
  '50': 'Declaración Aduanera de Mercancías (DAM)',
  '52': 'Declaración Simplificada (DS)',
  '92': 'Cita u Orden de Entrega del Terminal Portuario',
  '93': 'Documento ZOFRATACNA',
  '94': 'Solicitud de Traslado ZED',
  '95': 'Solicitud de Traslado ZOFRATACNA',
};

// tipAfeIgv -> PriceTypeCode (01=precio venta, 02=precio sin IGV en gratuitas)
export function tipAfeToPreType(tipAfe: string): string {
  const gratuitas = ['15', '16', '17'];
  return gratuitas.includes(tipAfe) ? '02' : '01';
}
