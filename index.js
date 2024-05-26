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

const init = async (runPath, url) => {
    _log(`Generating redoc project for url: ${url} ...`)
    // Check path exists?
    if (!fs.existsSync(runPath)) {
        _log(`Path does not exist, init failed`)
        return
    }

    // Check folder is empty or not?
    const files = fs.readdirSync(runPath);
    if (files.length !== 0) {
        _log(`Root folder is not empty, init failed`)
        return
    }

    // create folders
    for (let folder of folderNames) {
        const currentPath = path.join(runPath, folder)
        fs.mkdirSync(currentPath)
        _log(`Created folder: ${folder}`)
    }

    // create files
    for (const [fileName, content] of Object.entries(fileNames)) {
        const filePath = path.join(runPath, fileName)
        fs.writeFileSync(filePath, content)
        _log(`Created file: ${filePath}`)
    }
    _log(`Generated standard folders and files`)

    _log(`Generating standard contents ...`)
    await decorateConfigFile(runPath, url)

    _log(`Write log...`)
    _initLog['url'] = url
    fs.writeFileSync(runPath + 'runLog.json', JSON.stringify(_initLog))
    _log(`Init process is done`)
}

const update = async (runPath) => {
    _log(`Updating project...`)
    let logFilePath = path.join(runPath, 'runLog.json')
    let isChange = false

    if (!fs.existsSync(logFilePath)) {
        _log(`Log file not found, update failed`)
        return
    }
    let configFilePath = path.join(runPath, 'redocly.yml')
    if (!fs.existsSync(configFilePath)) {
        _log(`redocly.yml file not found, update failed`)
        return
    }
    let assetsFolder = path.join(runPath, 'assets')
    if (!fs.existsSync(assetsFolder) || !fs.statSync(assetsFolder).isDirectory()) {
        _log(`Folder assets not found, update failed`)
        return
    }
    let infoFolder = path.join(runPath, 'info')
    if (!fs.existsSync(infoFolder) || !fs.statSync(infoFolder).isDirectory()) {
        _log(`Folder info not found, update failed`)
        return
    }
    let infoApiFolder = path.join(runPath, 'info/api')
    if (!fs.existsSync(infoApiFolder) || !fs.statSync(infoApiFolder).isDirectory()) {
        _log(`Folder info/api not found, update failed`)
        return
    }
    let samplesRequestFolder = path.join(runPath, 'samples/request')
    if (!fs.existsSync(samplesRequestFolder) || !fs.statSync(samplesRequestFolder).isDirectory()) {
        _log(`Folder samples/request not found, update failed`)
        return
    }
    let samplesResponseFolder = path.join(runPath, 'samples/response')
    if (!fs.existsSync(samplesResponseFolder) || !fs.statSync(samplesResponseFolder).isDirectory()) {
        _log(`Folder samples/response not found, update failed`)
        return
    }

    let genLog = fs.readFileSync(logFilePath, 'utf8')
    genLog = JSON.parse(genLog)
    let config = fs.readFileSync(configFilePath, 'utf8')
    config = yaml.load(config)

    let url = genLog['url']
    const jsonConfig = await downloadOpenAPIDescriptionFile(url)
    let apiSpecInfo = parseSpec(jsonConfig)

    _log(`Valid project, check something added from API spec`)

    // Find something added from API specs
    for (let item of apiSpecInfo) {
        let id = item['operationId']
        if (!genLog[id]) {
            genLog[id] = {}
            config['decorators']['media-type-examples-override']['operationIds'][id] = {}
            _log(`Update for new API: ${id} ...`)
        }
        if (!genLog[id]['info']) {
            let infoPath = `info/api/${id}_info.md`
            fs.writeFileSync(path.join(runPath, infoPath), '')
            _log(`Created file ${infoPath}`)
            genLog[id]['info'] = 1
            config['decorators']['operation-description-override']['operationIds'][id] = infoPath
            isChange = true
        }
        if (!genLog[id]['request'] && item['requestContentType']) {
            let requestPath = `samples/request/${id}.yml`
            fs.writeFileSync(path.join(runPath, requestPath), '')
            _log(`Created file ${requestPath}`)
            config['decorators']['media-type-examples-override']['operationIds'][id]['request'] = {}
            config['decorators']['media-type-examples-override']['operationIds'][id]['request'][item['requestContentType']] = requestPath
            genLog[id]['request'] = 1
            isChange = true
        }
        if (!genLog[id]['responses']) {
            genLog[id]['responses'] = {}
            config['decorators']['media-type-examples-override']['operationIds'][id]['responses'] = {}
        }
        for (let res of item['responses']) {
            let status = res['status']
            let contentType = res['contentType']
            if (!genLog[id]['responses'][status]) {
                let responsePath = `samples/response/${id}_${status}.yml`
                fs.writeFileSync(path.join(runPath, responsePath), '')
                _log(`Created file ${responsePath}`)
                config['decorators']['media-type-examples-override']['operationIds'][id]['responses'][status] = {}
                config['decorators']['media-type-examples-override']['operationIds'][id]['responses'][status][contentType] = responsePath
                genLog[id]['responses'][status] = 1
                isChange = true
            }
        }
    }

    _log(`Checking something removed from API spec`)
    let {removedOperations, changedRequests, changedResponses} = checkChanges(genLog, apiSpecInfo)
    for (let id of removedOperations) {
        removeObjectProperty(config, 'decorators.operation-description-override.operationIds.' + id)
        removeObjectProperty(config, 'decorators.media-type-examples-override.operationIds.' + id)
        removeObjectProperty(genLog, id)

        let infoPath = `info/api/${id}_info.md`
        if (fs.existsSync(path.join(runPath, infoPath))) {
            fs.unlinkSync(path.join(runPath, infoPath))
            _log(`Deleted file: ${infoPath}`)
        }
        let sampleRequestPath = `samples/request/${id}.yml`
        if (fs.existsSync(path.join(runPath, sampleRequestPath))) {
            fs.unlinkSync(path.join(runPath, sampleRequestPath))
            _log(`Deleted file: ${sampleRequestPath}`)
        }
        let sampleResponseFolder = `samples/response`
        let sampleResponseFilePrefixName = `${id}_`
        await deleteFilesWithPrefix(path.join(runPath, sampleResponseFolder), sampleResponseFilePrefixName, sampleResponseFolder)

        isChange = true
        _log(`Removed from project API: ${id}`)
    }
    for (let id of changedRequests) {
        let keyPath = `decorators.media-type-examples-override.operationIds.${id}.request`
        removeObjectProperty(config, keyPath)
        removeObjectProperty(genLog, `${id}.request`)

        let sampleRequestPath = `samples/request/${id}.yml`
        if (fs.existsSync(path.join(runPath, sampleRequestPath))) {
            fs.unlinkSync(path.join(runPath, sampleRequestPath))
            _log(`Deleted file: ${sampleRequestPath}`)
        }

        isChange = true
        _log(`Removed request config for API: ${id}`)
    }

    if (isChange) {
        let newContent = yaml.dump(config)
        fs.writeFileSync(runPath + 'redocly.yml', newContent)
        _log(`Updated file redocly.yml`)
        fs.writeFileSync(logFilePath, JSON.stringify(genLog))
        _log(`Updated file runLog.json`)
    } else
        _log(`Nothing changed`)
    _log(`Update process is done`)
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
    _log(`Modified redocly config file`)
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
            fs.writeFileSync(sampleRequest, '')
            _initLog[id]['request'] = 1
        }
        for (let res of item['responses']) {
            let sampleResponse = `${sampleBasePath}/response/${id}_${res['status']}.yml`
            fs.writeFileSync(sampleResponse, '')
            _initLog[id]['responses'] = {}
            _initLog[id]['responses'][res['status']] = 1
        }
    }
    _log(`Generated sample request, response, info files`)
}

