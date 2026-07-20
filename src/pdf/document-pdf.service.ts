import { Injectable } from '@nestjs/common';
import * as PdfMake from 'pdfmake/build/pdfmake';
import * as PdfFonts from 'pdfmake/build/vfs_fonts';
import * as QRCode from 'qrcode';
import { InvoicePayload } from '../types/sunat.types';

// Registrar fuentes por defecto
(PdfMake as any).vfs = (PdfFonts as any).pdfMake?.vfs ?? (PdfFonts as any).vfs;

export type PdfFormat = 'A4' | 'TICKET_80MM' | 'STICKER_A6';

const PAGE_SIZES: Record<PdfFormat, [number, number]> = {
  A4:          [595.28, 841.89],
  TICKET_80MM: [226.77, 650],   // 80mm ancho (variable alto)
  STICKER_A6:  [419.53, 595.28], // A6 landscape
};

@Injectable()
export class DocumentPdfService {

  /**
   * Genera el PDF de una factura o boleta.
   * @param payload - datos del comprobante
   * @param format  - 'A4' | 'TICKET_80MM' | 'STICKER_A6'
   */
  async generateInvoice(payload: InvoicePayload, format: PdfFormat = 'A4'): Promise<Buffer> {
    const qrContent = this.buildQrContent(payload);
    const qrDataUrl = await QRCode.toDataURL(qrContent, { width: 120, margin: 1 });

    const docType = payload.tipoDoc === '01' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const docId = `${payload.serie}-${payload.correlativo}`;

    if (format === 'A4') {
      return this.generateA4(payload, docType, docId, qrDataUrl);
    } else {
      return this.generateTicket(payload, docType, docId, qrDataUrl, format);
    }
  }

  // ---------- A4 ----------

