const fs = require('fs');
let data = fs.readFileSync('public/index.html', 'utf8');
data = data.replace(/data-tooltip="([^"]*)"/g, 'data-tooltip="?"');
fs.writeFileSync('public/index.html', data);
console.log('done');
