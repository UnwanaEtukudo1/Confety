import {emptyMarket,ticketSources,createListing,buyListing,withdrawListing} from './resale.js';
const KEY='confety-resale-v1',LOCK='confety-resale-ledger';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
export function initResale({getUser,getEvents,money,dateLabel,timeLabel,cover,escapeHtml:esc,showView,showAuth,toast}){
  let sellerTab='tickets',pendingLogin=null,query='',sort='newest';
  function read(){
    const value=JSON.parse(localStorage.getItem(KEY)||'null')||emptyMarket();
    if(!Array.isArray(value.listings)||!Array.isArray(value.sales))throw new Error('The demo marketplace could not be loaded.');
    return value;
  }
  function orders(){const stored=JSON.parse(localStorage.getItem('confety-prototype-v1')||'null');return Array.isArray(stored?.orders)?stored.orders:[];}
  function events(){const stored=JSON.parse(localStorage.getItem('confety-prototype-v1')||'null'),merged=new Map(getEvents().map(event=>[event.id,event]));if(Array.isArray(stored?.events))stored.events.forEach(event=>{if(event&&typeof event.id==='string'&&Number.isFinite(event.capacity))merged.set(event.id,event);});return [...merged.values()];}
  const eventFor=id=>events().find(e=>e.id===id);
  const isFuture=event=>event&&new Date(event.date).getTime()>Date.now();
  function needLogin(action){if(getUser())return false;pendingLogin=action;showAuth('login');toast('Log in to continue with demo ticket resale.');return true;}
  function refresh(){if(!$('#marketplace-view').hidden)renderMarket();if(!$('#sell-view').hidden)renderSeller();}
  async function transact(operation){
    if(!navigator.locks)throw new Error('This browser cannot safely update the shared demo ledger. Use a browser with Web Locks support.');
    return navigator.locks.request(LOCK,()=>{
      const user=getUser();if(!user)throw new Error('Log in again to continue.');
      const result=operation(read(),orders(),user);
      try{localStorage.setItem(KEY,JSON.stringify(result.market));}catch{throw new Error('Your changes could not be saved. Allow browser storage or free up space and try again.');}
      return result;
    });
  }
  function modal(title,body){$('#resale-dialog-content').innerHTML=`<div class="dialog-heading"><div class="eyebrow pink-text">PASS ON THE GOOD TIMES</div><h2>${title}</h2></div>${body}`;$('#resale-dialog').showModal();$('#resale-dialog').scrollTop=0;}
  function inlineError(error){$('#resale-error').textContent=error.message||'Unable to save. Check browser storage and try again.';$('#resale-error').hidden=false;}
  function renderMarket(){
    let market;try{market=read();}catch{$('#resale-grid').innerHTML='<p class="empty-state">The marketplace could not be loaded. Allow browser storage and reload.</p>';return;}
    let listings=market.listings.filter(l=>l.status==='active'&&l.remaining>0&&isFuture(eventFor(l.eventId)));
    listings=listings.filter(l=>{const event=eventFor(l.eventId);return `${event.title} ${event.city} ${event.category}`.toLowerCase().includes(query.toLowerCase());});
    listings.sort(sort==='price'?(a,b)=>a.unitPriceCents-b.unitPriceCents:(a,b)=>b.createdAt.localeCompare(a.createdAt));
    $('#resale-count').textContent=`${listings.length} listing${listings.length===1?'':'s'} · All prices are demo USD`;
    $('#resale-grid').innerHTML=listings.length?listings.map(l=>{const event=eventFor(l.eventId),own=l.sellerId===getUser()?.id;return `<article class="event-card resale-card"><div class="card-cover">${cover(event)}<span class="card-category">RESALE · DEMO</span></div><div class="card-content"><p class="card-date">${dateLabel(event.date)} · ${timeLabel(event.date)}</p><h3>${esc(event.title)}</h3><p class="card-location">${esc(event.venue)} · ${esc(event.city)}</p><div class="resale-seller"><span class="seller-avatar">${esc(l.sellerName.slice(0,1).toUpperCase())}</span><span>${own?'Listed by you':'Demo seller · '+esc(l.sellerName)}</span><b>${l.remaining} left</b></div><div class="card-bottom"><span class="card-price">${money(l.unitPriceCents/100)}<small> / ticket</small></span><button class="card-link" ${own?'data-view="sell"':`data-resale-buy="${esc(l.id)}"`}>${own?'Manage listing ↗':'View tickets ↗'}</button></div></div></article>`;}).join(''):`<div class="resale-empty"><span>↗</span><h3>${query?'No matches this time.':'Good tickets deserve another chance.'}</h3><p>${query?'Try another event name or city.':'No active listings yet. Buy demo event tickets while signed in, then list the ones you can’t use.'}</p><button class="button lime" data-view="sell">Sell your tickets ↗</button></div>`;
  }
  function renderSeller(){
    const user=getUser();
    if(!user){$('#seller-content').innerHTML=`<div class="seller-gate"><span>✳</span><h2>Your tickets.<br>Someone else’s <em>great night.</em></h2><p>Log in to a demo profile to list tickets you own and track your sales.</p><button class="button lime" data-resale-login>Log in to sell ↗</button></div>`;return;}
    let market,sources;try{market=read();sources=ticketSources(market,orders(),user);}catch{$('#seller-content').innerHTML='<p class="empty-state">Allow browser storage to load your demo tickets.</p>';return;}
    const listings=market.listings.filter(l=>l.sellerId===user.id),sales=market.sales.filter(s=>s.sellerId===user.id),purchases=market.sales.filter(s=>s.buyerId===user.id);
    const available=sources.filter(s=>isFuture(eventFor(s.eventId))).reduce((sum,s)=>sum+s.available,0),proceeds=sales.reduce((sum,s)=>sum+s.totalCents,0);
    $('#seller-content').innerHTML=`<div class="stats resale-stats">${[['Available to list',available],['Active listings',listings.filter(l=>l.status==='active'&&isFuture(eventFor(l.eventId))).length],['Demo tickets sold',sales.reduce((sum,s)=>sum+s.quantity,0)],['Demo proceeds',proceeds?money(proceeds/100):'$0.00']].map(([label,value])=>`<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('')}</div><div class="seller-toolbar"><div class="workspace-tabs">${[['tickets','My tickets'],['listings','My listings'],['purchases','Resale purchases']].map(([id,label])=>`<button data-seller-tab="${id}" class="${sellerTab===id?'selected':''}">${label}</button>`).join('')}</div><button class="button lime small" data-resale-list ${available?'':'disabled'}>＋ Create a listing</button></div><div id="seller-items"></div><p class="resale-ledger-note">Only purchases made while signed in belong to a demo profile. Older guest orders cannot be claimed by matching an email. All demo profiles and transactions are shared within this browser; no real tickets or money are transferred.</p>`;
    const target=$('#seller-items');
    if(sellerTab==='tickets')target.innerHTML=sources.filter(s=>s.owned>0).length?sources.filter(s=>s.owned>0).map(source=>{const event=eventFor(source.eventId);if(!event)return '';return `<article class="owned-ticket">${cover(event)}<div class="owned-ticket-info"><span class="card-date">${dateLabel(event.date)} · ${esc(source.kind)}</span><h3>${esc(event.title)}</h3><p>${esc(event.venue)} · ${esc(event.city)}</p><small>${source.owned} owned · ${source.listed} listed · ${source.available} available to list</small></div><button class="outline-button" data-list-source="${esc(source.id)}" ${source.available&&isFuture(event)?'':'disabled'}>${isFuture(event)?'Sell tickets ↗':'Event started'}</button></article>`;}).join(''):`<div class="resale-empty"><h3>Your ticket collection starts here.</h3><p>Book an event while signed in to this demo profile. Your tickets will appear here, ready to keep or list.</p><button class="button lime" data-view="discover">Discover events ↗</button></div>`;
    if(sellerTab==='listings')target.innerHTML=listings.length?[...listings].reverse().map(l=>{const event=eventFor(l.eventId),expired=!isFuture(event),status=expired&&l.status==='active'?'Event started':l.status;return `<article class="listing-row"><div><span class="listing-status ${l.status}">${esc(status)}</span><h3>${esc(event?.title||'Unavailable event')}</h3><p>${l.remaining} unsold of ${l.quantity} listed · ${money(l.unitPriceCents/100)} per ticket</p><small>${esc(l.id)}</small></div>${l.status==='active'?`<button class="outline-button" data-resale-withdraw="${esc(l.id)}">Withdraw ${l.remaining} ticket${l.remaining===1?'':'s'}</button>`:'<span class="listing-complete">'+(l.status==='sold'?'Good times passed on ✓':'Unsold tickets returned ✓')+'</span>'}</article>`;}).join(''):'<div class="resale-empty"><h3>No listings yet.</h3><p>Select tickets from My tickets to create your first demo listing.</p></div>';
    if(sellerTab==='purchases')target.innerHTML=purchases.length?[...purchases].reverse().map(s=>`<article class="listing-row"><div><span class="listing-status sold">DEMO PURCHASE</span><h3>${esc(eventFor(s.eventId)?.title||'Unavailable event')}</h3><p>${s.quantity} ticket${s.quantity===1?'':'s'} · ${money(s.totalCents/100)} total</p><small>${esc(s.id)} · ${new Date(s.createdAt).toLocaleDateString()}</small></div><span class="listing-complete">Added to My tickets ✓</span></article>`).join(''):'<div class="resale-empty"><h3>Your next second chance is out there.</h3><p>Browse listings from other demo customers.</p><button class="button lime" data-view="marketplace">Explore resale ↗</button></div>';
  }
  function openList(sourceId){
    if(needLogin(()=>{showView('sell');openList(sourceId);}))return;
    let sources;try{sources=ticketSources(read(),orders(),getUser()).filter(s=>s.available>0&&isFuture(eventFor(s.eventId)));}catch(error){toast(error.message);return;}
    if(!sources.length){toast('Buy demo event tickets while signed in before creating a listing.');return;}
    const chosen=sources.find(s=>s.id===sourceId)||sources[0];
    modal('Make someone’s night.',`<p class="resale-dialog-intro">List tickets you can’t use. Every listing is a local demo.</p><form id="resale-list-form"><label>Your tickets<select name="sourceId" id="resale-source">${sources.map(s=>`<option value="${esc(s.id)}" ${s.id===chosen.id?'selected':''}>${esc(eventFor(s.eventId).title)} · ${s.available} available · ${esc(s.id.slice(-8))}</option>`).join('')}</select></label><div class="form-row"><label>Quantity<input type="number" name="quantity" min="1" step="1" value="1" required></label><label>Price per ticket (demo USD)<input name="price" type="number" min="0" max="100000" step="0.01" required></label></div><div class="resale-price-summary"><span>Your demo listing total</span><b id="listing-total"></b></div><p class="form-note">No listing fees in this demo. Listed tickets are reserved until sold or withdrawn. No real payment, payout, or admission ticket is created.</p><p id="resale-error" class="auth-error" role="alert" hidden></p><button type="submit" class="button lime full">Publish demo listing ↗</button></form>`);
    const form=$('#resale-list-form');
    function sync(reset){const source=sources.find(s=>s.id===form.elements.sourceId.value);form.elements.quantity.max=source.available;if(reset){form.elements.quantity.value=1;form.elements.price.value=(source.unitPriceCents/100).toFixed(2);}$('#listing-total').textContent=money(Number(form.elements.quantity.value)*Number(form.elements.price.value));}
    sync(true);$('#resale-source').addEventListener('change',()=>sync(true));form.addEventListener('input',()=>sync(false));
    form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const submit=form.querySelector('[type=submit]');submit.disabled=true;try{await transact((market,orders,user)=>createListing(market,orders,events(),user,{sourceId:form.elements.sourceId.value,quantity:Number(form.elements.quantity.value),unitPriceCents:Math.round(Number(form.elements.price.value)*100)},'RL-'+crypto.randomUUID().slice(0,8).toUpperCase()));$('#resale-dialog').close();sellerTab='listings';showView('sell');toast('Your demo listing is live in the resale marketplace.');}catch(error){inlineError(error);submit.disabled=false;}});
  }
  function openBuy(id){
    if(needLogin(()=>{showView('marketplace');openBuy(id);}))return;
    let listing;try{listing=read().listings.find(l=>l.id===id);}catch(error){toast(error.message);return;}
    if(!listing||listing.status!=='active'||!isFuture(eventFor(listing.eventId))){toast('This listing is no longer available.');refresh();return;}
    if(listing.sellerId===getUser().id){toast('You can’t buy your own listing.');return;}
    const event=eventFor(listing.eventId);
    modal('A second chance to be there.',`<div class="checkout-summary"><h3>${esc(event.title)}</h3><p>${dateLabel(event.date)} · ${timeLabel(event.date)}<br>${esc(event.venue)}, ${esc(event.city)}<br>Demo seller · ${esc(listing.sellerName)}</p></div><form id="resale-buy-form"><p class="resale-dialog-intro">Buying as <strong>${esc(getUser().name)}</strong>. Tickets will be added to this demo profile.</p><label>Ticket quantity<input type="number" name="quantity" min="1" max="${listing.remaining}" step="1" value="1" required></label><div class="resale-price-breakdown"><span>Per ticket</span><span>${money(listing.unitPriceCents/100)}</span><span>Demo fees</span><span>$0.00</span></div><div class="checkout-total"><span>Demo total</span><span id="resale-buy-total">${money(listing.unitPriceCents/100)}</span></div><p class="form-note">This simulates an ownership transfer between local demo profiles. No money is charged, no seller payout occurs, and these tickets are not valid for admission.</p><p id="resale-error" class="auth-error" role="alert" hidden></p><button type="submit" class="button lime full">Confirm demo purchase ↗</button></form>`);
    const form=$('#resale-buy-form');form.elements.quantity.addEventListener('input',()=>$('#resale-buy-total').textContent=money(Number(form.elements.quantity.value)*listing.unitPriceCents/100));
    form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const submit=form.querySelector('[type=submit]');submit.disabled=true;try{const {sale}=await transact((market,orders,user)=>buyListing(market,orders,events(),user,{listingId:id,quantity:Number(form.elements.quantity.value)},'RS-'+crypto.randomUUID().slice(0,8).toUpperCase()));$('#resale-dialog-content').innerHTML=`<div class="confirmation"><div class="success-mark">✓</div><div class="eyebrow pink-text">GOOD TIMES, PASSED ON.</div><h2>You’ve got plans.</h2><p>${sale.quantity} demo ticket${sale.quantity===1?'':'s'} for <strong>${esc(event.title)}</strong> now ${sale.quantity===1?'belongs':'belong'} to your profile.<br>${money(sale.totalCents/100)} demo total · No charge</p><p class="ticket-reference">${esc(sale.id)}</p><p class="form-note">Demo only. No real payment or valid admission ticket.</p><button class="button lime full" data-resale-receipt>View my tickets ↗</button></div>`;refresh();}catch(error){inlineError(error);submit.disabled=false;}});
  }
  function openWithdraw(id){
    let listing;try{listing=read().listings.find(l=>l.id===id);}catch(error){toast(error.message);return;}
    if(!listing||listing.sellerId!==getUser()?.id||listing.status!=='active'){toast('This listing cannot be withdrawn.');return;}
    modal('Keep these good times.',`<p class="resale-dialog-intro">Withdraw ${listing.remaining} unsold ticket${listing.remaining===1?'':'s'} for <strong>${esc(eventFor(listing.eventId)?.title||'this event')}</strong>? They’ll return to your available tickets. Completed sales stay with their buyers.</p><p id="resale-error" class="auth-error" role="alert" hidden></p><button class="button lime full" id="confirm-withdraw">Withdraw demo listing ↗</button>`);
    $('#confirm-withdraw').addEventListener('click',async e=>{e.target.disabled=true;try{await transact((market,orders,user)=>({market:withdrawListing(market,user,id)}));$('#resale-dialog').close();refresh();toast('Listing withdrawn. Unsold tickets are available again.');}catch(error){inlineError(error);e.target.disabled=false;}});
  }
  document.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
    if(button.matches('[data-resale-scroll]'))$('#resale-listings').scrollIntoView({behavior:'smooth'});
    if(button.matches('[data-resale-list]'))openList();
    if(button.matches('[data-list-source]'))openList(button.dataset.listSource);
    if(button.matches('[data-resale-buy]'))openBuy(button.dataset.resaleBuy);
    if(button.matches('[data-resale-withdraw]'))openWithdraw(button.dataset.resaleWithdraw);
    if(button.matches('[data-seller-tab]')){sellerTab=button.dataset.sellerTab;renderSeller();}
    if(button.matches('[data-resale-login]'))needLogin(()=>showView('sell'));
    if(button.matches('[data-resale-receipt]')){$('#resale-dialog').close();sellerTab='tickets';showView('sell');}
  });
  $('#resale-search').addEventListener('input',e=>{query=e.target.value;renderMarket();});
  $('#resale-sort').addEventListener('change',e=>{sort=e.target.value;renderMarket();});
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='confety-prototype-v1')refresh();});
  return {renderMarket,renderSeller,resumeAfterLogin(){const action=pendingLogin;pendingLogin=null;if(action){action();return true;}return false;}};
}
