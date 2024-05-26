const runner = require('./index')
// runner.init('D:\\14-APIDOC-GENERATOR\\test\\', 'http://localhost:8080/v3/api-docs').catch(e => console.log(e))
runner.update('D:\\14-APIDOC-GENERATOR\\test\\').catch(e => console.log(e))
