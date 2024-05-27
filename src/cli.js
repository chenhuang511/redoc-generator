#!/usr/bin/env node

const {program} = require('commander');
const packageJson = require('../package.json')
const runner = require('./index')

program
    .version(packageJson.version)
    .description(packageJson.description)

program.command('init <url>')
    .description('Initialize redoc project')
    .action((url) => {
        if (!url) {
            console.log(`Please provide the URL of OpenAPI specs`)
            return
        }
        runner.init(process.cwd(), url).catch(e => console.log(e))
    })

program.command('update')
    .description('Update current redoc project')
    .option('--no-backup', 'Backup all unuseful files before remove')
    .action((options) => {
        let noBackup = options.noBackup !== undefined
        runner.update(process.cwd(), noBackup).catch(e => console.log(e))
    })

program.command('version')
    .action(() => console.log(packageJson.version))

program.parse(process.argv);
