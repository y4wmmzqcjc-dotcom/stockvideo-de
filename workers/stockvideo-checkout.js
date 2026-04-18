const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password', };
const MOLLIE_API_KEY = 'test_A7njP8NN7AHtBVdxUPF96ccCErfQdS';
const SITE_URL = 'https://stockvideo.de';
const WORKER_URL = 'https://stockvideo-checkout.rende.workers.dev';
const R2_PUBLIC = 'https://pub-03757a2d41d2442dabdeaa0a62f5d1ad.r2.dev';
const EASYBILL_API_KEY = 'REDACTED-OLD-EASYBILL-KEY';
const RESEND_API_KEY = 'REDACTED-OLD-RESEND-KEY';
const FROM_EMAIL = 'info@stockvideo.de';
const FROM_NAME = 'stockvideo.de';
const VIDEO_MAP = {"braune-kuh-auf-der-weide-4k-stock-video":"videos/kuhbraun.mp4"};

// === S6 FIX: Stale Lock Timeout ===
const STALE_LOCK_TIMEOUT = 600000;  // 10 Minuten - Balance zwischen Crash-Recovery und echtem Retry blockieren

function downloadUrlFor(slug, r2Key) { const key = r2Key || VIDEO_MAP[slug]; if (!key) return null; return R2_PUBLIC + '/' + key; }
// === stockvideo-checkout licence/order extension ===
const DOWNLOAD_SECRET = "df3d17b4df83444312e65136f8a219adde6346787737259584c98d8e328a1126";
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
async function _ord_verifyToken(orderId, token){ if(!token)return false; const parts=token.split("."); if(parts.length!==2)return false; const exp=parseInt(parts[0],10); if(!exp||Date.now()/1000>exp)return false; const expected=await _ord_hmac(DOWNLOAD_SECRET, orderId+"."+exp); return expected===parts[1]; }
function _b64_fromStr(s){let r="";for(let i=0;i<s.length;i++)r+=String.fromCharCode(s.charCodeAt(i)&0xff);return btoa(r);}
function _html_escape(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);}
function _country_iso(c){const m={"Deutschland":"DE","Germany":"DE","Österreich":"AT","Austria":"AT","Schweiz":"CH","Switzerland":"CH"};if(!c)return"DE";if(c.length===2)return c.toUpperCase();return m[c]||"DE";}
async function _eb_createCustomerAndInvoice(order){
  const b=order.billing||{};
  const cust={company_name:b.company||"",first_name:b.firstName||"",last_name:b.lastName||"",street:b.street||"",zip_code:b.zip||"",city:b.city||"",country:_country_iso(b.country),emails:[b.email],vat_identifier:b.vatId||""};
  const cr=await fetch("https://api.easybill.de/rest/v1/customers",{method:"POST",headers:{"Authorization":"Bearer "+EASYBILL_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(cust)});
  if(!cr.ok)throw new Error("easybill customer "+cr.status+": "+(await cr.text()).slice(0,300));
  const cj=await cr.json();
  const title=(order.video&&order.video.title)||"Video-Lizenz";
  const gross=Number(order.amount)||0;
  const net=+(gross*100/1.19).toFixed(2);
  const desc="Royalty-Free Lizenz: "+title+(order.projectName?" (Projekt: "+order.projectName+")":"")+" | Order: "+order.id;
  const doc={type:"INVOICE",pdf_template:"422215",customer_id:cj.id,is_draft:true,text_prefix:"",title:"Rechnung Video-Lizenz | Order: "+order.id,items:[{number:String((order.video&&order.video.id)||""),description:desc,quantity:1,single_price_net:net,vat_percent:19}],text:"Vielen Dank f\u00fcr Ihren Einkauf bei stockvideo.de.",file_format_config:[{type:"default"},{type:"zugferd2_4_en16931"}]};
  const dr=await fetch("https://api.easybill.de/rest/v1/documents",{method:"POST",headers:{"Authorization":"Bearer "+EASYBILL_API_KEY,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(doc)});
  if(!dr.ok)throw new Error("easybill doc "+dr.status+": "+(await dr.text()).slice(0,300));
  const dj=await dr.json();
  return {customerId:cj.id,documentId:dj.id,number:dj.number||null};
}
async function _resend_sendDownload(order,downloadUrl,licenseUrl){
  const b=order.billing||{};
  const title=(order.video&&order.video.title)||"";
  const name=[b.firstName,b.lastName].filter(Boolean).join(" ")||"Kunde";
  const html='<div style="font-family:\'Source Sans 3\',Arial,Helvetica,sans-serif;color:#e1e1e1;background:#1b1b1b;max-width:600px;margin:0 auto;padding:32px 28px;line-height:1.55">'
    +'<div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:24px">stockvideo<span style="color:#2563eb">.de</span></div>'
    +'<p style="color:#e1e1e1">Hallo '+_html_escape(name)+',</p>'
    +'<p style="color:#e1e1e1">vielen Dank für Ihren Einkauf auf stockvideo.de.</p>'
    +'<p style="color:#e1e1e1"><strong style="color:#fff">Video:</strong> '+_html_escape(title)+'<br><strong style="color:#fff">Bestellnummer:</strong> '+_html_escape(order.id)+'</p>'
    +'<p style="margin:28px 0 12px"><a href="'+downloadUrl+'" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">Video herunterladen</a></p>'
    +'<p style="margin:0 0 24px"><a href="'+licenseUrl+'" style="display:inline-block;background:transparent;color:#2563eb;padding:10px 0;text-decoration:none;font-weight:600">📄 Lizenzurkunde (PDF) herunterladen</a></p>'
    +'<p style="color:#9a9a9a;font-size:14px">Der Video-Download-Link ist 7 Tage gültig. Die Lizenzurkunde steht Ihnen dauerhaft unter obigem Link zur Verfügung.</p>'
    +'<p style="color:#9a9a9a;font-size:14px">Ihre Rechnung erhalten Sie in den kommenden Tagen per E-Mail.</p>'
    +'<hr style="border:none;border-top:1px solid #333;margin:28px 0">'
    +'<p style="color:#666;font-size:12px">stockvideo.de · Lizenzfreie Stock-Videos in 4K &amp; HD</p>'
    +'</div>';
  const body={from:FROM_NAME+" <"+FROM_EMAIL+">",to:[b.email],bcc:["info@stockvideo.de","rende@imagefilme.com"],subject:"Ihr Download von stockvideo.de",html:html};
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
async function _fulfill_paidOrder(order){
  if (!order.easybillSent) {
    try{
      const inv=await _eb_createCustomerAndInvoice(order);
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
      const rs=await _resend_sendDownload(order,durl,lurl);
      order.emailSent={id:rs.id||null,at:new Date().toISOString(),to:order.billing.email};
    }catch(e){
      order.emailError=String(e.message||e);
      order.emailSent=false;
    }
  }

  return order;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === '/create-payment' && request.method === 'POST') {
        const body = await request.json();
        const { videoId, videoTitle, price, slug, r2Key } = body;
        if (!videoId || !price || !slug) return jsonResponse({ error: 'Missing required fields' }, 400);
        const payment = await createMolliePayment({
          amount: { currency: 'EUR', value: parseFloat(price).toFixed(2) },
          description: 'stockvideo.de — ' + (videoTitle || 'Stock Video'),
          redirectUrl: SITE_URL + '/checkout/success/?slug=' + encodeURIComponent(slug),
          cancelUrl: SITE_URL + '/video/' + slug + '/',
          webhookUrl: url.origin + '/webhook',
          metadata: { videoId: String(videoId), slug, videoTitle: videoTitle || '', r2Key: r2Key || VIDEO_MAP[slug] || '' },
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
        const ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
        const GH_TOKEN = env.GH_TOKEN || '';
        const GH_REPO = 'y4wmmzqcjc-dotcom/stockvideo-de';
        const GH_BRANCH = 'main';
        const sha256hex = async (s) => { const b = new TextEncoder().encode(s); const h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''); };
        const getPw = async (req) => { let pw = req.headers.get('X-Admin-Password'); if (!pw) { try { const b = await req.clone().json(); pw = b && b.password; } catch(e){} } return pw; };
        const verify = async (req) => { const pw = await getPw(req); if (!pw) return false; return (await sha256hex(pw)) === ADMIN_HASH; };
        const ghHeaders = { 'Authorization': 'token ' + GH_TOKEN, 'User-Agent': 'stockvideo-worker', 'Accept': 'application/vnd.github.v3+json' };
        const ghGet = async (p) => { const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + p + '?ref=' + GH_BRANCH, { headers: ghHeaders }); if (!r.ok) return null; const j = await r.json(); return { sha: j.sha, content: atob(j.content.replace(/\n/g,'')) }; };
        const ghPut = async (p, content, msg, sha) => { const body = { message: msg, content: btoa(unescape(encodeURIComponent(content))), branch: GH_BRANCH }; if (sha) body.sha = sha; const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + p, { method: 'PUT', headers: { ...ghHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); return { status: r.status, json: j }; };
        if (path === '/admin/verify' && request.method === 'POST') { const ok = await verify(request); return jsonResponse({ ok: ok }, ok ? 200 : 401); }
        if (!(await verify(request))) { return jsonResponse({ error: 'unauthorized' }, 401); }
        if (path === '/admin/r2-stats' && request.method === 'GET') { if (!env.R2) return jsonResponse({ error: 'R2 not bound' }, 500); let total = 0, count = 0, cursor; do { const listed = await env.R2.list({ cursor, limit: 1000 }); for (const obj of listed.objects) { total += obj.size; count++; } cursor = listed.truncated ? listed.cursor : undefined; } while (cursor); return jsonResponse({ totalBytes: total, objectCount: count }); }
        if (path === '/admin/last-commit' && request.method === 'GET') { const r = await fetch('https://api.github.com/repos/' + GH_REPO + '/commits/' + GH_BRANCH, { headers: ghHeaders }); if (!r.ok) return jsonResponse({ error: 'github', status: r.status }, 502); const j = await r.json(); return jsonResponse({ sha: j.sha ? j.sha.slice(0,7) : null, date: j.commit && j.commit.author ? j.commit.author.date : null, message: j.commit && j.commit.message ? j.commit.message.split('\n')[0] : null }); }
        if (path === '/admin/data' && request.method === 'GET') { const kind = url.searchParams.get('kind'); if (kind !== 'videos' && kind !== 'categories') return jsonResponse({ error: 'bad kind' }, 400); const f = await ghGet('public/data/' + kind + '.json'); if (!f) return jsonResponse({ items: [], sha: null }); let arr = []; try { arr = JSON.parse(f.content); } catch(e){} return jsonResponse({ items: arr, sha: f.sha }); }
        if (path === '/admin/data' && request.method === 'POST') { const body = await request.json(); const kind = body.kind; if (kind !== 'videos' && kind !== 'categories') return jsonResponse({ error: 'bad kind' }, 400); if (!Array.isArray(body.items)) return jsonResponse({ error: 'items must be array' }, 400); const p = 'public/data/' + kind + '.json'; const existing = await ghGet(p); const content = JSON.stringify(body.items, null, 2); const res = await ghPut(p, content, 'admin: update ' + kind + '.json (' + body.items.length + ' items)', existing && existing.sha); if (res.status >= 300) return jsonResponse({ error: 'github', status: res.status, msg: res.json.message }, 502); return jsonResponse({ ok: true, commit: res.json.commit && res.json.commit.sha }); }
        if (path === '/admin/commit' && request.method === 'POST') { const body = await request.json(); if (!body.path || typeof body.content !== 'string') return jsonResponse({ error: 'path+content required' }, 400); const existing = await ghGet(body.path); const res = await ghPut(body.path, body.content, body.message || ('admin: update ' + body.path), existing && existing.sha); if (res.status >= 300) return jsonResponse({ error: 'github', status: res.status, msg: res.json.message }, 502); return jsonResponse({ ok: true, commit: res.json.commit && res.json.commit.sha }); }
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

        return jsonResponse({ error: 'admin endpoint not found' }, 404);
      }

      // === licence/order endpoints ===
      if (path === "/create-order" && request.method === "POST") {
        try {
          const _b = await request.json();
          const _err = _ord_validateBilling(_b.billing);
          if (_err) return jsonResponse({ error: _err }, 400);
          if (!_b.videoId || !_b.videoTitle || typeof _b.price !== "number" || _b.price <= 0) return jsonResponse({ error: "video info missing" }, 400);
          if (!env || !env.ORDERS) return jsonResponse({ error: "ORDERS KV not bound" }, 500);
          try { if (!_b.videoSlug || !_b.r2Key) { const _vr = await fetch("https://raw.githubusercontent.com/y4wmmzqcjc-dotcom/stockvideo-de/main/public/data/videos.json",{cf:{cacheTtl:60}}); if (_vr.ok) { const _va = await _vr.json(); const _vm = _va.find(x=>String(x.id)===String(_b.videoId)); if (_vm) { if (!_b.videoSlug) _b.videoSlug = _vm.slug || null; if (!_b.r2Key) _b.r2Key = _vm.r2Key || null; } } } } catch(e) {}
          const _mr = await fetch("https://api.mollie.com/v2/payments", { method: "POST", headers: { "Authorization": "Bearer " + MOLLIE_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ amount: { currency: "EUR", value: _b.price.toFixed(2) }, description: "stockvideo.de · " + _b.videoTitle, redirectUrl: SITE_URL + "/checkout/success?order=PENDING", webhookUrl: "https://stockvideo-checkout.rende.workers.dev/webhook-order", locale: "de_DE" }) });
          if (!_mr.ok) return jsonResponse({ error: "mollie failed", detail: await _mr.text() }, 502);
          const _payment = await _mr.json();
          const _orderId = _payment.id;
          try { await fetch("https://api.mollie.com/v2/payments/" + _orderId, { method: "PATCH", headers: { "Authorization": "Bearer " + MOLLIE_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ description: "stockvideo.de · " + _b.videoTitle + " · " + _orderId, redirectUrl: SITE_URL + "/checkout/success?order=" + _orderId, metadata: { orderId: _orderId } }) }); } catch(e){}
          const _order = { id: _orderId, createdAt: new Date().toISOString(), status: "pending", video: { id: _b.videoId, title: _b.videoTitle, slug: _b.videoSlug || _b.slug || null, r2Key: _b.r2Key || null }, amount: _b.price, currency: "EUR", billing: _b.billing, projectName: (_b.projectName || "").trim() || null, mollie: { paymentId: _payment.id, status: _payment.status } };
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
              _o = await _fulfill_paidOrder(_o);
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
                  _o = await _fulfill_paidOrder(_o);
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
          const _rs = await _resend_sendDownload(_o, _durl, _lurl);
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
