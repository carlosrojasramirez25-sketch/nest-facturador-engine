import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { SUNAT_ENGINE_OPTIONS } from './constants';
import { SunatEngineService } from './sunat-engine.service';
import { XmlSignerService } from './signer/xml-signer.service';
import { SunatSoapClient } from './soap/sunat-soap.client';
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
}

export interface SunatEngineAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<SunatEngineOptions> | SunatEngineOptions;
  inject?: any[];
}

// ---------- Providers compartidos ----------

const ENGINE_PROVIDERS = [
  SunatEngineService,
  XmlSignerService,
  SunatSoapClient,
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

@Global()
@Module({})
export class SunatEngineModule {
  /**
   * Registro sincrono.
   *
   * @example
   * SunatEngineModule.forRoot({
   *   gre: {
   *     authUrl: process.env.GRE_AUTH_URL,
   *     apiUrl:  process.env.GRE_API_URL,
   *     clientId: process.env.GRE_CLIENT_ID,
   *     clientSecret: process.env.GRE_CLIENT_SECRET,
   *   }
   * })
   */
  static forRoot(options: SunatEngineOptions = {}): DynamicModule {
    return {
      module: SunatEngineModule,
      global: true,
      providers: [
        { provide: SUNAT_ENGINE_OPTIONS, useValue: options },
        ...ENGINE_PROVIDERS,
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
   *     gre: {
   *       authUrl: config.get('GRE_AUTH_URL'),
   *       clientId: config.get('GRE_CLIENT_ID'),
   *       clientSecret: config.get('GRE_CLIENT_SECRET'),
   *     }
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
        ...ENGINE_PROVIDERS,
      ],
      exports: ENGINE_EXPORTS,
    };
  }
}
