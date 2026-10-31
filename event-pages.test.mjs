import test from 'node:test';
import assert from 'node:assert/strict';
import {getProfile,ticketAvailability} from './event-pages.js';
const event={id:'groove',date:'2026-11-21T16:00',venue:'Park',city:'London',price:45,capacity:1200};
test('concert section price and inventory remain independent',()=>{
  const profile=getProfile(event),orders=[{eventId:'groove',occurrenceId:'default',sectionId:'vip',quantity:150}];
  assert.equal(profile.sections.find(s=>s.id==='vip').price,110);
  assert.equal(ticketAvailability(event,profile,orders,'default','vip'),0);
  assert.equal(ticketAvailability(event,profile,orders,'default','floor'),600);
  assert.equal(ticketAvailability(event,profile,orders,'missing','floor'),0);
});
test('tour dates have independent capacity and legacy orders count on the first date',()=>{
  const tour={...event,id:'sunset',capacity:200,price:30},profile=getProfile(tour);
  const orders=[{eventId:'sunset',quantity:200}];
  assert.equal(ticketAvailability(tour,profile,orders,'cape','general'),0);
  assert.equal(ticketAvailability(tour,profile,orders,'accra','general'),200);
});
test('custom concerts allocate exactly the requested capacity, including small venues',()=>{
  for(const capacity of [1,2,7,101]){
    const custom={...event,id:'custom',capacity,pageType:'concert'},profile=getProfile(custom);
    assert.equal(profile.sections.reduce((sum,s)=>sum+s.capacity,0),capacity);
    assert.equal(profile.sections[0].price,45);
  }
});
