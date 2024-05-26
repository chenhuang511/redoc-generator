const runner = require('./index')
// runner.createStructure('D:\\14-APIDOC-GENERATOR\\test')
runner.init('D:\\14-APIDOC-GENERATOR\\test\\', 'http://localhost:8080/v3/api-docs').catch(e => console.log(e))

// const parseSpec = async () => {
//     let openApiSpec = await runner.downloadOpenAPIDescriptionFile('http://localhost:8080/v3/api-docs')
//     const result = [];
//
//     // Duyệt qua tất cả các paths
//     for (const path in openApiSpec.paths) {
//         if (openApiSpec.paths.hasOwnProperty(path)) {
//             const methods = openApiSpec.paths[path];
//
//             // Duyệt qua tất cả các phương thức HTTP
//             for (const method in methods) {
//                 if (methods.hasOwnProperty(method)) {
//                     const operation = methods[method];
//
//                     const entry = {
//                         operationId: operation.operationId,
//                         responses: []
//                     };
//
//                     // Nếu có requestBody, thêm requestContentType
//                     if (operation.requestBody && operation.requestBody.content) {
//                         entry.requestContentType = Object.keys(operation.requestBody.content)[0];
//                     }
//
//                     // Duyệt qua các responses
//                     for (const status in operation.responses) {
//                         if (operation.responses.hasOwnProperty(status)) {
//                             const response = operation.responses[status];
//
//                             if (response.content) {
//                                 const contentType = Object.keys(response.content)[0];
//                                 entry.responses.push({
//                                     status: status,
//                                     contentType: contentType
//                                 });
//                             }
//                         }
//                     }
//
//                     result.push(entry);
//                 }
//             }
//         }
//     }
//
//     console.log(result);
// }

// parseSpec().catch(e => console.log(e))
