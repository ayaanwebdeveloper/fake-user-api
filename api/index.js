const http = require('http');
const url = require('url');

const server = http.createServer((req,res) =>{
    const path = req.url

    if(path === '/api/data'){
        res.end(JSON.stringify([
            {
               "id": "1",
                "name": 'John Doe',
                "email": 'john@gmail.com'
            },
            {
               "id": "2",
                "name": 'Jane Smith',
                "email": 'jane@gmail.com'
            },
            {
               "id": "3",
                "name": 'Bob Johnson',
                "email": 'bob@gmail.com'
            },
            {
               "id": "4",
                "name": 'Alice Williams',
                "email": 'alice@gmail.com'
            },
            {
               "id": "5",
                "name": 'Charlie Brown',
                "email": 'charlie@gmail.com'
            }
        ]
    )
            
        )
    }else{
        res.end('hello from the server')
    }
})

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
});
