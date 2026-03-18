import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Trash2, Download, Printer, Camera, PenTool,
  Mail, Phone, MapPin, Instagram, TvMinimal, ChevronDown, ChevronUp
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { InvoiceData, InvoiceItem, DEFAULT_INVOICE } from './types';

// Static asset paths
const ASSETS = {
  logo: '/images/logo.jpeg',
  header: '/images/floral_header.jpeg',
  footer: '/images/floral_footer.jpeg'
};


export default function App() {
  const [data, setData] = useState<InvoiceData>(DEFAULT_INVOICE);
  const [imageAssets, setImageAssets] = useState<Record<string, string>>({});
  const [showIssuer, setShowIssuer] = useState(false);
  const [containerScale, setContainerScale] = useState(1);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Handle responsive scaling for the 800px fixed-width invoice
  useEffect(() => {
    const updateScale = () => {
      if (containerWrapperRef.current) {
        const parentWidth = containerWrapperRef.current.offsetWidth;
        const parentHeight = containerWrapperRef.current.offsetHeight;
        // Optimized shadow margins: 30px per side for width, and 80px total for height (to account for the 45px bottom offset + blur)
        const scaleX = (parentWidth - 60) / 800;
        const scaleY = (parentHeight - 80) / 1131;

        // Use the smaller scale to ensure it fits both ways
        const newScale = Math.min(2.0, scaleX, scaleY);
        setContainerScale(newScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const observer = new ResizeObserver(updateScale);
    if (containerWrapperRef.current) observer.observe(containerWrapperRef.current);

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
    };
  }, []);

  // Preload and convert static assets to Base64 (for html2canvas reliability)
  useEffect(() => {
    const loadAsBase64 = async (key: string, url: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageAssets(prev => ({ ...prev, [key]: reader.result as string }));
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.warn(`Failed to preload asset: ${url}`, err);
      }
    };

    loadAsBase64('logo', ASSETS.logo);
    loadAsBase64('header', ASSETS.header);
    loadAsBase64('footer', ASSETS.footer);
  }, []);

  // Calculations
  const totals = useMemo(() => {
    const baseImponible = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const ivaAmount = baseImponible * (data.ivaRate / 100);
    const irpfAmount = baseImponible * (data.irpfRate / 100);
    const total = baseImponible + ivaAmount - irpfAmount;

    return {
      baseImponible,
      ivaAmount,
      irpfAmount,
      total
    };
  }, [data.items, data.ivaRate, data.irpfRate]);

  // QR Code URL (Veri*factu placeholder)
  const qrUrl = useMemo(() => {
    const baseUrl = "https://www2.agenciatributaria.gob.es/wlpl/SIVA-ITBA/VerificarFactura";
    const params = new URLSearchParams({
      nif: data.issuerNif,
      numfactura: `${data.invoiceSeries}-${data.invoiceNumber}`,
      fecha: data.invoiceDate,
      importe: totals.total.toFixed(2)
    });
    return `${baseUrl}?${params.toString()}`;
  }, [data.issuerNif, data.invoiceNumber, data.invoiceSeries, data.invoiceDate, totals.total]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Handle numeric fields
    if (name === 'ivaRate' || name === 'irpfRate') {
      setData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
      return;
    }

    setData(prev => ({ ...prev, [name]: value }));
  };



  const safeFormatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return format(date, 'dd MMMM yyyy', { locale: es });
    } catch (e) {
      return dateStr;
    }
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    const processedValue = (field === 'quantity' || field === 'unitPrice')
      ? (typeof value === 'string' ? (parseFloat(value) || 0) : value)
      : value;

    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: processedValue } : item)
    }));
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [...prev.items, { id: Math.random().toString(36).substr(2, 9), description: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const removeItem = (id: string) => {
    if (data.items.length > 1) {
      setData(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== id)
      }));
    }
  };

  const exportPDF = async () => {
    if (!invoiceRef.current) return;

    try {
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 150));

      // Ensure all images are loaded
      const imgElements = Array.from(invoiceRef.current.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all([
        ...imgElements.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
        }),
        // Wait for fonts to be ready
        (document as any).fonts?.ready || Promise.resolve()
      ]);

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2, // Keep good resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 800,
        height: 1131,
        windowWidth: 800,
        windowHeight: 1131,
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('#invoice-document') as HTMLElement;
          if (el) {
            el.style.transform = 'none';
            el.style.marginBottom = '0';
            el.style.boxShadow = 'none';
            el.style.border = 'none';
            el.style.borderRadius = '0';
            el.style.width = '800px';
            el.style.height = '1131px';
            el.style.minHeight = '1131px';
            el.style.position = 'relative';
            el.style.left = '0';
            el.style.top = '0';

            // Ensure the main container has enough overflow space
            el.style.paddingBottom = '100px';

            // Targeted fix for footer icons alignment in PDF
            const footerIcons = el.querySelectorAll('.flex-col.items-start svg');
            footerIcons.forEach((svg: any) => {
              svg.style.verticalAlign = 'middle';
            });
          }
        }
      });

      // Use JPEG with 0.85 quality to drastically reduce file size while keeping text sharp
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true // Enable jsPDF compression
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      pdf.save(`Factura_${data.invoiceSeries}_${data.invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor, inténtalo de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* Form Section */}
        <div className="space-y-10 p-4 md:p-8 lg:p-12">
          <header className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <img
                  src={imageAssets.logo || ASSETS.logo}
                  alt="Sicalipsis Logo"
                  className="h-20 w-auto"
                />
                <div className="h-10 w-px bg-[var(--ink)] opacity-10" />
                <h1 className="text-[26px] font-[400] tracking-tight">
                  Generador de factures
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportPDF}
                  className="bg-[#1a1a1a] text-white px-6 py-2.5 rounded-full font-[400] text-xs uppercase tracking-widest hover:bg-[#222222] transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-black/10"
                >
                  <Download size={14} /> Generar PDF
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[13px] uppercase tracking-[0.15em] opacity-40">
              <div className="flex items-center gap-1.5">
                <Camera size={12} /> Fotografia
              </div>
              <div className="w-1 h-1 bg-[var(--ink)] rounded-full" />
              <div className="flex items-center gap-1.5">
                <PenTool size={12} /> Disseny gràfic
              </div>
            </div>
          </header>

          <div className="space-y-8">
            {/* Client Data */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-300 pb-2">
                <h2 className="text-[26px]">Dades del Client</h2>
                <span className="uppercase tracking-widest">Receptor</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="uppercase tracking-widest">Nom del Client</label>
                  <input
                    type="text" name="clientName" value={data.clientName} onChange={handleInputChange}
                    placeholder="Nom de l'empresa o client"
                    className="f-input"
                  />
                </div>
                <div className="space-y-3">
                  <label className="uppercase tracking-widest">NIF / CIF del Client</label>
                  <input
                    type="text" name="clientNif" value={data.clientNif} onChange={handleInputChange}
                    placeholder="B12345678"
                    className="f-input"
                  />
                </div>
                <div className="md:col-span-2 space-y-3">
                  <label className="uppercase tracking-widest">Adreça del Client</label>
                  <input
                    type="text" name="clientAddress" value={data.clientAddress} onChange={handleInputChange}
                    className="f-input"
                  />
                </div>
              </div>
            </section>

            {/* Invoice Details */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-300 pb-2">
                <h2 className="text-[26px]">Detalls</h2>
                <span className="uppercase tracking-widest">Factura</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="uppercase tracking-widest">Serie</label>
                  <input
                    type="text" name="invoiceSeries" value={data.invoiceSeries} onChange={handleInputChange}
                    className="f-input"
                  />
                </div>
                <div className="space-y-3">
                  <label className="uppercase tracking-widest">Número</label>
                  <input
                    type="text" name="invoiceNumber" value={data.invoiceNumber} onChange={handleInputChange}
                    className="f-input"
                  />
                </div>
                <div className="space-y-3">
                  <label className="uppercase tracking-widest">Fecha</label>
                  <input
                    type="date" name="invoiceDate" value={data.invoiceDate} onChange={handleInputChange}
                    className="f-input"
                  />
                </div>
              </div>
            </section>

            {/* Items */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-[26px]">Conceptes</h2>
                  <span className="uppercase tracking-widest">Serveis</span>
                </div>
                <button
                  onClick={addItem}
                  className="text-[#1a1a1a] hover:underline  uppercase tracking-widest flex items-center gap-1 transition-all"
                >
                  <Plus size={12} /> Afegir Concepte
                </button>
              </div>
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {data.items.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="grid grid-cols-12 gap-6 items-end group"
                    >
                      <div className="col-span-6 space-y-3">
                        <label className="text-[11px] uppercase tracking-widest">Descripció</label>
                        <input
                          type="text" value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          placeholder="Ex: Sessió fotogràfica"
                          className="f-input "
                        />
                      </div>
                      <div className="col-span-2 space-y-3">
                        <label className="text-[11px] uppercase tracking-widest text-center">Quant.</label>
                        <input
                          type="number" value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="f-input text-center"
                        />
                      </div>
                      <div className="col-span-3 space-y-3">
                        <label className="text-[11px] uppercase tracking-widest text-right">Preu</label>
                        <input
                          type="number" value={item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                          className="f-input text-right"
                        />
                      </div>
                      <div className="col-span-1 pb-1">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 hover:text-[#1a1a1a] transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* Taxes & Payment */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-300 pb-2">
                <h2 className="text-[26px]">Impostos i Pagament</h2>
                <span className="uppercase tracking-widest">Final</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="uppercase tracking-widest">IVA (%)</label>
                    <select
                      name="ivaRate" value={data.ivaRate} onChange={handleInputChange}
                      className="f-input appearance-none"
                    >
                      <option value={21}>21% (General)</option>
                      <option value={10}>10% (Reduït)</option>
                      <option value={4}>4% (Superreduït)</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="uppercase tracking-widest">IRPF (%)</label>
                    <select
                      name="irpfRate" value={data.irpfRate} onChange={handleInputChange}
                      className="f-input appearance-none"
                    >
                      <option value={15}>15% (General)</option>
                      <option value={7}>7% (Nous autònoms)</option>
                      <option value={0}>0% (No aplica)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="uppercase tracking-widest">Mètode de Pagament</label>
                    <input
                      type="text" name="paymentMethod" value={data.paymentMethod} onChange={handleInputChange}
                      placeholder="Ex: Transferència ES12 3456..."
                      className="f-input"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="uppercase tracking-widest">Notes / Observacions</label>
                    <textarea
                      name="notes" value={data.notes} onChange={handleInputChange}
                      rows={2}
                      className="f-input resize-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Issuer Data (Collapsible) */}
            <section className="space-y-4">
              <button
                onClick={() => setShowIssuer(!showIssuer)}
                className="w-full flex items-center justify-between border-b border-slate-300 pb-2 hover:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-[26px]">Les meves dades</h2>
                  <span className="uppercase tracking-widest">Emissor</span>
                </div>
                {showIssuer ? <ChevronUp size={20} className="text-slate-300" /> : <ChevronDown size={20} className="text-slate-300" />}
              </button>

              <AnimatePresence>
                {showIssuer && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 pb-6">
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Nom / Raó Social</label>
                        <input
                          type="text" name="issuerName" value={data.issuerName} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">NIF / CIF</label>
                        <input
                          type="text" name="issuerNif" value={data.issuerNif} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <label className="uppercase tracking-widest">Adreça Fiscal</label>
                        <input
                          type="text" name="issuerAddress" value={data.issuerAddress} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Web 1</label>
                        <input
                          type="text" name="issuerWeb1" value={data.issuerWeb1} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Web 2</label>
                        <input
                          type="text" name="issuerWeb2" value={data.issuerWeb2} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Email de Contacte</label>
                        <input
                          type="email" name="issuerContactEmail" value={data.issuerContactEmail} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Telèfon de Contacte</label>
                        <input
                          type="text" name="issuerContactPhone" value={data.issuerContactPhone} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <label className="uppercase tracking-widest">Adreça de Contacte</label>
                        <input
                          type="text" name="issuerContactAddress" value={data.issuerContactAddress} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Instagram 1</label>
                        <input
                          type="text" name="issuerInstagram1" value={data.issuerInstagram1} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="uppercase tracking-widest">Instagram 2</label>
                        <input
                          type="text" name="issuerInstagram2" value={data.issuerInstagram2} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-3">
                        <label className="uppercase tracking-widest">IBAN / Compte Bancari</label>
                        <input
                          type="text" name="issuerIban" value={data.issuerIban} onChange={handleInputChange}
                          className="f-input"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>


          </div>
        </div>

        {/* Preview Section */}
        <div className="lg:sticky lg:top-0 h-screen flex flex-col">
          {/* Invoice Document Wrapper for Scaling */}
          <div
            ref={containerWrapperRef}
            className="flex-1 flex justify-center items-center overflow-visible"
            style={{ minHeight: 0 }}
          >
            <div
              id="invoice-document"
              ref={invoiceRef}
              className={`bg-white shadow-[0_45px_100px_-20px_rgba(0,0,0,0.15)] py-42 px-24  flex flex-col relative shrink-0 overflow-hidden pb-20`}
              style={{
                width: '800px',
                height: '1131px',
                minHeight: '1131px',
                transform: `scale(${containerScale}) translateZ(0)`,
                transformOrigin: 'center center',
                boxSizing: 'border-box',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitFontSmoothing: 'antialiased'
              }}
            >
              {/* Static Decorations */}
              {imageAssets.header && (
                <img
                  src={imageAssets.header}
                  alt=""
                  className="absolute"
                  style={{ top: '0px', left: '10px', width: '250px' }}
                />
              )}
              {imageAssets.logo && (
                <img
                  src={imageAssets.logo}
                  alt=""
                  className="absolute"
                  style={{ top: '150px', right: '0px', width: '300px' }}
                />
              )}
              {imageAssets.footer && (
                <img
                  src={imageAssets.footer}
                  alt=""
                  className="absolute opacity-90"
                  style={{ bottom: '0px', right: '-60px', width: '350px' }}
                />
              )}

              {/* Header Section */}
              <div className="flex justify-between items-start relative z-10">
                <div className="space-y-0">
                  <h2 className="text-[18px] font-[400] uppercase tracking-[0.15em] mb-4">FACTURA</h2>
                  <div className="space-y-1 text-[15px] mt-0">
                    <p><span className="font-[400]">Núm de factura:</span> <span>{data.invoiceSeries}{data.invoiceNumber}</span></p>
                    <p><span className="font-[400]">Data:</span> <span>{safeFormatDate(data.invoiceDate)}</span></p>
                    <p><span className="font-[400]">Client:</span> <span>{data.clientName}</span></p>
                    <p><span className="font-[400]">NIF:</span> <span>{data.clientNif}</span></p>
                    <p><span className="font-[400]">Direcció:</span> <span className="">{data.clientAddress}</span></p>
                  </div>
                </div>
                <div className="text-right opacity-0 pointer-events-none">
                  <div className="h-44 w-60" />
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-[#1a1a1a] mt-4">
                <span className="text-[14px] font-sans font-bold uppercase tracking-widest">TOTAL</span>
                <span className="text-[14px] font-sans font-bold">{totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>
              </div>

              {/* Items Table */}
              <div className="relative z-10 mt-16">
                <div className="space-y-4">
                  {data.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <p className="text-[16px] font-[400]">{item.description || 'Sense descripció'}</p>
                        <p className="text-[15px]">Reportatge i entrega de totes les fotos en alta resolució</p>
                      </div>
                      <p className="text-[16px] font-[400]">
                        {(item.quantity * item.unitPrice).toLocaleString('es-ES', { minimumFractionDigits: 1 })}€
                      </p>
                    </div>
                  ))}
                </div>

              {/* Totals Section */}
              <div className="relative z-10 pt-4 border-t border-slate-300 mt-4">
                <div className="flex justify-between text-[15px] mb-1">
                  <span className="font-[400]">Base</span>
                  <span className="font-[400]">{totals.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 0 })}€</span>
                </div>
                <div className="flex flex-col items-end text-[14px]  mb-6">
                  <span>+{data.ivaRate}%IVA (+{totals.ivaAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ sobre la base)</span>
                  {data.irpfRate > 0 && <span>-{data.irpfRate}%IRPF (-{totals.irpfAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ sobre la base)</span>}
                </div>
                <div className="flex justify-between items-center py-4 border-t border-[#1a1a1a]">
                  <span className="text-[16px] font-[400] uppercase tracking-[0.1em]">TOTAL</span>
                  <span className="text-[16px] font-[400]">{totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>
                </div>
              </div>
              {/* Footer Section (Pinned to bottom) */}
              <div className="absolute bottom-18 left-24 right-24 z-10 flex flex-col items-start">
                {/* Issuer Info Centered relative to full page width */}
                <div className="w-full text-center space-y-0.5 mb-10">
                  <p className="text-[11.5px] italic">
                    {data.issuerName} · <span className="font-[400] not-italic">NIF {data.issuerNif}</span> · {data.issuerAddress}
                  </p>
                  <p className="text-[11.5px] italic">
                    Es realitzarà un únic pagament dins el període de 30 dies Núm. de compte: <span className="font-[400] italic">{data.issuerIban}</span>
                  </p>
                </div>

                <div className="w-[60%] flex justify-between items-center">
                  {/* Contact Info (Icon list below left) */}
                  <div className="flex flex-col items-start space-y-1">
                    <div className="flex gap-2.5">
                      <TvMinimal size={10} />
                      <span className="leading-none h-5">{data.issuerWeb1}</span>
                    </div>
                    <div className="flex gap-2.5">
                      <TvMinimal size={10} />
                      <span className="leading-none h-5">{data.issuerWeb2}</span>
                    </div>
                    <div className="flex gap-2.5">
                      <Mail size={10} />
                      <span className="leading-none h-5">{data.issuerContactEmail}</span>
                    </div>
                    <div className="flex gap-2.5">
                      <Phone size={10} />
                      <span className="leading-none h-5">{data.issuerContactPhone}</span>
                    </div>
                    <div className="flex gap-2.5">
                      <MapPin size={10} />
                      <span className="leading-none h-5">{data.issuerContactAddress}</span>
                    </div>
                    <div className="flex gap-2.5">
                      <Instagram size={10} />
                      <span className="leading-none h-5">{data.issuerInstagram1}</span>
                    </div>
                    <div className="flex gap-2.5">
                      <Instagram size={10} />
                      <span className="leading-none h-5">{data.issuerInstagram2}</span>
                    </div>
                  </div>

                  {/* QR Code Section */}
                  <div className="flex flex-col items-center gap-2">
                    <QRCodeSVG value={qrUrl} size={80} level="M" />
                    <span className="text-[8.5px] font-[400] uppercase tracking-wider opacity-40 text-center">Veri*factu</span>
                  </div>
                </div>

                {/* Empty Right Space for balance */}
                <div />
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
