const image = id => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
export const eventProfiles = {
  neon: {type:'experience',tag:'THE AFTER HOURS SERIES',host:'The After Hours Collective',duration:'9 PM – 2 AM',age:'18+ only',highlights:['Resident DJs + special guests','House, afrobeats & feel-good anthems','An intimate dance floor'],occurrences:[{id:'nov14',date:'2026-11-14T21:00',venue:'The Electric Room',city:'Lagos'},{id:'dec12',date:'2026-12-12T21:00',venue:'The Electric Room',city:'Lagos'},{id:'jan09',date:'2027-01-09T21:00',venue:'The Electric Room',city:'Lagos'}],gallery:['photo-1470229722913-7c0e2dbbafd3','photo-1506157786151-b8491531f063','photo-1459749411175-04bf5292ceea'],reviews:[{name:'Tomi A.',text:'The music, the crowd, the energy. Exactly the night out we needed.',rating:5},{name:'Jay M.',text:'A small room with a huge atmosphere. I would come back with friends.',rating:4}]},
  groove: {type:'concert',tag:'ONE STAGE. ALL THE ENERGY.',host:'Good Groove Live',duration:'4 PM – 11 PM',age:'All ages · Under 16s with an adult',highlights:['Live bands and headline sets','Food village and chill-out spaces'],sections:[{id:'floor',name:'Floor',price:45,capacity:600,description:'Standing · Closest to the stage',color:'pink'},{id:'lower',name:'Lower Bowl',price:65,capacity:450,description:'Unreserved seating · Elevated view',color:'purple'},{id:'vip',name:'VIP',price:110,capacity:150,description:'Premium seated zone · Lounge access',color:'lime'}]},
  sunset: {type:'experience',tag:'THE GOLDEN HOUR TOUR',host:'Sunset Sessions',duration:'5 PM – 10 PM',age:'18+ only',highlights:['Live acoustic sets + sunset DJs','Open-air views','A different city. The same good energy.'],occurrences:[{id:'cape',date:'2026-11-28T17:00',venue:'The Rooftop',city:'Cape Town'},{id:'accra',date:'2026-12-05T17:00',venue:'Skyline Terrace',city:'Accra'},{id:'lagos',date:'2026-12-19T17:00',venue:'The Upper Deck',city:'Lagos'}],gallery:['photo-1506157786151-b8491531f063','photo-1470229722913-7c0e2dbbafd3','photo-1511632765486-a01980e01a18'],reviews:[{name:'Ada R.',text:'Golden skies, beautiful music, and a lovely crowd. Such a good combination.',rating:5},{name:'Sam K.',text:'The rooftop setting was a highlight. Arrive early for the sunset.',rating:4}]},
  table: {type:'experience',host:'The Shared Table',duration:'1 PM – 4 PM',age:'All ages',highlights:['A shared seasonal menu','Communal tables','Meet someone new'],gallery:['photo-1414235077428-338989a2e8c0']},
  canvas: {type:'experience',host:'Studio 24',duration:'6 PM – 10 PM',age:'All ages',highlights:['Contemporary art','Meet fellow creatives','Music throughout the evening'],gallery:['photo-1579783902614-a3fb3927b6a5']},
  people: {type:'experience',host:'The Common Ground',duration:'11 AM – 2 PM',age:'All ages',highlights:['Relaxed introductions','Creative conversations','A welcoming community'],gallery:['photo-1511632765486-a01980e01a18']}
};
export function getProfile(event){
  const configured=eventProfiles[event.id]||{};
  const type=event.pageType||configured.type||'experience';
  const profile={type,tag:'MAKE A MEMORY',host:'Independent organizer',duration:'Starts at the listed time',age:'Contact the organizer for age restrictions',highlights:[],gallery:[],reviews:[],...configured,type};
  profile.occurrences=configured.occurrences||[{id:'default',date:event.date,venue:event.venue,city:event.city}];
  if(type==='concert'){
    const floor=Math.floor(event.capacity*.6),lower=Math.floor(event.capacity*.3);
    profile.sections=configured.sections||[{id:'floor',name:'Floor',price:event.price,capacity:floor,description:'Standing · Near the stage',color:'pink'},{id:'lower',name:'Lower Bowl',price:Math.round(event.price*1.4*100)/100,capacity:lower,description:'Unreserved seating · Elevated view',color:'purple'},{id:'vip',name:'VIP',price:Math.round(event.price*2*100)/100,capacity:event.capacity-floor-lower,description:'Premium section',color:'lime'}];
  }else profile.sections=[{id:'general',name:'General admission',price:event.price,capacity:event.capacity,description:'Admission for your selected date',color:'pink'}];
  return profile;
}
export function ticketAvailability(event,profile,orders,occurrenceId,sectionId){
  const occurrence=profile.occurrences.find(o=>o.id===occurrenceId),section=profile.sections.find(s=>s.id===sectionId);
  if(!occurrence||!section)return 0;
  const sameDate=orders.filter(o=>o.eventId===event.id&&(o.occurrenceId||profile.occurrences[0].id)===occurrenceId);
  const dateSold=sameDate.reduce((sum,o)=>sum+o.quantity,0);
  const sectionSold=sameDate.filter(o=>o.sectionId===sectionId||(!o.sectionId&&sectionId===profile.sections[0].id)).reduce((sum,o)=>sum+o.quantity,0);
  return Math.max(0,Math.min(event.capacity-dateSold,section.capacity-sectionSold));
}
export function galleryImages(profile){return profile.gallery.map(image);}
