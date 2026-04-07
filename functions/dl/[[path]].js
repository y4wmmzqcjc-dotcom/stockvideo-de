export async function onRequest(context){
  const { request, env, params } = context;
  if(request.method!=='GET' && request.method!=='HEAD') return new Response('Method Not Allowed',{status:405});
  if(!env.R2) return new Response('R2 binding missing',{status:500});
  const parts = Array.isArray(params.path)?params.path:[params.path];
  const key = parts.join('/');
  if(!/^(videos|thumbs|previews)\/[A-Za-z0-9._\/-]{1,250}$/.test(key)) return new Response('Invalid key',{status:400});
  const obj = await env.R2.get(key);
  if(!obj) return new Response('Not Found',{status:404});
  const url = new URL(request.url);
  const filename = url.searchParams.get('name') || key.split('/').pop();
  const safe = filename.replace(/[^A-Za-z0-9._-]/g,'_');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Content-Disposition','attachment; filename="'+safe+'"');
  headers.set('Cache-Control','public, max-age=3600');
  headers.set('Access-Control-Allow-Origin','*');
  return new Response(obj.body,{headers});
}
