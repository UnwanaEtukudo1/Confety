import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const files = {'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js','/admin':'admin/workspace.html','/admin/':'admin/workspace.html','/admin/history':'admin/historical.html','/admin/vendor/jsqr.js':'node_modules/jsqr/dist/jsQR.js','/admin/vendor/qrcode.js':'node_modules/qrcode-generator/qrcode.js'};
const types = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8'};
const server = http.createServer(async(req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname;
  const file=Object.hasOwn(files,path) ? files[path] : /^\/admin\/[a-z][a-z-]*\.(mjs|css)$/.test(path) ? path.slice(1) : null;
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{const body=await readFile(fileURLToPath(new URL(file,root)));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);}
  catch{res.writeHead(500);res.end('Unable to load page');}
});
const port=Number(process.env.PORT||4173);
server.listen(port,'127.0.0.1',()=>console.log(`Confety preview: http://127.0.0.1:${port}`));