// Function to check for changes between the log and OpenAPI specification
function checkChanges(log, parsedApiSpec) {
    const removedOperations = [];
    const changedRequests = [];
    const changedResponses = [];

    // Create a lookup object for the openApiSpec for easier access
    const openApiLookup = parsedApiSpec.reduce((acc, op) => {
        acc[op.operationId] = op;
        return acc;
    }, {});

    for (const operationId in log) {
        if (log.hasOwnProperty(operationId) && operationId !== 'url') {
            const logOperation = log[operationId];
            const openApiOperation = openApiLookup[operationId];

            if (!openApiOperation) {
                removedOperations.push(operationId);
            } else {
                // Check for requestBody
                if (logOperation.request && !openApiOperation.requestContentType) {
                    changedRequests.push(operationId);
                }

                // Check for responses
                if (logOperation.responses) {
                    for (const status in logOperation.responses) {
                        if (logOperation.responses.hasOwnProperty(status)) {
                            const hasStatusInOpenApi = openApiOperation.responses.some(response => response.status === status);
                            if (!hasStatusInOpenApi) {
                                changedResponses.push(operationId);
                            }
                        }
                    }
                }
            }
        }
    }

    return {removedOperations, changedRequests, changedResponses};
}

function removeObjectProperty(obj, propertyPath) {
    // Convert the path from a string to an array of parts, using dot as separator
    const pathParts = propertyPath.split('.');

    // Store the current object, iterating over each part of the path
    let currentObj = obj;

    // Iterate through each part of the path, except the last one
    for (let i = 0; i < pathParts.length - 1; i++) {
        // Check if this property exists
        if (!currentObj.hasOwnProperty(pathParts[i])) {
            // If not, no need to continue
            return;
        }
        // Move to the next child object
        currentObj = currentObj[pathParts[i]];
    }

    // Delete the last property of the object
    delete currentObj[pathParts[pathParts.length - 1]];
}

// Function to delete files with a specific prefix in a directory
async function deleteFilesWithPrefix(directoryPath, prefixToDelete, simpleDirectoryPath) {
    const fsPromises = fs.promises;
    try {
        const files = await fsPromises.readdir(directoryPath);
        for (const file of files) {
            if (file.startsWith(prefixToDelete)) {
                const filePath = path.join(directoryPath, file);
                await fsPromises.unlink(filePath);
                _log(`Deleted file: ${simpleDirectoryPath}`);
            }
        }
    } catch (err) {
        _log(err);
    }
}

const _log = (message) => {
    console.log(message)
}

module.exports = {
    init,
    update,
}
