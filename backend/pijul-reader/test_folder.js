const { getRepositoryFiles } = require('./index');

// Assuming there's a folder in libpijul
console.log("Listing files inside 'src' folder:");
const files = getRepositoryFiles('/home/abhay/tmptasks/ssh_test/libpijul', 'main', 'src');
console.log(files.slice(0, 5)); // Just print first 5
