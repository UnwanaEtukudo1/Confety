// Local demo ledger only. Production resale needs server ownership and payment verification.
export const emptyMarket = () => ({listings:[],sales:[]});
const requireUser = user => {if(!user?.id)throw new Error('Log in to a demo profile to continue.');};
const validQuantity = value => Number.isInteger(value)&&value>0;
export function ticketSources(market,orders,user){
  if(!user)return [];
  return [
    ...orders.filter(o=>o.ownerId===user.id).map(o=>({id:o.id,eventId:o.eventId,quantity:o.quantity,unitPriceCents:Math.round(o.total/o.quantity*100),kind:'Original purchase'})),
    ...market.sales.filter(s=>s.buyerId===user.id).map(s=>({id:s.id,eventId:s.eventId,quantity:s.quantity,unitPriceCents:s.unitPriceCents,kind:'Resale purchase'}))
  ].map(source=>{
    const listings=market.listings.filter(l=>l.sourceId===source.id&&l.sellerId===user.id);
    const transferred=market.sales.filter(s=>listings.some(l=>l.id===s.listingId)).reduce((sum,s)=>sum+s.quantity,0);
    const listed=listings.filter(l=>l.status==='active').reduce((sum,l)=>sum+l.remaining,0);
    return {...source,transferred,listed,owned:source.quantity-transferred,available:Math.max(0,source.quantity-transferred-listed)};
  });
}
function futureEvent(events,eventId,now){const event=events.find(e=>e.id===eventId);if(!event||!Number.isFinite(new Date(event.date).getTime())||new Date(event.date).getTime()<=now)throw new Error('This event is unavailable or has already started.');return event;}
export function createListing(market,orders,events,user,{sourceId,quantity,unitPriceCents},id,now=Date.now()){
  requireUser(user);
  const source=ticketSources(market,orders,user).find(s=>s.id===sourceId);
  if(!source)throw new Error('Choose tickets purchased by your signed-in demo profile.');
  futureEvent(events,source.eventId,now);
  if(!validQuantity(quantity)||quantity>source.available)throw new Error('That quantity is no longer available to list.');
  if(!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0||unitPriceCents>10000000)throw new Error('Enter a price between $0 and $100,000 per ticket.');
  const listing={id,sellerId:user.id,sellerName:user.name.split(' ')[0],sourceId,eventId:source.eventId,quantity,remaining:quantity,unitPriceCents,status:'active',createdAt:new Date(now).toISOString()};
  return {market:{...market,listings:[...market.listings,listing]},listing};
}
export function withdrawListing(market,user,listingId){
  requireUser(user);const listing=market.listings.find(l=>l.id===listingId);
  if(!listing||listing.sellerId!==user.id)throw new Error('Only the seller can withdraw this listing.');
  if(listing.status!=='active')throw new Error('This listing is no longer active.');
  return {...market,listings:market.listings.map(l=>l.id===listingId?{...l,status:'withdrawn'}:l)};
}
export function buyListing(market,orders,events,user,{listingId,quantity},id,now=Date.now()){
  requireUser(user);const listing=market.listings.find(l=>l.id===listingId);
  if(!listing||listing.status!=='active')throw new Error('This listing is no longer available.');
  if(listing.sellerId===user.id)throw new Error('You can’t buy your own listing.');
  futureEvent(events,listing.eventId,now);
  if(!validQuantity(quantity)||quantity>listing.remaining)throw new Error('That quantity is no longer available.');
  const sellerSource=ticketSources(market,orders,{id:listing.sellerId}).find(s=>s.id===listing.sourceId);
  if(!sellerSource||sellerSource.owned<sellerSource.listed)throw new Error('These demo tickets are no longer available from this seller.');
  const remaining=listing.remaining-quantity;
  const sale={id,listingId,sellerId:listing.sellerId,buyerId:user.id,eventId:listing.eventId,quantity,unitPriceCents:listing.unitPriceCents,totalCents:quantity*listing.unitPriceCents,createdAt:new Date(now).toISOString()};
  return {market:{...market,listings:market.listings.map(l=>l.id===listingId?{...l,remaining,status:remaining?'active':'sold'}:l),sales:[...market.sales,sale]},sale};
}
