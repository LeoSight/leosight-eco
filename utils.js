exports.date = (time) => {
    let date = time && new Date(time) || new Date();
    return date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear() + ' ' + date.getHours() + ':' + date.getMinutes();
};