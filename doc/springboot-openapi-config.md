# About
This document is for configuring Spring boot project to publish APIs under OpenAPI standard.

# Dependency
Spring boot ``version 2``
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-ui</artifactId>
    <version>1.6.9</version>
</dependency>
```

Spring boot ``version 3``
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-webmvc-core</artifactId>
</dependency>
```

# Config project
Add to ``application.yml`` (or ``application.properties``):
```yml
springdoc:
  paths-to-match:
    - /api/authenticate
    - /api/sign/hash
    - /api/sign/raw
    - /api/sign/invisiblePdf
    - /api/sign/pdf
    - /api/sign/xml
    - /api/verification/raw
    - /api/verification/hash
    - /api/verification/pdf
    - /api/verification/xml
    - /api/certificate/getImage
    - /api/certificate/getImageByTemplateId
    - /api/certificate/changeCertPIN
    - /api/certificate/resetHsmCertPin
    - /api/certificate/get
    - /api/signature-templates
#    - /api/transactions
```
In this config, ``paths-to-match`` specifies APIs we want to publish to OpenAPI specification.

Run project, and we can access the OpenAPI specification by default URL:

```shell
http://localhost:8080/v3/api-docs
```

For example, can see this specification: [https://petstore3.swagger.io/api/v3/openapi.json](https://petstore3.swagger.io/api/v3/openapi.json)

## Note
In some project that is structured by some generator tools, the ``springdoc`` is default ``disable``. Or need particular environment when do start project.

For example:
```yml
# Conditionally disable springdoc on missing api-docs profile
spring:
  config:
    activate:
      on-profile: '!api-docs'
springdoc:
  api-docs:
    enabled: false
```

# Gen API document
After all above preparation, we can use ``gendoc`` to generate API document:
```shell
gendoc init http://localhost:8080/v3/api-docs
```

In production environment, be careful with domain ``localhost``, because once we initialize project, the ``URL`` will be used for all update tasks in the future.
Change the URL after ``init`` requires some complex manual actions.
