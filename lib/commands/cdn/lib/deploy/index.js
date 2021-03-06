/* @flow */
'use strict'

const path = require('path')

const ora = require('ora')
const upload = require('@blinkmobile/aws-s3').upload

const confirm = require('../utils/confirm.js')
const bucketParams = require('../s3-bucket-params.js')
const provisionEnvironment = require('../provision-environment.js')
const getAwsCredentials = require('../aws-credentials.js')
const s3Factory = require('../s3-bucket-factory.js')

const read = require('../read')

/* ::
import OneBlinkAPIClient from '../../../../oneblink-api-client'
*/

module.exports = (
  input /* : Array<string> */,
  flags /* : Object */,
  oneBlinkAPIClient /* : OneBlinkAPIClient */,
) /* : Promise<void> */ => {
  return confirm(flags.force, flags.env).then((confirmation) => {
    if (!confirmation) {
      return
    }
    return read(flags.cwd).then((cfg) => {
      return Promise.all([
        bucketParams.read(flags.cwd, cfg.region),
        getAwsCredentials(cfg, flags.env, oneBlinkAPIClient),
      ])
        .then((results) => s3Factory(...results))
        .then((s3) => {
          const spinner = ora({ spinner: 'dots', text: 'Uploading to CDN' })
          const uploadParams = {
            s3,
            skip: flags.skip,
            prune: flags.prune,
            // Allow deployment of files in a sub directory to the current working directory
            cwd: path.join(flags.cwd, input[0] || '.'),
            bucketPathPrefix: flags.env,
          }

          spinner.start()
          const task = upload(uploadParams)
          task.on('skipped', (fileName) => {
            spinner.warn(`skipped: ${fileName}`)
          })
          task.on('uploaded', (fileName) => {
            spinner.succeed(`uploaded: ${fileName}`)
          })
          task.on('deleted', (fileName) => {
            spinner.warn(`deleted: ${fileName}`)
          })
          return task.promise.catch((err) => {
            spinner.fail('Deployment failed!')
            return Promise.reject(err)
          })
        })
        .then(() => provisionEnvironment(cfg, flags.env, oneBlinkAPIClient))
    })
  })
}
