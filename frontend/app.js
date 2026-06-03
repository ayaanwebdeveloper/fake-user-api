async function getData() {
    const response = await fetch('http://127.0.0.1:3000/api/data');
    const data = await response.json();
    console.log(data);
}
getData();