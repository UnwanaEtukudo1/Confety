export const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Enugu'];
export const categories = [
  { name: 'Music', kinds: ['Concert', 'Festival'], genres: ['Afrobeats', 'Highlife', 'Hip-hop', 'Jazz'], titles: ['Afterglow Live', 'Groove Assembly', 'Soundroom Sessions'] },
  { name: 'Nightlife', kinds: ['Club night', 'DJ set'], genres: ['Amapiano', 'House', 'Afrobeats'], titles: ['Night Shift', 'Neon Hours', 'Late Checkout'] },
  { name: 'Food & drink', kinds: ['Tasting', 'Food market'], genres: ['Local cuisine', 'Street food', 'Fine dining'], titles: ['The Shared Table', 'Market Bites', 'Supper Society'] },
  { name: 'Arts & culture', kinds: ['Exhibition', 'Screening'], genres: ['Contemporary art', 'Film', 'Spoken word'], titles: ['Open Canvas', 'Frame by Frame', 'Art After Dark'] },
  { name: 'Community', kinds: ['Meetup', 'Workshop'], genres: ['Networking', 'Creative skills', 'Wellness'], titles: ['Good Company', 'The Workshop Club', 'Sunday Social'] },
  { name: 'Sports', kinds: ['Tournament', 'Fun run'], genres: ['Football', 'Running', 'Fitness'], titles: ['City League', 'Move Together', 'Weekend Circuit'] },
];

