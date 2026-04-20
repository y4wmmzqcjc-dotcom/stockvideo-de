const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password', };
// Fallback-Mollie-Key (Test). Wird im fetch()-Handler ueberschrieben, wenn
// env.MOLLIE_API_KEY gesetzt ist — damit kannst du via "wrangler secret put MOLLIE_API_KEY"
// auf den Live-Key rotieren, ohne den Code zu deployen.
let MOLLIE_API_KEY = 'test_A7njP8NN7AHtBVdxUPF96ccCErfQdS';
const SITE_URL = 'https://stockvideo.de';
const WORKER_URL = 'https://stockvideo-checkout.rende.workers.dev';
const R2_PUBLIC = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';
// EASYBILL_API_KEY wird via env (Worker Secret) injiziert — siehe _eb_createCustomerAndInvoice.
// RESEND_API_KEY wird via env (Worker Secret) injiziert — siehe _resend_sendDownload.
const FROM_EMAIL = 'info@stockvideo.de';
const FROM_NAME = 'stockvideo.de';
const VIDEO_MAP = {"braune-kuh-auf-der-weide-4k-stock-video":"videos/kuhbraun.mp4"};

// === S6 FIX: Stale Lock Timeout ===
const STALE_LOCK_TIMEOUT = 600000;  // 10 Minuten - Balance zwischen Crash-Recovery und echtem Retry blockieren

