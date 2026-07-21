# sunat-engine-nest

Motor de Facturación Electrónica SUNAT UBL 2.1 para NestJS.

Soporta Facturas, Boletas, Notas de Crédito/Débito, Guías de Remisión (GRE), Resúmenes Diarios y Comunicaciones de Baja.

## Instalación

```bash
npm install sunat-engine-nest
# o
pnpm add sunat-engine-nest
```

## Configuración

Registra el módulo en tu `AppModule`:

```typescript
import { SunatEngineModule } from 'sunat-engine-nest';

// Registro síncrono
@Module({
  imports: [
    SunatEngineModule.forRoot({
      gre: {
        authUrl:      'https://gre-test.nubefact.com/v1',
        apiUrl:       'https://gre-test.nubefact.com/v1',
        clientId:     'TU_CLIENT_ID',
        clientSecret: 'TU_CLIENT_SECRET',
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
import { SunatEngineModule } from 'sunat-engine-nest';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Registro asíncrono (recomendado con variables de entorno)
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SunatEngineModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        gre: {
          authUrl:      config.get('GRE_AUTH_URL'),
          apiUrl:       config.get('GRE_API_URL'),
          clientId:     config.get('GRE_CLIENT_ID'),
          clientSecret: config.get('GRE_CLIENT_SECRET'),
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## Variables de entorno (GRE)

```env
GRE_AUTH_URL=https://gre-test.nubefact.com/v1
GRE_API_URL=https://gre-test.nubefact.com/v1
GRE_CLIENT_ID=tu_client_id
GRE_CLIENT_SECRET=tu_client_secret
GRE_SCOPE=https://api-cpe.sunat.gob.pe
```

## Uso

Inyecta `SunatEngineService` en cualquier servicio o controlador:

```typescript
import { Injectable } from '@nestjs/common';
import { SunatEngineService, InvoicePayload, CompanyCredentials } from 'sunat-engine-nest';

@Injectable()
export class InvoicesService {
  constructor(private readonly engine: SunatEngineService) {}

  async sendInvoice() {
    const credentials: CompanyCredentials = {
      ruc:          '20123456789',
      solUser:      'MODDATOS',
      solPass:      'moddatos',
      certPem:      'BASE64_DEL_P12_O_PEM',
      endpointMode: 'beta', // 'beta' | 'produccion'
    };

    const payload: InvoicePayload = {
      tipoOperacion: '0101',
      tipoDoc:       '01', // 01=Factura, 03=Boleta
      serie:         'F001',
      correlativo:   '00000001',
      fechaEmision:  '2026-07-20T00:00:00-05:00',
      tipoMoneda:    'PEN',
      company: {
        ruc:        '20123456789',
        razonSocial: 'MI EMPRESA S.A.C.',
        address: { direccion: 'Av. Principal 123, Lima' },
      },
      client: {
        tipoDoc:   '6',
        numDoc:    '20987654321',
        rznSocial: 'CLIENTE S.A.C.',
      },
      details: [
        {
          unidad:            'NIU',
          cantidad:          2,
          descripcion:       'Producto de prueba',
          mtoValorUnitario:  100,
          mtoValorVenta:     200,
          mtoBaseIgv:        200,
          porcentajeIgv:     18,
          igv:               36,
          tipAfeIgv:         '10',
          totalImpuestos:    36,
          mtoPrecioUnitario: 118,
        },
      ],
      legends: [{ code: '1000', value: 'DOSCIENTOS TREINTA Y SEIS Y 00/100 SOLES' }],
      mtoOperGravadas: 200,
      mtoIGV:          36,
      totalImpuestos:  36,
      valorVenta:      200,
      subTotal:        236,
      mtoImpVenta:     236,
    };

    return this.engine.sendInvoice(payload, credentials);
  }
}
```

## Documentos soportados

| Tipo | Método | Descripción |
|------|--------|-------------|
| Factura (01) | `sendInvoice()` | Factura electrónica — SOAP síncrono |
| Boleta (03) | `sendInvoice()` | Boleta de venta electrónica — SOAP síncrono |
| Nota de Crédito (07) | `sendNote()` | NC electrónica — SOAP síncrono |
| Nota de Débito (08) | `sendNote()` | ND electrónica — SOAP síncrono |
| Guía de Remisión (09) | `sendDespatch()` | GRE 2022 — REST/OAuth asíncrono |
| Resumen Diario (RC) | `sendSummary()` | Resumen de boletas — SOAP asíncrono |
| Comunicación de Baja (RA) | `sendVoided()` | Baja de comprobantes — SOAP asíncrono |
| Consulta de ticket | `getTicketStatus()` | Estado de procesos asíncronos |

## Generación de PDF

```typescript
import { DocumentPdfService } from 'sunat-engine-nest';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly engine: SunatEngineService,
    private readonly pdf: DocumentPdfService,
  ) {}

  async getPdf(payload: InvoicePayload): Promise<Buffer> {
    return this.pdf.generateInvoice(payload, 'A4'); // 'A4' | 'TICKET_80MM' | 'STICKER_A6'
  }
}
```

## Certificado digital

El motor acepta el certificado en dos formatos:

```typescript
// Formato 1: archivo .p12 en base64
const credentials: CompanyCredentials = {
  certPem: 'MIIKJAIBAzCCCd4GCSqGSI...', // .p12 en base64 (sin headers PEM)
};

// Formato 2: certificado PEM + clave privada PEM por separado
const credentials: CompanyCredentials = {
  certPem: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
  certKey: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
};
```

## Respuesta del motor

```typescript
interface EngineResponse {
  xml?:           string;       // XML firmado en base64
  hash?:          string;       // SHA256 del XML
  sunatResponse?: {
    success?:     boolean;
    ticket?:      string;       // procesos asíncronos (RC/RA/GRE)
    cdrZip?:      string;       // ZIP CDR en base64 (procesos síncronos)
    cdrResponse?: {
      code?:        string;     // 0=aceptado, 2xxx=rechazado, 4xxx=obs
      description?: string;
      notes?:       string[];
    };
    error?: { code?: string | number; message?: string };
  };
}
```

## Endpoints SUNAT

| Modo | Factura/Boleta/NC/ND | GRE |
|------|----------------------|-----|
| `beta` | e-beta.sunat.gob.pe | gre-test.nubefact.com |
| `produccion` | e-factura.sunat.gob.pe | api-cpe.sunat.gob.pe |

## Soporte y actualizaciones

SUNAT actualiza continuamente sus esquemas, validaciones y normativas de facturación electrónica. Este paquete recibe mantenimiento activo para mantenerse alineado con cada cambio oficial, garantizando que tu integración siga funcionando sin interrupciones.

Si este proyecto te ha sido útil y quieres apoyar su desarrollo continuo, puedes hacerlo de las siguientes formas:

### Yape / WhatsApp

**Número:** `+51 907 596 305`

- [Escríbeme por WhatsApp](https://wa.me/51907596305) para consultas, soporte o coordinar una transferencia.

### Transferencia bancaria (BCP — Soles)

| Campo | Detalle |
|-------|---------|
| Banco | BCP |
| Moneda | Soles (PEN) |
| N° de cuenta | `19399752856058` |
| CCI | `00219319975285605810` |

Cualquier aporte, por pequeño que sea, ayuda a mantener la librería actualizada y en funcionamiento. ¡Gracias por tu apoyo!

## Licencia

MIT
