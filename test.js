const runner = require('./index')
// runner.createStructure('D:\\14-APIDOC-GENERATOR\\test')
runner.init('D:\\14-APIDOC-GENERATOR\\test\\', 'http://localhost:8080/v3/api-docs').catch(e => console.log(e))
