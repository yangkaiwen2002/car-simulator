import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8','.car':'text/plain; charset=utf-8'};
export function createServer(){return http.createServer(async(req,res)=>{
 try{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end('Method not allowed');}
  const url=new URL(req.url,'http://localhost');const pathname=decodeURIComponent(url.pathname);
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!target.startsWith(root+path.sep)||pathname.includes('\0')){res.writeHead(403);return res.end('Forbidden');}
  const data=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
 }catch(error){res.writeHead(error.code==='ENOENT'||error.code==='EISDIR'?404:400,{'Content-Type':'text/plain; charset=utf-8'});res.end('Resource unavailable');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4173);createServer().listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`OpenRoad: http://localhost:${port}`));}
