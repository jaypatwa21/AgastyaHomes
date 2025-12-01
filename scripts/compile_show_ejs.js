const fs = require('fs');
const ejs = require('ejs');
const path = require('path');

const file = path.join(__dirname, '..', 'views', 'listings', 'show.ejs');
const src = fs.readFileSync(file, 'utf8');

const data = {
  listing: {
    title: 'Test Listing',
    image: { url: '/uploads/test.jpg' },
    owner: { username: 'owner', _id: 'ownerid' },
    description: 'desc',
    price: 1000,
    location: 'Delhi',
    country: 'India',
    _id: 'abc123',
    reviews: [ { author: { username: 'a' }, rating: 5, comment: 'good', _id: 'r1' } ]
  },
  currentUser: null,
  lat: 28.6,
  lng: 77.2
};

try {
  const fn = ejs.compile(src, { filename: file });
  const out = fn(data);
  console.log('Rendered length:', out.length);
} catch (err) {
  console.error('EJS compile error:');
  console.error(err);
}
