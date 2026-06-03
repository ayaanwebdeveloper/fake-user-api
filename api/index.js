const http = require('http');
const { faker } = require('@faker-js/faker');

const server = http.createServer((req, res) => {
    const path = req.url;
res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (path === '/api/data') {
        const limit =  500; 
        const users = [];
        for (let i = 1; i <= limit; i++) {
            users.push({
                id: i,
                firstName: faker.person.firstName(),
                lastName: faker.person.lastName(),
                email: faker.internet.email(),
                phone: faker.phone.number(),
                age: faker.number.int({ min: 18, max: 60 }),
                jobTitle: faker.person.jobTitle(),
                city: faker.location.city(),
                isActive: faker.datatype.boolean()
            });
        }

        // Response header set karein
        res.writeHead(200, { 'Content-Type': 'application/json' });
        // JSON array ko string mein convert karke bhejein
        res.end(JSON.stringify(users));
        
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello from the server! Access /api/data to get users.');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
