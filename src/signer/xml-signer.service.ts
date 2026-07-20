import { Injectable, Logger } from '@nestjs/common';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

/**
 * Firma documentos XML con el certificado digital SUNAT (RSA-SHA256).
 *
 * Proceso:
 * 1. Carga el certificado PEM y la clave privada (del .p12 o directamente en PEM).
 * 2. Usa xml-crypto para firmar el XML completo con Enveloped Signature.
 * 3. Inserta la firma dentro de ext:ExtensionContent (primer hijo de UBLExtensions).
 */
@Injectable()
export class XmlSignerService {
  private readonly logger = new Logger(XmlSignerService.name);

  /**
   * Carga un certificado .p12 (PKCS12) y extrae privateKey + certificate en PEM.
   * @param p12Base64 - certificado .p12 en base64
   * @param password  - contrasena del .p12
   */
  loadP12(p12Base64: string, password = ''): { privateKeyPem: string; certPem: string } {
    const p12Der = Buffer.from(p12Base64, 'base64');
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Der));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

    // Extraer certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = (certBags[forge.pki.oids.certBag] ?? [])[0];
    if (!certBag?.cert) throw new Error('Certificado no encontrado en el .p12');
    const certPem = forge.pki.certificateToPem(certBag.cert);

    // Extraer clave privada (shrouded key bag)
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])[0];
    if (!keyBag?.key) throw new Error('Clave privada no encontrada en el .p12');
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.PrivateKey);

    return { privateKeyPem, certPem };
  }

  /**
   * Normaliza un certificado PEM. Si viene en base64 sin cabeceras, agrega los headers.
   */
  normalizeCertPem(certInput: string): string {
    const trimmed = certInput.trim();
    if (trimmed.startsWith('-----BEGIN')) return trimmed;
    const b64 = trimmed.replace(/\s/g, '');
    const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
    return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
  }

  /**
   * Extrae el contenido del certificado PEM (solo el base64 sin headers).
   */
  certPemToBase64(certPem: string): string {
    return certPem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
  }

  /**
   * Firma el XML con RSA-SHA256 y coloca la firma en ext:ExtensionContent.
   * @param xmlUnsigned - XML sin firmar (generado por los builders)
   * @param privateKeyPem - clave privada en PEM
   * @param certPem       - certificado en PEM
   */
  sign(xmlUnsigned: string, privateKeyPem: string, certPem: string): string {
    const certB64 = this.certPemToBase64(certPem);

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      publicCert: certPem,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    });

    sig.addReference({
      xpath: '/*',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      uri: '',
      digestValue: '',
      isEmptyUri: true,
    });

    sig.computeSignature(xmlUnsigned, {
      prefix: 'ds',
      location: {
        reference: '//*[local-name(.)="ExtensionContent"]',
        action: 'append',
      },
    });

    const signedXml = sig.getSignedXml();

    if (signedXml.includes('<ds:X509Certificate>') || signedXml.includes('<X509Certificate>')) {
      return signedXml;
    }

    return this.injectX509Certificate(signedXml, certB64);
  }

  private injectX509Certificate(signedXml: string, certB64: string): string {
    const keyInfoTag = '<ds:KeyInfo>';
    const idx = signedXml.indexOf(keyInfoTag);
    if (idx === -1) {
      const closeTag = '</ds:Signature>';
      const closeIdx = signedXml.indexOf(closeTag);
      if (closeIdx === -1) return signedXml;
      const keyInfoBlock = `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certB64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>`;
      return signedXml.slice(0, closeIdx) + keyInfoBlock + signedXml.slice(closeIdx);
    }
    const closeKeyInfo = '</ds:KeyInfo>';
    const closeIdx = signedXml.indexOf(closeKeyInfo, idx);
    if (closeIdx === -1) return signedXml;
    const newKeyInfo = `${keyInfoTag}<ds:X509Data><ds:X509Certificate>${certB64}</ds:X509Certificate></ds:X509Data>${closeKeyInfo}`;
    return signedXml.slice(0, idx) + newKeyInfo + signedXml.slice(closeIdx + closeKeyInfo.length);
  }

  /**
   * Calcula el hash SHA256 del XML firmado (para almacenar como referencia).
   */
  hashXml(signedXml: string): string {
    return forge.md.sha256
      .create()
      .update(forge.util.encodeUtf8(signedXml))
      .digest()
      .toHex();
  }
}
