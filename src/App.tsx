import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Upload,
  Download, 
  FileText, 
  User, 
  Building2, 
  Calendar, 
  Hash, 
  Euro, 
  Info,
  CheckCircle2,
  Printer,
  Mail,
  Phone,
  MapPin,
  Camera,
  PenTool,
  MousePointer2,
  Instagram,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { InvoiceData, InvoiceItem, DEFAULT_INVOICE } from './types';

const LOGO_URL = "https://sicalipsis.com/img/logo_ilovesicalipsis@2x.png";
const FLORAL_HEADER_URL = "https://www.pngplay.com/wp-content/uploads/12/Floral-Design-Transparent-Background.png";
const FLORAL_FOOTER_URL = "https://www.pngplay.com/wp-content/uploads/12/Floral-Design-Transparent-Background.png";

const Slider = ({ label, value, min, max, onChange, unit = "px" }: { label: string, value: number, min: number, max: number, onChange: (val: number) => void, unit?: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <label className="text-[8px] font-medium text-slate-400 uppercase">{label}</label>
      <span className="text-[8px] font-mono text-slate-500">{value}{unit}</span>
    </div>
    <input 
      type="range" min={min} max={max} value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1a1a1a]"
    />
  </div>
);

interface VisualImage {
  id: string;
  src: string;
  width: number;
  x: number;
  y: number;
  zIndex: number;
}

