const fs = require('fs');

exports.version = fs.readFileSync('.revision').toString().trim();

exports.date = (time) => {
    let date = time && new Date(time) || new Date();
    return date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear() + ' ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
};