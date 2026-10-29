const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;
const sampleEvents = [
  {id:'neon',title:'After Hours: Neon Nights',category:'Nightlife',date:'2026-11-14T21:00',venue:'The Electric Room',city:'Lagos',price:25,capacity:300,image:photo('photo-1470229722913-7c0e2dbbafd3'),description:'Step out of the ordinary and into the neon. A night of house, afrobeats, and feel-good anthems with a dance floor full of your kind of people.\n\nDoors open at 9 PM. This is a fictional event for exploring the Confety prototype.'},
  {id:'groove',title:'The Good Groove Festival',category:'Music',date:'2026-11-21T16:00',venue:'Riverside Park',city:'London',price:45,capacity:1200,image:photo('photo-1459749411175-04bf5292ceea'),description:'An open-air celebration of the music that moves us. Discover live acts, DJs, great food, and the best people. A fictional Confety demo event.'},
  {id:'table',title:'A Seat at the Table',category:'Food & drink',date:'2026-11-08T13:00',venue:'The Greenhouse',city:'Lagos',price:35,capacity:60,image:photo('photo-1414235077428-338989a2e8c0'),description:'Good food. Long conversations. New connections. Join a communal dining experience celebrating seasonal flavors and the joy of sharing. A fictional Confety demo event.'},
  {id:'canvas',title:'Off the Wall: Art After Dark',category:'Arts & culture',date:'2026-11-13T18:00',venue:'Studio 24',city:'Accra',price:15,capacity:150,image:photo('photo-1579783902614-a3fb3927b6a5'),description:'A gallery night with a different kind of energy. Explore contemporary art, meet fellow creatives, and stay for the soundtrack. A fictional Confety demo event.'},
  {id:'sunset',title:'Sunset Sessions',category:'Music',date:'2026-11-28T17:00',venue:'The Rooftop',city:'Cape Town',price:30,capacity:200,image:photo('photo-1506157786151-b8491531f063'),description:'Golden hour meets a golden lineup. Ease into the evening with live music and a sunset you will want to remember. A fictional Confety demo event.'},
  {id:'people',title:'Good People, Great Ideas',category:'Community',date:'2026-11-15T11:00',venue:'The Common Ground',city:'Lagos',price:0,capacity:80,image:photo('photo-1511632765486-a01980e01a18'),description:'Bring your curiosity and meet your next collaborator, friend, or inspiration. A relaxed community gathering for people making things happen. A fictional Confety demo event.'}
];
let storageAvailable = true;
let saved;
try { saved = JSON.parse(localStorage.getItem('confety-prototype-v1') || 'null'); } catch { saved = null; }
let state = {
  events: Array.isArray(saved?.events) ? saved.events.filter(e => e && typeof e.id === 'string' && typeof e.title === 'string' && Number.isFinite(e.price) && Number.isFinite(e.capacity) && !Number.isNaN(Date.parse(e.date))) : [],
  orders: Array.isArray(saved?.orders) ? saved.orders.filter(o => o && typeof o.eventId === 'string' && Number.isInteger(o.quantity) && o.quantity > 0 && Number.isFinite(o.total)) : [],
  favorites: Array.isArray(saved?.favorites) ? saved.favorites.filter(id => typeof id === 'string') : [],
  paused: Array.isArray(saved?.paused) ? saved.paused.filter(id => typeof id === 'string') : []
};
let category = 'All', view = 'discover', workspace = 'events', toastTimer;
const allEvents = () => [...sampleEvents, ...state.events];
const money = value => value === 0 ? 'Free' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
const dateLabel = date => new Date(date).toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short'});
const timeLabel = date => new Date(date).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const sold = id => state.orders.filter(o => o.eventId === id).reduce((sum,o) => sum + o.quantity,0);
const remaining = event => Math.max(0,event.capacity - sold(event.id));
function persist(){try{localStorage.setItem('confety-prototype-v1',JSON.stringify(state));}catch{storageAvailable=false; if(!$('.storage-warning')){const warning=document.createElement('div');warning.className='storage-warning';warning.textContent='Browser storage is unavailable. Changes will last only until this page is closed.';document.body.prepend(warning);}}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function cover(event, className=''){return event.image ? `<img class="${className}" src="${escapeHtml(event.image)}" alt="${escapeHtml(event.title)}" loading="lazy">` : `<div class="custom-cover ${className}" aria-hidden="true">✳</div>`;}
function renderEvents(){
  const query=$('#event-search').value.trim().toLowerCase();
  let events=allEvents().filter(e=>!state.paused.includes(e.id) && (category==='All'||e.category===category) && `${e.title} ${e.venue} ${e.city} ${e.category}`.toLowerCase().includes(query));
  const sort=$('#event-sort').value;
  if(sort==='date')events.sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(sort==='price')events.sort((a,b)=>a.price-b.price);
  $('#result-count').textContent=`${events.length} experience${events.length===1?'':'s'} to look forward to`;
  $('#empty-events').hidden=events.length>0;
  $('#event-grid').innerHTML=events.map(event=>`<article class="event-card"><div class="card-cover" data-event="${escapeHtml(event.id)}">${cover(event)}<span class="card-category">${escapeHtml(event.category)}</span></div><button class="save-button ${state.favorites.includes(event.id)?'saved':''}" data-save="${escapeHtml(event.id)}" aria-label="${state.favorites.includes(event.id)?'Unsave':'Save'} ${escapeHtml(event.title)}" aria-pressed="${state.favorites.includes(event.id)}">${state.favorites.includes(event.id)?'♥':'♡'}</button><div class="card-content"><p class="card-date">${dateLabel(event.date)} · ${timeLabel(event.date)}</p><button class="card-title" data-event="${escapeHtml(event.id)}">${escapeHtml(event.title)}</button><p class="card-location">↗ ${escapeHtml(event.venue)} · ${escapeHtml(event.city)}</p><div class="card-bottom"><span class="card-price">${event.price?'<small>from</small>':''}${money(event.price)}</span><button class="card-link" data-event="${escapeHtml(event.id)}">${remaining(event)?'Get tickets ↗':'Sold out'}</button></div></div></article>`).join('');
}
function showView(next){view=next;$('#discover-view').hidden=next!=='discover';$('#dashboard-view').hidden=next!=='dashboard';$$('.site-header .nav-link').forEach(button=>button.classList.toggle('active',button.dataset.view===next));if(next==='dashboard')renderWorkspace();else renderEvents();window.scrollTo({top:0,behavior:'instant'});}
function openDialog(id){const dialog=$(id);dialog.showModal();dialog.scrollTop=0;}
function showEvent(id){
  const event=allEvents().find(e=>e.id===id);if(!event)return;
  const available=remaining(event),paused=state.paused.includes(id);
  $('#event-detail').innerHTML=`${event.image?cover(event,'detail-image'):'<div class="custom-cover detail-image">✳</div>'}<div class="detail-content"><div class="eyebrow pink-text">${escapeHtml(event.category)} · DEMO EVENT</div><h2>${escapeHtml(event.title)}</h2><div class="detail-info"><p><small>WHEN</small>${dateLabel(event.date)}, ${new Date(event.date).getFullYear()}<br>${timeLabel(event.date)} · Venue local time</p><p><small>WHERE</small>${escapeHtml(event.venue)}<br>${escapeHtml(event.city)}</p></div><p class="detail-description">${escapeHtml(event.description)}</p><div class="detail-footer"><div><small>${available} of ${event.capacity} tickets available</small><b>${money(event.price)}</b></div><button class="button lime" data-checkout="${escapeHtml(event.id)}" ${!available||paused?'disabled':''}>${paused?'Sales paused':available?'Get tickets ↗':'Sold out'}</button></div></div>`;
  openDialog('#event-dialog');
}
function checkout(id){
  const event=allEvents().find(e=>e.id===id);if(!event||state.paused.includes(id)||remaining(event)<1)return;
  $('#event-dialog').close();
  const max=Math.min(10,remaining(event));
  $('#checkout-content').innerHTML=`<div class="dialog-heading"><div class="eyebrow pink-text">YOU + GOOD TIMES = YES.</div><h2>Save your spot.</h2><p>Simulated checkout · No card required. No charge.</p></div><div class="checkout-summary"><h3>${escapeHtml(event.title)}</h3><p>${dateLabel(event.date)} · ${timeLabel(event.date)}<br>${escapeHtml(event.venue)}, ${escapeHtml(event.city)}</p></div><form id="checkout-form"><input type="hidden" name="eventId" value="${escapeHtml(event.id)}"><label>Your name<input name="name" autocomplete="name" required maxlength="80" placeholder="Name on your tickets"></label><label>Email address<input name="email" type="email" autocomplete="email" required maxlength="150" placeholder="you@example.com"></label><label>Tickets<select name="quantity" id="checkout-quantity">${Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1} ticket${i?'s':''} · ${money(event.price*(i+1))}</option>`).join('')}</select></label><div class="checkout-total"><span>Demo total</span><span id="checkout-total">${money(event.price)}</span></div><p class="form-note">Prices use USD for demonstration. Your demo order stays in this browser. No email or valid admission ticket will be issued.</p><button type="submit" class="button lime full">Confirm demo order ↗</button></form>`;
  $('#checkout-quantity').addEventListener('change',e=>$('#checkout-total').textContent=money(event.price*Number(e.target.value)));
  $('#checkout-form').addEventListener('submit',submitOrder);
  openDialog('#checkout-dialog');
}
function submitOrder(event){
  event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
  const data=new FormData(form),item=allEvents().find(e=>e.id===data.get('eventId')),quantity=Number(data.get('quantity'));
  if(!item||!Number.isInteger(quantity)||quantity<1||quantity>10||quantity>remaining(item)||state.paused.includes(item.id)){toast('These tickets are no longer available. Please try again.');$('#checkout-dialog').close();return;}
  const order={id:`CF-${crypto.randomUUID().slice(0,8).toUpperCase()}`,eventId:item.id,name:String(data.get('name')).trim(),email:String(data.get('email')).trim(),quantity,total:Math.round(item.price*quantity*100)/100,createdAt:new Date().toISOString()};
  if(!order.name){form.elements.name.setCustomValidity('Please enter your name.');form.elements.name.reportValidity();form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''),{once:true});return;}
  state.orders.push(order);persist();renderEvents();renderWorkspace();
  $('#checkout-content').innerHTML=`<div class="confirmation"><div class="success-mark">✓</div><div class="eyebrow pink-text">THAT’S A PLAN.</div><h2>You’re on the list.</h2><p>${escapeHtml(order.name)}, your demo order for <strong>${escapeHtml(item.title)}</strong> is saved.<br>${quantity} ticket${quantity>1?'s':''} · ${money(order.total)}</p><p class="ticket-reference">${order.id}</p><p class="form-note">Demo only. This reference is not valid for admission. No email has been sent. Find this order in your organizer workspace.</p><button class="button lime full" id="view-order-button">View demo orders ↗</button></div>`;
  $('#view-order-button').addEventListener('click',()=>{$('#checkout-dialog').close();workspace='orders';showView('dashboard');});
}
function renderWorkspace(){
  const revenue=state.orders.reduce((sum,o)=>sum+o.total,0), tickets=state.orders.reduce((sum,o)=>sum+o.quantity,0);
  $('#stats').innerHTML=[['Your events',state.events.length],['Demo tickets booked',tickets],['Demo revenue',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(revenue)],['Saved experiences',state.favorites.length]].map(([label,value])=>`<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('');
  $$('[data-workspace]').forEach(button=>button.classList.toggle('selected',button.dataset.workspace===workspace));
  if(workspace==='events'){
    $('#workspace-content').innerHTML=state.events.length?state.events.map(event=>`<article class="workspace-event">${cover(event)}<div><h3>${escapeHtml(event.title)}</h3><p>${dateLabel(event.date)} · ${escapeHtml(event.city)}<br>${sold(event.id)} / ${event.capacity} tickets booked · ${state.paused.includes(event.id)?'Sales paused':'Live in demo discovery'}</p></div><div class="workspace-actions"><button class="outline-button" data-event="${escapeHtml(event.id)}">View event ↗</button><button class="outline-button" data-pause="${escapeHtml(event.id)}">${state.paused.includes(event.id)?'Resume sales':'Pause sales'}</button></div></article>`).join(''):`<div class="empty-state"><h3>Your next big thing starts here.</h3><p style="margin:12px 0 24px">Create your first event to manage it in this workspace.</p><button class="button lime" data-create>＋ Create an event</button></div>`;
  }else{
    $('#workspace-content').innerHTML=state.orders.length?`<p class="form-note">${state.orders.length} demo order${state.orders.length===1?'':'s'} · Includes bookings for curated demo events. No actual payments.</p><button class="outline-button" id="export-orders">Download orders CSV ↓</button><div style="height:18px"></div>`+[...state.orders].reverse().map(order=>`<article class="order-row"><div><h3>${escapeHtml(allEvents().find(e=>e.id===order.eventId)?.title||'Event')}</h3><p>${escapeHtml(order.name)} · ${escapeHtml(order.email)}<br>${order.quantity} ticket${order.quantity>1?'s':''} · ${escapeHtml(order.id)}</p></div><b>${money(order.total)} · DEMO</b></article>`).join(''):`<div class="empty-state"><h3>No orders. Yet.</h3><p style="margin:12px 0 24px">Try the simulated checkout on any event to see orders here.</p><button class="button lime" data-view="discover">Explore events ↗</button></div>`;
    $('#export-orders')?.addEventListener('click',exportOrders);
  }
}
function exportOrders(){
  const cell=value=>{let text=String(value);if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const rows=[['Reference','Event','Name','Email','Tickets','Demo total (USD)'],...state.orders.map(o=>[o.id,allEvents().find(e=>e.id===o.eventId)?.title||'Event',o.name,o.email,o.quantity,o.total])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download='confety-demo-orders.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a,[data-event]');if(!target)return;
  if(target.matches('[data-view]')){event.preventDefault();showView(target.dataset.view);}
  if(target.matches('.logo')){event.preventDefault();showView('discover');}
  if(target.matches('[data-category]')){category=target.dataset.category;$$('[data-category]').forEach(b=>b.classList.toggle('selected',b===target));renderEvents();}
  if(target.matches('[data-event]'))showEvent(target.dataset.event);
  if(target.matches('[data-checkout]'))checkout(target.dataset.checkout);
  if(target.matches('[data-create]')){const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());$('#create-form').elements.date.min=now.toISOString().slice(0,16);openDialog('#create-dialog');}
  if(target.matches('.close-dialog'))target.closest('dialog').close();
  if(target.matches('[data-save]')){const id=target.dataset.save;state.favorites=state.favorites.includes(id)?state.favorites.filter(i=>i!==id):[...state.favorites,id];persist();renderEvents();toast(state.favorites.includes(id)?'Saved for a good time.':'Removed from saved experiences.');}
  if(target.matches('[data-workspace]')){workspace=target.dataset.workspace;renderWorkspace();}
  if(target.matches('[data-pause]')){const id=target.dataset.pause;state.paused=state.paused.includes(id)?state.paused.filter(i=>i!==id):[...state.paused,id];persist();renderWorkspace();renderEvents();toast(state.paused.includes(id)?'Ticket sales paused. Event hidden from discovery.':'Your event is back in discovery.');}
});
$('#event-search').addEventListener('input',renderEvents);$('#event-sort').addEventListener('change',renderEvents);
$('#create-form').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const data=new FormData(form),fields=['title','venue','city','description'];
  for(const field of fields){if(!String(data.get(field)).trim()){form.elements[field].setCustomValidity('Please enter a value.');form.elements[field].reportValidity();form.elements[field].addEventListener('input',()=>form.elements[field].setCustomValidity(''),{once:true});return;}}
  if(new Date(data.get('date'))<=new Date()){form.elements.date.setCustomValidity('Choose a date in the future.');form.elements.date.reportValidity();form.elements.date.addEventListener('input',()=>form.elements.date.setCustomValidity(''),{once:true});return;}
  state.events.push({id:crypto.randomUUID(),...Object.fromEntries(fields.map(f=>[f,String(data.get(f)).trim()])),category:String(data.get('category')),date:String(data.get('date')),price:Number(data.get('price')),capacity:Number(data.get('capacity'))});
  persist();form.reset();$('#create-dialog').close();workspace='events';showView('dashboard');toast('Your event is live in the local prototype. Let’s make memories.');
});
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}}));
renderEvents();
