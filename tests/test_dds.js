import { search } from 'duck-duck-scrape';

async function test() {
    try {
        const results = await search('site:instagram.com "LORONG TEMU COFFEE & EATERY"');
        console.log(JSON.stringify(results.results.slice(0, 3), null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
