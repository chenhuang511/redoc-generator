const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml')
const http = require('http');
const https = require('https');
const urlModule = require('url');

const initRedoclyConfig = `extends:
  - recommended

apis:
  easysign@v1:
    root: changeit_url

theme:
  openapi:
    disableSearch: true
    schemaExpansionLevel: 2
    sortOperationsAlphabetically: true
    hideDownloadButton: true

    theme:
      typography:
        fontSize: 15px
        headings:
          fontWeight: '600'
        code:
          fontSize: 14px
          wrap: true
      sidebar:
        backgroundColor: '#000000'
        textColor: '#ffffff'

decorators:
  info-override:
    title: changeit_API documentation
    summary: changeit_API documentation (OpenAPI) for...
    version: changeit_1.0
    contact:
      url: changeit_https://softdreams.vn
  
  info-description-override:
    filePath: info/home.md
  
  operation-description-override:
    operationIds:
 
  media-type-examples-override:
    operationIds:
`
let _initLog = {}

const folderNames = [
    'assets',
    'assets/img',
    'info',
    'info/api',
    'samples',
    'samples/request',
    'samples/response',
]
const fileNames = {
    'info/home.md': '',
    'README.md': '',
    'redocly.yml': initRedoclyConfig
}

const sampleRequestHeaderTemplate = `@operationId@ sample request:
  summary: '@operationId@ sample request'
  value:
    convert json sample to yml then replace this line
`
const sampleResponseHeaderTemplate = `@operationId@ sample response:
  summary: '@operationId@ sample response'
  value:
    convert json sample to yml then replace this line
`

const init = async (runPath, url) => {
    _log(`Generating redocly project for url: ${url} ...`)
    // const runPath = process.cwd()
    createStructure(runPath)

    _log(`Generating standard contents ...`)
    await decorateConfigFile(runPath, url)

    _log(`Write log...`)
    fs.writeFileSync(runPath + 'runLog.json', JSON.stringify(_initLog))
}

const decorateConfigFile = async (runPath, url) => {
    // Read init config file
    let configContent = fs.readFileSync(runPath + 'redocly.yml', 'utf8');

    // Replace url & load into JS object
    configContent = configContent.replace(new RegExp('changeit_url', 'g'), url)
    const ymlConfig = yaml.load(configContent)

    // Download OpenAPI json content from url
    const jsonConfig = await downloadOpenAPIDescriptionFile(url)
    let apiSpecInfo = parseSpec(jsonConfig)

    // Generate sample files
    genSampleAndInfoFiles(runPath, apiSpecInfo)

    // Edit yaml config
    let tmpInfo = {}
    let tmpRequestResponse = {}
    for (let item of apiSpecInfo) {
        let id = item['operationId']
        tmpInfo[id] = 'info/api/' + id + '_info.md'
        // tmpInfo.push({[id]: descValue})
        let requestValue = {}
        if (item['requestContentType'])
            requestValue[item['requestContentType']] = 'samples/request/' + id + '.yml'
        let responseValue = {}

        for (let res of item['responses']) {
            let tmp = {}
            tmp[res['contentType']] = `samples/response/${id}_${res['status']}.yml`
            responseValue[res['status']] = tmp
        }

        if (Object.keys(requestValue).length > 0)
            tmpRequestResponse[id] = {'request': requestValue, 'responses': responseValue}
        else
            tmpRequestResponse[id] = {'responses': responseValue}
    }

    const stack = [ymlConfig];

    while (stack.length > 0) {
        const currentObj = stack.pop();

        for (const key in currentObj) {
            if (currentObj.hasOwnProperty(key)) {
                const value = currentObj[key];
                if ((!['operation-description-override', 'media-type-examples-override'].includes(key)) && typeof value === 'object') {
                    stack.push(value);
                } else if (key === 'operation-description-override') {
                    currentObj[key]['operationIds'] = tmpInfo
                } else if (key === 'media-type-examples-override') {
                    currentObj[key]['operationIds'] = tmpRequestResponse
                }
            }
        }
    }

    let newContent = yaml.dump(ymlConfig)
    fs.writeFileSync(runPath + 'redocly.yml', newContent)
    _log(`
        ------ Modified redocly config file ------
    `)
}

