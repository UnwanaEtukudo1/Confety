import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const files = {'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js','/demo-auth.js':'demo-auth.js'};
const types = {html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
const server = http.createServer(async(req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname;
  const file=files[path];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{const body=await readFile(fileURLToPath(new URL(file,root)));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);}
  catch{res.writeHead(500);res.end('Unable to load page');}
});
const port=Number(process.env.PORT||4173);
server.listen(port,'127.0.0.1',()=>console.log(`Confety preview: http://127.0.0.1:${port}`));
