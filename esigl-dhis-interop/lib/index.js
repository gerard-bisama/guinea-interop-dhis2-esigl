#!/usr/bin/env node
'use strict'

const express = require('express')
const medUtils = require('openhim-mediator-utils')
const winston = require('winston')

const utils = require('./utils')

// Logging setup
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {level: 'info', timestamp: true, colorize: true})

// Config
var config = {} // this will vary depending on whats set in openhim-core
const apiConf = process.env.NODE_ENV === 'test' ? require('../config/test') : require('../config/config')
const mediatorConfig = require('../config/mediator')

var port = process.env.NODE_ENV === 'test' ? 7001 : mediatorConfig.endpoints[0].port

/**
 * setupApp - configures the http server for this mediator
 *
 * @return {express.App}  the configured http server
 */
 function errorHandler(err, req, res, next) {
		  if (res.headersSent) {
			return next(err);
		  }
		  res.status(500);
		  res.render('error', { error: err });
	}


function setupApp () {
	
  const app = express()
  app.use(errorHandler);
  var needle = require('needle');
  var async = require('async');
  var btoa = require('btoa');
  
    
	app.get('/syncfacility2fhir/:id', (req, res) => {
	
		const basicClientToken = `Basic ${btoa('exchange'+':'+mediatorConfig.config.clientPassword)}`;
		//console.log(basicClientToken);
		var orchestrations=[];
		orchestrations = [{ 
			ctxObjectRef: "OrgUnits",
			name: "Get orgunits from dhis2", 
			domain: "http://localhost:5001",
			path: "/getdhis2orgUnit/1",
			params: "",
			body: "",
			method: "GET",
			headers: {'Authorization': basicClientToken}
		  }];
		var ctxObject = []; 
		var orchestrationsResults=[]; 
		async.each(orchestrations, function(orchestration, callback) {
		// code to execute the orchestrations
		// construct the URL to request
		var orchUrl = orchestration.domain + orchestration.path + orchestration.params;
		var options={headers:orchestration.headers};
		//console.log(options);
		needle.get(orchUrl,options, function(err, resp) {
		// if error occured
		if ( err ){
			callback(err);
		}
		console.log(orchestration.headers);
	  // add new orchestration to object
		orchestrationsResults.push({
		name: orchestration.name,
		request: {
		  path : orchestration.path,
		  headers: orchestration.headers,
		  querystring: orchestration.params,
		  body: orchestration.body.organisationUnits,
		  method: orchestration.method,
		  timestamp: new Date().getTime()
		},
		response: {
		  status: resp.statusCode,
		  body: JSON.stringify(resp.body.organisationUnits, null, 4),
		  timestamp: new Date().getTime()
		}
		});
		// add orchestration response to context object and return callback
		ctxObject[orchestration.ctxObjectRef] = resp.body.organisationUnits;
		callback();
		});//end of needle orchUrl
		}, function(err){

			// This section will execute once all requests have been completed
			var urn = mediatorConfig.urn;
			var status = 'Successful';
			//JSON.stringify(ctxObject.OrgUnits, null, 4) //This is the listof orgunit and we dont want to store it in the openhim transaction log
			var response = {
			  status: 200,
			  headers: {
				'content-type': 'application/json'
			  },
			  body: {'resquestResult':'success'},
			  timestamp: new Date().getTime()
			};
			// construct property data to be returned
			var properties = {};
			properties['Nombre orgunits extraites'] = ctxObject.OrgUnits.length;
			// construct returnObject to be returned
			//orchestrationsResults,
			var returnObject = {
			  "x-mediator-urn": urn,
			  "status": status,
			  "response": response,
			  "orchestrations": orchestrationsResults,
			  "properties": properties
			}
			// set content type header so that OpenHIM knows how to handle the response
			res.set('Content-Type', 'application/json+openhim');
			res.send(returnObject);
			// if any errors occurred during a request the print out the error and stop processing
			if (err){
				console.log(err)
			//return;
			}
		});//end of asyn.each orchestrations
	
	})//end of app.get
  return app
}

/**
 * start - starts the mediator
 *
 * @param  {Function} callback a node style callback that is called once the
 * server is started
 */
function start (callback) {
  if (apiConf.api.trustSelfSigned) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0' }

  if (apiConf.register) {
    medUtils.registerMediator(apiConf.api, mediatorConfig, (err) => {
      if (err) {
        winston.error('Failed to register this mediator, check your config')
        winston.error(err.stack)
        process.exit(1)
      }
      apiConf.api.urn = mediatorConfig.urn
      medUtils.fetchConfig(apiConf.api, (err, newConfig) => {
        winston.info('Received initial config:')
        winston.info(JSON.stringify(newConfig))
        config = newConfig
        if (err) {
          winston.error('Failed to fetch initial config')
          winston.error(err.stack)
          process.exit(1)
        } else {
          winston.info('Successfully registered mediator!')
          let app = setupApp()
          const server = app.listen(port, () => {
            if (apiConf.heartbeat) {
              let configEmitter = medUtils.activateHeartbeat(apiConf.api)
              configEmitter.on('config', (newConfig) => {
                winston.info('Received updated config:')
                winston.info(JSON.stringify(newConfig))
                // set new config for mediator
                config = newConfig

                // we can act on the new config received from the OpenHIM here
                winston.info(config)
              })
            }
            callback(server)
          })
        }
      })
    })
  } else {
    // default to config from mediator registration
    config = mediatorConfig.config
    let app = setupApp()
    const server = app.listen(port, () => callback(server))
  }
}
exports.start = start

if (!module.parent) {
  // if this script is run directly, start the server
  start(() => winston.info(`Listening on ${port}...`))
}