const downloadOpenAPIDescriptionFile = (url) => {
    return new Promise((resolve, reject) => {
        const parsedUrl = urlModule.parse(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        protocol.get(url, (response) => {
            let data = '';

            // Function called when receiving data from the response
            response.on('data', (chunk) => {
                data += chunk;
            });

            // Function called when the response ends
            response.on('end', () => {
                try {
                    // Convert the JSON data to a JavaScript object
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

const parseSpec = (openApiSpec) => {
    const result = [];

    // Duyệt qua tất cả các paths
    for (const path in openApiSpec.paths) {
        if (openApiSpec.paths.hasOwnProperty(path)) {
            const methods = openApiSpec.paths[path];

            // Duyệt qua tất cả các phương thức HTTP
            for (const method in methods) {
                if (methods.hasOwnProperty(method)) {
                    const operation = methods[method];

                    const entry = {
                        operationId: operation.operationId,
                        responses: []
                    };

                    // Nếu có requestBody, thêm requestContentType
                    if (operation.requestBody && operation.requestBody.content) {
                        entry.requestContentType = Object.keys(operation.requestBody.content)[0];
                    }

                    // Duyệt qua các responses
                    for (const status in operation.responses) {
                        if (operation.responses.hasOwnProperty(status)) {
                            const response = operation.responses[status];

                            if (response.content) {
                                const contentType = Object.keys(response.content)[0];
                                entry.responses.push({
                                    status: status,
                                    contentType: contentType
                                });
                            }
                        }
                    }

                    result.push(entry);
                }
            }
        }
    }

    return result
}

const genSampleAndInfoFiles = (currentPath, apiSpecInfo) => {
    const infoBasePath = currentPath + '/info/api/'
    const sampleBasePath = currentPath + '/samples/'
    for (let item of apiSpecInfo) {
        let id = item['operationId']
        _initLog[id] = {}
        let infoFile = infoBasePath + id + '_info.md'
        fs.writeFileSync(infoFile, '')
        _initLog[id]['info'] = 1
        if (item['requestContentType']) {
            let sampleRequest = sampleBasePath + '/request/' + id + '.yml'
            // let requestHeader = sampleRequestHeaderTemplate.replace(new RegExp('@operationId@', 'g'), id)
            fs.writeFileSync(sampleRequest, '')
            _initLog[id]['request'] = 1
        }
        for (let res of item['responses']) {
            let sampleResponse = `${sampleBasePath}/response/${id}_${res['status']}.yml`
            // let responseHeader = sampleResponseHeaderTemplate.replace(new RegExp('@operationId@', 'g'), id)
            fs.writeFileSync(sampleResponse, '')
            _initLog[id]['responses'] = {}
            _initLog[id]['responses'][res['status']] = 1
        }
    }
    _log(`
        ------ Generated sample request, response, info files ------
    `)
}

const getAllOperationIds = (jsonObj) => {
    const operationIds = [];
    const stack = [jsonObj];

    while (stack.length > 0) {
        const currentObj = stack.pop();

        for (const key in currentObj) {
            const value = currentObj[key];
            if (typeof value === 'object' && value !== null) {
                stack.push(value);
            } else if (key === 'operationId') {
                operationIds.push(value);
            }
        }
    }

    return operationIds;
}

const addDecoratorsForMainConfig = (runPath) => {
    let configContent = fs.readFileSync(runPath + 'redocly.yml', 'utf8');
    let tmpOperationIds = ['isAuthenticated', 'changeCertPIN', 'resetHsmCertificatePin']
    const ymlConfig = yaml.load(configContent)

    let _tmpDesc = []
    let _tmpRequestResponse = []
    for (let id of tmpOperationIds) {
        let descValue = 'info/api/' + id + '_info.md'
        _tmpDesc.push({[id]: descValue})
        let requestValue = [{'application/json': 'samples/request/' + id + '.yml'}]
        let responseValue = [{'200': [{'application/json': 'samples/response/' + id + '.yml'}]}]
        let combination = {'request': requestValue, 'responses': responseValue}
        _tmpRequestResponse.push({[id]: combination})
    }

    const stack = [ymlConfig];

    while (stack.length > 0) {
        const currentObj = stack.pop();

        for (const key in currentObj) {
            if (currentObj.hasOwnProperty(key)) {
                const value = currentObj[key];
                if ((!['operation-description-override', 'media-type-examples-override'].includes(key)) && typeof value === 'object') {
                    stack.push(value);
                } else if (key === 'operation-description-override') {
                    currentObj[key]['operationIds'] = _tmpDesc
                } else if (key === 'media-type-examples-override') {
                    currentObj[key]['operationIds'] = _tmpRequestResponse
                }
            }
        }
    }

    console.log(yaml.dump(ymlConfig))
}

// decorateConfigFile('./test/redocly.yml', 'http://localhost:8080/v3/api-docs').catch()
// addDecoratorsForMainConfig('./test/')

const createStructure = (basePath) => {
    // Check path exists?
    if (!fs.existsSync(basePath)) {
        _log(`Path does not exist`)
        return
    }

    // Check folder is empty or not?
    const files = fs.readdirSync(basePath);
    if (files.length !== 0) {
        _log(`Root folder is not empty`)
        return
    }

    // create folders
    for (let folder of folderNames) {
        const currentPath = path.join(basePath, folder)
        fs.mkdirSync(currentPath)
        _log(`Created folder: ${folder}`)
    }

    // create files
    for (const [fileName, content] of Object.entries(fileNames)) {
        const filePath = path.join(basePath, fileName)
        fs.writeFileSync(filePath, content)
        _log(`Created file: ${filePath}`)
    }
    _log(`
        ------ Init project structure done ------
    `)
}

const _log = (message) => {
    console.log(message)
}

module.exports = {
    createStructure,
    init,
    downloadOpenAPIDescriptionFile
}