const organizerNames = ['After Hours Collective', 'Good Groove Live', 'The Shared Table', 'Open Canvas Studio', 'Common Ground', 'City Circuit', 'Palm House Events', 'Daybreak Productions', 'Studio Twenty Four', 'The Weekend Club'];
const genders = ['Woman', 'Man', 'Nonbinary', 'Self-described'];
const channels = ['Social media', 'Direct', 'Search', 'Organizer referral', 'Email'];
const paymentMethods = ['Card', 'Bank transfer', 'USSD', 'Mobile wallet'];
const refundReasons = ['Schedule conflict', 'Event changed', 'Travel or transport', 'Duplicate purchase'];
const resaleReasons = ['Change of plans', 'Travel or transport', 'Extra ticket', 'Unable to attend'];

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createDemoData() {
  const random = randomGenerator(370291);
  const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = values => values[integer(0, values.length - 1)];
  const date = (year, month, day, hour, minute = 0) => new Date(Date.UTC(year, month, day, hour - 1, minute));
  const day = 86_400_000;
  const hour = 3_600_000;

  const customers = Array.from({ length: 3300 }, (_, index) => ({
    id: index + 1,
    gender: pick(genders),
  }));
  const organizers = organizerNames.map((name, index) => ({
    id: index + 1,
    name,
    base: cities[index % cities.length],
  }));
  const events = [];
  const orders = [];
  const tickets = [];
  const customerSurveys = [];
  const organizerSurveys = [];
  const supportCases = [];

  for (let year = 2024; year <= 2026; year++) {
    const monthCount = year === 2026 ? 10 : 12;
    for (let month = 0; month < monthCount; month++) {
      const seasonalBoost = [1, 0, 1, 1, 2, 1, 1, 2, 0, 2, 3, 5][month];
      const eventCount = 4 + (year - 2024) + seasonalBoost;
      for (let index = 0; index < eventCount; index++) {
        const growth = year - 2024;
        const category = pick([
          ...categories, categories[0], categories[1],
          ...Array(growth).fill(categories[0]), ...Array(growth).fill(categories[5]),
        ]);
        const organizer = pick(organizers);
        const city = random() < 0.68 ? organizer.base : pick(cities);
        const start = date(year, month, integer(4, 27), integer(15, 21));
        const publishHours = integer(4, 168);
        const publishedAt = new Date(start.getTime() - integer(24, 48) * day);
        const event = {
          id: events.length + 1,
          title: pick(category.titles),
          city,
          organizerId: organizer.id,
          category: category.name,
          kind: pick(category.kinds),
          genre: pick(category.genres),
          start: start.toISOString(),
          publishedAt: publishedAt.toISOString(),
          createdAt: new Date(publishedAt.getTime() - publishHours * hour).toISOString(),
          capacity: integer(175, 350),
          channelViews: Object.fromEntries(channels.map(channel => [channel, integer(75, 340)])),
          failedPayments: integer(3, 15),
          abandonedCheckouts: integer(13, 40),
          costs: [
            { category: 'Venue', amount: integer(80, 260) * 1000, method: 'Bank transfer' },
            { category: 'Production', amount: integer(45, 200) * 1000, method: pick(['Bank transfer', 'Card']) },
            { category: 'Marketing', amount: integer(20, 95) * 1000, method: pick(['Card', 'Mobile wallet']) },
            { category: 'Staff and logistics', amount: integer(30, 125) * 1000, method: pick(['Bank transfer', 'Mobile wallet']) },
          ],
        };
        events.push(event);
        const firstTicket = tickets.length;
        const buyerIds = new Set();
        const checkedIn = new Set();
        const orderCount = integer(38, 79) + growth * 4;
        for (let count = 0; count < orderCount; count++) {
          const buyer = pick(customers);
          buyerIds.add(buyer.id);
          const bookingDate = new Date(start.getTime() - integer(1, 21) * day);
          const bookingHour = random() < .52 ? integer(17, 21) : integer(7, 22);
          bookingDate.setUTCHours(bookingHour, integer(0, 59), 0, 0);
          const tier = pick(['General', 'General', 'General', 'Early bird', 'VIP']);
          const unitPrice = (tier === 'VIP' ? 23500 : tier === 'Early bird' ? 6500 : 10000) + integer(0, 5) * 1000;
          const quantity = pick([1, 1, 1, 2, 2, 3]);
          const discounted = random() < 0.18;
          const order = {
            id: orders.length + 1, eventId: event.id, buyerId: buyer.id,
            boughtAt: bookingDate.toISOString(), channel: pick(channels),
            paymentMethod: pick(paymentMethods), discounted,
          };
          orders.push(order);

          for (let seat = 0; seat < quantity; seat++) {
            const gross = unitPrice - (discounted ? Math.round(unitPrice * .10) : 0);
            const fee = Math.round(gross * .05);
            const refund = random() < 0.055 ? { reason: pick(refundReasons), amount: gross + fee } : null;
            const resale = !refund && random() < 0.082 ? {
              reason: pick(resaleReasons),
              buyerId: random() < .74 ? pick(customers.filter(customer => customer.id !== buyer.id)).id : null,
              price: Math.round(gross * .9),
            } : null;
            let attendeeId = null;
            let checkIn = null;
            if (!refund && random() < .83) {
              attendeeId = seat === 0 ? (resale?.buyerId ?? buyer.id) : pick(customers).id;
              while (checkedIn.has(attendeeId)) attendeeId = pick(customers).id;
              checkedIn.add(attendeeId);
              const arrivalMinutes = pick([integer(-105, -61), integer(-60, -31), integer(-30, -1), integer(-30, -1), integer(0, 55)]);
              checkIn = new Date(start.getTime() + arrivalMinutes * 60_000).toISOString();
            }
            tickets.push({ orderId: order.id, eventId: event.id, tier, gross, fee, refund, resale, attendeeId, checkIn });
          }
        }
        event.capacity = Math.max(event.capacity, tickets.length - firstTicket);
        for (const customerId of buyerIds) {
          if (random() < .28) customerSurveys.push({
            eventId: event.id, customerId, score: pick([2, 3, 4, 4, 5, 5, 5]),
            theme: pick(['Event experience', 'Venue access', 'Checkout', 'Queue times', 'Communication']),
          });
        }
        if (random() < .77) organizerSurveys.push({
          eventId: event.id, organizerId: organizer.id, score: pick([3, 4, 4, 5, 5]),
          theme: pick(['Event setup', 'Sales reporting', 'Customer support', 'Check-in tools']),
        });
        const caseCount = integer(2, 6);
        for (let count = 0; count < caseCount; count++) {
          const role = pick(['Customer', 'Organizer']);
          supportCases.push({
            eventId: event.id, role,
            theme: pick(role === 'Customer' ? ['Ticket access', 'Payment', 'Refunds'] : ['Event setup', 'Reporting', 'Check-in']),
            resolutionHours: random() < .13 ? null : integer(1, 55),
          });
        }
      }
    }
  }
  return { customers, organizers, events, orders, tickets, customerSurveys, organizerSurveys, supportCases };
}