  private async generateA4(
    payload: InvoicePayload,
    docType: string,
    docId: string,
    qrDataUrl: string,
  ): Promise<Buffer> {
    const moneda = payload.tipoMoneda;
    const details = payload.details.map((d, i) => [
      { text: String(i + 1), alignment: 'center' },
      { text: d.unidad },
      { text: String(d.cantidad), alignment: 'right' },
      { text: d.descripcion },
      { text: this.fmt(d.mtoValorUnitario), alignment: 'right' },
      { text: this.fmt(d.mtoValorVenta), alignment: 'right' },
    ]);

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content: [
        // Cabecera
        {
          columns: [
            {
              width: '60%',
              stack: [
                { text: payload.company.razonSocial, style: 'companyName' },
                { text: payload.company.nombreComercial ?? '', style: 'companyComercial' },
                { text: `RUC: ${payload.company.ruc}`, style: 'small' },
                { text: payload.company.address?.direccion ?? '', style: 'small' },
              ],
            },
            {
              width: '40%',
              alignment: 'center',
              stack: [
                { text: 'R.U.C. ' + payload.company.ruc, bold: true, margin: [0, 0, 0, 4] },
                { text: docType, style: 'docType' },
                { text: docId, style: 'docId' },
              ],
              border: [true, true, true, true],
              fillColor: '#f8f8f8',
              margin: [4, 0, 0, 0],
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 8, 0, 8] },

        // Datos del receptor
        {
          table: {
            widths: ['auto', '*'],
            body: [
              [{ text: 'Señor(es):', bold: true }, payload.client.rznSocial],
              [{ text: 'Tipo / N° Doc:', bold: true }, `${payload.client.tipoDoc} / ${payload.client.numDoc}`],
              [{ text: 'Fecha Emisión:', bold: true }, payload.fechaEmision.slice(0, 10)],
              [{ text: 'Moneda:', bold: true }, moneda],
            ],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 10],
        },

        // Tabla de detalle
        {
          table: {
            headerRows: 1,
            widths: [20, 35, 40, '*', 60, 60],
            body: [
              [
                { text: '#', style: 'tableHeader' },
                { text: 'U.M.', style: 'tableHeader' },
                { text: 'Cant.', style: 'tableHeader', alignment: 'right' },
                { text: 'Descripción', style: 'tableHeader' },
                { text: 'P.Unit.', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' },
              ],
              ...details,
            ],
          },
          margin: [0, 0, 0, 10],
        },

        // Totales + QR
        {
          columns: [
            {
              width: '50%',
              stack: [
                { image: qrDataUrl, width: 100, margin: [0, 10, 0, 4] },
                { text: 'Representación impresa del comprobante electrónico', style: 'tiny', italics: true },
              ],
            },
            {
              width: '50%',
              table: {
                widths: ['*', 70],
                body: [
                  ...(payload.mtoOperGravadas ? [
                    [{ text: 'OP. GRAVADAS', alignment: 'right' }, { text: `${moneda} ${this.fmt(payload.mtoOperGravadas)}`, alignment: 'right' }],
                  ] : []),
                  ...(payload.mtoOperExoneradas ? [
                    [{ text: 'OP. EXONERADAS', alignment: 'right' }, { text: `${moneda} ${this.fmt(payload.mtoOperExoneradas)}`, alignment: 'right' }],
                  ] : []),
                  ...(payload.mtoOperInafectas ? [
                    [{ text: 'OP. INAFECTAS', alignment: 'right' }, { text: `${moneda} ${this.fmt(payload.mtoOperInafectas)}`, alignment: 'right' }],
                  ] : []),
                  [{ text: 'IGV (18%)', alignment: 'right' }, { text: `${moneda} ${this.fmt(payload.mtoIGV)}`, alignment: 'right' }],
                  [{ text: 'TOTAL A PAGAR', bold: true, alignment: 'right' }, { text: `${moneda} ${this.fmt(payload.mtoImpVenta)}`, bold: true, alignment: 'right' }],
                ],
              },
              layout: 'noBorders',
              margin: [0, 10, 0, 0],
            },
          ],
        },

        // Leyendas
        ...(payload.legends ?? []).map((l) => ({ text: l.value, style: 'legend' })),
      ],

      styles: {
        companyName:      { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
        companyComercial: { fontSize: 10, color: '#555', margin: [0, 0, 0, 2] },
        docType:          { fontSize: 10, bold: true, margin: [0, 8, 0, 4] },
        docId:            { fontSize: 14, bold: true, color: '#c00' },
        tableHeader:      { bold: true, fillColor: '#eeeeee', fontSize: 9 },
        small:            { fontSize: 9, color: '#444' },
        tiny:             { fontSize: 7, color: '#888' },
        legend:           { fontSize: 9, italics: true, margin: [0, 2, 0, 0] },
      },

      defaultStyle: { fontSize: 9 },
    };

    return this.renderPdf(docDefinition);
  }

  // ---------- Ticket 80mm / Sticker ----------

  private async generateTicket(
    payload: InvoicePayload,
    docType: string,
    docId: string,
    qrDataUrl: string,
    format: PdfFormat,
  ): Promise<Buffer> {
    const moneda = payload.tipoMoneda;
    const isSticker = format === 'STICKER_A6';

    const docDefinition: any = {
      pageSize: { width: PAGE_SIZES[format][0], height: 'auto' },
      pageMargins: isSticker ? [20, 20, 20, 20] : [10, 10, 10, 10],
      content: [
        { text: payload.company.razonSocial, bold: true, alignment: 'center', fontSize: isSticker ? 11 : 9 },
        { text: `RUC: ${payload.company.ruc}`, alignment: 'center', fontSize: 8 },
        { text: payload.company.address?.direccion ?? '', alignment: 'center', fontSize: 7 },
        { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 200, y2: 2, lineWidth: 0.5, dash: { length: 3 } }], margin: [0, 3, 0, 3] },
        { text: docType, alignment: 'center', bold: true, fontSize: 9 },
        { text: docId, alignment: 'center', bold: true, fontSize: 11, color: '#c00' },
        { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 200, y2: 2, lineWidth: 0.5, dash: { length: 3 } }], margin: [0, 3, 0, 3] },
        { text: `Cliente: ${payload.client.rznSocial}`, fontSize: 7 },
        { text: `Doc: ${payload.client.numDoc}`, fontSize: 7 },
        { text: `Fecha: ${payload.fechaEmision.slice(0, 10)}`, fontSize: 7 },
        { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 200, y2: 2, lineWidth: 0.5 }], margin: [0, 3, 0, 3] },

        // Detalle
        ...payload.details.map((d) => ({
          columns: [
            { text: `${d.descripcion}\n${d.cantidad} ${d.unidad} x ${this.fmt(d.mtoValorUnitario)}`, width: '*', fontSize: 7 },
            { text: this.fmt(d.mtoValorVenta), width: 45, alignment: 'right', fontSize: 7 },
          ],
          margin: [0, 1, 0, 1],
        })),

        { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 200, y2: 2, lineWidth: 0.5 }], margin: [0, 3, 0, 3] },

        // Totales
        ...(payload.mtoOperGravadas ? [this.totRow('OP. GRAVADAS', `${moneda} ${this.fmt(payload.mtoOperGravadas)}`)] : []),
        this.totRow('IGV 18%', `${moneda} ${this.fmt(payload.mtoIGV)}`),
        this.totRow('TOTAL', `${moneda} ${this.fmt(payload.mtoImpVenta)}`, true),

        // Leyendas
        ...(payload.legends ?? []).map((l) => ({ text: l.value, fontSize: 7, italics: true, margin: [0, 1, 0, 0] })),

        // QR
        { image: qrDataUrl, width: isSticker ? 80 : 60, alignment: 'center', margin: [0, 6, 0, 4] },
        { text: 'Comprobante Electrónico - SUNAT', fontSize: 6, alignment: 'center', color: '#888' },
      ],

      defaultStyle: { fontSize: 8 },
    };

    return this.renderPdf(docDefinition);
  }

  // ---------- Helpers ----------

  private totRow(label: string, value: string, bold = false): any {
    return {
      columns: [
        { text: label, width: '*', alignment: 'right', bold, fontSize: 8 },
        { text: value, width: 55, alignment: 'right', bold, fontSize: 8 },
      ],
      margin: [0, 1, 0, 1],
    };
  }

  private buildQrContent(payload: InvoicePayload): string {
    // Formato QR SUNAT: RUC|TipoDoc|Serie|Correlativo|IGV|Total|FechaEmision|TipoDocCliente|NumDocCliente|
    return [
      payload.company.ruc,
      payload.tipoDoc,
      payload.serie,
      payload.correlativo,
      this.fmt(payload.mtoIGV),
      this.fmt(payload.mtoImpVenta),
      payload.fechaEmision.slice(0, 10),
      payload.client.tipoDoc,
      payload.client.numDoc,
      '',
    ].join('|');
  }

  private fmt(n?: number): string {
    return (n ?? 0).toFixed(2);
  }

  private renderPdf(docDefinition: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pdfDoc = (PdfMake as any).createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        if (!buffer) return reject(new Error('Error generando PDF'));
        resolve(buffer);
      });
    });
  }
}