function downloadUrlFor(slug, r2Key) { const key = r2Key || VIDEO_MAP[slug]; if (!key) return null; return R2_PUBLIC + '/' + key; }
// === stockvideo-checkout licence/order extension ===
// Fallback-Secret. Im fetch()-Handler wird dieser Wert durch env.DOWNLOAD_SECRET
// überschrieben, falls das Worker-Secret gesetzt ist. So kannst du jederzeit
// silent rotieren, indem du das Cloudflare-Secret setzt — ohne Code-Deploy.
let DOWNLOAD_SECRET = "4ed67f0f87a3e6c2fada8764a854aa4a056c0e2f27085633507f3c3f919c98fb";
async function _ord_hmac(secret, msg){ const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]); const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)); return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join(""); }
async function _ord_signDownload(orderId, ttl){ const t = ttl || 60*60*24*7; const exp = Math.floor(Date.now()/1000) + t; return exp + "." + (await _ord_hmac(DOWNLOAD_SECRET, orderId+"."+exp)); }
function _ord_newId(){ const d = new Date(); const ymd = d.toISOString().slice(0,10).replace(/-/g,""); const r = crypto.getRandomValues(new Uint8Array(4)); return "ORD-"+ymd+"-"+Array.from(r).map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase(); }
function _ord_validateBilling(b){ if (!b || typeof b !== "object") return "billing missing"; const req = ["firstName","lastName","street","zip","city","country","email"]; for (const k of req) if (!b[k] || typeof b[k] !== "string" || !b[k].trim()) return "billing."+k+" missing"; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) return "billing.email invalid"; return null; }
function _pdf_escape(s){const m={0x20ac:0x80,0x201a:0x82,0x192:0x83,0x201e:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x2c6:0x88,0x2030:0x89,0x160:0x8a,0x2039:0x8b,0x152:0x8c,0x17d:0x8e,0x2018:0x91,0x2019:0x92,0x201c:0x93,0x201d:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x2dc:0x98,0x2122:0x99,0x161:0x9a,0x203a:0x9b,0x153:0x9c,0x17e:0x9e,0x178:0x9f};let o='';for(const ch of String(s)){let c=ch.codePointAt(0);if(c>127&&m[c]!=null)c=m[c];if(c>255){o+='?';continue;}if(c===92){o+='\\\\';}else if(c===40){o+='\\(';}else if(c===41){o+='\\)';}else if(c<32||c>=128){o+='\\'+c.toString(8).padStart(3,'0');}else{o+=String.fromCharCode(c);}}return o;}
function _u8(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i)&0xff;return a;}
function _cat(arrs){let n=0;for(const a of arrs)n+=a.length;const r=new Uint8Array(n);let o=0;for(const a of arrs){r.set(a,o);o+=a.length;}return r;}
function _jpgDims(u8){let i=2;while(i<u8.length-8){if(u8[i]!==0xff){i++;continue;}const m=u8[i+1];i+=2;if(m>=0xc0&&m<=0xcf&&m!==0xc4&&m!==0xc8&&m!==0xcc){return {h:(u8[i+3]<<8)|u8[i+4],w:(u8[i+5]<<8)|u8[i+6]};}const len=(u8[i]<<8)|u8[i+1];if(!len)return null;i+=len;}return null;}
async function _fetchJpg(url){try{const r=await fetch(url);if(!r.ok)return null;const b=new Uint8Array(await r.arrayBuffer());const d=_jpgDims(b);if(!d)return null;return {bytes:b,w:d.w,h:d.h};}catch(e){return null;}}
async function _pdf_buildLicense(order){
  const b=order.billing||{};const title=(order.video&&order.video.title)||"";const slug=(order.video&&order.video.slug)||"";
  const thumb=slug?await _fetchJpg(R2_PUBLIC+"/thumbs/"+slug+".jpg"):null;
  const qr=await _fetchJpg("https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=jpg&data="+encodeURIComponent(SITE_URL+"/video/"+slug+"/"));
  const cmds=[];
  cmds.push("q 0.106 0.106 0.106 rg 0 702 595 140 re f Q");
  cmds.push("BT /F2 28 Tf 1 1 1 rg 50 760 Td (stockvideo) Tj 0.145 0.388 0.922 rg (.de) Tj ET");
  cmds.push("BT /F1 11 Tf 0.8 0.8 0.8 rg 50 735 Td (Lizenzurkunde / License Certificate) Tj ET");
  if(thumb){const s=Math.min(455/thumb.w,200/thumb.h);const w=thumb.w*s,h=thumb.h*s;const x=(595-w)/2,y=490;cmds.push("q "+w.toFixed(2)+" 0 0 "+h.toFixed(2)+" "+x.toFixed(2)+" "+y.toFixed(2)+" cm /Im1 Do Q");}
  let y=450;
  cmds.push("BT /F2 12 Tf 0.106 0.106 0.106 rg 50 "+y+" Td (Bestelldetails) Tj ET");y-=20;
  const info=[["Order ID",order.id],["Datum",((order.paidAt||order.createdAt||"")+"").slice(0,10)],["Video",title],["Projekt",order.projectName||"-"],["Betrag",(Number(order.amount)||0).toFixed(2)+" EUR"]];
  for(const [k,v] of info){cmds.push("BT /F1 10 Tf 0.45 0.45 0.45 rg 50 "+y+" Td ("+_pdf_escape(k)+") Tj ET");cmds.push("BT /F2 10 Tf 0.1 0.1 0.1 rg 150 "+y+" Td ("+_pdf_escape(v)+") Tj ET");y-=16;}
  y-=10;cmds.push("BT /F2 12 Tf 0.106 0.106 0.106 rg 50 "+y+" Td (Lizenznehmer) Tj ET");y-=18;
  const lic=[[b.firstName,b.lastName].filter(Boolean).join(" "),b.company,b.street,[b.zip,b.city].filter(Boolean).join(" "),b.country,b.email,b.vatId?"USt-IdNr.: "+b.vatId:""].filter(Boolean);
  for(const l of lic){cmds.push("BT /F1 10 Tf 0.2 0.2 0.2 rg 50 "+y+" Td ("+_pdf_escape(l)+") Tj ET");y-=14;}
  y-=12;cmds.push("BT /F2 12 Tf 0.106 0.106 0.106 rg 50 "+y+" Td (Lizenzumfang) Tj ET");y-=18;
  const terms=["Der Lizenznehmer erhält eine zeitlich und räumlich","unbegrenzte, nicht-exklusive Nutzungslizenz für das","oben bezeichnete Videomaterial gemäß den Lizenz-","bedingungen von stockvideo.de (Standard Royalty-Free)."];
  for(const t of terms){cmds.push("BT /F1 10 Tf 0.3 0.3 0.3 rg 50 "+y+" Td ("+_pdf_escape(t)+") Tj ET");y-=14;}
  if(qr){cmds.push("q 90 0 0 90 455 70 cm /Im2 Do Q");cmds.push("BT /F1 8 Tf 0.45 0.45 0.45 rg 455 58 Td (Video-Seite) Tj ET");}
  cmds.push("q 0.145 0.388 0.922 rg 0 0 595 30 re f Q");
  cmds.push("BT /F2 9 Tf 1 1 1 rg 50 11 Td (stockvideo.de - Lizenzfreie Stock-Videos in 4K & HD) Tj ET");
  const content=cmds.join("\n");
  let imNum=7;const thumbObj=thumb?imNum++:0;const qrObj=qr?imNum++:0;
  let xobj="";if(thumb)xobj+="/Im1 "+thumbObj+" 0 R ";if(qr)xobj+="/Im2 "+qrObj+" 0 R ";
  const resources="<< /Font << /F1 5 0 R /F2 6 0 R >>"+(xobj?" /XObject << "+xobj+">>":"")+" >>";
  const parts=[];parts.push(_u8("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
  const offsets=[];const pushObj=(bytes)=>{let n=0;for(const p of parts)n+=p.length;offsets.push(n);parts.push(bytes);};
  pushObj(_u8("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
  pushObj(_u8("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"));
  pushObj(_u8("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources "+resources+" /Contents 4 0 R >>\nendobj\n"));
  const contU8=_u8(content);
  pushObj(_cat([_u8("4 0 obj\n<< /Length "+contU8.length+" >>\nstream\n"),contU8,_u8("\nendstream\nendobj\n")]));
  pushObj(_u8("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"));
  pushObj(_u8("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"));
  if(thumb)pushObj(_cat([_u8(thumbObj+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+thumb.w+" /Height "+thumb.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+thumb.bytes.length+" >>\nstream\n"),thumb.bytes,_u8("\nendstream\nendobj\n")]));
  if(qr)pushObj(_cat([_u8(qrObj+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+qr.w+" /Height "+qr.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+qr.bytes.length+" >>\nstream\n"),qr.bytes,_u8("\nendstream\nendobj\n")]));
  let total=0;for(const p of parts)total+=p.length;
  const nObj=offsets.length;let xref="xref\n0 "+(nObj+1)+"\n0000000000 65535 f \n";
  for(const o of offsets)xref+=String(o).padStart(10,"0")+" 00000 n \n";
  xref+="trailer\n<< /Size "+(nObj+1)+" /Root 1 0 R >>\nstartxref\n"+total+"\n%%EOF";
  parts.push(_u8(xref));return _cat(parts);
}
// Konstantzeitvergleich fuer Hex-Strings (HMAC, sha256hex). Verhindert Timing-Seitenkanal.
function _timingSafeEqualHex(a, b){ if(typeof a!=='string'||typeof b!=='string')return false; if(a.length!==b.length)return false; let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff===0; }
async function _ord_verifyToken(orderId, token){ if(!token)return false; const parts=token.split("."); if(parts.length!==2)return false; const exp=parseInt(parts[0],10); if(!exp||Date.now()/1000>exp)return false; const expected=await _ord_hmac(DOWNLOAD_SECRET, orderId+"."+exp); return _timingSafeEqualHex(expected, parts[1]); }
function _b64_fromStr(s){let r="";for(let i=0;i<s.length;i++)r+=String.fromCharCode(s.charCodeAt(i)&0xff);return btoa(r);}
function _html_escape(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);}
function _country_iso(c){const m={"Deutschland":"DE","Germany":"DE","Österreich":"AT","Austria":"AT","Schweiz":"CH","Switzerland":"CH"};if(!c)return"DE";if(c.length===2)return c.toUpperCase();return m[c]||"DE";}
async function _eb_createCustomerAndInvoice(env,order){
  const EASYBILL_API_KEY = (env && env.EASYBILL_API_KEY) || '';
  if (!EASYBILL_API_KEY) throw new Error("easybill: missing env.EASYBILL_API_KEY");
  const b=order.billing||{};
  const cust={company_name:b.company||"",first_name:b.firstName||"",last_name:b.lastName||"",street:b.street||"",zip_code:b.zip||"",city:b.city||"",country:_country_iso(b.country),emails:[b.email],vat_identifier:b.vatId||""};
  const cr=await fetch("https://api.easybill.de/rest/v1/customers",{method:"POST",headers:{"Authorization":"Bearer "+EASYBILL_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(cust)});
  if(!cr.ok)throw new Error("easybill customer "+cr.status+": "+(await cr.text()).slice(0,300));
  const cj=await cr.json();
  const title=(order.video&&order.video.title)||"Video-Lizenz";
  const gross=Number(order.amount)||0;
  const net=+(gross*100/1.19).toFixed(2);
  const desc="Royalty-Free Lizenz: "+title+(order.projectName?" (Projekt: "+order.projectName+")":"")+" | Order: "+order.id;
  // WICHTIG: is_draft:true MUSS bleiben. Rechnungen werden ausschliesslich als Entwurf gespeichert.
  // Der Versand der Rechnung an den Kunden erfolgt MANUELL durch den Inhaber nach Sichtpruefung in EasyBill.
  // Dieser Worker macht KEINEN /documents/{id}/send-by-email Aufruf.
  const doc={type:"INVOICE",pdf_template:"422215",customer_id:cj.id,is_draft:true,text_prefix:"",title:"Rechnung Video-Lizenz | Order: "+order.id,items:[{number:String((order.video&&order.video.id)||""),description:desc,quantity:1,single_price_net:net,vat_percent:19}],text:"Vielen Dank f\u00fcr Ihren Einkauf bei stockvideo.de.",file_format_config:[{type:"default"},{type:"zugferd2_4_en16931"}]};
  const dr=await fetch("https://api.easybill.de/rest/v1/documents",{method:"POST",headers:{"Authorization":"Bearer "+EASYBILL_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(doc)});
  if(!dr.ok)throw new Error("easybill doc "+dr.status+": "+(await dr.text()).slice(0,300));
  const dj=await dr.json();
  return {customerId:cj.id,documentId:dj.id,number:dj.number||null};
}
// === HELPERS für Base64 (für Resend-Attachments) ===
function _u8ToB64(u8){let s='';const c=0x8000;for(let i=0;i<u8.length;i+=c){s+=String.fromCharCode.apply(null,u8.subarray(i,i+c));}return btoa(s);}

// === Generischer Mehrseiten-Text-PDF-Builder ===
// paragraphs: [{text, bold, size, color, spaceBefore}]
function _pdf_buildTextDoc(title, paragraphs){
  const PW=595,PH=842,LH=14,TT=722,TB=60;
  const pages=[];let cmds=[];let y=TT;
  function newPage(){
    if(cmds.length>0)pages.push(cmds);cmds=[];y=TT;
    cmds.push("q 0.106 0.106 0.106 rg 0 762 595 80 re f Q");
    cmds.push("BT /F2 22 Tf 1 1 1 rg 50 "+(PH-50)+" Td (stockvideo) Tj 0.145 0.388 0.922 rg (.de) Tj ET");
    cmds.push("BT /F1 11 Tf 0.8 0.8 0.8 rg 50 "+(PH-72)+" Td ("+_pdf_escape(title)+") Tj ET");
    cmds.push("q 0.145 0.388 0.922 rg 0 0 595 30 re f Q");
    cmds.push("BT /F2 9 Tf 1 1 1 rg 50 11 Td (stockvideo.de - Lizenzfreie Stock-Videos in 4K & HD) Tj ET");
  }
  function wrap(text,maxChars){
    if(!text)return [''];
    const words=String(text).split(' ');const lines=[];let cur='';
    for(const w of words){
      if(w.length>maxChars){
        if(cur){lines.push(cur);cur='';}
        let rest=w;while(rest.length>maxChars){lines.push(rest.slice(0,maxChars));rest=rest.slice(maxChars);}
        cur=rest;continue;
      }
      const cand=cur?(cur+' '+w):w;
      if(cand.length>maxChars){lines.push(cur);cur=w;}else{cur=cand;}
    }
    if(cur)lines.push(cur);return lines;
  }
  newPage();
  for(const p of paragraphs){
    const font=p.bold?'/F2':'/F1';const size=p.size||10;
    const maxC=size===10?90:(size===11?82:(size===12?75:(size===14?64:90)));
    const color=p.color||"0.1 0.1 0.1";
    const before=p.spaceBefore!==undefined?p.spaceBefore:(size>=12?14:4);
    y-=before;
    if(!p.text||p.text===''){y-=LH;continue;}
    const lines=wrap(p.text,maxC);
    for(const ln of lines){
      if(y<TB){newPage();}
      cmds.push("BT "+font+" "+size+" Tf "+color+" rg 50 "+y+" Td ("+_pdf_escape(ln)+") Tj ET");
      y-=LH;
    }
  }
  pages.push(cmds);
  const parts=[];parts.push(_u8("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
  const offsets=[];const pushObj=(b)=>{let n=0;for(const p of parts)n+=p.length;offsets.push(n);parts.push(b);};
  const np=pages.length;const f1=3+2*np,f2=f1+1;
  const res="<< /Font << /F1 "+f1+" 0 R /F2 "+f2+" 0 R >> >>";
  pushObj(_u8("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
  let kids='';for(let i=0;i<np;i++)kids+=(3+i)+' 0 R ';
  pushObj(_u8("2 0 obj\n<< /Type /Pages /Kids ["+kids.trim()+"] /Count "+np+" >>\nendobj\n"));
  for(let i=0;i<np;i++){const pn=3+i,cn=3+np+i;pushObj(_u8(pn+" 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+PW+" "+PH+"] /Resources "+res+" /Contents "+cn+" 0 R >>\nendobj\n"));}
  for(let i=0;i<np;i++){const cn=3+np+i;const cont=pages[i].join("\n");const cU8=_u8(cont);pushObj(_cat([_u8(cn+" 0 obj\n<< /Length "+cU8.length+" >>\nstream\n"),cU8,_u8("\nendstream\nendobj\n")]));}
  pushObj(_u8(f1+" 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"));
  pushObj(_u8(f2+" 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"));
  let total=0;for(const p of parts)total+=p.length;
  const no=offsets.length;let xref="xref\n0 "+(no+1)+"\n0000000000 65535 f \n";
  for(const o of offsets)xref+=String(o).padStart(10,"0")+" 00000 n \n";
  xref+="trailer\n<< /Size "+(no+1)+" /Root 1 0 R >>\nstartxref\n"+total+"\n%%EOF";
  parts.push(_u8(xref));return _cat(parts);
}

// === Kontakt-Daten aus config.json ziehen (Single Source of Truth) ===
// Fallback entspricht public/data/config.json — nur wirksam, wenn der Fetch fehlschlaegt.
const CONTACT_FALLBACK={name:"Timo Rende",brandName:"Stockvideo.de",street:"Haldenstraße 16",city:"66806 Saarlouis / Ensdorf",phone:"06831 5052856",mobile:"0151 2046 3824",fax:"06831 5051619",email:"info@stockvideo.de",web:"www.stockvideo.de",ustId:"DE291222648"};
async function _fetchContact(){
  try{
    const r=await fetch("https://stockvideo.de/data/config.json",{cf:{cacheTtl:300}});
    if(r.ok){const j=await r.json();if(j&&j.contact&&j.contact.name&&j.contact.street&&j.contact.city)return j.contact;}
  }catch(e){}
  return CONTACT_FALLBACK;
}
// Ein-Zeilen-Adresse fuer Inline-Nennung (z.B. in § 6 Widerrufsbelehrung): "Timo Rende (Stockvideo.de), Haldenstraße 16, 66806 Saarlouis / Ensdorf"
function _contactInline(C){return (C.name+(C.brandName?" ("+C.brandName+")":"")+", "+C.street+", "+C.city);}

// === AGB als PDF (Inhalt aus src/pages/agb.astro; Adresse aus config.json) ===
function _pdf_buildAGB(contact){
  const C=contact||CONTACT_FALLBACK;
  const inline=_contactInline(C);
  const contactDetails="E-Mail: "+(C.email||"info@stockvideo.de")+(C.phone?", Telefon: "+C.phone:"")+(C.fax?", Fax: "+C.fax:"");
  const P=[
    {text:"Allgemeine Geschäftsbedingungen",bold:true,size:14,spaceBefore:0},
    {text:"§ 1 Geltungsbereich",bold:true,size:12,spaceBefore:16},
    {text:"Diese Allgemeinen Geschäftsbedingungen gelten für alle Bestellungen und Lizenzierungen von Videoclips über die Website stockvideo.de, betrieben von "+inline+"."},
    {text:"§ 2 Vertragsschluss",bold:true,size:12,spaceBefore:16},
    {text:"Die Darstellung der Videoclips auf der Website stellt kein rechtlich bindendes Angebot, sondern eine Aufforderung zur Bestellung dar. Durch das Absenden einer Bestellung geben Sie ein verbindliches Angebot zum Kauf ab. Der Vertrag kommt mit der Zahlungsbestätigung zustande."},
    {text:"§ 3 Lizenz",bold:true,size:12,spaceBefore:16},
    {text:"Mit dem Kauf erwerben Sie eine nichtexklusive, zeitlich unbegrenzte Lizenz zur Nutzung des Videoclips gemäß der gewählten Lizenzstufe (Web/Social, Standard oder Premium). Die Lizenz umfasst das Recht zur Nutzung in kommerziellen und nichtkommerziellen Projekten."},
    {text:"§ 4 Preise und Zahlung",bold:true,size:12,spaceBefore:16},
    {text:"Alle angegebenen Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer. Die Zahlung erfolgt über unseren Zahlungsdienstleister Mollie. Verfügbare Zahlungsarten: SEPA Lastschrift, Kreditkarte, PayPal, Sofort."},
    {text:"§ 5 Lieferung",bold:true,size:12,spaceBefore:16},
    {text:"Nach erfolgreicher Zahlung erhalten Sie einen Downloadlink per E-Mail. Die Videodateien werden im Format MP4 und/oder MOV bereitgestellt. Der Downloadlink ist sieben Tage ab Zustellung der Bestätigungs-E-Mail gültig; danach kann ein neuer Link auf Anfrage über "+(C.email||"info@stockvideo.de")+" angefordert werden."},
    {text:"§ 6 Widerrufsrecht für Verbraucher",bold:true,size:12,spaceBefore:16},
    {text:"Widerrufsbelehrung",bold:true,size:11,spaceBefore:8},
    {text:"Widerrufsrecht. Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses."},
    {text:"Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ("+inline+", "+contactDetails+") mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist."},
    {text:"Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden."},
    {text:"Folgen des Widerrufs. Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet."},
    {text:"Vorzeitiges Erlöschen des Widerrufsrechts bei digitalen Inhalten",bold:true,size:11,spaceBefore:10},
    {text:"Das Widerrufsrecht erlischt bei einem Vertrag über die Lieferung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten vorzeitig, wenn wir mit der Ausführung des Vertrages begonnen haben, nachdem Sie (1) ausdrücklich zugestimmt haben, dass wir mit der Ausführung des Vertrages vor Ablauf der Widerrufsfrist beginnen, (2) Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrages Ihr Widerrufsrecht verlieren, und (3) wir Ihnen eine Bestätigung gemäß § 312f Absatz 3 BGB zur Verfügung gestellt haben (§ 356 Absatz 5 BGB)."},
    {text:"Die Zustimmung erteilen Sie im Bestellprozess durch das Setzen des entsprechenden Häkchens. Der Beginn der Ausführung erfolgt, sobald der Download-Link generiert und Ihnen per E-Mail zugestellt wurde."},
    {text:"§ 7 Haftung",bold:true,size:12,spaceBefore:16},
    {text:"Wir haften unbeschränkt für Vorsatz und grobe Fahrlässigkeit. Für leichte Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten und der Höhe nach begrenzt auf den vorhersehbaren, vertragstypischen Schaden."},
    {text:"§ 8 Schlussbestimmungen",bold:true,size:12,spaceBefore:16},
    {text:"Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Saarlouis. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt."},
  ];
  return _pdf_buildTextDoc("Allgemeine Geschäftsbedingungen",P);
}

// === Muster-Widerrufsformular als PDF (Adresse aus config.json, vorausgefüllt mit Bestelldaten) ===
function _pdf_buildWiderrufsformular(order,contact){
  const C=contact||CONTACT_FALLBACK;
  const b=order.billing||{};
  const name=[b.firstName,b.lastName].filter(Boolean).join(" ");
  const addr=[b.street,[b.zip,b.city].filter(Boolean).join(" "),b.country].filter(Boolean).join(", ");
  const title=(order.video&&order.video.title)||"";
  const dateOrdered=((order.paidAt||order.createdAt||"")+"").slice(0,10);
  const P=[
    {text:"Muster-Widerrufsformular",bold:true,size:14,spaceBefore:0},
    {text:"(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden es zurück.)",size:9,color:"0.45 0.45 0.45",spaceBefore:6},
    {text:"An:",bold:true,size:11,spaceBefore:18},
    {text:C.name,size:11},
    ...(C.brandName?[{text:C.brandName,size:11}]:[]),
    {text:C.street,size:11},
    {text:C.city,size:11},
    {text:"E-Mail: "+(C.email||"info@stockvideo.de"),size:11},
    ...(C.phone?[{text:"Telefon: "+C.phone,size:11}]:[]),
    ...(C.fax?[{text:"Fax: "+C.fax,size:11}]:[]),
    {text:"Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*):",spaceBefore:18},
    {text:"Royalty-Free Lizenz: "+title+(order.projectName?" (Projekt: "+order.projectName+")":""),bold:true,spaceBefore:8},
    {text:"Bestellnummer: "+order.id,spaceBefore:6},
    {text:"Bestellt am: "+dateOrdered,spaceBefore:4},
    {text:"Erhalten am: "+dateOrdered,spaceBefore:4},
    {text:"Name des/der Verbraucher(s): "+name,spaceBefore:14},
    {text:"Anschrift des/der Verbraucher(s): "+addr,spaceBefore:6},
    {text:"E-Mail des/der Verbraucher(s): "+(b.email||""),spaceBefore:6},
    {text:"Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ____________________",spaceBefore:18},
    {text:"Datum: ____________________",spaceBefore:10},
    {text:"(*) Unzutreffendes streichen.",size:9,color:"0.45 0.45 0.45",spaceBefore:18},
    {text:"Hinweis zum Erlöschen des Widerrufsrechts bei digitalen Inhalten",bold:true,size:11,spaceBefore:24},
    {text:"Bitte beachten Sie: Mit Ihrer ausdrücklichen Zustimmung im Bestellprozess (Häkchen) und unserer Bestätigung gemäß § 312f Abs. 3 BGB ist Ihr Widerrufsrecht für den heruntergeladenen Videoclip nach § 356 Abs. 5 BGB bereits mit Beginn der Ausführung (Bereitstellung des Download-Links) erloschen. Eine Rückerstattung ist daher in der Regel ausgeschlossen.",size:9,color:"0.3 0.3 0.3"},
  ];
  return _pdf_buildTextDoc("Muster-Widerrufsformular",P);
}

// === Admin-Benachrichtigungsmail bei jedem Kauf ===
async function _resend_sendAdminNotification(env,order){
  const RESEND_API_KEY=(env&&env.RESEND_API_KEY)||'';
  if(!RESEND_API_KEY)throw new Error("resend admin: missing env.RESEND_API_KEY");
  const b=order.billing||{};
  const title=(order.video&&order.video.title)||"-";
  const name=[b.firstName,b.lastName].filter(Boolean).join(" ")||"-";
  const amount=(Number(order.amount)||0).toFixed(2)+" EUR";
  const inv=order.easybill?(order.easybill.number||order.easybill.documentId||"-"):"-";
  const html='<div style="font-family:Arial,Helvetica,sans-serif;color:#1b1b1b;max-width:560px;margin:0 auto;padding:24px 20px;line-height:1.5">'
    +'<h2 style="color:#2563eb;margin:0 0 16px">Neuer Kauf auf stockvideo.de</h2>'
    +'<table style="width:100%;border-collapse:collapse;font-size:14px">'
    +'<tr><td style="padding:6px 0;color:#666;width:140px">Bestellnummer</td><td style="padding:6px 0"><b>'+_html_escape(order.id)+'</b></td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Datum</td><td style="padding:6px 0">'+_html_escape((order.paidAt||"").slice(0,19).replace("T"," "))+'</td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Video</td><td style="padding:6px 0">'+_html_escape(title)+'</td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Betrag (brutto)</td><td style="padding:6px 0"><b>'+_html_escape(amount)+'</b></td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Rechnung EasyBill</td><td style="padding:6px 0">'+_html_escape(String(inv))+'</td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Kunde</td><td style="padding:6px 0">'+_html_escape(name)+'</td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">E-Mail</td><td style="padding:6px 0"><a href="mailto:'+_html_escape(b.email||"")+'">'+_html_escape(b.email||"-")+'</a></td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Firma</td><td style="padding:6px 0">'+_html_escape(b.company||"-")+'</td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Anschrift</td><td style="padding:6px 0">'+_html_escape([b.street,[b.zip,b.city].filter(Boolean).join(" "),b.country].filter(Boolean).join(", "))+'</td></tr>'
    +'<tr><td style="padding:6px 0;color:#666">Projekt</td><td style="padding:6px 0">'+_html_escape(order.projectName||"-")+'</td></tr>'
    +'</table>'
    +(order.easybillError?'<p style="color:#b00;margin-top:14px">EasyBill-Fehler: '+_html_escape(order.easybillError)+'</p>':'')
    +(order.emailError?'<div style="background:#fff3f3;border:1px solid #f0c6c6;border-radius:6px;padding:12px 14px;margin-top:14px"><p style="color:#b00;margin:0 0 6px;font-weight:700">⚠ Kauf-Mail konnte NICHT an den Kunden zugestellt werden.</p><p style="margin:0 0 6px;font-size:13px">Der Kunde hat bisher weder Download-Link noch Lizenz erhalten. Bitte zeitnah manuell unter <a href="mailto:'+_html_escape(b.email||"")+'">'+_html_escape(b.email||"-")+'</a> kontaktieren.</p><p style="margin:0;color:#666;font-size:12px">Technischer Grund: '+_html_escape(order.emailError)+'</p></div>':'')
    +'<p style="color:#999;font-size:12px;margin-top:24px">Automatische Benachrichtigung vom stockvideo-checkout Worker.</p>'
    +'</div>';
  const subjectPrefix=order.emailError?"[Kauf · Zustellung FEHLGESCHLAGEN]":"[Kauf]";
  const payload={from:FROM_NAME+" <"+FROM_EMAIL+">",to:["info@stockvideo.de"],subject:subjectPrefix+" "+title+" - "+amount+" - "+order.id,html:html};
  if(b.email)payload.reply_to=b.email;
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  if(!r.ok)throw new Error("resend admin "+r.status+": "+(await r.text()).slice(0,300));
  return await r.json();
}

async function _resend_sendDownload(env,order,downloadUrl,licenseUrl){
  const RESEND_API_KEY = (env && env.RESEND_API_KEY) || '';
  if (!RESEND_API_KEY) throw new Error("resend: missing env.RESEND_API_KEY");
  const b=order.billing||{};
  const title=(order.video&&order.video.title)||"";
  const name=[b.firstName,b.lastName].filter(Boolean).join(" ")||"Kunde";
  const html='<div style="font-family:\'Source Sans 3\',Arial,Helvetica,sans-serif;color:#e1e1e1;background:#1b1b1b;max-width:600px;margin:0 auto;padding:32px 28px;line-height:1.55">'
    +'<div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:24px">stockvideo<span style="color:#2563eb">.de</span></div>'
    +'<p style="color:#e1e1e1">Hallo '+_html_escape(name)+',</p>'
    +'<p style="color:#e1e1e1">vielen Dank für Ihren Einkauf auf stockvideo.de.</p>'
    +'<p style="color:#e1e1e1"><strong style="color:#fff">Video:</strong> '+_html_escape(title)+'<br><strong style="color:#fff">Bestellnummer:</strong> '+_html_escape(order.id)+'</p>'
    +'<p style="margin:28px 0 12px"><a href="'+downloadUrl+'" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">Video herunterladen</a></p>'
    +'<p style="margin:0 0 24px"><a href="'+licenseUrl+'" style="display:inline-block;background:transparent;color:#2563eb;padding:10px 0;text-decoration:none;font-weight:600">Lizenzurkunde (PDF) herunterladen</a></p>'
    +'<p style="color:#9a9a9a;font-size:14px">Der Video-Download-Link ist 7 Tage gültig. Die Lizenzurkunde steht Ihnen dauerhaft unter obigem Link zur Verfügung.</p>'
    +'<p style="color:#9a9a9a;font-size:14px">Ihre Rechnung erhalten Sie in den kommenden Tagen per E-Mail.</p>'
    +'<hr style="border:none;border-top:1px solid #333;margin:28px 0">'
    +'<p style="color:#fff;font-size:14px;font-weight:700;margin:0 0 6px">Vertragsunterlagen im Anhang</p>'
    +'<p style="color:#9a9a9a;font-size:13px;margin:0 0 14px">Im Anhang dieser E-Mail finden Sie unsere Allgemeinen Geschäftsbedingungen (AGB.pdf) sowie das Muster-Widerrufsformular (Widerrufsformular.pdf) zu Ihren Akten.</p>'
    +'<p style="color:#9a9a9a;font-size:13px;margin:0 0 14px"><strong style="color:#fff">Hinweis zum Erlöschen des Widerrufsrechts (§ 356 Abs. 5 BGB):</strong> Mit Ihrer ausdrücklichen Zustimmung im Bestellprozess und der vorliegenden Bestätigung ist Ihr Widerrufsrecht für die heruntergeladenen digitalen Inhalte erloschen, da die Ausführung des Vertrages mit Bereitstellung des Download-Links begonnen hat.</p>'
    +'<hr style="border:none;border-top:1px solid #333;margin:28px 0">'
    +'<p style="color:#666;font-size:12px">stockvideo.de · Lizenzfreie Stock-Videos in 4K &amp; HD</p>'
    +'</div>';
  let attachments=[];
  try{
    const contact=await _fetchContact();
    const agbPdf=_pdf_buildAGB(contact);
    const wfPdf=_pdf_buildWiderrufsformular(order,contact);
    attachments=[
      {filename:"AGB.pdf",content:_u8ToB64(agbPdf)},
      {filename:"Widerrufsformular.pdf",content:_u8ToB64(wfPdf)},
    ];
  }catch(e){/* PDF-Build-Fehler: Mail trotzdem versenden, aber loggen */ order.attachmentError=String(e&&e.message||e); }
  // BCC bewusst entfernt: Wenn ein Admin-Postfach auf Resends Suppression-Liste landet, blockiert das sonst die Buyer-Mail komplett.
  // Die Admin-Kopie läuft separat über _resend_sendAdminNotification.
  const body={from:FROM_NAME+" <"+FROM_EMAIL+">",to:[b.email],subject:"Ihr Download von stockvideo.de",html:html,attachments:attachments};
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!r.ok)throw new Error("resend "+r.status+": "+(await r.text()).slice(0,300));
  return await r.json();
}

// === S4 FIX: Retroactive Migration für alte Orders (Backward-Compat) ===
function _migrateOrder(o){
  if (o.easybill && typeof o.easybill === 'object' && !o.easybillSent) {
    o.easybillSent = true;  // War schon erfolgreich vor Patch
  }
  return o;
}

// ===== FIXED FULFILLMENT FUNCTION =====
async function _fulfill_paidOrder(env,order){
  if (!order.easybillSent) {
    try{
      const inv=await _eb_createCustomerAndInvoice(env,order);
      order.easybill=inv;
      order.easybillSent=true;
    }catch(e){
      order.easybillError=String(e.message||e);
      order.easybillSent=false;
    }
  }

  if (!order.emailSent) {
    try{
      const sig=await _ord_signDownload(order.id);
      const durl=SITE_URL+"/dl/"+order.id+"?token="+sig;
      const lurl=SITE_URL+"/pdf/"+order.id+"?token="+sig;
      const rs=await _resend_sendDownload(env,order,durl,lurl);
      order.emailSent={id:rs.id||null,at:new Date().toISOString(),to:order.billing.email};
    }catch(e){
      order.emailError=String(e.message||e);
      order.emailSent=false;
    }
  }

  if (!order.adminNotified) {
    try{
      const an=await _resend_sendAdminNotification(env,order);
      order.adminNotified={id:an.id||null,at:new Date().toISOString()};
    }catch(e){
      order.adminNotifyError=String(e.message||e);
    }
  }

  return order;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    // Worker-Secret für Download-URL-Signaturen kann jederzeit via env rotiert werden.
    if (env && env.DOWNLOAD_SECRET) DOWNLOAD_SECRET = env.DOWNLOAD_SECRET;
    if (env && env.MOLLIE_API_KEY) MOLLIE_API_KEY = env.MOLLIE_API_KEY;
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/create-payment' && request.method === 'POST') {
        const body = await request.json();
        const { videoId, videoTitle, price, slug, r2Key } = body;
        if (!videoId || !slug) return jsonResponse({ error: 'Missing required fields' }, 400);
        // Kanonischen Preis serverseitig ziehen — Client-Preis wird nur als Sanity-Check akzeptiert.
        let vmHit = null;
        try { const vr = await fetch('https://raw.githubusercontent.com/y4wmmzqcjc-dotcom/stockvideo-de/main/public/data/videos.json', { cf:{cacheTtl:60} }); if (vr.ok) { const va = await vr.json(); vmHit = va.find(x => String(x.id) === String(videoId) || x.slug === slug) || null; } } catch(e) {}
        if (!vmHit) return jsonResponse({ error: 'video not found' }, 404);
        const canonPrice = (vmHit.prices && typeof vmHit.prices.standard === 'number') ? vmHit.prices.standard : null;
        if (canonPrice == null || canonPrice <= 0) return jsonResponse({ error: 'video price missing' }, 500);
        if (price != null && typeof price === 'number' && Math.abs(price - canonPrice) > 0.01) return jsonResponse({ error: 'price mismatch', canonical: canonPrice }, 400);
        const payment = await createMolliePayment({
          amount: { currency: 'EUR', value: canonPrice.toFixed(2) },
          description: 'stockvideo.de — ' + (videoTitle || 'Stock Video'),
          redirectUrl: SITE_URL + '/checkout/success/?slug=' + encodeURIComponent(slug),
          cancelUrl: SITE_URL + '/video/' + slug + '/',
          webhookUrl: url.origin + '/webhook',
          metadata: { videoId: String(videoId), slug, videoTitle: videoTitle || '', r2Key: r2Key || vmHit.r2Key || VIDEO_MAP[slug] || '' },
        });
        await patchMolliePayment(payment.id, { redirectUrl: SITE_URL + '/checkout/success/?payment_id=' + payment.id + '&slug=' + encodeURIComponent(slug) });
        return jsonResponse({ paymentId: payment.id, checkoutUrl: payment._links.checkout.href, status: payment.status });
      }
      if (path === '/payment-status' && request.method === 'GET') {
        const paymentId = url.searchParams.get('id');
        if (!paymentId) return jsonResponse({ error: 'Missing payment id' }, 400);
        const payment = await getMolliePayment(paymentId);
        const slug = payment.metadata?.slug || '';
        const r2Key = payment.metadata?.r2Key || '';
        let downloadUrl = null;
        if (payment.status === 'paid') { downloadUrl = downloadUrlFor(slug, r2Key); }
        return jsonResponse({ id: payment.id, status: payment.status, slug, videoTitle: payment.metadata?.videoTitle || '', paidAt: payment.paidAt || null, downloadUrl });
      }
      if (path === '/list-payments' && request.method === 'GET') {
        const r = await fetch('https://api.mollie.com/v2/payments?limit=25', { headers: { 'Authorization': 'Bearer ' + MOLLIE_API_KEY } });
        const j = await r.json();
        const simplified = (j._embedded?.payments || []).map(p => ({ id: p.id, status: p.status, method: p.method, createdAt: p.createdAt, redirectUrl: p.redirectUrl, metadata: p.metadata, checkoutUrl: p._links?.checkout?.href || null }));
        return jsonResponse(simplified);
      }
      if (path === '/webhook' && request.method === 'POST') { return new Response('OK', { status: 200 }); }

      // === Resend Webhook: Bounce / Complaint / Delivery-Delayed -> Mail an Admin ===
      if (path === '/webhook/resend' && request.method === 'POST') {
        try {
          const RESEND_API_KEY = (env && env.RESEND_API_KEY) || '';
          if (!RESEND_API_KEY) return new Response('no key', { status: 200 });
          // --- Svix signature verification (Task #34) ---
          // Header: svix-id, svix-timestamp, svix-signature ("v1,<base64sig> v1,<base64sig>")
          // Signed data: `${svix_id}.${svix_timestamp}.${rawBody}` — HMAC-SHA256 with base64-decoded secret
          // Secret env: RESEND_WEBHOOK_SECRET = "whsec_<base64>". Return 401 on failure, 5-min replay window.
          const rawBody = await request.text();
          const WEBHOOK_SECRET = (env && env.RESEND_WEBHOOK_SECRET) || '';
          if (WEBHOOK_SECRET) {
            const svixId = request.headers.get('svix-id') || request.headers.get('webhook-id') || '';
            const svixTs = request.headers.get('svix-timestamp') || request.headers.get('webhook-timestamp') || '';
            const svixSig = request.headers.get('svix-signature') || request.headers.get('webhook-signature') || '';
            if (!svixId || !svixTs || !svixSig) return new Response('missing svix headers', { status: 401 });
            // 5 Minuten Replay-Fenster
            const tsNum = parseInt(svixTs, 10);
            const nowSec = Math.floor(Date.now() / 1000);
            if (!tsNum || Math.abs(nowSec - tsNum) > 300) return new Response('stale timestamp', { status: 401 });
            // Secret hat das Prefix "whsec_" und ist danach Base64
            const secretB64 = WEBHOOK_SECRET.startsWith('whsec_') ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET;
            const secretBytes = Uint8Array.from(atob(secretB64), c => c.charCodeAt(0));
            const signedPayload = svixId + '.' + svixTs + '.' + rawBody;
            const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
            const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
            // Header kann mehrere "v1,<sig>"-Paare space-separiert enthalten
            const sigs = svixSig.split(' ').map(s => { const parts = s.split(','); return parts.length === 2 ? parts[1] : ''; }).filter(Boolean);
            let match = false;
            for (const s of sigs) { if (s.length === expected.length) { let diff = 0; for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i); if (diff === 0) { match = true; break; } } }
            if (!match) return new Response('invalid signature', { status: 401 });
          }
          const evt = JSON.parse(rawBody);
          const t = evt && evt.type;
          if (t === 'email.bounced' || t === 'email.complained' || t === 'email.delivery_delayed' || t === 'email.failed') {
            const data = (evt && evt.data) || {};
            const recipients = Array.isArray(data.to) ? data.to.join(', ') : (data.to || '-');
            const subject = data.subject || '-';
            const reason = (data.bounce && (data.bounce.message || data.bounce.subType || data.bounce.type))
              || (data.complaint && (data.complaint.complaintFeedbackType || data.complaint.feedbackType))
              || (data.failed && (data.failed.reason || data.failed.message))
              || (data.reason || data.error || '-');
            // "email.failed" tritt u. a. auf, wenn Resend die Mail wegen Suppression-Liste gar nicht erst annimmt.
            const isSuppression = t === 'email.failed' && /suppress/i.test(JSON.stringify(data || {}));
            const heading = isSuppression ? 'Resend: Empfaenger auf Suppression-Liste' : ('Resend: ' + t);
            const intro = isSuppression
              ? 'Der Empfaenger steht auf Resends Suppression-Liste und konnte daher NICHT beliefert werden. Im Resend-Dashboard pruefen und ggf. aus der Suppression-Liste entfernen.'
              : 'Eine E-Mail von stockvideo.de wurde nicht zugestellt. Der Empfaenger landet damit ggf. auf der Resend-Suppression-Liste.';
            const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#1b1b1b;max-width:560px;margin:0 auto;padding:24px 20px;line-height:1.5">'
              + '<h2 style="color:#b00;margin:0 0 16px">' + _html_escape(heading) + '</h2>'
              + '<p>' + _html_escape(intro) + '</p>'
              + '<table style="width:100%;border-collapse:collapse;font-size:14px">'
              + '<tr><td style="padding:6px 0;color:#666;width:140px">Empfaenger</td><td style="padding:6px 0"><b>' + _html_escape(recipients) + '</b></td></tr>'
              + '<tr><td style="padding:6px 0;color:#666">Betreff</td><td style="padding:6px 0">' + _html_escape(subject) + '</td></tr>'
              + '<tr><td style="padding:6px 0;color:#666">Grund</td><td style="padding:6px 0">' + _html_escape(String(reason)) + '</td></tr>'
              + '<tr><td style="padding:6px 0;color:#666">Resend-ID</td><td style="padding:6px 0"><code>' + _html_escape(String(data.email_id || data.id || '-')) + '</code></td></tr>'
              + '<tr><td style="padding:6px 0;color:#666">Zeitpunkt</td><td style="padding:6px 0">' + _html_escape(String(evt.created_at || new Date().toISOString())) + '</td></tr>'
              + '</table>'
              + '<p style="color:#666;font-size:13px;margin-top:18px">Im Resend-Dashboard ggf. die Suppression aufheben oder den Empfaenger anders erreichen.</p>'
              + '</div>';
            const subjTag = isSuppression ? '[Resend Suppression]' : ('[Resend ' + t + ']');
            const body = { from: FROM_NAME + ' <' + FROM_EMAIL + '>', to: ['info@stockvideo.de'], subject: subjTag + ' ' + recipients, html: html };
            await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          }
          return new Response('ok', { status: 200 });
        } catch (e) { return new Response('ok', { status: 200 }); }
      }
      if (path === '/download' && request.method === 'GET') {
        const paymentId = url.searchParams.get('id');
        if (!paymentId) return new Response('Missing id', { status: 400, headers: CORS_HEADERS });
        const payment = await getMolliePayment(paymentId);
        if (payment.status !== 'paid') { return new Response('Payment not completed', { status: 403, headers: CORS_HEADERS }); }
        const slug = payment.metadata && payment.metadata.slug;
        let r2Key = (payment.metadata && payment.metadata.r2Key) || (slug && VIDEO_MAP[slug]) || null;
        if (!r2Key && slug) { try { const vr = await fetch('https://stockvideo.de/data/videos.json',{cf:{cacheTtl:60}}); if (vr.ok) { const arr = await vr.json(); const m = arr.find(x=>x.slug===slug); if (m && m.r2Key) r2Key = m.r2Key; } } catch(e){} }
        if (!r2Key && slug) r2Key = 'videos/' + slug + '.mp4';
        if (!r2Key) return new Response('No video for slug', { status: 404, headers: CORS_HEADERS });
        const filename = r2Key.split('/').pop();
        const r2res = await fetch(R2_PUBLIC + '/' + r2Key);
        if (!r2res.ok) return new Response('R2 fetch failed: ' + r2res.status, { status: 502, headers: CORS_HEADERS });
        const h = new Headers();
        h.set('Content-Type', 'video/mp4');
        h.set('Content-Disposition', 'attachment; filename="' + filename + '"');
        const cl = r2res.headers.get('content-length');
        if (cl) h.set('Content-Length', cl);
        h.set('Access-Control-Allow-Origin', '*');
        h.set('Cache-Control', 'no-store');
        return new Response(r2res.body, { status: 200, headers: h });
      }
      if (path.startsWith('/admin/')) {
        if (request.method === 'OPTIONS') { return new Response(null, { headers: { ...CORS_HEADERS } }); }
        // Admin-Passwort-Hash: SHA-256 von "Powerscreener2026". Fallback, wenn env.ADMIN_PASSWORD nicht gesetzt ist.
        // Bevorzugt wird ADMIN_PASSWORD aus der Worker-Env — dann wird live dagegen gehasht.
        const ADMIN_HASH_DEFAULT = '3a303142f06e6c320d77b906aa38a07f64d8944354f29e4f2d5df63252662238';
        const ADMIN_HASH = (env && env.ADMIN_PASSWORD) ? await sha256hex(env.ADMIN_PASSWORD) : ADMIN_HASH_DEFAULT;
        const GH_TOKEN = env.GH_TOKEN || '';
        const GH_REPO = 'y4wmmzqcjc-dotcom/stockvideo-de';
        const GH_BRANCH = 'main';
        const sha256hex = async (s) => { const b = new TextEncoder().encode(s); const h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''); };
        const getPw = async (req) => { let pw = req.headers.get('X-Admin-Password'); if (!pw) { try { const b = await req.clone().json(); pw = b && b.password; } catch(e){} } return pw; };
        // Akzeptiert Klartext (sha256(pw) === ADMIN_HASH) ODER den bereits vorgehashten Wert (pw === ADMIN_HASH).
        // Beides konstantzeit-verglichen.
        const verify = async (req) => { const pw = await getPw(req); if (!pw) return false; const pwHashed = await sha256hex(pw); return _timingSafeEqualHex(pwHashed, ADMIN_HASH) || _timingSafeEqualHex(pw, ADMIN_HASH); };
        const ghHeaders = { 'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'stockvideo-worker', 'Accept': 'application/vnd.github.v3+json' };
        const ghGet = async (p) => { const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + p + '?ref=' + GH_BRANCH, { headers: ghHeaders }); if (!r.ok) return null; const j = await r.json(); return { sha: j.sha, content: atob(j.content.replace(/\n/g,'')) }; };
        const ghPut = async (p, content, msg, sha) => { const body = { message: msg, content: btoa(unescape(encodeURIComponent(content))), branch: GH_BRANCH }; if (sha) body.sha = sha; const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + p, { method: 'PUT', headers: { ...ghHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); return { status: r.status, json: j }; };
        if (path === '/admin/verify' && request.method === 'POST') { const ok = await verify(request); return jsonResponse({ ok: ok }, ok ? 200 : 401); }
        if (!(await verify(request))) { return jsonResponse({ error: 'unauthorized' }, 401); }
        if (path === '/admin/r2-stats' && request.method === 'GET') { if (!env.R2) return jsonResponse({ error: 'R2 not bound' }, 500); let total = 0, count = 0, cursor; do { const listed = await env.R2.list({ cursor, limit: 1000 }); for (const obj of listed.objects) { total += obj.size; count++; } cursor = listed.truncated ? listed.cursor : undefined; } while (cursor); return jsonResponse({ totalBytes: total, objectCount: count }); }

    if (path === '/admin/r2-put' && request.method === 'PUT') {
      if (!(await verify(request))) return jsonResponse({ error: 'unauthorized' }, 401);
      if (!env.R2) return jsonResponse({ error: 'R2 not bound' }, 500);
      const key = url.searchParams.get('key');
      if (!key) return jsonResponse({ error: 'key query param required' }, 400);
      if (!/^images\/[A-Za-z0-9._\/-]+\.(jpe?g|png|webp|gif)$/i.test(key)) return jsonResponse({ error: 'key not in whitelist' }, 403);
      const ct = request.headers.get('Content-Type') || 'application/octet-stream';
      const buf = await request.arrayBuffer();
      if (!buf || buf.byteLength === 0) return jsonResponse({ error: 'empty body' }, 400);
      if (buf.byteLength > 20 * 1024 * 1024) return jsonResponse({ error: 'too large (max 20MB)' }, 413);
      await env.R2.put(key, buf, { httpMetadata: { contentType: ct }, customMetadata: { uploadedBy: 'admin-rotate', ts: String(Date.now()) } });
      return jsonResponse({ ok: true, key: key, size: buf.byteLength, contentType: ct });
    }
        if (path === '/admin/last-commit' && request.method === 'GET') { const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/commits/' + GH_BRANCH, { headers: ghHeaders }); if (!r.ok) return jsonResponse({ error: 'github', status: r.status }, 502); const j = await r.json(); return jsonResponse({ sha: j.sha ? j.sha.slice(0,7) : null, date: j.commit && j.commit.author ? j.commit.author.date : null, message: j.commit && j.commit.message ? j.commit.message.split('\n')[0] : null }); }
        if (path === '/admin/data' && request.method === 'GET') { const kind = url.searchParams.get('kind'); if (kind !== 'videos' && kind !== 'categories') return jsonResponse({ error: 'bad kind' }, 400); const f = await ghGet('public/data/' + kind + '.json'); if (!f) return jsonResponse({ items: [], sha: null }); let arr = []; try { arr = JSON.parse(f.content); } catch(e){} return jsonResponse({ items: arr, sha: f.sha }); }
        if (path === '/admin/data' && request.method === 'POST') { const body = await request.json(); const kind = body.kind; if (kind !== 'videos' && kind !== 'categories') return jsonResponse({ error: 'bad kind' }, 400); if (!Array.isArray(body.items)) return jsonResponse({ error: 'items must be array' }, 400); const p = 'public/data/' + kind + '.json'; const existing = await ghGet(p); const content = JSON.stringify(body.items, null, 2); const res = await ghPut(p, content, 'admin: update ' + kind + '.json (' + body.items.length + ' items)', existing && existing.sha); if (res.status >= 300) return jsonResponse({ error: 'github', status: res.status, msg: res.json.message }, 502); return jsonResponse({ ok: true, commit: res.json.commit && res.json.commit.sha }); }
        if (path === '/admin/commit' && request.method === 'POST') {
          const body = await request.json();
          if (!body.path || typeof body.content !== 'string') return jsonResponse({ error: 'path+content required' }, 400);
          // Pfad-Whitelist: nur Daten-JSON und Upload-Assets. Kein Traversal. Keine Worker-/Code-Pfade.
          const p = String(body.path);
          if (p.includes('..') || p.startsWith('/')) return jsonResponse({ error: 'invalid path' }, 400);
          const allowed = /^public\/data\/[A-Za-z0-9._-]+\.json$/.test(p) || /^public\/uploads\/[A-Za-z0-9._\/-]+$/.test(p);
          if (!allowed) return jsonResponse({ error: 'path not in whitelist', allowed: ['public/data/*.json', 'public/uploads/*'] }, 403);
          const existing = await ghGet(p);
          const res = await ghPut(p, body.content, body.message || ('admin: update ' + p), existing && existing.sha);
          if (res.status >= 300) return jsonResponse({ error: 'github', status: res.status, msg: res.json.message }, 502);
          return jsonResponse({ ok: true, commit: res.json.commit && res.json.commit.sha });
        }
        if (path === '/admin/delete-video' && request.method === 'POST') {
          const body = await request.json();
          const slug = body.slug;
          const r2Key = body.r2Key || null;
          if (!slug) return jsonResponse({ error: 'slug required' }, 400);
          if (!env.R2) return jsonResponse({ error: 'R2 not bound' }, 500);
          const keysToDelete = [
            r2Key || ('videos/' + slug + '.mp4'),
            'previews/' + slug + '.mp4',
            'previews/' + slug + '-hover.mp4',
            'thumbs/' + slug + '.jpg',
          ];
          const results = [];
          for (const key of keysToDelete) {
            try { await env.R2.delete(key); results.push({ key, ok: true }); }
            catch(e2) { results.push({ key, ok: false, error: e2.message }); }
          }
          // Remove entry from videos.json in GitHub
          let jsonUpdate = null;
          try {
            const vf = await ghGet('public/data/videos.json');
            if (vf) {
              const arr = JSON.parse(vf.content);
              const filtered = arr.filter(v => v.slug !== slug);
              if (filtered.length < arr.length) {
                const res = await ghPut('public/data/videos.json', JSON.stringify(filtered, null, 2), 'admin: delete video ' + slug, vf.sha);
                jsonUpdate = { ok: res.status < 300, status: res.status };
              } else {
                jsonUpdate = { ok: true, note: 'not in videos.json' };
              }
            }
          } catch(e3) {
            jsonUpdate = { ok: false, error: e3.message };
          }
          return jsonResponse({ ok: true, deleted: results, jsonUpdate });
        }

        // === R2 CLEANUP SCAN ===
        // Lists all R2 objects and compares against videos.json to find orphans
        if (path === '/admin/r2-scan' && request.method === 'GET') {
          if (!env.R2) return jsonResponse({ error: 'R2 not bound' }, 500);

          // 1. Collect all R2 keys
          const r2Objects = [];
          let cursor;
          do {
            const listed = await env.R2.list({ cursor, limit: 1000 });
            for (const obj of listed.objects) {
              r2Objects.push({ key: obj.key, size: obj.size, uploaded: obj.uploaded });
            }
            cursor = listed.truncated ? listed.cursor : undefined;
          } while (cursor);

          // 2. Fetch current videos.json to build set of referenced keys
          const vf = await ghGet('public/data/videos.json');
          const videos = vf ? JSON.parse(vf.content) : [];

          const referencedKeys = new Set();
          for (const v of videos) {
            const slug = v.slug;
            // Main video key — use explicit r2Key, fall back with both .mp4 and .mov
            const mainKey = v.r2Key || ('videos/' + slug + '.mp4');
            referencedKeys.add(mainKey);
            // Derive extension from main key for consistent preview naming
            const ext = mainKey.split('.').pop() || 'mp4';
            // Preview keys — try explicit field first, then both .mp4 AND .<ext> variants
            if (v.r2Preview) {
              referencedKeys.add(v.r2Preview);
            } else {
              referencedKeys.add('previews/' + slug + '.mp4');
              referencedKeys.add('previews/' + slug + '.' + ext);
            }
            // Hover preview — same strategy
            if (v.r2Hover) {
              referencedKeys.add(v.r2Hover);
            } else {
              referencedKeys.add('previews/' + slug + '-hover.mp4');
              referencedKeys.add('previews/' + slug + '-hover.' + ext);
            }
            // Thumbnail — extract from URL and also add slug-based fallback
            if (v.thumbnail) {
              try {
                const u = new URL(v.thumbnail);
                referencedKeys.add(u.pathname.replace(/^\//, ''));
              } catch(e) {}
            }
            referencedKeys.add('thumbs/' + slug + '.jpg');
            referencedKeys.add('thumbs/' + slug + '.png');
            referencedKeys.add('thumbs/' + slug + '.webp');
          }

          // 3. Split into referenced and orphaned
          const orphaned = [];
          const referenced = [];
          for (const obj of r2Objects) {
            if (referencedKeys.has(obj.key)) {
              referenced.push(obj);
            } else {
              orphaned.push(obj);
            }
          }

          const totalOrphanedBytes = orphaned.reduce((s, o) => s + o.size, 0);
          const totalReferencedBytes = referenced.reduce((s, o) => s + o.size, 0);

          return jsonResponse({
            ok: true,
            totalObjects: r2Objects.length,
            referencedCount: referenced.length,
            orphanedCount: orphaned.length,
            orphanedBytes: totalOrphanedBytes,
            referencedBytes: totalReferencedBytes,
            orphaned: orphaned.sort((a, b) => b.size - a.size),
            referenced: referenced.map(o => o.key),
          });
        }

        // === R2 CLEANUP PURGE ===
        // Deletes a list of R2 keys (must be confirmed orphans from r2-scan)
        if (path === '/admin/r2-purge' && request.method === 'POST') {
          if (!env.R2) return jsonResponse({ error: 'R2 not bound' }, 500);
          const body = await request.json();
          const keys = body.keys;
          if (!Array.isArray(keys) || keys.length === 0) {
            return jsonResponse({ error: 'keys array required' }, 400);
          }
          const results = [];
          for (const key of keys) {
            try {
              await env.R2.delete(key);
              results.push({ key, ok: true });
            } catch(e) {
              results.push({ key, ok: false, error: e.message });
            }
          }
          const deletedCount = results.filter(r => r.ok).length;
          return jsonResponse({ ok: true, deletedCount, results });
        }

        // === Resend: Frische Test-Mail an blockierte Adresse ===
        // Erzeugt einen neuen Resend-Eventeintrag, damit der "Remove from suppression list"-Button im Resend-Dashboard erscheint.
        if (path === '/admin/resend-test-send' && request.method === 'POST') {
          const RESEND_API_KEY = (env && env.RESEND_API_KEY) || '';
          if (!RESEND_API_KEY) return jsonResponse({ error: 'no RESEND_API_KEY in env' }, 500);
          const body = await request.json();
          const to = body.to;
          if (!to || typeof to !== 'string') return jsonResponse({ error: 'to required' }, 400);
          const payload = {
            from: FROM_NAME + ' <' + FROM_EMAIL + '>',
            to: [to],
            subject: 'stockvideo.de - Suppression-Test ' + new Date().toISOString(),
            text: 'Diese Mail erzeugt einen frischen Resend-Eventeintrag, um die Adresse aus der Suppression-Liste entfernen zu koennen.'
          };
          const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const txt = await r.text();
          return jsonResponse({ status: r.status, response: txt.slice(0, 500) }, 200);
        }

        // === Resend: Suppression-Liste auslesen ===
        if (path === '/admin/resend-list-suppressions' && request.method === 'GET') {
          const RESEND_API_KEY = (env && env.RESEND_API_KEY) || '';
          if (!RESEND_API_KEY) return jsonResponse({ error: 'no RESEND_API_KEY in env' }, 500);
          const r = await fetch('https://api.resend.com/suppressions', { headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY } });
          const txt = await r.text();
          return jsonResponse({ status: r.status, response: txt.slice(0, 2000) }, 200);
        }

        // === Resend: Suppression-Eintrag entfernen (DELETE /suppressions/{email}) ===
        if (path === '/admin/resend-unsuppress' && request.method === 'POST') {
          const body = await request.json();
          const email = body.email;
          if (!email || typeof email !== 'string') return jsonResponse({ error: 'email required' }, 400);
          const RESEND_API_KEY = (env && env.RESEND_API_KEY) || '';
          if (!RESEND_API_KEY) return jsonResponse({ error: 'no RESEND_API_KEY in env' }, 500);
          const r = await fetch('https://api.resend.com/suppressions/' + encodeURIComponent(email), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY } });
          const txt = await r.text();
          return jsonResponse({ status: r.status, response: txt.slice(0, 500) }, 200);
        }

        return jsonResponse({ error: 'admin endpoint not found' }, 404);
      }

      // === licence/order endpoints ===
      if (path === "/create-order" && request.method === "POST") {
        try {
          const _b = await request.json();
          const _err = _ord_validateBilling(_b.billing);
          if (_err) return jsonResponse({ error: _err }, 400);
          if (!_b.videoId || !_b.videoTitle) return jsonResponse({ error: "video info missing" }, 400);
          if (!env || !env.ORDERS) return jsonResponse({ error: "ORDERS KV not bound" }, 500);
          // Kanonische Video-Daten (inkl. Preis) serverseitig aus videos.json ziehen.
          // Client-Preis ist NICHT vertrauenswuerdig und wird nur als Sanity-Check akzeptiert.
          let _vm = null;
          try { const _vr = await fetch("https://raw.githubusercontent.com/y4wmmzqcjc-dotcom/stockvideo-de/main/public/data/videos.json",{cf:{cacheTtl:60}}); if (_vr.ok) { const _va = await _vr.json(); _vm = _va.find(x=>String(x.id)===String(_b.videoId)) || null; } } catch(e) {}
          if (!_vm) return jsonResponse({ error: "video not found" }, 404);
          if (!_b.videoSlug) _b.videoSlug = _vm.slug || null;
          if (!_b.r2Key) _b.r2Key = _vm.r2Key || null;
          // Lizenz-Tier: web | standard | premium (Default Standard). Ungueltige Werte -> 400.
          const _allowedTiers = ["web","standard","premium"];
          const _tier = _allowedTiers.includes(_b.licenseTier) ? _b.licenseTier : "standard";
          if (_b.licenseTier && !_allowedTiers.includes(_b.licenseTier)) return jsonResponse({ error: "invalid licenseTier" }, 400);
          const _canonPrice = (_vm.prices && typeof _vm.prices[_tier] === "number") ? _vm.prices[_tier] : null;
          if (_canonPrice == null || _canonPrice <= 0) return jsonResponse({ error: "video price missing for tier " + _tier }, 500);
          if (typeof _b.price === "number" && Math.abs(_b.price - _canonPrice) > 0.01) return jsonResponse({ error: "price mismatch", canonical: _canonPrice, tier: _tier }, 400);
          const _usePrice = _canonPrice;
          const _mr = await fetch("https://api.mollie.com/v2/payments", { method: "POST", headers: { "Authorization": "Bearer " + MOLLIE_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ amount: { currency: "EUR", value: _usePrice.toFixed(2) }, description: "stockvideo.de · " + _b.videoTitle, redirectUrl: SITE_URL + "/checkout/success?order=PENDING", webhookUrl: "https://stockvideo-checkout.rende.workers.dev/webhook-order", locale: "de_DE" }) });
          if (!_mr.ok) return jsonResponse({ error: "mollie failed", detail: await _mr.text() }, 502);
          const _payment = await _mr.json();
          const _orderId = _payment.id;
          try { await fetch("https://api.mollie.com/v2/payments/" + _orderId, { method: "PATCH", headers: { "Authorization": "Bearer " + MOLLIE_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ description: "stockvideo.de · " + _b.videoTitle + " · " + _orderId, redirectUrl: SITE_URL + "/checkout/success?order=" + _orderId, metadata: { orderId: _orderId } }) }); } catch(e){}
          const _order = { id: _orderId, createdAt: new Date().toISOString(), status: "pending", video: { id: _b.videoId, title: _b.videoTitle, slug: _b.videoSlug || _b.slug || null, r2Key: _b.r2Key || null }, amount: _usePrice, currency: "EUR", licenseTier: _tier, billing: _b.billing, projectName: (_b.projectName || "").trim() || null, mollie: { paymentId: _payment.id, status: _payment.status } };
          await env.ORDERS.put(_orderId, JSON.stringify(_order), { expirationTtl: 31536000 });
          return jsonResponse({ orderId: _orderId, checkoutUrl: _payment._links.checkout.href });
        } catch (e) { return jsonResponse({ error: String(e && e.message || e) }, 500); }
      }

      // ===== WEBHOOK-ORDER HANDLER (FIXED) =====
      if (path === "/webhook-order" && request.method === "POST") {
        try {
          const _fd = await request.formData();
          const _pid = _fd.get("id");
          if (!_pid || !env || !env.ORDERS) return new Response("ok");

          const WEBHOOK_DEDUPE_KEY = "webhook-" + _pid;
          const _dedupCheck = await env.ORDERS.get(WEBHOOK_DEDUPE_KEY);
          if (_dedupCheck) {
            return new Response("ok");
          }

          const _mr = await fetch("https://api.mollie.com/v2/payments/" + _pid, { headers: { "Authorization": "Bearer " + MOLLIE_API_KEY } });
          if (!_mr.ok) return new Response("ok");
          const _payment = await _mr.json();
          const _orderId = (_payment.metadata && _payment.metadata.orderId) || _pid;
          if (!_orderId) return new Response("ok");
          const _raw = await env.ORDERS.get(_orderId);
          if (!_raw) return new Response("ok");
          let _o = _migrateOrder(JSON.parse(_raw));
          _o.mollie.status = _payment.status;

          if (_payment.status === "paid") {
            if(_o.status !== "paid"){
              _o.status = "paid";
              _o.paidAt = new Date().toISOString();
            }

            const _lockStale = _o.fulfillmentStartedAt && (Date.now() - _o.fulfillmentStartedAt > STALE_LOCK_TIMEOUT);
            const _isPartialFailure = _o.easybillSent === true && _o.emailSent === false;
            const _lockAge = _o.fulfillmentStartedAt ? Date.now() - _o.fulfillmentStartedAt : null;
            const _canRetryPartial = _isPartialFailure && _lockAge && _lockAge < 30000;
            const _canAcquireLock = !_o.fulfillmentStartedAt || _lockStale;

            if (_canAcquireLock || _canRetryPartial) {
              _o.fulfillmentStartedAt = Date.now();
              await env.ORDERS.put(_orderId, JSON.stringify(_o), { expirationTtl: 31536000 });
              _o = await _fulfill_paidOrder(env, _o);
            }
          }
          else if (["failed","expired","canceled"].indexOf(_payment.status) !== -1) {
            _o.status = _payment.status;
          }

          await env.ORDERS.put(_orderId, JSON.stringify(_o), { expirationTtl: 31536000 });
          await env.ORDERS.put(WEBHOOK_DEDUPE_KEY, "1", { expirationTtl: 3600 });
          return new Response("ok");
        } catch (e) { return new Response("ok"); }
      }

      if ((path.indexOf("/video-dl/") === 0 || path.indexOf("/dl/") === 0) && request.method === "GET") {
        const _orderId = decodeURIComponent(path.startsWith("/dl/") ? path.slice(4) : path.slice(10));
        const _u = new URL(request.url);
        const _token = _u.searchParams.get("token");
        if (!(await _ord_verifyToken(_orderId, _token))) return new Response("invalid token", {status:403});
        if (!env || !env.ORDERS) return new Response("kv", {status:500});
        const _raw = await env.ORDERS.get(_orderId);
        if (!_raw) return new Response("not found", {status:404});
        const _o = JSON.parse(_raw);
        if (_o.status !== "paid") return new Response("not paid", {status:402});
        let _slug = _o.video && _o.video.slug;
        let _r2Key = (_o.video && _o.video.r2Key) || (_slug && VIDEO_MAP[_slug]) || null;
        if (!_r2Key) {
          try {
            const _vr = await fetch("https://stockvideo.de/data/videos.json", {cf:{cacheTtl:60}});
            if (_vr.ok) {
              const _arr = await _vr.json();
              const _vid = _o.video && _o.video.id;
              const _m = _arr.find(x => String(x.id) === String(_vid) || x.slug === _slug);
              if (_m) { if (_m.r2Key) _r2Key = _m.r2Key; if (!_slug && _m.slug) _slug = _m.slug; }
            }
          } catch(e){}
        }
        if (!_r2Key && _slug) _r2Key = "videos/" + _slug + ".mp4";
        if (!_r2Key) return new Response("no video key", {status:404});
        const _r2 = await fetch(R2_PUBLIC + "/" + _r2Key);
        if (!_r2.ok) return new Response("r2 fetch failed " + _r2.status, {status:502});
        const _h = new Headers();
        _h.set("Content-Type", "video/mp4");
        _h.set("Content-Disposition", 'attachment; filename="stockvideo-' + (_slug || _orderId) + '.mp4"');
        const _cl = _r2.headers.get("content-length");
        if (_cl) _h.set("Content-Length", _cl);
        _h.set("Access-Control-Allow-Origin", "*");
        _h.set("Cache-Control", "no-store");
        return new Response(_r2.body, { status: 200, headers: _h });
      }

      // ===== ORDER STATUS ENDPOINT (FIXED) =====
      if (path.indexOf("/order/") === 0 && request.method === "GET") {
        if (!env || !env.ORDERS) return jsonResponse({ error: "ORDERS KV not bound" }, 500);
        const _id = decodeURIComponent(path.slice(7));
        const _raw = await env.ORDERS.get(_id);
        if (!_raw) return jsonResponse({ error: "not found" }, 404);
        let _o = _migrateOrder(JSON.parse(_raw));
        if (_o.status !== "paid" && _o.mollie && _o.mollie.paymentId) {
          try {
            const _mr = await fetch("https://api.mollie.com/v2/payments/" + _o.mollie.paymentId, { headers: { "Authorization": "Bearer " + MOLLIE_API_KEY } });
            if (_mr.ok) {
              const _mp = await _mr.json();
              _o.mollie.status = _mp.status;
              if (_mp.status === "paid") {
                _o.status = "paid";
                _o.paidAt = new Date().toISOString();

                const _paidAtMs = new Date(_o.paidAt).getTime();
                const _elapsedMs = Date.now() - _paidAtMs;
                const _lockStale = _o.fulfillmentStartedAt && (Date.now() - _o.fulfillmentStartedAt > STALE_LOCK_TIMEOUT);
                if ((_elapsedMs > 90000) && (!_o.fulfillmentStartedAt || _lockStale)) {
                  _o.fulfillmentStartedAt = Date.now();
                  await env.ORDERS.put(_id, JSON.stringify(_o), { expirationTtl: 31536000 });
                  _o = await _fulfill_paidOrder(env, _o);
                }

                await env.ORDERS.put(_id, JSON.stringify(_o), { expirationTtl: 31536000 });
              }
            }
          } catch(e){}
        }
        return jsonResponse({ id: _o.id, status: _o.status, video: _o.video, amount: _o.amount, currency: _o.currency, paidAt: _o.paidAt || null });
      }

      if (path.indexOf("/download-url/") === 0 && request.method === "GET") {
        const _orderId = decodeURIComponent(path.slice(14));
        const _raw = await env.ORDERS.get(_orderId);
        if (!_raw) return jsonResponse({error:"not found"}, 404);
        const _o = JSON.parse(_raw);
        if (_o.status !== "paid") return jsonResponse({error:"not paid"}, 402);
        const _sig = await _ord_signDownload(_orderId);
        const _slug2 = _o.video && _o.video.slug;
        return jsonResponse({
          videoUrl: WORKER_URL + "/video-dl/" + _orderId + "?token=" + _sig,
          pdfUrl: WORKER_URL + "/pdf/" + _orderId + "?token=" + _sig,
          resendUrl: WORKER_URL + "/resend-email/" + _orderId + "?token=" + _sig,
          orderId: _orderId,
          filename: "stockvideo-" + (_slug2 || _orderId) + ".mp4",
          email: (_o.billing && _o.billing.email) || null,
          emailSent: _o.emailSent || null
        });
      }
      if (path.indexOf("/resend-email/") === 0 && request.method === "GET") {
        const _orderId = decodeURIComponent(path.slice(14));
        const _u = new URL(request.url);
        const _token = _u.searchParams.get("token");
        if (!(await _ord_verifyToken(_orderId, _token))) return jsonResponse({error:"invalid token"}, 403);
        if (!env || !env.ORDERS) return jsonResponse({error:"kv"}, 500);
        const _raw = await env.ORDERS.get(_orderId);
        if (!_raw) return jsonResponse({error:"not found"}, 404);
        const _o = JSON.parse(_raw);
        if (_o.status !== "paid") return jsonResponse({error:"not paid"}, 402);
        const _now = Date.now();
        if (_o.lastResendAt && _now - _o.lastResendAt < 60000) return jsonResponse({error:"Bitte kurz warten und erneut versuchen."}, 429);
        const _newEmail = _u.searchParams.get("email");
        if (_newEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(_newEmail)) { _o.billing.email = _newEmail.trim(); }
        _o.lastResendAt = _now;
        try {
          const _sig2 = await _ord_signDownload(_o.id);
          const _durl = WORKER_URL + "/video-dl/" + _o.id + "?token=" + _sig2;
          const _lurl = WORKER_URL+"/pdf/"+_o.id+"?token="+_sig2;
          const _rs = await _resend_sendDownload(env, _o, _durl, _lurl);
          _o.emailSent = { id: _rs.id||null, at: new Date().toISOString(), to: _o.billing.email };
          await env.ORDERS.put(_orderId, JSON.stringify(_o), { expirationTtl: 31536000 });
          return jsonResponse({ ok:true, to: _o.billing.email });
        } catch(e) {
          return jsonResponse({ error: String(e && e.message || e) }, 502);
        }
      }
      if (path.indexOf("/pdf/") === 0 && request.method === "GET") {
        const _orderId = decodeURIComponent(path.slice(5));
        const _u = new URL(request.url);
        const _token = _u.searchParams.get("token");
        if (!(await _ord_verifyToken(_orderId, _token))) return jsonResponse({error:"invalid token"}, 403);
        const _raw = await env.ORDERS.get(_orderId);
        if (!_raw) return jsonResponse({error:"not found"}, 404);
        const _o = JSON.parse(_raw);
        const _pdf = await _pdf_buildLicense(_o);
        return new Response(_pdf, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"Lizenz_" + _orderId + ".pdf\"", "Access-Control-Allow-Origin": "*" } });
      }
      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, 500);
    }
  },
};

async function createMolliePayment(data) { const res = await fetch('https://api.mollie.com/v2/payments', { method: 'POST', headers: { 'Authorization': 'Bearer ' + MOLLIE_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Mollie error ' + res.status); } return res.json(); }
async function patchMolliePayment(id, data) { const res = await fetch('https://api.mollie.com/v2/payments/' + id, { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + MOLLIE_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Mollie PATCH error ' + res.status); } return res.json(); }
async function getMolliePayment(id) { const res = await fetch('https://api.mollie.com/v2/payments/' + id, { headers: { 'Authorization': 'Bearer ' + MOLLIE_API_KEY } }); if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Mollie GET error ' + res.status); } return res.json(); }
function jsonResponse(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }); }
