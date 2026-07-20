import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { SunatEngineService } from './sunat-engine.service';
import { XmlSignerService } from './signer/xml-signer.service';
import { SunatSoapClient } from './soap/sunat-soap.client';
import { SunatGreClient } from './gre/sunat-gre.client';
import { CdrParserService } from './cdr/cdr-parser.service';
import { DocumentPdfService } from './pdf/document-pdf.service';

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

export interface SunatEngineOptions {
  gre?: SunatEngineGreOptions;
}

export interface SunatEngineAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<SunatEngineOptions> | SunatEngineOptions;
  inject?: any[];
}

export const SUNAT_ENGINE_OPTIONS = 'SUNAT_ENGINE_OPTIONS';

// ---------- Providers compartidos ----------

const ENGINE_PROVIDERS = [
  SunatEngineService,
  XmlSignerService,
  SunatSoapClient,
  SunatGreClient,
  CdrParserService,
  DocumentPdfService,
];

const ENGINE_EXPORTS = [
  SunatEngineService,
  XmlSignerService,
  SunatSoapClient,
  SunatGreClient,
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
