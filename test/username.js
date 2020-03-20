const netuser = require('../index')

netuser.list((err, list) => {
    console.log(list)
})