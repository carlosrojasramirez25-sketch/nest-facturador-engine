import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { SUNAT_ENGINE_OPTIONS } from './constants';
import { SunatEngineService } from './sunat-engine.service';
import { XmlSignerService } from './signer/xml-signer.service';
import { SunatSoapClient } from './soap/sunat-soap.client';
import { FakeSunatSoapClient } from './soap/fake-sunat-soap.client';
import { SunatGreClient } from './gre/sunat-gre.client';
import { CdrParserService } from './cdr/cdr-parser.service';
import { DocumentPdfService } from './pdf/document-pdf.service';
import { OseClient } from './ose/ose.client';

export { SUNAT_ENGINE_OPTIONS } from './constants';

// ---------- Opciones del modulo ----------

export interface SunatEngineGreOptions {
  authUrl?: string;
  apiUrl?: string;
  clientId?: string;
  clientSecret?: string;
  solRuc?: string;
  solUser?: string;
  solPass?: string;
  scope?: string;
}

export interface SunatEngineCredentialsOptions {
  ruc?: string;
  solUser?: string;
  solPass?: string;
  certPem?: string;
  certKey?: string;
  endpointMode?: 'beta' | 'produccion';
}

export interface SunatEngineOseOptions {
  url: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface SunatEngineOptions {
  provider?: 'sunat' | 'ose';
  sunat?: SunatEngineCredentialsOptions;
  ose?: SunatEngineOseOptions;
  gre?: SunatEngineGreOptions;
  /** Usa FakeSunatSoapClient en lugar del cliente SOAP real. Ideal para tests. */
  useFake?: boolean;
}

export interface SunatEngineAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<SunatEngineOptions> | SunatEngineOptions;
  inject?: any[];
}

// ---------- Providers compartidos ----------

const BASE_PROVIDERS = [
  SunatEngineService,
  XmlSignerService,
  SunatGreClient,
  OseClient,
  CdrParserService,
  DocumentPdfService,
];

const ENGINE_EXPORTS = [
  SunatEngineService,
  XmlSignerService,
  SunatSoapClient,
  SunatGreClient,
  OseClient,
  CdrParserService,
  DocumentPdfService,
];

// Resuelve SunatSoapClient o FakeSunatSoapClient según options.useFake.
// Al depender de SUNAT_ENGINE_OPTIONS funciona igual en forRoot y forRootAsync.
const SOAP_CLIENT_PROVIDER = {
  provide: SunatSoapClient,
  useFactory: (options: SunatEngineOptions): SunatSoapClient =>
    options.useFake ? new FakeSunatSoapClient() : new SunatSoapClient(),
  inject: [SUNAT_ENGINE_OPTIONS],
};

@Global()
@Module({})
export class SunatEngineModule {
  /**
   * Registro sincrono.
   *
   * @example
   * SunatEngineModule.forRoot({ sunat: { ruc: '...', ... } })
   *
   * // Para tests — sin llamadas reales a SUNAT:
   * SunatEngineModule.forRoot({ useFake: true, sunat: { ... } })
   */
  static forRoot(options: SunatEngineOptions = {}): DynamicModule {
    return {
      module: SunatEngineModule,
      global: true,
      providers: [
        { provide: SUNAT_ENGINE_OPTIONS, useValue: options },
        SOAP_CLIENT_PROVIDER,
        ...BASE_PROVIDERS,
      ],
      exports: ENGINE_EXPORTS,
    };
  }

  /**
   * Registro asincrono (util cuando las opciones dependen de ConfigService u otro provider).
   *
   * @example
   * SunatEngineModule.forRootAsync({
   *   imports: [ConfigModule],
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     useFake: config.get('NODE_ENV') === 'test',
   *     sunat: { ruc: config.get('RUC'), ... },
   *   }),
   * })
   */
  static forRootAsync(asyncOptions: SunatEngineAsyncOptions): DynamicModule {
    return {
      module: SunatEngineModule,
      global: true,
      imports: asyncOptions.imports ?? [],
      providers: [
        {
          provide: SUNAT_ENGINE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        },
        SOAP_CLIENT_PROVIDER,
        ...BASE_PROVIDERS,
      ],
      exports: ENGINE_EXPORTS,
    };
  }
}
