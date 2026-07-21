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

Registra el módulo en tu `AppModule`. Puedes definir las credenciales de tu empresa **una sola vez** en el módulo usando el campo `sunat`, evitando repetirlas en cada llamada.

```typescript
import { SunatEngineModule } from 'sunat-engine-nest';

// Registro síncrono
@Module({
  imports: [
    SunatEngineModule.forRoot({
      sunat: {
        ruc:          '20123456789',
        solUser:      'MODDATOS',
        solPass:      'moddatos',
        certPem:      'BASE64_DEL_P12_O_PEM',
        endpointMode: 'beta', // 'beta' | 'produccion'
      },
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
        provider: config.get('PROVIDER'), // 'sunat' | 'ose'
        sunat: {
          ruc:          config.get('SUNAT_RUC'),
          solUser:      config.get('SUNAT_SOL_USER'),
          solPass:      config.get('SUNAT_SOL_PASS'),
          certPem:      config.get('SUNAT_CERT_PEM'),
          endpointMode: config.get('SUNAT_MODE') ?? 'beta',
        },
        gre: {
          authUrl:      config.get('GRE_AUTH_URL'),
          apiUrl:       config.get('GRE_API_URL'),
          clientId:     config.get('GRE_CLIENT_ID'),
          clientSecret: config.get('GRE_CLIENT_SECRET'),
        },
        ose: {
          url:   config.get('OSE_URL'),
          token: config.get('OSE_TOKEN'),
        },
      }),
    }),
  ],
})
export class AppModule {}
```

## Variables de entorno

```env
# Credenciales SUNAT
SUNAT_RUC=20123456789
SUNAT_SOL_USER=MODDATOS
SUNAT_SOL_PASS=moddatos
SUNAT_CERT_PEM=BASE64_DEL_P12
SUNAT_MODE=beta

# GRE (Guía de Remisión Electrónica)
GRE_AUTH_URL=https://gre-test.nubefact.com/v1
GRE_API_URL=https://gre-test.nubefact.com/v1
GRE_CLIENT_ID=tu_client_id
GRE_CLIENT_SECRET=tu_client_secret

# OSE (solo si provider=ose)
PROVIDER=ose
OSE_URL=https://api.tuose.com/v1/documents
OSE_TOKEN=tu_token_aqui
```

## Proveedor: SUNAT directo vs OSE

Puedes elegir enviar tus comprobantes **directamente a SUNAT** o a través de un **OSE (Operador de Servicios Electrónicos)** autorizado como Nubefact, EFACT, DigiFlow, Bizlinks, entre otros.

```typescript
// Envío directo a SUNAT (por defecto)
SunatEngineModule.forRoot({
  provider: 'sunat',
  sunat: { ruc: '...', solUser: '...', solPass: '...', certPem: '...' },
})

// Envío a través de un OSE
SunatEngineModule.forRoot({
  provider: 'ose',
  sunat: { ruc: '...', certPem: '...' }, // solo se usa para firmar el XML
  ose: {
    url:   'https://api.tuose.com/v1/documents',
    token: 'TU_TOKEN_OSE',               // Bearer token
    // o en lugar de token:
    // username: 'usuario',
    // password: 'clave',
  },
})
```

> El `OseClient` es genérico y compatible con cualquier OSE que acepte `{ fileName, contentFile }` (ZIP en base64) vía POST con autenticación Bearer o Basic.

## Certificado digital

El motor acepta el certificado en tres formatos:

```typescript
// Formato 1: ruta al archivo .p12 o .pem en disco
const credentials: CompanyCredentials = {
  certPem: '/ruta/al/certificado.p12',
};

// Formato 2: ruta a cert PEM + ruta a clave privada PEM por separado
const credentials: CompanyCredentials = {
  certPem: '/ruta/al/cert.pem',
  certKey: '/ruta/al/key.pem',
};

// Formato 3: contenido directo en base64 (.p12) o texto PEM
const credentials: CompanyCredentials = {
  certPem: 'MIIKJAIBAzCCCd4GCSqGSI...', // .p12 en base64
};
```

## Uso

Inyecta `SunatEngineService` en cualquier servicio o controlador. Si configuraste `sunat:{}` en el módulo, **no necesitas pasar credenciales en cada llamada**:

```typescript
import { Injectable } from '@nestjs/common';
import { SunatEngineService, InvoicePayload } from 'sunat-engine-nest';

@Injectable()
export class InvoicesService {
  constructor(private readonly engine: SunatEngineService) {}

  async sendInvoice() {
    // Sin credenciales — usa las del módulo automáticamente
    const payload: InvoicePayload = {
      tipoOperacion: '0101',
      tipoDoc:       '01', // 01=Factura, 03=Boleta
      serie:         'F001',
      correlativo:   '00000001',
      fechaEmision:  '2026-07-20T00:00:00-05:00',
      tipoMoneda:    'PEN',
      company: {
        ruc:         '20123456789',
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

    return this.engine.sendInvoice(payload); // credenciales del módulo
  }
}
```

También puedes sobreescribir las credenciales por llamada cuando manejas múltiples empresas:

```typescript
// Credenciales específicas para esta llamada (tienen prioridad sobre el módulo)
return this.engine.sendInvoice(payload, {
  ruc:     '20987654321',
  solUser: 'OTRO_USUARIO',
  solPass: 'otra_clave',
  certPem: 'OTRO_CERT_BASE64',
});
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

- [Escríbeme por WhatsApp](https://wa.me/51907596305) para consultas, soporte o donaciones.

Cualquier aporte, por pequeño que sea, ayuda a mantener la librería actualizada y en funcionamiento. ¡Gracias por tu apoyo!

## Licencia

MIT
