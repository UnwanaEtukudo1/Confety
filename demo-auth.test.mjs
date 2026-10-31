import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createDemoAuth} from './demo-auth.js';
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};};
const fixture=()=>{const local=storage(),session=storage();return {local,session,auth:createDemoAuth({local,session,crypto:webcrypto})};};
test('signup, reload, logout and login preserve only a public session profile',async()=>{
  const {auth,local,session}=fixture();
  const user=await auth.register({name:' Demo Guest ',email:' DEMO@example.com ',password:'sample-pass-123'});
  assert.equal(user.name,'Demo Guest');assert.equal(user.email,'demo@example.com');assert.equal(user.hash,undefined);
  assert.equal(JSON.stringify([...local.data.values()]).includes('sample-pass-123'),false);
  assert.deepEqual(createDemoAuth({local,session,crypto:webcrypto}).currentUser(),user);
  auth.logout();assert.equal(auth.currentUser(),null);
  assert.deepEqual(await auth.login({email:'DEMO@EXAMPLE.COM',password:'sample-pass-123'}),user);
  await assert.rejects(auth.login({email:user.email,password:'incorrect'}),/doesn’t match/);
  await assert.rejects(auth.register({name:'Duplicate',email:user.email,password:'sample-pass-123'}),/already uses/);
});
test('invalid inputs, unknown profiles and unavailable storage fail clearly',async()=>{
  const {auth}=fixture();assert.equal(auth.currentUser(),null);
  await assert.rejects(auth.register({name:' ',email:'demo@example.com',password:'sample-pass'}),/Enter a name/);
  await assert.rejects(auth.register({name:'Guest',email:'invalid',password:'sample-pass'}),/valid demo email/);
  await assert.rejects(auth.register({name:'Guest',email:'demo@example.com',password:'short'}),/8 and 128/);
  await assert.rejects(auth.login({email:'missing@example.com',password:'sample-pass'}),/doesn’t match/);
  const broken={getItem(){throw new Error();},setItem(){throw new Error();},removeItem(){throw new Error();}};
  const unavailable=createDemoAuth({local:broken,session:broken,crypto:webcrypto});
  assert.equal(unavailable.currentUser(),null);
  await assert.rejects(unavailable.register({name:'Guest',email:'demo@example.com',password:'sample-pass'}),/could not be read/);
});
