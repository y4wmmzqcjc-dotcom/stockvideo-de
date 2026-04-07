export async function onRequest(context){
  const url=new URL(context.request.url);
  const target='https://stockvideo-checkout.rende.workers.dev'+url.pathname+url.search;
  const init={method:context.request.method,headers:new Headers(context.request.headers),body:['GET','HEAD'].includes(context.request.method)?undefined:await context.request.arrayBuffer(),redirect:'manual'};
  init.headers.delete('host');
  const r=await fetch(target,init);
  const h=new Headers(r.headers);
  return new Response(r.body,{status:r.status,headers:h});
}