const TransformableImage = ({ 
  image,
  onChange, 
  onDelete,
  isEditMode, 
  containerRef,
  className = ""
}: { 
  image: VisualImage,
  onChange: (updates: Partial<VisualImage>) => void,
  onDelete: () => void,
  isEditMode: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  className?: string,
  key?: React.Key
}) => {
  if (!image.src) return null;

  return (
    <motion.div
      drag={isEditMode}
      dragMomentum={false}
      dragConstraints={containerRef}
      dragElastic={0}
      // Reset transform after drag ends and state updates left/top
      animate={{ x: 0, y: 0 }}
      transition={{ duration: 0 }}
      onDragEnd={(_, info) => {
        if (containerRef.current) {
          // Get the scale from the parent container's style or calculate it
          // Since we know the scale state in App, but we are in a child, 
          // we can either pass it down or calculate it from the rect
          const rect = containerRef.current.getBoundingClientRect();
          const currentScale = rect.width / 800;
          
          // Adjust offset by the scale factor
          const newX = Math.round(image.x + (info.offset.x / currentScale));
          const newY = Math.round(image.y + (info.offset.y / currentScale));
          
          onChange({ x: newX, y: newY });
        }
      }}
      style={{ 
        position: 'absolute',
        left: image.x,
        top: image.y,
        width: image.width,
        zIndex: isEditMode ? 100 + image.zIndex : image.zIndex,
        cursor: isEditMode ? 'move' : 'default',
        touchAction: 'none'
      }}
      className={`${isEditMode ? 'outline outline-2 outline-blue-400 outline-dashed bg-blue-50/10 group' : ''} ${className}`}
    >
      <img 
        src={image.src} 
        alt="" 
        className="w-full h-auto block pointer-events-none"
        style={{ opacity: 0.9 }}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
      
      {isEditMode && (
        <>
          {/* Resize Handle */}
          <motion.div
            drag
            dragMomentum={false}
            animate={{ x: 0, y: 0 }}
            transition={{ duration: 0 }}
            onDrag={(_, info) => {
              const rect = containerRef.current?.getBoundingClientRect();
              const currentScale = rect ? rect.width / 800 : 1;
              const newWidth = Math.max(20, image.width + (info.delta.x / currentScale));
              onChange({ width: newWidth });
            }}
            className="absolute -right-2 -bottom-2 w-6 h-6 bg-blue-500 rounded-full border-2 border-white cursor-nwse-resize shadow-lg flex items-center justify-center z-[110]"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full opacity-50" />
          </motion.div>

          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[110]"
          >
            <Trash2 size={12} />
          </button>

          {/* Info Label */}
          <div className="absolute -top-7 left-0 bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded shadow-sm uppercase font-bold whitespace-nowrap pointer-events-none z-[110]">
            {image.width}px | {image.x},{image.y}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default function App() {
  const [data, setData] = useState<InvoiceData>(DEFAULT_INVOICE);
  const [images, setImages] = useState<VisualImage[]>([
    { id: 'logo', src: LOGO_URL, width: 120, x: 550, y: 40, zIndex: 20 },
    { id: 'header-floral', src: FLORAL_HEADER_URL, width: 250, x: 20, y: 20, zIndex: 1 },
    { id: 'footer-floral', src: FLORAL_FOOTER_URL, width: 250, x: 450, y: 800, zIndex: 1 }
  ]);

  const [showIssuer, setShowIssuer] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [containerScale, setContainerScale] = useState(1);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Handle responsive scaling for the 800px fixed-width invoice
  useEffect(() => {
    const updateScale = () => {
      if (containerWrapperRef.current) {
        const parentWidth = containerWrapperRef.current.offsetWidth;
        // We want the invoice to be 800px wide internally
        const newScale = Math.min(1, (parentWidth - 32) / 800); // 32px for some padding
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

  const updateImage = (id: string, updates: Partial<VisualImage>) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const addImage = (src: string) => {
    const newImage: VisualImage = {
      id: `img-${Date.now()}`,
      src,
      width: 150,
      x: 50,
      y: 50,
      zIndex: images.length + 1
    };
    setImages(prev => [...prev, newImage]);
  };

  // Load images as base64 to avoid CORS issues with html2canvas
  React.useEffect(() => {
    const proxies = [
      (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url: string) => `https://images.weserv.nl/?url=${encodeURIComponent(url.replace('https://', ''))}&output=png`,
      (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    const tryFetch = async (url: string, proxyIdx = -1): Promise<string> => {
      try {
        let fetchUrl = url;
        if (proxyIdx >= 0) {
          if (proxyIdx >= proxies.length) throw new Error('All proxies failed');
          fetchUrl = proxies[proxyIdx](url);
        }
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const blob = await response.blob();
        if (blob.size < 100) throw new Error('Blob too small');

        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn(`Attempt ${proxyIdx === -1 ? 'Direct' : proxyIdx} failed for ${url}, trying next...`);
        return tryFetch(url, proxyIdx + 1);
      }
    };

    // Load Logo
    tryFetch(LOGO_URL)
      .then(dataUrl => updateImage('logo', { src: dataUrl }))
      .catch(() => {
        fetch('./logo.png').then(r => r.ok && updateImage('logo', { src: './logo.png' }));
      });

    // Load Floral Header
    tryFetch(FLORAL_HEADER_URL)
      .then(dataUrl => updateImage('header-floral', { src: dataUrl }))
      .catch(() => {
        fetch('./floral_header.jpeg').then(r => r.ok && updateImage('header-floral', { src: './floral_header.jpeg' }));
      });

    // Load Floral Footer
    tryFetch(FLORAL_FOOTER_URL)
      .then(dataUrl => updateImage('footer-floral', { src: dataUrl }))
      .catch(() => {
        fetch('./floral_footer.jpeg').then(r => r.ok && updateImage('footer-floral', { src: './floral_footer.jpeg' }));
      });
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
    
    const wasEditMode = isEditMode;
    if (wasEditMode) setIsEditMode(false);

    try {
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 150));

      // Ensure all images are loaded
      const imgElements = Array.from(invoiceRef.current.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all(imgElements.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }));

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
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
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`Factura_${data.invoiceSeries}_${data.invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor, inténtalo de nuevo.');
    } finally {
      if (wasEditMode) setIsEditMode(wasEditMode);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-sans p-4 md:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Form Section */}
        <div className="space-y-10">
          <header className="space-y-6">
            <div className="flex items-center gap-6">
              <img 
                src={images.find(img => img.id === 'logo')?.src || LOGO_URL} 
                alt="Sicalipsis Logo" 
                className="h-24 w-auto"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
              <div className="h-12 w-px bg-[var(--ink)] opacity-10" />
              <h1 className="text-3xl font-display font-bold tracking-tight">
                Factura Maker
              </h1>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-sans font-light uppercase tracking-[0.15em] opacity-40">
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
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <h2 className="font-display text-2xl font-light">Datos del Cliente</h2>
                <span className="text-[10px] font-light uppercase tracking-widest text-slate-400">Receptor</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Nombre Cliente</label>
                  <input 
                    type="text" name="clientName" value={data.clientName} onChange={handleInputChange}
                    placeholder="Nombre de la empresa o cliente"
                    className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors text-lg font-display font-normal"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">NIF / CIF Cliente</label>
                  <input 
                    type="text" name="clientNif" value={data.clientNif} onChange={handleInputChange}
                    placeholder="B12345678"
                    className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Dirección Cliente</label>
                  <input 
                    type="text" name="clientAddress" value={data.clientAddress} onChange={handleInputChange}
                    className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                  />
                </div>
              </div>
            </section>

            {/* Invoice Details */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <h2 className="font-display text-2xl font-light">Detalles</h2>
                <span className="text-[10px] font-light uppercase tracking-widest text-slate-400">Factura</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Serie</label>
                  <input 
                    type="text" name="invoiceSeries" value={data.invoiceSeries} onChange={handleInputChange}
                    className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Número</label>
                  <input 
                    type="text" name="invoiceNumber" value={data.invoiceNumber} onChange={handleInputChange}
                    className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Fecha</label>
                  <input 
                    type="date" name="invoiceDate" value={data.invoiceDate} onChange={handleInputChange}
                    className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                  />
                </div>
              </div>
            </section>

            {/* Items */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl font-light">Conceptos</h2>
                  <span className="text-[10px] font-light uppercase tracking-widest text-slate-400">Servicios</span>
                </div>
                <button 
                  onClick={addItem}
                  className="text-[#1a1a1a] hover:underline text-[10px] font-light uppercase tracking-widest flex items-center gap-1 transition-all"
                >
                  <Plus size={12} /> Añadir Concepto
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
                      <div className="col-span-6 space-y-1.5">
                        <label className="text-[9px] font-light text-slate-400 uppercase tracking-widest">Descripción</label>
                        <input 
                          type="text" value={item.description} 
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          placeholder="Ej: Sessió fotogràfica"
                          className="w-full bg-transparent border-b border-slate-200 py-1.5 focus:border-[#1a1a1a] outline-none transition-colors text-sm font-display font-normal"
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-light text-slate-400 uppercase tracking-widest text-center block">Cant.</label>
                        <input 
                          type="number" value={item.quantity} 
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-200 py-1.5 focus:border-[#1a1a1a] outline-none transition-colors text-center text-sm font-light"
                        />
                      </div>
                      <div className="col-span-3 space-y-1.5">
                        <label className="text-[9px] font-light text-slate-400 uppercase tracking-widest text-right block">Precio</label>
                        <input 
                          type="number" value={item.unitPrice} 
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-200 py-1.5 focus:border-[#1a1a1a] outline-none transition-colors text-right text-sm font-light"
                        />
                      </div>
                      <div className="col-span-1 pb-1">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 text-slate-300 hover:text-[#1a1a1a] transition-colors opacity-0 group-hover:opacity-100"
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
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <h2 className="font-display text-2xl font-light">Impuestos y Pago</h2>
                <span className="text-[10px] font-light uppercase tracking-widest text-slate-400">Final</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">IVA (%)</label>
                    <select 
                      name="ivaRate" value={data.ivaRate} onChange={handleInputChange}
                      className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors appearance-none font-light"
                    >
                      <option value={21}>21% (General)</option>
                      <option value={10}>10% (Reducido)</option>
                      <option value={4}>4% (Superreducido)</option>
                      <option value={0}>0% (Exento)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">IRPF (%)</label>
                    <select 
                      name="irpfRate" value={data.irpfRate} onChange={handleInputChange}
                      className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors appearance-none font-light"
                    >
                      <option value={15}>15% (General)</option>
                      <option value={7}>7% (Nuevos autónomos)</option>
                      <option value={0}>0% (No aplica)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Método de Pago</label>
                    <input 
                      type="text" name="paymentMethod" value={data.paymentMethod} onChange={handleInputChange}
                      placeholder="Ej: Transferencia ES12 3456..."
                      className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Notas / Observaciones</label>
                    <textarea 
                      name="notes" value={data.notes} onChange={handleInputChange}
                      rows={2}
                      className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors resize-none font-light"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Issuer Data (Collapsible) */}
            <section className="space-y-4">
              <button 
                onClick={() => setShowIssuer(!showIssuer)}
                className="w-full flex items-center justify-between border-b border-slate-200 pb-2 hover:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl font-light">Mis Datos</h2>
                  <span className="text-[10px] font-light uppercase tracking-widest text-slate-400">Emisor</span>
                </div>
                {showIssuer ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
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
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Nombre / Razón Social</label>
                        <input 
                          type="text" name="issuerName" value={data.issuerName} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors text-lg font-display font-normal"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">NIF / CIF</label>
                        <input 
                          type="text" name="issuerNif" value={data.issuerNif} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Dirección Fiscal</label>
                        <input 
                          type="text" name="issuerAddress" value={data.issuerAddress} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Web 1</label>
                        <input 
                          type="text" name="issuerWeb1" value={data.issuerWeb1} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Web 2</label>
                        <input 
                          type="text" name="issuerWeb2" value={data.issuerWeb2} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Email Contacto</label>
                        <input 
                          type="email" name="issuerContactEmail" value={data.issuerContactEmail} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Teléfono Contacto</label>
                        <input 
                          type="text" name="issuerContactPhone" value={data.issuerContactPhone} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Dirección Contacto</label>
                        <input 
                          type="text" name="issuerContactAddress" value={data.issuerContactAddress} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Instagram 1</label>
                        <input 
                          type="text" name="issuerInstagram1" value={data.issuerInstagram1} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">Instagram 2</label>
                        <input 
                          type="text" name="issuerInstagram2" value={data.issuerInstagram2} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-light text-slate-400 uppercase tracking-widest">IBAN / Cuenta Bancaria</label>
                        <input 
                          type="text" name="issuerIban" value={data.issuerIban} onChange={handleInputChange}
                          className="w-full bg-transparent border-b border-slate-300 py-2 focus:border-[#1a1a1a] outline-none transition-colors font-light"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Images and Decoration Section */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-2xl font-light">Imágenes y Decoración</h2>
                  <span className="text-[10px] font-light uppercase tracking-widest text-slate-400">Diseño</span>
                </div>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                    isEditMode 
                      ? 'bg-blue-500 border-blue-500 text-white font-bold shadow-lg shadow-blue-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <MousePointer2 size={12} />
                  {isEditMode ? 'Guardar Diseño' : 'Editar Visualmente'}
                </button>
              </div>

              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Elementos del Documento</h4>
                    <p className="text-[9px] text-slate-400">Sube imágenes y actívalas para arrastrarlas por el documento</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setImages([])}
                      className="bg-white border border-red-200 text-red-500 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Limpiar Todo
                    </button>
                    <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-200">
                      <Plus size={12} /> Añadir Imagen
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => addImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="bg-white p-2 rounded-xl border border-slate-100 flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
                        <img src={img.src} alt="" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold truncate uppercase text-slate-400">{img.id}</p>
                        <p className="text-[8px] text-slate-300">{Math.round(img.width)}px | {Math.round(img.x)},{Math.round(img.y)}</p>
                      </div>
                      <button 
                        onClick={() => deleteImage(img.id)}
                        className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {isEditMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <p className="text-[10px] text-blue-600 leading-relaxed italic">
                          * El modo edición está ACTIVO. Ahora puedes arrastrar las imágenes directamente sobre la vista previa de la factura para posicionarlas. Usa el tirador azul en la esquina de cada imagen para cambiar su tamaño.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>

        {/* Preview Section */}
        <div className="lg:sticky lg:top-12 h-fit space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-light uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Printer size={14} /> Preview
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">{Math.round(containerScale * 100)}%</span>
                <button 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                    isEditMode 
                      ? 'bg-blue-500 border-blue-500 text-white font-bold shadow-lg shadow-blue-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <MousePointer2 size={12} />
                  {isEditMode ? 'Guardar Diseño' : 'Editar Visualmente'}
                </button>
              </div>
            </div>
            <button 
              onClick={exportPDF}
              className="bg-[#1a1a1a] text-white px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
            >
              <Download size={14} /> Exportar PDF
            </button>
          </div>

          {/* Invoice Document Wrapper for Scaling */}
          <div 
            ref={containerWrapperRef} 
            className="w-full flex justify-center overflow-hidden bg-slate-100/30 rounded-3xl border border-slate-200/50 p-4 md:p-8"
            style={{ height: containerScale > 0 ? 1131 * containerScale + 64 : 'auto' }}
          >
            <div 
              id="invoice-document"
              ref={invoiceRef}
              className={`bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] p-12 text-[#1a1a1a] flex flex-col relative shrink-0 ${isEditMode ? 'overflow-visible' : 'overflow-hidden'}`}
              style={{ 
                width: '800px', 
                height: '1131px',
                minHeight: '1131px',
                transform: `scale(${containerScale})`,
                transformOrigin: 'top center',
                boxSizing: 'border-box'
              }}
            >
            {/* Transformable Images */}
            {images.map((img) => (
              <TransformableImage 
                key={img.id}
                image={img}
                onChange={(updates) => updateImage(img.id, updates)}
                onDelete={() => deleteImage(img.id)}
                isEditMode={isEditMode}
                containerRef={invoiceRef}
              />
            ))}

            {/* Header Section */}
            <div className="flex justify-between items-start mt-8 mb-0 relative z-10 px-12">
              <div className="space-y-0 pt-8">
                <h2 className="text-[12px] font-sans font-bold uppercase tracking-widest mb-0">FACTURA</h2>
                <div className="space-y-0.5 text-[11px] font-sans mt-1">
                  <p><span className="font-bold">Núm de factura:</span> <span className="font-light">{data.invoiceSeries}/{data.invoiceNumber}</span></p>
                  <p><span className="font-bold">Data:</span> <span className="font-light">{safeFormatDate(data.invoiceDate)}</span></p>
                  <p><span className="font-bold">Client:</span> <span className="font-light">{data.clientName}</span></p>
                  <p><span className="font-bold">NIF:</span> <span className="font-light">{data.clientNif}</span></p>
                  <p><span className="font-bold">Direcció:</span> <span className="font-light">{data.clientAddress}</span></p>
                </div>
              </div>
              <div className="text-right opacity-0 pointer-events-none">
                <div className="h-32 w-48" />
              </div>
            </div>

            {/* Items Table */}
            <div className="relative z-10 mt-12 px-12">
              <div className="space-y-2">
                {data.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div className="space-y-0">
                      <p className="text-[14px] font-sans font-bold">{item.description || 'Sense descripció'}</p>
                      <p className="text-[11px] font-sans font-light opacity-70">Reportatge i entrega de totes les fotos en alta resolució</p>
                    </div>
                    <p className="text-[14px] font-sans font-light">
                      {(item.quantity * item.unitPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Section (Follows naturally) */}
            <div className="relative z-10 pt-4 border-t border-slate-100 space-y-2 mt-8 mx-12">
              <div className="flex justify-between text-[12px] font-sans">
                <span className="font-light opacity-70">Base</span>
                <span className="font-light">{totals.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>
              </div>
              <div className="flex justify-between text-[12px] font-sans">
                <span className="font-light opacity-70">IVA (+{data.ivaRate}%)</span>
                <span className="font-light">+{totals.ivaAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>
              </div>
              {data.irpfRate > 0 && (
                <div className="flex justify-between text-[12px] font-sans">
                  <span className="font-light opacity-70">Retenció IRPF (-{data.irpfRate}%)</span>
                  <span className="font-light">-{totals.irpfAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-[#1a1a1a] mt-4">
                <span className="text-[14px] font-sans font-bold uppercase tracking-widest">TOTAL</span>
                <span className="text-[14px] font-sans font-bold">{totals.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</span>
              </div>
            </div>

            {/* Footer Section (Pinned to bottom) */}
            <div className="absolute bottom-12 left-12 right-12 z-10">
              {/* Issuer Info Centered */}
              <div className="text-center space-y-1 mb-8">
                <p className="text-[9px] font-sans font-light italic opacity-70">
                  {data.issuerName} · <span className="font-bold not-italic">NIF {data.issuerNif}</span> · {data.issuerAddress}
                </p>
                <p className="text-[9px] font-sans font-light italic opacity-60">
                  Es realitzarà un único pagament dins el període de 30 dies Núm. de compte: <span className="font-bold">{data.issuerIban}</span>
                </p>
              </div>

              {/* Contact Info & QR */}
              <div className="grid grid-cols-3 items-end pb-6 px-12">
                {/* Contact List (Left) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <MousePointer2 size={12} className="opacity-40" /> {data.issuerWeb1}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <MousePointer2 size={12} className="opacity-40" /> {data.issuerWeb2}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <Mail size={12} className="opacity-40" /> {data.issuerContactEmail}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <Phone size={12} className="opacity-40" /> {data.issuerContactPhone}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <MapPin size={12} className="opacity-40" /> {data.issuerContactAddress}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <Instagram size={12} className="opacity-40" /> {data.issuerInstagram1}
                  </div>
                  <div className="flex items-center gap-4 text-[9px] font-sans font-light opacity-70">
                    <Instagram size={12} className="opacity-40" /> {data.issuerInstagram2}
                  </div>
                </div>

                {/* QR Code (Centered) */}
                <div className="flex justify-center">
                  <div className="p-1 bg-white border border-slate-100 rounded-sm">
                    <QRCodeSVG value={qrUrl} size={80} level="M" />
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
