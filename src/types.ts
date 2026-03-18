export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  issuerName: string;
  issuerNif: string;
  issuerAddress: string;
  issuerIban: string;
  issuerWeb1: string;
  issuerWeb2: string;
  issuerContactEmail: string;
  issuerContactPhone: string;
  issuerContactAddress: string;
  issuerInstagram1: string;
  issuerInstagram2: string;
  
  clientName: string;
  clientNif: string;
  clientAddress: string;
  clientEmail: string;
  
  invoiceNumber: string;
  invoiceSeries: string;
  invoiceDate: string;
  
  items: InvoiceItem[];
  
  ivaRate: number;
  irpfRate: number;
  
  paymentMethod: string;
  notes: string;
}

export const DEFAULT_INVOICE: InvoiceData = {
  issuerName: 'Israel de la Torre de la Torre',
  issuerNif: '44024714-T',
  issuerAddress: 'Crta. Barcelona, 42 Ripoll (Girona)',
  issuerIban: 'BBVA: ES54 0182 0844 5302 0391 1561',
  issuerWeb1: 'www.ilovesicalipsis.com',
  issuerWeb2: 'www.sicalipsis.com',
  issuerContactEmail: 'grafica@sicalipsis.com',
  issuerContactPhone: '647 956 198 · 972 71 43 41',
  issuerContactAddress: 'Ctra. de Barcelona, 42 (Ripoll)',
  issuerInstagram1: '@sicalipsis_fotografia',
  issuerInstagram2: '@sicalipsis_comunicaciovisual',
  
  clientName: '',
  clientNif: '',
  clientAddress: '',
  clientEmail: '',
  
  invoiceNumber: '001',
  invoiceSeries: new Date().getFullYear().toString(),
  invoiceDate: new Date().toISOString().split('T')[0],
  
  items: [
    { id: '1', description: 'Servicios profesionales', quantity: 1, unitPrice: 0 }
  ],
  
  ivaRate: 21,
  irpfRate: 15,
  
  paymentMethod: 'Transferencia bancaria',
  notes: ''
};
